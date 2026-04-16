import { describe, expect, it } from 'vitest';
import {
  appBundleUpdateAvailable,
  serverVersionsNotDownloaded,
} from '../appBundleStatus';

describe('appBundleStatus', () => {
  it('detects update when local is missing', () => {
    expect(appBundleUpdateAvailable({ version: '1', hash: 'a' }, null)).toBe(
      true,
    );
  });

  it('detects update when version or hash differs', () => {
    expect(
      appBundleUpdateAvailable(
        { version: '2', hash: 'a' },
        {
          schemaVersion: 1,
          activeVersion: '1',
          activeHash: 'a',
          downloadedAt: '',
          archivedVersions: [],
        },
      ),
    ).toBe(true);
    expect(
      appBundleUpdateAvailable(
        { version: '1', hash: 'b' },
        {
          schemaVersion: 1,
          activeVersion: '1',
          activeHash: 'a',
          downloadedAt: '',
          archivedVersions: [],
        },
      ),
    ).toBe(true);
  });

  it('no update when manifest matches local', () => {
    expect(
      appBundleUpdateAvailable(
        { version: '1', hash: 'h' },
        {
          schemaVersion: 1,
          activeVersion: '1',
          activeHash: 'h',
          downloadedAt: '',
          archivedVersions: ['1'],
        },
      ),
    ).toBe(false);
  });

  it('lists server versions not in archive', () => {
    expect(serverVersionsNotDownloaded(['1', '2', '3'], ['2'])).toEqual([
      '1',
      '3',
    ]);
  });
});
