import { render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
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
    listFormTypes: vi.fn().mockResolvedValue([]),
    getSyncState: vi.fn().mockResolvedValue({
      repositoryGeneration: 0,
      observationSyncVersion: 0,
      lastAttachmentVersion: 0,
    }),
    setSyncState: vi.fn(),
    archiveWorkspaceForRepositoryGeneration: vi.fn(),
    writeWorkspaceAttachment: vi.fn(),
    writeWorkspaceFile: vi
      .fn()
      .mockResolvedValue('/tmp/custodian-ws/bundles/app-bundle.zip'),
    getAppBundleState: vi.fn().mockResolvedValue(null),
    applyAppBundleDownload: vi.fn(),
    listActiveBundleForms: vi.fn().mockResolvedValue([]),
    readBundleFormSpec: vi.fn(),
    removeWorkspaceAttachment: vi.fn(),
    getObservation: vi.fn(),
    saveObservation: vi.fn(),
    restoreLastBackup: vi.fn(),
    importObservations: vi.fn(),
    markObservationsPushed: vi.fn(),
    getAppHealth: vi.fn().mockResolvedValue({
      workspacePath: null,
      dbPath: 'test-db',
      totalObservations: 0,
      dirtyCount: 0,
      conflictCount: 0,
      lastSaveAt: null,
      lastPullAt: null,
      lastPushAt: null,
    }),
    repairRepository: vi.fn(),
    synkLogin: vi.fn(),
    synkPull: vi.fn(),
    synkPush: vi.fn(),
  },
}));

describe('App shell', () => {
  it('renders the overview and primary navigation', async () => {
    render(<App />);
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Overview' }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('ODE Desktop')).toBeInTheDocument();
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByText('Overview')).toBeInTheDocument();
    expect(within(nav).getByText('Observations')).toBeInTheDocument();
    expect(within(nav).getByText('Import')).toBeInTheDocument();
    expect(within(nav).getByText('Sync')).toBeInTheDocument();
    expect(within(nav).getByText('Profiles')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Repository Health')).not.toBeInTheDocument();
    expect(within(nav).queryByText('Workspace')).not.toBeInTheDocument();
  });
});
