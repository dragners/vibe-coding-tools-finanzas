import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // MUY IMPORTANTE: la app vive bajo /comparadorhipotecas/
  base: '/comparadorhipotecas/',
  plugins: [react()]
});

