/**
 * Form preview host bridge for `public/formulus-injection.js` (`FormulusInjectionScript.js`).
 *
 * ## Message coverage (sync with `FormulusInterface` / injection script)
 *
 * | Request `type` | Behavior |
 * |----------------|----------|
 * | `getVersion` | Returns `FORM_PREVIEW_FORMULUS_INTERFACE_VERSION`. |
 * | `getAvailableForms` | Lists form types from the active bundle (`listActiveBundleForms`). |
 * | `openFormplayer` | **Stub** — nested formplayer not supported in preview. |
 * | `getObservations` | Local SQLite via `listObservationsPage`. |
 * | `getObservationsByQuery` | Same + best-effort `whereClause` filter (`formulus-load.js` flattens options). |
 * | `submitObservation` / `updateObservation` | Finalize dialog (JSON export or DB). |
 * | `requestCamera` / `requestLocation` / `requestFile` / `requestAudio` / `requestQrcode` / `requestBiometric` | **Stub** — no device bridge in preview. |
 * | `launchIntent` / `callSubform` | **Stub** — not supported in preview. |
 * | `requestConnectivityStatus` / `requestSyncStatus` | **No-op** success (`result` omitted) so callers resolve. |
 * | `runLocalModel` | **Stub** — no on-device ML in preview. |
 * | `getCurrentUser` | Active profile `username` + `label` as `displayName` (from `get_settings`). |
 * | `getThemeMode` | `'system'`. |
 * | `getAttachmentUri` | `workspace/attachments/<basename>` → `file://` if file exists, else `null`. |
 * | `getAttachmentsUri` | `file://` for `attachments/` directory if it exists. |
 * | `getCustomAppUri` | Tauri asset URL for `bundles/active/` (directory of `app/`), not `file://`. |
 * | `getFormSpecsUri` | `getActiveBundleFormsFileBaseUrl()` (`bundles/active/forms`). |
 *
 * Messages **without** `messageId` (e.g. `formplayerReadyToReceiveInit` from the iframe stub) are ignored at the host.
 *
 * Unknown `type` values still receive `{ type: <type>_response, messageId, error }` so the iframe never hangs.
 */

import { convertFileSrc } from '@tauri-apps/api/core';
import { dirname, join } from '@tauri-apps/api/path';
import { tauriClient } from './tauriClient';
import type { ObservationRecord } from '../types/domain';

/** Matches `FORMULUS_INTERFACE_VERSION` in formplayer (`FormulusInterfaceDefinition.ts`). */
export const FORM_PREVIEW_FORMULUS_INTERFACE_VERSION = '1.2.1';

/** Prefix for stub `error` strings so logs and issues are easy to grep. */
export const DESKTOP_FORM_PREVIEW_PREFIX = 'ODE Desktop form preview';

/**
 * Every `type` sent by `desktop/public/formulus-injection.js` that uses `messageId` + `*_response`.
 * Keep in sync when regenerating the injection script from Formulus.
 */
export const FORMULUS_INJECTION_REQUEST_TYPES = [
  'getVersion',
  'getAvailableForms',
  'openFormplayer',
  'getObservations',
  'getObservationsByQuery',
  'submitObservation',
  'updateObservation',
  'requestCamera',
  'requestLocation',
  'requestFile',
  'launchIntent',
  'callSubform',
  'requestAudio',
  'requestQrcode',
  'requestBiometric',
  'requestConnectivityStatus',
  'requestSyncStatus',
  'runLocalModel',
  'getCurrentUser',
  'getThemeMode',
  'getAttachmentUri',
  'getAttachmentsUri',
  'getCustomAppUri',
  'getFormSpecsUri',
] as const;

export type FinalizeRequest =
  | { kind: 'submit'; formType: string; finalData: Record<string, unknown> }
  | {
      kind: 'update';
      observationId: string;
      formType: string;
      finalData: Record<string, unknown>;
    };

export function postFormplayerBridgeReply(
  iframe: HTMLIFrameElement | null,
  requestType: string,
  messageId: string,
  payload: { result?: unknown; error?: string },
): void {
  const responseType = `${requestType}_response`;
  iframe?.contentWindow?.postMessage(
    JSON.stringify({ type: responseType, messageId, ...payload }),
    '*',
  );
}

function stubReason(detail: string): { error: string } {
  return {
    error: `${DESKTOP_FORM_PREVIEW_PREFIX}: ${detail}`,
  };
}

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.').filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) {
      return undefined;
    }
    if (typeof cur !== 'object') {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** Best-effort filter for `data.*` equality clauses (same shape as mobile SQL WHERE). */
function filterRowsByWhereClause(
  rows: ObservationRecord[],
  whereClause: string | null | undefined,
): ObservationRecord[] {
  if (!whereClause || !whereClause.trim()) {
    return rows;
  }
  const parts = whereClause.split(/\s+AND\s+/i).map(s => s.trim()).filter(Boolean);
  return rows.filter(row => {
    const data =
      row.payload &&
      typeof row.payload === 'object' &&
      !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};
    return parts.every(part => {
      const m = part.match(
        /^data\.([\w.]+)\s*=\s*'((?:[^'\\]|\\.)*)'$/,
      );
      if (!m) {
        return true;
      }
      const fieldPath = m[1];
      const rawVal = m[2].replace(/\\'/g, "'");
      const got = getByPath(data, fieldPath);
      return String(got ?? '') === rawVal;
    });
  });
}

