import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'

  return {
    base: isDev ? '/' : '/scallions/',
    plugins: [react()],
    server: {
      port: 5178,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8160',
          changeOrigin: true,
        },
        '/health': {
          target: 'http://127.0.0.1:8160',
          changeOrigin: true,
        },
      },
    },
  }
})
