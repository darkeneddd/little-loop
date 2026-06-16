import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Lets the frontend call relative /garments, /assess, etc. without
      // hardcoding the backend origin or fighting CORS during dev.
      '/garments': 'http://127.0.0.1:8000',
      '/assess': 'http://127.0.0.1:8000',
      '/trade-in': 'http://127.0.0.1:8000',
      '/dashboard': 'http://127.0.0.1:8000',
      '/static': 'http://127.0.0.1:8000',
    },
  },
})
