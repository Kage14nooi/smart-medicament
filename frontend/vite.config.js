import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En dev, on proxy /api vers le gateway local (mode dev hybride documente dans le README).
// En Docker, le frontend est servi en build statique (nginx) et VITE_API_BASE_URL
// est injecte au build pour pointer directement vers le gateway du reseau docker-compose.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 5173,
  },
});
