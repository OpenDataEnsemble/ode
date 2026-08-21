import {
  HashRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import brandMarkUrl from './assets/custodian.png';
import { AboutPage } from './pages/AboutPage';
import { ObservationsPage } from './pages/ObservationsPage';
import { SyncPage } from './pages/SyncPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { ImportPage } from './pages/ImportPage';
import { ExportPage } from './pages/ExportPage';
import { FormPreviewPage } from './pages/FormPreviewPage';
import { DeveloperModePanel } from './components/DeveloperModePanel';
import { ObservationIndexPrompt } from './components/ObservationIndexPrompt';
import { ToastHost } from './components/ToastHost';
import { WorkbenchBundlesPage } from './pages/WorkbenchBundlesPage';
import { WorkbenchCustomAppPage } from './pages/WorkbenchCustomAppPage';
import { useSynkServerStatus } from './hooks/useSynkServerStatus';
import {
  selectActiveProfileState,
  selectBundleActivity,
  selectExportActivity,
  selectSyncActivity,
  useCustodianStore,
} from './store/useCustodianStore';
import {
  selectImportActivity,
  useImportStagingStore,
} from './store/useImportStagingStore';
import { guardedProfileNavigation } from './store/useProfileDraftGuardStore';
import { useToastStore } from './store/useToastStore';
import {
  ensureBundleApplyEventPipeline,
  installGlobalIndexRebuildListener,
} from './lib/bundleTauriEvents';
import { tauriClient } from './lib/tauriClient';
import './App.css';

const DATA_NAV = [
  { to: '/data/profiles', label: 'Profiles', icon: 'badge' },
  { to: '/data/observations', label: 'Observations', icon: 'manage_search' },
  { to: '/data/import', label: 'Import', icon: 'input' },
  { to: '/data/export', label: 'Export', icon: 'output' },
  { to: '/data/sync', label: 'Sync', icon: 'sync_alt' },
  { to: '/data/about', label: 'About', icon: 'info' },
];

const WORKBENCH_NAV = [
  { to: '/workbench/bundles', label: 'Bundles', icon: 'inventory_2' },
  {
    to: '/workbench/form-preview',
    label: 'Form preview',
    icon: 'article',
  },
  { to: '/workbench/custom-app', label: 'Custom app', icon: 'web' },
];

function ServerStatusIndicator() {
  const activeProfile = useCustodianStore(selectActiveProfileState);
  const serverUrl = activeProfile?.serverUrl ?? '';
  const profileLabel = (activeProfile?.label ?? '').trim() || 'Unnamed';
  const { status, statusLabel } = useSynkServerStatus(serverUrl, profileLabel);

  return (
    <div className="server-status" title={statusLabel}>
      <span className={`server-status-dot ${status}`} aria-hidden="true" />
      <span className="server-status-text">{statusLabel}</span>
    </div>
  );
}

function ProfilesBootstrap() {
  const refreshSettings = useCustodianStore(s => s.refreshSettings);
  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);
  return null;
}

function ModeSwitch() {
  const navigate = useNavigate();
  const location = useLocation();
  const isWorkbench = location.pathname.startsWith('/workbench');
  const active = useCustodianStore(selectActiveProfileState);
  const upsertProfileRemote = useCustodianStore(s => s.upsertProfileRemote);

  async function goData() {
    await guardedProfileNavigation(
      navigate,
      '/data/profiles',
      location.pathname,
    );
    if (active) {
      await upsertProfileRemote({
        ...active,
        defaultAppMode: 'data_management',
      });
    }
  }

  async function goWorkbench() {
    await guardedProfileNavigation(
      navigate,
      '/workbench/bundles',
      location.pathname,
    );
    if (active) {
      await upsertProfileRemote({
        ...active,
        defaultAppMode: 'workbench',
      });
    }
  }

  return (
    <div className="mode-switch" role="tablist" aria-label="Application mode">
      <button
        type="button"
        role="tab"
        className={`mode-switch-btn${!isWorkbench ? ' mode-switch-btn-active' : ''}`}
        aria-selected={!isWorkbench}
        onClick={() => void goData()}>
        Data
      </button>
      <button
        type="button"
        role="tab"
        className={`mode-switch-btn${isWorkbench ? ' mode-switch-btn-active' : ''}`}
        aria-selected={isWorkbench}
        onClick={() => void goWorkbench()}>
        Workbench
      </button>
    </div>
  );
}

function ProfileSwitchNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeProfileId = useCustodianStore(s => s.activeProfileId);
  const profiles = useCustodianStore(s => s.profiles);
  const prevIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevIdRef.current === null) {
      prevIdRef.current = activeProfileId;
      return;
    }
    if (prevIdRef.current === activeProfileId) {
      return;
    }
    prevIdRef.current = activeProfileId;
    if (location.pathname === '/data/profiles') {
      return;
    }
    const p = profiles.find(x => x.id === activeProfileId);
    const mode = p?.defaultAppMode ?? 'data_management';
    navigate(mode === 'workbench' ? '/workbench/bundles' : '/data/profiles', {
      replace: true,
    });
  }, [activeProfileId, profiles, navigate, location.pathname]);

  return null;
}

