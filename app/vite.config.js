import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// genlayer-js pulls in some node-oriented deps; keep the build lean and let
// Vite pre-bundle it. Target modern browsers only.
export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
    outDir: "dist",
    // genlayer-js is a single large dependency; the bundle exceeds the default
    // 500 kB warning. That is expected for this app, not an error.
    chunkSizeWarningLimit: 900,
  },
  define: { global: "globalThis" },
});
