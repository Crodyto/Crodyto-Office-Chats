import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',

      srcDir: 'public',
      filename: 'sw.js',

      devOptions: {
        enabled: true,
      },

      manifest: {
        name: 'Crodyto Chat',
        short_name: 'Crodyto',
        description: 'Secure communication platform for Crodyto',

        theme_color: '#00a884',
        background_color: '#efeae2',

        display: 'standalone',
        scope: '/',
        start_url: '/',

        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
});
