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

/**
 * When `public/formplayer_dist/index.html` is missing, the Vite dev server can fall
 * back to the desktop `index.html`, which loads the full shell (sidebar) inside the
 * iframe — looks like “main navigation inside Form preview”.
 */
function assertFormplayerIndexHtml(html: string): void {
  if (
    /<title>\s*Custodian\s*<\/title>/i.test(html) ||
    html.includes('/src/main.tsx')
  ) {
    throw new Error(
      'formplayer_dist/index.html is missing or the dev server returned the desktop app HTML instead of the Formplayer bundle. Run pnpm copy:formplayer from desktop/ or npm run build:ode-desktop from formulus-formplayer.',
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
      el.removeAttribute('src');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(FORMSPLAYER_INDEX);
      if (!res.ok) {
        throw new Error(
          `Missing formplayer build (${res.status}). Run: pnpm copy:formplayer`,
        );
      }
      let html = await res.text();
      assertFormplayerIndexHtml(html);
      const baseHref = new URL(
        'formplayer_dist/',
        window.location.href,
      ).toString();
      const initJson = JSON.stringify(formInitData);
      const stub = `<script>
(function(){
  var MIN = ${initJson};
  window.ReactNativeWebView = {
    postMessage: function(m) {
      var raw = typeof m === 'string' ? m : JSON.stringify(m);
      try {
        var p = typeof m === 'string' ? JSON.parse(m) : m;
        if (p && p.type === 'formplayerReadyToReceiveInit') {
          queueMicrotask(function() {
            if (typeof window.onFormInit === 'function') {
              window.onFormInit(MIN);
            }
          });
        }
      } catch (e) {}
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(raw, '*');
      }
    }
  };
})();
</script>
<script src="${INJECTION_SCRIPT}"></script>`;
      html = html.replace(
        /<head[^>]*>/i,
        match => `${match}<base href="${baseHref}">${stub}`,
      );
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      el.onload = () => {
        URL.revokeObjectURL(url);
        setLoading(false);
      };
      el.src = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }, [formInitData]);

  useEffect(() => {
    void mountBlob();
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
