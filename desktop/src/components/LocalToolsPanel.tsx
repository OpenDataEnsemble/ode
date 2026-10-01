import { useState } from 'react';
import { confirm } from '@tauri-apps/plugin-dialog';
import { messageFromUnknown } from '../lib/errors';
import { buildAgentPrompt, buildMcpConfig } from '../lib/localTools';
import { useLocalToolsCliPath } from '../hooks/useLocalToolsCliPath';
import { useToastStore } from '../store/useToastStore';
import {
  selectActiveProfileState,
  useCustodianStore,
} from '../store/useCustodianStore';

const DATA_ACCESS_WARNING =
  'Local tools, including AI assistants, will be able to export collected responses and attachments from this profile. If a tool uses a remote AI service, that data may leave this device.';

const AUTHORING_WARNING =
  'Local tools, including AI assistants, will be able to switch this profile to developer mode and point it at a local custom app folder. Nothing is sent to the server.';

const PUSH_WARNING =
  'Local tools, including AI assistants, will be able to publish new app bundles to the Synkronus server using your saved credentials. Published bundles reach all devices on their next sync.';

type LocalToolsPatch = {
  localToolsEnabled?: boolean;
  localToolsAllowData?: boolean;
  localToolsAllowAuthoring?: boolean;
  localToolsAllowPush?: boolean;
};

/** Profile access policy for the `ode` CLI / MCP (see desktop/docs/LOCAL_TOOLS.md). Saves immediately. */
export function LocalToolsPanel() {
  const activeProfile = useCustodianStore(selectActiveProfileState);
  const upsertProfileRemote = useCustodianStore(s => s.upsertProfileRemote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'prompt' | 'mcp' | null>(null);
  const cliPath = useLocalToolsCliPath();
  const pushToast = useToastStore(s => s.pushToast);

  if (!activeProfile) {
    return null;
  }

  const enabled = activeProfile.localToolsEnabled ?? true;
  const allowData = activeProfile.localToolsAllowData ?? false;
  const allowAuthoring = activeProfile.localToolsAllowAuthoring ?? false;
  const allowPush =
    allowAuthoring && (activeProfile.localToolsAllowPush ?? false);

  async function save(patch: LocalToolsPatch) {
    if (!activeProfile) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertProfileRemote({ ...activeProfile, ...patch });
    } catch (e) {
      setError(messageFromUnknown(e, 'Could not save local tools settings'));
    } finally {
      setBusy(false);
    }
  }

  /** Enabling a sensitive permission asks for confirmation first; disabling never does. */
  async function toggle(
    patch: LocalToolsPatch,
    next: boolean,
    title: string,
    warning: string,
  ) {
    if (next) {
      const ok = await confirm(warning, {
        title,
        kind: 'warning',
        okLabel: 'Allow',
        cancelLabel: 'Cancel',
      });
      if (!ok) {
        return;
      }
    }
    await save(patch);
  }

  async function copy(kind: 'prompt' | 'mcp') {
    if (!activeProfile) {
      return;
    }
    const text =
      kind === 'prompt'
        ? buildAgentPrompt(activeProfile, cliPath)
        : buildMcpConfig(cliPath);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      pushToast({ message: 'Could not copy to clipboard', variant: 'warn' });
    }
  }

  return (
    <div className="panel">
      <h3>Local tools</h3>
      <p className="muted">
        Controls what the <code>ode</code> command-line tool (used by AI
        assistants and editors) can access for this profile. Credentials are
        never shared.
      </p>
      <label className="field-row-checkbox">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={e => void save({ localToolsEnabled: e.target.checked })}
        />
        <span>Available to local tools (profile and form definitions)</span>
      </label>
      <label className="field-row-checkbox">
        <input
          type="checkbox"
          checked={enabled && allowData}
          disabled={busy || !enabled}
          onChange={e =>
            void toggle(
              { localToolsAllowData: e.target.checked },
              e.target.checked,
              'Allow agent access to data and attachments?',
              DATA_ACCESS_WARNING,
            )
          }
        />
        <span>Allow agent access to data and attachments</span>
      </label>
      <label className="field-row-checkbox">
        <input
          type="checkbox"
          checked={enabled && allowAuthoring}
          disabled={busy || !enabled}
          onChange={e =>
            void toggle(
              e.target.checked
                ? { localToolsAllowAuthoring: true }
                : {
                    localToolsAllowAuthoring: false,
                    localToolsAllowPush: false,
                  },
              e.target.checked,
              'Allow agents to manage the app bundle?',
              AUTHORING_WARNING,
            )
          }
        />
        <span>Allow agents to manage the app bundle (developer mode)</span>
      </label>
      <label className="field-row-checkbox">
        <input
          type="checkbox"
          checked={enabled && allowPush}
          disabled={busy || !enabled || !allowAuthoring}
          onChange={e =>
            void toggle(
              { localToolsAllowPush: e.target.checked },
              e.target.checked,
              'Allow agents to push the app bundle to Synkronus?',
              PUSH_WARNING,
            )
          }
        />
        <span>Allow agents to push the app bundle to Synkronus</span>
      </label>
      {enabled && allowData ? (
        <p className="notice warn">{DATA_ACCESS_WARNING}</p>
      ) : null}
      {enabled && allowPush ? (
        <p className="notice warn">{PUSH_WARNING}</p>
      ) : null}
      <div className="button-row">
        <button
          type="button"
          className="secondary btn-icon"
          disabled={!enabled}
          title="Copy a starting prompt that tells an AI assistant how to use the ode tool with this profile"
          onClick={() => void copy('prompt')}>
          <span className="material-symbols-outlined" aria-hidden>
            {copied === 'prompt' ? 'check' : 'content_copy'}
          </span>
          {copied === 'prompt'
            ? 'Copied'
            : 'Copy initial prompt for AI assistant'}
        </button>
        <button
          type="button"
          className="secondary btn-icon"
          disabled={!enabled}
          title="Copy the MCP server configuration for AI clients that support the Model Context Protocol (applies to all profiles)"
          onClick={() => void copy('mcp')}>
          <span className="material-symbols-outlined" aria-hidden>
            {copied === 'mcp' ? 'check' : 'hub'}
          </span>
          {copied === 'mcp' ? 'Copied' : 'Copy MCP server config'}
        </button>
      </div>
      {error ? <p className="notice error">{error}</p> : null}
    </div>
  );
}
