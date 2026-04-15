import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import type { FormInitData } from '../lib/formplayerHost';

const FORMSPLAYER_INDEX = `${import.meta.env.BASE_URL}formplayer_dist/index.html`;
const INJECTION_SCRIPT = `${import.meta.env.BASE_URL}formulus-injection.js`;
const HOST_STUB_SCRIPT = `${import.meta.env.BASE_URL}formplayer-host-stub.js`;

/**
 * When `public/formplayer_dist/index.html` is missing, the Vite dev server can fall
 * back to the desktop `index.html`, which loads the full shell (sidebar) inside the
 * iframe — looks like “main navigation inside Form preview”.
 */
function assertFormplayerIndexHtml(html: string): void {
  const looksLikeDesktopShell =
    /<title>\s*ODE Desktop\s*<\/title>/i.test(html) ||
    html.includes('href="/custodian.png"') ||
    /<script[^>]+src="\/assets\/[^"]+"/i.test(html);
  const looksLikeDevShell =
    /<title>\s*Custodian\s*<\/title>/i.test(html) ||
    html.includes('/src/main.tsx');
  const looksLikeFormplayer =
    /<title>\s*Formulus Form Player\s*<\/title>/i.test(html) ||
    html.includes('formulus-load.js');

  if (
    looksLikeDesktopShell ||
    looksLikeDevShell ||
    !looksLikeFormplayer
  ) {
    throw new Error(
      'formplayer_dist/index.html is missing or the app shell HTML was returned instead of the Formplayer bundle. Run pnpm copy:formplayer from desktop/ or npm run build:ode-desktop from formulus-formplayer.',
    );
  }
}

export type FormplayerEmbedProps = {
  /** Full `FormInitData` for the embedded formplayer; `null` shows `emptyMessage` only. */
  formInitData: FormInitData | null;
  emptyMessage?: string;
};

/**
 * Embeds production formplayer in an iframe. Injects `ReactNativeWebView` + Formulus
 * injection script (same bridge as Formulus mobile) before the bundle runs (via blob +
 * base href) so Finalize / `submitObservation` and extension APIs work.
 */
export const FormplayerEmbed = forwardRef<
  HTMLIFrameElement,
  FormplayerEmbedProps
>(function FormplayerEmbed(
  {
    formInitData,
    emptyMessage = 'Select a form type and apply params/saved JSON to load the preview.',
  },
  ref,
) {
  const innerRef = useRef<HTMLIFrameElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
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
    if (formInitData === null) {
      setLoading(false);
      setError(null);
      el.removeAttribute('srcdoc');
      el.removeAttribute('src');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      const res = await fetch(FORMSPLAYER_INDEX);
      if (!res.ok) {
        throw new Error(
          `Missing formplayer build (${res.status}). Run: pnpm copy:formplayer`,
        );
      }
      let html = await res.text();
      assertFormplayerIndexHtml(html);
      const formplayerIndexUrl = new URL(FORMSPLAYER_INDEX, window.location.href);
      const baseHref = new URL('./', formplayerIndexUrl).toString();
      const initJson = JSON.stringify(formInitData).replace(/</g, '\\u003c');
      const stub = `<!--ode-formplayer-host-stub-->
<script id="ode-formplayer-init-data" type="application/json">${initJson}</script>
<script src="${HOST_STUB_SCRIPT}"></script>
<script src="${INJECTION_SCRIPT}"></script>`;
      html = html.replace(
        /<head[^>]*>/i,
        match => `${match}<base href="${baseHref}">${stub}`,
      );
      if (!html.includes('ode-formplayer-host-stub')) {
        throw new Error('Failed to inject host bridge into formplayer HTML.');
      }
      el.onload = () => {
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setLoading(false);
      };
      // WebView2 can behave inconsistently with blob: + module scripts in packaged apps.
      // srcdoc avoids blob navigation while preserving our injected bridge + base href.
      el.srcdoc = html;
    } catch (e) {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }, [formInitData]);

  useEffect(() => {
    void mountBlob();
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [mountBlob]);

  if (formInitData === null) {
    return (
      <div className="formplayer-embed-wrap">
        <p className="muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="formplayer-embed-wrap">
      {error ? <p className="notice warn">{error}</p> : null}
      {loading && !error ? <p className="muted">Loading formplayer…</p> : null}
      <iframe
        ref={setRefs}
        title="Formplayer preview"
        className="formplayer-embed-frame"
      />
    </div>
  );
});
