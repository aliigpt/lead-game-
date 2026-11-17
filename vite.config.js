import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  build: { outDir: "../dist", emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: {
    host: true,
    proxy: { "/api": "http://localhost:2567" },
  },
});
