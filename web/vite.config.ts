import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import stylex from "@stylexjs/unplugin";

export default defineConfig({
  plugins: [stylex.vite(), react()],
  optimizeDeps: {
    exclude: ["@lenso/ui", "@lenso/tokens", "@lenso/glass"],
  },
  server: {
    port: 5173,
    proxy: { "/api": `http://localhost:${process.env.API_PORT ?? 8787}` },
  },
});
