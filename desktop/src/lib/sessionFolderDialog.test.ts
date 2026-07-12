import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SESSION_FOLDER_DIALOG_KEYS,
  browsePathAfterFolderSelection,
  clearSessionFolderDialogMemory,
  normalizeFolderDialogSelection,
  openSessionFolderDialog,
  rememberSessionFolderDialogPath,
  sessionFolderDialogDefaultPath,
} from './sessionFolderDialog';

const openMock = vi.fn();

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args: unknown[]) => openMock(...args),
}));

vi.mock('./tauriClient', () => ({
  tauriClient: {
    hostPathIsDirectory: vi.fn(),
  },
}));

import { tauriClient } from './tauriClient';

describe('sessionFolderDialog', () => {
  beforeEach(() => {
    clearSessionFolderDialogMemory();
    openMock.mockReset();
    vi.mocked(tauriClient.hostPathIsDirectory).mockReset();
  });

  it('returns undefined when nothing was chosen yet', async () => {
    expect(
      await sessionFolderDialogDefaultPath(
        SESSION_FOLDER_DIALOG_KEYS.importFolder,
      ),
    ).toBeUndefined();
  });

  it('returns remembered path when it still exists', async () => {
    rememberSessionFolderDialogPath(
      SESSION_FOLDER_DIALOG_KEYS.importFolder,
      '/data/import',
    );
    vi.mocked(tauriClient.hostPathIsDirectory).mockResolvedValue(true);
    expect(
      await sessionFolderDialogDefaultPath(
        SESSION_FOLDER_DIALOG_KEYS.importFolder,
      ),
    ).toBe('/data/import');
  });

  it('forgets remembered path when directory no longer exists', async () => {
    rememberSessionFolderDialogPath(
      SESSION_FOLDER_DIALOG_KEYS.importFolder,
      '/gone',
    );
    vi.mocked(tauriClient.hostPathIsDirectory).mockResolvedValue(false);
    expect(
      await sessionFolderDialogDefaultPath(
        SESSION_FOLDER_DIALOG_KEYS.importFolder,
      ),
    ).toBeUndefined();
  });

  it('openSessionFolderDialog seeds defaultPath and remembers selection', async () => {
    rememberSessionFolderDialogPath(
      SESSION_FOLDER_DIALOG_KEYS.importFolder,
      '/last',
    );
    vi.mocked(tauriClient.hostPathIsDirectory).mockResolvedValue(true);
    openMock.mockResolvedValue('/last/nested');

    const picked = await openSessionFolderDialog({
      key: SESSION_FOLDER_DIALOG_KEYS.importFolder,
      title: 'Choose folder',
    });

    expect(picked).toBe('/last/nested');
    expect(openMock).toHaveBeenCalledWith({
      title: 'Choose folder',
      directory: true,
      multiple: false,
      defaultPath: '/last',
    });
  });

  it('does not remember cancelled dialog', async () => {
    openMock.mockResolvedValue(null);
    expect(
      await openSessionFolderDialog({
        key: SESSION_FOLDER_DIALOG_KEYS.importFolder,
        title: 'Choose folder',
      }),
    ).toBeNull();
  });

  it('browsePathAfterFolderSelection uses shared parent for siblings', () => {
    expect(
      browsePathAfterFolderSelection([
        '/data/observations/hh_hut',
        '/data/observations/hh_hut_attachments',
      ]),
    ).toBe('/data/observations');
  });

  it('normalizeFolderDialogSelection accepts a single string', () => {
    expect(normalizeFolderDialogSelection('/data/hh_hut')).toEqual([
      '/data/hh_hut',
    ]);
  });

  it('openSessionFolderDialog with multiple uses plugin dialog without recursive', async () => {
    vi.mocked(tauriClient.hostPathIsDirectory).mockResolvedValue(true);
    openMock.mockResolvedValue([
      '/data/observations/hh_hut',
      '/data/observations/hh_hut_attachments',
    ]);

    const picked = await openSessionFolderDialog({
      key: SESSION_FOLDER_DIALOG_KEYS.importFolder,
      multiple: true,
      title: 'Choose folders',
    });

    expect(picked).toEqual([
      '/data/observations/hh_hut',
      '/data/observations/hh_hut_attachments',
    ]);
    expect(openMock).toHaveBeenCalledWith({
      title: 'Choose folders',
      directory: true,
      multiple: true,
      defaultPath: undefined,
    });
    expect(openMock.mock.calls[0]?.[0]).not.toHaveProperty('recursive');
    expect(
      await sessionFolderDialogDefaultPath(
        SESSION_FOLDER_DIALOG_KEYS.importFolder,
      ),
    ).toBe('/data/observations');
  });
});
