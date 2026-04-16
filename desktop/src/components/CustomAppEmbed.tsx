import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { dirname, join } from '@tauri-apps/api/path';
import { patchWorkspaceAppBundleAbsolutePaths } from '../lib/patchWorkspaceAppBundleAbsolutePaths';
import {
  rewriteEmbeddedBundleHtml,
  stripOdeDesktopInjection,
} from '../lib/rewriteEmbeddedBundleHtml';
import { tauriClient } from '../lib/tauriClient';

/** Matches Formulus: custom app entry under the extracted bundle (see `HomeScreen.tsx`). */
const CUSTOM_APP_INDEX_REL = 'bundles/active/app/index.html';

/** Shell app origin (Vite / Tauri window), not the asset protocol — required so `formulus-injection.js` loads from `public/`. */
function shellFormulusInjectionUrl(): string {
  const base = import.meta.env.BASE_URL;
  const baseUrl = base.endsWith('/')
    ? `${window.location.origin}${base}`
    : `${window.location.origin}${base}/`;
  return new URL('formulus-injection.js', baseUrl).href;
}

/**
 * Injects `ReactNativeWebView` + `formulus-injection.js` (same contract as Formulus mobile).
 * Custom apps do not receive `FormInitData` via `onFormInit` (unlike embedded formplayer).
 */
function buildHostStub(): string {
  const injectionUrl = shellFormulusInjectionUrl();
  const esc = injectionUrl.replace(/"/g, '&quot;');
  return (
    '<script>' +
    '(function(){' +
    'window.ReactNativeWebView={postMessage:function(m){' +
    'var raw=typeof m==="string"?m:JSON.stringify(m);' +
    'if(window.parent&&window.parent!==window){window.parent.postMessage(raw,"*");}' +
    '}};})();' +
    '</script>' +
    `<script src="${esc}"></script>`
  );
}

function injectIntoHead(
  html: string,
  inject: string,
  baseHref: string,
): string {
  const baseTag = `<base href="${baseHref.replace(/"/g, '&quot;')}">`;
  const wrapped = `<!--ode-desktop-inject-start-->${baseTag}${inject}<!--ode-desktop-inject-end-->`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, m => `${m}${wrapped}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, m => `${m}<head>${wrapped}</head>`);
  }
  return `<!DOCTYPE html><html><head>${baseHref ? wrapped : ''}</head><body>${html}</body></html>`;
}

export type CustomAppEmbedProps = {
  /** Change when the active bundle (or profile) changes to reload the iframe. */
  mountKey: string;
};

/**
 * Loads bundles/active/app/index.html, injects the Formulus bridge, writes merged HTML
 * back to disk, and loads the iframe via convertFileSrc (real asset document URL).
 *
 * A blob: document can resolve subresources against the parent origin instead of the
 * the asset tree; loading the actual index.html from the asset protocol fixes 404s.
 *
 * Patches: rewriteEmbeddedBundleHtml + patchWorkspaceAppBundleAbsolutePaths (idempotent).
 */
export const CustomAppEmbed = forwardRef<
  HTMLIFrameElement,
  CustomAppEmbedProps
>(function CustomAppEmbed({ mountKey }, ref) {
  const innerRef = useRef<HTMLIFrameElement | null>(null);
  const setRefs = useCallback(
    (el: HTMLIFrameElement | null) => {
      (innerRef as MutableRefObject<HTMLIFrameElement | null>).current = el;
      if (typeof ref === 'function') {
        ref(el);
      } else if (ref) {
        (ref as MutableRefObject<HTMLIFrameElement | null>).current = el;
      }
    },
    [ref],
  );

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const mountBlob = useCallback(async () => {
    const el = innerRef.current;
    if (!el) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const workspace = await tauriClient.getWorkspace();
      if (!workspace) {
        throw new Error('No workspace configured for the active profile.');
      }
      const indexPath = await join(
        workspace,
        'bundles',
        'active',
        'app',
        'index.html',
      );
      const appDirPath = await dirname(indexPath);
      await patchWorkspaceAppBundleAbsolutePaths();
      let html = await tauriClient.readWorkspaceTextFile(CUSTOM_APP_INDEX_REL);
      html = stripOdeDesktopInjection(html);
      html = rewriteEmbeddedBundleHtml(html);
      const indexAssetUrl = convertFileSrc(indexPath);
      // `new URL('./', convertFileSrc(…/index.html))` resolves to `asset://localhost/`
      // (WHATWG URL + encoded path); relative script URLs then hit the wrong origin path.
      const appDirAssetUrl = convertFileSrc(appDirPath);
      const baseHref = appDirAssetUrl.endsWith('/')
        ? appDirAssetUrl
        : `${appDirAssetUrl}/`;
      const stub = buildHostStub();
      const doc = injectIntoHead(html, stub, baseHref);
      const enc = new TextEncoder();
      await tauriClient.writeWorkspaceFile(
        CUSTOM_APP_INDEX_REL,
        enc.encode(doc),
      );
      // Query busts document cache. Do not use a `#fragment` here: many SPAs use the
      // hash for routing (HashRouter or path), so `#ode-…` would break the initial route.
      const url = `${indexAssetUrl}?ode=${Date.now()}`;
      el.onload = () => {
        setLoading(false);
      };
      el.src = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void mountBlob();
  }, [mountKey, mountBlob]);

  return (
    <div className="formplayer-embed-wrap custom-app-embed-wrap">
      {error ? <p className="notice warn">{error}</p> : null}
      {loading && !error ? (
        <p className="muted">Loading custom app from active bundle…</p>
      ) : null}
      <iframe
        ref={setRefs}
        title="Custom app"
        className="formplayer-embed-frame custom-app-embed-frame"
      />
    </div>
  );
});
