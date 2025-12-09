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
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // Proxy API requests to the Synkronus backend
      // In Docker: uses service name 'synkronus'
      // Locally: uses 'localhost'
      '/api': {
        target: process.env.API_URL || (process.env.DOCKER_ENV === 'true' ? 'http://synkronus:8080' : 'http://localhost:8080'),
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err) => {
            console.log('proxy error', err)
          })
        },
      },
    },
  },
})
