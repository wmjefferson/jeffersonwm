import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
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
          if (urlPath === '/' || urlPath === '/millionfold' || urlPath === '/millionfold/') {
            const landingPath = path.resolve(__dirname, 'public', 'landing.html');
            if (fs.existsSync(landingPath)) {
              res.setHeader('Content-Type', 'text/html');
              res.end(fs.readFileSync(landingPath, 'utf8'));
              return;
            }
          }
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
