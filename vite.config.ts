import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function authPopupPlugin() {
  return {
    name: "auth-popup",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url && (req.url === "/auth/popup" || req.url.startsWith("/auth/popup?"))) {
          try {
            const { handleAuthPopupRequest } = await server.ssrLoadModule("/src/lib/auth/popup.server.ts");
            const proto = req.headers["x-forwarded-proto"] || "http";
            const host = req.headers.host || "localhost:3000";
            const fullUrl = `${proto}://${host}${req.url}`;
            const webReq = new Request(fullUrl, {
              method: req.method,
              headers: req.headers,
            });
            const response = await handleAuthPopupRequest(webReq);
            res.statusCode = response.status;
            response.headers.forEach((val: string, key: string) => res.setHeader(key, val));
            const text = await response.text();
            res.end(text);
          } catch (e) {
            next(e);
          }
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  plugins: [
    tanstackStart(),
    tailwindcss(),
    grokPwaPlugin(),
    appEnvPlugin(),
    authPopupPlugin(),
    (command === "build" || isPreview) &&
      nitro({
        preset: "vercel",
        serverDir: "./server",
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
  },
}));
