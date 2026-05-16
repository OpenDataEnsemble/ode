import { useEffect } from 'react';
import { useDeveloperMode } from '../hooks/useDeveloperMode';
import { useCustodianStore } from '../store/useCustodianStore';

export type DeveloperModePanelProps = {
  variant: 'full' | 'banner';
};

function DevModeToggle({
  developerMode,
  disabled,
  onSetDeveloperMode,
}: {
  developerMode: boolean;
  disabled: boolean;
  onSetDeveloperMode: (enabled: boolean) => void;
}) {
  return (
    <div className="dev-mode-toggle" role="group" aria-label="Developer mode">
      <span className="dev-mode-toggle-label">Developer mode</span>
      <button
        type="button"
        className={`dev-mode-toggle-btn${!developerMode ? ' dev-mode-toggle-btn-active' : ''}`}
        aria-pressed={!developerMode}
        disabled={disabled}
        onClick={() => onSetDeveloperMode(false)}>
        Off
      </button>
      <button
        type="button"
        className={`dev-mode-toggle-btn${developerMode ? ' dev-mode-toggle-btn-active dev-mode-toggle-btn-on' : ''}`}
        aria-pressed={developerMode}
        disabled={disabled}
        onClick={() => onSetDeveloperMode(true)}>
        On
      </button>
    </div>
  );
}

export function DeveloperModePanel({ variant }: DeveloperModePanelProps) {
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
    if (variant !== 'full') {
      return;
    }
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
    variant,
    developerMode,
    localFolder,
    activeProfile?.id,
    refreshDevMirror,
    setDevError,
  ]);

  if (variant === 'banner') {
    return (
      <div
        className="dev-mode-banner notice dev-mode-panel-active"
        role="status"
        aria-live="polite">
        <div className="dev-mode-banner-body">
          <strong>Developer mode active</strong>
          <span
            className="dev-mode-banner-path"
            title={localFolder || undefined}>
            {localFolder || 'No folder configured'}
          </span>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={!localFolder || devBusy}
          onClick={() => void refreshDevApp()}>
          Refresh app
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="dev-mode-config-header">
        <h3>Developer mode</h3>
        <DevModeToggle
          developerMode={developerMode}
          disabled={!activeProfile || devBusy}
          onSetDeveloperMode={enabled => void setDeveloperMode(enabled)}
        />
      </div>

      {developerMode ? (
        <section className="card dev-mode-panel dev-mode-panel-active">
          <label
            className="dev-mode-folder-label"
            htmlFor="custom-app-local-folder">
            Developer mode active! Local custom_app folder:
          </label>
          <div className="dev-mode-folder-row">
            <input
              id="custom-app-local-folder"
              type="text"
              className="dev-mode-folder-input"
              readOnly
              value={localFolder}
              placeholder="Pick a folder that contains index.html (e.g. dist/)"
            />
            <button
              type="button"
              className="secondary"
              disabled={devBusy}
              onClick={() => void pickLocalFolder()}>
              Browse…
            </button>
            <button
              type="button"
              className="secondary"
              disabled={!localFolder || devBusy}
              onClick={() => void refreshDevApp()}>
              Refresh app
            </button>
          </div>
          <p className="muted dev-mode-hint">
            The app and forms are mirrored into your profile workspace under{' '}
            <code>bundles/dev-local/</code>. Observations and sync still use
            this profile&apos;s database. Edit forms in{' '}
            <code>&lt;folder&gt;/forms</code> and use Form preview to test.
            Downloaded bundles stay in <code>bundles/active/</code> — use
            Refresh from server above to update them.
          </p>
        </section>
      ) : null}

      {devError ? <p className="notice error">{devError}</p> : null}
      {devBusy ? (
        <p className="muted">Syncing local custom app into workspace…</p>
      ) : null}
    </>
  );
}
