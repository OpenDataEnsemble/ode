jest.mock(
  '../../profiles/ProfileActivity',
  () => ({
    profileActivity:
      require('../testUtils/profileMocks').createProfileActivityMock(),
  }),
  { virtual: true },
);
jest.mock(
  '../../profiles/ProfilePaths',
  () =>
    require('../testUtils/profileMocks').createProfilePathsMock(
      '/documents/profiles/b',
      '/cache/profiles/b',
    ),
  { virtual: true },
);
jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    exists: jest.fn(),
    readDir: jest.fn(),
    mkdir: jest.fn(),
    unlink: jest.fn(),
  },
}));
jest.mock('react-native-zip-archive', () => ({ zip: jest.fn() }));
jest.mock('../saveZipToDevice', () => ({ saveZipToDevice: jest.fn() }));

import RNFS from 'react-native-fs';
import { zip } from 'react-native-zip-archive';
import { attachmentExportService } from '../AttachmentExportService';
import { saveZipToDevice } from '../saveZipToDevice';
import { assertProfileFilePath } from '../profileFileAccess';
import { deferred } from '../testUtils/profileMocks';

const { profileActivity } = require('../../profiles/ProfileActivity');

describe('profile file IO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    profileActivity.unblock();
  });

  it('rejects sibling profile, shared-root and traversal paths', () => {
    expect(() =>
      assertProfileFilePath('/documents/profiles/a/attachments/x'),
    ).toThrow('outside');
    expect(() => assertProfileFilePath('/documents/attachments/x')).toThrow(
      'outside',
    );
    expect(() => assertProfileFilePath('/documents/profiles/b/../a/x')).toThrow(
      'outside',
    );
    expect(() =>
      assertProfileFilePath('/documents/profiles/b/attachments/x'),
    ).not.toThrow();
    expect(() =>
      assertProfileFilePath('/cache/profiles/b/export.zip'),
    ).not.toThrow();
  });

  it('exports only the active attachment tree and holds activity through the save dialog', async () => {
    jest
      .mocked(RNFS.exists)
      .mockImplementation(
        async path => path === '/documents/profiles/b/attachments',
      );
    jest
      .mocked(RNFS.readDir)
      .mockResolvedValue([{ isFile: () => true } as never]);
    const saved = deferred<void>();
    const dialogOpened = deferred<void>();
    jest.mocked(saveZipToDevice).mockImplementationOnce(() => {
      dialogOpened.resolve();
      return saved.promise;
    });
    const exportJob = attachmentExportService.exportDeviceLocalAttachmentsZip();
    await dialogOpened.promise;
    expect(zip).toHaveBeenCalledWith(
      '/documents/profiles/b/attachments',
      expect.stringMatching(/^\/cache\/profiles\/b\//),
    );
    expect(profileActivity.isBusy()).toBe(true);
    expect(() => profileActivity.block()).toThrow('Wait for profile jobs');
    saved.resolve();
    await exportJob;
    expect(profileActivity.isBusy()).toBe(false);
  });

  it('starts no IO after transition begins', async () => {
    profileActivity.block();
    await expect(
      attachmentExportService.exportDeviceLocalAttachmentsZip(),
    ).rejects.toThrow('Profile transition');
    expect(RNFS.exists).not.toHaveBeenCalled();
  });
});