export function mapObservationToFormObservation(
  r: ObservationRecord,
): Record<string, unknown> {
  const data =
    r.payload &&
    typeof r.payload === 'object' &&
    !Array.isArray(r.payload)
      ? (r.payload as Record<string, unknown>)
      : {};
  const created = r.extras?.createdAt ?? r.lastSavedAt;
  const updated = r.updatedAt ?? r.lastSavedAt;
  const synced = r.extras?.syncedAt ?? r.updatedAt ?? r.lastSavedAt;
  return {
    observationId: r.id,
    createdAt: new Date(created ?? r.lastSavedAt),
    updatedAt: new Date(updated ?? r.lastSavedAt),
    syncedAt: new Date(synced ?? r.lastSavedAt),
    isDraft: false,
    deleted: r.extras?.deleted === true,
    formType: r.formType ?? '',
    formVersion: r.extras?.formVersion ?? '',
    data,
  };
}

export type FormPreviewBridgeContext = {
  iframe: HTMLIFrameElement | null;
  onFinalize: (
    request: FinalizeRequest,
  ) => Promise<{ result?: string; error?: string }>;
  /**
   * When set (Workbench custom app), `openFormplayer` navigates to Form preview instead
   * of stubbing. The Promise still resolves immediately with `cancelled` — full
   * `submitObservation`/`updateObservation` completion in Form preview is not yet wired
   * back to this Promise.
   */
  onOpenFormplayerNavigate?: (payload: {
    formType: string;
    params: Record<string, unknown>;
    savedData: Record<string, unknown>;
  }) => void;
};