function RootRedirect() {
  const p = useCustodianStore(selectActiveProfileState);
  const mode = p?.defaultAppMode ?? 'data_management';
  const to = mode === 'workbench' ? '/workbench/bundles' : '/data/profiles';
  return <Navigate to={to} replace />;
}

function SidebarNavLink({
  to,
  end,
  icon,
  label,
}: {
  to: string;
  end?: boolean;
  icon: string;
  label: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
      onClick={e => {
        if (
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0
        ) {
          return;
        }
        if (location.pathname === '/data/profiles' && to !== '/data/profiles') {
          e.preventDefault();
          void guardedProfileNavigation(navigate, to, location.pathname);
        }
      }}>
      <span className="material-symbols-outlined">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

function Shell() {
  const year = useMemo(() => new Date().getFullYear(), []);
  const location = useLocation();
  const isWorkbench = location.pathname.startsWith('/workbench');
  const navItems = isWorkbench ? WORKBENCH_NAV : DATA_NAV;
  const syncMessage = useCustodianStore(s => s.syncMessage);
  const syncDetailReport = useCustodianStore(s => s.syncDetailReport);
  const clearSyncMessage = useCustodianStore(s => s.clearSyncMessage);
  const pushToast = useToastStore(s => s.pushToast);
  const syncActivity = useCustodianStore(selectSyncActivity);
  const bundleActivity = useCustodianStore(selectBundleActivity);
  const exportActivity = useCustodianStore(selectExportActivity);
  const importActivity = useImportStagingStore(selectImportActivity);
  const setBundleActivity = useCustodianStore(s => s.setBundleActivity);
  const clearBundleActivity = useCustodianStore(s => s.clearBundleActivity);

  useEffect(() => {
    void ensureBundleApplyEventPipeline();
    return installGlobalIndexRebuildListener({
      setBundleActivity,
      clearBundleActivity,
    });
  }, [setBundleActivity, clearBundleActivity]);

  const activityText: string | null =
    syncActivity?.statusText ??
    bundleActivity?.statusText ??
    importActivity?.statusText ??
    exportActivity?.statusText ??
    null;

  const activityProgress =
    bundleActivity && bundleActivity.total > 0
      ? Math.min(
          100,
          Math.round((bundleActivity.done / bundleActivity.total) * 100),
        )
      : exportActivity && exportActivity.total > 0
        ? Math.min(
            100,
            Math.round((exportActivity.done / exportActivity.total) * 100),
          )
        : null;

  const activityPresent =
    syncActivity !== null ||
    bundleActivity !== null ||
    importActivity !== null ||
    exportActivity !== null;
  const [activityBannerDismissed, setActivityBannerDismissed] = useState(false);

  useEffect(() => {
    if (!activityPresent) {
      setActivityBannerDismissed(false);
    }
  }, [activityPresent]);

  useEffect(() => {
    if (!syncMessage) {
      return;
    }
    // Keep the banner when a downloadable detail report is attached, or when
    // the message is long (multi-line / verbose).
    const keepBanner =
      Boolean(syncDetailReport) ||
      syncMessage.includes('\n') ||
      syncMessage.length > 120;
    if (keepBanner) {
      return;
    }
    pushToast({ message: syncMessage, variant: 'success' });
    clearSyncMessage();
  }, [syncMessage, syncDetailReport, pushToast, clearSyncMessage]);

  const showActivityBanner =
    Boolean(activityText) && activityPresent && !activityBannerDismissed;

  const showSyncMessageBanner =
    Boolean(syncMessage) &&
    syncMessage !== null &&
    (Boolean(syncDetailReport) ||
      syncMessage.includes('\n') ||
      syncMessage.length > 120);

  async function saveSyncDetailReport() {
    if (!syncDetailReport) {
      return;
    }
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const path = await save({
        defaultPath: `ode-push-attachment-report-${stamp}.txt`,
        filters: [{ name: 'Text', extensions: ['txt'] }],
      });
      if (path == null) {
        return;
      }
      await tauriClient.writeTextFile(path, syncDetailReport);
      pushToast({ message: 'Report saved.', variant: 'success' });
    } catch (e) {
      pushToast({
        message: e instanceof Error ? e.message : String(e),
        variant: 'error',
      });
    }
  }

  return (
    <>
      <ProfilesBootstrap />
      <ProfileSwitchNavigation />
      <ToastHost />
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-icon">
              <img
                src={brandMarkUrl}
                alt=""
                className="brand-icon-img"
                width={36}
                height={36}
              />
            </div>
            <div>
              <h1>ODE Desktop</h1>
              <p>Data &amp; collection tooling</p>
            </div>
          </div>
          <ModeSwitch />
          <nav className="nav">
            {navItems.map(item => (
              <SidebarNavLink
                key={item.to}
                to={item.to}
                end={
                  item.to === '/data/profiles' ||
                  item.to === '/workbench/bundles'
                }
                icon={item.icon}
                label={item.label}
              />
            ))}
          </nav>
          <footer className="sidebar-footer">
            <ServerStatusIndicator />
            <span>Open Data Ensemble {year}</span>
          </footer>
        </aside>

        <main className="content">
          <ObservationIndexPrompt />
          {isWorkbench ? <DeveloperModePanel /> : null}
          <div className="content-body">
            {showActivityBanner ? (
              <div
                className="notice info app-sync-banner app-sync-banner-with-dismiss"
                role="status"
                aria-live="polite">
                <div className="app-sync-banner-body">
                  <span className="btn-spinner" aria-hidden />
                  <span>{activityText}</span>
                  {activityProgress !== null ? (
                    <div
                      className="activity-progress"
                      role="progressbar"
                      aria-valuenow={activityProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}>
                      <div
                        className="activity-progress-fill"
                        style={{ width: `${activityProgress}%` }}
                      />
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="app-sync-banner-dismiss"
                  aria-label="Dismiss status message"
                  onClick={() => setActivityBannerDismissed(true)}>
                  ×
                </button>
              </div>
            ) : null}
            {showSyncMessageBanner ? (
              <div className="notice success app-sync-banner app-sync-banner-with-dismiss">
                <div className="app-sync-banner-body">
                  <span className="app-sync-banner-text">{syncMessage}</span>
                  {syncDetailReport ? (
                    <button
                      type="button"
                      className="secondary btn-icon app-sync-banner-save-report"
                      onClick={() => void saveSyncDetailReport()}>
                      <span className="material-symbols-outlined" aria-hidden>
                        download
                      </span>
                      Save report
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="app-sync-banner-dismiss"
                  aria-label="Dismiss sync message"
                  onClick={() => clearSyncMessage()}>
                  ×
                </button>
              </div>
            ) : null}
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route
                path="/overview"
                element={<Navigate to="/data/profiles" replace />}
              />
              <Route
                path="/data/overview"
                element={<Navigate to="/data/profiles" replace />}
              />
              <Route
                path="/observations"
                element={<Navigate to="/data/observations" replace />}
              />
              <Route
                path="/import"
                element={<Navigate to="/data/import" replace />}
              />
              <Route
                path="/export"
                element={<Navigate to="/data/export" replace />}
              />
              <Route
                path="/sync"
                element={<Navigate to="/data/sync" replace />}
              />
              <Route
                path="/profiles"
                element={<Navigate to="/data/profiles" replace />}
              />
              <Route
                path="/records"
                element={<Navigate to="/data/observations" replace />}
              />
              <Route
                path="/explorer"
                element={<Navigate to="/data/observations" replace />}
              />
              <Route
                path="/health"
                element={<Navigate to="/data/profiles" replace />}
              />
              <Route
                path="/workspace"
                element={<Navigate to="/data/profiles" replace />}
              />
              <Route
                path="/settings"
                element={<Navigate to="/data/profiles" replace />}
              />

              <Route path="/data/profiles" element={<ProfilesPage />} />
              <Route path="/data/observations" element={<ObservationsPage />} />
              <Route path="/data/import" element={<ImportPage />} />
              <Route path="/data/export" element={<ExportPage />} />
              <Route path="/data/sync" element={<SyncPage />} />
              <Route path="/data/about" element={<AboutPage />} />

              <Route
                path="/workbench/bundles"
                element={<WorkbenchBundlesPage />}
              />
              <Route
                path="/workbench/form-preview"
                element={<FormPreviewPage />}
              />
              <Route
                path="/workbench/custom-app"
                element={<WorkbenchCustomAppPage />}
              />
              <Route
                path="/workbench"
                element={<Navigate to="/workbench/bundles" replace />}
              />
            </Routes>
          </div>
        </main>
      </div>
    </>
  );
}

function TauriRequiredScreen() {
  return (
    <div className="tauri-required-screen">
      <div className="tauri-required-card notice info">
        <h1>ODE Desktop</h1>
        <p>
          This UI talks to the local Rust backend through Tauri. Opening{' '}
          <code>http://localhost:1420</code> in a browser alone will not work.
        </p>
        <p>
          From the <code>desktop/</code> directory, run:
        </p>
        <pre className="tauri-required-command">pnpm tauri dev</pre>
        <p className="muted">
          That starts Vite and opens the desktop window. You do not need a
          separate <code>pnpm dev</code> terminal.
        </p>
      </div>
    </div>
  );
}

function App() {
  if (!isTauri()) {
    return <TauriRequiredScreen />;
  }
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}

export default App;
