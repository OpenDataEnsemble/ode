import { useEffect } from 'react';
import { useDeveloperMode } from '../hooks/useDeveloperMode';
import { useCustodianStore } from '../store/useCustodianStore';

/** Always-visible Workbench bar: dev mode toggle + refresh when on. */
export function DeveloperModePanel() {
  const {
    activeProfile,
    developerMode,
    localFolder,
    devBusy,
    devError,
    setDeveloperMode,
    pickLocalFolder,
    refreshDevApp,
  } = useDeveloperMode();
  const refreshDevMirror = useCustodianStore(s => s.refreshDevMirror);
  const setDevError = useCustodianStore(s => s.setDevError);

  useEffect(() => {
    if (!developerMode) {
      setDevError(null);
      return;
    }
    if (!localFolder) {
      setDevError(
        'Developer mode is on but no local custom app folder is configured.',
      );
      return;
    }
    void refreshDevMirror();
  }, [
    developerMode,
    localFolder,
    activeProfile?.id,
    refreshDevMirror,
    setDevError,
  ]);

  return (
    <div
      className={`dev-mode-bar${developerMode ? ' dev-mode-bar-on' : ' dev-mode-bar-off'}`}
      role="status"
      aria-live="polite">
      <div className="dev-mode-toggle" role="group" aria-label="Developer mode">
        <span className="material-symbols-outlined" aria-hidden>
          developer_mode
        </span>
        <button
          type="button"
          className={`dev-mode-toggle-btn${!developerMode ? ' dev-mode-toggle-btn-active' : ''}`}
          aria-pressed={!developerMode}
          disabled={!activeProfile || devBusy}
          onClick={() => void setDeveloperMode(false)}>
          Off
        </button>
        <button
          type="button"
          className={`dev-mode-toggle-btn${developerMode ? ' dev-mode-toggle-btn-active dev-mode-toggle-btn-on' : ''}`}
          aria-pressed={developerMode}
          disabled={!activeProfile || devBusy}
          onClick={() => void setDeveloperMode(true)}>
          On
        </button>
      </div>
      {developerMode ? (
        <>
          <span
            className="dev-mode-banner-path muted"
            title={localFolder || undefined}>
            {localFolder || 'No folder — Browse on Bundles'}
          </span>
          <button
            type="button"
            className="secondary btn-compact"
            disabled={devBusy}
            onClick={() => void pickLocalFolder()}>
            Browse…
          </button>
        </>
      ) : (
        <span className="muted">Local custom app mirror disabled</span>
      )}
      <span className="dev-mode-bar-spacer" />
      <button
        type="button"
        className="secondary btn-compact"
        disabled={!developerMode || !localFolder || devBusy}
        onClick={() => void refreshDevApp()}>
        Refresh app
      </button>
      {devError ? (
        <span className="notice error" style={{ margin: 0, padding: '0.25rem 0.5rem' }}>
          {devError}
        </span>
      ) : null}
    </div>
  );
}
