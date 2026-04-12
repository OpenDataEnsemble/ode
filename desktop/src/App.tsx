import {
  HashRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { OverviewPage } from './pages/OverviewPage';
import { ObservationsPage } from './pages/ObservationsPage';
import { SyncPage } from './pages/SyncPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { ImportPage } from './pages/ImportPage';
import { WorkbenchPage } from './pages/WorkbenchPage';
import { useSynkServerStatus } from './hooks/useSynkServerStatus';
import {
  selectActiveProfileState,
  useCustodianStore,
} from './store/useCustodianStore';
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

  return (
    <div className="mode-switch" role="tablist" aria-label="Application mode">
      <button
        type="button"
        role="tab"
        className={`mode-switch-btn${!isWorkbench ? ' mode-switch-btn-active' : ''}`}
        aria-selected={!isWorkbench}
        onClick={() => navigate('/data/overview')}>
        Data
      </button>
      <button
        type="button"
        role="tab"
        className={`mode-switch-btn${isWorkbench ? ' mode-switch-btn-active' : ''}`}
        aria-selected={isWorkbench}
        onClick={() => navigate('/workbench/bundles')}>
        Workbench
      </button>
    </div>
  );
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

  return (
    <div className="app">
      <ProfilesBootstrap />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <span className="material-symbols-outlined">shield_person</span>
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
        <Routes>
          <Route path="/" element={<Navigate to="/data/overview" replace />} />
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

          <Route path="/workbench/bundles" element={<WorkbenchPage />} />
          <Route path="/workbench/form-preview" element={<WorkbenchPage />} />
          <Route path="/workbench/custom-app" element={<WorkbenchPage />} />
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
