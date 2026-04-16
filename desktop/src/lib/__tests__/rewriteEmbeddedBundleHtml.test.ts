import { describe, expect, it } from 'vitest';
import {
  rewriteEmbeddedBundleHtml,
  rewriteVendorChunkFile,
  stripOdeDesktopInjection,
} from '../rewriteEmbeddedBundleHtml';

describe('rewriteEmbeddedBundleHtml', () => {
  it('rewrites root-absolute href/src (not protocol-relative //)', () => {
    const html = `<!doctype html>
<script type="module" crossorigin src="/assets/index-b05ae6d5.js"></script>
<link rel="stylesheet" href="/assets/index-62a83eec.css">
<link rel="modulepreload" href="/assets/chunk.js">
<script src="/formulus-load.js"></script>`;
    const out = rewriteEmbeddedBundleHtml(html);
    expect(out).toContain('src="./assets/index-b05ae6d5.js"');
    expect(out).toContain('href="./assets/index-62a83eec.css"');
    expect(out).toContain('href="./assets/chunk.js"');
    expect(out).toContain('src="./formulus-load.js"');
  });

  it('does not rewrite protocol-relative URLs', () => {
    const html = `<link rel="preconnect" href="//fonts.googleapis.com">`;
    expect(rewriteEmbeddedBundleHtml(html)).toBe(html);
  });

  it('rewrites url(/...) in inline CSS', () => {
    const html = `<style>body{background:url(/assets/bg.png)}</style>`;
    expect(rewriteEmbeddedBundleHtml(html)).toContain('url(./assets/bg.png)');
  });
});

describe('rewriteVendorChunkFile', () => {
  it('maps /assets/ to ./ for chunks living in app/assets/', () => {
    const js = `import{foo}from"/assets/foo-abc.js";`;
    expect(rewriteVendorChunkFile(js)).toContain('from"./foo-abc.js"');
  });

  it('maps /formulus-load.js to ../formulus-load.js from app/assets/ chunks', () => {
    const js = `import("/formulus-load.js");from"/formulus-load.js"`;
    const out = rewriteVendorChunkFile(js);
    expect(out).toContain('import("../formulus-load.js")');
    expect(out).toContain('"../formulus-load.js"');
  });
});

describe('stripOdeDesktopInjection', () => {
  it('removes marked injection block', () => {
    const html = `<head><!--ode-desktop-inject-start--><base href="x"><!--ode-desktop-inject-end--><title>a</title></head>`;
    expect(stripOdeDesktopInjection(html)).not.toContain('ode-desktop-inject');
    expect(stripOdeDesktopInjection(html)).toContain('<title>a</title>');
  });
});
