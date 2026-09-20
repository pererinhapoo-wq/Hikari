import {
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "@/lib/auth/provider";

import { PreviewHostBridge } from "@/components/preview-host-bridge";

import { Shell } from "@/components/shell";

import appCss from "../styles.css?url";

const APP_NAME = "HIKARI";

const getTheme = createServerFn({
  method: "GET",
}).handler(() => {
  const theme = getCookie("hikari-theme");

  if (theme === "Claro") {
    return "Claro";
  }

  return "Escuro";
});

export const Route = createRootRoute({
  beforeLoad: async () => {
    const theme = await getTheme();

    return {
      theme,
    };
  },

  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: APP_NAME,
      },
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
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
      },
      {
        rel: "stylesheet",
        href:
          "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600&family=Noto+Serif+JP:wght@500;600&display=swap",
      },
    ],
  }),

  component: () => {
    const { theme } =
      Route.useRouteContext();

    const isLight =
      theme === "Claro";

    return (
      <html
        lang="pt-BR"
        className="antialiased"
        data-theme={
          isLight ? "light" : undefined
        }
        suppressHydrationWarning
      >
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function () {
                  try {
                    var savedTheme =
                      localStorage.getItem("hikari-theme");

                    if (savedTheme === "Claro") {
                      document.documentElement.setAttribute(
                        "data-theme",
                        "light"
                      );
                    } else if (savedTheme === "Escuro") {
                      document.documentElement.removeAttribute(
                        "data-theme"
                      );
                    }
                  } catch (e) {}
                })();
              `,
            }}
          />

          <HeadContent />
        </head>

        <body>
          <PreviewHostBridge />

          <AuthProvider>
            <Shell />
          </AuthProvider>

          <Scripts />

          <Analytics />
        </body>
      </html>
    );
  },
});
