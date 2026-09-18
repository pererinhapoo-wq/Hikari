import {
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";

import {
  Bell,
  Bookmark,
  Clapperboard,
  House,
  Menu,
  Search,
  Settings2,
  UserCircle,
  X,
} from "lucide-react";

import { Logo } from "@/components/logo";
import { isHikariAdmin } from "@/lib/auth/admin";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { useState } from "react";

const BASE_NAV = [
  {
    to: "/",
    label: "Início",
    icon: House,
    match: (p: string) =>
      p === "/",
  },
  {
    to: "/search",
    label: "Buscar",
    icon: Search,
    match: (p: string) =>
      p.startsWith("/search") ||
      p.startsWith("/browse"),
  },
  {
    to: "/my-list",
    label: "Lista",
    icon: Bookmark,
    match: (p: string) =>
      p.startsWith("/my-list"),
  },
  {
    to: "/account",
    label: "Perfil",
    icon: UserCircle,
    match: (p: string) =>
      p.startsWith("/account") ||
      p.startsWith("/login"),
  },
] as const;

const ADULT_NAV = {
  to: "/adult",
  label: "🔞 +18",
  match: (p: string) =>
    p.startsWith("/adult"),
} as const;

export function Shell() {
  const pathname =
    useRouterState({
      select: (s) =>
        s.location.pathname,
    });

  const { user } =
    useCurrentUserState();

  const [menuOpen, setMenuOpen] =
    useState(false);

  const cinema =
    pathname.startsWith(
      "/watch",
    );

  const nav =
    user &&
    isHikariAdmin(
      user.primaryEmail,
    )
      ? [
          ...BASE_NAV,
          {
            to: "/admin",
            label: "Admin",
            icon: Settings2,
            match: (p: string) =>
              p.startsWith(
                "/admin",
              ),
          },
        ]
      : BASE_NAV;

  const bottomNav =
    BASE_NAV;

  if (cinema) {
    return <Outlet />;
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          {/* MENU */}
          <button
            type="button"
            onClick={() =>
              setMenuOpen(true)
            }
            className="flex size-11 items-center justify-center rounded-md text-fg hover:bg-elevated"
            aria-label="Abrir menu"
          >
            <Menu className="size-6" />
          </button>

          {/* LOGO */}
          <Logo />

          {/* NAVEGAÇÃO DESKTOP */}
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map(
              (item) => {
                const active =
                  item.match(
                    pathname,
                  );

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "inline-flex h-11 items-center px-3 text-sm transition-colors",
                      active
                        ? "text-fg"
                        : "text-muted hover:text-fg",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              },
            )}
          </nav>

          {/* AÇÕES DA DIREITA */}
          <div className="flex items-center gap-1">
            {/* NOTIFICAÇÕES DESKTOP */}
            <button
              type="button"
              className="relative hidden size-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg md:flex"
              aria-label="Notificações"
            >
              <Bell className="size-5" />

              {/* PONTO VERMELHO */}
              <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-red-500 ring-2 ring-bg" />
            </button>

            {/* BUSCA MOBILE */}
            <Link
              to="/search"
              className="flex size-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg md:hidden"
              aria-label="Buscar"
            >
              <Search className="size-5" />
            </Link>

            {/* NOTIFICAÇÕES MOBILE */}
            <button
              type="button"
              className="relative flex size-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg md:hidden"
              aria-label="Notificações"
            >
              <Bell className="size-5" />

              {/* PONTO VERMELHO */}
              <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-red-500 ring-2 ring-bg" />
            </button>
          </div>
        </div>
      </header>

      {/* MENU LATERAL */}
      {menuOpen && (
        <>
          <button
            type="button"
            onClick={() =>
              setMenuOpen(false)
            }
            className="fixed inset-0 z-50 bg-black/60"
            aria-label="Fechar menu"
          />

          <aside className="fixed inset-y-0 left-0 z-[60] w-[82%] max-w-sm bg-bg shadow-2xl">
            <div className="flex h-20 items-center justify-between border-b border-border px-5">
              <Logo />

              <button
                type="button"
                onClick={() =>
                  setMenuOpen(false)
                }
                className="flex size-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg"
                aria-label="Fechar menu"
              >
                <X className="size-6" />
              </button>
            </div>

            <nav className="p-4">
              <div className="space-y-1">
                {nav.map(
                  (item) => {
                    const active =
                      item.match(
                        pathname,
                      );

                    const Icon =
                      item.icon;

                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() =>
                          setMenuOpen(
                            false,
                          )
                        }
                        className={cn(
                          "flex items-center gap-4 rounded-lg px-4 py-4 text-base font-medium transition-colors",
                          active
                            ? "bg-elevated text-fg"
                            : "text-muted hover:bg-elevated hover:text-fg",
                        )}
                      >
                        <Icon className="size-5" />
                        {item.label}
                      </Link>
                    );
                  },
                )}

                <Link
                  to={ADULT_NAV.to}
                  onClick={() =>
                    setMenuOpen(
                      false,
                    )
                  }
                  className={cn(
                    "flex items-center gap-4 rounded-lg px-4 py-4 text-base font-medium transition-colors",
                    ADULT_NAV.match(
                      pathname,
                    )
                      ? "bg-elevated text-fg"
                      : "text-muted hover:bg-elevated hover:text-fg",
                  )}
                >
                  <span className="flex size-5 items-center justify-center text-base">
                    🔞
                  </span>

                  <span>
                    +18
                  </span>
                </Link>
              </div>
            </nav>
          </aside>
        </>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-16">
        <Outlet />
      </main>

      <footer className="mx-auto hidden max-w-6xl items-center justify-between px-6 py-8 text-xs text-subtle md:flex">
        <p>
          Hikari 光 — catálogo via AniList, com MyAnimeList como reserva.
        </p>

        <p className="inline-flex items-center gap-1.5">
          <Clapperboard className="size-3.5" />
          Trailers e episódios com URL própria
        </p>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-4">
          {bottomNav.map(
            (item) => {
              const active =
                item.match(
                  pathname,
                );

              const Icon =
                item.icon;

              return (
                <li
                  key={item.to}
                >
                  <Link
                    to={item.to}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] tracking-wide uppercase",
                      active
                        ? "text-fg"
                        : "text-subtle",
                    )}
                  >
                    <Icon className="size-5" />
                    {item.label}
                  </Link>
                </li>
              );
            },
          )}
        </ul>
      </nav>
    </div>
  );
    }
