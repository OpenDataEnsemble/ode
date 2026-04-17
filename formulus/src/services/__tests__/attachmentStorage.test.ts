/// <reference types="jest" />

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type ReadDirEntry = {
  name: string;
  path: string;
  isFile: () => boolean;
  mtime?: Date;
  ctime?: Date;
};

const mockRNFS = {
  DocumentDirectoryPath: '/mock/doc',
  exists: jest.fn() as jest.MockedFunction<(path: string) => Promise<boolean>>,
  mkdir: jest.fn() as jest.MockedFunction<(path: string) => Promise<void>>,
  copyFile: jest.fn() as jest.MockedFunction<
    (src: string, dst: string) => Promise<void>
  >,
  moveFile: jest.fn() as jest.MockedFunction<
    (src: string, dst: string) => Promise<void>
  >,
  unlink: jest.fn() as jest.MockedFunction<(path: string) => Promise<void>>,
  readDir: jest.fn() as jest.MockedFunction<
    (path: string) => Promise<ReadDirEntry[]>
  >,
};
jest.mock('react-native-fs', () => mockRNFS);

const mockAsyncStorage = {
  getItem: jest.fn() as jest.MockedFunction<
    (key: string) => Promise<string | null>
  >,
  setItem: jest.fn() as jest.MockedFunction<
    (key: string, value: string) => Promise<void>
  >,
};
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

const {
  isAttachmentBasename,
  collectAttachmentBasenamesFromData,
  rewriteDraftUrisInData,
  commitDraftAttachmentsAfterSave,
  persistObservationWithAttachments,
  sweepStaleDraftAttachments,
  runAttachmentLayoutMigrationV2,
  DEFAULT_DRAFT_TTL_MS,
  ATTACHMENTS_LAYOUT_V2_KEY,
} = require('../attachmentStorage');

const GUID_A = '11111111-2222-3333-4444-555555555555';
const GUID_B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('attachmentStorage — pure helpers', () => {
  describe('isAttachmentBasename', () => {
    it('accepts bare GUIDs and GUIDs with supported extensions', () => {
      expect(isAttachmentBasename(GUID_A)).toBe(true);
      expect(isAttachmentBasename(`${GUID_A}.jpg`)).toBe(true);
      expect(isAttachmentBasename(`${GUID_A}.png`)).toBe(true);
      expect(isAttachmentBasename(`${GUID_A}.pdf`)).toBe(true);
      expect(isAttachmentBasename(`${GUID_A.toUpperCase()}.JPG`)).toBe(true);
    });

    it('rejects non-GUID strings, paths, and unsupported extensions', () => {
      expect(isAttachmentBasename('hello')).toBe(false);
      expect(isAttachmentBasename(`/some/path/${GUID_A}.jpg`)).toBe(false);
      expect(isAttachmentBasename(`${GUID_A}.exe`)).toBe(false);
      expect(isAttachmentBasename('')).toBe(false);
    });
  });

  describe('collectAttachmentBasenamesFromData', () => {
    it('deeply collects unique attachment basenames from strings, arrays, and objects', () => {
      const data = {
        photo: `${GUID_A}.jpg`,
        nested: {
          list: [`${GUID_B}.png`, `${GUID_A}.jpg`, 'not-an-attachment'],
          note: 'plain text',
        },
        irrelevantNumber: 42,
      };
      const out = collectAttachmentBasenamesFromData(data).sort();
      expect(out).toEqual([`${GUID_A}.jpg`, `${GUID_B}.png`]);
    });

    it('handles null, undefined, and non-object scalars', () => {
      expect(collectAttachmentBasenamesFromData(null)).toEqual([]);
      expect(collectAttachmentBasenamesFromData(undefined)).toEqual([]);
      expect(collectAttachmentBasenamesFromData(123)).toEqual([]);
      expect(collectAttachmentBasenamesFromData(`${GUID_A}.jpg`)).toEqual([
        `${GUID_A}.jpg`,
      ]);
    });
  });

  describe('rewriteDraftUrisInData', () => {
    it('rewrites draft paths to synced paths, deep', () => {
      const input = {
        photoUri: `file:///mock/doc/attachments/draft/${GUID_A}.jpg`,
        items: [
          {
            uri: `file:///mock/doc/attachments/draft/${GUID_B}.png`,
            note: 'ok',
          },
        ],
        nothing: 'plain',
      };
      const out = rewriteDraftUrisInData(input) as {
        photoUri: string;
        items: { uri: string; note: string }[];
        nothing: string;
      };
      expect(out.photoUri).toBe(
        `file:///mock/doc/attachments/synced/${GUID_A}.jpg`,
      );
      expect(out.items[0].uri).toBe(
        `file:///mock/doc/attachments/synced/${GUID_B}.png`,
      );
      expect(out.items[0].note).toBe('ok');
      expect(out.nothing).toBe('plain');
    });

    it('is a no-op for data without draft paths', () => {
      const input = {
        photoUri: `file:///mock/doc/attachments/synced/${GUID_A}.jpg`,
      };
      expect(rewriteDraftUrisInData(input)).toEqual(input);
    });
  });
});

