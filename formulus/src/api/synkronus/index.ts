import { Configuration, DefaultApi, AppBundleManifest, AppBundleFile } from './generated';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { getApiAuthToken } from './Auth';

interface DownloadResult {
  success: boolean;
  message: string;
  filePath: string;
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
   * Downloads form specifications from the app bundle based on the manifest
   * and saves them to a local directory.
   */
  async downloadFormSpecs(
    manifest: AppBundleManifest,
    outputRootDirectory: string,
    progressCallback?: (progressPercent: number) => void
  ): Promise<DownloadResult[]> {
    console.log(`Starting download of form specs to: ${outputRootDirectory}`);
    const results = await this.downloadFilesByPattern(manifest, outputRootDirectory, /^forms\//, progressCallback);
    console.log('Finished downloading form specs.');
    return results;
  }

  /**
   * Downloads all app files specified in the manifest to a local directory.
   */
  async downloadAppFiles(
    manifest: AppBundleManifest,
    outputRootDirectory: string,
    progressCallback?: (progressPercent: number) => void
  ): Promise<DownloadResult[]> {
    console.log(`Starting download of all app files to: ${outputRootDirectory}`);
    const results = await this.downloadFilesByPattern(manifest, outputRootDirectory, /^app\//, progressCallback);
    console.log('Finished downloading all app files.');
    return results;
  }

  /**
   * Fetches the app bundle manifest from the server.
   */
  async getManifest(): Promise<AppBundleManifest> {
    const api = await this.getApi();
    const response = await api.appBundleManifestGet();
    return response.data;
  }



  private async downloadFile(
    api: DefaultApi,
    remotePath: string,
    localFilePath: string
  ): Promise<DownloadResult> {
    console.log(`Attempting to download: ${remotePath} to ${localFilePath}`);
  
    const isBinary = /\.(jpg|jpeg|png|gif|webp|ico|pdf|zip|woff2?)$/i.test(remotePath);
  
    const lastSlashIndex = localFilePath.lastIndexOf('/');
    const directoryPath = lastSlashIndex > -1 ? localFilePath.substring(0, lastSlashIndex) : '';
  
    if (directoryPath) {
      const dirExists = await RNFS.exists(directoryPath);
      if (!dirExists) {
        await RNFS.mkdir(directoryPath, { NSURLIsExcludedFromBackupKey: true });
      }
    }
  
    try {
      if (isBinary) { // Bypass the axios client for binary files
        const url = `${api['basePath']}/app-bundle/download/${encodeURIComponent(remotePath)}`;
        console.log(`Downloading binary file from: ${url}`);

        const authToken = await getApiAuthToken();
        const downloadHeaders: { [key: string]: string } = {};

        if (authToken) {
          downloadHeaders['Authorization'] = `Bearer ${authToken}`;
          console.log(`[SynkronusApi.downloadFile] Authorization header added for binary download to ${url}`);
        } else {
          console.warn(`[SynkronusApi.downloadFile] No auth token retrieved for binary download to ${url}. The request might fail if authentication is required.`);
        }
        // --- END OF MODIFICATION ---
      
        const result = await RNFS.downloadFile({
          fromUrl: url,
          toFile: localFilePath,
          headers: downloadHeaders, // Added headers for authentication
        }).promise;
        if (result.statusCode !== 200) {
          try {
            RNFS.unlink(localFilePath);
          } catch (error) {
            console.error(`Failed to delete file ${localFilePath}: ${error}`);
          }
          console.error(`Failed to download file from ${url}: ${result.statusCode}`);
          return {
            success: false,
            message: `Failed to download file from ${url}: ${result.statusCode}`,
            filePath: localFilePath
          };
        }
        console.log(`Download finished with status code: ${result.statusCode}`);
      
        const stats = await RNFS.stat(localFilePath);
        console.log(`Successfully downloaded and saved (binary): ${localFilePath} (${stats.size} bytes)`);
        return {
          success: true,
          message: `Successfully downloaded and saved (binary): ${localFilePath} (${stats.size} bytes)`,
          filePath: localFilePath
        };
      } else {
        // Use the regular autogenerated API
        const bundle = await api.appBundleDownloadPathGet({ path: remotePath });
        const fileContent = typeof bundle.data === 'string'
          ? bundle.data
          : JSON.stringify(bundle.data, null, 2);
  
        if (fileContent === undefined || fileContent === null) {
          console.warn(`Content for file path ${remotePath} is undefined or null, skipping.`);
          return {
            success: false,
            message: `Content for file path ${remotePath} is undefined or null, skipping.`,
            filePath: localFilePath
          };
        }
  
        await RNFS.writeFile(localFilePath, fileContent, 'utf8');
        console.log(`Successfully downloaded and saved (text): ${localFilePath}`);
        return {
          success: true,
          message: `Successfully downloaded and saved (text): ${localFilePath}`,
          filePath: localFilePath
        };
      }
    } catch (error) {
      console.error(`Failed to download or save file from remote path ${remotePath} to ${localFilePath}:`, error);
      return {
        success: false,
        message: `Failed to download or save file from remote path ${remotePath} to ${localFilePath}: ${error}`,
        filePath: localFilePath
      };
    }
  }
  
  private async downloadFilesByPattern(
    manifest: AppBundleManifest,
    outputRootDirectory: string,
    filePathPattern: RegExp,
    progressCallback?: (progressPercent: number) => void
  ): Promise<DownloadResult[]> {
    if (!manifest?.files?.length) {
      console.warn('No files found in the manifest or manifest.files is undefined/empty.');
      return [];
    }

    const filesToDownload = manifest.files.filter(file => filePathPattern.test(file.path));
    const totalFiles = filesToDownload.length;
    
    if (totalFiles === 0) {
      console.debug('No files match the specified pattern.');
      return [];
    }

    const api = await this.getApi();
    
    const results: DownloadResult[] = [];
    for (const file of filesToDownload) {
      const localFilePath = `${outputRootDirectory}/${file.path}`;
      try {
        results.push(await this.downloadFile(api, file.path, localFilePath));        
      } catch (error) {
        console.error(`Skipping file ${file.path} due to error during its download process.`);
        results.push({
          success: false,
          message: `Failed to download file ${file.path}: ${error}`,
          filePath: localFilePath
        });
      }
      
      if (progressCallback) {        
        const progressPercent = Math.round((results.length / totalFiles) * 100);
        progressCallback(progressPercent);
      }
    }
    return results;
  }
}

// Export a singleton instance
export const synkronusApi = new SynkronusApi();
