import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import type { MapsConfig } from '../types/AppConfig';

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

/** Hosts whose usage policy forbids bulk (offline) tile download. */
const NO_BULK_DOWNLOAD_HOSTS = ['tile.openstreetmap.org'];

export const BUNDLED_TILE_EXTENSIONS = ['.mbtiles', '.pmtiles'] as const;

export type BundledTileFile = {
  /** File name inside the bundle's maps/ folder. */
  name: string;
  /** Absolute path on the device. */
  path: string;
};

export type Basemap = {
  /** What MapLibre renders: an inline style object or a style URL. */
  mapStyle: StyleSpecification | string;
  /**
   * Style used to create offline packs, or null when downloads are not
   * allowed for this tile source.
   */
  downloadStyle: string | null;
  /** Why downloads are unavailable, when they are. */
  downloadBlockedReason: 'osm-policy' | 'not-enabled' | 'bundled' | null;
  /** Highest zoom an area download should fetch. */
  offlineMaxZoom: number;
  /** Offline map files from the app bundle that are part of this style. */
  bundledFiles: BundledTileFile[];
  /** True when a bundled vector style replaces the online basemap. */
  usesBundledStyle: boolean;
};

function sourceUrlFor(file: BundledTileFile): string {
  const lower = file.name.toLowerCase();
  const absolute = file.path.startsWith('/') ? file.path : `/${file.path}`;
  return lower.endsWith('.pmtiles')
    ? `pmtiles://file://${absolute}`
    : `mbtiles://${absolute}`;
}

function safeLayerId(name: string): string {
  return name.replace(/[^A-Za-z0-9_-]/g, '_');
}

function isNoBulkDownloadHost(url: string): boolean {
  return NO_BULK_DOWNLOAD_HOSTS.some(host => url.includes(host));
}

/**
 * Raster style with the online tile source at the bottom and every bundled
 * raster file stacked above it. Offline, the online layer simply has no tiles
 * and the bundled files (and MapLibre's cache) show through.
 */
export function buildRasterStyle(
  config: MapsConfig | undefined,
  bundledFiles: BundledTileFile[],
): StyleSpecification {
  const tiles = config?.tiles?.length ? config.tiles : [OSM_TILE_URL];
  const attribution =
    config?.attribution ??
    (tiles.some(isNoBulkDownloadHost) ? OSM_ATTRIBUTION : undefined);
  const style: StyleSpecification = {
    version: 8,
    sources: {
      online: {
        type: 'raster',
        tiles,
        tileSize: config?.tileSize ?? 256,
        maxzoom: config?.maxZoom ?? 19,
        ...(attribution ? { attribution } : {}),
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#e9e5dc' },
      },
      { id: 'online', type: 'raster', source: 'online' },
    ],
  };
  for (const file of bundledFiles) {
    const id = `bundle_${safeLayerId(file.name)}`;
    style.sources[id] = {
      type: 'raster',
      url: sourceUrlFor(file),
      tileSize: 256,
    };
    style.layers.push({ id, type: 'raster', source: id });
  }
  return style;
}

/** Same style without bundled files: what an offline pack downloads. */
function onlineOnlyRasterStyle(config: MapsConfig | undefined): string {
  return JSON.stringify(buildRasterStyle(config, []));
}

/**
 * Bundled `maps/style.json` may reference files next to it with the
 * `{mapsDir}` placeholder, e.g. `"url": "mbtiles://{mapsDir}/region.mbtiles"`.
 */
export function resolveBundledStyle(
  rawStyle: string,
  mapsDir: string,
): StyleSpecification | null {
  try {
    const dir = mapsDir.replace(/\/+$/, '');
    const parsed = JSON.parse(rawStyle.split('{mapsDir}').join(dir));
    if (parsed && typeof parsed === 'object' && parsed.version === 8) {
      return parsed as StyleSpecification;
    }
  } catch {
    // Fall through to the online basemap.
  }
  return null;
}

