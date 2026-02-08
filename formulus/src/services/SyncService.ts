import { synkronusApi } from '../api/synkronus';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appEvents } from '../webview/FormulusMessageHandlers';
import { SyncProgress } from '../contexts/SyncContext';
import { notificationService } from './NotificationService';
import { FormService } from './FormService';
import {
  autoLogin,
  isUnauthorizedError,
  HttpError,
} from '../api/synkronus/Auth';
type SyncStatusCallback = (status: string) => void;
type SyncProgressDetailCallback = (progress: SyncProgress) => void;

export class SyncService {
  private static instance: SyncService;
  private isSyncing: boolean = false;
  private statusCallbacks: Set<SyncStatusCallback> = new Set();
  private progressCallbacks: Set<SyncProgressDetailCallback> = new Set();
  private canCancel: boolean = false;
  private shouldCancel: boolean = false;
  private autoLoginRetryCount: number = 0; // Track auto-login retries to prevent loops

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

  public subscribeToProgressUpdates(
    callback: SyncProgressDetailCallback,
  ): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  private updateStatus(status: string): void {
    this.statusCallbacks.forEach(callback => callback(status));
  }

  private updateProgress(progress: SyncProgress): void {
    this.progressCallbacks.forEach(callback => callback(progress));
    // Note: showSyncProgress is now async, but we don't await to avoid blocking sync
    notificationService
      .showSyncProgress(progress)
      .catch(error =>
        console.warn('Failed to show sync progress notification:', error),
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

  /**
   * Wraps an API call with automatic 401 error handling and retry with auto-login.
   * If a 401 error is detected, attempts to auto-login using stored credentials,
   * then retries the operation once.
   * Prevents infinite retry loops by tracking retry attempts.
   */
  private async withAutoLoginRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'operation',
  ): Promise<T> {
    try {
      // Reset retry count on successful operation
      this.autoLoginRetryCount = 0;
      return await operation();
    } catch (error: unknown) {
      // Check if this is a 401 Unauthorized error
      if (isUnauthorizedError(error)) {
        // Prevent infinite retry loops
        if (this.autoLoginRetryCount >= 1) {
          console.error(
            'Auto-login retry limit reached. Please login manually in Settings.',
          );
          throw new Error(
            'Authentication failed after retry. Please login manually in Settings.',
          );
        }

        this.autoLoginRetryCount++;
        console.log(
          `🚨 401 Unauthorized error detected during ${operationName}, attempting auto-login...`,
        );
        this.updateStatus('Session expired, re-authenticating...');

        try {
          // Attempt auto-login
          const userInfo = await autoLogin();
          if (userInfo) {
            console.log(`Auto-login successful, retrying ${operationName}...`);
            this.updateStatus(`Retrying ${operationName}...`);
            // Clear API cache to force new token usage
            synkronusApi.clearTokenCache();
            console.log(
              `🔄 API cache cleared, retrying ${operationName} with new token...`,
            );
            // Retry the operation once (protected by retry count check above)
            try {
              const result = await operation();
              console.log(
                `✅ ${operationName} succeeded after auto-login retry`,
              );
              // Reset retry count on successful retry
              this.autoLoginRetryCount = 0;
              return result;
            } catch (retryError: unknown) {
              // If retry also fails with 401, don't retry again
              if (isUnauthorizedError(retryError)) {
                throw new Error(
                  'Authentication failed after auto-login. Please login manually in Settings.',
                );
              }
              throw retryError;
            }
          } else {
            throw new Error(
              'No stored credentials found. Please login manually in Settings.',
            );
          }
        } catch (autoLoginError: unknown) {
          const loginError = autoLoginError as HttpError;
          console.error('Auto-login failed:', loginError);
          // Reset retry count on failure
          this.autoLoginRetryCount = 0;
          throw new Error(
            `Authentication failed: ${
              loginError.message || 'Please login manually in Settings.'
            }`,
          );
        }
      }
      // If not a 401 error, re-throw the original error
      throw error;
    }
  }

  public async syncObservations(
    includeAttachments: boolean = false,
  ): Promise<number> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    this.canCancel = true;
    this.shouldCancel = false;
    this.autoLoginRetryCount = 0;
    this.updateStatus('Starting sync...');

    notificationService
      .clearAllSyncNotifications()
      .catch(error =>
        console.warn('Failed to clear stale notifications:', error),
      );

    try {
      await notificationService.startForegroundService();
      // Phase 1: Pull - Get manifest and download changes
      this.updateProgress({
        current: 0,
        total: 4,
        phase: 'pull',
        details: 'Fetching manifest...',
      });

      if (this.shouldCancel) {
        notificationService
          .showSyncCanceled()
          .catch(error =>
            console.warn('Failed to show sync canceled notification:', error),
          );
        throw new Error('Sync cancelled');
      }

      // Phase 2: Pull - Download observations
      this.updateProgress({
        current: 1,
        total: 4,
        phase: 'pull',
        details: 'Downloading observations...',
      });

      if (this.shouldCancel) {
        notificationService
          .showSyncCanceled()
          .catch(error =>
            console.warn('Failed to show sync canceled notification:', error),
          );
        throw new Error('Sync cancelled');
      }

      // Phase 3: Push - Upload local changes
      this.updateProgress({
        current: 2,
        total: 4,
        phase: 'push',
        details: 'Uploading observations...',
      });

      if (this.shouldCancel) {
        notificationService
          .showSyncCanceled()
          .catch(error =>
            console.warn('Failed to show sync canceled notification:', error),
          );
        throw new Error('Sync cancelled');
      }

      // Phase 4: Attachments (if enabled)
      if (includeAttachments) {
        this.updateProgress({
          current: 3,
          total: 4,
          phase: 'attachments_upload',
          details: 'Syncing attachments...',
        });

        if (this.shouldCancel) {
          notificationService
            .showSyncCanceled()
            .catch(error =>
              console.warn('Failed to show sync canceled notification:', error),
            );
          throw new Error('Sync cancelled');
        }
      }

      const finalVersion = await this.withAutoLoginRetry(
        () => synkronusApi.syncObservations(includeAttachments),
        'sync observations',
      );

      this.updateProgress({
        current: 4,
        total: 4,
        phase: 'push',
        details: 'Sync completed',
      });
      await AsyncStorage.setItem('@last_seen_version', finalVersion.toString());

      this.updateStatus(`Sync completed @ data version ${finalVersion}`);
      console.log(
        'Sync completed successfully, showing completion notification...',
      );

      // Don't let notification service block sync completion
      notificationService
        .showSyncComplete(true)
        .then(() => console.log('Sync completion notification shown'))
        .catch(error =>
          console.warn('Failed to show sync completion notification:', error),
        );

      console.log('Returning final version:', finalVersion);
      return finalVersion;
    } catch (error) {
      console.error('Sync failed', error);
      const errorMessage = 'Unknown error occurred';
      this.updateStatus(`Sync failed: ${errorMessage}`);

      // Don't let notification service block error handling
      notificationService
        .showSyncComplete(false, errorMessage)
        .catch(notifError =>
          console.warn('Failed to show sync failure notification:', notifError),
        );

      throw error;
    } finally {
      this.isSyncing = false;
      this.canCancel = false;
      this.shouldCancel = false;
      await notificationService.stopForegroundService();
    }
  }

