import { Configuration, DefaultApi, AppBundleManifest, AppBundleFile, Observation } from './generated';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { getApiAuthToken } from './Auth';

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

      const { serverUrl } = JSON.parse(rawSettings);
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
          console.debug(`Removing files from ${path}`)
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
  async downloadFormSpecs(manifest: AppBundleManifest, outputRootDirectory: string, progressCallback?: (progressPercent: number) => void): Promise<DownloadResult[]> {
    return await this.downloadFilesByPrefix(manifest, outputRootDirectory, 'forms/', progressCallback);
  }

  /**
   * Downloads all app files specified in the manifest to a local directory.
   */
  async downloadAppFiles(manifest: AppBundleManifest, outputRootDirectory: string, progressCallback?: (progressPercent: number) => void): Promise<DownloadResult[]> {
    return await this.downloadFilesByPrefix(manifest, outputRootDirectory, 'app/', progressCallback);
  }

  async downloadFilesByPrefix(manifest: AppBundleManifest, outputRootDirectory: string, prefix: string, progressCallback?: (progressPercent: number) => void): Promise<DownloadResult[]> {
    console.debug(`Downloading files with prefix "${prefix}" to: ${outputRootDirectory}`);

    const api = await this.getApi();
    const filesToDownload = manifest.files.filter(file => file.path.startsWith(prefix));
    const urls = filesToDownload.map(file => `${api['basePath']}/app-bundle/download/${encodeURIComponent(file.path)}`);
    const localFiles = filesToDownload.map(file => `${outputRootDirectory}/${file.path}`);

    return this.downloadRawFiles(urls, localFiles, progressCallback);
  }

  /**
   * Fetches the app bundle manifest from the server.
   */
  async getManifest(): Promise<AppBundleManifest> {
    const api = await this.getApi();
    const response = await api.appBundleManifestGet();
    return response.data;
  }


  private getAttachmentsDownloadManifest(observations: Observation[]): string[] {
    //const attachments = observations.flatMap(obs => obs.attachments);
    //return attachments.map(attachment => attachment.path);
    //TODO: Iterate over fields in data and identify fields with attachments - build array of paths to download
    return [];
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
  
  private async downloadRawFiles(urls: string[], localFilePaths: string[], progressCallback?: (progressPercent: number) => void): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];
    if (urls.length !== localFilePaths.length) {
      throw new Error('URLs and local file paths arrays must have the same length');
    }
    const totalFiles = urls.length;
    console.debug("URLS:", urls);
    console.debug("Local file paths:", localFilePaths);
    const singleFileCallback = (currentIndex: number, progress: RNFS.DownloadProgressCallbackResult) => {
      const fileProgress = progress.bytesWritten / progress.contentLength;
      const overallProgress = ((currentIndex + fileProgress) / totalFiles) * 100;
    
      console.debug(`Downloading file: ${urls[currentIndex]} ${Math.round(fileProgress * 100)}%`);
      progressCallback?.(Math.round(overallProgress));
    };
    
    for (let i = 0; i < totalFiles; i++) {
      const url = urls[i];
      const localFilePath = localFilePaths[i];
      try {
        console.debug(`Downloading file: ${url}`);
        const result = await this.downloadRawFile(url, localFilePath, (progress: RNFS.DownloadProgressCallbackResult) => singleFileCallback(i, progress));
        console.debug(`Downloaded file: ${localFilePath} (size: ${result.bytesWritten})`);
        results.push(result);        
      } catch (error) {
        console.error(`Failed to download file ${localFilePath}: ${error}`);
        results.push({
          success: false,
          message: `Failed to download file ${localFilePath}: ${error}`,
          filePath: localFilePath,
          bytesWritten: 0
        });
      }
      const progressPercent = Math.round((i / totalFiles) * 100);
      progressCallback?.(progressPercent);
    }
    console.debug('Files downloaded');
    return results;
  }
  private async downloadRawFile(url: string, localFilePath: string, progressCallback?: (progressPercent: RNFS.DownloadProgressCallbackResult) => void): Promise<DownloadResult> {
    if (await RNFS.exists(localFilePath)) {
      return {
        success: true,
        message: `File ${localFilePath} already exists, skipping download.`,
        filePath: localFilePath,
        bytesWritten: 0
      };
    } else {
      // Ensure parent folder exists
      const parentDir = localFilePath.substring(0, localFilePath.lastIndexOf('/'));
      if (!await RNFS.exists(parentDir)) {
        await RNFS.mkdir(parentDir);
      }
    }
    const authToken = this.fastGetToken_cachedToken ?? await this.fastGetToken();
    const downloadHeaders: { [key: string]: string } = {};
    downloadHeaders['Authorization'] = `Bearer ${authToken}`;
    
    console.debug(`Downloading from: ${url}`);
    const result = await RNFS.downloadFile({
      fromUrl: url,
      toFile: localFilePath,
      headers: downloadHeaders,
      background: true,
      progressInterval: 500, // fire at most every 500ms if progressCallback is provided
      progressDivider: progressCallback ? 1 : 100, // fire at most on every percentage change if progressCallback is provided
      progress: (progress) => {
        if (progressCallback) {          
          progressCallback(progress);          
        }
      }
    }).promise;
    
    if (result.statusCode !== 200) {
      console.error(`Failed to download file from ${url}: ${result.statusCode}`);
      return {
        success: false,
        message: `Failed to download file from ${url}: ${result.statusCode}`,
        filePath: localFilePath,
        bytesWritten: 0
      };
    }

    console.debug(`Successfully downloaded and saved (binary): ${localFilePath} (${result.bytesWritten} bytes)`);
    return {
      success: true,
      message: `Successfully downloaded and saved (binary): ${localFilePath} (${result.bytesWritten} bytes)`,
      filePath: localFilePath,
      bytesWritten: result.bytesWritten
    }
  }

  private async downloadAttachments(attachments: string[]) {
    console.debug('Starting attachments download...', attachments);
    const downloadDirectory = `${RNFS.DocumentDirectoryPath}/attachments`;
    await RNFS.mkdir(downloadDirectory);
    
    const api = await this.getApi();
    const urls = attachments.map(attachment => `${api['basePath']}/attachments/${encodeURIComponent(attachment)}`);
    const localFilePaths = attachments.map(attachment => `${downloadDirectory}/${attachment}`);

    const results = await this.downloadRawFiles(urls, localFilePaths);
    console.debug('Attachments downloaded', results);
    return results;
  }


  /**
   * Pull observations from the server. 
   * This method can be used to update the local database with the latest observations from the server.
   * It is also the first step in a full synchronization process.
   *
   * @returns {Promise<number>} The current version of the observations pulled from the server
   */
  async pullObservations() {
    const clientId = await AsyncStorage.getItem('@clientId');
    if (!clientId) throw new Error('Missing client ID');
    let since = Number(await AsyncStorage.getItem('@last_seen_version'));
    if (!since) since = 0;


    const api = await this.getApi();  
    const schemaTypes = undefined; // TODO: Feature: Maybe allow partial sync
    let res;
    do {
      let pageToken: string | undefined = undefined;
        res = await api.syncPullPost({
          syncPullRequest: {
              client_id: clientId,
              since: {
                  version: since
              },
              schema_types: schemaTypes,
            },
          pageToken: pageToken
        });
      pageToken = res.data.next_page_token;

      // TODO: *** we might want to split this up later - but for now just do everything in one go ***
      // TODO: ingest observations into WatermelonDB

      console.debug('Downloaded observations: ', res.data.records);

      const attachments = this.getAttachmentsDownloadManifest(res.data.records);      
      await this.downloadAttachments(attachments);
      

    } while (res.data.has_more);
    
    // Only when all observations are pulled and ingested by WatermelonDB, update the last seen version
    await AsyncStorage.setItem('@last_seen_version', res.data.current_version.toString());
    return res.data.current_version;
  }

  // /**
  //  * Push observations to the server. This method should only be called immediately after pullObservations
  //  */
  // async pushObservations(observations: Observation[]) {
  //   const api = await this.getApi();
  //   const res = await api.observationPushChangesPost({
  //     observationPushChangesPostRequest: {
  //       changes: observations
  //     }
  //   });
  //   return res.data;
  // }

  // /**
  //  * Syncs Observations with the server using the pull/push functionality
  //  */
  // async syncObservations() {
  //   const api = await this.getApi();
  //   // Pull observations from the server
    
  // }
}

// Export a singleton instance
export const synkronusApi = new SynkronusApi();
