import {
  appendObservationListFilters,
  type ObservationListQuery,
} from './observationListQuery';
import { isObservationFullySynced } from '../utils/observationSyncStatus';

/**
 * Upper bound on points the map loads in one read. Far above what a device
 * normally holds for one study; keeps a runaway dataset from stalling the UI.
 */
export const OBSERVATION_MAP_POINT_LIMIT = 5000;

export type ObservationMapQuery = Omit<
  ObservationListQuery,
  'page' | 'pageSize'
> & {
  limit?: number;
};

export type ObservationMapPoint = {
  observationId: string;
  formType: string;
  createdAt: Date;
  synced: boolean;
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export type ObservationMapResult = {
  points: ObservationMapPoint[];
  /** Observations matching the filters, with or without a location. */
  total: number;
  /** Observations matching the filters that have no usable location. */
  withoutLocation: number;
  /** True when more located observations exist than `limit` returned. */
  truncated: boolean;
};

const MAP_COLUMNS = `observation_id, form_type, created_at, updated_at, synced_at, geolocation`;

/**
 * Same filters as the Observations table, so List and Map always show the
 * same set. Only rows that stored a geolocation are read; `data` is never read.
 */
export function buildObservationMapSql(query: ObservationMapQuery): {
  pointsSql: string;
  pointsParams: Array<string | number>;
  countSql: string;
  countParams: Array<string | number>;
  limit: number;
} {
  const limit = Math.max(1, query.limit ?? OBSERVATION_MAP_POINT_LIMIT);
  const where: string[] = [];
  const params: Array<string | number> = [];
  appendObservationListFilters(where, params, query);
  const whereSql = `WHERE ${where.join(' AND ')}`;
  return {
    // One extra row tells us whether the cap cut anything off.
    pointsSql: `SELECT ${MAP_COLUMNS} FROM observations ${whereSql} AND geolocation IS NOT NULL AND geolocation != '' ORDER BY created_at DESC LIMIT ?`,
    pointsParams: [...params, limit + 1],
    countSql: `SELECT COUNT(*) AS cnt FROM observations ${whereSql}`,
    countParams: [...params],
    limit,
  };
}

function finiteNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/**
 * Parse the stored geolocation JSON. Rejects out-of-range values and the 0,0
 * "null island" fix that some GPS stacks report before they have a position.
 */
export function parseObservationCoordinates(
  raw: unknown,
): { latitude: number; longitude: number; accuracy: number | null } | null {
  if (raw == null || raw === '') {
    return null;
  }
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') {
    return null;
  }
  const geo = value as Record<string, unknown>;
  const latitude = finiteNumber(geo.latitude);
  const longitude = finiteNumber(geo.longitude);
  if (latitude == null || longitude == null) {
    return null;
  }
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }
  if (latitude === 0 && longitude === 0) {
    return null;
  }
  return { latitude, longitude, accuracy: finiteNumber(geo.accuracy) };
}

export function mapObservationMapRow(
  row: Record<string, unknown>,
): ObservationMapPoint | null {
  const coords = parseObservationCoordinates(row.geolocation);
  if (!coords) {
    return null;
  }
  const syncedRaw = row.synced_at;
  const syncedAt =
    syncedRaw == null || syncedRaw === '' ? null : new Date(Number(syncedRaw));
  const updatedAt = new Date(Number(row.updated_at ?? 0));
  return {
    observationId: String(row.observation_id ?? row.id ?? ''),
    formType: String(row.form_type ?? ''),
    createdAt: new Date(Number(row.created_at ?? 0)),
    synced: isObservationFullySynced({ updatedAt, syncedAt }),
    ...coords,
  };
}

export type LngLatBoundsTuple = [number, number, number, number];

/**
 * [west, south, east, north] around the given points, or null when empty.
 */
export function boundsOfPoints(
  points: Array<{ latitude: number; longitude: number }>,
): LngLatBoundsTuple | null {
  if (points.length === 0) {
    return null;
  }
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const p of points) {
    west = Math.min(west, p.longitude);
    east = Math.max(east, p.longitude);
    south = Math.min(south, p.latitude);
    north = Math.max(north, p.latitude);
  }
  return [west, south, east, north];
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Great-circle distance in kilometres. */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Points to frame the initial view on. A single mistyped or stale fix (another
 * country, a test device at the office) would otherwise zoom the map out until
 * the real work area is a dot. Points further than `factor` times the median
 * distance from the median centre (and at least `minKm`) are left out of the
 * framing only; they are still drawn.
 */
export function framingPoints<
  T extends { latitude: number; longitude: number },
>(points: T[], factor = 5, minKm = 5): T[] {
  if (points.length < 4) {
    return points;
  }
  const centre = {
    latitude: median(points.map(p => p.latitude)),
    longitude: median(points.map(p => p.longitude)),
  };
  const distances = points.map(p => distanceKm(centre, p));
  const limit = Math.max(minKm, median(distances) * factor);
  const inliers = points.filter((_, i) => distances[i] <= limit);
  return inliers.length > 0 ? inliers : points;
}
