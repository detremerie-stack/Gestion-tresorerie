import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }
import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/**
 * OCR auto-hébergé (Q8) : le code exécutable de Tesseract (worker + moteur wasm) est servi depuis notre site,
 * dans `tesseract/`, chargé seulement à la demande et jamais précaché. Les fichiers de langue restent sur le CDN
 * (données, pas du code : risque accepté).
 */
const TESSERACT_FILES = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
]
/**
 * Politique de sécurité du contenu (P7), en balise meta (GitHub Pages ne permet pas d'en-têtes).
 * Large côté Google/Firebase pour ne pas casser la connexion ; ajoutée au build seulement (le serveur de
 * développement utilise des scripts en ligne).
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' https://apis.google.com https://www.gstatic.com https://accounts.google.com",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://www.gstatic.com https://api.frankfurter.app https://cdn.jsdelivr.net",
  "frame-src https://*.firebaseapp.com https://accounts.google.com https://apis.google.com",
  "img-src 'self' blob: data: https://*.googleusercontent.com https://www.gstatic.com",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')
function contentSecurityPolicy(): Plugin {
  return {
    name: 'fare-moni-csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  }
}

function selfHostedOcr(): Plugin {
  return {
    name: 'fare-moni-ocr',
    apply: 'build',
    writeBundle(opts) {
      const out = resolve(opts.dir ?? 'dist', 'tesseract')
      mkdirSync(out, { recursive: true })
      for (const [from, to] of TESSERACT_FILES) copyFileSync(resolve('node_modules', from), resolve(out, to))
    },
  }
}

// base relative : l'app fonctionne aussi bien à la racine d'un domaine que sous /Gestion-tresorerie/ (GitHub Pages).
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    selfHostedOcr(),
    contentSecurityPolicy(),
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
        // OCR : jamais précaché (≈ 12 Mo) ; mis en cache au premier usage.
        globIgnores: ['tesseract/**'],
        runtimeCaching: [
          { urlPattern: ({ url }) => url.pathname.includes('/tesseract/'), handler: 'CacheFirst', options: { cacheName: 'fare-moni-ocr', expiration: { maxEntries: 8 } } },
          { urlPattern: ({ url }) => url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('traineddata'), handler: 'CacheFirst', options: { cacheName: 'fare-moni-ocr-langues', expiration: { maxEntries: 4 } } },
        ],
        navigateFallback: 'index.html',
      },
    }),
  ],
  // zustand transformé par vitest : le test de rendu (finDeMois.test.tsx) peut lui faire lire l'état chargé.
  test: { environment: 'node', server: { deps: { inline: ['zustand'] } } },
})
