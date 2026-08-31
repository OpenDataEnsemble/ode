import { synkronusApi } from '../api/synkronus';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appEvents } from '../webview/FormulusMessageHandlers';
import {
  formatCountProgress,
  type SyncProgress,
  type SynkronusSyncOptions,
} from '../sync/syncProgress';
import {
  notificationService,
  type SyncNotificationOutcome,
} from './NotificationService';
import { getUserFacingAppBundleUpdateErrorMessage } from './appBundleUpdateErrors';
import { FormService } from './FormService';
import { formLocaleIndexService } from './FormLocaleIndexService';
import ObservationIndexService from './ObservationIndexService';
import {
  autoLogin,
  getUserFacingSyncErrorMessage,
  isUnauthorizedError,
  isVersionMismatchError,
  HttpError,
} from '../api/synkronus/Auth';
import { isRepositoryResetRequiredError } from '../errors/RepositoryResetRequiredError';
import {
  appBundleVersionsDifferNumerically,
  isNumericAppBundleVersionString,
  normalizeAppBundleVersion,
} from '../utils/appBundleVersion';
import { i18n } from '../i18n/instance';
import { logger } from '../diagnostics/logger';
import { isCancelledError } from '../sync/transientRetry';

type SyncStatusCallback = (status: string) => void;
type SyncProgressDetailCallback = (progress: SyncProgress) => void;

