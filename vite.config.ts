import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* The browser bundle must stay a single self-contained IIFE so the built app
   also opens straight from disk over file://, where ES modules are blocked. */
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    modulePreload: false,
    cssCodeSplit: false,
    assetsDir: ".",
    rollupOptions: {
      output: {
        format: "iife",
        entryFileNames: "app.js",
        // The service worker precaches by exact name, so keep the stylesheet stable.
        assetFileNames: (asset) =>
          asset.names?.some((name) => name.endsWith(".css")) ? "styles.css" : "[name][extname]",
      },
    },
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:4173" },
  },
});
