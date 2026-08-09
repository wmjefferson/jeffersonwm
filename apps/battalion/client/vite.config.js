import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig(({ command }) => ({
  root: '.',
  base: command === 'build' ? '/battalion/' : '/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8070',
        changeOrigin: true
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const urlPath = req.url.split('?')[0];
        // Landing page is paused for now; keep root on the SPA entry.
        if (urlPath === '/home') {
          req.url = '/index.html';
        }
        next();
      });
    }
  },
  build: {
    outDir: 'dist'
  }
}));
