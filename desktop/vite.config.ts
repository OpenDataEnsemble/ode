import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

/** Avoid SPA fallback serving desktop index.html for missing public/formplayer_dist/*. */
function formplayerDistMissing404(): Plugin {
  return {
    name: 'formplayer-dist-missing-404',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = (req.url ?? '').split('?')[0];
        if (!raw?.startsWith('/formplayer_dist/')) {
          return next();
        }
        if (raw.includes('..')) {
          res.statusCode = 400;
          res.end();
          return;
        }
        const rel = raw.slice(1);
        const publicRoot = path.join(server.config.root, 'public');
        const filePath = path.join(publicRoot, rel);
        if (!filePath.startsWith(publicRoot)) {
          res.statusCode = 400;
          res.end();
          return;
        }
        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('Not Found');
          return;
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [formplayerDistMissing404(), react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
}));
