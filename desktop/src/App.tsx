import {
  HashRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { OverviewPage } from './pages/OverviewPage';
import { ObservationsPage } from './pages/ObservationsPage';
import { SyncPage } from './pages/SyncPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { ImportPage } from './pages/ImportPage';
import { useSynkServerStatus } from './hooks/useSynkServerStatus';
import {
  selectActiveProfileState,
  useCustodianStore,
} from './store/useCustodianStore';
import './App.css';

const navItems = [
  { to: '/overview', label: 'Overview', icon: 'dashboard' },
  { to: '/observations', label: 'Observations', icon: 'manage_search' },
  { to: '/import', label: 'Import', icon: 'input' },
  { to: '/sync', label: 'Sync', icon: 'sync_alt' },
  { to: '/profiles', label: 'Profiles', icon: 'badge' },
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

function Shell() {
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="app">
      <ProfilesBootstrap />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <span className="material-symbols-outlined">shield_person</span>
          </div>
          <div>
            <h1>Custodian</h1>
            <p>ODE Data Stewardship</p>
          </div>
        </div>
        <nav className="nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/overview'}
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
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/observations" element={<ObservationsPage />} />
          <Route
            path="/records"
            element={<Navigate to="/observations" replace />}
          />
          <Route
            path="/explorer"
            element={<Navigate to="/observations" replace />}
          />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/sync" element={<SyncPage />} />
          <Route path="/health" element={<Navigate to="/overview" replace />} />
          <Route
            path="/workspace"
            element={<Navigate to="/profiles" replace />}
          />
          <Route
            path="/settings"
            element={<Navigate to="/profiles" replace />}
          />
          <Route path="/profiles" element={<ProfilesPage />} />
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
