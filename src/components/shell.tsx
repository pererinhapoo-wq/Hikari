import {
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";

import { useServerFn } from "@tanstack/react-start";

import {
  Bell,
  Bookmark,
  CalendarDays,
  ChevronDown,
  Clapperboard,
  House,
  Menu,
  Newspaper,
  Search,
  Settings2,
  Tags,
  UserCircle,
  X,
} from "lucide-react";

import { Logo } from "@/components/logo";
import { isHikariAdmin } from "@/lib/auth/admin";
import { getBearerToken } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { searchCatalog } from "@/lib/api";
import { getProfile } from "@/lib/profile.functions";
import {
  displayTitle,
  type SlimAnime,
} from "@/lib/types";
import { overlayList } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  memo,
  useEffect,
  useRef,
  useState,
} from "react";

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;

  actorId: string | null;
  actorName: string | null;
  actorImage: string | null;

  commentId: string | null;
  animeId: string | null;
  episodeId: string | null;

  animeTitle: string | null;
  animeCover: string | null;

  commentLikes: number;

  likeAvatars: Array<{
    id: string;
    name: string | null;
    image: string | null;
  }>;
};

const BASE_NAV = [
  {
    to: "/",
    label: "Início",
    icon: House,
    match: (p: string) => p === "/",
  },
  {
    to: "/my-list",
    label: "Minha Lista",
    icon: Bookmark,
    match: (p: string) =>
      p.startsWith("/my-list"),
  },
  {
    to: "/browse/season",
    label: "Temporadas",
    icon: CalendarDays,
    match: (p: string) =>
      p.startsWith("/browse/season"),
  },
  {
    to: "/browse/genres",
    label: "Gêneros",
    icon: Tags,
    match: (p: string) =>
      p.startsWith("/browse/genres"),
  },
  {
    to: "/news",
    label: "Notícias",
    icon: Newspaper,
    match: (p: string) =>
      p.startsWith("/news"),
  },
  {
    to: "/account",
    label: "Conta",
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

const ShellMain = memo(function ShellMain({
  isBannerPage,
}: {
  isBannerPage: boolean;
}) {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-6xl px-4 pb-5 sm:px-6 sm:pb-8",
        isBannerPage && "-mt-14 sm:-mt-16",
      )}
    >
      <Outlet />
    </main>
  );
});

function ShellHeaderWrapper({
  pathname,
  isBannerPage,
  keepVisible,
  children,
}: {
  pathname: string;
  isBannerPage: boolean;
  keepVisible: boolean;
  children: React.ReactNode;
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const isScrolledRef = useRef(false);
  const showHeaderRef = useRef(true);

  // Mantém o cabeçalho imediatamente visível ao navegar para qualquer página
  useEffect(() => {
    const nextScrolled = window.scrollY > 15;
    showHeaderRef.current = true;
    isScrolledRef.current = nextScrolled;
    setShowHeader(true);
    setIsScrolled(nextScrolled);
  }, [pathname]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let rafId: number | null = null;

    const commitHeaderState = (nextScrolled: boolean, nextShow: boolean) => {
      if (isScrolledRef.current !== nextScrolled) {
        isScrolledRef.current = nextScrolled;
        setIsScrolled(nextScrolled);
      }
      if (showHeaderRef.current !== nextShow) {
        showHeaderRef.current = nextShow;
        setShowHeader(nextShow);
      }
    };

    const evaluateScroll = () => {
      rafId = null;
      const currentScrollY = window.scrollY;
      const nextScrolled = currentScrollY > 15;

      // Se qualquer painel/menu/busca estiver aberto, mantém o cabeçalho visível
      if (keepVisible) {
        commitHeaderState(nextScrolled, true);
        lastScrollY = currentScrollY;
        return;
      }

      let nextShow = showHeaderRef.current;

      // 1. No topo da página (<= 20px), exibir o cabeçalho normalmente (com fundo transparente nas páginas com banner)
      if (currentScrollY <= 20) {
        nextShow = true;
      } else if (currentScrollY > lastScrollY + 6 && currentScrollY > 50) {
        // 2. Quando o usuário começar a rolar para baixo, ocultar o cabeçalho inteiro
        nextShow = false;
      } else if (currentScrollY < lastScrollY - 6) {
        // 3. Assim que o usuário começar a rolar para cima, mostrar novamente o cabeçalho inteiro
        nextShow = true;
      }

      commitHeaderState(nextScrolled, nextShow);
      lastScrollY = currentScrollY;
    };

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(evaluateScroll);
    };

    evaluateScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [keepVisible]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[transform,opacity,background-color,border-color] duration-300 ease-out will-change-transform",
        showHeader
          ? "translate-y-0 opacity-100 pointer-events-auto"
          : "-translate-y-full opacity-0 pointer-events-none",
        isBannerPage
          ? isScrolled
            ? cn(
                "border-b border-purple-500/15 bg-bg/85 shadow-[0_4px_24px_rgba(0,0,0,0.6)]",
                showHeader && "backdrop-blur-md",
              )
            : "border-b border-transparent bg-transparent"
          : isScrolled
            ? cn(
                "border-b border-purple-500/15 bg-bg/85 shadow-[0_4px_24px_rgba(0,0,0,0.6)]",
                showHeader && "backdrop-blur-md",
              )
            : cn(
                "border-b border-border bg-bg/85",
                showHeader && "backdrop-blur-md",
              ),
      )}
    >
      {/* Degradê sutil de proteção para contraste no topo do banner */}
      {isBannerPage && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-b from-black/80 via-black/35 to-transparent transition-opacity duration-300 -z-10",
            isScrolled ? "opacity-0" : "opacity-100",
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </header>
  );
}

