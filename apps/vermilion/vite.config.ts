import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

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
          if (urlPath === '/' || urlPath === '/vermilion' || urlPath === '/vermilion/') {
            const landingPath = path.resolve(__dirname, 'public', 'landing.html');
            if (fs.existsSync(landingPath)) {
              res.setHeader('Content-Type', 'text/html');
              res.end(fs.readFileSync(landingPath, 'utf8'));
              return;
            }
          }
          if (urlPath === '/home' || urlPath === '/vermilion/home' || urlPath === '/vermilion/home/') {
            req.url = '/index.html';
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
      '/api': 'http://localhost:8100',
    },
  },
});