type SyncOutcome =
  | { kind: 'success'; finalVersion: number }
  | {
      kind: 'partial_success';
      finalVersion: number;
      pendingAttachments: number;
    }
  | { kind: 'cancelled' }
  | { kind: 'failed'; errorMessage: string };

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
        logger.warn(
          'sync',
          error instanceof Error
            ? error.message
            : 'Failed to show sync progress notification',
        ),
      );
  }

  public cancelSync(): void {
    if (this.canCancel) {
      this.shouldCancel = true;
      logger.info('sync', 'cancel requested');
      this.updateStatus(i18n.t('sync.progress.cancelling'));
    }
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  public getCanCancel(): boolean {
    return this.canCancel;
  }

  /**
   * Test-safe reset hook for singleton state and subscription cleanup.
   * Keeps production behavior unchanged while preventing cross-test leakage.
   */
  public clearAllSubscriptions(): void {
    this.statusCallbacks.clear();
    this.progressCallbacks.clear();
    this.isSyncing = false;
    this.canCancel = false;
    this.shouldCancel = false;
    this.autoLoginRetryCount = 0;
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
      // Version mismatch: do not retry, surface clear message
      if (isVersionMismatchError(error)) {
        // Re-throw the VersionMismatchError as-is (it already has the message)
        throw error;
      }
      if (isRepositoryResetRequiredError(error)) {
        throw error;
      }
      // Check if this is a 401 Unauthorized error
      if (isUnauthorizedError(error)) {
        // Prevent infinite retry loops
        if (this.autoLoginRetryCount >= 1) {
          logger.error(
            'sync',
            'Auto-login retry limit reached. Please login manually in Settings.',
          );
          throw new Error(
            'Authentication failed after retry. Please login manually in Settings.',
          );
        }

        this.autoLoginRetryCount++;
        logger.info(
          'sync',
          `401 during ${operationName}, attempting auto-login`,
        );
        this.updateStatus('Session expired, re-authenticating...');

        try {
          // Attempt auto-login
          const userInfo = await autoLogin();
          if (userInfo) {
            logger.info('sync', `auto-login ok, retrying ${operationName}`);
            this.updateStatus(`Retrying ${operationName}...`);
            // Clear API cache to force new token usage
            synkronusApi.clearTokenCache();
            // Retry the operation once (protected by retry count check above)
            try {
              const result = await operation();
              logger.info(
                'sync',
                `${operationName} succeeded after auto-login retry`,
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
          logger.error('sync', loginError?.message || 'Auto-login failed');
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
        logger.warn(
          'sync',
          error instanceof Error
            ? error.message
            : 'Failed to clear stale notifications',
        ),
      );

    try {
      await logger.breadcrumb('sync', 'start');
      await notificationService.startForegroundService();

      const syncOptions: SynkronusSyncOptions = {
        onProgress: progress => this.updateProgress(progress),
        isCancelled: () => this.shouldCancel,
      };

      this.updateProgress({
        current: 0,
        total: 0,
        phase: 'pull_observations',
        indeterminate: true,
        details: i18n.t('sync.progress.starting'),
      });

      const result = await this.withAutoLoginRetry(
        () => synkronusApi.syncObservations(includeAttachments, syncOptions),
        'sync observations',
      );
      const finalVersion = result.version;
      const pendingAttachments =
        result.pendingAttachmentDownloads + result.pendingAttachmentUploads;

      const repoGenStorage =
        (await AsyncStorage.getItem('@repository_generation')) ?? '(missing)';
      logger.info(
        'sync',
        `observations sync done @ ${finalVersion} gen=${repoGenStorage} pendingAttachments=${pendingAttachments}`,
      );

      this.updateProgress({
        current: 1,
        total: 1,
        phase: 'push_observations',
        details:
          pendingAttachments > 0
            ? i18n.t('sync.progress.attachmentsRemaining', {
                count: pendingAttachments,
              })
            : i18n.t('sync.progress.complete'),
      });
      await AsyncStorage.setItem('@last_seen_version', finalVersion.toString());

      const outcome: SyncOutcome =
        pendingAttachments > 0
          ? {
              kind: 'partial_success',
              finalVersion,
              pendingAttachments,
            }
          : { kind: 'success', finalVersion };

      this.applySyncOutcome(outcome);
      await logger.breadcrumb('sync', 'end', {
        success: pendingAttachments === 0,
        counts: pendingAttachments,
      });
      logger.info('sync', `completed @ data version ${finalVersion}`);

      return finalVersion;
    } catch (error) {
      if (isCancelledError(error)) {
        logger.info('sync', 'cancel observed, aborting');
        this.applySyncOutcome({ kind: 'cancelled' });
        throw error;
      }
      logger.error(
        'sync',
        error instanceof Error ? error.message : 'Sync failed',
      );
      const errorMessage = getUserFacingSyncErrorMessage(error);
      this.applySyncOutcome({ kind: 'failed', errorMessage });
      throw error;
    } finally {
      this.isSyncing = false;
      this.canCancel = false;
      this.shouldCancel = false;
      await notificationService.stopForegroundService();
    }
  }

  private applySyncOutcome(outcome: SyncOutcome): void {
    let status: string;
    let notificationOutcome: SyncNotificationOutcome;

    switch (outcome.kind) {
      case 'success':
        status = `Sync completed @ data version ${outcome.finalVersion}`;
        notificationOutcome = { kind: 'success' };
        break;
      case 'partial_success':
        status = i18n.t('sync.completedWithPendingAttachments', {
          count: outcome.pendingAttachments,
        });
        notificationOutcome = {
          kind: 'partial_success',
          pendingAttachments: outcome.pendingAttachments,
        };
        break;
      case 'cancelled':
        status = i18n.t('sync.notification.cancelledTitle');
        notificationOutcome = { kind: 'cancelled' };
        break;
      case 'failed':
        status = `Sync failed: ${outcome.errorMessage}`;
        notificationOutcome = {
          kind: 'failed',
          error: outcome.errorMessage,
        };
        break;
    }

    this.updateStatus(status);
    notificationService
      .showSyncComplete(notificationOutcome)
      .catch(error =>
        logger.warn(
          'sync',
          error instanceof Error
            ? error.message
            : 'Failed to show sync outcome notification',
        ),
      );
  }

  /**
   * Loads local and server app bundle versions in one manifest request.
   */
  public async getAppBundleStatus(): Promise<{
    localVersion: string;
    serverVersion: string;
    updateAvailable: boolean;
  } | null> {
    try {
      const manifest = await this.withAutoLoginRetry(
        () => synkronusApi.getManifest(),
        'check for updates',
      );
      logger.info(
        'sync',
        `app bundle check local vs server version ${String(manifest.version)}`,
      );

      const serverVersion = normalizeAppBundleVersion(manifest.version);
      if (!isNumericAppBundleVersionString(serverVersion)) {
        logger.warn(
          'sync',
          `manifest.version is not numeric: ${String(manifest.version)}`,
        );
        return null;
      }

      const localVersion = normalizeAppBundleVersion(
        await AsyncStorage.getItem('@appVersion'),
      );
      if (!isNumericAppBundleVersionString(localVersion)) {
        return {
          localVersion: 'Unknown',
          serverVersion,
          updateAvailable: false,
        };
      }

      const updateAvailable = appBundleVersionsDifferNumerically(
        localVersion,
        serverVersion,
      );

      if (updateAvailable) {
        this.updateStatus(`${this.getStatus()} (Update available)`);
      }

      return { localVersion, serverVersion, updateAvailable };
    } catch (error) {
      logger.warn(
        'sync',
        error instanceof Error ? error.message : 'Failed to check for updates',
      );
      return null;
    }
  }

  public async checkForUpdates(): Promise<boolean> {
    const status = await this.getAppBundleStatus();
    return status?.updateAvailable ?? false;
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
      phase: 'app_bundle',
      details: i18n.t('sync.progress.preparingDownload'),
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
      await AsyncStorage.setItem(
        '@appVersion',
        normalizeAppBundleVersion(manifest.version),
      );

      // Invalidate FormService cache to reload new form specs
      this.updateStatus('Refreshing form specifications...');
      const formService = await FormService.getInstance();
      await formService.invalidateCache();

      await formLocaleIndexService.refreshIndex();

      // The bundle is the only way new index definitions arrive. Await the
      // rebuild here rather than firing it from `bundleUpdated`: that event
      // used to start a fire-and-forget rebuild, so sync reported "complete"
      // while the index was still being written, and a crash left rows built
      // from the previous bundle with no record that they were stale.
      this.updateStatus(i18n.t('sync.progress.phase.index_rebuild'));
      this.updateProgress({
        current: 0,
        total: 0,
        phase: 'index_rebuild',
        indeterminate: true,
      });
      await logger.breadcrumb('index', 'rebuild_start');
      await ObservationIndexService.getInstance().rebuildForBundleUpdate(
        ({ current, total }) => {
          this.updateProgress({
            current,
            total,
            phase: 'index_rebuild',
            details: formatCountProgress(current, total),
          });
        },
      );
      await logger.breadcrumb('index', 'rebuild_done');

      const syncTime = new Date().toLocaleTimeString();
      await AsyncStorage.setItem('@lastSync', syncTime);
      this.updateStatus('App bundle sync completed');
      this.updateProgress({
        current: 100,
        total: 100,
        phase: 'app_bundle',
        details: i18n.t('sync.progress.complete'),
      });

      appEvents.emit('bundleUpdated');
    } catch (error) {
      logger.error(
        'sync',
        error instanceof Error ? error.message : 'App sync failed',
      );
      const message = await getUserFacingAppBundleUpdateErrorMessage(error);
      this.updateStatus(message);
      if (error instanceof Error && message === error.message) {
        throw error;
      }
      throw new Error(message);
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
              phase: 'app_bundle',
            });
          }),
        'download app bundle',
      );
    } catch (error) {
      logger.error(
        'sync',
        error instanceof Error ? error.message : 'Download failed',
      );
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
