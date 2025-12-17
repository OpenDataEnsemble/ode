import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  // Disable caching in development to prevent stale code issues
  optimizeDeps: {
    force: true, // Force re-optimization of dependencies
  },
  server: {
    host: '0.0.0.0', // Allow external connections (needed for Docker)
    port: 5174,
    strictPort: true, // Fail if port is already in use instead of trying next available port
    // Disable caching in development
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    hmr: {
      // Hot Module Replacement configuration
      host: 'localhost',
      port: 5174,
      protocol: 'ws', // WebSocket protocol for HMR
      overlay: true, // Show HMR errors in browser
    },
    watch: {
      // Watch for file changes (enabled by default in dev mode)
      usePolling: true, // Needed for Docker on Windows
      interval: 100, // Polling interval in ms
    },
    proxy: {
      // Proxy API requests to the Synkronus backend
      // In Docker: uses service name 'synkronus'
      // Locally: uses 'localhost'
      '/api': {
        // In Docker, use service name; locally, use localhost
        target: process.env.DOCKER_ENV === 'true' || process.env.VITE_API_URL?.includes('synkronus:')
          ? 'http://synkronus:8080'
          : process.env.API_URL || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => {
          const rewritten = path.replace(/^\/api/, '')
          console.log(`[Vite Proxy] Rewriting ${path} -> ${rewritten}`)
          return rewritten
        },
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, _res) => {
            console.error('[Vite Proxy] Error:', err)
            console.error('[Vite Proxy] Request URL:', req.url)
            console.error('[Vite Proxy] Target:', process.env.DOCKER_ENV === 'true' || process.env.VITE_API_URL?.includes('synkronus:')
              ? 'http://synkronus:8080'
              : process.env.API_URL || 'http://localhost:8080')
          })
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('[Vite Proxy] Proxying request:', req.method, req.url, '->', proxyReq.path)
          })
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('[Vite Proxy] Response:', proxyRes.statusCode, req.url)
          })
        },
      },
    },
  },
})