describe('commitDraftAttachmentsAfterSave', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRNFS.mkdir.mockResolvedValue(undefined);
    mockRNFS.copyFile.mockResolvedValue(undefined);
    mockRNFS.unlink.mockResolvedValue(undefined);
  });

  it('promotes referenced drafts into synced/ + pending/ and rewrites URIs', async () => {
    mockRNFS.exists.mockResolvedValue(true);

    const data = {
      photo: `${GUID_A}.jpg`,
      sibling: {
        uri: `file:///mock/doc/attachments/draft/${GUID_A}.jpg`,
      },
    };

    const out = await commitDraftAttachmentsAfterSave(data);

    expect(mockRNFS.copyFile).toHaveBeenCalledWith(
      `/mock/doc/attachments/draft/${GUID_A}.jpg`,
      `/mock/doc/attachments/synced/${GUID_A}.jpg`,
    );
    expect(mockRNFS.copyFile).toHaveBeenCalledWith(
      `/mock/doc/attachments/draft/${GUID_A}.jpg`,
      `/mock/doc/attachments/pending/${GUID_A}.jpg`,
    );
    expect(mockRNFS.unlink).toHaveBeenCalledWith(
      `/mock/doc/attachments/draft/${GUID_A}.jpg`,
    );

    expect((out as { sibling: { uri: string } }).sibling.uri).toBe(
      `file:///mock/doc/attachments/synced/${GUID_A}.jpg`,
    );
  });

  it('is a no-op when the draft file is missing (e.g. already promoted)', async () => {
    mockRNFS.exists.mockResolvedValue(false);
    await commitDraftAttachmentsAfterSave({
      photo: `${GUID_A}.jpg`,
    });
    expect(mockRNFS.copyFile).not.toHaveBeenCalled();
    expect(mockRNFS.unlink).not.toHaveBeenCalled();
  });

  it('ignores non-attachment strings', async () => {
    mockRNFS.exists.mockResolvedValue(true);
    await commitDraftAttachmentsAfterSave({
      note: 'not-a-guid',
      number: 1,
    });
    expect(mockRNFS.exists).not.toHaveBeenCalled();
    expect(mockRNFS.copyFile).not.toHaveBeenCalled();
  });
});