export async function handleFormPreviewBridgeMessage(
  raw: unknown,
  ctx: FormPreviewBridgeContext,
): Promise<void> {
  let data: Record<string, unknown>;
  try {
    data =
      typeof raw === 'string'
        ? (JSON.parse(raw) as Record<string, unknown>)
        : (raw as Record<string, unknown>);
  } catch {
    return;
  }
  const t = data.type;
  if (typeof t !== 'string') {
    return;
  }
  const messageId = data.messageId;
  if (typeof messageId !== 'string' || !messageId) {
    return;
  }

  const reply = (requestType: string, payload: { result?: unknown; error?: string }) =>
    postFormplayerBridgeReply(ctx.iframe, requestType, messageId, payload);

  try {
    switch (t) {
      case 'getVersion':
        reply('getVersion', { result: FORM_PREVIEW_FORMULUS_INTERFACE_VERSION });
        return;

      case 'getAvailableForms': {
        const rows = await tauriClient.listActiveBundleForms();
        const result = rows.map(r => ({
          formType: r.formType,
          name: r.formType,
          version: '',
          coreFields: [] as string[],
          auxiliaryFields: [] as string[],
        }));
        reply('getAvailableForms', { result });
        return;
      }

      case 'openFormplayer': {
        const formType = String(data.formType ?? '');
        const params = (data.params ?? {}) as Record<string, unknown>;
        const savedData = (data.savedData ?? {}) as Record<string, unknown>;
        if (ctx.onOpenFormplayerNavigate) {
          ctx.onOpenFormplayerNavigate({ formType, params, savedData });
          reply('openFormplayer', {
            result: {
              status: 'cancelled',
              formType,
              message:
                'ODE Desktop opened Form preview in the workbench. The Promise resolves immediately; full completion is not wired back to the custom app yet.',
            },
          });
          return;
        }
        reply(
          'openFormplayer',
          stubReason(
            'openFormplayer is not supported in form preview (you are already inside formplayer).',
          ),
        );
        return;
      }

      case 'getObservations': {
        const formType = String(data.formType ?? '');
        const includeDeleted = Boolean(data.includeDeleted);
        const page = await tauriClient.listObservationsPage(undefined, {
          formType,
          limit: 5000,
          offset: 0,
        });
        let rows = page.rows;
        if (!includeDeleted) {
          rows = rows.filter(r => r.extras?.deleted !== true);
        }
        reply('getObservations', {
          result: rows.map(mapObservationToFormObservation),
        });
        return;
      }

      case 'getObservationsByQuery': {
        const formType = String(data.formType ?? '');
        const includeDeleted = Boolean(data.includeDeleted);
        const whereClause = data.whereClause as string | null | undefined;
        const page = await tauriClient.listObservationsPage(undefined, {
          formType,
          limit: 5000,
          offset: 0,
        });
        let rows = page.rows;
        if (!includeDeleted) {
          rows = rows.filter(r => r.extras?.deleted !== true);
        }
        rows = filterRowsByWhereClause(rows, whereClause ?? null);
        reply('getObservationsByQuery', {
          result: rows.map(mapObservationToFormObservation),
        });
        return;
      }

      case 'submitObservation': {
        const formType = String(data.formType ?? '');
        const finalData = (data.finalData ?? {}) as Record<string, unknown>;
        const res = await ctx.onFinalize({ kind: 'submit', formType, finalData });
        reply('submitObservation', res);
        return;
      }

      case 'updateObservation': {
        const observationId = String(data.observationId ?? '');
        const formType = String(data.formType ?? '');
        const finalData = (data.finalData ?? {}) as Record<string, unknown>;
        const res = await ctx.onFinalize({
          kind: 'update',
          observationId,
          formType,
          finalData,
        });
        reply('updateObservation', res);
        return;
      }

      case 'requestCamera':
        reply(
          'requestCamera',
          stubReason('Camera is not available in ODE Desktop form preview.'),
        );
        return;

      case 'requestLocation':
        reply(
          'requestLocation',
          stubReason('GPS / location is not available in ODE Desktop form preview.'),
        );
        return;

      case 'requestFile':
        reply(
          'requestFile',
          stubReason('Native file picker is not wired in ODE Desktop form preview.'),
        );
        return;

      case 'launchIntent':
        reply(
          'launchIntent',
          stubReason('launchIntent is not supported in ODE Desktop form preview.'),
        );
        return;

      case 'callSubform':
        reply(
          'callSubform',
          stubReason('callSubform is not supported in ODE Desktop form preview.'),
        );
        return;

      case 'requestAudio':
        reply(
          'requestAudio',
          stubReason('Audio recording is not available in ODE Desktop form preview.'),
        );
        return;

      case 'requestQrcode':
        reply(
          'requestQrcode',
          stubReason('QR scanning is not available in ODE Desktop form preview.'),
        );
        return;

      case 'requestBiometric':
        reply(
          'requestBiometric',
          stubReason('Biometric auth is not available in ODE Desktop form preview.'),
        );
        return;

      case 'requestConnectivityStatus':
        reply('requestConnectivityStatus', {});
        return;

      case 'requestSyncStatus':
        reply('requestSyncStatus', {});
        return;

      case 'runLocalModel':
        reply(
          'runLocalModel',
          stubReason('runLocalModel is not available in ODE Desktop form preview.'),
        );
        return;

      case 'getCurrentUser': {
        try {
          const settings = await tauriClient.getSettings();
          const active = settings.profiles.find(
            p => p.id === settings.activeProfileId,
          );
          const username = (active?.username ?? '').trim();
          const label = (active?.label ?? '').trim();
          reply('getCurrentUser', {
            result: {
              username,
              ...(label ? { displayName: label } : {}),
            },
          });
        } catch (e) {
          reply('getCurrentUser', {
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }

      case 'getThemeMode':
        reply('getThemeMode', { result: 'system' });
        return;

      case 'getAttachmentUri': {
        const fileName = String(data.fileName ?? '');
        try {
          const url = await tauriClient.workspaceAttachmentFileUrl(fileName);
          reply('getAttachmentUri', { result: url });
        } catch (e) {
          reply('getAttachmentUri', {
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }

      case 'getAttachmentsUri': {
        try {
          const url = await tauriClient.workspaceDirectoryFileUrl('attachments');
          reply('getAttachmentsUri', { result: url });
        } catch (e) {
          reply('getAttachmentsUri', {
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }

      case 'getCustomAppUri': {
        try {
          const ws = await tauriClient.getWorkspace();
          if (!ws) {
            reply('getCustomAppUri', { error: 'No workspace configured.' });
            return;
          }
          const appDirPath = await join(ws, 'bundles', 'active', 'app');
          const activeBundlePath = await dirname(appDirPath);
          const u = convertFileSrc(activeBundlePath);
          const url = u.endsWith('/') ? u : `${u}/`;
          reply('getCustomAppUri', { result: url });
        } catch (e) {
          reply('getCustomAppUri', {
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }

      case 'getFormSpecsUri': {
        try {
          const url = await tauriClient.getActiveBundleFormsFileBaseUrl();
          reply('getFormSpecsUri', { result: url });
        } catch (e) {
          reply('getFormSpecsUri', {
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }

      default:
        reply(t, {
          error: `${DESKTOP_FORM_PREVIEW_PREFIX}: unhandled message type "${t}" (regenerate FORMULUS_INJECTION_REQUEST_TYPES or add a case).`,
        });
    }
  } catch (e) {
    reply(t, {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
