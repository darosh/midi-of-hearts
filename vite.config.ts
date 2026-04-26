import { defineConfig } from "vite-plus";

export default defineConfig({
  base: "/midi-of-hearts/",
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
});
