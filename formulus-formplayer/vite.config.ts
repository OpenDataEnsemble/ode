/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Remove crossorigin from script/link tags so modules load in WebView file:// context.
 * crossorigin can cause ES modules to fail when loading from file:///android_asset/
 */
function removeCrossOriginForWebView() {
  return {
    name: 'remove-crossorigin-for-webview',
    transformIndexHtml(html: string) {
      return html
        .replace(/\s+crossorigin/g, '')
        .replace(/crossorigin\s+/g, '');
    },
  };
}

export default defineConfig({
  plugins: [react(), removeCrossOriginForWebView()],

  // Use relative base path so formplayer works when loaded from file:// in WebView
  base: './',

  // Build configuration
  build: {
    outDir: 'build',
    assetsDir: 'public',
    sourcemap: true,
    // Increase default chunk size warning limit (in kB) since we intentionally
    // ship a single large bundle for WebView compatibility.
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        // Single bundle for WebView compatibility: multi-chunk ES modules often fail
        // to load in Android WebView file:// context (formplayer never mounts).
        inlineDynamicImports: true,
      },
      // Suppress dynamic import warnings (same as config-overrides.js)
      onwarn(warning, warn) {
        if (
          warning.code === 'EVAL' ||
          (warning.message && warning.message.includes('ExtensionsLoader')) ||
          (warning.code === 'UNUSED_EXTERNAL_IMPORT' && warning.source?.includes('formulus-load.js'))
        ) {
          return;
        }
        warn(warning);
      },
    },
  },

  // Dev server configuration
  server: {
    port: 3000,
    open: true,
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Resolve @ode/tokens from app root when bundling @ode/components (symlinked package)
      '@ode/tokens': path.resolve(__dirname, 'node_modules/@ode/tokens'),
    },
  },

  // Define global constants (for environment variables)
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      process.env.NODE_ENV || 'development',
    ),
  },

  test: {
    environment: 'node',
  },
});
