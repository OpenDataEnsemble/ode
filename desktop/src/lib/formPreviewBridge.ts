/**
 * Form preview host bridge for `public/formulus-injection.js` (`FormulusInjectionScript.js`).
 *
 * ## Message coverage (sync with `FormulusInterface` / injection script)
 *
 * | Request `type` | Behavior |
 * |----------------|----------|
 * | `getVersion` | Returns `FORM_PREVIEW_FORMULUS_INTERFACE_VERSION`. |
 * | `getAvailableForms` | Lists form types from the active bundle (`listActiveBundleForms`). |
 * | `openFormplayer` | With `options.subObservationMode`, defers response and opens nested preview (when host provides hooks). Otherwise Workbench navigates or stubs. |
 * | `getObservations` | Local SQLite via `listObservationsPage`. |
 * | `getObservationsByQuery` | `query_observations` with structured `filter` AST. |
 * | `submitObservation` / `updateObservation` | Finalize dialog (JSON export or DB). |
 * | `requestCamera` / `requestLocation` / `requestFile` / `requestAudio` / `requestVideo` / `requestQrcode` / `requestBiometric` | **Stub** — no device bridge in preview. |
 * | `launchIntent` / `callSubform` | **Stub** — not supported in preview. |
 * | `requestConnectivityStatus` / `requestSyncStatus` | **No-op** success (`result` omitted) so callers resolve. |
 * | `runLocalModel` | **Stub** — no on-device ML in preview. |
 * | `getCurrentUser` | Active profile `username` + `label` as `displayName` (from `get_settings`). |
 * | `getThemeMode` | `'system'`. |
 * | `getAttachmentUri` | Basename string or `{ filename }` only; workspace lookup → `convertFileSrc` (or `null`). |
 * | `getAttachmentsUri` | `file://` for `attachments/synced/` (canonical listing; matches Formulus `getAttachmentsDirectoryFileUrl`). |
 * | `getCustomAppUri` | Tauri asset URL for `bundles/active/` or dev mirror parent when developer mode is on. |
 * | `getFormSpecsUri` | `getActiveBundleFormsFileBaseUrl()` (`bundles/active/forms` or dev mirror). |
 *
 * Messages **without** `messageId` (e.g. `formplayerReadyToReceiveInit` from the iframe stub) are ignored at the host.
 *
 * Unknown `type` values still receive `{ type: <type>_response, messageId, error }` so the iframe never hangs.
 */

import { convertFileSrc } from '@tauri-apps/api/core';
import { dirname, join } from '@tauri-apps/api/path';
import { tauriClient } from './tauriClient';
import type { ObservationRecord } from '../types/domain';

/** Preview-local sequence counters (device id stub + app scope suffix). */
const previewSequenceCounters = new Map<string, number>();

function previewAllocateSequence(
  scopeKey: string,
  options?: { startAt?: number; peek?: boolean },
): number {
  const key = `device:desktop-preview:${scopeKey.trim()}`;
  const startAt = options?.startAt ?? 1;
  const last = previewSequenceCounters.get(key) ?? startAt - 1;
  const next = last + 1;
  if (!options?.peek) {
    previewSequenceCounters.set(key, next);
  }
  return next;
}

/** Matches `FORMULUS_INTERFACE_VERSION` in formplayer (`FormulusInterfaceDefinition.ts`). */
export const FORM_PREVIEW_FORMULUS_INTERFACE_VERSION = '1.2.1';

/** Must match `formplayer-host-stub.js` — delivers `*_response` to pending Formulus promises in iframes. */
export const FORMPLAYER_BRIDGE_RESPONSE_CHANNEL =
  'ode-formplayer-bridge-response';

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
  'requestVideo',
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
  'allocateSequence',
] as const;

export type FinalizeRequest =
  | { kind: 'submit'; formType: string; finalData: Record<string, unknown> }
  | {
      kind: 'update';
      observationId: string;
      formType: string;
      finalData: Record<string, unknown>;
    };

/** Payload when formplayer requests a nested sub-observation session (`openFormplayer` + `subObservationMode`). */
export type FormPreviewDeferOpenSubObservationPayload = {
  parentIframe: HTMLIFrameElement;
  /** Parent formplayer `contentWindow` from the bridge message (`event.source`). */
  parentContentWindow: Window | null;
  messageId: string;
  formType: string;
  params: Record<string, unknown>;
  savedData: Record<string, unknown>;
  skipFinalize?: boolean;
  skipDraftSelection?: boolean;
};

