import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/lionship/',
      server: {
        port: 8041,
        host: '0.0.0.0',
        allowedHosts: [
          'api-lionship.jeffersonwm.com',
          'jeffersonwm.com',
          'www.jeffersonwm.com',
          'localhost',
          '127.0.0.1',
        ],
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