describe('persistObservationWithAttachments (FormplayerModal submit contract)', () => {
  type SaveArgs = { formType: string; data: Record<string, unknown> };
  type UpdateArgs = {
    observationId: string;
    data: Record<string, unknown>;
  };

  let commit: jest.MockedFunction<
    (d: Record<string, unknown>) => Promise<Record<string, unknown>>
  >;
  let saveObservation: jest.MockedFunction<
    (args: SaveArgs) => Promise<string | null>
  >;
  let updateObservation: jest.MockedFunction<
    (args: UpdateArgs) => Promise<boolean>
  >;

  beforeEach(() => {
    commit = jest.fn(async (d: Record<string, unknown>) => ({
      ...d,
      _committed: true,
    })) as jest.MockedFunction<
      (d: Record<string, unknown>) => Promise<Record<string, unknown>>
    >;
    saveObservation = jest.fn(
      async () => 'new-observation-id',
    ) as jest.MockedFunction<(args: SaveArgs) => Promise<string | null>>;
    updateObservation = jest.fn(async () => true) as jest.MockedFunction<
      (args: UpdateArgs) => Promise<boolean>
    >;
  });

  it('calls commitDraftAttachmentsAfterSave and saveObservation for a new observation', async () => {
    const input = {
      formType: 'person',
      finalData: { photo: `${GUID_A}.jpg` },
      observationId: null,
      subObservationMode: false,
    };

    const result = await persistObservationWithAttachments(input, {
      saveObservation,
      updateObservation,
      commitDraftAttachments: commit,
    });

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(input.finalData);
    expect(saveObservation).toHaveBeenCalledWith({
      formType: 'person',
      data: { photo: `${GUID_A}.jpg`, _committed: true },
    });
    expect(updateObservation).not.toHaveBeenCalled();
    expect(result.observationId).toBe('new-observation-id');
    expect(result.formData).toEqual({
      photo: `${GUID_A}.jpg`,
      _committed: true,
    });
  });

  it('calls commitDraftAttachmentsAfterSave and updateObservation when updating an existing observation', async () => {
    const input = {
      formType: 'person',
      finalData: { photo: `${GUID_A}.jpg` },
      observationId: 'existing-id',
      subObservationMode: false,
    };

    const result = await persistObservationWithAttachments(input, {
      saveObservation,
      updateObservation,
      commitDraftAttachments: commit,
    });

    expect(commit).toHaveBeenCalledTimes(1);
    expect(updateObservation).toHaveBeenCalledWith({
      observationId: 'existing-id',
      data: { photo: `${GUID_A}.jpg`, _committed: true },
    });
    expect(saveObservation).not.toHaveBeenCalled();
    expect(result.observationId).toBe('existing-id');
  });

  it('does NOT promote drafts or persist in sub-observation mode', async () => {
    const input = {
      formType: 'child',
      finalData: { photo: `${GUID_A}.jpg` },
      observationId: null,
      subObservationMode: true,
    };

    const result = await persistObservationWithAttachments(input, {
      saveObservation,
      updateObservation,
      commitDraftAttachments: commit,
    });

    expect(commit).not.toHaveBeenCalled();
    expect(saveObservation).not.toHaveBeenCalled();
    expect(updateObservation).not.toHaveBeenCalled();
    expect(result.observationId).toBe('');
    expect(result.formData).toBe(input.finalData);
  });

  it('throws if saveObservation returns null (e.g. DB error)', async () => {
    saveObservation.mockResolvedValueOnce(null);
    await expect(
      persistObservationWithAttachments(
        {
          formType: 'person',
          finalData: {},
          observationId: null,
          subObservationMode: false,
        },
        { saveObservation, updateObservation, commitDraftAttachments: commit },
      ),
    ).rejects.toThrow('Failed to save new observation');
  });

  it('throws if updateObservation returns false', async () => {
    updateObservation.mockResolvedValueOnce(false);
    await expect(
      persistObservationWithAttachments(
        {
          formType: 'person',
          finalData: {},
          observationId: 'existing-id',
          subObservationMode: false,
        },
        { saveObservation, updateObservation, commitDraftAttachments: commit },
      ),
    ).rejects.toThrow('Failed to update observation');
  });
});

describe('sweepStaleDraftAttachments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 0 when the draft directory does not exist', async () => {
    mockRNFS.exists.mockResolvedValueOnce(false);
    const removed = await sweepStaleDraftAttachments();
    expect(removed).toBe(0);
    expect(mockRNFS.readDir).not.toHaveBeenCalled();
    expect(mockRNFS.unlink).not.toHaveBeenCalled();
  });

  it('unlinks only files older than the TTL', async () => {
    const now = 10_000_000_000;
    const fresh = new Date(now - 1000);
    const stale = new Date(now - DEFAULT_DRAFT_TTL_MS - 1000);
    mockRNFS.exists.mockResolvedValueOnce(true);
    mockRNFS.readDir.mockResolvedValueOnce([
      {
        name: `${GUID_A}.jpg`,
        path: `/mock/doc/attachments/draft/${GUID_A}.jpg`,
        isFile: () => true,
        mtime: fresh,
        ctime: fresh,
      },
      {
        name: `${GUID_B}.jpg`,
        path: `/mock/doc/attachments/draft/${GUID_B}.jpg`,
        isFile: () => true,
        mtime: stale,
        ctime: stale,
      },
      {
        name: 'subdir',
        path: '/mock/doc/attachments/draft/subdir',
        isFile: () => false,
        mtime: stale,
        ctime: stale,
      },
    ]);
    mockRNFS.unlink.mockResolvedValue(undefined);

    const removed = await sweepStaleDraftAttachments(DEFAULT_DRAFT_TTL_MS, now);
    expect(removed).toBe(1);
    expect(mockRNFS.unlink).toHaveBeenCalledTimes(1);
    expect(mockRNFS.unlink).toHaveBeenCalledWith(
      `/mock/doc/attachments/draft/${GUID_B}.jpg`,
    );
  });

  it('never throws, even on readDir failure', async () => {
    mockRNFS.exists.mockResolvedValueOnce(true);
    mockRNFS.readDir.mockRejectedValueOnce(new Error('boom'));
    await expect(sweepStaleDraftAttachments()).resolves.toBe(0);
  });
});

