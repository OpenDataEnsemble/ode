import RNFS from 'react-native-fs';
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import AppConfigService from '../services/AppConfigService';
import { profileCachePath, profilePath } from '../profiles/ProfilePaths';
import { logger } from '../diagnostics/logger';
import {
  BUNDLED_TILE_EXTENSIONS,
  basemapProbeUrl,
  resolveBasemap,
  resolveBundledStyle,
  type Basemap,
  type BundledTileFile,
} from './basemap';

/** Folder inside the app bundle that holds offline map files. */
export const BUNDLE_MAPS_DIR = 'app/maps';

async function listBundledTileFiles(
  mapsDir: string,
): Promise<BundledTileFile[]> {
  try {
    if (!(await RNFS.exists(mapsDir))) {
      return [];
    }
    const entries = await RNFS.readDir(mapsDir);
    return entries
      .filter(
        entry =>
          entry.isFile() &&
          BUNDLED_TILE_EXTENSIONS.some(ext =>
            entry.name.toLowerCase().endsWith(ext),
          ),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(entry => ({ name: entry.name, path: entry.path }));
  } catch (error) {
    logger.warn(
      'map',
      error instanceof Error ? error.message : 'Could not list bundled maps',
    );
    return [];
  }
}

async function readBundledStyle(mapsDir: string) {
  const stylePath = `${mapsDir}/style.json`;
  try {
    if (!(await RNFS.exists(stylePath))) {
      return null;
    }
    const raw = await RNFS.readFile(stylePath, 'utf8');
    const style = resolveBundledStyle(raw, mapsDir);
    if (!style) {
      logger.warn('map', 'maps/style.json is not a MapLibre v8 style');
    }
    return style;
  } catch (error) {
    logger.warn(
      'map',
      error instanceof Error ? error.message : 'Could not read maps/style.json',
    );
    return null;
  }
}

/** Never let a dead or captive network hold up the map. */
const NETWORK_TIMEOUT_MS = 4000;
const STYLE_CACHE_FILE = 'maps/remote-style.json';

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readCachedStyle(
  styleUrl: string,
): Promise<StyleSpecification | null> {
  try {
    const path = profileCachePath(STYLE_CACHE_FILE);
    if (!(await RNFS.exists(path))) return null;
    const cached = JSON.parse(await RNFS.readFile(path, 'utf8'));
    return cached?.url === styleUrl && cached.style?.version === 8
      ? (cached.style as StyleSpecification)
      : null;
  } catch {
    return null;
  }
}

async function cacheStyle(styleUrl: string, style: StyleSpecification) {
  try {
    const path = profileCachePath(STYLE_CACHE_FILE);
    const dir = path.slice(0, path.lastIndexOf('/'));
    if (!(await RNFS.exists(dir))) await RNFS.mkdir(dir);
    await RNFS.writeFile(
      path,
      JSON.stringify({ url: styleUrl, style }),
      'utf8',
    );
  } catch (error) {
    logger.warn(
      'map',
      error instanceof Error ? error.message : 'Could not cache map style',
    );
  }
}

async function mapsConfig() {
  const appConfig = AppConfigService.getInstance();
  await appConfig.loadConfig();
  return appConfig.getConfig()?.maps;
}

/**
 * Resolve the basemap from what is on the device only: app.config.json `maps`,
 * offline map files in the bundle's `maps/` folder, and a configured style URL
 * as cached by an earlier online visit. Never touches the network.
 */
export async function loadBasemap(): Promise<Basemap> {
  const config = await mapsConfig();
  const mapsDir = profilePath(BUNDLE_MAPS_DIR);
  const [bundledFiles, bundledStyle, remoteStyle] = await Promise.all([
    listBundledTileFiles(mapsDir),
    readBundledStyle(mapsDir),
    config?.styleUrl ? readCachedStyle(config.styleUrl) : null,
  ]);
  return resolveBasemap({ config, bundledFiles, bundledStyle, remoteStyle });
}

/**
 * Check, in the background, whether the online basemap is reachable. A
 * configured style URL is fetched and cached so it is available offline later;
 * `styleUpdated` says the caller should reload the basemap to use it.
 */
export async function checkBasemapOnline(): Promise<{
  online: boolean;
  styleUpdated: boolean;
}> {
  const config = await mapsConfig();
  if (config?.styleUrl) {
    const response = await fetchWithTimeout(config.styleUrl);
    if (!response?.ok) return { online: false, styleUpdated: false };
    try {
      const style = (await response.json()) as StyleSpecification;
      if (style?.version !== 8) return { online: true, styleUpdated: false };
      const previous = await readCachedStyle(config.styleUrl);
      await cacheStyle(config.styleUrl, style);
      return {
        online: true,
        styleUpdated: JSON.stringify(previous) !== JSON.stringify(style),
      };
    } catch {
      return { online: true, styleUpdated: false };
    }
  }
  const response = await fetchWithTimeout(basemapProbeUrl(config));
  return { online: Boolean(response?.ok), styleUpdated: false };
}
