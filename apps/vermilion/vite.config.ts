import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const devApiTarget = process.env.VERMILION_DEV_API_TARGET || 'http://localhost:8105';

export default defineConfig({
  base: '/vermilion/',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'split-routing',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const urlPath = req.url ? req.url.split('?')[0] : '';
          // Landing page is paused for now; keep root on the SPA entry.
          if (urlPath === '/home' || urlPath === '/vermilion/home' || urlPath === '/vermilion/home/') {
            req.url = '/vermilion/index.html';
          }
          next();
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 5175,
    proxy: {
      '/api': devApiTarget,
    },
  },
});