export function Shell() {
  const pathname =
    useRouterState({
      select: (s) =>
        s.location.pathname,
    });

  const { user } =
    useCurrentUserState();

  const getProfileFn =
    useServerFn(getProfile);

  const [profileNick, setProfileNick] =
    useState("");

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [adultMenuOpen, setAdultMenuOpen] =
    useState(false);

  const [
    notificationsOpen,
    setNotificationsOpen,
  ] = useState(false);

  const [
    notifications,
    setNotifications,
  ] = useState<NotificationItem[]>([]);

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [
    notificationsLoading,
    setNotificationsLoading,
  ] = useState(false);

  /* =========================================================
     TRAVA ROLAGEM DO FUNDO AO ABRIR NOTIFICAÇÕES
  ========================================================== */

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [notificationsOpen]);

  /* =========================================================
     TRAVA ROLAGEM DO FUNDO AO ABRIR O MENU LATERAL
  ========================================================== */

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [menuOpen]);

  /* =========================================================
     PERFIL PÚBLICO
  ========================================================== */

  useEffect(() => {
    if (!user?.id) {
      setProfileNick("");
      return;
    }

    let active = true;

    void getProfileFn()
      .then((profile) => {
        if (!active) return;

        setProfileNick(profile.nick);
      })
      .catch(() => {
        if (!active) return;

        setProfileNick("");
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  /* =========================================================
     BUSCA
  ========================================================== */

  const [
    searchOpen,
    setSearchOpen,
  ] = useState(false);

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    searchResults,
    setSearchResults,
  ] = useState<SlimAnime[]>([]);

  const [
    searchLoading,
    setSearchLoading,
  ] = useState(false);

  const localAnimes =
    useHikariStore(
      (s) => s.animes,
    );

  const cinema =
    pathname.startsWith(
      "/watch",
    );

  const isBannerPage =
    pathname === "/" ||
    pathname.startsWith("/anime/");

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

  /* =========================================================
     BUSCA AUTOMÁTICA
  ========================================================== */

  useEffect(() => {
    const q = searchQuery.trim();

    if (!searchOpen || !q) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setSearchLoading(true);

      try {
        const isAdultArea =
          window.location.pathname.startsWith(
            "/adult",
          );

        const result = await searchCatalog({
          data: {
            q,
            page: 1,
            adult: isAdultArea,
          },
        });

        if (cancelled) return;

        const normalized = q
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();

        const localHits = overlayList(
          [],
          localAnimes,
        ).filter((anime) => {
          const isHentai =
            anime.genres?.some(
              (genre) =>
                genre.trim().toLowerCase() ===
                "hentai",
            ) ?? false;

          if (
            isAdultArea
              ? !isHentai
              : isHentai
          ) {
            return false;
          }

          const title =
            `${anime.titles.romaji} ${anime.titles.english} ${anime.titles.native}`
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase();

          return title.includes(normalized);
        });

        const remote = overlayList(
          result.items ?? [],
          localAnimes,
        );

        const seen = new Set<string>();
        const merged: SlimAnime[] = [];

        for (const anime of [
          ...localHits,
          ...remote,
        ]) {
          if (seen.has(anime.id)) continue;

          seen.add(anime.id);
          merged.push(anime);
        }

        const ranked = merged.sort((a, b) => {
          const aTitle =
            `${a.titles.romaji} ${a.titles.english} ${a.titles.native}`
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase();

          const bTitle =
            `${b.titles.romaji} ${b.titles.english} ${b.titles.native}`
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase();

          const aStarts =
            aTitle.startsWith(
              normalized,
            );

          const bStarts =
            bTitle.startsWith(
              normalized,
            );

          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;

          const aContains =
            aTitle.includes(
              normalized,
            );

          const bContains =
            bTitle.includes(
              normalized,
            );

          if (aContains && !bContains) return -1;
          if (!aContains && bContains) return 1;

          return 0;
        });

        setSearchResults(ranked);
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    searchOpen,
    searchQuery,
    localAnimes,
  ]);

  /* =========================================================
     NOTIFICAÇÕES
  ========================================================== */

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    let cancelled = false;

    const loadNotifications =
      async () => {
        try {
          const bearer = getBearerToken();
          const response =
            await fetch(
              "/api/notifications",
              {
                method: "GET",
                credentials: "include",
                headers: bearer
                  ? { Authorization: `Bearer ${bearer}` }
                  : undefined,
              },
            );

          if (!response.ok) {
            return;
          }

          const data =
            (await response.json()) as {
              notifications?: NotificationItem[];
              unreadCount?: number;
            };

          if (cancelled) {
            return;
          }

          setNotifications(
            data.notifications ?? [],
          );

          setUnreadCount(
            Number(
              data.unreadCount ?? 0,
            ),
          );
        } catch {
          // Mantém o estado atual caso a API esteja indisponível.
        }
      };

    void loadNotifications();

    const interval =
      window.setInterval(
        loadNotifications,
        30000,
      );

    const handleVisibilityOrSync = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      void loadNotifications();
    };

    window.addEventListener("focus", handleVisibilityOrSync);
    document.addEventListener("visibilitychange", handleVisibilityOrSync);
    window.addEventListener(
      "hikari:notifications-updated",
      handleVisibilityOrSync,
    );

    return () => {
      cancelled = true;

      window.clearInterval(
        interval,
      );
      window.removeEventListener("focus", handleVisibilityOrSync);
      document.removeEventListener("visibilitychange", handleVisibilityOrSync);
      window.removeEventListener(
        "hikari:notifications-updated",
        handleVisibilityOrSync,
      );
    };
  }, [user?.id]);

  const markNotificationAsRead =
    async (
      id: string,
    ) => {
      const target =
        notifications.find(
          (notification) =>
            notification.id === id,
        );

      if (!target || target.read) {
        return;
      }

      setNotifications(
        (current) =>
          current.map(
            (notification) =>
              notification.id === id
                ? {
                    ...notification,
                    read: true,
                  }
                : notification,
          ),
      );

      setUnreadCount(
        (current) =>
          Math.max(0, current - 1),
      );

      try {
        const bearer = getBearerToken();
        const response =
          await fetch(
            "/api/notifications",
            {
              method: "PATCH",
              credentials: "include",
              headers: {
                "Content-Type":
                  "application/json",
                ...(bearer
                  ? { Authorization: `Bearer ${bearer}` }
                  : {}),
              },
              body: JSON.stringify({
                id,
              }),
            },
          );

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as {
            unreadCount?: number;
          };

        setUnreadCount(
          Number(
            data.unreadCount ?? 0,
          ),
        );

        window.dispatchEvent(
          new CustomEvent("hikari:notifications-updated"),
        );
      } catch {
        // Mantém a alteração visual.
      }
    };

  const openNotifications =
    async () => {
      setNotificationsOpen(
        true,
      );

      if (!user) {
        return;
      }

      setNotificationsLoading(
        true,
      );

      try {
        const bearer = getBearerToken();
        const response =
          await fetch(
            "/api/notifications",
            {
              method: "GET",
              credentials: "include",
              headers: bearer
                ? { Authorization: `Bearer ${bearer}` }
                : undefined,
            },
          );

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as {
            notifications?: NotificationItem[];
            unreadCount?: number;
          };

        setNotifications(
          data.notifications ?? [],
        );

        setUnreadCount(
          Number(
            data.unreadCount ?? 0,
          ),
        );
      } catch {
        // Mantém os dados atuais.
      } finally {
        setNotificationsLoading(
          false,
        );
      }
    };

  if (cinema) {
    return <Outlet />;
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">

      {/* =========================================================
          HEADER
          - No topo: transparente sobre o banner
          - Ao rolar para baixo: oculta o cabeçalho inteiro suavemente
          - Ao rolar para cima: reaparece o cabeçalho inteiro com fundo translúcido
      ========================================================== */}
      <ShellHeaderWrapper
        pathname={pathname}
        isBannerPage={isBannerPage}
        keepVisible={searchOpen || notificationsOpen || menuOpen}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">

          {/* MENU */}
          <button
            type="button"
            onClick={() =>
              setMenuOpen(true)
            }
            className="flex size-11 items-center justify-center rounded-md text-fg hover:bg-elevated/70 transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="size-6" />
          </button>

          {/* LOGO OFICIAL HIKARI */}
          <div className="flex flex-1 items-center justify-center md:justify-start">
            <Logo size="md" />
          </div>

          {/* AÇÕES DA DIREITA */}
          <div className="flex items-center gap-1">

            {/* NOTIFICAÇÕES DESKTOP */}
            <button
              type="button"
              onClick={() => {
                if (
                  notificationsOpen
                ) {
                  setNotificationsOpen(
                    false,
                  );
                } else {
                  void openNotifications();
                }
              }}
              className="relative hidden size-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg md:flex"
              aria-label="Notificações"
              aria-expanded={
                notificationsOpen
              }
            >
              <Bell className="size-5" />

              {unreadCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex min-w-5 h-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-bg">
                  {unreadCount > 99
                    ? "99+"
                    : unreadCount}
                </span>
              )}
            </button>

            {/* BUSCA — escondida na área de Notícias */}
            {!pathname.startsWith("/news") && (
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(
                    (value) => !value,
                  );
                }}
                className="flex size-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg"
                aria-label="Buscar"
                aria-expanded={
                  searchOpen
                }
              >
                <Search className="size-5" />
              </button>
            )}

            {/* NOTIFICAÇÕES MOBILE */}
            <button
              type="button"
              onClick={() => {
                if (
                  notificationsOpen
                ) {
                  setNotificationsOpen(
                    false,
                  );
                } else {
                  void openNotifications();
                }
              }}
              className="relative flex size-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg md:hidden"
              aria-label="Notificações"
              aria-expanded={
                notificationsOpen
              }
            >
              <Bell className="size-5" />

              {unreadCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex min-w-5 h-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-bg">
                  {unreadCount > 99
                    ? "99+"
                    : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </ShellHeaderWrapper>

      {/* =========================================================
          PAINEL DE BUSCA
      ========================================================== */}
      {searchOpen && (
        <>
          <button
            type="button"
            onClick={() =>
              setSearchOpen(false)
            }
            className="fixed inset-0 z-40"
            aria-label="Fechar busca"
          />

          <div className="fixed left-4 right-4 top-16 z-50 mx-auto max-w-2xl overflow-hidden rounded-xl border border-border bg-bg shadow-2xl">

            <div className="border-b border-border p-3">
              <div className="relative">

                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />

                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(
                      e.target.value,
                    )
                  }
                  placeholder="Buscar animes…"
                  className="h-11 w-full rounded-lg border border-border bg-elevated pl-10 pr-3 text-sm text-fg outline-none placeholder:text-muted focus:border-fg/30"
                />

              </div>
            </div>

            {searchQuery.trim() && (
              <div className="max-h-[70vh] overflow-y-auto">

                {searchLoading ? (
                  <div className="px-4 py-8 text-center text-sm text-muted">
                    Buscando...
                  </div>
                ) : searchResults.length ===
                  0 ? (

                  <div className="px-4 py-8 text-center text-sm text-muted">
                    Nenhum anime encontrado.
                  </div>
                ) : (

                  <div>

                    {searchResults
                      .slice(0, 6)
                      .map(
                        (anime) => (
                          <Link
                            key={
                              anime.id
                            }
                            to="/anime/$id"
                            params={{
                              id:
                                anime.id,
                            }}
                            onClick={() =>
                              setSearchOpen(
                                false,
                              )
                            }
                            className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-elevated"
                          >

                            {anime.cover ? (
                              <img
                                src={
                                  anime.cover
                                }
                                alt=""
                                className="size-12 shrink-0 rounded-md object-cover"
                              />
                            ) : (
                              <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-elevated text-muted">
                                <Clapperboard className="size-5" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">

                              <p className="truncate text-sm font-medium text-fg">
                                {displayTitle(
                                  anime,
                                )}
                              </p>

                              <p className="mt-0.5 text-xs text-muted">
                                {anime.year ??
                                  ""}
                                {anime.year &&
                                anime.format
                                  ? " · "
                                  : ""}
                                {anime.format ===
                                "TV"
                                  ? "Série"
                                  : anime.format ===
                                      "MOVIE"
                                    ? "Filme"
                                    : ""}
                              </p>

                            </div>

                          </Link>
                        ),
                      )}

                    <Link
                      to="/search"
                      search={{
                        q:
                          searchQuery.trim(),
                        adult:
                          window.location.pathname.startsWith(
                            "/adult",
                          )
                            ? true
                            : undefined,
                      }}
                      onClick={() =>
                        setSearchOpen(
                          false,
                        )
                      }
                      className="block border-t border-border px-4 py-4 text-center text-sm font-medium text-fg hover:bg-elevated"
                    >
                      Ver todos os resultados
                    </Link>

                  </div>
                )}

              </div>
            )}

          </div>
        </>
      )}

      {/* =========================================================
          PAINEL DE NOTIFICAÇÕES
      ========================================================== */}
      {notificationsOpen && (
        <>
          <button
            type="button"
            onClick={() =>
              setNotificationsOpen(
                false,
              )
            }
            className="fixed inset-0 z-40"
            aria-label="Fechar notificações"
          />

          <div className="fixed right-4 top-16 z-50 flex max-h-[calc(100dvh-6rem)] w-[calc(100%-2rem)] max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-bg shadow-2xl md:right-6 md:top-20">

            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-4">
              <div>
                <h2 className="font-semibold">
                  Notificações
                </h2>

                <p className="mt-0.5 text-xs text-muted">
                  Suas atividades recentes
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setNotificationsOpen(
                    false,
                  )
                }
                className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg"
                aria-label="Fechar notificações"
              >
                <X className="size-5" />
              </button>
            </div>

            {notificationsLoading ? (
              <div className="flex min-h-32 flex-1 items-center justify-center px-5 py-8 text-center">
                <p className="text-sm text-muted">
                  Carregando...
                </p>
              </div>
            ) : notifications.length ===
              0 ? (

              <div className="flex min-h-32 flex-1 items-center justify-center px-5 py-8 text-center">
                <div>
                  <Bell className="mx-auto mb-3 size-7 text-muted" />

                  <p className="text-sm font-medium">
                    Nenhuma notificação
                  </p>

                  <p className="mt-1 text-xs text-muted">
                    Quando alguém interagir com seu perfil, aparecerá aqui.
                  </p>
                </div>
              </div>
            ) : (

              <div className="min-h-0 flex-1 overflow-y-auto">

                {notifications
                  .slice(0, 7)
                  .map(
                  (
                    notification,
                  ) => {

                    const hasEpisodeTarget =
                      Boolean(
                        notification.animeId &&
                        notification.episodeId &&
                        notification.episodeId !== "anime",
                      );

                    const hasAnimeTarget =
                      Boolean(
                        notification.animeId &&
                        (!notification.episodeId ||
                          notification.episodeId === "anime"),
                      );

                    const hasTarget =
                      hasEpisodeTarget || hasAnimeTarget;

                    const matchedLocal =
                      notification.animeId
                        ? localAnimes.find(
                            (a) =>
                              a.id === notification.animeId ||
                              (Number(notification.animeId) > 0 &&
                                (a.anilistId === Number(notification.animeId) ||
                                  a.malId === Number(notification.animeId))),
                          )
                        : undefined;

                    const resolvedAnimeTitle =
                      notification.animeTitle ||
                      (matchedLocal
                        ? matchedLocal.titleEnglish?.trim() ||
                          matchedLocal.titleRomaji?.trim() ||
                          matchedLocal.titleNative?.trim() ||
                          null
                        : null);

                    const resolvedAnimeCover =
                      notification.animeCover ||
                      matchedLocal?.cover ||
                      null;

                    const isLikeNotification =
                      notification.type ===
                      "comment_like";

                    const isReplyNotification =
                      notification.type ===
                      "comment_reply";

                    const likeCount =
                      Number(
                        notification.commentLikes ??
                          0,
                      );

                    const likeAvatars =
                      Array.isArray(
                        notification.likeAvatars,
                      )
                        ? notification.likeAvatars
                        : [];

                    const notificationMessage =
                      isLikeNotification &&
                      likeCount > 1 &&
                      notification.actorName
                        ? `${notification.actorName} e mais ${
                            likeCount - 1
                          } ${
                            likeCount - 1 ===
                            1
                              ? "pessoa"
                              : "pessoas"
                          } curtiram seu comentário.`
                        : notification.message;

                    const notificationContent =
                      (
                        <div
                          className={cn(
                            "border-b border-border px-4 py-4 last:border-b-0 transition-colors",
                            !notification.read &&
                              "border-l-4 border-l-blue-500 bg-blue-500/10",
                          )}
                        >
                          <div className="flex gap-3">

                            {notification.actorImage ? (
                              <img
                                src={
                                  notification.actorImage
                                }
                                alt=""
                                className="size-10 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated text-muted">
                                <UserCircle className="size-6" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">

                              <p className="text-sm leading-5">
                                {
                                  notificationMessage
                                }
                              </p>

                              {isLikeNotification && (
                                <div className="mt-2 flex items-center gap-2">

                                  {likeAvatars.length >
                                    0 && (
                                    <div className="flex items-center pl-1">

                                      {likeAvatars
                                        .slice(
                                          0,
                                          2,
                                        )
                                        .map(
                                          (
                                            avatar,
                                            index,
                                          ) => (
                                            <div
                                              key={
                                                avatar.id
                                              }
                                              className={cn(
                                                "relative size-7 overflow-hidden rounded-full border-2 border-bg bg-elevated",
                                                index >
                                                  0 &&
                                                  "-ml-2",
                                              )}
                                              style={{
                                                zIndex:
                                                  10 -
                                                  index,
                                              }}
                                            >
                                              {avatar.image ? (
                                                <img
                                                  src={
                                                    avatar.image
                                                  }
                                                  alt=""
                                                  className="size-full object-cover"
                                                />
                                              ) : (
                                                <div className="flex size-full items-center justify-center text-[10px] font-semibold text-muted">
                                                  {(
                                                    avatar.name ??
                                                    "U"
                                                  )
                                                    .charAt(
                                                      0,
                                                    )
                                                    .toUpperCase()}
                                                </div>
                                              )}
                                            </div>
                                          ),
                                        )}

                                    </div>
                                  )}

                                  <span className="text-xs font-medium text-muted">
                                    {
                                      likeCount
                                    }{" "}
                                    {likeCount ===
                                    1
                                      ? "curtida"
                                      : "curtidas"}
                                  </span>
                                </div>
                              )}

                              {(resolvedAnimeCover ||
                                resolvedAnimeTitle) && (
                                <div className="mt-3 flex items-center gap-3">

                                  {resolvedAnimeCover ? (
                                    <img
                                      src={
                                        resolvedAnimeCover
                                      }
                                      alt=""
                                      className="h-16 w-11 shrink-0 rounded-md object-cover"
                                    />
                                  ) : null}

                                  <div className="min-w-0 flex-1">

                                    {resolvedAnimeTitle && (
                                      <p className="truncate text-sm font-medium text-fg">
                                        {
                                          resolvedAnimeTitle
                                        }
                                      </p>
                                    )}

                                    {hasTarget &&
                                      (isLikeNotification ||
                                        isReplyNotification) && (
                                        <p className="mt-1 text-xs font-medium text-muted">
                                          {notification.commentId
                                            ? "Ver comentário"
                                            : hasAnimeTarget
                                              ? "Ver anime"
                                              : "Ver episódio"}
                                        </p>
                                      )}

                                  </div>
                                </div>
                              )}

                              {hasTarget &&
                                (isLikeNotification ||
                                  isReplyNotification) &&
                                !resolvedAnimeCover &&
                                !resolvedAnimeTitle && (
                                  <div className="mt-2">
                                    <span className="inline-flex items-center rounded-md bg-elevated px-2.5 py-1 text-xs font-medium text-fg">
                                      {notification.commentId
                                        ? "Ver comentário"
                                        : hasAnimeTarget
                                          ? "Ver anime"
                                          : "Ver episódio"}
                                    </span>
                                  </div>
                                )}

                              <p className="mt-1.5 text-[11px] text-muted">
                                {new Date(
                                  notification.createdAt,
                                ).toLocaleString(
                                  "pt-BR",
                                  {
                                    dateStyle:
                                      "short",
                                    timeStyle:
                                      "short",
                                  },
                                )}
                              </p>
                            </div>

                            {!notification.read && (
                              <span className="mt-1 size-2 shrink-0 rounded-full bg-blue-500" />
                            )}

                          </div>
                        </div>
                      );

                    if (
                      hasEpisodeTarget
                    ) {
                      return (
                        <Link
                          key={
                            notification.id
                          }
                          to="/watch/$id"
                          params={{
                            id:
                              notification.animeId!,
                          }}
                          search={{
                            ep:
                              notification.episodeId!,
                            comment:
                              notification.commentId ??
                              undefined,
                          }}
                          onClick={() => {
                            void markNotificationAsRead(
                              notification.id,
                            );

                            setNotificationsOpen(
                              false,
                            );
                          }}
                          className="block transition-colors hover:bg-elevated/70"
                        >
                          {
                            notificationContent
                          }
                        </Link>
                      );
                    }

                    if (
                      hasAnimeTarget
                    ) {
                      return (
                        <Link
                          key={
                            notification.id
                          }
                          to="/anime/$id"
                          params={{
                            id:
                              notification.animeId!,
                          }}
                          search={{
                            comment:
                              notification.commentId ??
                              undefined,
                          }}
                          onClick={() => {
                            void markNotificationAsRead(
                              notification.id,
                            );

                            setNotificationsOpen(
                              false,
                            );
                          }}
                          className="block transition-colors hover:bg-elevated/70"
                        >
                          {
                            notificationContent
                          }
                        </Link>
                      );
                    }


                    return (
                      <button
                        key={
                          notification.id
                        }
                        type="button"
                        onClick={() => {
                          void markNotificationAsRead(
                            notification.id,
                          );
                        }}
                        className="block w-full text-left transition-colors hover:bg-elevated/70"
                      >
                        {
                          notificationContent
                        }
                      </button>
                    );
                  },
                )}

              </div>
            )}

            {/* VER TODAS AS NOTIFICAÇÕES */}
            {!notificationsLoading &&
              notifications.length > 0 && (
                <Link
                  to="/notifications"
                  onClick={() =>
                    setNotificationsOpen(
                      false,
                    )
                  }
                  className="block shrink-0 border-t border-border px-4 py-4 text-center text-sm font-medium text-fg transition-colors hover:bg-elevated"
                >
                  Ver todas as notificações
                </Link>
              )}

          </div>
        </>
      )}

      {/* =========================================================
          MENU LATERAL
      ========================================================== */}
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

          <aside className="fixed inset-y-0 left-0 z-[60] w-[82%] max-w-sm overflow-y-auto bg-bg shadow-2xl">

            {/* CABEÇALHO DO MENU */}
            <div className="flex h-20 items-center justify-between border-b border-border px-5">
              <div onClick={() => setMenuOpen(false)}>
                <Logo size="md" />
              </div>

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

              {/* =================================================
                  NAVEGAÇÃO
              ================================================== */}
              <div>
                <p className="mb-2 px-4 text-[10px] font-semibold tracking-[0.18em] text-subtle uppercase">
                  Navegação
                </p>

                <div className="space-y-1">

                  {nav
                    .filter(
                      (item) =>
                        item.to === "/" ||
                        item.to === "/my-list" ||
                        item.to === "/account" ||
                        item.to === "/admin",
                    )
                    .map(
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

                </div>
              </div>

              {/* =================================================
                  ANIMES
              ================================================== */}
              <div className="mt-6">
                <p className="mb-2 px-4 text-[10px] font-semibold tracking-[0.18em] text-subtle uppercase">
                  Animes
                </p>

                <div className="space-y-1">

                  <Link
                    to="/browse/$section"
                    params={{ section: "season" }}
                    onClick={() =>
                      setMenuOpen(false)
                    }
                    className={cn(
                      "flex items-center gap-4 rounded-lg px-4 py-4 text-base font-medium transition-colors",
                      pathname.startsWith(
                        "/browse/season",
                      )
                        ? "bg-elevated text-fg"
                        : "text-muted hover:bg-elevated hover:text-fg",
                    )}
                  >
                    <CalendarDays className="size-5" />

                    <span>
                      Temporadas
                    </span>
                  </Link>

                  <Link
                    to="/browse/$section"
                    params={{ section: "genres" }}
                    onClick={() =>
                      setMenuOpen(false)
                    }
                    className={cn(
                      "flex items-center gap-4 rounded-lg px-4 py-4 text-base font-medium transition-colors",
                      pathname.startsWith(
                        "/browse/genres",
                      )
                        ? "bg-elevated text-fg"
                        : "text-muted hover:bg-elevated hover:text-fg",
                    )}
                  >
                    <Tags className="size-5" />

                    <span>
                      Gêneros
                    </span>
                  </Link>

                </div>
              </div>

              {/* =================================================
                  NOTÍCIAS
              ================================================== */}
              <div className="mt-6">
                <p className="mb-2 px-4 text-[10px] font-semibold tracking-[0.18em] text-subtle uppercase">
                  Notícias
                </p>

                <div className="space-y-1">

                  <Link
                    to="/news"
                    onClick={() =>
                      setMenuOpen(false)
                    }
                    className={cn(
                      "flex items-center gap-4 rounded-lg px-4 py-4 text-base font-medium transition-colors",
                      pathname.startsWith(
                        "/news",
                      )
                        ? "bg-elevated text-fg"
                        : "text-muted hover:bg-elevated hover:text-fg",
                    )}
                  >
                    <Newspaper className="size-5" />

                    <span>
                      Notícias
                    </span>
                  </Link>

                </div>
              </div>

              {/* =================================================
                  PERFIL
              ================================================== */}
              <div className="mt-6">
                <p className="mb-2 px-4 text-[10px] font-semibold tracking-[0.18em] text-subtle uppercase">
                  Perfil
                </p>

                <div className="space-y-1">

                  {user &&
                    profileNick && (
                      <Link
                        to="/profile/$nick"
                        params={{
                          nick: profileNick,
                        }}
                        onClick={() =>
                          setMenuOpen(
                            false,
                          )
                        }
                        className={cn(
                          "flex items-center gap-4 rounded-lg px-4 py-4 text-base font-medium transition-colors",
                          pathname ===
                            `/profile/${profileNick}`
                            ? "bg-elevated text-fg"
                            : "text-muted hover:bg-elevated hover:text-fg",
                        )}
                      >
                        <UserCircle className="size-5" />

                        <span>
                          Meu perfil público
                        </span>
                      </Link>
                    )}

                  <Link
                    to="/settings"
                    onClick={() =>
                      setMenuOpen(
                        false,
                      )
                    }
                    className={cn(
                      "flex items-center gap-4 rounded-lg px-4 py-4 text-base font-medium transition-colors",
                      pathname.startsWith(
                        "/settings",
                      )
                        ? "bg-elevated text-fg"
                        : "text-muted hover:bg-elevated hover:text-fg",
                    )}
                  >
                    <Settings2 className="size-5" />

                    <span>
                      Configurações
                    </span>
                  </Link>

                </div>
              </div>

              {/* =================================================
                  OUTROS
              ================================================== */}
              <div className="mt-6">
                <p className="mb-2 px-4 text-[10px] font-semibold tracking-[0.18em] text-subtle uppercase">
                  Outros
                </p>

                <div className="space-y-1">

                  <button
                    type="button"
                    onClick={() =>
                      setAdultMenuOpen(
                        (value) => !value,
                      )
                    }
                    className={cn(
                      "flex w-full items-center gap-4 rounded-lg px-4 py-4 text-base font-medium transition-colors",
                      ADULT_NAV.match(
                        pathname,
                      )
                        ? "bg-elevated text-fg"
                        : "text-muted hover:bg-elevated hover:text-fg",
                    )}
                    aria-expanded={
                      adultMenuOpen
                    }
                  >
                    <span className="flex size-5 items-center justify-center text-base">
                      🔞
                    </span>

                    <span className="flex-1 text-left">
                      +18
                    </span>

                    <ChevronDown
                      className={cn(
                        "size-5 transition-transform",
                        adultMenuOpen &&
                          "rotate-180",
                      )}
                    />
                  </button>

                  {adultMenuOpen && (
                    <div className="ml-9 space-y-1 border-l border-border pl-3">
                      <Link
                        to={ADULT_NAV.to}
                        onClick={() =>
                          setMenuOpen(
                            false,
                          )
                        }
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                          pathname === "/adult"
                            ? "bg-elevated text-fg"
                            : "text-muted hover:bg-elevated hover:text-fg",
                        )}
                      >
                        <span>Início</span>
                      </Link>

                      <Link
                        to="/adult/news"
                        onClick={() =>
                          setMenuOpen(false)
                        }
                        className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted transition hover:bg-elevated hover:text-fg"
                      >
                        <span>Notícias +18</span>
                      </Link>

                      <Link
                        to="/adult/tags"
                        onClick={() =>
                          setMenuOpen(false)
                        }
                        className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted transition hover:bg-elevated hover:text-fg"
                      >
                        <Tags className="size-5" />
                        <span>Tags</span>
                      </Link>

                    </div>
                  )}

                </div>
              </div>

            </nav>
          </aside>
        </>
      )}

      {/* =========================================================
          CONTEÚDO PRINCIPAL
      ========================================================== */}
      <ShellMain isBannerPage={isBannerPage} />

      {/* =========================================================
          FOOTER
      ========================================================== */}
      <footer className="mx-auto hidden max-w-6xl items-center justify-between px-6 py-8 text-xs text-subtle md:flex">
        <p>
          Hikari 光 — catálogo via AniList, com MyAnimeList como reserva.
        </p>

        <p className="inline-flex items-center gap-1.5">
          <Clapperboard className="size-3.5" />

          Trailers e episódios com URL própria
        </p>
      </footer>

    </div>
  );
}