export type FormPreviewBridgeContext = {
  iframe: HTMLIFrameElement | null;
  /**
   * Maps `postMessage` event source to the iframe that should receive `*_response`.
   * When omitted, replies go to {@link iframe} (legacy single-embed hosts).
   */
  resolveReplyIframe?: (eventSource: Window) => HTMLIFrameElement | null;
  onFinalize: (
    request: FinalizeRequest,
  ) => Promise<{ result?: string; error?: string }>;
  /**
   * When set (Workbench custom app), `openFormplayer` navigates to Form preview instead
   * of stubbing. Ignored when `options.subObservationMode` and {@link onDeferOpenSubObservation} are used.
   */
  onOpenFormplayerNavigate?: (payload: {
    formType: string;
    params: Record<string, unknown>;
    savedData: Record<string, unknown>;
  }) => void;
  /**
   * Form preview: defer `openFormplayer_response` until nested finalize/cancel.
   * Host must not reply synchronously for this message id.
   */
  onDeferOpenSubObservation?: (
    payload: FormPreviewDeferOpenSubObservationPayload,
  ) => void;
  /**
   * When finalize originates from the nested sub-observation iframe, return the bridge
   * reply payload for `submitObservation` / `updateObservation` without showing the finalize dialog,
   * and complete the parent's deferred `openFormplayer` promise separately.
   */
  tryCompleteNestedSubObservationFinalize?: (
    eventSource: Window,
    request: FinalizeRequest,
  ) => Promise<{ result?: string; error?: string } | null>;
};

function resolveBridgeReplyIframe(
  eventSource: Window | null | undefined,
  ctx: FormPreviewBridgeContext,
): HTMLIFrameElement | null {
  const primary = ctx.iframe;
  if (eventSource != null && typeof ctx.resolveReplyIframe === 'function') {
    const resolved = ctx.resolveReplyIframe(eventSource);
    if (resolved) {
      return resolved;
    }
    if (primary?.contentWindow === eventSource) {
      return primary;
    }
    return null;
  }
  if (
    eventSource != null &&
    primary?.contentWindow != null &&
    primary.contentWindow === eventSource
  ) {
    return primary;
  }
  return primary;
}

function buildBridgeResponseBody(
  requestType: string,
  messageId: string,
  payload: { result?: unknown; error?: string },
): Record<string, unknown> {
  return { type: `${requestType}_response`, messageId, ...payload };
}

export function postFormplayerBridgeReply(
  iframe: HTMLIFrameElement | null,
  requestType: string,
  messageId: string,
  payload: { result?: unknown; error?: string },
  /** Prefer a window captured on iframe load (srcdoc / WebView2). */
  targetWindow?: Window | null,
): void {
  const body = buildBridgeResponseBody(requestType, messageId, payload);
  const serialized = JSON.stringify(body);
  const win = targetWindow ?? iframe?.contentWindow ?? null;

  if (win) {
    try {
      const deliver = (
        win as Window & {
          __odeFormplayerDeliverBridgeResponse?: (
            requestType: string,
            messageId: string,
            payload: { result?: unknown; error?: string },
          ) => void;
        }
      ).__odeFormplayerDeliverBridgeResponse;
      if (typeof deliver === 'function') {
        deliver(requestType, messageId, payload);
      }
    } catch {
      // cross-origin or inaccessible — fall back below
    }

    try {
      win.postMessage(serialized, '*');
    } catch {
      // ignore — BroadcastChannel may still reach the iframe
    }
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(FORMPLAYER_BRIDGE_RESPONSE_CHANNEL);
      channel.postMessage(body);
      channel.close();
    }
  } catch {
    // optional fallback
  }
}

function stubReason(detail: string): { error: string } {
  return {
    error: `${DESKTOP_FORM_PREVIEW_PREFIX}: ${detail}`,
  };
}

/** Map `file:///…` to a filesystem path suitable for {@link convertFileSrc} (Linux + Windows). */
function fileUrlToLocalPath(fileUrl: string): string {
  const url = new URL(fileUrl);
  let pathname = decodeURIComponent(url.pathname.replace(/\+/g, ' '));
  if (/^\/[A-Za-z]:\//.test(pathname)) {
    pathname = pathname.slice(1);
  }
  return pathname;
}

/** Paths that cannot be loaded inside the desktop WebView (other host / mobile app dirs). */
function isForeignDeviceFileUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes('/data/user/') ||
    u.includes('org.opendataensemble.formulus') ||
    u.includes('/var/mobile/') ||
    u.includes('/application/')
  );
}

