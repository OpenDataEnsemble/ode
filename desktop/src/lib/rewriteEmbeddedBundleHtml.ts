/**
 * Vite’s default `base: '/'` emits root-absolute URLs (`/assets/...`, `/formulus-load.js`).
 * With `<base href=".../app/">` under Tauri’s asset protocol, those resolve to the asset
 * **origin** root (`https://asset.localhost/...`), not under `.../app/`, so requests 404.
 *
 * Formplayer avoids this by building with `base: './'` (`formulus-formplayer/vite.config.ts`).
 * For arbitrary bundles loaded at runtime, we rewrite the **entry HTML** here.
 *
 * **Note:** Dynamic `import()` and chunk files still contain `/assets/` until
 * {@link rewriteVendorChunkFile} runs on files under `app/assets/` (see
 * `patchWorkspaceAppBundleAbsolutePaths`).
 */
export function rewriteEmbeddedBundleHtml(html: string): string {
  let s = html;
  // href="/foo" and src="/foo" but not href="//" (protocol-relative CDNs)
  s = s.replace(/(href|src)="\/([^/"][^"]*)"/g, '$1="./$2"');
  s = s.replace(/(href|src)='\/([^/'][^']*)'/g, '$1=\'./$2\'');
  // Minified: href=/assets/x or src=/formulus-load.js (unquoted)
  s = s.replace(/\b(href|src)=(\/)(?!\/)([^\s>]+)/g, '$1=.$2$3');
  // Unquoted url() in CSS: url(/x) but not url(//x)
  s = s.replace(/url\(\s*\/([^/])/g, 'url(./$1');
  s = s.replace(/url\(\s*"\/([^/])/g, 'url("./$1');
  s = s.replace(/url\(\s*'\/([^/])/g, "url('./$1");
  // Catch-all for root-absolute paths in string literals (inline <script>, importmap,
  // JSON, etc.). Attribute rewrites above do not touch those. Under Tauri asset://,
  // "/assets/..." resolves to the protocol origin and 404s instead of the app folder.
  s = rewriteRootAbsoluteStringLiterals(s);
  return s;
}

/**
 * `/formulus-load.js` with optional `?query` / `#hash` (Vite cache-bust) must be rewritten;
 * exact `"/formulus-load.js"` only misses `"/formulus-load.js?v=…"` and leaves a root path
 * → resolves to `asset://localhost/formulus-load.js` (invalid for Tauri's asset handler).
 */
function rewriteFormulusLoadStringLiterals(
  content: string,
  relPath: './formulus-load.js' | '../formulus-load.js',
): string {
  let s = content;
  s = s.replace(/"\/formulus-load\.js(\?[^"#]*)?(#[^"]*)?"/g, (_, q = '', h = '') => {
    return `"${relPath}${q}${h}"`;
  });
  s = s.replace(/'\/formulus-load\.js(\?[^'#]*)?(#[^']*)?'/g, (_, q = '', h = '') => {
    return `'${relPath}${q}${h}'`;
  });
  s = s.replace(/`\/formulus-load\.js(\?[^`#]*)?(#[^`]*)?`/g, (_, q = '', h = '') => {
    return `\`${relPath}${q}${h}\``;
  });
  s = s.replace(
    /import\(\s*["']\/formulus-load\.js(\?[^"']*)?["']\s*\)/g,
    (_, q = '') => `import("${relPath}${q ?? ''}")`,
  );
  return s;
}

/** Rewrites `/assets/...` and `/formulus-load.js` inside "strings" for HTML or JS. */
export function rewriteRootAbsoluteStringLiterals(content: string): string {
  let s = content;
  s = s.replace(/"\/assets\//g, '"./assets/');
  s = s.replace(/'\/assets\//g, "'./assets/");
  s = s.replace(/`\/assets\//g, '`./assets/');
  s = rewriteFormulusLoadStringLiterals(s, './formulus-load.js');
  return s;
}

/**
 * Rewrites root-absolute `/assets/...` references inside **chunk** `.js` / `.css` files that
 * live under `bundles/active/app/assets/`. There, `/assets/foo` means the same directory
 * as the chunk file, so we map to `./foo`.
 */
export function rewriteVendorChunkFile(content: string): string {
  let s = content;
  s = s.replace(/"\/assets\//g, '"./');
  s = s.replace(/'\/assets\//g, "'./");
  s = s.replace(/`\/assets\//g, '`./');
  s = s.replace(/url\(\s*\/assets\//g, 'url(./');
  s = s.replace(/url\(\s*"\/assets\//g, 'url("./');
  s = s.replace(/url\(\s*'\/assets\//g, "url('./");
  // Chunks live in app/assets/; Vite root paths like /formulus-load.js resolve to app/ (parent dir).
  s = rewriteFormulusLoadStringLiterals(s, '../formulus-load.js');
  return s;
}

/**
 * Rewrites `/assets/` in `.js` / `.css` at `app/` root (not under `app/assets/`), e.g.
 * `formulus-load.js`, so paths stay relative to the app folder.
 *
 * This must not use {@link rewriteEmbeddedBundleHtml}: that only matches HTML attributes
 * and misses `import("/assets/...")` and similar inside JavaScript sources.
 */
export function rewriteAppRootBundledFile(content: string): string {
  let s = content;
  s = s.replace(/url\(\s*\/assets\//g, 'url(./');
  s = s.replace(/url\(\s*"\/assets\//g, 'url("./');
  s = s.replace(/url\(\s*'\/assets\//g, "url('./");
  return rewriteRootAbsoluteStringLiterals(s);
}

/** Strip a previous ODE Desktop injection block before re-applying (see CustomAppEmbed). */
export function stripOdeDesktopInjection(html: string): string {
  return html.replace(
    /<!--ode-desktop-inject-start-->[\s\S]*?<!--ode-desktop-inject-end-->/i,
    '',
  );
}
