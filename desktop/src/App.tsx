import {
  HashRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import brandMarkUrl from './assets/custodian.png';
import { OverviewPage } from './pages/OverviewPage';
import { ObservationsPage } from './pages/ObservationsPage';
import { SyncPage } from './pages/SyncPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { ImportPage } from './pages/ImportPage';
import { FormPreviewPage } from './pages/FormPreviewPage';
import { WorkbenchBundlesPage } from './pages/WorkbenchBundlesPage';
import { WorkbenchCustomAppPage } from './pages/WorkbenchCustomAppPage';
import { useSynkServerStatus } from './hooks/useSynkServerStatus';
import {
  selectActiveProfileState,
  selectSyncActivity,
  useCustodianStore,
} from './store/useCustodianStore';
import {
  selectImportActivity,
  useImportStagingStore,
} from './store/useImportStagingStore';
import './App.css';

const DATA_NAV = [
  { to: '/data/overview', label: 'Overview', icon: 'dashboard' },
  { to: '/data/observations', label: 'Observations', icon: 'manage_search' },
  { to: '/data/import', label: 'Import', icon: 'input' },
  { to: '/data/sync', label: 'Sync', icon: 'sync_alt' },
  { to: '/data/profiles', label: 'Profiles', icon: 'badge' },
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
    navigate('/data/overview');
    if (active) {
      await upsertProfileRemote({
        ...active,
        defaultAppMode: 'data_management',
      });
    }
  }

  async function goWorkbench() {
    navigate('/workbench/bundles');
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

/** On profile switch (not initial mount), navigate to that profile’s default mode home. */
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
    navigate(mode === 'workbench' ? '/workbench/bundles' : '/data/overview', {
      replace: true,
    });
  }, [activeProfileId, profiles, navigate, location.pathname]);

  return null;
}

function RootRedirect() {
  const p = useCustodianStore(selectActiveProfileState);
  const mode = p?.defaultAppMode ?? 'data_management';
  const to = mode === 'workbench' ? '/workbench/bundles' : '/data/overview';
  return <Navigate to={to} replace />;
}

function EnvironmentBadge() {
  const active = useCustodianStore(selectActiveProfileState);
  const tier = active?.environment ?? 'production';
  if (tier === 'production') {
    return null;
  }
  return (
    <div
      className={`env-badge env-badge-${tier}`}
      title="Profile environment tier">
      {tier}
    </div>
  );
}

function Shell() {
  const year = useMemo(() => new Date().getFullYear(), []);
  const location = useLocation();
  const isWorkbench = location.pathname.startsWith('/workbench');
  const navItems = isWorkbench ? WORKBENCH_NAV : DATA_NAV;
  const syncMessage = useCustodianStore(s => s.syncMessage);
  const syncActivity = useCustodianStore(selectSyncActivity);
  const importActivity = useImportStagingStore(selectImportActivity);
  let activityText: string | null =
    syncActivity?.statusText ?? importActivity?.statusText ?? null;

  const activityPresent = syncActivity !== null || importActivity !== null;
  const [activityBannerDismissed, setActivityBannerDismissed] = useState(false);
  const [syncMessageDismissed, setSyncMessageDismissed] = useState(false);

  useEffect(() => {
    if (!activityPresent) {
      setActivityBannerDismissed(false);
    }
  }, [activityPresent]);

  useEffect(() => {
    if (!syncMessage) {
      setSyncMessageDismissed(false);
    }
  }, [syncMessage]);

  const showActivityBanner =
    Boolean(activityText) && activityPresent && !activityBannerDismissed;
  const showSyncMessageBanner = Boolean(syncMessage) && !syncMessageDismissed;

  return (
    <div className="app">
      <ProfilesBootstrap />
      <ProfileSwitchNavigation />
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
        <EnvironmentBadge />
        <nav className="nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={
                item.to === '/data/overview' || item.to === '/workbench/bundles'
              }
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }>
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <footer className="sidebar-footer">
          <ServerStatusIndicator />
          <span>Open Data Ensemble {year}</span>
        </footer>
      </aside>

      <main className="content">
        {showActivityBanner ? (
          <div
            className="notice info app-sync-banner app-sync-banner-with-dismiss"
            role="status"
            aria-live="polite">
            <div className="app-sync-banner-body">
              <span className="btn-spinner" aria-hidden />
              <span>{activityText}</span>
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
            <div className="app-sync-banner-body">{syncMessage}</div>
            <button
              type="button"
              className="app-sync-banner-dismiss"
              aria-label="Dismiss sync message"
              onClick={() => setSyncMessageDismissed(true)}>
              ×
            </button>
          </div>
        ) : null}
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route
            path="/overview"
            element={<Navigate to="/data/overview" replace />}
          />
          <Route
            path="/observations"
            element={<Navigate to="/data/observations" replace />}
          />
          <Route
            path="/import"
            element={<Navigate to="/data/import" replace />}
          />
          <Route path="/sync" element={<Navigate to="/data/sync" replace />} />
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
            element={<Navigate to="/data/overview" replace />}
          />
          <Route
            path="/workspace"
            element={<Navigate to="/data/profiles" replace />}
          />
          <Route
            path="/settings"
            element={<Navigate to="/data/profiles" replace />}
          />

          <Route path="/data/overview" element={<OverviewPage />} />
          <Route path="/data/observations" element={<ObservationsPage />} />
          <Route path="/data/import" element={<ImportPage />} />
          <Route path="/data/sync" element={<SyncPage />} />
          <Route path="/data/profiles" element={<ProfilesPage />} />

          <Route path="/workbench/bundles" element={<WorkbenchBundlesPage />} />
          <Route path="/workbench/form-preview" element={<FormPreviewPage />} />
          <Route
            path="/workbench/custom-app"
            element={<WorkbenchCustomAppPage />}
          />
          <Route
            path="/workbench"
            element={<Navigate to="/workbench/bundles" replace />}
          />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}

export default App;
