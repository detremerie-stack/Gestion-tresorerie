import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// base relative : l'app fonctionne aussi bien à la racine d'un domaine que sous /Gestion-tresorerie/ (GitHub Pages).
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Fare Moni — l’argent de la maison',
        short_name: 'Fare Moni',
        description: 'Abonnements, comptes et budget en francs Pacifique (XPF).',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f4f6f7',
        theme_color: '#0e7490',
        shortcuts: [
          { name: 'Dépense rapide', short_name: 'Dépense', url: './#/rapide', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'Prévisionnel', short_name: 'Prévisions', url: './#/previsionnel', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
        ],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { environment: 'node' },
})
