import { open, save } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { useCallback, useEffect, useState } from 'react';
import { tauriClient } from '../lib/tauriClient';
import {
  workspaceAttachmentsDir,
  workspaceSqlitePath,
} from '../lib/workspacePaths';
import type { ServerProfile } from '../types/domain';
import {
  selectActiveProfileState,
  selectAuthSessionForActiveProfile,
  useCustodianStore,
} from '../store/useCustodianStore';

function PasswordField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="password-field" htmlFor={id}>
      {label}
      <div className="password-field-inner">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete="off"
        />
        <button
          type="button"
          className="password-field-toggle"
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible(v => !v)}>
          <span className="material-symbols-outlined" aria-hidden>
            {visible ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      </div>
    </label>
  );
}

function emptyProfile(dataDirectory: string): ServerProfile {
  const id = crypto.randomUUID();
  const base = dataDirectory.replace(/[/\\]+$/, '');
  const sep = base.includes('\\') ? '\\' : '/';
  const workspacePath = `${base}${sep}profiles${sep}${id}`;
  const databasePath = workspaceSqlitePath(workspacePath);
  return {
    id,
    label: 'New profile',
    serverUrl: '',
    username: '',
    workspacePath,
    databasePath,
    attachmentsPath: null,
  };
}

export function ProfilesPage() {
  const {
    profiles,
    activeProfileId,
    dataDirectory,
    refreshSettings,
    selectActiveProfile,
    upsertProfileRemote,
    deleteProfileRemote,
    synkLogin,
    syncMessage,
    error,
  } = useCustodianStore();
  const active = useCustodianStore(selectActiveProfileState);
  const authSession = useCustodianStore(selectAuthSessionForActiveProfile);

  const [label, setLabel] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [passwordStorageAvailable, setPasswordStorageAvailable] =
    useState(true);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileNoticeTone, setProfileNoticeTone] = useState<'warn' | 'success'>(
    'warn',
  );

  const syncDraftFromActive = useCallback(async (p: ServerProfile | null) => {
    if (!p) {
      return;
    }
    setLabel(p.label);
    setServerUrl(p.serverUrl ?? '');
    setUsername(p.username ?? '');
    setWorkspacePath(p.workspacePath ?? '');
    setProfileNotice(null);
    setProfileNoticeTone('warn');
    try {
      const res = await tauriClient.credentialGet(p.id);
      setPasswordStorageAvailable(res.storageAvailable);
      setPassword(res.password ?? '');
    } catch {
      setPasswordStorageAvailable(false);
      setPassword('');
    }
  }, []);

  useEffect(() => {
    void syncDraftFromActive(active);
  }, [active, syncDraftFromActive]);

  async function pickDirectory(title: string) {
    const selected = await open({
      directory: true,
      multiple: false,
      title,
    });
    return typeof selected === 'string' ? selected : null;
  }

  async function openWorkspaceFolder() {
    const p = workspacePath.trim();
    if (!p) {
      setProfileNotice('Choose a workspace folder first.');
      setProfileNoticeTone('warn');
      return;
    }
    setProfileNotice(null);
    setProfileNoticeTone('warn');
    try {
      await openPath(p);
    } catch (e) {
      setProfileNotice(String(e));
    }
  }

  function backupZipDefaultPath(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const name = `custodian-workspace-${y}${m}${day}-${h}${min}.zip`;
    if (!dataDirectory) {
      return name;
    }
    const base = dataDirectory.replace(/[/\\]+$/, '');
    const sep = base.includes('\\') ? '\\' : '/';
    return `${base}${sep}${name}`;
  }

  async function moveWorkspaceToFolder() {
    if (!active) {
      return;
    }
    const p = await pickDirectory('Choose new workspace folder');
    if (!p) {
      return;
    }
    if (
      !window.confirm(
        'Move all workspace data into the selected folder and point this profile at it? ' +
          'The old folder will be left empty (you can delete it manually).',
      )
    ) {
      return;
    }
    setProfileNotice(null);
    setProfileNoticeTone('warn');
    try {
      const newPath = await tauriClient.moveWorkspace(p);
      await refreshSettings();
      setProfileNoticeTone('success');
      setProfileNotice(`Workspace moved to ${newPath}`);
    } catch (e) {
      setProfileNotice(String(e));
    }
  }

  async function backupWorkspaceToZip() {
    if (!active) {
      return;
    }
    const zipPath = await save({
      title: 'Save workspace backup',
      defaultPath: backupZipDefaultPath(),
      filters: [{ name: 'Zip archive', extensions: ['zip'] }],
    });
    if (!zipPath) {
      return;
    }
    setProfileNotice(null);
    setProfileNoticeTone('warn');
    try {
      const saved = await tauriClient.backupWorkspace(zipPath);
      setProfileNoticeTone('success');
      setProfileNotice(`Backup written to ${saved}`);
    } catch (e) {
      setProfileNotice(String(e));
    }
  }

  async function saveCurrent() {
    if (!active) {
      return;
    }
    const ws = workspacePath.trim();
    if (!ws) {
      setProfileNotice('Choose a workspace folder. The app stores sqlite, attachments, and exports under it.');
      return;
    }
    setProfileNotice(null);
    setProfileNoticeTone('warn');
    const databasePath = workspaceSqlitePath(ws);
    const profile: ServerProfile = {
      ...active,
      label: label.trim() || active.label,
      serverUrl: serverUrl.trim(),
      username: username.trim() || null,
      workspacePath: ws,
      databasePath,
      attachmentsPath: null,
    };
    await upsertProfileRemote(profile);
    if (password.trim()) {
      const cred = await tauriClient.credentialSet(active.id, password);
      if (!cred.saved && cred.warning) {
        setProfileNotice(cred.warning);
      }
    } else {
      const del = await tauriClient.credentialDelete(active.id);
      if (!del.cleared && del.warning) {
        setProfileNotice(
          `Could not clear stored password: ${del.warning}. Other fields were saved.`,
        );
      }
    }
    await refreshSettings();
  }

  async function addProfile() {
    const p = emptyProfile(
      dataDirectory || (await tauriClient.getSettings()).dataDirectory,
    );
    await upsertProfileRemote(p);
    await selectActiveProfile(p.id);
    await refreshSettings();
  }

  async function removeProfile() {
    if (!active || profiles.length <= 1) {
      return;
    }
    if (
      !window.confirm(
        `Delete profile "${active.label}"? Local repository files on disk are not removed.`,
      )
    ) {
      return;
    }
    await deleteProfileRemote(active.id);
  }

  async function clearStoredPassword() {
    if (!active) {
      return;
    }
    setProfileNotice(null);
    setProfileNoticeTone('warn');
    const del = await tauriClient.credentialDelete(active.id);
    if (del.cleared) {
      setPassword('');
    } else if (del.warning) {
      setProfileNotice(del.warning);
    }
  }

  async function authenticate() {
    if (!active) {
      return;
    }
    setProfileNotice(null);
    setProfileNoticeTone('warn');
    try {
      let pwd = password;
      if (!pwd.trim()) {
        const fromStore = await tauriClient.credentialGet(active.id);
        if (fromStore.password) {
          pwd = fromStore.password;
        }
      }
      await synkLogin({
        baseUrl: serverUrl.trim(),
        username: username.trim(),
        password: pwd,
      });
    } catch {
      // synkLogin reports via store `error`
    }
  }

  const ws = workspacePath.trim();
  const derivedDb = ws ? workspaceSqlitePath(ws) : '';
  const derivedAttachments = ws ? workspaceAttachmentsDir(ws) : '';

  return (
    <section className="page">
      <header className="page-header page-header-inline">
        <div>
          <h2>Profiles</h2>
          <p>
            Each profile is a unit of custody: its own Synkronus server, local
            repository, workspace, and credentials. Switching profile switches
            the entire context.
          </p>
        </div>
        <div className="button-row">
          <button type="button" onClick={() => void refreshSettings()}>
            Reload
          </button>
        </div>
      </header>

      <div className="panel">
        <h3>Active profile</h3>
        <div className="form-grid">
          <label>
            Profile
            <select
              value={activeProfileId}
              onChange={e => void selectActiveProfile(e.target.value)}>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label || p.id}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="button-row">
          <button type="button" onClick={() => void addProfile()}>
            Add profile
          </button>
          <button
            type="button"
            className="secondary danger"
            disabled={!active || profiles.length <= 1}
            onClick={() => void removeProfile()}>
            Delete profile
          </button>
        </div>
      </div>

      {active ? (
        <div className="panel">
          <h3>Authentication</h3>
          <p className="profiles-auth-lead">
            Sign in to Synkronus for this profile. Your access token (and refresh
            token when provided) is stored in this app; sync will retry sign-in
            using a saved password if the session expires.
          </p>
          <dl className="kv-grid">
            <dt>Status</dt>
            <dd>
              {authSession ? (
                <span className="sync-auth-ok">
                  Authenticated for {authSession.baseUrl}
                </span>
              ) : (
                <span className="muted">Not authenticated</span>
              )}
            </dd>
          </dl>
          <div className="button-row">
            <button type="button" onClick={() => void authenticate()}>
              Authenticate
            </button>
          </div>
          {syncMessage ? (
            <p className="notice success profiles-auth-notice">{syncMessage}</p>
          ) : null}
          {error ? (
            <p className="notice error profiles-auth-notice">{error}</p>
          ) : null}
        </div>
      ) : null}

      {active ? (
        <div className="panel">
          <h3>Edit “{active.label}”</h3>
          <div className="form-grid form-grid-profile">
            <label>
              Display name
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Production"
              />
            </label>
            <label>
              Server URL
              <input
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                placeholder="https://synkronus.example"
              />
            </label>
            <label>
              Username
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
              />
            </label>
            <PasswordField
              id="profiles-password"
              label={
                passwordStorageAvailable
                  ? 'Password (stored in OS secure storage)'
                  : 'Password (secure storage unavailable — enter when authenticating; not persisted)'
              }
              value={password}
              onChange={setPassword}
            />
            {!passwordStorageAvailable ? (
              <div className="settings-cred-inline">
                <span className="settings-cred-summary">
                  Passwords will not be saved{' '}
                  <details className="settings-cred-details">
                    <summary className="settings-cred-more">?</summary>
                    <div className="settings-cred-body">
                      <p>
                        OS secure storage could not be reached (common on Linux
                        without Secret Service / D-Bus). Username, URL, and
                        workspace still save; passwords are not stored on disk.
                      </p>
                      <p>
                        On Ubuntu and many desktops, install and run{' '}
                        <code>gnome-keyring</code> and ensure a graphical session
                        provides the Secret Service (D-Bus). On SSH-only or
                        minimal environments the keyring may be unavailable—enter
                        your password when you authenticate.
                      </p>
                    </div>
                  </details>
                </span>
              </div>
            ) : null}
            <label>
              Workspace folder
              <div className="input-with-button">
                <input
                  readOnly
                  value={workspacePath}
                  placeholder="Required — root for sqlite, attachments, exports"
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    void pickDirectory('Workspace folder').then(
                      p => p && setWorkspacePath(p),
                    )
                  }>
                  Browse…
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={!workspacePath.trim()}
                  onClick={() => void openWorkspaceFolder()}
                  title="Show this folder in the file manager">
                  Open folder
                </button>
              </div>
            </label>
            <div className="workspace-toolbar-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => void moveWorkspaceToFolder()}>
                Move workspace…
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => void backupWorkspaceToZip()}>
                Backup workspace…
              </button>
            </div>
            <div className="workspace-derived-paths">
              <p className="muted small-hint">
                Local paths under the workspace (fixed layout):
              </p>
              <dl className="kv-grid kv-grid-tight">
                <dt>SQLite database</dt>
                <dd className="path-dd">
                  {derivedDb || '—'}
                </dd>
                <dt>Attachments</dt>
                <dd className="path-dd">
                  {derivedAttachments || '—'}
                </dd>
              </dl>
            </div>
          </div>
          {profileNotice ? (
            <p
              className={`notice ${profileNoticeTone === 'success' ? 'success' : 'warn'}`}>
              {profileNotice}
            </p>
          ) : null}
          <div className="button-row">
            <button type="button" onClick={() => void saveCurrent()}>
              Save profile
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => void clearStoredPassword()}>
              Clear saved password
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
