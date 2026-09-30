import RNFS from 'react-native-fs';
import { profilePath } from '../profiles/ProfilePaths';
import { profileActivity } from '../profiles/ProfileActivity';

export function readPendingUploads(): Promise<{
  count: number;
  sizeMB: number;
}> {
  return profileActivity.run('Refresh pending uploads', async () => {
    // Bootstrap owns directory creation. A display refresh must not recreate
    // profile directories while the shell is being quiesced or deleted.
    const files = await RNFS.readDir(profilePath('attachments/pending'));
    const attachments = files.filter(file => file.isFile());
    return {
      count: attachments.length,
      sizeMB:
        attachments.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024),
    };
  });
}