  public async checkForUpdates(): Promise<boolean> {
    try {
      const manifest = await this.withAutoLoginRetry(
        () => synkronusApi.getManifest(),
        'check for updates',
      );
      const currentVersion = (await AsyncStorage.getItem('@appVersion')) || '0';
      // Only report an update when the version actually differs.
      // The "force" flag controls whether we *perform* a fresh network check,
      // not whether we force the result to "update available".
      const updateAvailable = manifest.version !== currentVersion;

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
    this.canCancel = true;
    this.shouldCancel = false;
    this.autoLoginRetryCount = 0;
    this.updateStatus('Starting app bundle sync...');
    this.updateProgress({
      current: 0,
      total: 100,
      phase: 'attachments_download',
      details: 'Preparing app bundle download...',
    });

    try {
      await notificationService.startForegroundService();

      if (this.shouldCancel) throw new Error('Sync cancelled');

      const manifest = await this.withAutoLoginRetry(
        () => synkronusApi.getManifest(),
        'get manifest',
      );

      if (this.shouldCancel) throw new Error('Sync cancelled');

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
      this.updateProgress({
        current: 100,
        total: 100,
        phase: 'attachments_download',
        details: 'App bundle sync completed',
      });

      appEvents.emit('bundleUpdated');
    } catch (error) {
      console.error('App sync failed', error);
      this.updateStatus('App sync failed');
      throw error;
    } finally {
      this.isSyncing = false;
      this.canCancel = false;
      this.shouldCancel = false;
      await notificationService.stopForegroundService();
    }
  }

  private async downloadAppBundle(): Promise<void> {
    try {
      this.updateStatus('Downloading app bundle...');
      await this.withAutoLoginRetry(
        () =>
          synkronusApi.downloadAndInstallBundleZip(progress => {
            const normalized = Math.max(0, Math.min(100, progress));
            this.updateStatus(`Downloading app bundle... ${normalized}%`);
            this.updateProgress({
              current: normalized,
              total: 100,
              phase: 'attachments_download',
              details: `Downloading app bundle... ${normalized}%`,
            });
          }),
        'download app bundle',
      );
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
    return this.isSyncing ? 'Syncing...' : 'Ready';
  }
}

export const syncService = SyncService.getInstance();
