import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import vitePluginCesium from 'vite-plugin-cesium'
import { defineConfig, type Plugin } from 'vite'

const cesiumPlugin = vitePluginCesium as unknown as () => Plugin

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cesiumPlugin(),
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