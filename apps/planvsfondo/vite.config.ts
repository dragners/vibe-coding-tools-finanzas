import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  // La aplicación se sirve bajo /planvsfondo/, por lo que se fija la base
  // para que los recursos estáticos apunten correctamente y eviten errores 404
  base: '/planvsfondo/',
  server: { host: true, port: 5173 }
})
