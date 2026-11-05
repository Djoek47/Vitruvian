import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { viteSingleFile } from "vite-plugin-singlefile";
import { execSync } from "node:child_process";

const build = (() => {
  try { return execSync("git rev-parse --short HEAD").toString().trim(); } catch { return "dev"; }
})() + " · " + new Date().toISOString().slice(0, 16);

export default defineConfig(({ mode }) => ({
  // GitHub Pages serves from /<repo>/ — relative base works everywhere.
  base: "./",
  define: { __BUILD__: JSON.stringify(build) },
  plugins: [
    // HTTPS on the LAN dev server so the Quest Browser allows WebXR (accept the self-signed cert once).
    ...(mode === "development" ? [basicSsl()] : []),
    ...(mode === "single" ? [viteSingleFile()] : []),
  ],
  build: { target: "es2022", outDir: mode === "single" ? "dist-single" : "dist", chunkSizeWarningLimit: 2000 },
  server: { host: true, port: 5173 },
  test: { include: ["tests/**/*.test.ts"] },
}));
