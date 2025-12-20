import {Configuration, DefaultApi, AppBundleManifest} from './generated';
import {Observation} from '../../database/models/Observation';
import {ObservationMapper} from '../../mappers/ObservationMapper';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getApiAuthToken} from './Auth';
import {databaseService} from '../../database/DatabaseService';
import randomId from '@nozbe/watermelondb/utils/common/randomId';
import {clientIdService} from '../../services/ClientIdService';

interface DownloadResult {
  success: boolean;
  message: string;
  filePath: string;
  bytesWritten: number;
}

class SynkronusApi {
  private api: DefaultApi | null = null;
  private config: Configuration | null = null;

  async getApi(): Promise<DefaultApi> {
    if (this.api) return this.api;

    // Load settings if not already loaded
    if (!this.config) {
      const rawSettings = await AsyncStorage.getItem('@settings');
      if (!rawSettings) throw new Error('Missing app settings');

      const {serverUrl} = JSON.parse(rawSettings);
      this.config = new Configuration({
        basePath: serverUrl,
        accessToken: async () => {
          const token = await AsyncStorage.getItem('@token');
          return token || '';
        },
      });
    }

    this.api = new DefaultApi(this.config);
    return this.api;
  }

  /**
   * Remove previously downloaded app bundle files from from /forms and /app folders
   */
  async removeAppBundleFiles() {
    const removeIfExists = async (path: string) => {
      try {
        if (await RNFS.exists(path)) {
          console.debug(`Removing files from ${path}`);
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
    console.debug(
      `Downloading files with prefix "${prefix}" to: ${outputRootDirectory}`,
    );

    const api = await this.getApi();
    const filesToDownload = manifest.files.filter(file =>
      file.path.startsWith(prefix),
    );
    const urls = filesToDownload.map(
      file =>
        `${api.basePath}/app-bundle/download/${encodeURIComponent(file.path)}`,
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
    const response = await api.getAppBundleManifest();
    return response.data;
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
  private async processAttachmentManifest(): Promise<void> {
    try {
      const lastAttachmentVersion =
        Number(await AsyncStorage.getItem('@last_attachment_version')) || 0;
      const clientId = await clientIdService.getClientId();

      if (!clientId) {
        console.warn('No client ID available, skipping attachment sync');
        return;
      }

      console.debug(
        `Getting attachment manifest since version ${lastAttachmentVersion}`,
      );

      const api = await this.getApi();
      const manifestResponse = await api.getAttachmentManifest({
        attachmentManifestRequest: {
          client_id: clientId,
          since_version: lastAttachmentVersion,
        },
      });

      const manifest = manifestResponse.data;

      // Handle null operations array (server returns null when no operations)
      const operations = manifest.operations || [];
      console.debug(
        `Received attachment manifest: ${operations.length} operations at version ${manifest.current_version}`,
      );

      if (operations.length === 0) {
        console.debug('No attachment operations to perform');
        await AsyncStorage.setItem(
          '@last_attachment_version',
          manifest.current_version.toString(),
        );
        return;
      }

      // Process operations
      const downloadOps = operations.filter(
        (op: any) => op.operation === 'download',
      );
      const deleteOps = operations.filter(
        (op: any) => op.operation === 'delete',
      );

      console.debug(
        `Processing ${downloadOps.length} downloads, ${deleteOps.length} deletions`,
      );

      // Process deletions first
      await this.processAttachmentDeletions(deleteOps);

      // Process downloads
      await this.processAttachmentDownloads(downloadOps);

      // Update last processed version
      await AsyncStorage.setItem(
        '@last_attachment_version',
        manifest.current_version.toString(),
      );
      console.debug(
        `Attachment sync completed at version ${manifest.current_version}`,
      );
    } catch (error: any) {
      console.error('Failed to process attachment manifest:', error);
      throw error; // Let the error bubble up so we can fix the root cause
    }
  }

  /**
   * Process attachment deletion operations
   */
  private async processAttachmentDeletions(deleteOps: any[]): Promise<void> {
    const attachmentsDirectory = `${RNFS.DocumentDirectoryPath}/attachments`;

    for (const op of deleteOps) {
      try {
        const filePath = `${attachmentsDirectory}/${op.attachment_id}`;
        const exists = await RNFS.exists(filePath);

        if (exists) {
          await RNFS.unlink(filePath);
          console.debug(`Deleted attachment: ${op.attachment_id}`);
        } else {
          console.debug(`Attachment already deleted: ${op.attachment_id}`);
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
  private async processAttachmentDownloads(downloadOps: any[]): Promise<void> {
    const attachmentsDirectory = `${RNFS.DocumentDirectoryPath}/attachments`;
    await RNFS.mkdir(attachmentsDirectory);

    const urls = downloadOps.map(op => op.download_url);
    const localPaths = downloadOps.map(
      op => `${attachmentsDirectory}/${op.attachment_id}`,
    );

    const results = await this.downloadRawFiles(urls, localPaths);

    results.forEach((result, index) => {
      const op = downloadOps[index];
      if (result.success) {
        console.debug(
          `Downloaded attachment: ${op.attachment_id} (${result.bytesWritten} bytes)`,
        );
      } else {
        console.error(
          `Failed to download attachment ${op.attachment_id}: ${result.message}`,
        );
      }
    });
  }

  private async getAttachmentsUploadManifest(): Promise<string[]> {
    // Simple approach: scan the pending_upload folder for files to upload
    const pendingUploadDirectory = `${RNFS.DocumentDirectoryPath}/attachments/pending_upload`;

    try {
      // Ensure directory exists
      await RNFS.mkdir(pendingUploadDirectory);

      // Get all files in pending_upload directory
      const files = await RNFS.readDir(pendingUploadDirectory);
      const attachmentIds = files
        .filter(file => file.isFile())
        .map(file => file.name)
        .filter(filename => this.isAttachmentPath(filename));

      return attachmentIds;
    } catch (error) {
      console.error(
        'Failed to read pending_upload attachments directory:',
        error,
      );
      return [];
    }
  }

  private extractAttachmentPaths(data: any, attachmentPaths: string[]): void {
    if (!data || typeof data !== 'object') return;

    for (const [_key, value] of Object.entries(data)) {
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

  private async downloadRawFiles(
    urls: string[],
    localFilePaths: string[],
    progressCallback?: (progressPercent: number) => void,
  ): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];
    if (urls.length !== localFilePaths.length) {
      throw new Error(
        'URLs and local file paths arrays must have the same length',
      );
    }
    const totalFiles = urls.length;
    console.debug('URLS:', urls);
    console.debug('Local file paths:', localFilePaths);
    const singleFileCallback = (
      currentIndex: number,
      progress: RNFS.DownloadProgressCallbackResult,
    ) => {
      const fileProgress = progress.bytesWritten / progress.contentLength;
      const overallProgress =
        ((currentIndex + fileProgress) / totalFiles) * 100;

      console.debug(
        `Downloading file: ${urls[currentIndex]} ${Math.round(
          fileProgress * 100,
        )}%`,
      );
      progressCallback?.(Math.round(overallProgress));
    };

    for (let i = 0; i < totalFiles; i++) {
      const url = urls[i];
      const localFilePath = localFilePaths[i];
      try {
        console.debug(`Downloading file: ${url}`);
        const result = await this.downloadRawFile(
          url,
          localFilePath,
          (progress: RNFS.DownloadProgressCallbackResult) =>
            singleFileCallback(i, progress),
        );
        console.debug(
          `Downloaded file: ${localFilePath} (size: ${result.bytesWritten})`,
        );
        results.push(result);
      } catch (error) {
        console.error(`Failed to download file ${localFilePath}: ${error}`);
        results.push({
          success: false,
          message: `Failed to download file ${localFilePath}: ${error}`,
          filePath: localFilePath,
          bytesWritten: 0,
        });
      }
      const progressPercent = Math.round((i / totalFiles) * 100);
      progressCallback?.(progressPercent);
    }
    console.debug('Files downloaded');
    return results;
  }
  private async downloadRawFile(
    url: string,
    localFilePath: string,
    progressCallback?: (
      progressPercent: RNFS.DownloadProgressCallbackResult,
    ) => void,
  ): Promise<DownloadResult> {
    if (await RNFS.exists(localFilePath)) {
      return {
        success: true,
        message: `File ${localFilePath} already exists, skipping download.`,
        filePath: localFilePath,
        bytesWritten: 0,
      };
    } else {
      // Ensure parent folder exists
      const parentDir = localFilePath.substring(
        0,
        localFilePath.lastIndexOf('/'),
      );
      if (!(await RNFS.exists(parentDir))) {
        await RNFS.mkdir(parentDir);
      }
    }
    const authToken =
      this.fastGetToken_cachedToken ?? (await this.fastGetToken());
    const downloadHeaders: {[key: string]: string} = {};
    downloadHeaders.Authorization = `Bearer ${authToken}`;

    console.debug(`Downloading from: ${url}`);
    const result = await RNFS.downloadFile({
      fromUrl: url,
      toFile: localFilePath,
      headers: downloadHeaders,
      background: true,
      progressInterval: 500, // fire at most every 500ms if progressCallback is provided
      progressDivider: progressCallback ? 1 : 100, // fire at most on every percentage change if progressCallback is provided
      progress: progress => {
        if (progressCallback) {
          progressCallback(progress);
        }
      },
    }).promise;

    if (result.statusCode !== 200) {
      console.error(
        `Failed to download file from ${url}: ${result.statusCode}`,
      );
      return {
        success: false,
        message: `Failed to download file from ${url}: ${result.statusCode}`,
        filePath: localFilePath,
        bytesWritten: 0,
      };
    }

    console.debug(
      `Successfully downloaded and saved (binary): ${localFilePath} (${result.bytesWritten} bytes)`,
    );
    return {
      success: true,
      message: `Successfully downloaded and saved (binary): ${localFilePath} (${result.bytesWritten} bytes)`,
      filePath: localFilePath,
      bytesWritten: result.bytesWritten,
    };
  }

  private async downloadAttachments(attachments: string[]) {
    if (attachments.length === 0) {
      console.debug('No attachments to download');
      return [];
    }

    console.debug('Starting attachments download...', attachments);
    const downloadDirectory = `${RNFS.DocumentDirectoryPath}/attachments`;
    await RNFS.mkdir(downloadDirectory);

    const api = await this.getApi();
    const urls = attachments.map(
      attachment =>
        `${api.basePath}/attachments/${encodeURIComponent(attachment)}`,
    );
    const localFilePaths = attachments.map(
      attachment => `${downloadDirectory}/${attachment}`,
    );

    const results = await this.downloadRawFiles(urls, localFilePaths);
    console.debug('Attachments downloaded', results);
    return results;
  }

  private async uploadAttachments(
    attachments: string[],
  ): Promise<DownloadResult[]> {
    if (attachments.length === 0) {
      console.debug('No attachments to upload');
      return [];
    }

    console.debug('Starting attachments upload...', attachments);
    const pendingUploadDirectory = `${RNFS.DocumentDirectoryPath}/attachments/pending_upload`;
    const attachmentsDirectory = `${RNFS.DocumentDirectoryPath}/attachments`;
    const api = await this.getApi();
    const results: DownloadResult[] = [];

    // Ensure directories exist
    await RNFS.mkdir(attachmentsDirectory);

    for (const attachmentId of attachments) {
      const pendingFilePath = `${pendingUploadDirectory}/${attachmentId}`;
      const mainFilePath = `${attachmentsDirectory}/${attachmentId}`;

      try {
        // Check if file exists in pending_upload directory
        const fileExists = await RNFS.exists(pendingFilePath);
        if (!fileExists) {
          console.warn(
            `Attachment file not found in pending_upload directory: ${pendingFilePath}`,
          );
          results.push({
            success: false,
            message: `File not found: ${pendingFilePath}`,
            filePath: pendingFilePath,
            bytesWritten: 0,
          });
          continue;
        }

        // TODO: Check if attachment already exists on server
        // This functionality needs to be implemented when the correct API method is available
        console.debug(`Uploading attachment ${attachmentId}`);

        // Get file stats for logging
        const fileStats = await RNFS.stat(pendingFilePath);

        // Determine MIME type based on file extension
        const mimeType = this.getMimeTypeFromFilename(attachmentId);

        // For React Native, create a file object with the file URI
        const file = {
          uri: `file://${pendingFilePath}`,
          type: mimeType,
          name: attachmentId,
        } as any; // Cast to any to satisfy TypeScript

        // Upload the file
        console.debug(
          `Uploading attachment: ${attachmentId} (${fileStats.size} bytes)`,
        );
        await api.uploadAttachment({attachmentId, file});

        // Remove file from pending_upload directory (upload complete)
        // Note: File already exists in main attachments directory from when it was first saved
        await RNFS.unlink(pendingFilePath);

        results.push({
          success: true,
          message: `Successfully uploaded attachment: ${attachmentId}`,
          filePath: mainFilePath,
          bytesWritten: fileStats.size,
        });

        console.debug(`Successfully uploaded attachment: ${attachmentId}`);
      } catch (error: any) {
        console.error(`Failed to upload attachment ${attachmentId}:`, error);
        results.push({
          success: false,
          message: `Upload failed: ${error.message}`,
          filePath: pendingFilePath,
          bytesWritten: 0,
        });
      }
    }

    console.debug('Attachments upload completed', results);
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
   * Save a new attachment for immediate use and queue it for upload
   * This should be called when a new attachment is created (e.g., from camera)
   * The file is saved to both the main attachments folder (for immediate use in forms)
   * and the unsynced folder (as an upload queue)
   */
  async saveNewAttachment(
    attachmentId: string,
    fileData: string,
    isBase64: boolean = true,
  ): Promise<string> {
    const attachmentsDirectory = `${RNFS.DocumentDirectoryPath}/attachments`;
    const pendingUploadDirectory = `${RNFS.DocumentDirectoryPath}/attachments/pending_upload`;

    // Ensure both directories exist
    await RNFS.mkdir(attachmentsDirectory);
    await RNFS.mkdir(pendingUploadDirectory);

    const mainFilePath = `${attachmentsDirectory}/${attachmentId}`;
    const pendingFilePath = `${pendingUploadDirectory}/${attachmentId}`;
    const encoding = isBase64 ? 'base64' : 'utf8';

    // Save to both locations
    await Promise.all([
      RNFS.writeFile(mainFilePath, fileData, encoding),
      RNFS.writeFile(pendingFilePath, fileData, encoding),
    ]);

    console.debug(
      `Saved new attachment: ${attachmentId} (available immediately, queued for upload)`,
    );

    // Return the path that should be stored in observation data
    return mainFilePath;
  }

  /**
   * Get the count of unsynced attachments pending upload
   */
  async getUnsyncedAttachmentCount(): Promise<number> {
    const attachments = await this.getAttachmentsUploadManifest();
    return attachments.length;
  }

  /**
   * Check if a specific attachment exists in the main attachments folder and/or upload queue
   */
  async attachmentExists(
    attachmentId: string,
  ): Promise<{available: boolean; pendingUpload: boolean}> {
    const mainPath = `${RNFS.DocumentDirectoryPath}/attachments/${attachmentId}`;
    const pendingUploadPath = `${RNFS.DocumentDirectoryPath}/attachments/pending_upload/${attachmentId}`;

    const [available, pendingUpload] = await Promise.all([
      RNFS.exists(mainPath),
      RNFS.exists(pendingUploadPath),
    ]);

    return {available, pendingUpload};
  }

  /**
   * Pull observations from the server.
   * This method can be used to update the local database with the latest observations from the server.
   * It is also the first step in a full synchronization process.
   *
   * @returns {Promise<number>} The current version of the observations pulled from the server
   */
  private async pullObservations(includeAttachments: boolean = false) {
    const clientId = await clientIdService.getClientId();
    let since = Number(await AsyncStorage.getItem('@last_seen_version'));
    if (!since) since = 0;

    const repo = databaseService.getLocalRepo();
    const api = await this.getApi();
    const schemaTypes = undefined; // TODO: Feature: Maybe allow partial sync
    let res;
    let currentSince = since;

    do {
      res = await api.syncPull({
        syncPullRequest: {
          client_id: clientId,
          since: {
            version: currentSince,
          },
          schema_types: schemaTypes,
        },
      });

      console.debug('Pull response: ', res.data);

      // 1. Pull and map changes from the API
      const domainObservations = res.data.records
        ? res.data.records.map(ObservationMapper.fromApi)
        : [];

      // 2. Apply to local db (local dirty records will not be applied = last update wins)
      const pulledChanges = await repo.applyServerChanges(domainObservations); // ingest observations into WatermelonDB
      console.debug(`Applied ${pulledChanges} changes to local database`);

      if (includeAttachments) {
        // Process attachment manifest for incremental sync
        await this.processAttachmentManifest();
      }

      console.debug('Pulled observations: ', domainObservations);

      // Update since version for next iteration using change_cutoff
      if (res.data.has_more && res.data.change_cutoff) {
        currentSince = res.data.change_cutoff;
        console.debug(`Continuing pagination from version ${currentSince}`);
      }
    } while (res.data.has_more);

    // Only when all observations are pulled and ingested by WatermelonDB, update the last seen version
    await AsyncStorage.setItem(
      '@last_seen_version',
      res.data.current_version.toString(),
    );
    return res.data.current_version;
  }

  /**
   * Push observations to the server. This method should only be called immediately after pullObservations
   * @param includeAttachments Whether to upload attachments associated with the observations
   * @returns The current version of the data (if no records are pushed, the last seen version is returned)
   */
  async pushObservations(includeAttachments: boolean = false): Promise<number> {
    const api = await this.getApi();
    const transmissionId = randomId();

    try {
      // 1. Get pending changes from watermelondb
      const repo = databaseService.getLocalRepo();
      const localChanges = await repo.getPendingChanges();
      console.debug(`Found ${localChanges.length} local changes to push`);

      // 2. Upload attachments first (if requested and available)
      let attachmentUploadResults: DownloadResult[] = [];
      if (includeAttachments) {
        const attachments = await this.getAttachmentsUploadManifest();
        console.debug(
          `Found ${attachments.length} pending attachments to upload:`,
          attachments,
        );

        if (attachments.length > 0) {
          attachmentUploadResults = await this.uploadAttachments(attachments);

          // Check for upload failures
          const failedUploads = attachmentUploadResults.filter(
            result => !result.success,
          );
          if (failedUploads.length > 0) {
            console.warn(
              `${failedUploads.length} attachment uploads failed:`,
              failedUploads,
            );
            // Continue with observation sync even if some attachments failed
            // The server should handle missing attachments gracefully
          }

          const successfulUploads = attachmentUploadResults.filter(
            result => result.success,
          );
          console.debug(
            `Successfully uploaded ${successfulUploads.length}/${attachments.length} attachments`,
          );
        }
      }

      // 3. Check if we have observations to push
      if (localChanges.length === 0) {
        console.debug('No local changes to push');

        // If we uploaded attachments, report that
        if (includeAttachments && attachmentUploadResults.length > 0) {
          const successfulUploads = attachmentUploadResults.filter(
            result => result.success,
          );
          console.debug(
            `Push completed: 0 observations, ${successfulUploads.length}/${attachmentUploadResults.length} attachments uploaded`,
          );
        }

        return Number(await AsyncStorage.getItem('@last_seen_version')) || 0;
      }

      // 3. Push observations to server
      const syncPushRequest = {
        client_id: await clientIdService.getClientId(),
        records: localChanges.map(ObservationMapper.toApi),
        transmission_id: transmissionId,
      };

      console.debug(
        `Pushing ${localChanges.length} observations with transmission ID: ${transmissionId}`,
      );
      const res = await api.syncPush({syncPushRequest});
      console.debug(
        `Successfully pushed ${localChanges.length} observations. Server version: ${res.data.current_version}`,
      );

      // 4. Update local database sync status
      await repo.markObservationsAsSynced(
        localChanges.map(record => record.observationId),
      );
      console.debug(`Marked ${localChanges.length} observations as synced`);

      // 5. Update last seen version
      await AsyncStorage.setItem(
        '@last_seen_version',
        res.data.current_version.toString(),
      );

      // 6. Log summary
      if (includeAttachments && attachmentUploadResults.length > 0) {
        const successfulUploads = attachmentUploadResults.filter(
          result => result.success,
        ).length;
        const totalUploads = attachmentUploadResults.length;
        console.debug(
          `Push completed: ${localChanges.length} observations, ${successfulUploads}/${totalUploads} attachments uploaded`,
        );
      } else {
        console.debug(
          `Push completed: ${localChanges.length} observations (attachments not included)`,
        );
      }

      return res.data.current_version;
    } catch (error: any) {
      console.error('Failed to push observations:', error);
      throw new Error(`Push failed: ${error.message}`);
    }
  }

  /**
   * Syncs Observations with the server using the pull/push functionality
   */
  async syncObservations(includeAttachments: boolean = false) {
    console.debug(
      includeAttachments
        ? 'Syncing observations with attachments'
        : 'Syncing observations',
    );
    const version = await this.pullObservations(includeAttachments);
    console.debug('Pull completed @ data version ' + version);
    await this.pushObservations(includeAttachments);
    console.debug('Push completed');
    return version;
  }
}

// Export a singleton instance
export const synkronusApi = new SynkronusApi();
