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
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('cesium')) return 'vendor-cesium';
          if (id.includes('@deck.gl') || id.includes('luma.gl') || id.includes('@luma.gl')) return 'vendor-deckgl';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-recharts';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
})