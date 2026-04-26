import { defineConfig } from 'vite-plus'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MIDI of Hearts',
        short_name: 'MoH',
        description: 'Bluetooth smartwatch heart rate monitor and MIDI clock',
        background_color: '#26262a',
        theme_color: '#bb3b37',
        lang: 'en',
      },
    }),
    viteSingleFile(),
  ],
  base: './',
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
