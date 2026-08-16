/**
 * Wrapper for RNFS.downloadFile that automatically includes
 * the x-ode-version header for all Synkronus downloads.
 */
import RNFS from 'react-native-fs';
import { ODE_VERSION } from '../../version';

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
  return RNFS.downloadFile({
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
}
