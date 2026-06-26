import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Aplicativo-de-Gestao-de-Frota/',
  server: {
    host: true,
    port: 5173,
    hmr: {
      overlay: false
    }
  }
})
