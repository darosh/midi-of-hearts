import { defineConfig } from 'vite-plus'

export default defineConfig({
  base: '/midi-of-hearts/',
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
