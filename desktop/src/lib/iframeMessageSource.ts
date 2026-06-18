/**
 * WebKit / WCO (Tauri): `MessageEvent.source` may not be strictly `===` to
 * `iframe.contentWindow`, and `instanceof Window` can be false for iframe globals.
 * `window.frameElement === iframe` identifies the embedding element reliably for same-origin frames.
 */
export function messageSourceMatchesIframe(
  source: Window,
  iframe: HTMLIFrameElement | null | undefined,
  registeredContentWindow?: Window | null,
): boolean {
  if (registeredContentWindow && source === registeredContentWindow) {
    return true;
  }
  if (!iframe) {
    return false;
  }
  try {
    if (iframe.contentWindow === source) {
      return true;
    }
    return source.frameElement === iframe;
  } catch {
    return false;
  }
}
