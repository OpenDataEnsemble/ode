import { profileActivity } from '../profiles/ProfileActivity';
import { profilePaths } from '../profiles/ProfilePaths';

/** Reject caller-supplied paths outside this runtime's data/cache roots. */
export function assertProfileFilePath(path: string): void {
  profileActivity.assertAvailable();
  if (
    path.includes('\\') ||
    path.includes('\0') ||
    path.split('/').includes('..') ||
    (path !== profilePaths.root() &&
      ![
        profilePaths.attachments(),
        profilePaths.app(),
        profilePaths.forms(),
        profilePaths.signatures(),
        profilePaths.cache(),
      ].some(root => path === root || path.startsWith(`${root}/`)))
  ) {
    throw new Error('File path is outside the active profile');
  }
}
