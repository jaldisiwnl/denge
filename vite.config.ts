import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Fonts are self-hosted (@fontsource) and land in the build as woff2;
      // they must be precached so the app renders identically offline (§13).
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
      },
      manifest: {
        name: 'Denge',
        short_name: 'Denge',
        description: 'Paranla aranı düzelt.',
        lang: 'tr',
        display: 'standalone',
        start_url: '/',
        // theme_color must match --paper (light); the dark variant is handled
        // by the <meta name="theme-color" media=...> tags in index.html.
        theme_color: '#FAF9F4',
        background_color: '#FAF9F4',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
