import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Bookmark, Clapperboard, House, Search, Settings2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Início", icon: House, match: (p: string) => p === "/" },
  { to: "/search", label: "Buscar", icon: Search, match: (p: string) => p.startsWith("/search") || p.startsWith("/browse") },
  { to: "/my-list", label: "Lista", icon: Bookmark, match: (p: string) => p.startsWith("/my-list") },
  { to: "/admin", label: "Admin", icon: Settings2, match: (p: string) => p.startsWith("/admin") },
] as const;

export function Shell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cinema = pathname.startsWith("/watch");

  if (cinema) return <Outlet />;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "inline-flex h-11 items-center px-3 text-sm transition-colors",
                    active ? "text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Link
            to="/search"
            className="flex size-10 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg md:hidden"
            aria-label="Buscar"
          >
            <Search className="size-5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 sm:pb-16">
        <Outlet />
      </main>

      <footer className="mx-auto hidden max-w-6xl items-center justify-between px-6 py-8 text-xs text-subtle md:flex">
        <p>Hikari 光 — catálogo via AniList, com MyAnimeList como reserva.</p>
        <p className="inline-flex items-center gap-1.5">
          <Clapperboard className="size-3.5" />
          Trailers e episódios com URL própria
        </p>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-4">
          {NAV.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px] tracking-wide uppercase",
                    active ? "text-fg" : "text-subtle",
                  )}
                >
                  <Icon className="size-[18px]" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
