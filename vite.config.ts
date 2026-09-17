import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import vitePluginCesium from 'vite-plugin-cesium'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    vitePluginCesium(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})