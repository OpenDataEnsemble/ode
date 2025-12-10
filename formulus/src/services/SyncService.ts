import { synkronusApi } from '../api/synkronus';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncProgress } from '../contexts/SyncContext';
import { notificationService } from './NotificationService';
import { FormService } from './FormService';
import { appVersionService } from './AppVersionService';

type SyncProgressCallback = (progress: number) => void;
type SyncStatusCallback = (status: string) => void;
type SyncProgressDetailCallback = (progress: SyncProgress) => void;

export class SyncService {
  private static instance: SyncService;
  private isSyncing: boolean = false;
  private statusCallbacks: Set<SyncStatusCallback> = new Set();
  private progressCallbacks: Set<SyncProgressDetailCallback> = new Set();
  private canCancel: boolean = false;
  private shouldCancel: boolean = false;

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

  public subscribeToProgressUpdates(callback: SyncProgressDetailCallback): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  private updateStatus(status: string): void {
    this.statusCallbacks.forEach(callback => callback(status));
  }

  private updateProgress(progress: SyncProgress): void {
    this.progressCallbacks.forEach(callback => callback(progress));
    // Note: showSyncProgress is now async, but we don't await to avoid blocking sync
    notificationService.showSyncProgress(progress).catch(error => 
      console.warn('Failed to show sync progress notification:', error)
    );
  }

  public cancelSync(): void {
    if (this.canCancel) {
      this.shouldCancel = true;
      this.updateStatus('Cancelling sync...');
    }
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  public getCanCancel(): boolean {
    return this.canCancel;
  }

  public async syncObservations(includeAttachments: boolean = false): Promise<number> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    this.canCancel = true;
    this.shouldCancel = false;
    this.updateStatus('Starting sync...');

    // Clear any stale notifications before starting new sync
    notificationService.clearAllSyncNotifications().catch(error => 
      console.warn('Failed to clear stale notifications:', error)
    );

    try {
      // Phase 1: Pull - Get manifest and download changes
      this.updateProgress({
        current: 0,
        total: 4,
        phase: 'pull',
        details: 'Fetching manifest...'
      });

      if (this.shouldCancel) {
        notificationService.showSyncCanceled().catch(error => 
          console.warn('Failed to show sync canceled notification:', error)
        );
        throw new Error('Sync cancelled');
      }

      // Phase 2: Pull - Download observations
      this.updateProgress({
        current: 1,
        total: 4,
        phase: 'pull',
        details: 'Downloading observations...'
      });

      if (this.shouldCancel) {
        notificationService.showSyncCanceled().catch(error => 
          console.warn('Failed to show sync canceled notification:', error)
        );
        throw new Error('Sync cancelled');
      }

      // Phase 3: Push - Upload local changes
      this.updateProgress({
        current: 2,
        total: 4,
        phase: 'push',
        details: 'Uploading observations...'
      });

      if (this.shouldCancel) {
        notificationService.showSyncCanceled().catch(error => 
          console.warn('Failed to show sync canceled notification:', error)
        );
        throw new Error('Sync cancelled');
      }

      // Phase 4: Attachments (if enabled)
      if (includeAttachments) {
        this.updateProgress({
          current: 3,
          total: 4,
          phase: 'attachments_upload',
          details: 'Syncing attachments...'
        });

        if (this.shouldCancel) {
          notificationService.showSyncCanceled().catch(error => 
            console.warn('Failed to show sync canceled notification:', error)
          );
          throw new Error('Sync cancelled');
        }
      }

      const finalVersion = await synkronusApi.syncObservations(includeAttachments);
      
      this.updateProgress({
        current: 4,
        total: 4,
        phase: 'push',
        details: 'Sync completed'
      });
      await AsyncStorage.setItem('@last_seen_version', finalVersion.toString());
      
      this.updateStatus(`Sync completed @ data version ${finalVersion}`);
      await notificationService.showSyncComplete(true);
      
      return finalVersion;
    } catch (error: any) {
      console.error('Sync failed', error);
      const errorMessage = error.message || 'Unknown error occurred';
      this.updateStatus(`Sync failed: ${errorMessage}`);
      await notificationService.showSyncComplete(false, errorMessage);
      throw error;
    } finally {
      this.isSyncing = false;
      this.canCancel = false;
      this.shouldCancel = false;
      // Note: Don't call hideSyncProgress() here as showSyncComplete() already handles notification cleanup
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
      // Get manifest to know what version we're downloading
      const manifest = await synkronusApi.getManifest();
      
      await this.downloadAppBundle();
      
      // Save the version after successful download
      await AsyncStorage.setItem('@appVersion', manifest.version);
      
      // Invalidate FormService cache to reload new form specs
      this.updateStatus('Refreshing form specifications...');
      const formService = await FormService.getInstance();
      await formService.invalidateCache();
      
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
      this.updateStatus('Fetching manifest...');
      const manifest = await synkronusApi.getManifest();
  
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
    const lastSeenVersion = await AsyncStorage.getItem('@last_seen_version');
    
    const existingAppVersion = await AsyncStorage.getItem('@appVersion');
    if (!existingAppVersion) {
      await AsyncStorage.setItem('@appVersion', '0');
    }
    
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
