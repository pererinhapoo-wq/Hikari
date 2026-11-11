import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";

function authPopupPlugin(): Plugin {
  return {
    name: "app-builder:auth-popup",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? "";
        const pathOnly = rawUrl.split("?", 1)[0];
        if (pathOnly !== "/auth/popup" || (req.method ?? "GET").toUpperCase() !== "GET") {
          next();
          return;
        }
        try {
          const mod = await server.ssrLoadModule("/src/lib/auth/popup.server.ts");
          const proto = (req.headers["x-forwarded-proto"] as string) || "http";
          const host =
            (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost:3000";
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (Array.isArray(v)) {
              for (const item of v) headers.append(k, item);
            } else if (typeof v === "string") {
              headers.set(k, v);
            }
          }
          const webReq = new Request(`${proto}://${host}${rawUrl}`, {
            method: "GET",
            headers,
          });
          const webRes: Response = await mod.handleAuthPopupRequest(webReq);
          res.statusCode = webRes.status;
          webRes.headers.forEach((value, key) => {
            if (key.toLowerCase() !== "set-cookie") {
              res.setHeader(key, value);
            }
          });
          const setCookies = webRes.headers.getSetCookie?.() ?? [];
          if (setCookies.length > 0) {
            res.setHeader("set-cookie", setCookies);
          }
          if (webRes.body) {
            Readable.fromWeb(webRes.body as never).pipe(res);
          } else {
            res.end();
          }
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

function sitemapPlugin(): Plugin {
  return {
    name: "hikari:sitemap",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? "";
        const pathOnly = rawUrl.split("?", 1)[0];
        if (!pathOnly.startsWith("/sitemap") || (req.method ?? "GET").toUpperCase() !== "GET") {
          next();
          return;
        }
        try {
          const {
            generateAnimeSitemapXml,
            generateEpisodeSitemapXml,
            generateSitemapIndexXml,
            generateStaticSitemapXml,
            getSitemapAnimeCatalog,
          } = await server.ssrLoadModule("/src/lib/seo.ts");

          res.setHeader("Content-Type", "application/xml; charset=utf-8");
          res.setHeader(
            "Cache-Control",
            "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400",
          );

          if (pathOnly === "/sitemap.xml") {
            const animes = await getSitemapAnimeCatalog();
            const totalEpisodes = animes.reduce(
              (acc: number, a: { episodesCount?: number }) => acc + (a.episodesCount || 1),
              0,
            );
            res.end(generateSitemapIndexXml(animes.length, totalEpisodes));
            return;
          }

          if (pathOnly === "/sitemap-static.xml") {
            res.end(generateStaticSitemapXml());
            return;
          }

          const animeMatch = pathOnly.match(/^\/sitemap-animes-(\d+)\.xml$/);
          if (animeMatch) {
            const pageNum = parseInt(animeMatch[1], 10) || 1;
            const animes = await getSitemapAnimeCatalog();
            res.end(generateAnimeSitemapXml(animes, pageNum));
            return;
          }

          const epMatch = pathOnly.match(/^\/sitemap-episodios-(\d+)\.xml$/);
          if (epMatch) {
            const pageNum = parseInt(epMatch[1], 10) || 1;
            const animes = await getSitemapAnimeCatalog();
            res.end(generateEpisodeSitemapXml(animes, pageNum));
            return;
          }

          next();
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig(({ command, isPreview }) => {
  const isBuildOrPreview = command === "build" || Boolean(isPreview);

  return {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: true,
    },
    preview: {
      host: "127.0.0.1",
      port: 8081,
      strictPort: true,
    },
    build: {
      rollupOptions: {
        onwarn(warning, defaultHandler) {
          if (
            warning.code === "MODULE_LEVEL_DIRECTIVE" ||
            warning.code === "EVAL" ||
            warning.message?.includes("MODULE_LEVEL_DIRECTIVE") ||
            warning.message?.includes("use client")
          ) {
            return;
          }
          defaultHandler(warning);
        },
      },
    },
    plugins: [
      appEnvPlugin(),
      sitemapPlugin(),
      grokPwaPlugin(),
      authPopupPlugin(),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      ...(isBuildOrPreview && !process.env.CLOUDFLARE
        ? [
            nitro({
              preset: "vercel",
              serverDir: "./server",
              rolldownConfig: {
                onwarn(warning: any, warn: any) {
                  if (
                    warning.code === "MODULE_LEVEL_DIRECTIVE" ||
                    warning.code === "EVAL" ||
                    warning.message?.includes("use client")
                  ) {
                    return;
                  }
                  warn(warning);
                },
              },
              rollupConfig: {
                onwarn(warning: any, warn: any) {
                  if (
                    warning.code === "MODULE_LEVEL_DIRECTIVE" ||
                    warning.code === "EVAL" ||
                    warning.message?.includes("use client")
                  ) {
                    return;
                  }
                  warn(warning);
                },
              },
            }),
          ]
        : []),
    ],
  };
});
