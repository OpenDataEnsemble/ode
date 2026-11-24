import type { ObservationMapPoint } from '../database/observationMapQuery';

/**
 * Colour-blind-safe categorical palette (Okabe–Ito, plus extras), one per form
 * type in a stable order. Sync state is shown by the outline, not by colour.
 */
export const FORM_TYPE_PALETTE = [
  '#0072B2',
  '#E69F00',
  '#009E73',
  '#CC79A7',
  '#D55E00',
  '#56B4E9',
  '#8C6D31',
  '#6A3D9A',
  '#F0E442',
  '#4D4D4D',
] as const;

export function colorsByFormType(formTypes: string[]): Record<string, string> {
  const sorted = [...new Set(formTypes)].sort((a, b) => a.localeCompare(b));
  const out: Record<string, string> = {};
  sorted.forEach((formType, i) => {
    out[formType] = FORM_TYPE_PALETTE[i % FORM_TYPE_PALETTE.length];
  });
  return out;
}

/** Above this zoom nothing is clustered except points that share a spot. */
export const CLUSTER_MAX_ZOOM = 16;
export const CLUSTER_RADIUS_PX = 48;

export type PointProps = {
  observationId: string;
  formType: string;
  color: string;
  synced: boolean;
};

export function toFeatureCollection(
  points: ObservationMapPoint[],
  colors: Record<string, string>,
): GeoJSON.FeatureCollection<GeoJSON.Point, PointProps> {
  return {
    type: 'FeatureCollection',
    features: points.map(p => ({
      type: 'Feature',
      id: p.observationId,
      geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
      properties: {
        observationId: p.observationId,
        formType: p.formType,
        color: colors[p.formType] ?? FORM_TYPE_PALETTE[0],
        synced: p.synced,
      },
    })),
  };
}

/**
 * Count badges are bundled images (see scripts/generate-map-cluster-badges.py)
 * so they render offline: map text would need downloaded font glyphs.
 * Thresholds are ascending; each badge covers counts from its threshold up.
 */
export const CLUSTER_BADGES: Array<[threshold: number, image: string]> = [
  [2, 'cluster-2'],
  [3, 'cluster-3'],
  [4, 'cluster-4'],
  [5, 'cluster-5'],
  [6, 'cluster-6'],
  [7, 'cluster-7'],
  [8, 'cluster-8'],
  [9, 'cluster-9'],
  [10, 'cluster-10p'],
  [20, 'cluster-20p'],
  [50, 'cluster-50p'],
  [100, 'cluster-100p'],
  [200, 'cluster-200p'],
  [500, 'cluster-500p'],
  [1000, 'cluster-1kp'],
  [2000, 'cluster-2kp'],
  [5000, 'cluster-5kp'],
  [10000, 'cluster-10kp'],
];

/** MapLibre `step` expression choosing the badge for a cluster's point_count. */
export function clusterBadgeExpression(): unknown[] {
  const [first, ...rest] = CLUSTER_BADGES;
  return [
    'step',
    ['get', 'point_count'],
    first[1],
    ...rest.flatMap(([threshold, image]) => [threshold, image]),
  ];
}

/** Badge image name for a count, mirroring {@link clusterBadgeExpression}. */
export function clusterBadgeFor(count: number): string {
  let image = CLUSTER_BADGES[0][1];
  for (const [threshold, name] of CLUSTER_BADGES) {
    if (count >= threshold) image = name;
  }
  return image;
}
