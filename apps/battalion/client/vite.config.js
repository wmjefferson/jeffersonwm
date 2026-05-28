import { defineConfig } from 'vite';
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
    }
  },
  build: {
    outDir: 'dist'
  }
}));
