import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// La API va por el mismo origen (/api) para que la cookie de sesión funcione; Vite la reenvía al puerto de la API.
const apiTarget = process.env.API_PROXY_TARGET ?? `http://localhost:${process.env.API_PORT ?? 2568}`;

export default defineConfig({
  plugins: [react()],
  envDir: '../..',
  server: { port: 5173, host: true, proxy: { '/api': { target: apiTarget, changeOrigin: false } } },
  preview: { port: 4173, host: true, proxy: { '/api': { target: apiTarget, changeOrigin: false } } },
});
