import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Automatic update hobe notun code push korle
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Crodyto Chat',
        short_name: 'Crodyto',
        description: 'Secure communication platform for Crodyto Employees',
        theme_color: '#00a884', /* WhatsApp er green color */
        background_color: '#efeae2',
        display: 'standalone', /* Browser hide kore app er moto open hobe */
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