/** Raw `file://` URLs are blocked for `<img src>` inside the formplayer iframe; use asset protocol. */
function attachmentFileUrlForWebview(raw: string | null): string | null {
  if (raw == null) {
    return null;
  }
  if (!raw.startsWith('file://')) {
    return raw;
  }
  if (isForeignDeviceFileUrl(raw)) {
    return null;
  }
  try {
    return convertFileSrc(fileUrlToLocalPath(raw));
  } catch {
    return null;
  }
}

async function resolveAttachmentUriForFormPreview(
  fileRef: string | { filename?: string },
): Promise<string | null> {
  if (typeof fileRef === 'string') {
    const raw = await tauriClient.workspaceAttachmentFileUrl(fileRef);
    return attachmentFileUrlForWebview(raw);
  }
  const fname =
    typeof fileRef.filename === 'string' ? fileRef.filename.trim() : '';
  if (!fname) {
    return null;
  }
  try {
    const raw = await tauriClient.workspaceAttachmentFileUrl(fname);
    return attachmentFileUrlForWebview(raw);
  } catch {
    return null;
  }
}

export function mapObservationToFormObservation(
  r: ObservationRecord,
): Record<string, unknown> {
  const payload =
    r.payload && typeof r.payload === 'object' && !Array.isArray(r.payload)
      ? (r.payload as Record<string, unknown>)
      : {};
  const nestedData = payload.data;
  const data =
    nestedData && typeof nestedData === 'object' && !Array.isArray(nestedData)
      ? (nestedData as Record<string, unknown>)
      : payload;
  const created = r.extras?.createdAt ?? r.lastSavedAt;
  const updated = r.updatedAt ?? r.lastSavedAt;
  const synced = r.extras?.syncedAt ?? r.updatedAt ?? r.lastSavedAt;
  const tags = r.extras?.tags;
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
    ...(tags != null && tags.length > 0 ? { tags } : {}),
  };
}

