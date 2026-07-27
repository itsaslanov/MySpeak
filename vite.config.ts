import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = Number(env.PORT || process.env.PORT || 4000) || 4000;

  return defineConfig({
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": `http://127.0.0.1:${apiPort}`,
        "/socket.io": {
          target: `http://127.0.0.1:${apiPort}`,
          ws: true
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "agora": ["agora-rtc-sdk-ng"],
            "vendor": ["react", "react-dom", "react-router-dom", "socket.io-client"]
          }
        }
      }
    }
  });
};
