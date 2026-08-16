import { render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: vi.fn(() => true),
  invoke: vi.fn(),
}));

vi.mock('./lib/bundleTauriEvents', () => ({
  ensureBundleApplyEventPipeline: vi.fn().mockResolvedValue(undefined),
  installGlobalIndexRebuildListener: vi.fn(() => () => {}),
  bundleBannerLineFromProgress: vi.fn((p: { message: string }) => p.message),
}));

import App from './App';

const { defaultSettings } = vi.hoisted(() => ({
  defaultSettings: {
    activeProfileId: 'p1',
    profiles: [
      {
        id: 'p1',
        label: 'Default',
        serverUrl: '',
        username: null as string | null,
        workspacePath: '/tmp/custodian-ws',
        databasePath: '/tmp/custodian-ws/sqlite/custodian.sqlite3',
        attachmentsPath: null as string | null,
      },
    ],
    dataDirectory: '/tmp/custodian-data',
  },
}));

vi.mock('./lib/tauriClient', () => ({
  tauriClient: {
    getSettings: vi.fn().mockResolvedValue(defaultSettings),
    setActiveProfile: vi.fn(),
    upsertProfile: vi.fn(),
    deleteProfile: vi.fn(),
    credentialSet: vi.fn(),
    credentialGet: vi
      .fn()
      .mockResolvedValue({ password: null, storageAvailable: true }),
    credentialDelete: vi.fn(),
    getWorkspace: vi.fn().mockResolvedValue(null),
    setWorkspace: vi.fn(),
    listWorkspaceItems: vi.fn().mockResolvedValue([]),
    listObservations: vi.fn().mockResolvedValue([]),
    listObservationsPage: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    listDirtyObservations: vi.fn().mockResolvedValue([]),
    listFormTypes: vi.fn().mockResolvedValue([]),
    getSyncState: vi.fn().mockResolvedValue({
      repositoryGeneration: 0,
      observationSyncVersion: 0,
      lastAttachmentVersion: 0,
    }),
    setSyncState: vi.fn(),
    archiveWorkspaceForRepositoryGeneration: vi.fn(),
    writeWorkspaceAttachment: vi.fn(),
    copyWorkspaceAttachmentFromPath: vi.fn(),
    expandImportStagingPaths: vi.fn().mockResolvedValue([]),
    parseImportObservationJsonPaths: vi.fn().mockResolvedValue([]),
    parseAndValidateImportJsonPaths: vi.fn().mockResolvedValue({
      files: [],
      issues: [],
      observationCount: 0,
      formTypeCount: 0,
      referencedAttachmentNames: [],
      missingAttachmentNames: [],
      orphanAttachmentNames: [],
    }),
    scanImportJsonSyncAppearance: vi.fn().mockResolvedValue({
      fileCount: 0,
      observationCount: 0,
      apparentlySyncedCount: 0,
      unsyncedCount: 0,
      parseErrorCount: 0,
      unsyncedPaths: [],
    }),
    readHostTextFile: vi.fn().mockResolvedValue('{}'),
    readHostTextFilesBatch: vi.fn().mockImplementation((paths: string[]) =>
      Promise.resolve(
        paths.map(p => ({
          path: p,
          text: '{}',
        })),
      ),
    ),
    uploadOutboundAttachments: vi.fn().mockResolvedValue({
      uploaded: 0,
      skippedConflicts: 0,
      skippedMissing: 0,
      failed: 0,
      errorSummary: null,
    }),
    checkWorkspaceAttachmentPresence: vi.fn().mockResolvedValue([]),
    writeWorkspaceFile: vi
      .fn()
      .mockResolvedValue('/tmp/custodian-ws/bundles/app-bundle.zip'),
    getAppBundleState: vi.fn().mockResolvedValue(null),
    downloadAndApplyAppBundle: vi.fn(),
    listActiveBundleForms: vi.fn().mockResolvedValue([]),
    readBundleFormSpec: vi.fn(),
    removeWorkspaceAttachment: vi.fn(),
    getObservation: vi.fn(),
    saveObservation: vi.fn(),
    importObservations: vi.fn(),
    markObservationsPushed: vi.fn(),
    getAppHealth: vi.fn().mockResolvedValue({
      workspacePath: null,
      dbPath: 'test-db',
      totalObservations: 0,
      dirtyCount: 0,
      totalAttachmentCount: 0,
      pendingAttachmentCount: 0,
      conflictCount: 0,
      lastSaveAt: null,
      lastPullAt: null,
      lastPushAt: null,
    }),
    resetLocalWorkspaceData: vi.fn().mockResolvedValue({}),
    synkLogin: vi.fn(),
    synkPull: vi.fn(),
    synkPush: vi.fn(),
  },
}));

describe('App shell', () => {
  it('renders profiles home and primary navigation', async () => {
    render(<App />);
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Profiles' }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('ODE Desktop')).toBeInTheDocument();
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByText('Profiles')).toBeInTheDocument();
    expect(within(nav).getByText('Observations')).toBeInTheDocument();
    expect(within(nav).getByText('Import')).toBeInTheDocument();
    expect(within(nav).getByText('Sync')).toBeInTheDocument();
    expect(within(nav).getByText('About')).toBeInTheDocument();
    expect(within(nav).queryByText('Overview')).not.toBeInTheDocument();
    expect(within(nav).queryByText('Workspace')).not.toBeInTheDocument();
  });
});
