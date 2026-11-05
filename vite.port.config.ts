// Builds the Faberland Port as a standalone ES module for other Faberland projects:
//   https://djoek47.github.io/Vitruvian/port/vitruvian-port.js  (+ /port/types/*.d.ts)
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    lib: { entry: "src/port/index.ts", formats: ["es"], fileName: () => "vitruvian-port.js" },
    outDir: "dist/port",
    emptyOutDir: true,
    target: "es2022",
    minify: false,
    sourcemap: true,
  },
});
