import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://localhost:5055",
      "/uploads": "http://localhost:5055",
      "/fonts": "http://localhost:5055",
    },
  },
});