export async function handleFormPreviewBridgeMessage(
  rawOrEvent: MessageEvent | unknown,
  ctx: FormPreviewBridgeContext,
): Promise<void> {
  let raw: unknown;
  let eventSource: Window | null | undefined;

  if (
    typeof globalThis.MessageEvent !== 'undefined' &&
    rawOrEvent instanceof globalThis.MessageEvent
  ) {
    raw = rawOrEvent.data;
    eventSource = rawOrEvent.source as Window | null;
  } else {
    raw = rawOrEvent;
    eventSource = ctx.iframe?.contentWindow ?? undefined;
  }

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

  const replyIframe = resolveBridgeReplyIframe(eventSource, ctx);
  const reply = (
    requestType: string,
    payload: { result?: unknown; error?: string },
  ) => postFormplayerBridgeReply(replyIframe, requestType, messageId, payload);

  try {
    switch (t) {
      case 'getVersion':
        reply('getVersion', {
          result: FORM_PREVIEW_FORMULUS_INTERFACE_VERSION,
        });
        return;

      case 'allocateSequence': {
        const scopeKey =
          typeof data.scopeKey === 'string'
            ? data.scopeKey
            : typeof data.payload === 'string'
              ? data.payload
              : '';
        const startAt =
          typeof data.startAt === 'number' ? data.startAt : undefined;
        const peek = Boolean(data.peek);
        const result = previewAllocateSequence(scopeKey, { startAt, peek });
        reply('allocateSequence', { result });
        return;
      }

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
        const options = data.options as
          | {
              subObservationMode?: boolean;
              skipFinalize?: boolean;
              skipDraftSelection?: boolean;
            }
          | undefined;
        const subObservationMode = Boolean(options?.subObservationMode);

        if (subObservationMode && ctx.onDeferOpenSubObservation) {
          const parentIframe = resolveBridgeReplyIframe(eventSource, ctx);
          if (parentIframe) {
            ctx.onDeferOpenSubObservation({
              parentIframe,
              parentContentWindow:
                eventSource != null && typeof eventSource === 'object'
                  ? (eventSource as Window)
                  : null,
              messageId,
              formType,
              params,
              savedData,
              skipFinalize: options?.skipFinalize,
              skipDraftSelection: options?.skipDraftSelection,
            });
            return;
          }
          reply(
            'openFormplayer',
            stubReason(
              'Could not identify the parent formplayer iframe for nested sub-observation open.',
            ),
          );
          return;
        }

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
        const options = (data.options ?? data) as Record<string, unknown>;
        const formType = String(options.formType ?? data.formType ?? '');
        const includeDeleted = Boolean(
          options.includeDeleted ?? data.includeDeleted,
        );
        const filter = options.filter ?? data.filter;
        const limit =
          typeof options.limit === 'number' ? options.limit : undefined;
        const rows = await tauriClient.queryObservations({
          formType,
          includeDeleted,
          filter,
          limit,
        });
        reply('getObservationsByQuery', {
          result: rows.map(mapObservationToFormObservation),
        });
        return;
      }

      case 'submitObservation': {
        const formType = String(data.formType ?? '');
        const finalData = (data.finalData ?? {}) as Record<string, unknown>;
        const req: FinalizeRequest = {
          kind: 'submit',
          formType,
          finalData,
        };
        if (
          eventSource != null &&
          typeof ctx.tryCompleteNestedSubObservationFinalize === 'function'
        ) {
          const nested = await ctx.tryCompleteNestedSubObservationFinalize(
            eventSource,
            req,
          );
          if (nested != null) {
            reply('submitObservation', nested);
            return;
          }
        }
        const res = await ctx.onFinalize(req);
        reply('submitObservation', res);
        return;
      }

      case 'updateObservation': {
        const observationId = String(data.observationId ?? '');
        const formType = String(data.formType ?? '');
        const finalData = (data.finalData ?? {}) as Record<string, unknown>;
        const req: FinalizeRequest = {
          kind: 'update',
          observationId,
          formType,
          finalData,
        };
        if (
          eventSource != null &&
          typeof ctx.tryCompleteNestedSubObservationFinalize === 'function'
        ) {
          const nested = await ctx.tryCompleteNestedSubObservationFinalize(
            eventSource,
            req,
          );
          if (nested != null) {
            reply('updateObservation', nested);
            return;
          }
        }
        const res = await ctx.onFinalize(req);
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
          stubReason(
            'GPS / location is not available in ODE Desktop form preview.',
          ),
        );
        return;

      case 'requestFile':
        reply(
          'requestFile',
          stubReason(
            'Native file picker is not wired in ODE Desktop form preview.',
          ),
        );
        return;

      case 'launchIntent':
        reply(
          'launchIntent',
          stubReason(
            'launchIntent is not supported in ODE Desktop form preview.',
          ),
        );
        return;

      case 'callSubform':
        reply(
          'callSubform',
          stubReason(
            'callSubform is not supported in ODE Desktop form preview.',
          ),
        );
        return;

      case 'requestAudio':
        reply(
          'requestAudio',
          stubReason(
            'Audio recording is not available in ODE Desktop form preview.',
          ),
        );
        return;

      case 'requestVideo':
        reply(
          'requestVideo',
          stubReason(
            'Video recording is not available in ODE Desktop form preview.',
          ),
        );
        return;

      case 'requestQrcode':
        reply(
          'requestQrcode',
          stubReason(
            'QR scanning is not available in ODE Desktop form preview.',
          ),
        );
        return;

      case 'requestBiometric':
        reply(
          'requestBiometric',
          stubReason(
            'Biometric auth is not available in ODE Desktop form preview.',
          ),
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
          stubReason(
            'runLocalModel is not available in ODE Desktop form preview.',
          ),
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
        try {
          const ref = data.fileName ?? data.filename;
          if (ref == null) {
            reply('getAttachmentUri', { result: null });
            return;
          }
          if (typeof ref === 'string' && !ref.trim()) {
            reply('getAttachmentUri', { result: null });
            return;
          }
          if (typeof ref === 'object' && ref !== null && !Array.isArray(ref)) {
            const o = ref as Record<string, unknown>;
            const hasFn =
              typeof o.filename === 'string' && o.filename.trim() !== '';
            if (!hasFn) {
              reply('getAttachmentUri', { result: null });
              return;
            }
          }
          const result = await resolveAttachmentUriForFormPreview(ref);
          reply('getAttachmentUri', { result });
        } catch (e) {
          reply('getAttachmentUri', {
            error: e instanceof Error ? e.message : String(e),
          });
        }
        return;
      }

      case 'getAttachmentsUri': {
        try {
          const url =
            await tauriClient.workspaceDirectoryFileUrl('attachments/synced');
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
          const settings = await tauriClient.getSettings();
          const active = settings.profiles.find(
            p => p.id === settings.activeProfileId,
          );
          const useDevMirror = Boolean(active?.customAppDeveloperMode);
          const bundleSegment = useDevMirror ? 'dev-local' : 'active';
          const appDirPath = await join(ws, 'bundles', bundleSegment, 'app');
          const bundleBasePath = await dirname(appDirPath);
          const u = convertFileSrc(bundleBasePath);
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
