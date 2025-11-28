import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', // Zwingt den Server auf die alte IPv4 Adresse
    port: 5173,        // Versucht immer Port 5173 zu nehmen
  }
})