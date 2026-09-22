import 'react-native-url-polyfill/auto';
import type { ComponentType } from 'react';
import { initFormulusI18n } from '../i18n';
import { profileRegistry } from './ProfileRegistry';

let bootstrap: Promise<ComponentType> | null = null;

/** No import of App, its contexts, or database services may precede this gate. */
export function bootstrapProfileApp(): Promise<ComponentType> {
  if (!bootstrap) {
    bootstrap = (async () => {
      await initFormulusI18n();
      await profileRegistry.initialize();
      const { initializeProfileDatabase } = await import('../database/database');
      await initializeProfileDatabase();
      const { default: App } = await import('../../App');
      return App;
    })();
  }
  return bootstrap;
}
