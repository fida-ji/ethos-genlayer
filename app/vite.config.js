import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// genlayer-js pulls in some node-oriented deps; keep the build lean and let
// Vite pre-bundle it. Target modern browsers only.
export default defineConfig({
  plugins: [react()],
  build: { target: "es2022", outDir: "dist" },
  define: { global: "globalThis" },
});