describe('runAttachmentLayoutMigrationV2', () => {
  const dir = (path: string, entries: ReadDirEntry[]): ReadDirEntry[] =>
    entries.map(e => ({ ...e, path: `${path}/${e.name}` }));

  beforeEach(() => {
    jest.clearAllMocks();
    mockRNFS.mkdir.mockResolvedValue(undefined);
    mockRNFS.moveFile.mockResolvedValue(undefined);
    mockRNFS.unlink.mockResolvedValue(undefined);
  });

  it('is a no-op when the v2 flag is already set', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce('1');
    const migrated = await runAttachmentLayoutMigrationV2();
    expect(migrated).toBe(false);
    expect(mockRNFS.mkdir).not.toHaveBeenCalled();
    expect(mockRNFS.moveFile).not.toHaveBeenCalled();
  });

  it('moves top-level files into synced/ and pending_upload/* into pending/, then sets the flag', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(null);
    mockRNFS.exists.mockImplementation(async (p: string) => {
      if (p === '/mock/doc/attachments') return true;
      if (p === '/mock/doc/attachments/pending_upload') return true;
      // All destination paths don't exist yet
      return false;
    });
    mockRNFS.readDir.mockImplementation(async (p: string) => {
      if (p === '/mock/doc/attachments') {
        return dir('/mock/doc/attachments', [
          {
            name: `${GUID_A}.jpg`,
            path: '',
            isFile: () => true,
          },
          {
            name: 'synced',
            path: '',
            isFile: () => false,
          },
          {
            name: 'pending',
            path: '',
            isFile: () => false,
          },
          {
            name: 'draft',
            path: '',
            isFile: () => false,
          },
          {
            name: 'pending_upload',
            path: '',
            isFile: () => false,
          },
        ]);
      }
      if (p === '/mock/doc/attachments/pending_upload') {
        return dir('/mock/doc/attachments/pending_upload', [
          {
            name: `${GUID_B}.jpg`,
            path: '',
            isFile: () => true,
          },
        ]);
      }
      return [];
    });

    const migrated = await runAttachmentLayoutMigrationV2();

    expect(migrated).toBe(true);
    expect(mockRNFS.mkdir).toHaveBeenCalledWith('/mock/doc/attachments/synced');
    expect(mockRNFS.mkdir).toHaveBeenCalledWith(
      '/mock/doc/attachments/pending',
    );
    expect(mockRNFS.mkdir).toHaveBeenCalledWith('/mock/doc/attachments/draft');

    expect(mockRNFS.moveFile).toHaveBeenCalledWith(
      `/mock/doc/attachments/${GUID_A}.jpg`,
      `/mock/doc/attachments/synced/${GUID_A}.jpg`,
    );
    expect(mockRNFS.moveFile).toHaveBeenCalledWith(
      `/mock/doc/attachments/pending_upload/${GUID_B}.jpg`,
      `/mock/doc/attachments/pending/${GUID_B}.jpg`,
    );

    expect(mockRNFS.unlink).toHaveBeenCalledWith(
      '/mock/doc/attachments/pending_upload',
    );

    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      ATTACHMENTS_LAYOUT_V2_KEY,
      '1',
    );
  });

  it('never throws on catastrophic FS failure and leaves the flag unset', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(null);
    mockRNFS.exists.mockRejectedValueOnce(new Error('boom'));

    await expect(runAttachmentLayoutMigrationV2()).resolves.toBe(false);
    expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
  });
});
