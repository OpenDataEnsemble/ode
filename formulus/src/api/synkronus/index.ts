import {
  Configuration,
  DefaultApi,
  AppBundleManifest,
  AttachmentOperation,
  DefaultApiSyncPushRequest,
  SyncPullResponse,
  SyncPushRequest,
} from './generated';
import { Observation } from '../../database/models/Observation';
import { ObservationMapper } from '../../mappers/ObservationMapper';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getApiAuthToken,
  isForbiddenError,
  SYNC_WRITE_FORBIDDEN_MESSAGE,
} from './Auth';
import { databaseService } from '../../database/DatabaseService';
import { database } from '../../database/database';
import randomId from '@nozbe/watermelondb/utils/common/randomId';
import { clientIdService } from '../../services/ClientIdService';
import { unzip } from 'react-native-zip-archive';
import { synkronusDownload } from './download';
import { ODE_VERSION } from '../../version';
import { pendingRoot, syncedRoot } from '../../services/attachmentStorage';
import { logger } from '../../diagnostics/logger';
import {
  isRepositoryResetRequiredError,
  parseRepositoryResetFromAxios,
  RepositoryResetRequiredError,
} from '../../errors/RepositoryResetRequiredError';
import type { AxiosError, AxiosResponse } from 'axios';
import { effectiveRepositoryGenerationForRequest } from './repositoryGenerationRequest';
import { pullPageOutcome } from './pullCursor';
import { SYNC_HTTP_TIMEOUT_MS } from '../../sync/syncConstants';
import { failedDownloadCount, runWithConcurrency } from './downloadPool';
import { chunkItems } from '../../sync/chunkItems';
import {
  isCancelledError,
  isTransientError,
  withTransientRetry,
} from '../../sync/transientRetry';
import { networkProfileService } from '../../services/NetworkProfileService';
import {
  PREFETCH_AFTER_PULL_PAGE_SIZE,
  type SyncKnobs,
} from '../../sync/networkProfile';
import {
  canSplitPushBatch,
  splitFailedPushBatch,
} from '../../sync/adaptivePageSize';
import {
  formatCountProgress,
  type SynkronusSyncOptions,
  type SyncProgress,
  type SyncProgressReporter,
} from '../../sync/syncProgress';
import { i18n } from '../../i18n/instance';

const REPOSITORY_GENERATION_STORAGE_KEY = '@repository_generation';
const DEFERRED_ATTACHMENT_DOWNLOADS_STORAGE_KEY =
  '@deferred_attachment_downloads';

/** Best-effort read of x-repository-generation from Axios response headers (case varies). */
function headerRepositoryGeneration(
  headers: AxiosResponse<unknown>['headers'] | undefined,
): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const h = headers as Record<string, unknown>;
  const direct = h['x-repository-generation'] ?? h['X-Repository-Generation'];
  if (typeof direct === 'string') return direct;
  if (Array.isArray(direct) && direct[0] != null) return String(direct[0]);
  const maybeGet = (headers as { get?: (k: string) => string | undefined }).get;
  if (typeof maybeGet === 'function') {
    const v = maybeGet('x-repository-generation');
    if (v != null) return v;
  }
  return undefined;
}

function logRepositoryGenerationSync(
  message: string,
  payload?: Record<string, unknown>,
): void {
  const extras =
    payload && typeof payload.observationDataVersion === 'number'
      ? { counts: payload.observationDataVersion as number }
      : undefined;
  logger.info('sync', message, extras);
}

function logAxiosErrorForRepoGen(operation: string, error: unknown): void {
  const ax = error as AxiosError<{
    code?: string;
    message?: string;
  }>;
  const status = ax.response?.status;
  if (status == null) {
    logRepositoryGenerationSync(`${operation} failed (no HTTP response)`, {
      message: ax.message,
    });
    logger.info(
      'sync',
      `${operation} failed (no HTTP response) code=${ax.code ?? 'none'} ${ax.message ?? ''}`,
    );
    return;
  }
  logRepositoryGenerationSync(`${operation} HTTP ${status}`, {
    url: ax.config?.url,
    method: ax.config?.method,
    responseData: ax.response?.data,
    headerXRepositoryGeneration: headerRepositoryGeneration(
      ax.response?.headers,
    ),
  });
  logger.info(
    'sync',
    `${operation} HTTP ${status} code=${ax.code ?? 'none'} ${ax.message ?? ''}`,
  );
}

export type ObservationSyncResult = {
  version: number;
  pendingAttachmentDownloads: number;
  pendingAttachmentUploads: number;
};

interface DownloadResult {
  success: boolean;
  message: string;
  filePath: string;
  bytesWritten: number;
}

type DeferredAttachmentDownload = {
  attachmentId: string;
  repositoryGeneration: number | null;
};

function throwIfSyncCancelled(isCancelled?: () => boolean): void {
  if (isCancelled?.()) {
    logger.info('sync', 'cancel observed, aborting');
    throw new Error('Sync cancelled');
  }
}

function reportSyncProgress(
  reporter: SyncProgressReporter | undefined,
  progress: SyncProgress,
): void {
  reporter?.(progress);
}

class SynkronusApi {
  private api: DefaultApi | null = null;
  private config: Configuration | null = null;

  async getApi(): Promise<DefaultApi> {
    // Always check current serverUrl from storage to handle changes
    const rawSettings = await AsyncStorage.getItem('@settings');
    if (!rawSettings) throw new Error('Missing app settings');

    const { serverUrl } = JSON.parse(rawSettings);

    // If config exists but serverUrl changed, clear cache
    if (this.config && this.config.basePath !== serverUrl) {
      this.api = null;
      this.config = null;
      this.fastGetToken_cachedToken = null;
    }

    // If API exists, return it (serverUrl hasn't changed)
    if (this.api) return this.api;

    // Load config if not already loaded
    if (!this.config) {
      this.config = new Configuration({
        basePath: serverUrl,
        accessToken: async () => {
          const token = await AsyncStorage.getItem('@token');
          return token || '';
        },
        baseOptions: {
          timeout: SYNC_HTTP_TIMEOUT_MS,
        },
      });
    }

    this.api = new DefaultApi(this.config);
    return this.api;
  }

