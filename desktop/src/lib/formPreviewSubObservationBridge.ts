/**
 * Tracks deferred `openFormplayer` (subObservationMode) sessions in the ODE Desktop shell.
 *
 * Formulus resolves nested completion by injecting `postMessage` into the *parent* WebView.
 * ODE Desktop uses stacked srcdoc iframes; delivery must target the parent embed's live
 * `contentWindow` via {@link FormplayerEmbedHandle}, not a captured HTMLIFrameElement ref.
 */

import type { FormplayerEmbedHandle } from '../components/FormplayerEmbed';
import { postFormplayerBridgeReply } from './formPreviewBridge';

export type PendingSubObservationOpen = {
  parentMessageId: string;
  parentEmbed: FormplayerEmbedHandle | null;
  /** Parent iframe `contentWindow` captured when the nested open was deferred. */
  parentContentWindow: Window | null;
  formType: string;
};

const pendingOpens = new Map<string, PendingSubObservationOpen>();

export function registerPendingSubObservationOpen(
  entry: PendingSubObservationOpen,
): void {
  pendingOpens.set(entry.parentMessageId, entry);
}

export function dropPendingSubObservationOpen(messageId: string): void {
  pendingOpens.delete(messageId);
}

export function deliverSubObservationCompletion(
  messageId: string,
  completion: Record<string, unknown>,
): boolean {
  const entry = pendingOpens.get(messageId);
  if (!entry) {
    return false;
  }
  pendingOpens.delete(messageId);

  const payload = { result: completion };

  entry.parentEmbed?.deliverBridgeResponse(
    'openFormplayer',
    messageId,
    payload,
  );

  const send = () => {
    if (entry.parentContentWindow) {
      postFormplayerBridgeReply(
        entry.parentEmbed?.getIframe() ?? null,
        'openFormplayer',
        messageId,
        payload,
        entry.parentContentWindow,
      );
    }
  };
  send();
  queueMicrotask(send);
  requestAnimationFrame(send);
  window.setTimeout(send, 0);
  window.setTimeout(send, 50);

  return true;
}

export function deliverSubObservationCancelled(
  messageId: string,
  formType: string,
): boolean {
  return deliverSubObservationCompletion(messageId, {
    status: 'cancelled',
    formType,
  });
}

/** @internal test helper */
export function clearPendingSubObservationOpensForTests(): void {
  pendingOpens.clear();
}
