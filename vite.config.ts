import { defineConfig } from 'vite-plus'

export default defineConfig({
  base: './',
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
