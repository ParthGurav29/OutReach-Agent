import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/run-campaign': { target: 'http://localhost:8000', changeOrigin: true },
      '/stream-campaign': { target: 'http://localhost:8000', changeOrigin: true },
      '/launch-campaign': { target: 'http://localhost:8000', changeOrigin: true },
      '/send-linkedin-dm': { target: 'http://localhost:8000', changeOrigin: true },
      '/advance-cadence': { target: 'http://localhost:8000', changeOrigin: true },
      '/linkedin-auth-status': { target: 'http://localhost:8000', changeOrigin: true },
      '/send-email': { target: 'http://localhost:8000', changeOrigin: true }
    }
  }
})