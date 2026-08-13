import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// En dev, Vite sirve el frontend y proxya /api al backend. En producción, nginx
// hace ese proxy (ver Task 15). Puertos configurables por entorno.
const BACKEND_PORT = process.env.BACKEND_PORT ?? "7412";
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT ?? "7413");

export default defineConfig({
  plugins: [react()],
  server: {
    port: FRONTEND_PORT,
    proxy: {
      "/api": {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
