import { lazy, Suspense, useEffect, useState } from "react";
import {
  createRootRoute,
  HeadContent,
  Scripts,
  ScrollRestoration,
} from "@tanstack/react-router";

import { AuthProvider } from "@/lib/auth/provider";

import { PreviewHostBridge } from "@/components/preview-host-bridge";

import { Shell } from "@/components/shell";

import appCss from "../styles.css?url";

const APP_NAME = "HIKARI";

const LazyAnalytics = lazy(() =>
  import("@vercel/analytics/react").then((m) => ({ default: m.Analytics })),
);

function DeferredAnalytics() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Suspense fallback={null}>
      <LazyAnalytics />
    </Suspense>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Hikari 光 — catálogo e streaming de animes. Temporada, populares, trailers e Minha Lista.",
      },
      {
        name: "theme-color",
        content: "#09090b",
      },
    ],

    links: [
      {
        rel: "preconnect",
        href: "https://s4.anilist.co",
      },
      {
        rel: "dns-prefetch",
        href: "https://s4.anilist.co",
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "manifest",
        href: "/__grok/manifest.webmanifest",
      },
      {
        rel: "apple-touch-icon",
        href: "/__grok/icon-180.png",
      },
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: "/assets/fonts/manrope-latin.woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: "/assets/fonts/playfair-display-latin.woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: "/assets/fonts/noto-serif-jp-latin.woff2",
        crossOrigin: "anonymous",
      },
    ],

    scripts: [
      {
        src: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4294366271727594",
        async: true,
        crossOrigin: "anonymous",
      },
    ],
  }),

  component: () => (
    <html
      lang="pt-BR"
      className="antialiased"
      style={{ backgroundColor: "#08070d", color: "#f4f4f1" }}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                function applyTheme() {
                  try {
                    var theme = localStorage.getItem("hikari-theme");
                    if (theme === "Claro") {
                      document.documentElement.setAttribute("data-theme", "light");
                      document.documentElement.style.backgroundColor = "#f7f7f5";
                      document.documentElement.style.color = "#171717";
                      document.documentElement.style.colorScheme = "light";
                    } else {
                      document.documentElement.removeAttribute("data-theme");
                      document.documentElement.style.backgroundColor = "#08070d";
                      document.documentElement.style.color = "#f4f4f1";
                      document.documentElement.style.colorScheme = "dark";
                    }
                  } catch (e) {}
                }

                applyTheme();

                window.addEventListener(
                  "pageshow",
                  function () {
                    applyTheme();
                  }
                );
              })();
            `,
          }}
        />

        <HeadContent />
      </head>

      <body style={{ backgroundColor: "inherit", color: "inherit" }}>
        <PreviewHostBridge />

        <AuthProvider>
          <Shell />
        </AuthProvider>

        <ScrollRestoration />

        <Scripts />

        <DeferredAnalytics />
      </body>
    </html>
  ),
});
