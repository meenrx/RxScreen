import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Auto-update: พอ deploy เวอร์ชันใหม่ SW จะอัปเดต+รีโหลดเอง (ทั้ง PWA หน้าโฮม + เบราว์เซอร์)
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // ลงทะเบียนเองใน main.tsx (เพิ่มเช็คอัปเดตตอน resume)
      manifest: false, // ใช้ public/manifest.webmanifest เดิม
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // bundle หลัก ~2MB (unminified) + xlsx chunk
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'pdf-vendor': ['jspdf', 'html2canvas'],
          'anthropic-vendor': ['@anthropic-ai/sdk'],
        },
      },
    },
  },
})
