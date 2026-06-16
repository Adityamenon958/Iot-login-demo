import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Strip console/debugger in production builds only (keeps logs in dev)
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080', // Use 127.0.0.1 to avoid Windows localhost IPv6 port conflicts
        changeOrigin: true,
        secure: false,
      },
    },
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}))
