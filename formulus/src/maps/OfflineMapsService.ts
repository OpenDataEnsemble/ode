import {
  OfflineManager,
  type OfflinePack,
  type OfflinePackStatus,
} from '@maplibre/maplibre-react-native';
import { getActiveProfile } from '../profiles/ProfileRuntime';
import { logger } from '../diagnostics/logger';
import { estimateTileCount } from './basemap';

/**
 * Hard cap on tiles in one area download. Keeps a mis-sized area (a whole
 * country at street zoom) from filling the device; the UI asks the user to zoom
 * in instead.
 */
export const OFFLINE_PACK_TILE_LIMIT = 20000;
export const OFFLINE_PACK_MIN_ZOOM = 8;

export type OfflineAreaMetadata = {
  name: string;
  profileId: string;
  createdAt: number;
  minZoom: number;
  maxZoom: number;
};

export type OfflineArea = {
  id: string;
  bounds: [number, number, number, number];
  metadata: OfflineAreaMetadata;
  status: OfflinePackStatus | null;
};

let configured = false;

function configureOnce() {
  if (configured) return;
  configured = true;
  OfflineManager.setTileCountLimit(OFFLINE_PACK_TILE_LIMIT);
  OfflineManager.setProgressEventThrottle(750);
}

function readMetadata(pack: OfflinePack): OfflineAreaMetadata | null {
  const m = pack.metadata as Partial<OfflineAreaMetadata> | undefined;
  if (!m || typeof m.name !== 'string' || typeof m.profileId !== 'string') {
    return null;
  }
  return {
    name: m.name,
    profileId: m.profileId,
    createdAt: Number(m.createdAt ?? 0),
    minZoom: Number(m.minZoom ?? OFFLINE_PACK_MIN_ZOOM),
    maxZoom: Number(m.maxZoom ?? 0),
  };
}

/**
 * MapLibre keeps one offline database per app; packs are tagged with the
 * profile that created them so each profile only sees (and deletes) its own.
 */
export async function listOfflineAreas(): Promise<OfflineArea[]> {
  configureOnce();
  const profileId = getActiveProfile().id;
  const packs = await OfflineManager.getPacks();
  const areas: OfflineArea[] = [];
  for (const pack of packs) {
    const metadata = readMetadata(pack);
    if (!metadata || metadata.profileId !== profileId) continue;
    let status: OfflinePackStatus | null = null;
    try {
      status = await pack.status();
    } catch (error) {
      logger.warn(
        'map',
        error instanceof Error ? error.message : 'Offline pack status failed',
      );
    }
    areas.push({
      id: pack.id,
      bounds: pack.bounds as [number, number, number, number],
      metadata,
      status,
    });
  }
  return areas.sort((a, b) => b.metadata.createdAt - a.metadata.createdAt);
}

export function estimateAreaTiles(
  bounds: [number, number, number, number],
  maxZoom: number,
): number {
  return estimateTileCount(bounds, OFFLINE_PACK_MIN_ZOOM, maxZoom);
}

export async function downloadOfflineArea(options: {
  name: string;
  bounds: [number, number, number, number];
  mapStyle: string;
  maxZoom: number;
  onProgress: (status: OfflinePackStatus) => void;
  onError: (message: string) => void;
}): Promise<string> {
  configureOnce();
  const metadata: OfflineAreaMetadata = {
    name: options.name,
    profileId: getActiveProfile().id,
    createdAt: Date.now(),
    minZoom: OFFLINE_PACK_MIN_ZOOM,
    maxZoom: options.maxZoom,
  };
  logger.info('map', 'offline area download start', {
    phase: 'start',
    counts: estimateAreaTiles(options.bounds, options.maxZoom),
  });
  const pack = await OfflineManager.createPack(
    {
      mapStyle: options.mapStyle,
      bounds: options.bounds,
      minZoom: OFFLINE_PACK_MIN_ZOOM,
      maxZoom: options.maxZoom,
      metadata,
    },
    (_pack, status) => {
      options.onProgress(status);
      if (status.state === 'complete') {
        logger.info('map', 'offline area download complete', {
          phase: 'done',
          counts: status.completedTileCount,
          success: true,
        });
      }
    },
    (_pack, error) => {
      logger.warn('map', `offline area download error: ${error.message}`);
      options.onError(error.message);
    },
  );
  return pack.id;
}

export async function watchOfflineArea(
  id: string,
  onProgress: (status: OfflinePackStatus) => void,
  onError: (message: string) => void,
): Promise<void> {
  configureOnce();
  await OfflineManager.addListener(
    id,
    (_pack, status) => onProgress(status),
    (_pack, error) => onError(error.message),
  );
}

export function unwatchOfflineArea(id: string): void {
  OfflineManager.removeListener(id);
}

export async function resumeOfflineArea(id: string): Promise<void> {
  const pack = await OfflineManager.getPack(id);
  await pack.resume();
}

export async function deleteOfflineArea(id: string): Promise<void> {
  OfflineManager.removeListener(id);
  await OfflineManager.deletePack(id);
}
