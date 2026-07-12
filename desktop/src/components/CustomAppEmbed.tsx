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
import { buildDevicePixelRatioInjectionScript } from '../lib/devicePixelRatioStub';
import {
  rewriteEmbeddedBundleHtml,
  stripOdeDesktopInjection,
} from '../lib/rewriteEmbeddedBundleHtml';
import { tauriClient } from '../lib/tauriClient';
import { WORKSPACE_BUNDLE_DEV_APP_INDEX } from '../lib/workspacePaths';

/** Matches Formulus: custom app entry under the extracted bundle (see `HomeScreen.tsx`). */
export const CUSTOM_APP_BUNDLE_INDEX_REL = 'bundles/active/app/index.html';

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
function buildHostStub(devicePixelRatio = 1): string {
  const injectionUrl = shellFormulusInjectionUrl();
  const esc = injectionUrl.replace(/"/g, '&quot;');
  const dprStub = buildDevicePixelRatioInjectionScript(devicePixelRatio);
  return (
    dprStub +
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

export type CustomAppEmbedMode = 'bundle' | 'developer';

export type CustomAppEmbedProps = {
  /** Change when the active source (bundle, dev mirror, or profile) changes to reload the iframe. */
  mountKey: string;
  mode: CustomAppEmbedMode;
  /** Workspace-relative path to `index.html`; defaults from {@link mode}. */
  indexRelativePath?: string;
  loadingLabel?: string;
  /** Fired when the iframe document loads (bridge routing in WebView2). */
  onContentWindowReady?: (contentWindow: Window | null) => void;
  /** When true, iframe fills its parent (device frame) instead of flex-growing in the panel. */
  fillFrame?: boolean;
  /** Simulated `window.devicePixelRatio` inside the iframe (1 = desktop default). */
  devicePixelRatio?: number;
};

function defaultIndexRelativePath(mode: CustomAppEmbedMode): string {
  return mode === 'developer'
    ? WORKSPACE_BUNDLE_DEV_APP_INDEX
    : CUSTOM_APP_BUNDLE_INDEX_REL;
}

/**
 * Loads a workspace `index.html`, injects the Formulus bridge, writes merged HTML
 * back to disk, and loads the iframe via convertFileSrc (real asset document URL).
 *
 * A blob: document can resolve subresources against the parent origin instead of the
 * the asset tree; loading the actual index.html from the asset protocol fixes 404s.
 *
 * Patches: rewriteEmbeddedBundleHtml + patchWorkspaceAppBundleAbsolutePaths (bundle mode only).
 */
export const CustomAppEmbed = forwardRef<
  HTMLIFrameElement,
  CustomAppEmbedProps
>(function CustomAppEmbed(
  {
    mountKey,
    mode,
    indexRelativePath,
    loadingLabel,
    onContentWindowReady,
    fillFrame = false,
    devicePixelRatio = 1,
  },
  ref,
) {
  const innerRef = useRef<HTMLIFrameElement | null>(null);
  const onContentWindowReadyRef = useRef(onContentWindowReady);
  onContentWindowReadyRef.current = onContentWindowReady;
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

  const indexRel = indexRelativePath ?? defaultIndexRelativePath(mode);

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
      const indexPath = await join(workspace, ...indexRel.split('/'));
      const appDirPath = await dirname(indexPath);
      if (mode === 'bundle') {
        await patchWorkspaceAppBundleAbsolutePaths();
      }
      let html = await tauriClient.readWorkspaceTextFile(indexRel);
      html = stripOdeDesktopInjection(html);
      html = rewriteEmbeddedBundleHtml(html);
      const indexAssetUrl = convertFileSrc(indexPath);
      // `new URL('./', convertFileSrc(…/index.html))` resolves to `asset://localhost/`
      // (WHATWG URL + encoded path); relative script URLs then hit the wrong origin path.
      const appDirAssetUrl = convertFileSrc(appDirPath);
      const baseHref = appDirAssetUrl.endsWith('/')
        ? appDirAssetUrl
        : `${appDirAssetUrl}/`;
      const stub = buildHostStub(devicePixelRatio);
      const doc = injectIntoHead(html, stub, baseHref);
      const enc = new TextEncoder();
      await tauriClient.writeWorkspaceFile(indexRel, enc.encode(doc));
      // Query busts document cache. Do not use a `#fragment` here: many SPAs use the
      // hash for routing (HashRouter or path), so `#ode-…` would break the initial route.
      const url = `${indexAssetUrl}?ode=${Date.now()}`;
      el.onload = () => {
        onContentWindowReadyRef.current?.(el.contentWindow);
        setLoading(false);
      };
      el.src = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }, [indexRel, mode, devicePixelRatio]);

  useEffect(() => {
    void mountBlob();
  }, [mountKey, mountBlob]);

  const defaultLoadingLabel =
    mode === 'developer'
      ? 'Loading custom app from developer mirror…'
      : 'Loading custom app from active bundle…';

  return (
    <div
      className={`formplayer-embed-wrap custom-app-embed-wrap${fillFrame ? ' custom-app-embed-wrap--fill' : ''}`}>
      {error ? <p className="notice warn">{error}</p> : null}
      {loading && !error ? (
        <p className="muted">{loadingLabel ?? defaultLoadingLabel}</p>
      ) : null}
      <iframe
        ref={setRefs}
        title="Custom app"
        className="formplayer-embed-frame custom-app-embed-frame"
      />
    </div>
  );
});
