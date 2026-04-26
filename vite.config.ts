import { defineConfig } from 'vite-plus'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['fonts/*.ttf'],
      includeManifestIcons: false,
      workbox: {
        // viteSingleFile inlines everything into index.html, so VitePWA can't compute
        // a revision for it (ends up revision:null). Exclude html from precache entirely
        // and serve navigation requests via NetworkFirst so updates are always fetched.
        globPatterns: ['**/*.{js,css,png,svg,ico,ttf,woff2,webmanifest}'],
        navigateFallback: null,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages' },
          },
        ],
      },
      manifest: {
        name: 'MIDI of Hearts',
        short_name: 'MoH',
        description: 'Bluetooth smartwatch heart rate monitor and MIDI clock',
        background_color: '#26262a',
        theme_color: '#bb3b37',
        lang: 'en',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
    viteSingleFile(),
  ],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    cssCodeSplit: false, // optional: combine all CSS into one
    assetsInlineLimit: 1000000, // optional: inline small assets too
  },
  fmt: {
    semi: false,
    singleQuote: true,
    bracketSameLine: true,
    singleAttributePerLine: true,
    htmlWhitespaceSensitivity: 'strict',
    printWidth: 160,
  },
  lint: { options: { typeAware: true, typeCheck: true } },
})
