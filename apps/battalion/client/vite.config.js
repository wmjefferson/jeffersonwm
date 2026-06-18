import { defineConfig } from 'vite';
import fs from 'fs';
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
        if (urlPath === '/') {
          const landingPath = path.resolve(__dirname, 'public', 'landing.html');
          if (fs.existsSync(landingPath)) {
            res.setHeader('Content-Type', 'text/html');
            res.end(fs.readFileSync(landingPath, 'utf8'));
            return;
          }
        }
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
