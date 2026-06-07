import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import manifest from "./src/manifest";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBaseUrl =
    env.API_BASE_URL || (mode === "production" ? "https://api.yourdomain.com" : "http://localhost:8787");

  return {
    define: {
      __API_BASE_URL__: JSON.stringify(apiBaseUrl)
    },
    plugins: [react(), crx({ manifest })],
    build: {
      outDir: "dist",
      emptyOutDir: true
    }
  };
});
