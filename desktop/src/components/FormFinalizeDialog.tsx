import { save } from '@tauri-apps/plugin-dialog';
import { useCallback, useEffect, useId, useState } from 'react';
import { tauriClient } from '../lib/tauriClient';
import type { FinalizeRequest } from '../lib/formPreviewBridge';
import type { ObservationExtras } from '../types/domain';

const TESTDATA_TAG = 'Testdata';

export type FormFinalizeDialogProps = {
  open: boolean;
  request: FinalizeRequest | null;
  onComplete: (result: { result?: string; error?: string }) => void;
};

export function FormFinalizeDialog({
  open,
  request,
  onComplete,
}: FormFinalizeDialogProps) {
  const titleId = useId();
  const [tagTestdata, setTagTestdata] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTagTestdata(true);
      setBusy(false);
      setError(null);
    }
  }, [open, request]);

  const handleSaveJson = useCallback(async () => {
    if (!request) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const path = await save({
        defaultPath: 'observation.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (path === null) {
        setBusy(false);
        return;
      }
      const id =
        request.kind === 'update'
          ? request.observationId
          : crypto.randomUUID();
      const envelope = {
        observationId: id,
        formType: request.formType,
        data: request.finalData,
      };
      await tauriClient.writeTextFile(path, JSON.stringify(envelope, null, 2));
      onComplete({ result: id });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [request, onComplete]);

  const buildExtrasWithTags = useCallback(
    async (base: ObservationExtras | null | undefined) => {
      let tags = [...(base?.tags ?? [])];
      if (tagTestdata && !tags.includes(TESTDATA_TAG)) {
        tags = [...tags, TESTDATA_TAG];
      }
      if (!tagTestdata) {
        tags = tags.filter(t => t !== TESTDATA_TAG);
      }
      const next: ObservationExtras = { ...(base ?? {}) };
      if (tags.length > 0) {
        next.tags = tags;
      } else {
        delete next.tags;
      }
      return Object.keys(next).length > 0 ? next : undefined;
    },
    [tagTestdata],
  );

  const handleSaveDb = useCallback(async () => {
    if (!request) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (request.kind === 'submit') {
        const id = crypto.randomUUID();
        const extras = await buildExtrasWithTags(undefined);
        await tauriClient.saveObservation({
          id,
          payload: request.finalData,
          formType: request.formType,
          extras,
        });
        onComplete({ result: id });
      } else {
        const existing = await tauriClient.getObservation(request.observationId);
        const extras = await buildExtrasWithTags(existing.extras);
        await tauriClient.saveObservation({
          id: request.observationId,
          payload: request.finalData,
          formType: request.formType,
          extras,
        });
        onComplete({ result: request.observationId });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [request, buildExtrasWithTags, onComplete]);

  const handleCancel = useCallback(() => {
    if (busy) {
      return;
    }
    onComplete({ error: 'Cancelled' });
  }, [busy, onComplete]);

  if (!open || !request) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6, 14, 32, 0.72)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 2000,
        padding: '1rem',
      }}>
      <div
        className="card"
        style={{ maxWidth: '28rem', width: '100%', padding: '1.25rem' }}>
        <h3 id={titleId} style={{ marginTop: 0 }}>
          Save observation
        </h3>
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          Choose how to save this finalized form. You can export JSON for offline
          use, or store it in the local database for this profile.
        </p>
        <div className="button-row" style={{ marginTop: '1rem' }}>
          <button type="button" disabled={busy} onClick={() => void handleSaveJson()}>
            Save as .json file…
          </button>
        </div>
        <p
          className="notice warn"
          style={{ fontSize: '0.85rem', margin: '1rem 0 0.5rem' }}>
          Data saved to the database will be synced to the server endpoint when you
          run sync.
        </p>
        <label
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'flex-start',
            margin: '0.5rem 0 0.75rem',
            cursor: busy ? 'default' : 'pointer',
          }}>
          <input
            type="checkbox"
            checked={tagTestdata}
            disabled={busy}
            onChange={e => setTagTestdata(e.target.checked)}
          />
          <span>
            Add &quot;{TESTDATA_TAG}&quot; tag to this observation (database save
            only)
          </span>
        </label>
        {error ? (
          <p className="notice error" style={{ margin: '0.5rem 0' }}>
            {error}
          </p>
        ) : null}
        <div className="button-row" style={{ marginTop: '0.25rem' }}>
          <button type="button" disabled={busy} onClick={() => void handleSaveDb()}>
            Save to database
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
