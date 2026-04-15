import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/upload": "http://127.0.0.1:8001",
      "/analysis": "http://127.0.0.1:8001",
      "/results": "http://127.0.0.1:8001",
      "/export": "http://127.0.0.1:8001",
      "/health": "http://127.0.0.1:8001",
    },
  },
});
