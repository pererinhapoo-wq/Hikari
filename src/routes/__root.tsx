import { lazy, Suspense, useEffect, useState } from "react";
import {
  createRootRoute,
  HeadContent,
  Scripts,
  ScrollRestoration,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { AuthProvider } from "@/lib/auth/provider";
import type { AppUser } from "@/lib/auth/use-current-user";

import { PreviewHostBridge } from "@/components/preview-host-bridge";

import { Shell } from "@/components/shell";

import appCss from "../styles.css?url";

const fetchRootSessionUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<AppUser | null> => {
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const { auth, authConfigured } = await import("@/lib/auth/server");
      const { gateIdentityEnabled } = await import(
        "@/lib/auth/gate-identity.server"
      );
      const { DEV_USER_ID } = await import("@/lib/auth/verify.server");
      const { getSql } = await import("@/lib/db");

      const realAuthActive = authConfigured || gateIdentityEnabled();
      let resolvedUser: AppUser | null = null;

      if (realAuthActive) {
        const request = getRequest();
        if (!request) return null;
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return null;
        resolvedUser = {
          id: session.user.id,
          displayName: session.user.name ?? null,
          primaryEmail: session.user.email ?? null,
          profileImageUrl: session.user.image ?? null,
          profileNick: null,
          isDevFallback: false,
        };
      } else {
        const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());
        if (databaseConfigured) return null;
        resolvedUser = {
          id: DEV_USER_ID,
          displayName: "Dev User",
          primaryEmail: "dev@example.com",
          profileImageUrl: null,
          profileNick: null,
          isDevFallback: true,
        };
      }

      try {
        const sql = await getSql();
        const [profileRows, userRows] = await Promise.all([
          sql<{
            displayName: string | null;
            nick: string | null;
            avatarUrl: string | null;
          }>`
            select "displayName", "nick", "avatarUrl"
            from "profile"
            where "userId" = ${resolvedUser.id}
            limit 1
          `,
          sql<{
            name: string | null;
            image: string | null;
          }>`
            select "name", "image"
            from "user"
            where "id" = ${resolvedUser.id}
            limit 1
          `,
        ]);

        const prof = profileRows[0];
        const usr = userRows[0];

        const resolvedName = prof?.displayName || usr?.name || null;
        const resolvedAvatar = prof?.avatarUrl || usr?.image || null;

        if (resolvedName) {
          resolvedUser.displayName = resolvedName;
        }
        if (resolvedAvatar) {
          resolvedUser.profileImageUrl = resolvedAvatar;
        }
        if (prof?.nick) {
          resolvedUser.profileNick = prof.nick;
        }
      } catch {
        // Fallback para os metadados básicos da sessão caso o perfil ainda não exista
      }

      return resolvedUser;
    } catch {
      return null;
    }
  },
);

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
  staleTime: Infinity,
  shouldReload: false,
  loader: async () => ({
    sessionUser: await fetchRootSessionUser(),
  }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, interactive-widget=resizes-content",
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

  component: RootDocument,
});

function RootDocument() {
  const loaderData = Route.useLoaderData();
  return (
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
                    var match = document.cookie.match(/(?:^|;\\s*)hikari-theme=([^;]+)/);
                    var theme = match ? decodeURIComponent(match[1]) : null;
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

        <AuthProvider initialSessionUser={loaderData?.sessionUser ?? null}>
          <Shell />
        </AuthProvider>

        <ScrollRestoration />

        <Scripts />

        <DeferredAnalytics />
      </body>
    </html>
  );
}
