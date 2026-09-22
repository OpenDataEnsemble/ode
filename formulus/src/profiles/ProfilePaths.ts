import RNFS from 'react-native-fs';
import { getActiveProfile } from './ProfileRuntime';
import { assertProfileId } from './ProfileTypes';

export function profileRootFor(id: string): string {
  assertProfileId(id);
  return `${RNFS.DocumentDirectoryPath}/profiles/${id}`;
}

export function profileCacheRootFor(id: string): string {
  assertProfileId(id);
  return `${RNFS.CachesDirectoryPath}/profiles/${id}`;
}

function child(root: string, relative: string): string {
  if (!relative || relative.startsWith('/') || relative.includes('\\') || relative.includes('\0') || relative.split('/').some(part => part === '..' || part === '.')) {
    throw new Error('Expected a profile-relative path');
  }
  return `${root}/${relative}`;
}

export function profilePath(relative: string): string {
  return child(profileRootFor(getActiveProfile().id), relative);
}

export function profileCachePath(relative: string): string {
  return child(profileCacheRootFor(getActiveProfile().id), relative);
}

export const profilePaths = {
  root: () => profileRootFor(getActiveProfile().id),
  cache: () => profileCacheRootFor(getActiveProfile().id),
  attachments: () => profilePath('attachments'),
  app: () => profilePath('app'),
  forms: () => profilePath('forms'),
  signatures: () => profilePath('signatures'),
};

export async function ensureProfileDirectories(id: string): Promise<void> {
  const root = profileRootFor(id);
  for (const relative of ['attachments/draft', 'attachments/pending', 'attachments/synced', 'app', 'forms', 'signatures']) {
    await RNFS.mkdir(`${root}/${relative}`);
  }
  await RNFS.mkdir(profileCacheRootFor(id));
}