/** One URL whose reachability tells whether the online basemap can load. */
export function basemapProbeUrl(config: MapsConfig | undefined): string {
  if (config?.styleUrl) {
    return config.styleUrl;
  }
  const template = config?.tiles?.[0] ?? OSM_TILE_URL;
  return template
    .replace('{s}', 'a')
    .replace('{z}', '0')
    .replace('{x}', '0')
    .replace('{y}', '0');
}

export function resolveBasemap(input: {
  config: MapsConfig | undefined;
  bundledFiles: BundledTileFile[];
  bundledStyle: StyleSpecification | null;
  /**
   * The configured `styleUrl` as a style object, fetched now or cached from an
   * earlier online visit. Null when it has never been reachable.
   */
  remoteStyle?: StyleSpecification | null;
}): Basemap {
  const { config, bundledFiles, bundledStyle, remoteStyle } = input;

  if (bundledStyle) {
    return {
      mapStyle: bundledStyle,
      downloadStyle: null,
      downloadBlockedReason: 'bundled',
      offlineMaxZoom: 14,
      bundledFiles,
      usesBundledStyle: true,
    };
  }

  if (config?.styleUrl) {
    const allowed =
      config.allowOfflineDownload === true &&
      !isNoBulkDownloadHost(config.styleUrl);
    return {
      // A style URL that cannot be fetched would leave the map blank; the
      // built-in raster style still draws the observations.
      mapStyle: remoteStyle ?? buildRasterStyle(config, bundledFiles),
      downloadStyle: allowed ? config.styleUrl : null,
      downloadBlockedReason: allowed
        ? null
        : isNoBulkDownloadHost(config.styleUrl)
          ? 'osm-policy'
          : 'not-enabled',
      offlineMaxZoom: config.offlineMaxZoom ?? 14,
      bundledFiles,
      usesBundledStyle: false,
    };
  }

  const tiles = config?.tiles?.length ? config.tiles : [OSM_TILE_URL];
  const osm = tiles.some(isNoBulkDownloadHost);
  const allowed = !osm && config?.allowOfflineDownload === true;
  return {
    mapStyle: buildRasterStyle(config, bundledFiles),
    downloadStyle: allowed ? onlineOnlyRasterStyle(config) : null,
    downloadBlockedReason: allowed ? null : osm ? 'osm-policy' : 'not-enabled',
    offlineMaxZoom: config?.offlineMaxZoom ?? 16,
    bundledFiles,
    usesBundledStyle: false,
  };
}

/** Slippy-map tile count for a bounding box over a zoom range. */
export function estimateTileCount(
  bounds: [number, number, number, number],
  minZoom: number,
  maxZoom: number,
): number {
  const [west, south, east, north] = bounds;
  const clampLat = (lat: number) => Math.max(-85.0511, Math.min(85.0511, lat));
  const tileX = (lon: number, z: number) =>
    Math.floor(((lon + 180) / 360) * 2 ** z);
  const tileY = (lat: number, z: number) => {
    const rad = (clampLat(lat) * Math.PI) / 180;
    return Math.floor(
      ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
        2 ** z,
    );
  };
  let total = 0;
  for (let z = Math.max(0, minZoom); z <= maxZoom; z += 1) {
    const max = 2 ** z - 1;
    const x0 = Math.max(0, Math.min(max, tileX(west, z)));
    const x1 = Math.max(0, Math.min(max, tileX(east, z)));
    const y0 = Math.max(0, Math.min(max, tileY(north, z)));
    const y1 = Math.max(0, Math.min(max, tileY(south, z)));
    total += (Math.abs(x1 - x0) + 1) * (Math.abs(y1 - y0) + 1);
  }
  return total;
}

/**
 * Grow a bounding box by `km` on every side so the downloaded area stays
 * usable at the edge of the work area.
 */
export function padBounds(
  bounds: [number, number, number, number],
  km: number,
): [number, number, number, number] {
  const [west, south, east, north] = bounds;
  const dLat = km / 111;
  const midLat = ((south + north) / 2) * (Math.PI / 180);
  const dLon = km / (111 * Math.max(0.1, Math.cos(midLat)));
  return [
    Math.max(-180, west - dLon),
    Math.max(-85, south - dLat),
    Math.min(180, east + dLon),
    Math.min(85, north + dLat),
  ];
}
