import { save, confirm } from '@tauri-apps/plugin-dialog';
import {
  openSessionFolderDialog,
  SESSION_FOLDER_DIALOG_KEYS,
} from '../lib/sessionFolderDialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { tauriClient } from '../lib/tauriClient';
import {
  baselineFromProfile,
  isProfileDraftDirty,
  type ProfileDraftBaseline,
} from '../lib/profileDraftDirty';
import {
  workspaceAttachmentsDir,
  workspaceSqlitePath,
} from '../lib/workspacePaths';
import type { ServerProfile } from '../types/domain';
import {
  selectActiveProfileState,
  useCustodianStore,
} from '../store/useCustodianStore';
import { useProfileAutoSynkAuth } from '../hooks/useProfileAutoSynkAuth';
import { useProfileDraftGuardStore } from '../store/useProfileDraftGuardStore';
import { confirmDestructiveAction } from '../lib/destructivePolicy';

function PasswordField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
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
    defaultAppMode: 'data_management',
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
    error,
  } = useCustodianStore();
  const active = useCustodianStore(selectActiveProfileState);
  const { authSession, authBlocked, authReady, authChecking, refreshAuth } =
    useProfileAutoSynkAuth(active?.id);

  const [label, setLabel] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [passwordStorageAvailable, setPasswordStorageAvailable] =
    useState(true);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileNoticeTone, setProfileNoticeTone] = useState<
    'warn' | 'success'
  >('warn');
  const [savedBaseline, setSavedBaseline] =
    useState<ProfileDraftBaseline | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const setProfileDraftDirty = useProfileDraftGuardStore(s => s.setIsDirty);
  const setProfileDraftAttemptLeave = useProfileDraftGuardStore(
    s => s.setAttemptLeave,
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
      const pwd = res.password ?? '';
      setPassword(pwd);
      setSavedBaseline(baselineFromProfile(p, pwd));
    } catch {
      setPasswordStorageAvailable(false);
      setPassword('');
      setSavedBaseline(baselineFromProfile(p, ''));
    }
  }, []);

  const isDirty = useMemo(
    () =>
      isProfileDraftDirty(savedBaseline, active?.id, {
        label,
        serverUrl,
        username,
        password,
      }),
    [savedBaseline, active?.id, label, serverUrl, username, password],
  );

  async function promptUnsavedProfileChanges(): Promise<boolean> {
    const message = 'Some settings were changed. Save profile?';
    if (isTauri()) {
      return confirm(message, {
        title: 'Unsaved changes',
        kind: 'warning',
      });
    }
    return window.confirm(message);
  }

  const saveCurrent = useCallback(async (): Promise<boolean> => {
    if (!active) {
      return false;
    }
    const ws = workspacePath.trim();
    if (!ws) {
      setProfileNotice(
        'Choose a workspace folder. The app stores sqlite, attachments, and exports under it.',
      );
      return false;
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
    return true;
  }, [
    active,
    workspacePath,
    label,
    serverUrl,
    username,
    password,
    upsertProfileRemote,
    refreshSettings,
  ]);

  async function handleProfileSelect(nextId: string) {
    if (nextId === activeProfileId) {
      return;
    }
    if (isDirty) {
      const shouldSave = await promptUnsavedProfileChanges();
      if (shouldSave) {
        const ok = await saveCurrent();
        if (!ok) {
          return;
        }
      } else {
        await syncDraftFromActive(active);
      }
    }
    await selectActiveProfile(nextId);
  }

  useEffect(() => {
    void syncDraftFromActive(active);
  }, [active, syncDraftFromActive]);

  useEffect(() => {
    setProfileDraftDirty(isDirty);
    return () => setProfileDraftDirty(false);
  }, [isDirty, setProfileDraftDirty]);

  useEffect(() => {
    const attemptLeave = async (): Promise<boolean> => {
      const shouldSave = await promptUnsavedProfileChanges();
      if (shouldSave) {
        return saveCurrent();
      }
      await syncDraftFromActive(active);
      return true;
    };
    setProfileDraftAttemptLeave(attemptLeave);
    return () => setProfileDraftAttemptLeave(null);
  }, [active, saveCurrent, syncDraftFromActive, setProfileDraftAttemptLeave]);

  async function pickDirectory(title: string) {
    return openSessionFolderDialog({
      key: SESSION_FOLDER_DIALOG_KEYS.profileWorkspace,
      title,
    });
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

  async function addProfile() {
    if (isDirty) {
      const shouldSave = await promptUnsavedProfileChanges();
      if (shouldSave) {
        const ok = await saveCurrent();
        if (!ok) {
          return;
        }
      } else {
        await syncDraftFromActive(active);
      }
    }
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
      !(await confirmDestructiveAction(
        'profile_delete',
        `Delete profile "${active.label}"? Local repository files on disk are not removed.`,
      ))
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
    if (!active || authSubmitting) {
      return;
    }
    setAuthSubmitting(true);
    setProfileNotice(null);
    setProfileNoticeTone('warn');
    try {
      const saved = await saveCurrent();
      if (!saved) {
        return;
      }
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
      await refreshAuth();
    } catch {
      // synkLogin reports via store `error`
    } finally {
      setAuthSubmitting(false);
    }
  }

  const ws = workspacePath.trim();
  const derivedDb = ws ? workspaceSqlitePath(ws) : '';
  const derivedAttachments = ws ? workspaceAttachmentsDir(ws) : '';

  const isAuthenticated = authReady && Boolean(authSession) && !authBlocked;
  const authBusy = authChecking || authSubmitting;
  const authIcon = isAuthenticated
    ? 'verified_user'
    : authBusy
      ? 'hourglass_empty'
      : 'lock_open';
  const authLabel = isAuthenticated
    ? 'Authenticated'
    : authSubmitting
      ? 'Logging in…'
      : authChecking
        ? 'Checking…'
        : 'Authenticate';

  return (
    <section className="page">
      <header className="page-header">
        <h2>Profiles</h2>
      </header>

      <div className="panel">
        <div className="profile-toolbar">
          <select
            aria-label="Profile"
            value={activeProfileId}
            onChange={e => void handleProfileSelect(e.target.value)}>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.label || p.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="secondary btn-icon"
            title="Add profile"
            aria-label="Add profile"
            onClick={() => void addProfile()}>
            <span className="material-symbols-outlined" aria-hidden>
              add
            </span>
          </button>
        </div>
        {active ? (
          <div className="button-row profile-toolbar-actions">
            <button
              type="button"
              className="btn-icon"
              onClick={() => void saveCurrent()}>
              <span className="material-symbols-outlined" aria-hidden>
                save
              </span>
              Save profile
            </button>
            <button
              type="button"
              className="secondary danger btn-icon"
              disabled={profiles.length <= 1}
              onClick={() => void removeProfile()}>
              <span className="material-symbols-outlined" aria-hidden>
                delete
              </span>
              Delete profile
            </button>
          </div>
        ) : null}
        {error ? <p className="notice error">{error}</p> : null}
        {!authBusy && authBlocked && !error ? (
          <p className="notice warn">
            Automatic authentication failed for this profile. Review the server URL,
            username, and saved password, then authenticate again.
          </p>
        ) : null}
      </div>

      {active ? (
        <div className="panel">
          <table className="form-table">
            <tbody>
              <tr>
                <th scope="row">Display name</th>
                <td>
                  <input
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">Server URL</th>
                <td>
                  <input
                    value={serverUrl}
                    onChange={e => setServerUrl(e.target.value)}
                    placeholder="https://synkronus.example"
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">Username</th>
                <td>
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">
                  {passwordStorageAvailable
                    ? 'Password'
                    : 'Password (not persisted)'}
                </th>
                <td>
                  <PasswordField
                    id="profiles-password"
                    value={password}
                    onChange={setPassword}
                  />
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="form-table-actions-cell">
                  <button
                    type="button"
                    className={`btn-icon${isAuthenticated ? ' btn-success' : ' secondary'}`}
                    disabled={isAuthenticated || authBusy}
                    onClick={() => void authenticate()}>
                    <span className="material-symbols-outlined" aria-hidden>
                      {authIcon}
                    </span>
                    {authLabel}
                  </button>
                </td>
              </tr>
              <tr>
                <th scope="row">Workspace</th>
                <td>
                  <input
                    readOnly
                    value={workspacePath}
                    className="field-block"
                  />
                  <div className="field-button-row">
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
                      onClick={() => void openWorkspaceFolder()}>
                      Open
                    </button>
                  </div>
                </td>
              </tr>
              <tr>
                <th scope="row">Database</th>
                <td>
                  <code className="path-value-wrap">{derivedDb || '—'}</code>
                  <p className="muted form-table-hint">
                    External SQL tools: quit ODE Desktop first; direct edits can
                    break sync.
                  </p>
                </td>
              </tr>
              <tr>
                <th scope="row">Attachments</th>
                <td>
                  <code className="path-value-wrap">
                    {derivedAttachments || '—'}
                  </code>
                </td>
              </tr>
            </tbody>
          </table>
          {profileNotice ? (
            <p
              className={`notice ${profileNoticeTone === 'success' ? 'success' : 'warn'}`}>
              {profileNotice}
            </p>
          ) : null}
          <div className="button-row">
            <button
              type="button"
              className="secondary btn-icon"
              onClick={() => void moveWorkspaceToFolder()}>
              <span className="material-symbols-outlined" aria-hidden>
                drive_file_move
              </span>
              Move workspace…
            </button>
            <button
              type="button"
              className="secondary btn-icon"
              onClick={() => void backupWorkspaceToZip()}>
              <span className="material-symbols-outlined" aria-hidden>
                archive
              </span>
              Backup workspace…
            </button>
            <button
              type="button"
              className="secondary btn-icon"
              onClick={() => void clearStoredPassword()}>
              <span className="material-symbols-outlined" aria-hidden>
                key_off
              </span>
              Clear saved password
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
