import AsyncStorage from '../profiles/ProfileStorage';
import { profilePath, profilePaths } from '../profiles/ProfilePaths';
import { profileActivity } from '../profiles/ProfileActivity';
import RNFS from 'react-native-fs';
import { collectTranslationLocalesFromUiSchema } from '../lib/collectTranslationLocales';
import { sortFormLocaleCodes } from '../lib/formLocale';
import { normalizeAppBundleVersion } from '../utils/appBundleVersion';
import { appEvents } from '../webview/FormulusMessageHandlers';

const cacheDir = () => profilePath('app/.ode');
const cacheFile = () => profilePath('app/.ode/form-locale-index.json');

const RESERVED_FORM_DIR_NAMES = new Set(['extensions', 'question_types']);

interface FormLocaleIndexCache {
  bundleVersion: string;
  scannedAt: string;
  locales: string[];
}

export class FormLocaleIndexService {
  private static instance: FormLocaleIndexService | null = null;

  private refreshPromise: Promise<string[]> | null = null;

  private constructor() {
    appEvents.addListener('bundleUpdated', () => {
      void this.refreshIndex().catch(err => {
        console.warn(
          '[FormLocaleIndexService] refresh after bundle failed:',
          err,
        );
      });
    });
  }

  static getInstance(): FormLocaleIndexService {
    if (!FormLocaleIndexService.instance) {
      FormLocaleIndexService.instance = new FormLocaleIndexService();
    }
    return FormLocaleIndexService.instance;
  }

  private async readBundleVersion(): Promise<string> {
    const raw = await AsyncStorage.getItem('@appVersion');
    return normalizeAppBundleVersion(raw ?? '');
  }

  private async readCache(): Promise<FormLocaleIndexCache | null> {
    try {
      const exists = await RNFS.exists(cacheFile());
      if (!exists) return null;
      const raw = await RNFS.readFile(cacheFile(), 'utf8');
      const parsed = JSON.parse(raw) as FormLocaleIndexCache;
      if (!Array.isArray(parsed.locales)) return null;
      return parsed;
    } catch (err) {
      console.warn('[FormLocaleIndexService] Failed to read cache:', err);
      return null;
    }
  }

  private async writeCache(locales: string[]): Promise<void> {
    const bundleVersion = await this.readBundleVersion();
    const payload: FormLocaleIndexCache = {
      bundleVersion,
      scannedAt: new Date().toISOString(),
      locales,
    };
    try {
      const dirExists = await RNFS.exists(cacheDir());
      if (!dirExists) {
        await RNFS.mkdir(cacheDir());
      }
      await RNFS.writeFile(cacheFile(), JSON.stringify(payload), 'utf8');
    } catch (err) {
      console.warn('[FormLocaleIndexService] Failed to write cache:', err);
    }
  }

  async scanFromStorage(): Promise<string[]> {
    return profileActivity.run('Scan form languages', () =>
      this.scanFromStorageImpl(),
    );
  }

  private async scanFromStorageImpl(): Promise<string[]> {
    const localeSet = new Set<string>();
    const seenFormIds = new Set<string>();

    for (const formsDir of [profilePaths.forms(), profilePath('app/forms')]) {
      const dirExists = await RNFS.exists(formsDir);
      if (!dirExists) continue;

      const entries = await RNFS.readDir(formsDir);
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (
          entry.name.startsWith('.') ||
          entry.name.startsWith('temp_') ||
          RESERVED_FORM_DIR_NAMES.has(entry.name)
        ) {
          continue;
        }
        if (seenFormIds.has(entry.name)) continue;

        const uiPath = `${entry.path}/ui.json`;
        try {
          const uiExists = await RNFS.exists(uiPath);
          if (!uiExists) continue;
          const raw = await RNFS.readFile(uiPath, 'utf8');
          const uiSchema = JSON.parse(raw) as unknown;
          for (const code of collectTranslationLocalesFromUiSchema(uiSchema)) {
            localeSet.add(code);
          }
          seenFormIds.add(entry.name);
        } catch (err) {
          console.warn(
            `[FormLocaleIndexService] Failed to scan ui.json for ${entry.name}:`,
            err,
          );
        }
      }
    }

    return sortFormLocaleCodes(Array.from(localeSet));
  }

  async refreshIndex(): Promise<string[]> {
    profileActivity.assertAvailable();
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = profileActivity
      .run('Refresh form languages', async () => {
        const locales = await this.scanFromStorage();
        await this.writeCache(locales);
        return locales;
      })
      .finally(() => {
        this.refreshPromise = null;
      });
    return this.refreshPromise;
  }

  /** Cached union when fresh; otherwise scan and cache. */
  async getLocales(): Promise<string[]> {
    return profileActivity.run('Read form languages', () =>
      this.getLocalesImpl(),
    );
  }

  private async getLocalesImpl(): Promise<string[]> {
    const bundleVersion = await this.readBundleVersion();
    const cached = await this.readCache();
    if (cached && cached.bundleVersion === bundleVersion) {
      return cached.locales;
    }
    return this.refreshIndex();
  }
}

export const formLocaleIndexService = FormLocaleIndexService.getInstance();
