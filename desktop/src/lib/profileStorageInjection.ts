import type { AppSettings } from '../types/domain';

/** Desktop legacy drafts have no known owner; never assign them to a Default profile. */
export function buildProfileStorageInjection(settings: AppSettings): string {
  const id = settings.activeProfileId;
  const deletedIds = settings.deletedProfileIds ?? [];
  if (
    typeof id !== 'string' ||
    !/^[a-zA-Z0-9_-]+$/.test(id) ||
    !settings.profiles.some(p => p.id === id) ||
    deletedIds.includes(id)
  ) {
    throw new Error('No valid active profile for browser storage');
  }
  const json = (value: unknown) =>
    JSON.stringify(value).replace(/</g, '\\u003c');
  return `<script>window.__odeProfileId=${json(id)};window.__odeLegacyWebStorageProfileId=null;window.__odeDeletedProfileIds=${json(deletedIds)};</script>`;
}
