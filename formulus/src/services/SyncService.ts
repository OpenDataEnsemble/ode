import { synkronusApi } from '../api/synkronus';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SyncProgressCallback = (progress: number) => void;
type SyncStatusCallback = (status: string) => void;

export class SyncService {
  private static instance: SyncService;
  private isSyncing: boolean = false;
  private statusCallbacks: Set<SyncStatusCallback> = new Set();

  private constructor() {}

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  public subscribeToStatusUpdates(callback: SyncStatusCallback): () => void {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  private updateStatus(status: string): void {
    this.statusCallbacks.forEach(callback => callback(status));
  }

  public async syncObservations(includeAttachments: boolean = false): Promise<number> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    this.updateStatus('Starting sync...');

    try {
      const version = await synkronusApi.syncObservations(includeAttachments);
      await AsyncStorage.setItem('@last_seen_version', version.toString());
      this.updateStatus(`Sync completed @ data version ${version}`);
      return version;
    } catch (error) {
      console.error('Sync failed', error);
      this.updateStatus('Sync failed');
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  public async checkForUpdates(force: boolean = false): Promise<boolean> {
    try {
      const manifest = await synkronusApi.getManifest();
      const currentVersion = await AsyncStorage.getItem('@appVersion') || '0';
      const updateAvailable = force || manifest.version !== currentVersion;
      
      if (updateAvailable) {
        this.updateStatus(`${this.getStatus()} (Update available)`);
      }
      
      return updateAvailable;
    } catch (error) {
      console.warn('Failed to check for updates', error);
      return false;
    }
  }

  public async updateAppBundle(): Promise<void> {
    if (this.isSyncing) {
      throw new Error('Update already in progress');
    }

    this.isSyncing = true;
    this.updateStatus('Starting app bundle sync...');

    try {
      await this.downloadAppBundle();
      const syncTime = new Date().toLocaleTimeString();
      await AsyncStorage.setItem('@lastSync', syncTime);
      this.updateStatus('App bundle sync completed');
    } catch (error) {
      console.error('App sync failed', error);
      this.updateStatus('App sync failed');
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  private async downloadAppBundle(): Promise<void> {
    try {
      // Get the manifest
      this.updateStatus('Fetching manifest...');
      const manifest = await synkronusApi.getManifest();
      console.log('Manifest:', manifest);
  
      // Clean out the existing app bundle
      await synkronusApi.removeAppBundleFiles();

      // Download form specs
      this.updateStatus('Downloading form specs...');
      const formResults = await synkronusApi.downloadFormSpecs(
        manifest, 
        RNFS.DocumentDirectoryPath, 
        (progress) => this.updateStatus(`Downloading form specs... ${progress}%`)
      );
      
      // Download app files
      this.updateStatus('Downloading app files...');
      const appResults = await synkronusApi.downloadAppFiles(
        manifest, 
        RNFS.DocumentDirectoryPath, 
        (progress) => this.updateStatus(`Downloading app files... ${progress}%`)
      );

      const results = [...formResults, ...appResults];
      console.debug('Download results:', results);
      
      if (results.some(r => !r.success)) {
        const errorMessages = results
          .filter(r => !r.success)
          .map(r => r.message)
          .join('\n');
        throw new Error(`Failed to download some files:\n${errorMessages}`);
      }
    } catch (error) {
      console.error('Download failed', error);
      throw error;
    }
  }

  public async initialize(): Promise<void> {
    // Initialize any required state
    await AsyncStorage.setItem('@clientId', 'android-123'); // TODO: Move to app initialization
    const lastSeenVersion = await AsyncStorage.getItem('@last_seen_version');
    await AsyncStorage.setItem('@appVersion', '1.0.0'); // TODO: Get from app config
    
    if (lastSeenVersion) {
      this.updateStatus(`Last sync: v${lastSeenVersion}`);
    } else {
      this.updateStatus('Ready');
    }
  }

  public getStatus(): string {
    return this.isSyncing ? 
      'Syncing...' : 
      'Ready';
  }
}

export const syncService = SyncService.getInstance();
