import { useState } from 'react';
import { confirm } from '@tauri-apps/plugin-dialog';
import { messageFromUnknown } from '../lib/errors';
import { buildAgentPrompt } from '../lib/localTools';
import { useLocalToolsCliPath } from '../hooks/useLocalToolsCliPath';
import { useToastStore } from '../store/useToastStore';
import {
  selectActiveProfileState,
  useCustodianStore,
} from '../store/useCustodianStore';

const DATA_ACCESS_WARNING =
  'Local tools, including AI assistants, will be able to export collected responses and attachments from this profile. If a tool uses a remote AI service, that data may leave this device.';

/** Profile access policy for the `ode` CLI / MCP (see desktop/docs/LOCAL_TOOLS.md). Saves immediately. */
export function LocalToolsPanel() {
  const activeProfile = useCustodianStore(selectActiveProfileState);
  const upsertProfileRemote = useCustodianStore(s => s.upsertProfileRemote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const cliPath = useLocalToolsCliPath();
  const pushToast = useToastStore(s => s.pushToast);

  if (!activeProfile) {
    return null;
  }

  const enabled = activeProfile.localToolsEnabled ?? true;
  const allowData = activeProfile.localToolsAllowData ?? false;

  async function save(patch: {
    localToolsEnabled?: boolean;
    localToolsAllowData?: boolean;
  }) {
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

  async function setAllowData(next: boolean) {
    if (next) {
      const ok = await confirm(DATA_ACCESS_WARNING, {
        title: 'Allow agent access to data and attachments?',
        kind: 'warning',
        okLabel: 'Allow',
        cancelLabel: 'Cancel',
      });
      if (!ok) {
        return;
      }
    }
    await save({ localToolsAllowData: next });
  }

  async function copyPrompt() {
    if (!activeProfile) {
      return;
    }
    try {
      await navigator.clipboard.writeText(
        buildAgentPrompt(activeProfile, cliPath),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
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
          onChange={e => void setAllowData(e.target.checked)}
        />
        <span>Allow agent access to data and attachments</span>
      </label>
      {enabled && allowData ? (
        <p className="notice warn">{DATA_ACCESS_WARNING}</p>
      ) : null}
      <div className="button-row">
        <button
          type="button"
          className="secondary btn-icon"
          disabled={!enabled}
          title="Copy a starting prompt that tells an AI assistant how to use the ode tool with this profile"
          onClick={() => void copyPrompt()}>
          <span className="material-symbols-outlined" aria-hidden>
            {copied ? 'check' : 'content_copy'}
          </span>
          {copied ? 'Copied' : 'Copy initial prompt for AI assistant'}
        </button>
      </div>
      {error ? <p className="notice error">{error}</p> : null}
    </div>
  );
}
