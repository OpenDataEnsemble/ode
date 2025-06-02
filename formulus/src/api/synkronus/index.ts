import { Configuration, DefaultApi, AppBundleManifest, AppBundleFile } from './generated';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage'

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
  ): Promise<void> {
    console.log(`Starting download of form specs to: ${outputRootDirectory}`);
    await this.downloadFilesByPattern(manifest, outputRootDirectory, /^forms\//, progressCallback);
    console.log('Finished downloading form specs.');
  }

  /**
   * Downloads all app files specified in the manifest to a local directory.
   */
  async downloadAppFiles(
    manifest: AppBundleManifest,
    outputRootDirectory: string,
    progressCallback?: (progressPercent: number) => void
  ): Promise<void> {
    console.log(`Starting download of all app files to: ${outputRootDirectory}`);
    await this.downloadFilesByPattern(manifest, outputRootDirectory, /^app\//, progressCallback);
    console.log('Finished downloading all app files.');
  }

  /**
   * Fetches the app bundle manifest from the server.
   */
  async getManifest(): Promise<AppBundleManifest> {
    const api = await this.getApi();
    const response = await api.appBundleManifestGet();
    return response.data;
  }

  // Private helper methods
  private async downloadFile(
    api: DefaultApi,
    remotePath: string,
    localFilePath: string
  ): Promise<void> {
    console.log(`Attempting to download: ${remotePath} to ${localFilePath}`);
    try {
      const bundle = await api.appBundleDownloadPathGet({ path: remotePath });
      const fileContent = typeof bundle.data === 'string'
        ? bundle.data
        : JSON.stringify(bundle.data, null, 2);

      if (fileContent === undefined || fileContent === null) {
        console.warn(`Content for file path ${remotePath} is undefined or null, skipping.`);
        return;
      }

      const lastSlashIndex = localFilePath.lastIndexOf('/');
      const directoryPath = lastSlashIndex > -1 ? localFilePath.substring(0, lastSlashIndex) : '';

      // Ensure the specific file's directory exists
      if (directoryPath) {
        const dirExists = await RNFS.exists(directoryPath);
        if (!dirExists) {
          await RNFS.mkdir(directoryPath, { NSURLIsExcludedFromBackupKey: true });
        }
      }

      await RNFS.writeFile(localFilePath, fileContent, 'utf8');
      console.log(`Successfully downloaded and saved: ${localFilePath}`);
    } catch (error) {
      console.error(`Failed to download or save file from remote path ${remotePath} to ${localFilePath}:`, error);
      throw error;
    }
  }

  private async downloadFilesByPattern(
    manifest: AppBundleManifest,
    outputRootDirectory: string,
    filePathPattern: RegExp,
    progressCallback?: (progressPercent: number) => void
  ): Promise<void> {
    if (!manifest?.files?.length) {
      console.log('No files found in the manifest or manifest.files is undefined/empty.');
      return;
    }

    const filesToDownload = manifest.files.filter(file => filePathPattern.test(file.path));
    const totalFiles = filesToDownload.length;
    
    if (totalFiles === 0) {
      console.log('No files match the specified pattern.');
      return;
    }

    const api = await this.getApi();
    let processedFilesCount = 0;
    
    for (const file of filesToDownload) {
      const localFilePath = `${outputRootDirectory}/${file.path}`;
      try {
        await this.downloadFile(api, file.path, localFilePath);
      } catch (error) {
        console.error(`Skipping file ${file.path} due to error during its download process.`);
        continue;
      }
      
      processedFilesCount++;
      if (progressCallback) {
        const progressPercent = Math.round((processedFilesCount / totalFiles) * 100);
        progressCallback(progressPercent);
      }
    }
  }
}

// Export a singleton instance
export const synkronusApi = new SynkronusApi();
