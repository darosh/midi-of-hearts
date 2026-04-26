import { defineConfig } from 'vite-plus'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'prompt',
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
