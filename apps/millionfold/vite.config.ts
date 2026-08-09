import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/millionfold/',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'split-routing',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const urlPath = req.url ? req.url.split('?')[0] : '';
          // Landing page is paused for now; keep root on the SPA entry.
          if (urlPath === '/home' || urlPath === '/millionfold/home' || urlPath === '/millionfold/home/') {
            req.url = '/millionfold/index.html';
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
    port: 5174,
    proxy: {
      '/api': 'http://localhost:8090',
    },
  },
});