  async getConfig(): Promise<Configuration> {
    // Ensure config is loaded by calling getApi first
    await this.getApi();
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }
    return this.config;
  }

  /**
   * Returns the persisted client repository epoch, or `null` when this device
   * has never seen a generation yet (fresh install — the AsyncStorage key is
   * missing). Callers should pass `undefined` to the generated API when this is
   * `null` so the `x-repository-generation` header and body field are omitted;
   * the server then treats the call as "new client, adopt current generation"
   * rather than as a reset conflict.
   */
  private async getRepositoryGenerationForRequestOrNull(): Promise<
    number | null
  > {
    const raw = await AsyncStorage.getItem(REPOSITORY_GENERATION_STORAGE_KEY);
    const lastSeen = await AsyncStorage.getItem('@last_seen_version');
    return effectiveRepositoryGenerationForRequest(raw, lastSeen);
  }

  private async persistRepositoryGenerationFromResponse(
    gen: number | undefined,
  ): Promise<void> {
    if (gen == null || !Number.isFinite(gen)) return;
    const prev = await AsyncStorage.getItem(REPOSITORY_GENERATION_STORAGE_KEY);
    await AsyncStorage.setItem(REPOSITORY_GENERATION_STORAGE_KEY, String(gen));
    if (prev !== String(gen)) {
      logRepositoryGenerationSync('persisted server repository_generation', {
        previous: prev ?? '(missing)',
        new: gen,
      });
    }
  }

  private rethrowIfRepositoryResetConflict(error: unknown): void {
    const parsed = parseRepositoryResetFromAxios(error);
    if (parsed) {
      logRepositoryGenerationSync(
        'repository_reset_required — mapped to RepositoryResetRequiredError',
        {
          serverRepositoryGeneration: parsed.serverRepositoryGeneration,
          message: parsed.message,
        },
      );
      throw parsed;
    }
  }

  /**
   * Synkronus should return 409 when epochs mismatch; if we ever get HTTP 200 with a
   * different repository_generation than we sent, treat it as reset required and do not persist.
   *
   * When the client did not send a generation at all (fresh install, `clientGenSent === null`),
   * this check is a no-op — there is nothing to mismatch and we should simply adopt the
   * server value via {@link persistRepositoryGenerationFromResponse}.
   */
  private ensureRepoGenResponseMatchesSent(
    operation: string,
    clientGenSent: number | null,
    responseGen: number | undefined,
  ): void {
    if (clientGenSent == null) {
      return;
    }
    if (responseGen == null || !Number.isFinite(Number(responseGen))) {
      return;
    }
    const sent = Math.floor(Number(clientGenSent));
    const fromBody = Math.floor(Number(responseGen));
    if (sent === fromBody) {
      return;
    }
    logRepositoryGenerationSync(
      `${operation}: response repository_generation does not match client (defensive check)`,
      { clientGenSent: sent, responseRepositoryGeneration: fromBody },
    );
    throw new RepositoryResetRequiredError(
      'The server repository epoch no longer matches this device. Clear local data and sync again.',
      fromBody,
    );
  }

  /**
   * Remove previously downloaded app bundle files from from /forms and /app folders
   */
  async removeAppBundleFiles() {
    const removeIfExists = async (path: string) => {
      try {
        if (await RNFS.exists(path)) {
          await RNFS.unlink(path);
        }
        await RNFS.mkdir(path);
      } catch (error) {
        console.error(`Failed to remove files from ${path}: ${error}`);
      }
    };
    await removeIfExists(RNFS.DocumentDirectoryPath + '/app/');
    await removeIfExists(RNFS.DocumentDirectoryPath + '/forms/');
  }

  /**
   * Downloads form specifications from the app bundle based on the manifest
   * and saves them to a local directory.
   */
  async downloadFormSpecs(
    manifest: AppBundleManifest,
    outputRootDirectory: string,
    progressCallback?: (progressPercent: number) => void,
  ): Promise<DownloadResult[]> {
    return await this.downloadFilesByPrefix(
      manifest,
      outputRootDirectory,
      'forms/',
      progressCallback,
    );
  }

  /**
   * Downloads all app files specified in the manifest to a local directory.
   */
  async downloadAppFiles(
    manifest: AppBundleManifest,
    outputRootDirectory: string,
    progressCallback?: (progressPercent: number) => void,
  ): Promise<DownloadResult[]> {
    return await this.downloadFilesByPrefix(
      manifest,
      outputRootDirectory,
      'app/',
      progressCallback,
    );
  }

  async downloadFilesByPrefix(
    manifest: AppBundleManifest,
    outputRootDirectory: string,
    prefix: string,
    progressCallback?: (progressPercent: number) => void,
  ): Promise<DownloadResult[]> {
    const config = await this.getConfig();
    const filesToDownload = manifest.files.filter(file =>
      file.path.startsWith(prefix),
    );
    const urls = filesToDownload.map(
      file =>
        `${config.basePath}/api/app-bundle/download/${encodeURIComponent(file.path)}`,
    );
    const localFiles = filesToDownload.map(
      file => `${outputRootDirectory}/${file.path}`,
    );

    return this.downloadRawFiles(urls, localFiles, progressCallback);
  }

  /**
   * Fetches the app bundle manifest from the server.
   */
  async getManifest(): Promise<AppBundleManifest> {
    const api = await this.getApi();
    const response = await api.getAppBundleManifest({
      xOdeVersion: ODE_VERSION,
    });
    return response.data;
  }

  /**
   * Downloads the app bundle as a single zip, extracts to a temp directory,
   * then atomically swaps into place so the old bundle stays intact until
   * the new one is fully ready.
   */
  async downloadAndInstallBundleZip(
    progressCallback?: (progressPercent: number) => void,
  ): Promise<void> {
    const config = await this.getConfig();
    const authToken =
      this.fastGetToken_cachedToken ?? (await this.fastGetToken());

    const zipUrl = `${config.basePath}/api/app-bundle/download-zip`;
    const tempZipPath = `${RNFS.CachesDirectoryPath}/bundle_temp.zip`;
    const tempExtractPath = `${RNFS.CachesDirectoryPath}/bundle_staging`;
    const appDir = `${RNFS.DocumentDirectoryPath}/app`;
    const formsDir = `${RNFS.DocumentDirectoryPath}/forms`;

    // Clean up any leftover temp artifacts
    if (await RNFS.exists(tempZipPath)) await RNFS.unlink(tempZipPath);
    if (await RNFS.exists(tempExtractPath)) await RNFS.unlink(tempExtractPath);

    // Download the zip
    await withTransientRetry(
      async () => {
        const result = await synkronusDownload({
          fromUrl: zipUrl,
          toFile: tempZipPath,
          authToken,
          background: true,
          progressInterval: 500,
          progress: res => {
            if (res.contentLength > 0) {
              const percent = Math.round(
                (res.bytesWritten / res.contentLength) * 50,
              );
              progressCallback?.(percent);
            }
          },
        }).promise;
        if (result.statusCode !== 200) {
          if (await RNFS.exists(tempZipPath)) await RNFS.unlink(tempZipPath);
          throw new Error(
            `Bundle zip download failed (HTTP ${result.statusCode})`,
          );
        }
        return result;
      },
      {
        onRetry: (attempt, error, delayMs) => {
          logger.info(
            'sync',
            `bundle zip retry attempt=${attempt} delay=${delayMs}ms ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        },
      },
    );

    progressCallback?.(50);

    // Extract to staging directory
    await RNFS.mkdir(tempExtractPath);
    await unzip(tempZipPath, tempExtractPath);
    progressCallback?.(80);

    // Atomic swap: remove old dirs, move staging content into place
    if (await RNFS.exists(appDir)) await RNFS.unlink(appDir);
    if (await RNFS.exists(formsDir)) await RNFS.unlink(formsDir);

    const stagingAppDir = `${tempExtractPath}/app`;
    const stagingFormsDir = `${tempExtractPath}/forms`;

    if (await RNFS.exists(stagingAppDir))
      await RNFS.moveFile(stagingAppDir, appDir);
    if (await RNFS.exists(stagingFormsDir))
      await RNFS.moveFile(stagingFormsDir, formsDir);

    progressCallback?.(95);

    // Clean up temp files
    if (await RNFS.exists(tempZipPath)) await RNFS.unlink(tempZipPath);
    if (await RNFS.exists(tempExtractPath)) await RNFS.unlink(tempExtractPath);

    progressCallback?.(100);
  }

  private getAttachmentsDownloadManifest(
    observations: Observation[],
  ): string[] {
    const attachmentPaths: string[] = [];

    for (const observation of observations) {
      if (observation.data && typeof observation.data === 'object') {
        // Recursively search for attachment fields in the observation data
        this.extractAttachmentPaths(observation.data, attachmentPaths);
      }
    }

    return [...new Set(attachmentPaths)]; // Remove duplicates
  }

  /**
   * Process attachment manifest operations (download/delete) based on server response
   */
  private async processAttachmentManifest(
    options?: SynkronusSyncOptions,
  ): Promise<number> {
    const report = options?.onProgress;
    const isCancelled = options?.isCancelled;
    try {
      throwIfSyncCancelled(isCancelled);
      const lastAttachmentVersion =
        Number(await AsyncStorage.getItem('@last_attachment_version')) || 0;
      const clientId = await clientIdService.getClientId();

      if (!clientId) {
        console.warn('No client ID available, skipping attachment sync');
        return 0;
      }

      reportSyncProgress(report, {
        phase: 'pull_attachments',
        current: 0,
        total: 0,
        indeterminate: true,
        details: i18n.t('sync.progress.checkingAttachments'),
      });

      const api = await this.getApi();
      const manifestClientGen =
        await this.getRepositoryGenerationForRequestOrNull();
      logRepositoryGenerationSync('getAttachmentManifest request', {
        clientXRepositoryGeneration: manifestClientGen ?? '(omitted)',
        sinceVersion: lastAttachmentVersion,
      });
      const manifestResponse = await withTransientRetry(
        () =>
          api.getAttachmentManifest({
            xOdeVersion: ODE_VERSION,
            attachmentManifestRequest: {
              client_id: clientId,
              since_version: lastAttachmentVersion,
              ...(manifestClientGen != null
                ? { repository_generation: manifestClientGen }
                : {}),
            },
            xRepositoryGeneration: manifestClientGen ?? undefined,
          }),
        {
          isCancelled,
          onRetry: (attempt, error, delayMs) => {
            logger.info(
              'sync',
              `attachment manifest retry attempt=${attempt} delay=${delayMs}ms ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          },
        },
      );

      const manifest = manifestResponse.data;
      this.ensureRepoGenResponseMatchesSent(
        'getAttachmentManifest',
        manifestClientGen,
        manifest.repository_generation,
      );
      await this.persistRepositoryGenerationFromResponse(
        manifest.repository_generation,
      );

      // Handle null operations array (server returns null when no operations)
      const operations = manifest.operations || [];
      const deferredDownloads = await this.getDeferredAttachmentDownloads();
      const currentDeferredDownloads = deferredDownloads.filter(
        item => item.repositoryGeneration === manifestClientGen,
      );
      const currentDeferredIds = new Set(
        currentDeferredDownloads.map(item => item.attachmentId),
      );

      // Process operations
      const downloadOps = operations.filter(op => op.operation === 'download');
      const deleteOps = operations.filter(op => op.operation === 'delete');
      const manifestDownloadIds = new Set(
        downloadOps.map(op => op.attachment_id),
      );
      const deferredDownloadOps: AttachmentOperation[] =
        currentDeferredDownloads
          .filter(item => !manifestDownloadIds.has(item.attachmentId))
          .map(item => {
            return {
              attachment_id: item.attachmentId,
              operation: 'download',
            } as AttachmentOperation;
          });
      const effectiveDownloadOps = [...deferredDownloadOps, ...downloadOps];
      const totalSteps = deleteOps.length + effectiveDownloadOps.length;

      if (totalSteps === 0) {
        await this.removeDeferredAttachmentDownloads(
          currentDeferredDownloads.map(item => item.attachmentId),
        );
        await AsyncStorage.setItem(
          '@last_attachment_version',
          manifest.current_version.toString(),
        );
        reportSyncProgress(report, {
          phase: 'pull_attachments',
          current: 1,
          total: 1,
          details: i18n.t('sync.progress.upToDate'),
        });
        return 0;
      }

      let doneSteps = 0;
      const bumpProgress = (currentItem?: string) => {
        reportSyncProgress(report, {
          phase: 'pull_attachments',
          current: doneSteps,
          total: Math.max(totalSteps, 1),
          details: formatCountProgress(doneSteps, totalSteps),
          currentItem,
        });
      };

      bumpProgress();

      // Process deletions first
      for (const op of deleteOps) {
        throwIfSyncCancelled(isCancelled);
        await this.processAttachmentDeletions([op]);
        doneSteps += 1;
        bumpProgress(op.attachment_id);
      }

      // Process downloads
      const knobs = await networkProfileService.getSyncKnobs();
      const failedAttachmentIds = await this.processAttachmentDownloads(
        effectiveDownloadOps,
        {
          ...options,
          startDone: doneSteps,
          totalSteps,
          concurrency: knobs.attachmentConcurrency,
          onStepComplete: (attachmentId: string) => {
            doneSteps += 1;
            bumpProgress(attachmentId);
          },
        },
      );
      doneSteps = totalSteps;
      bumpProgress();

      const failedCurrentRunIds = new Set(failedAttachmentIds);
      const deferredIdsToPersist = Array.from(
        new Set([
          ...deferredDownloadOps
            .map(op => op.attachment_id)
            .filter(id => failedCurrentRunIds.has(id)),
          ...downloadOps
            .map(op => op.attachment_id)
            .filter(id => failedCurrentRunIds.has(id)),
        ]),
      );
      const retriedSuccessfullyIds = Array.from(currentDeferredIds).filter(
        id => !failedCurrentRunIds.has(id),
      );

      await this.removeDeferredAttachmentDownloads(retriedSuccessfullyIds);
      await this.replaceDeferredAttachmentDownloads(
        deferredIdsToPersist,
        manifestClientGen,
      );

      // Advance cursor even when some downloads fail so one bad file does not
      // block later manifest pages forever.
      await AsyncStorage.setItem(
        '@last_attachment_version',
        manifest.current_version.toString(),
      );

      if (failedAttachmentIds.length > 0) {
        logger.info(
          'sync',
          `attachments remaining=${failedAttachmentIds.length} cursor advanced`,
          { phase: 'pull_attachments', counts: failedAttachmentIds.length },
        );
        reportSyncProgress(report, {
          phase: 'pull_attachments',
          current: Math.max(totalSteps - failedAttachmentIds.length, 0),
          total: Math.max(totalSteps, 1),
          details: i18n.t('sync.progress.attachmentsRemaining', {
            count: failedAttachmentIds.length,
          }),
        });
        return failedAttachmentIds.length;
      }

      return 0;
    } catch (error: unknown) {
      this.rethrowIfRepositoryResetConflict(error);
      if (isRepositoryResetRequiredError(error)) {
        throw error;
      }
      if (isCancelledError(error)) {
        throw error;
      }
      logger.warn(
        'sync',
        error instanceof Error
          ? `attachment manifest failed: ${error.message}`
          : 'attachment manifest failed',
      );
      return 1;
    }
  }

  /**
   * Process attachment deletion operations
   */
  private async processAttachmentDeletions(
    deleteOps: AttachmentOperation[],
  ): Promise<void> {
    // Delete from synced/ (the canonical store). Also best-effort delete from
    // pending/ in case a file was queued for upload and then deleted upstream
    // before we drained the queue.
    const syncedDirectory = syncedRoot();
    const pendingDirectory = pendingRoot();

    for (const op of deleteOps) {
      try {
        const syncedPath = `${syncedDirectory}/${op.attachment_id}`;
        const pendingPath = `${pendingDirectory}/${op.attachment_id}`;
        if (await RNFS.exists(syncedPath)) {
          await RNFS.unlink(syncedPath);
        }
        if (await RNFS.exists(pendingPath)) {
          await RNFS.unlink(pendingPath);
        }
      } catch (error) {
        console.error(
          `Failed to delete attachment ${op.attachment_id}:`,
          error,
        );
      }
    }
  }

  /**
   * Process attachment download operations using manifest URLs
   */
  private async processAttachmentDownloads(
    downloadOps: AttachmentOperation[],
    options?: SynkronusSyncOptions & {
      startDone?: number;
      totalSteps?: number;
      concurrency?: number;
      onStepComplete?: (attachmentId: string) => void;
    },
  ): Promise<string[]> {
    const isCancelled = options?.isCancelled;
    if (downloadOps.length === 0) {
      return [];
    }
    const syncedDirectory = syncedRoot();
    await RNFS.mkdir(syncedDirectory);

    // Build URLs from the app's configured server base path. The manifest's
    // download_url is generated server-side and may point at localhost, which
    // fails on real devices.
    const config = await this.getConfig();
    const base = (config.basePath ?? '').replace(/\/$/, '');
    const urls = downloadOps.map(
      op => `${base}/api/attachments/${encodeURIComponent(op.attachment_id)}`,
    );
    const localPaths = downloadOps.map(
      op => `${syncedDirectory}/${op.attachment_id}`,
    );

    const concurrency = options?.concurrency ?? 1;
    const started = Date.now();
    const results = await this.downloadRawFiles(urls, localPaths, undefined, {
      overwrite: false,
      isCancelled,
      concurrency,
      onFileComplete: (index: number) => {
        options?.onStepComplete?.(downloadOps[index].attachment_id);
      },
    });

    const failed = failedDownloadCount(results);
    logger.info(
      'sync',
      `attachments download=${Date.now() - started}ms files=${downloadOps.length} concurrency=${concurrency} failed=${failed}`,
      { phase: 'pull_attachments', counts: downloadOps.length },
    );

    const failedAttachmentIds: string[] = [];
    results.forEach((result, index) => {
      const op = downloadOps[index];
      if (!result.success) {
        failedAttachmentIds.push(op.attachment_id);
        logger.warn(
          'sync',
          `Failed to download attachment ${op.attachment_id}: ${result.message}`,
        );
      }
    });

    return failedAttachmentIds;
  }

  private async getDeferredAttachmentDownloads(): Promise<
    DeferredAttachmentDownload[]
  > {
    try {
      const raw = await AsyncStorage.getItem(
        DEFERRED_ATTACHMENT_DOWNLOADS_STORAGE_KEY,
      );
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item): item is DeferredAttachmentDownload =>
          item != null &&
          typeof item === 'object' &&
          typeof item.attachmentId === 'string' &&
          ('repositoryGeneration' in item
            ? item.repositoryGeneration === null ||
              typeof item.repositoryGeneration === 'number'
            : false),
      );
    } catch {
      return [];
    }
  }

  private async setDeferredAttachmentDownloads(
    items: DeferredAttachmentDownload[],
  ): Promise<void> {
    if (items.length === 0) {
      await AsyncStorage.removeItem(DEFERRED_ATTACHMENT_DOWNLOADS_STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(
      DEFERRED_ATTACHMENT_DOWNLOADS_STORAGE_KEY,
      JSON.stringify(items),
    );
  }

  private async removeDeferredAttachmentDownloads(
    attachmentIds: string[],
  ): Promise<void> {
    if (attachmentIds.length === 0) return;
    const removeSet = new Set(attachmentIds);
    const next = (await this.getDeferredAttachmentDownloads()).filter(
      item => !removeSet.has(item.attachmentId),
    );
    await this.setDeferredAttachmentDownloads(next);
  }

  private async replaceDeferredAttachmentDownloads(
    attachmentIds: string[],
    repositoryGeneration: number | null,
  ): Promise<void> {
    const keep = (await this.getDeferredAttachmentDownloads()).filter(
      item => !attachmentIds.includes(item.attachmentId),
    );
    const next = [
      ...keep,
      ...attachmentIds.map(attachmentId => ({
        attachmentId,
        repositoryGeneration,
      })),
    ];
    await this.setDeferredAttachmentDownloads(next);
  }

  private async getAttachmentsUploadManifest(): Promise<string[]> {
    // Scan the pending/ folder (v2 layout) for files to upload.
    const pendingDirectory = pendingRoot();

    try {
      await RNFS.mkdir(pendingDirectory);

      const files = await RNFS.readDir(pendingDirectory);
      const attachmentIds = files
        .filter(file => file.isFile())
        .map(file => file.name)
        .filter(filename => this.isAttachmentPath(filename));

      return attachmentIds;
    } catch (error) {
      console.error('Failed to read pending attachments directory:', error);
      return [];
    }
  }

  private extractAttachmentPaths(
    data: unknown,
    attachmentPaths: string[],
  ): void {
    if (!data || typeof data !== 'object') return;

    for (const value of Object.values(data)) {
      if (typeof value === 'string') {
        // Check if this looks like an attachment path (GUID-style filename)
        // Based on PhotoQuestionRenderer pattern: GUID-style filenames
        if (this.isAttachmentPath(value)) {
          attachmentPaths.push(value);
        }
      } else if (Array.isArray(value)) {
        // Handle arrays of attachments
        for (const item of value) {
          if (typeof item === 'string' && this.isAttachmentPath(item)) {
            attachmentPaths.push(item);
          } else if (typeof item === 'object') {
            this.extractAttachmentPaths(item, attachmentPaths);
          }
        }
      } else if (typeof value === 'object') {
        // Recursively search nested objects
        this.extractAttachmentPaths(value, attachmentPaths);
      }
    }
  }

  private isAttachmentPath(value: string): boolean {
    // Check if the string looks like a GUID-style filename or attachment path
    // GUID pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const guidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Check for GUID with common image extensions
    const guidWithExtension =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|gif|bmp|webp|pdf|doc|docx)$/i;

    return guidPattern.test(value) || guidWithExtension.test(value);
  }

  private fastGetToken_cachedToken: string | null = null;
  private async fastGetToken(): Promise<string> {
    // Hint: Use like this to avoid unnecessary promise creation:
    // const authToken = this.fastGetToken_cachedToken ?? await this.fastGetToken();
    if (this.fastGetToken_cachedToken) {
      return this.fastGetToken_cachedToken;
    }
    const authToken = await getApiAuthToken();
    if (authToken) {
      this.fastGetToken_cachedToken = authToken;
      return authToken;
    }
    throw new Error('Unable to retrieve auth token');
  }

  public clearTokenCache(): void {
    this.fastGetToken_cachedToken = null;
    // Clear API instance to force recreation with new token after auto-login
    this.api = null;
    this.config = null;
  }

  private async downloadRawFiles(
    urls: string[],
    localFilePaths: string[],
    progressCallback?: (progressPercent: number) => void,
    options?: {
      overwrite?: boolean;
      isCancelled?: () => boolean;
      onFileStart?: (index: number) => void;
      onFileComplete?: (index: number) => void;
      concurrency?: number;
    },
  ): Promise<DownloadResult[]> {
    if (urls.length !== localFilePaths.length) {
      throw new Error(
        'URLs and local file paths arrays must have the same length',
      );
    }
    const totalFiles = urls.length;
    const concurrency = options?.concurrency ?? 1;
    const activeJobIds = new Set<number>();
    let completed = 0;
    const stopActiveDownloads = () => {
      for (const jobId of activeJobIds) {
        try {
          RNFS.stopDownload(jobId);
        } catch {
          // Native cancel is best-effort.
        }
      }
      activeJobIds.clear();
    };
    const singleFileCallback = (
      currentIndex: number,
      progress: RNFS.DownloadProgressCallbackResult,
    ) => {
      const fileProgress = progress.bytesWritten / progress.contentLength;
      const overallProgress =
        ((currentIndex + fileProgress) / totalFiles) * 100;

      progressCallback?.(Math.round(overallProgress));
    };

    return runWithConcurrency(
      urls,
      concurrency,
      async (url, i) => {
        const localFilePath = localFilePaths[i];
        options?.onFileStart?.(i);
        try {
          const result = await withTransientRetry(
            () =>
              this.downloadRawFile(
                url,
                localFilePath,
                concurrency === 1
                  ? (progress: RNFS.DownloadProgressCallbackResult) =>
                      singleFileCallback(i, progress)
                  : undefined,
                {
                  overwrite: options?.overwrite,
                  isCancelled: options?.isCancelled,
                  onJobStart: jobId => {
                    activeJobIds.add(jobId);
                  },
                  onJobEnd: jobId => {
                    activeJobIds.delete(jobId);
                  },
                },
              ),
            {
              isCancelled: options?.isCancelled,
              onRetry: (attempt, error, delayMs) => {
                logger.info(
                  'sync',
                  `file download retry attempt=${attempt} delay=${delayMs}ms ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                );
              },
            },
          );
          return result;
        } catch (error) {
          if (isCancelledError(error)) {
            throw error;
          }
          console.error(`Failed to download file ${localFilePath}: ${error}`);
          return {
            success: false,
            message: `Failed to download file ${localFilePath}: ${error}`,
            filePath: localFilePath,
            bytesWritten: 0,
          };
        } finally {
          completed += 1;
          options?.onFileComplete?.(i);
          if (concurrency > 1) {
            progressCallback?.(Math.round((completed / totalFiles) * 100));
          } else {
            progressCallback?.(Math.round((i / totalFiles) * 100));
          }
        }
      },
      {
        isCancelled: options?.isCancelled,
        onCancelInFlight: stopActiveDownloads,
      },
    );
  }
  private async downloadRawFile(
    url: string,
    localFilePath: string,
    progressCallback?: (
      progressPercent: RNFS.DownloadProgressCallbackResult,
    ) => void,
    options?: {
      overwrite?: boolean;
      isCancelled?: () => boolean;
      onJobStart?: (jobId: number) => void;
      onJobEnd?: (jobId: number) => void;
    },
  ): Promise<DownloadResult> {
    throwIfSyncCancelled(options?.isCancelled);

    if (await RNFS.exists(localFilePath)) {
      if (!options?.overwrite) {
        try {
          const st = await RNFS.stat(localFilePath);
          if (Number(st.size) > 0) {
            return {
              success: true,
              message: `File ${localFilePath} already exists, skipping download.`,
              filePath: localFilePath,
              bytesWritten: Number(st.size) || 0,
            };
          }
        } catch {
          // Fall through and re-fetch.
        }
      }
      try {
        await RNFS.unlink(localFilePath);
      } catch (err) {
        console.warn(
          `downloadRawFile: failed to unlink stale local file ${localFilePath}`,
          err,
        );
      }
    }
    {
      const parentDir = localFilePath.substring(
        0,
        localFilePath.lastIndexOf('/'),
      );
      if (!(await RNFS.exists(parentDir))) {
        await RNFS.mkdir(parentDir);
      }
    }

    const tempPath = `${localFilePath}.download`;
    if (await RNFS.exists(tempPath)) {
      try {
        await RNFS.unlink(tempPath);
      } catch {
        // Best-effort.
      }
    }

    throwIfSyncCancelled(options?.isCancelled);

    const authToken =
      this.fastGetToken_cachedToken ?? (await this.fastGetToken());

    const watchCancel = Boolean(options?.isCancelled);
    const download = synkronusDownload({
      fromUrl: url,
      toFile: tempPath,
      authToken,
      background: true,
      progressInterval: 500,
      // Check cancel every 500ms even when the caller does not want byte progress.
      progressDivider: progressCallback || watchCancel ? 1 : 100,
      progress: progress => {
        if (options?.isCancelled?.()) {
          try {
            RNFS.stopDownload(progress.jobId);
          } catch {
            // Native cancel is best-effort.
          }
        }
        if (progressCallback) {
          progressCallback(progress);
        }
      },
    });
    options?.onJobStart?.(download.jobId);
    let result: RNFS.DownloadResult;
    try {
      result = await download.promise;
    } catch (error) {
      if (await RNFS.exists(tempPath)) {
        try {
          await RNFS.unlink(tempPath);
        } catch {
          // Best-effort.
        }
      }
      throw error;
    } finally {
      options?.onJobEnd?.(download.jobId);
    }

    if (result.statusCode !== 200) {
      if (await RNFS.exists(tempPath)) {
        try {
          await RNFS.unlink(tempPath);
        } catch {
          // Best-effort.
        }
      }
      throw new Error(
        `Failed to download file from ${url}: ${result.statusCode}`,
      );
    }

    try {
      await RNFS.moveFile(tempPath, localFilePath);
    } catch (error) {
      if (await RNFS.exists(tempPath)) {
        try {
          await RNFS.unlink(tempPath);
        } catch {
          // Best-effort.
        }
      }
      throw error;
    }

    return {
      success: true,
      message: `Successfully downloaded and saved (binary): ${localFilePath} (${result.bytesWritten} bytes)`,
      filePath: localFilePath,
      bytesWritten: result.bytesWritten,
    };
  }

  private async uploadAttachments(
    attachments: string[],
    options?: SynkronusSyncOptions,
  ): Promise<DownloadResult[]> {
    const report = options?.onProgress;
    const isCancelled = options?.isCancelled;
    const total = attachments.length;
    if (attachments.length === 0) {
      return [];
    }
    logger.info('sync', `uploading ${total} attachments`, { counts: total });

    const pendingDirectory = pendingRoot();
    const syncedDirectory = syncedRoot();
    const api = await this.getApi();
    const results: DownloadResult[] = [];

    await RNFS.mkdir(syncedDirectory);
    await RNFS.mkdir(pendingDirectory);

    let done = 0;
    for (const attachmentId of attachments) {
      throwIfSyncCancelled(isCancelled);
      reportSyncProgress(report, {
        phase: 'push_attachments',
        current: done,
        total: Math.max(total, 1),
        details: formatCountProgress(done, total),
        currentItem: attachmentId,
      });

      const pendingFilePath = `${pendingDirectory}/${attachmentId}`;
      const syncedFilePath = `${syncedDirectory}/${attachmentId}`;

      try {
        const fileExists = await RNFS.exists(pendingFilePath);
        if (!fileExists) {
          console.warn(
            `Attachment file not found in pending directory: ${pendingFilePath}`,
          );
          results.push({
            success: false,
            message: `File not found: ${pendingFilePath}`,
            filePath: pendingFilePath,
            bytesWritten: 0,
          });
          continue;
        }

        const fileStats = await RNFS.stat(pendingFilePath);

        // Idempotency: HEAD /api/attachments/{id} first. If the server already
        // has this attachment (200), treat as uploaded — this handles the
        // crash-before-unlink case where a previous run uploaded the bytes but
        // never cleaned up `pending/`.
        let alreadyOnServer = false;
        try {
          const head = await api.checkAttachmentExists({
            attachmentId,
            xOdeVersion: ODE_VERSION,
          });
          alreadyOnServer = head.status >= 200 && head.status < 300;
        } catch (err: unknown) {
          // 404 (or any non-2xx) just means we need to upload. Repository
          // reset conflicts must still bubble up, though.
          this.rethrowIfRepositoryResetConflict(err);
        }

        if (!alreadyOnServer) {
          const mimeType = this.getMimeTypeFromFilename(attachmentId);
          const file = {
            uri: `file://${pendingFilePath}`,
            type: mimeType,
            name: attachmentId,
          } as unknown as File;

          await withTransientRetry(
            async () => {
              const pushGen =
                (await this.getRepositoryGenerationForRequestOrNull()) ??
                undefined;
              return api.uploadAttachment({
                attachmentId,
                file,
                xOdeVersion: ODE_VERSION,
                xRepositoryGeneration: pushGen,
              });
            },
            {
              isCancelled,
              onRetry: (attempt, error, delayMs) => {
                logger.info(
                  'sync',
                  `attachment upload retry attempt=${attempt} delay=${delayMs}ms id=${attachmentId} ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                );
              },
            },
          );
        }

        // Remove file from pending/ directory (upload complete).
        // File already exists in synced/ from `commitDraftAttachmentsAfterSave`.
        await RNFS.unlink(pendingFilePath);

        results.push({
          success: true,
          message: alreadyOnServer
            ? `Attachment already on server: ${attachmentId}`
            : `Successfully uploaded attachment: ${attachmentId}`,
          filePath: syncedFilePath,
          bytesWritten: fileStats.size,
        });
      } catch (error: unknown) {
        this.rethrowIfRepositoryResetConflict(error);
        console.error(`Failed to upload attachment ${attachmentId}:`, error);
        results.push({
          success: false,
          message: `Upload failed: ${error}`,
          filePath: pendingFilePath,
          bytesWritten: 0,
        });
      }
      done += 1;
      reportSyncProgress(report, {
        phase: 'push_attachments',
        current: done,
        total: Math.max(total, 1),
        details: formatCountProgress(done, total),
        currentItem: attachmentId,
      });
    }

    return results;
  }

  private getMimeTypeFromFilename(filename: string): string {
    const extension = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      bmp: 'image/bmp',
      webp: 'image/webp',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  /**
   * Get the count of unsynced attachments pending upload
   */
  async getUnsyncedAttachmentCount(): Promise<number> {
    const attachments = await this.getAttachmentsUploadManifest();
    return attachments.length;
  }

  /**
   * Check whether an attachment is available locally (in `synced/`) and/or
   * still queued for upload (in `pending/`).
   */
  async attachmentExists(
    attachmentId: string,
  ): Promise<{ available: boolean; pendingUpload: boolean }> {
    const syncedPath = `${syncedRoot()}/${attachmentId}`;
    const pendingPath = `${pendingRoot()}/${attachmentId}`;

    const [available, pendingUpload] = await Promise.all([
      RNFS.exists(syncedPath),
      RNFS.exists(pendingPath),
    ]);

    return { available, pendingUpload };
  }

  /**
   * Pull observations from the server.
   * This method can be used to update the local database with the latest observations from the server.
   * It is also the first step in a full synchronization process.
   *
   * @returns {Promise<number>} The current version of the observations pulled from the server
   */
  private async pullObservations(
    includeAttachments: boolean = false,
    options?: SynkronusSyncOptions,
  ) {
    const report = options?.onProgress;
    const isCancelled = options?.isCancelled;
    const clientId = await clientIdService.getClientId();
    let since = Number(await AsyncStorage.getItem('@last_seen_version'));
    if (!since) since = 0;

    const repo = databaseService.getLocalRepo();
    const api = await this.getApi();
    const knobs: SyncKnobs = await networkProfileService.getSyncKnobs();
    let pullPageSize = knobs.pullPageSize;
    logger.info(
      'sync',
      `pull knobs pageSize=${pullPageSize} prefetchAfter=${PREFETCH_AFTER_PULL_PAGE_SIZE}`,
      { phase: 'pull_observations' },
    );
    const schemaTypes = undefined; // TODO: Feature: Maybe allow partial sync
    let res: AxiosResponse<SyncPullResponse> | undefined;
    let currentSince = since;
    let totalServerRecordsThisPull = 0;
    let pullPage = 0;
    let hasMorePages = true;
    let finalVersion = since;

    const fetchPullPage = async (sinceVersion: number) => {
      for (;;) {
        throwIfSyncCancelled(isCancelled);
        const clientGen = await this.getRepositoryGenerationForRequestOrNull();
        const fetchStarted = Date.now();
        const limit = pullPageSize;
        try {
          const response = await withTransientRetry(
            () =>
              api.syncPull({
                xOdeVersion: ODE_VERSION,
                limit,
                syncPullRequest: {
                  client_id: clientId,
                  ...(clientGen != null
                    ? { repository_generation: clientGen }
                    : {}),
                  since: {
                    version: sinceVersion,
                  },
                  schema_types: schemaTypes,
                },
                xRepositoryGeneration: clientGen ?? undefined,
              }),
            {
              isCancelled,
              onRetry: (attempt, error, delayMs) => {
                logger.info(
                  'sync',
                  `pull retry attempt=${attempt} delay=${delayMs}ms pageSize=${limit} ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                );
              },
            },
          );
          const fetchMs = Date.now() - fetchStarted;
          logger.info(
            'sync',
            `pull fetch=${fetchMs}ms records=${
              response.data.records?.length ?? 0
            } pageSize=${limit}`,
            {
              phase: 'fetch',
              counts: response.data.records?.length ?? 0,
            },
          );
          pullPageSize =
            await networkProfileService.recordPullPageDuration(fetchMs);
          return { response, clientGen };
        } catch (err: unknown) {
          logAxiosErrorForRepoGen('syncPull', err);
          this.rethrowIfRepositoryResetConflict(err);
          if (isCancelledError(err) || isRepositoryResetRequiredError(err)) {
            throw err;
          }
          if (isTransientError(err) && pullPageSize > 1) {
            const next =
              await networkProfileService.shrinkPullPageAfterFailure(
                pullPageSize,
              );
            logger.info(
              'sync',
              `pull shrink after failure size=${limit} → ${next}`,
              { phase: 'fetch', counts: next },
            );
            pullPageSize = next;
            continue;
          }
          throw err;
        }
      }
    };

    // Next HTTP page, started after we know has_more so it overlaps apply+index.
    // Discarded if apply fails (cursor is not advanced). Never apply two pages
    // at once — SQLite is a single writer.
    let pendingPage: ReturnType<typeof fetchPullPage> | null = null;

    reportSyncProgress(report, {
      phase: 'pull_observations',
      current: 0,
      total: 0,
      indeterminate: true,
      details: i18n.t('sync.progress.connecting'),
    });

    do {
      throwIfSyncCancelled(isCancelled);
      pullPage += 1;
      const waitStarted = Date.now();
      const fetched = await (pendingPage ?? fetchPullPage(currentSince));
      const waitMs = Date.now() - waitStarted;
      pendingPage = null;
      const clientGen = fetched.clientGen;
      res = fetched.response;

      this.ensureRepoGenResponseMatchesSent(
        'syncPull',
        clientGen,
        res.data.repository_generation,
      );
      await this.persistRepositoryGenerationFromResponse(
        res.data.repository_generation,
      );

      const mapStarted = Date.now();
      const domainObservations = res.data.records
        ? res.data.records.map(ObservationMapper.fromApi)
        : [];
      const mapMs = Date.now() - mapStarted;

      totalServerRecordsThisPull += domainObservations.length;

      // One line for the whole page: count when HTTP arrives, then leave it
      // up through apply/index. Toggling "Saving…" made the count unreadable.
      reportSyncProgress(report, {
        phase: 'pull_observations',
        current: pullPage,
        total: 0,
        indeterminate: true,
        details:
          totalServerRecordsThisPull > 0
            ? i18n.t('sync.progress.recordsDownloaded', {
                count: totalServerRecordsThisPull,
              })
            : res.data.has_more
              ? i18n.t('sync.progress.downloadingPage', { page: pullPage })
              : i18n.t('sync.progress.downloading'),
      });

      // Cursor math depends only on the response. Start the next fetch before
      // apply so the RTT is hidden behind SQLite work. Persist the cursor
      // only after apply succeeds (see pullCursor.ts).
      const pageOutcome = pullPageOutcome(res.data, currentSince);
      if (pageOutcome.kind === 'unusable') {
        throw new Error(
          `Sync pull stopped after page ${pullPage}: ${pageOutcome.reason}`,
        );
      }
      if (
        pageOutcome.kind === 'continue' &&
        pullPageSize >= PREFETCH_AFTER_PULL_PAGE_SIZE
      ) {
        pendingPage = fetchPullPage(pageOutcome.nextSince);
      }

      // Apply + incremental index. Stay on pull_observations — flipping to
      // index_rebuild made the card blink "Preparing data for search" on
      // every page. That title is for the full rebuild after a bundle change.
      const applyStarted = Date.now();
      await repo.applyServerChanges(domainObservations, {
        isCancelled,
      });
      logger.info(
        'sync',
        `pull page=${pullPage} records=${domainObservations.length} wait=${waitMs}ms map=${mapMs}ms apply=${Date.now() - applyStarted}ms`,
        { phase: 'page', counts: domainObservations.length },
      );

      hasMorePages = pageOutcome.kind === 'continue';
      const cursor =
        pageOutcome.kind === 'continue'
          ? pageOutcome.nextSince
          : pageOutcome.version;
      if (pageOutcome.kind === 'continue') {
        currentSince = cursor;
      } else {
        finalVersion = cursor;
      }

      await AsyncStorage.setItem('@last_seen_version', String(cursor));
    } while (hasMorePages);

    logRepositoryGenerationSync('syncPull all pages done', {
      totalServerRecordsReceived: totalServerRecordsThisPull,
      finalBodyCurrentVersion: res?.data.current_version,
      finalBodyRepositoryGeneration: res?.data.repository_generation,
      persistedObservationCursor: finalVersion,
    });

    if (totalServerRecordsThisPull === 0) {
      const localObservationRows = await database
        .get('observations')
        .query()
        .fetchCount();
      if (localObservationRows > 0) {
        console.warn(
          '[RepositoryGeneration] Pull returned 0 observation records across all pages, but the local DB still has',
          localObservationRows,
          'row(s). An empty pull does not delete local rows (applyServerChanges is a no-op when there are no server records). This is normal if you only have offline/unsynced drafts. If the server was reset and repository_generation already matches the client, stale synced rows can remain until you use the repository-reset flow (Erase and sync) or clear local data.',
        );
      }
    }

    // The observation cursor is already persisted (per page, above). Attachments
    // carry their own cursor, so a failure here no longer forces a full
    // re-pull of every observation on the next attempt.
    let pendingAttachmentDownloads = 0;
    if (includeAttachments) {
      pendingAttachmentDownloads =
        await this.processAttachmentManifest(options);
    }

    reportSyncProgress(report, {
      phase: 'pull_observations',
      current: 1,
      total: 1,
      details:
        totalServerRecordsThisPull > 0
          ? i18n.t('sync.progress.recordsSummary', {
              count: totalServerRecordsThisPull,
            })
          : i18n.t('sync.progress.upToDate'),
    });

    return { version: finalVersion, pendingAttachmentDownloads };
  }

  /**
   * Push observations to the server. This method should only be called immediately after pullObservations
   * @param includeAttachments Whether to upload attachments associated with the observations
   * @returns The current version of the data (if no records are pushed, the last seen version is returned)
   */
  async pushObservations(
    includeAttachments: boolean = false,
    options?: SynkronusSyncOptions,
  ): Promise<{ version: number; pendingAttachmentUploads: number }> {
    const report = options?.onProgress;
    const isCancelled = options?.isCancelled;
    const api = await this.getApi();
    const knobs = await networkProfileService.getSyncKnobs();

    try {
      throwIfSyncCancelled(isCancelled);
      // 1. Get pending changes from watermelondb
      const repo = databaseService.getLocalRepo();
      const localChanges = await repo.getPendingChanges();

      // 2. Upload attachments first (if requested and available)
      let attachmentUploadResults: DownloadResult[] = [];
      if (includeAttachments) {
        const attachments = await this.getAttachmentsUploadManifest();

        if (attachments.length > 0) {
          attachmentUploadResults = await this.uploadAttachments(
            attachments,
            options,
          );

          const failedUploads = attachmentUploadResults.filter(
            result => !result.success,
          );
          if (failedUploads.length > 0) {
            logger.warn(
              'sync',
              `${failedUploads.length} attachment uploads failed; continuing observation push`,
              { counts: failedUploads.length },
            );
          }
        }
      }

      const pendingAttachmentUploads = attachmentUploadResults.filter(
        result => !result.success,
      ).length;

      throwIfSyncCancelled(isCancelled);

      // 3. Check if we have observations to push
      if (localChanges.length === 0) {
        reportSyncProgress(report, {
          phase: 'push_observations',
          current: 1,
          total: 1,
          details: i18n.t('sync.progress.nothingToUpload'),
        });
        const skipGen = await this.getRepositoryGenerationForRequestOrNull();
        const lastSeen =
          (await AsyncStorage.getItem('@last_seen_version')) ?? '(missing)';
        logRepositoryGenerationSync(
          'syncPush skipped (no local observation rows to push)',
          {
            effectiveClientGen: skipGen ?? '(omitted)',
            lastSeenVersion: lastSeen,
          },
        );

        return {
          version:
            Number(await AsyncStorage.getItem('@last_seen_version')) || 0,
          pendingAttachmentUploads,
        };
      }

      let pushBatchSize = knobs.pushBatchSize;
      const queue = chunkItems(localChanges, pushBatchSize);
      logger.info(
        'sync',
        `push knobs batchSize=${pushBatchSize} batches=${queue.length} records=${localChanges.length}`,
        { phase: 'push_observations', counts: localChanges.length },
      );

      let lastVersion =
        Number(await AsyncStorage.getItem('@last_seen_version')) || 0;
      const clientId = await clientIdService.getClientId();
      let pushedSoFar = 0;

      while (queue.length > 0) {
        throwIfSyncCancelled(isCancelled);
        const batch = queue.shift()!;
        const transmissionId = randomId();
        const pushClientGen =
          await this.getRepositoryGenerationForRequestOrNull();
        const syncPushRequest: SyncPushRequest = {
          client_id: clientId,
          records: batch.map(ObservationMapper.toApi),
          transmission_id: transmissionId,
          ...(pushClientGen != null
            ? { repository_generation: pushClientGen }
            : {}),
        };

        const request: DefaultApiSyncPushRequest = {
          xOdeVersion: ODE_VERSION,
          syncPushRequest,
          xRepositoryGeneration: pushClientGen ?? undefined,
        };

        logRepositoryGenerationSync('syncPush request', {
          clientXRepositoryGeneration: pushClientGen ?? '(omitted)',
          observationCount: batch.length,
        });

        reportSyncProgress(report, {
          phase: 'push_observations',
          current: pushedSoFar,
          total: localChanges.length,
          details: i18n.t('sync.progress.uploadingObservations', {
            count: localChanges.length,
          }),
        });

        try {
          const pushStarted = Date.now();
          const res = await withTransientRetry(() => api.syncPush(request), {
            isCancelled,
            onRetry: (attempt, error, delayMs) => {
              logger.info(
                'sync',
                `push retry attempt=${attempt} delay=${delayMs}ms size=${batch.length} tx=${transmissionId} ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
            },
          });
          const pushMs = Date.now() - pushStarted;

          logRepositoryGenerationSync('syncPush response OK', {
            clientSent: pushClientGen ?? '(omitted)',
            bodyRepositoryGeneration: res.data.repository_generation,
            bodyCurrentVersion: res.data.current_version,
            headerXRepositoryGeneration: headerRepositoryGeneration(
              (res as AxiosResponse<unknown>).headers,
            ),
          });

          this.ensureRepoGenResponseMatchesSent(
            'syncPush',
            pushClientGen,
            res.data.repository_generation,
          );
          await this.persistRepositoryGenerationFromResponse(
            res.data.repository_generation,
          );

          await repo.markObservationsAsSynced(
            batch.map(record => record.observationId),
          );

          lastVersion = res.data.current_version;
          await AsyncStorage.setItem(
            '@last_seen_version',
            lastVersion.toString(),
          );
          pushedSoFar += batch.length;
          pushBatchSize =
            await networkProfileService.recordPushBatchDuration(pushMs);
          logger.info(
            'sync',
            `push batch ok size=${batch.length} duration=${pushMs}ms nextSize=${pushBatchSize}`,
            { phase: 'push_observations', counts: batch.length },
          );
        } catch (error: unknown) {
          this.rethrowIfRepositoryResetConflict(error);
          if (
            isCancelledError(error) ||
            isRepositoryResetRequiredError(error)
          ) {
            throw error;
          }
          if (isTransientError(error) && canSplitPushBatch(batch.length)) {
            const { nextSize, pieces } = splitFailedPushBatch(batch);
            await networkProfileService.shrinkPushBatchAfterFailure(
              batch.length,
            );
            pushBatchSize = nextSize;
            logger.info(
              'sync',
              `push split failed size=${batch.length} → ${nextSize} pieces=${pieces.length}`,
              { phase: 'push_observations', counts: nextSize },
            );
            queue.unshift(...pieces);
            continue;
          }
          throw error;
        }
      }

      if (includeAttachments && attachmentUploadResults.length > 0) {
        const successfulUploads = attachmentUploadResults.filter(
          result => result.success,
        ).length;
        logger.info('sync', `uploaded ${successfulUploads} attachments`, {
          counts: successfulUploads,
        });
      }

      reportSyncProgress(report, {
        phase: 'push_observations',
        current: 1,
        total: 1,
        details: i18n.t('sync.progress.uploadComplete'),
      });

      return { version: lastVersion, pendingAttachmentUploads };
    } catch (error: unknown) {
      logAxiosErrorForRepoGen('syncPush', error);
      this.rethrowIfRepositoryResetConflict(error);
      if (isRepositoryResetRequiredError(error)) {
        throw error;
      }
      console.error('Failed to push observations:', error);
      if (isForbiddenError(error)) {
        throw new Error(SYNC_WRITE_FORBIDDEN_MESSAGE);
      }
      throw new Error(`Push failed: ${error}`);
    }
  }

  /**
   * Syncs Observations with the server using the pull/push functionality
   */
  async syncObservations(
    includeAttachments: boolean = false,
    options?: SynkronusSyncOptions,
  ): Promise<ObservationSyncResult> {
    const rawStored = await AsyncStorage.getItem(
      REPOSITORY_GENERATION_STORAGE_KEY,
    );
    const effectiveGen = await this.getRepositoryGenerationForRequestOrNull();
    logRepositoryGenerationSync('syncObservations start', {
      storageRaw: rawStored ?? '(missing)',
      effectiveClientGen: effectiveGen ?? '(omitted)',
      includeAttachments,
    });
    const pulled = await this.pullObservations(includeAttachments, options);
    throwIfSyncCancelled(options?.isCancelled);
    const pushed = await this.pushObservations(includeAttachments, options);
    const storageAfter = await AsyncStorage.getItem(
      REPOSITORY_GENERATION_STORAGE_KEY,
    );
    logRepositoryGenerationSync('syncObservations finished', {
      observationDataVersion: pushed.version,
      storageRepositoryGeneration: storageAfter ?? '(missing)',
    });
    return {
      version: pushed.version,
      pendingAttachmentDownloads: pulled.pendingAttachmentDownloads,
      pendingAttachmentUploads: pushed.pendingAttachmentUploads,
    };
  }
}

// Export a singleton instance
export const synkronusApi = new SynkronusApi();
