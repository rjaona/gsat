/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import compression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Pré-compression gzip + brotli — servis par nginx gzip_static / brotli_static
    compression({ algorithm: 'gzip', ext: '.gz', threshold: 1024 }),
    compression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024 }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Recharts — lourd (~500 KB), isolé pour le lazy loading
          'vendor-recharts': ['recharts'],
          // Leaflet — utilisé uniquement dans le Dashboard Global
          'vendor-leaflet': ['leaflet', 'react-leaflet'],
          // jsPDF — utilisé uniquement dans le Rapport PDF
          'vendor-jspdf': ['jspdf', 'html2canvas'],
          // i18n
          'vendor-i18n': ['react-i18next', 'i18next'],
          // React core — optimise le tree-shaking
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    // Avertissement au-dessus de 600 KB après splitting (défaut 500 KB)
    chunkSizeWarningLimit: 600,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['functions/**', 'node_modules/**'],
  },
})
