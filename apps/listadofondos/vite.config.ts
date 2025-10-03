import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // La app se sirve bajo /listadofondos/
  base: '/listadofondos/',
  plugins: [react()]
});

