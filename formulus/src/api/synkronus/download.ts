/**
 * Wrapper for RNFS.downloadFile that automatically includes
 * the x-ode-version header for all Synkronus downloads.
 */
import RNFS from 'react-native-fs';
import { ODE_VERSION } from '../../version';
import { profileActivity } from '../../profiles/ProfileActivity';
import { getActiveProfile } from '../../profiles/ProfileRuntime';
import { assertProfileFilePath } from '../../services/profileFileAccess';

export interface SynkronusDownloadOptions {
  fromUrl: string;
  toFile: string;
  authToken: string;
  background?: boolean;
  progressInterval?: number;
  progressDivider?: number;
  progress?: (res: {
    jobId: number;
    contentLength: number;
    bytesWritten: number;
  }) => void;
}

/**
 * Downloads a file from Synkronus server with required headers.
 * Automatically includes x-ode-version header.
 */
export function synkronusDownload(options: SynkronusDownloadOptions): {
  jobId: number;
  promise: Promise<RNFS.DownloadResult>;
} {
  profileActivity.assertAvailable();
  assertProfileFilePath(options.toFile);
  const serverUrl = getActiveProfile().serverUrl;
  if (!serverUrl || !options.fromUrl.startsWith(`${serverUrl}/`)) {
    throw new Error('Download server does not match the active profile');
  }
  const download = RNFS.downloadFile({
    fromUrl: options.fromUrl,
    toFile: options.toFile,
    headers: {
      Authorization: `Bearer ${options.authToken}`,
      'x-ode-version': ODE_VERSION,
    },
    background: options.background ?? true,
    progressInterval: options.progressInterval ?? 500,
    progressDivider: options.progressDivider,
    progress: options.progress,
  });
  return {
    jobId: download.jobId,
    promise: profileActivity.run('Download file', () => download.promise),
  };
}
