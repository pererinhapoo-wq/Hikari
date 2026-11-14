import {
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";

import {
  Bell,
  Calendar,
  CalendarDays,
  CheckCheck,
  CircleUserRound,
  House,
  Loader2,
  LogIn,
  Menu,
  Search,
  Settings2,
  Tags,
  UserPlus,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ProfileSaveNotification } from "@/components/profile/ProfileSaveNotification";
import { ProfileDropdownMenu } from "@/components/profile/ProfileDropdownMenu";
import type { NotificationItem } from "@/components/notifications/notification-item-card";
import { isHikariAdmin } from "@/lib/auth/admin";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useHikariStore } from "@/lib/store";
import {
  cn,
  currentAnimeSeason,
} from "@/lib/utils";
import { useScrollLock } from "@/lib/scroll-lock";
import {
  setShellUiReady,
  useNotificationsPresentationReady,
} from "@/lib/presentation-sync";
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

let searchModalModulePromise: Promise<
  typeof import("@/components/search/SearchModal")
> | null = null;
function prefetchSearchModal() {
  if (!searchModalModulePromise) {
    searchModalModulePromise = import("@/components/search/SearchModal");
  }
  return searchModalModulePromise;
}

const LazySearchModal = lazy(() =>
  prefetchSearchModal().then((mod) => ({ default: mod.SearchModal })),
);

let loginMenuModulePromise: Promise<
  typeof import("@/components/LoginMenu")
> | null = null;
function prefetchLoginMenu() {
  if (!loginMenuModulePromise) {
    loginMenuModulePromise = import("@/components/LoginMenu");
  }
  return loginMenuModulePromise;
}

const LazyLoginMenu = lazy(() =>
  prefetchLoginMenu().then((mod) => ({ default: mod.LoginMenu })),
);



const LazyNotificationItemCard = lazy(() =>
  import("@/components/notifications/notification-item-card").then((mod) => ({
    default: mod.NotificationItemCard,
  })),
);

function useNotificationPanelPresence(open: boolean, exitMs = 170) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setMounted(false);
    }, exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs]);

  return {
    mounted: open || mounted,
    visible: open,
    closing: !open && mounted,
  };
}

const PANEL_BATCH_SIZE = 10;

function dedupeNotificationItems(list: NotificationItem[]): NotificationItem[] {
  const seenIds = new Set<string>();
  const seenGroupedFollowerIds = new Set<string>();
  const result: NotificationItem[] = [];

  for (const item of list) {
    if (!item?.id || seenIds.has(item.id)) continue;

    if (item.type === "grouped_followers" && Array.isArray(item.groupedIds)) {
      for (const gid of item.groupedIds) {
        seenGroupedFollowerIds.add(gid);
      }
    } else if (item.type === "new_follower" && seenGroupedFollowerIds.has(item.id)) {
      continue;
    }

    seenIds.add(item.id);
    result.push(item);
  }

  return result;
}

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
  const headerRef = useRef<HTMLElement>(null);
  const isScrolledRef = useRef(false);
  const showHeaderRef = useRef(true);
  const isScrollingRef = useRef(false);

  // Mantém o cabeçalho imediatamente visível ao navegar para qualquer página
  useEffect(() => {
    const nextScrolled = window.scrollY > (isBannerPage ? 70 : 20);
    showHeaderRef.current = true;
    isScrolledRef.current = nextScrolled;
    isScrollingRef.current = false;
    const el = headerRef.current;
    if (el) {
      el.dataset.hidden = "false";
      el.dataset.scrolled = nextScrolled ? "true" : "false";
      el.dataset.scrolling = "false";
    }
  }, [pathname, isBannerPage]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let rafId: number | null = null;
    let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;

    const commitHeaderDataset = (nextScrolled: boolean, nextShow: boolean) => {
      const el = headerRef.current;
      if (isScrolledRef.current !== nextScrolled) {
        isScrolledRef.current = nextScrolled;
        if (el) {
          el.dataset.scrolled = nextScrolled ? "true" : "false";
        }
      }
      if (showHeaderRef.current !== nextShow) {
        showHeaderRef.current = nextShow;
        if (el) {
          el.dataset.hidden = nextShow ? "false" : "true";
        }
      }
    };

    const setScrollingActive = (active: boolean) => {
      if (isScrollingRef.current === active) return;
      isScrollingRef.current = active;
      const el = headerRef.current;
      if (el) {
        el.dataset.scrolling = active ? "true" : "false";
      }
    };

    const evaluateScroll = () => {
      rafId = null;
      const currentScrollY = window.scrollY;

      // Se qualquer painel/menu/busca estiver aberto, mantém o cabeçalho visível
      if (keepVisible) {
        commitHeaderDataset(currentScrollY > 20, true);
        lastScrollY = currentScrollY;
        return;
      }

      let nextShow = showHeaderRef.current;
      const scrollDelta = currentScrollY - lastScrollY;

      // 1. No topo da página (<= 40px no banner, <= 20px sem banner), exibir o cabeçalho normalmente
      const topThreshold = isBannerPage ? 40 : 20;
      if (currentScrollY <= topThreshold) {
        nextShow = true;
      } else if (scrollDelta > 12 && currentScrollY > 60) {
        // 2. Quando o usuário rolar para baixo com intenção clara, ocultar o cabeçalho
        nextShow = false;
      } else if (scrollDelta < -12) {
        // 3. Ao rolar para cima com intenção clara, mostrar novamente o cabeçalho
        nextShow = true;
      }

      // No banner, evita acionar backdrop-blur/fundo escuro transitório enquanto perto do topo
      let nextScrolled = currentScrollY > (isBannerPage ? 70 : 20);
      if (isBannerPage && !nextShow) {
        nextScrolled = false;
      }

      commitHeaderDataset(nextScrolled, nextShow);
      lastScrollY = currentScrollY;
    };

    const handleScroll = () => {
      setScrollingActive(true);
      if (scrollIdleTimer !== null) {
        clearTimeout(scrollIdleTimer);
      }
      scrollIdleTimer = setTimeout(() => {
        scrollIdleTimer = null;
        setScrollingActive(false);
      }, 160);

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
      if (scrollIdleTimer !== null) {
        clearTimeout(scrollIdleTimer);
      }
      setScrollingActive(false);
    };
  }, [keepVisible, isBannerPage]);

  return (
    <header
      ref={headerRef}
      data-r6="1"
      data-r7="1"
      data-scrolled="false"
      data-hidden="false"
      data-scrolling="false"
      className={cn(
        "group/header sticky top-0 z-40 transition-transform duration-150 ease-out",
        "data-[scrolling=true]:will-change-transform",
        "data-[hidden=false]:translate-y-0 data-[hidden=false]:pointer-events-auto",
        "data-[hidden=true]:-translate-y-full data-[hidden=true]:pointer-events-none",
        isBannerPage
          ? "border-b data-[scrolled=false]:border-transparent data-[scrolled=false]:bg-transparent data-[scrolled=true]:border-purple-500/15 data-[scrolled=true]:bg-black/75 md:data-[scrolled=true]:bg-black/60 md:data-[scrolled=true]:backdrop-blur-md data-[scrolled=true]:shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
          : "border-b data-[scrolled=false]:border-border data-[scrolled=true]:border-purple-500/15 data-[scrolled=true]:shadow-[0_4px_24px_rgba(0,0,0,0.6)] bg-bg/95 md:bg-bg/85 md:backdrop-blur-md",
      )}
    >
      {/* Degradê sutil de proteção para contraste no topo do banner */}
      {isBannerPage && (
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/80 via-black/35 to-transparent transition-opacity duration-150 -z-10 opacity-100 group-data-[scrolled=true]/header:opacity-0"
          aria-hidden="true"
        />
      )}
      {children}
    </header>
  );
}

function HomeFooterLazy() {
  return (
    <footer className="relative mt-12 w-full border-t border-purple-500/15 bg-gradient-to-b from-[#08070d] via-[#0d0b17] to-[#05040a] text-xs text-muted shadow-[0_-4px_24px_rgba(0,0,0,0.5)] [content-visibility:auto] [contain-intrinsic-size:auto_420px]">
      {/* Brilho decorativo sutil no topo do rodapé */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#a855f7]/30 to-transparent"
            aria-hidden="true"
          />

          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-8">
              {/* Identidade Hikari / Descrição */}
              <div className="space-y-3.5 md:col-span-5">
                <div className="flex items-center">
                  <Logo size="md" loading="lazy" fetchPriority="low" />
                </div>
                <p className="max-w-sm text-xs sm:text-sm leading-relaxed text-muted">
                  Plataforma de catálogo, acompanhamento e transmissão de animes com interface veloz, moderna e comunidade ativa.
                </p>
                <p className="text-[11px] leading-relaxed text-subtle">
                  Acompanhe os lançamentos semanais da temporada japonesa sincronizados com o horário de Brasília.
                </p>
              </div>

              {/* Links organizados em colunas */}
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:col-span-7">
                {/* Coluna 1: Institucional */}
                <div>
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-fg">
                    Institucional
                  </h3>
                  <ul className="space-y-2.5 text-xs sm:text-sm">
                    <li>
                      <Link
                        to="/sobre"
                        className="text-muted transition-colors hover:text-[#c084fc]"
                      >
                        Sobre o Hikari
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/contato"
                        className="text-muted transition-colors hover:text-[#c084fc]"
                      >
                        Fale Conosco
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Coluna 2: Legal */}
                <div>
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-fg">
                    Legal
                  </h3>
                  <ul className="space-y-2.5 text-xs sm:text-sm">
                    <li>
                      <Link
                        to="/termos"
                        className="text-muted transition-colors hover:text-[#c084fc]"
                      >
                        Termos de Uso
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/privacidade"
                        className="text-muted transition-colors hover:text-[#c084fc]"
                      >
                        Privacidade &amp; LGPD
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/dmca"
                        className="text-muted transition-colors hover:text-[#c084fc]"
                      >
                        DMCA / Direitos
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Coluna 3: Catálogo */}
                <div className="col-span-2 sm:col-span-1">
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-fg">
                    Catálogo
                  </h3>
                  <ul className="space-y-2.5 text-xs sm:text-sm">
                    <li>
                      <Link
                        to="/calendar"
                        className="text-muted transition-colors hover:text-[#c084fc]"
                      >
                        Calendário Semanal
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/browse/$section"
                        params={{ section: "popular" }}
                        className="text-muted transition-colors hover:text-[#c084fc]"
                      >
                        Explorar Populares
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/browse/$section"
                        params={{ section: "season" }}
                        className="text-muted transition-colors hover:text-[#c084fc]"
                      >
                        Temporadas
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Divisor */}
            <div className="my-8 border-t border-white/5" />

            {/* Rodapé inferior: Aviso legal de terceiros e Copyright */}
            <div className="flex flex-col gap-4 text-[11px] leading-relaxed text-subtle sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl">
                <strong>Isenção de Responsabilidade:</strong> O Hikari não hospeda nenhum arquivo de vídeo em seus servidores. Todos os episódios e vídeos são incorporados a partir de provedores externos independentes. Metadados e imagens fornecidos via AniList.
              </p>
              <p className="shrink-0 text-zinc-400">
                &copy; {new Date().getFullYear()} Hikari. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </footer>
  );
}

function VisitorDropdownMenu({ onOpenLogin }: { onOpenLogin: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative inline-block shrink-0 text-left font-sans">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={() => void prefetchLoginMenu()}
        onFocus={() => void prefetchLoginMenu()}
        className={cn(
          "group relative flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full select-none text-muted hover:text-fg hover:bg-elevated transition-colors border-0 border-none outline-none focus:outline-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]",
          open && "text-fg bg-elevated shadow-[0_0_18px_rgba(168,85,247,0.3)] ring-2 ring-[#a855f7]/75"
        )}
        aria-label="Opções de conta"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <CircleUserRound className="size-5 sm:size-5.5 text-[#c084fc] transition-transform group-hover:scale-105" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Menu de visitante"
          className="absolute right-0 top-full mt-2 w-48 sm:w-52 origin-top-right overflow-hidden rounded-xl border border-purple-500/20 bg-[#0c0a17]/98 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150 font-sans"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent"
          />
          <div className="space-y-0.5 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpenLogin();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs sm:text-[13px] font-sans font-medium text-zinc-200 hover:bg-purple-500/15 hover:text-white transition-colors cursor-pointer"
            >
              <LogIn className="size-4 text-[#c084fc] shrink-0" />
              <span>Entrar</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpenLogin();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs sm:text-[13px] font-sans font-medium text-purple-200 hover:bg-purple-500/15 hover:text-white transition-colors cursor-pointer"
            >
              <UserPlus className="size-4 text-[#c084fc] shrink-0" />
              <span>Criar conta</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Shell() {
  const pathname =
    useRouterState({
      select: (s) =>
        s.location.pathname,
    });

  const currentSeasonInfo = currentAnimeSeason();
  const isOnSeasonRoute = pathname.startsWith("/browse/season");

  const { user, isPending: authPending } =
    useCurrentUserState();

  useEffect(() => {
    useHikariStore.getState().setCurrentUserId(user?.id ?? null);
  }, [user?.id]);

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [loginModalOpen, setLoginModalOpen] =
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

  const [
    notificationsLoadingMore,
    setNotificationsLoadingMore,
  ] = useState(false);

  const [
    notificationsHasMore,
    setNotificationsHasMore,
  ] = useState(false);

  const notificationsPanel =
    useNotificationPanelPresence(notificationsOpen, 170);
  const notificationsPresentationReady = useNotificationsPresentationReady();

  useIsomorphicLayoutEffect(() => {
    setShellUiReady(false);

    if (authPending) {
      return;
    }

    let cancelled = false;
    let secondFrameId: number | null = null;
    const firstFrameId = window.requestAnimationFrame(() => {
      if (cancelled) return;
      secondFrameId = window.requestAnimationFrame(() => {
        if (cancelled) return;
        setShellUiReady(true);
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrameId);
      if (secondFrameId !== null) {
        window.cancelAnimationFrame(secondFrameId);
      }
      setShellUiReady(false);
    };
  }, [pathname, authPending]);

  const notificationsRef = useRef<NotificationItem[]>([]);
  notificationsRef.current = notifications;

  const notificationsOpenRef = useRef(notificationsOpen);
  notificationsOpenRef.current = notificationsOpen;

  const notificationsLoadingRef = useRef(notificationsLoading);
  notificationsLoadingRef.current = notificationsLoading;

  const notificationsHasMoreRef = useRef(false);
  notificationsHasMoreRef.current = notificationsHasMore;

  const loadingMoreRef = useRef(false);
  const notificationsNextOffsetRef = useRef(0);
  const loadedExtraBatchesRef = useRef(false);
  const hasLoadedNotificationsRef = useRef(false);
  const pendingReadTokensRef = useRef<Map<string, string>>(new Map());
  const notificationsScrollRef = useRef<HTMLDivElement | null>(null);
  const notificationsSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setNotificationsOpen(false);
    setSearchOpen(false);
    setLoginModalOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [notificationsOpen]);

  /* =========================================================
     TRAVA ROLAGEM DO FUNDO AO ABRIR O MENU LATERAL
  ========================================================== */
  useScrollLock(menuOpen);



  /* =========================================================
     BUSCA
  ========================================================== */

  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        void prefetchSearchModal();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const localAnimes = useHikariStore((s) => s.animes);

  const cinema = pathname.startsWith("/watch");
  const isAdmin = pathname.startsWith("/admin");

  const isBannerPage =
    pathname === "/" || pathname.startsWith("/anime/");

  const isHomePage = pathname === "/";

  /* =========================================================
     NOTIFICAÇÕES
  ========================================================== */

  const reconcileNotifications = useCallback(
    (rawList: NotificationItem[], rawUnread: number) => {
      let pendingOverrides = 0;

      const reconciled = rawList.map((item) => {
        const pendingCreatedAt = pendingReadTokensRef.current.get(item.id);
        if (pendingCreatedAt !== undefined) {
          if (item.read) {
            pendingReadTokensRef.current.delete(item.id);
            return item;
          }
          if (pendingCreatedAt === item.createdAt) {
            pendingOverrides += 1;
            return { ...item, read: true };
          }
          pendingReadTokensRef.current.delete(item.id);
        }
        return item;
      });

      return {
        notifications: reconciled,
        unreadCount: Math.max(0, rawUnread - pendingOverrides),
      };
    },
    [],
  );

  const userId = user?.id ?? null;
  const activeUserIdRef = useRef<string | null>(userId);
  activeUserIdRef.current = userId;

  const applyFirstBatchResponse = useCallback(
    (data: {
      notifications?: NotificationItem[];
      unreadCount?: number;
      hasMore?: boolean;
      nextOffset?: number;
    }) => {
      const reconciled = reconcileNotifications(
        data.notifications ?? [],
        Number(data.unreadCount ?? 0),
      );
      const firstBatch = dedupeNotificationItems(reconciled.notifications);
      const serverNextOffset =
        typeof data.nextOffset === "number"
          ? data.nextOffset
          : firstBatch.length;
      const serverHasMore = Boolean(data.hasMore);

      if (!loadedExtraBatchesRef.current || !notificationsOpenRef.current) {
        notificationsNextOffsetRef.current = serverNextOffset;
        notificationsHasMoreRef.current = serverHasMore;
        setNotificationsHasMore(serverHasMore);
        setNotifications(firstBatch);
        setUnreadCount(reconciled.unreadCount);
        return;
      }

      // Painel aberto com lotes adicionais carregados: atualiza o topo preservando os itens antigos rolados
      setNotifications((prev) => {
        if (!serverHasMore || firstBatch.length === 0) {
          notificationsNextOffsetRef.current = serverNextOffset;
          notificationsHasMoreRef.current = serverHasMore;
          setNotificationsHasMore(serverHasMore);
          return firstBatch;
        }

        const firstBatchIds = new Set(firstBatch.map((item) => item.id));
        const oldestFirstTime = Math.min(
          ...firstBatch.map((item) => {
            const parsed = Date.parse(item.createdAt);
            return Number.isNaN(parsed) ? Infinity : parsed;
          }),
        );

        const preservedTail = prev.filter((item) => {
          if (firstBatchIds.has(item.id)) return false;
          const itemTime = Date.parse(item.createdAt);
          if (Number.isNaN(itemTime) || oldestFirstTime === Infinity) return false;
          return itemTime < oldestFirstTime;
        });

        return dedupeNotificationItems([...firstBatch, ...preservedTail]);
      });
      setUnreadCount(reconciled.unreadCount);
    },
    [reconcileNotifications],
  );

  useEffect(() => {
    if (!userId) {
      hasLoadedNotificationsRef.current = false;
      loadedExtraBatchesRef.current = false;
      loadingMoreRef.current = false;
      notificationsNextOffsetRef.current = 0;
      notificationsHasMoreRef.current = false;
      pendingReadTokensRef.current.clear();
      setNotifications([]);
      setNotificationsHasMore(false);
      setNotificationsLoadingMore(false);
      setUnreadCount(0);
      return;
    }

    let cancelled = false;

    const loadNotifications = async () => {
      try {
        const { getBearerToken } = await import("@/lib/auth/client");
        const bearer = getBearerToken();
        const response = await fetch(
          `/api/notifications?limit=${PANEL_BATCH_SIZE}&offset=0`,
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

        const data = (await response.json()) as {
          notifications?: NotificationItem[];
          unreadCount?: number;
          hasMore?: boolean;
          nextOffset?: number;
        };

        if (cancelled) {
          return;
        }

        hasLoadedNotificationsRef.current = true;
        applyFirstBatchResponse(data);
      } catch {
        // Mantém o estado atual caso a API esteja indisponível.
      }
    };

    const POLL_INTERVAL_MS = 120_000;
    let intervalId: number | null = null;

    const stopPolling = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const startPolling = () => {
      if (typeof document !== "undefined" && document.hidden) {
        stopPolling();
        return;
      }
      if (intervalId !== null) {
        return;
      }
      intervalId = window.setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) {
          stopPolling();
          return;
        }
        void loadNotifications();
      }, POLL_INTERVAL_MS);
    };

    if (typeof document === "undefined" || !document.hidden) {
      void loadNotifications();
      startPolling();
    }

    const handleVisibilityOrSync = (event?: Event) => {
      if (
        event instanceof CustomEvent &&
        event.detail &&
        typeof event.detail === "object" &&
        (event.detail as { source?: string }).source === "shell-mark-read"
      ) {
        return;
      }
      if (
        typeof document !== "undefined" &&
        (document.hidden || document.visibilityState === "hidden")
      ) {
        stopPolling();
        return;
      }
      startPolling();
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

      stopPolling();
      window.removeEventListener("focus", handleVisibilityOrSync);
      document.removeEventListener("visibilitychange", handleVisibilityOrSync);
      window.removeEventListener(
        "hikari:notifications-updated",
        handleVisibilityOrSync,
      );
    };
  }, [userId, applyFirstBatchResponse]);

  const markNotificationsAsRead = useCallback(
    async (ids: string[]) => {
      if (!user || ids.length === 0) {
        return;
      }

      const requestedSet = new Set(ids);
      const targets = notificationsRef.current.filter(
        (item) =>
          requestedSet.has(item.id) &&
          !item.read &&
          pendingReadTokensRef.current.get(item.id) !== item.createdAt,
      );

      if (targets.length === 0) {
        return;
      }

      const targetIdSet = new Set<string>();
      for (const item of targets) {
        if (item.groupedIds && item.groupedIds.length > 0) {
          for (const gid of item.groupedIds) {
            targetIdSet.add(gid);
            pendingReadTokensRef.current.set(gid, item.createdAt);
          }
        }
        targetIdSet.add(item.id);
        pendingReadTokensRef.current.set(item.id, item.createdAt);
      }
      const targetIds = Array.from(targetIdSet);

      setNotifications((current) =>
        current.map((notification) =>
          targetIdSet.has(notification.id)
            ? { ...notification, read: true }
            : notification,
        ),
      );

      setUnreadCount((current) =>
        Math.max(0, current - targetIds.length),
      );

      try {
        const { getBearerToken } = await import("@/lib/auth/client");
        const bearer = getBearerToken();
        const response = await fetch("/api/notifications", {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          },
          body: JSON.stringify({ ids: targetIds }),
        });

        if (!response.ok) {
          for (const id of targetIds) {
            pendingReadTokensRef.current.delete(id);
          }
          window.dispatchEvent(
            new CustomEvent("hikari:notifications-updated"),
          );
          return;
        }

        const data = (await response.json()) as {
          unreadCount?: number;
        };

        for (const id of targetIds) {
          pendingReadTokensRef.current.delete(id);
        }

        const otherPendingCount = pendingReadTokensRef.current.size;
        setUnreadCount(
          Math.max(0, Number(data.unreadCount ?? 0) - otherPendingCount),
        );

        window.dispatchEvent(
          new CustomEvent("hikari:notifications-updated", {
            detail: { source: "shell-mark-read" },
          }),
        );
      } catch {
        for (const id of targetIds) {
          pendingReadTokensRef.current.delete(id);
        }
      }
    },
    [user],
  );

  const markAllNotificationsAsReadAction = useCallback(async () => {
    if (!user || unreadCount === 0) return;
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    try {
      const { getBearerToken } = await import("@/lib/auth/client");
      const bearer = getBearerToken();
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify({ all: true }),
      });
      window.dispatchEvent(new CustomEvent("hikari:notifications-updated"));
    } catch {
      // Falha não-bloqueante
    }
  }, [user, unreadCount]);

  const deleteNotificationAction = useCallback(
    async (id: string) => {
      if (!user) return;
      const target = notifications.find((i) => i.id === id);
      const wasUnread = target ? !target.read : false;
      const removedCount = wasUnread ? (target?.groupedIds?.length || 1) : 0;
      setNotifications((prev) => prev.filter((item) => item.id !== id));
      if (removedCount > 0) {
        setUnreadCount((c) => Math.max(0, c - removedCount));
      }
      try {
        const { getBearerToken } = await import("@/lib/auth/client");
        const bearer = getBearerToken();
        const res = target?.groupedIds?.length
          ? await fetch("/api/notifications", {
              method: "DELETE",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
              },
              body: JSON.stringify({ ids: target.groupedIds }),
            })
          : await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, {
              method: "DELETE",
              credentials: "include",
              headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
            });
        if (res.ok) {
          const data = (await res.json()) as { unreadCount?: number };
          if (typeof data.unreadCount === "number") {
            setUnreadCount(data.unreadCount);
          }
          window.dispatchEvent(new CustomEvent("hikari:notifications-updated"));
        }
      } catch {
        // Falha não-bloqueante
      }
    },
    [user, notifications],
  );

  const loadMoreNotifications = useCallback(async () => {
    const currentUserId = activeUserIdRef.current;
    if (
      !currentUserId ||
      !notificationsOpenRef.current ||
      notificationsLoadingRef.current ||
      loadingMoreRef.current ||
      !notificationsHasMoreRef.current
    ) {
      return;
    }

    const offsetToFetch = notificationsNextOffsetRef.current;
    loadingMoreRef.current = true;
    setNotificationsLoadingMore(true);

    try {
      const { getBearerToken } = await import("@/lib/auth/client");
      const bearer = getBearerToken();
      const response = await fetch(
        `/api/notifications?limit=${PANEL_BATCH_SIZE}&offset=${offsetToFetch}`,
        {
          method: "GET",
          credentials: "include",
          headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
        },
      );

      if (
        !response.ok ||
        activeUserIdRef.current !== currentUserId ||
        !notificationsOpenRef.current
      ) {
        return;
      }

      const data = (await response.json()) as {
        notifications?: NotificationItem[];
        unreadCount?: number;
        hasMore?: boolean;
        nextOffset?: number;
      };

      const incomingRaw = data.notifications ?? [];
      const reconciled = reconcileNotifications(
        incomingRaw,
        Number(data.unreadCount ?? 0),
      );

      let addedNewItems = false;
      setNotifications((prev) => {
        const merged = dedupeNotificationItems([
          ...prev,
          ...reconciled.notifications,
        ]);
        addedNewItems = merged.length > prev.length;
        return merged;
      });
      setUnreadCount(reconciled.unreadCount);

      const serverNextOffset =
        typeof data.nextOffset === "number"
          ? data.nextOffset
          : offsetToFetch + incomingRaw.length;
      const madeProgress =
        serverNextOffset > offsetToFetch || addedNewItems;
      const nextHasMore = Boolean(data.hasMore) && madeProgress && incomingRaw.length > 0;

      notificationsNextOffsetRef.current = serverNextOffset;
      notificationsHasMoreRef.current = nextHasMore;
      setNotificationsHasMore(nextHasMore);
      loadedExtraBatchesRef.current = true;
    } catch {
      // Falha silenciosa sem entrar em loop automático
    } finally {
      loadingMoreRef.current = false;
      setNotificationsLoadingMore(false);
    }
  }, [reconcileNotifications]);

  // Carregamento automático por proximidade do fim da lista via IntersectionObserver
  useEffect(() => {
    if (
      !notificationsOpen ||
      notificationsLoading ||
      !notificationsHasMore ||
      !user
    ) {
      return;
    }

    const rootEl = notificationsScrollRef.current;
    const sentinelEl = notificationsSentinelRef.current;
    if (!rootEl || !sentinelEl || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreNotifications();
        }
      },
      {
        root: rootEl,
        rootMargin: "120px 0px",
        threshold: 0,
      },
    );

    observer.observe(sentinelEl);
    return () => observer.disconnect();
  }, [
    notificationsOpen,
    notificationsLoading,
    notificationsHasMore,
    notifications.length,
    user,
    loadMoreNotifications,
  ]);

  const handleNotificationsScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (
        loadingMoreRef.current ||
        !notificationsHasMoreRef.current ||
        notificationsLoadingRef.current
      ) {
        return;
      }
      const el = e.currentTarget;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom <= 120) {
        void loadMoreNotifications();
      }
    },
    [loadMoreNotifications],
  );

  // Marca automaticamente como lidas as notificações exibidas ao abrir o sino
  useEffect(() => {
    if (!notificationsOpen || notificationsLoading || !user) {
      return;
    }

    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      return;
    }

    const displayedUnreadIds: string[] = [];
    for (const item of notifications.slice(0, PANEL_BATCH_SIZE)) {
      if (
        !item.read &&
        pendingReadTokensRef.current.get(item.id) !== item.createdAt
      ) {
        if (item.groupedIds && item.groupedIds.length > 0) {
          displayedUnreadIds.push(...item.groupedIds);
        } else {
          displayedUnreadIds.push(item.id);
        }
      }
    }

    if (displayedUnreadIds.length > 0) {
      void markNotificationsAsRead(displayedUnreadIds);
    }
  }, [
    notificationsOpen,
    notificationsLoading,
    notifications,
    user,
    markNotificationsAsRead,
  ]);

  const openNotifications = async () => {
    setNotificationsOpen(true);
    loadedExtraBatchesRef.current = false;
    loadingMoreRef.current = false;

    if (notificationsScrollRef.current) {
      notificationsScrollRef.current.scrollTop = 0;
    }

    if (!user) {
      return;
    }

    const showInitialLoader = !hasLoadedNotificationsRef.current;
    if (showInitialLoader) {
      setNotificationsLoading(true);
    }

    try {
      const { getBearerToken } = await import("@/lib/auth/client");
      const bearer = getBearerToken();
      const response = await fetch(
        `/api/notifications?limit=${PANEL_BATCH_SIZE}&offset=0`,
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

      const data = (await response.json()) as {
        notifications?: NotificationItem[];
        unreadCount?: number;
        hasMore?: boolean;
        nextOffset?: number;
      };

      hasLoadedNotificationsRef.current = true;
      applyFirstBatchResponse(data);
    } catch {
      // Mantém os dados atuais.
    } finally {
      if (showInitialLoader) {
        setNotificationsLoading(false);
      }
    }
  };

  if (cinema || isAdmin) {
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
        keepVisible={
          searchOpen ||
          notificationsOpen ||
          notificationsPanel.mounted ||
          menuOpen
        }
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-1.5 min-[380px]:gap-3 px-3 min-[380px]:px-4 sm:h-16 sm:px-6">

          {/* LADO ESQUERDO: Menu Mobile + Logo + Navegação Desktop */}
          <div className="flex min-w-0 shrink-0 items-center gap-1.5 min-[380px]:gap-3 sm:gap-6">
            {/* BOTÃO MENU (visível em telas menores que md) */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex size-9 min-[380px]:size-10 shrink-0 items-center justify-center rounded-xl text-fg hover:bg-elevated/70 transition-colors md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="size-5" />
            </button>

            {/* LOGO OFICIAL HIKARI */}
            <div className="flex shrink-0 items-center">
              <Logo size="md" />
            </div>

            {/* LINKS DE NAVEGAÇÃO DESKTOP */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Navegação principal">
              {/* Início */}
              <Link
                to="/"
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]",
                  pathname === "/"
                    ? "bg-[#a855f7]/15 text-[#c084fc] font-semibold shadow-[inset_0_0_0_1px_rgba(168,85,247,0.3)]"
                    : "text-muted hover:bg-elevated/70 hover:text-fg",
                )}
              >
                <House className="size-4" />
                <span>Início</span>
              </Link>

              {/* Calendário */}
              <Link
                to="/calendar"
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]",
                  pathname.startsWith("/calendar")
                    ? "bg-[#a855f7]/15 text-[#c084fc] font-semibold shadow-[inset_0_0_0_1px_rgba(168,85,247,0.3)]"
                    : "text-muted hover:bg-elevated/70 hover:text-fg",
                )}
              >
                <Calendar className="size-4" />
                <span>Calendário</span>
              </Link>


            </nav>
          </div>

          {/* AÇÕES DA DIREITA */}
          <div className="flex shrink-0 items-center gap-1 min-[380px]:gap-1.5 sm:gap-2">
            {/* BUSCA — escondida na área de Notícias */}
            {!pathname.startsWith("/news") && (
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((value) => !value);
                }}
                onMouseEnter={() => void prefetchSearchModal()}
                onFocus={() => void prefetchSearchModal()}
                className="flex size-8 min-[380px]:size-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-elevated hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7] active:scale-[0.97]"
                style={{ transition: "transform 120ms cubic-bezier(0.16, 1, 0.3, 1)" }}
                aria-label="Buscar"
                title="Buscar (Ctrl+K)"
                aria-expanded={searchOpen}
              >
                <Search className="size-4 sm:size-5" />
              </button>
            )}

            {/* NOTIFICAÇÕES (APENAS PARA USUÁRIOS AUTENTICADOS) */}
            {user && (
              <button
                type="button"
                onClick={() => {
                  if (notificationsOpen) {
                    setNotificationsOpen(false);
                  } else {
                    void openNotifications();
                  }
                }}
                className={cn(
                  "relative flex size-8 min-[380px]:size-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-elevated hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]",
                  "motion-safe:transition-[color,background-color,transform] motion-safe:duration-150 motion-safe:active:scale-95 motion-reduce:transition-none motion-reduce:transform-none",
                  notificationsOpen && "bg-elevated text-fg",
                )}
                aria-label="Notificações"
                aria-expanded={notificationsOpen}
              >
                <Bell className="size-4 sm:size-5" />

                {notificationsPresentationReady && unreadCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex min-w-4 h-4 sm:min-w-5 sm:h-5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] sm:text-[10px] font-bold leading-none text-white ring-2 ring-bg tabular-nums">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* PERFIL (QUANDO AUTENTICADO) OU BOTÃO DE CONTA (QUANDO VISITANTE) */}
            {user ? (
              <ProfileDropdownMenu user={user} />
            ) : (
              <VisitorDropdownMenu onOpenLogin={() => setLoginModalOpen(true)} />
            )}
          </div>
        </div>
      </ShellHeaderWrapper>

      {/* =========================================================
          PAINEL DE BUSCA REFORMULADO (ANIMES E USUÁRIOS)
      ========================================================== */}
      {searchOpen && (
        <Suspense fallback={null}>
          <LazySearchModal
            isOpen={searchOpen}
            onClose={() => setSearchOpen(false)}
          />
        </Suspense>
      )}

      {/* =========================================================
          PAINEL FLUTUANTE DE NOTIFICAÇÕES (COMPACTO E REFINADO)
      ========================================================== */}
      {notificationsPanel.mounted && (
        <>
          {/* Backdrop invisível para clique fora sem cobrir ou escurecer a página de trás */}
          <div
            className={cn(
              "fixed inset-0 z-40 bg-transparent",
              notificationsPanel.closing && "pointer-events-none",
            )}
            onClick={() => setNotificationsOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-label="Painel de notificações"
            className={cn(
              "fixed right-3 sm:right-6 top-14 sm:top-16 z-50 flex w-[calc(100vw-1.5rem)] max-w-[360px] sm:max-w-[380px] origin-top-right flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0b0913]/98 md:bg-[#0b0913]/92 shadow-[0_20px_52px_rgba(0,0,0,0.78)] md:backdrop-blur-md",
              "motion-safe:transition-[opacity,transform] motion-safe:duration-[170ms] motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none",
              notificationsPanel.visible
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 -translate-y-1.5 scale-[0.98]",
              notificationsPanel.closing && "pointer-events-none",
            )}
          >
            {/* LINHA DE ACENTO SUTIL NO TOPO */}
            <div
              aria-hidden="true"
              className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-purple-400/35 to-transparent"
            />

            {/* CABEÇALHO COMPACTO */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.07] bg-white/[0.02] px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-[13px] font-semibold tracking-tight text-zinc-100">
                    Notificações
                  </h2>
                  {unreadCount > 0 && (
                    <span className="text-[11px] font-medium text-purple-300/85 tabular-nums">
                      · {unreadCount} {unreadCount === 1 ? "nova" : "novas"}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 truncate">
                  Atividades e interações recentes
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsAsReadAction}
                    className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-purple-300/90 hover:bg-purple-500/12 hover:text-purple-100 transition-colors active:scale-[0.98] cursor-pointer whitespace-nowrap"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck className="size-3.5" />
                    <span>Marcar lidas</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setNotificationsOpen(false)}
                  className="flex size-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100 transition-colors cursor-pointer"
                  aria-label="Fechar notificações"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            {/* CORPO DO PAINEL COM ROLAGEM VERTICAL E CARREGAMENTO AUTOMÁTICO */}
            {notificationsLoading || !notificationsPresentationReady ? (
              <div className="flex min-h-40 flex-1 items-center justify-center px-4 py-8 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="size-5 animate-spin text-purple-300" />
                  <p className="text-xs text-zinc-400">Carregando notificações...</p>
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex min-h-40 flex-1 items-center justify-center px-4 py-8 text-center">
                <div>
                  <div className="mx-auto mb-2.5 flex size-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-purple-300/75">
                    <Bell className="size-4.5" />
                  </div>
                  <p className="text-xs font-semibold text-zinc-100">Nenhuma notificação</p>
                  <p className="mt-1 text-[11px] text-zinc-400 max-w-[220px]">
                    Novos seguidores, comentários e curtidas aparecerão aqui.
                  </p>
                </div>
              </div>
            ) : (
              <div
                ref={notificationsScrollRef}
                onScroll={handleNotificationsScroll}
                className="max-h-[min(390px,calc(100dvh-12rem))] min-h-0 flex-1 overflow-y-auto overscroll-contain"
              >
                <Suspense fallback={null}>
                  {notifications.map((notification) => (
                    <LazyNotificationItemCard
                      key={notification.id}
                      notification={notification}
                      localAnimes={localAnimes}
                      compact
                      onMarkAsRead={(id) => void markNotificationsAsRead([id])}
                      onDelete={(id) => void deleteNotificationAction(id)}
                      onNavigate={() => setNotificationsOpen(false)}
                    />
                  ))}
                </Suspense>

                {/* SENTINELA INVISÍVEL PARA CARREGAMENTO AUTOMÁTICO POR LOTES */}
                {notificationsHasMore && (
                  <div
                    ref={notificationsSentinelRef}
                    className="h-1 w-full shrink-0"
                    aria-hidden="true"
                  />
                )}

                {notificationsLoadingMore && (
                  <div className="flex items-center justify-center gap-2 border-t border-white/[0.05] py-3 text-[11px] text-zinc-400">
                    <Loader2 className="size-3.5 animate-spin text-purple-300" />
                    <span>Carregando notificações antigas...</span>
                  </div>
                )}
              </div>
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
                  {/* Início */}
                  <Link
                    to="/"
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-4 rounded-xl px-4 py-3.5 text-base font-medium transition-colors",
                      pathname === "/"
                        ? "bg-[#a855f7]/15 text-[#c084fc] font-semibold shadow-[inset_0_0_0_1px_rgba(168,85,247,0.3)]"
                        : "text-muted hover:bg-elevated hover:text-fg",
                    )}
                  >
                    <House className="size-5" />
                    <span>Início</span>
                  </Link>

                  {/* Calendário */}
                  <Link
                    to="/calendar"
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-4 rounded-xl px-4 py-3.5 text-base font-medium transition-colors",
                      pathname.startsWith("/calendar")
                        ? "bg-[#a855f7]/15 text-[#c084fc] font-semibold shadow-[inset_0_0_0_1px_rgba(168,85,247,0.3)]"
                        : "text-muted hover:bg-elevated hover:text-fg",
                    )}
                  >
                    <Calendar className="size-5" />
                    <span>Calendário</span>
                  </Link>

                  {!user && !authPending && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setLoginModalOpen(true);
                      }}
                      onMouseEnter={() => void prefetchLoginMenu()}
                      onFocus={() => void prefetchLoginMenu()}
                      className="flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-base font-semibold text-[#c084fc] hover:bg-elevated transition-colors text-left"
                    >
                      <LogIn className="size-5" />
                      <span>Entrar</span>
                    </button>
                  )}

                  {user && isHikariAdmin(user.primaryEmail) && (
                    <Link
                      to="/admin"
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-4 rounded-xl px-4 py-3.5 text-base font-medium transition-colors",
                        pathname.startsWith("/admin")
                          ? "bg-[#a855f7]/15 text-[#c084fc] font-semibold shadow-[inset_0_0_0_1px_rgba(168,85,247,0.3)]"
                          : "text-muted hover:bg-elevated hover:text-fg",
                      )}
                    >
                      <Settings2 className="size-5" />
                      <span>Admin</span>
                    </Link>
                  )}

                </div>
              </div>

              {/* =================================================
                  ANIMES
              ================================================== */}
              <div className="mt-6">
                <p className="mb-2 px-4 text-[10px] font-semibold tracking-[0.18em] text-subtle uppercase">
                  Catálogo
                </p>

                <div className="space-y-1">

                  <Link
                    to="/browse/$section"
                    params={{ section: "season" }}
                    search={{
                      season: currentSeasonInfo.season,
                      year: currentSeasonInfo.year,
                      page: 1,
                    }}
                    onClick={() =>
                      setMenuOpen(false)
                    }
                    className={cn(
                      "flex items-center gap-4 rounded-lg px-4 py-4 text-base font-medium transition-colors",
                      isOnSeasonRoute
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

            </nav>
          </aside>
        </>
      )}

      {/* =========================================================
          CONTEÚDO PRINCIPAL
      ========================================================== */}
      <ShellMain isBannerPage={isBannerPage} />

      {/* =========================================================
          MODAL DE ENTRAR NA CONTA
      ========================================================== */}
      {loginModalOpen && (
        <Suspense fallback={null}>
          <LazyLoginMenu
            isOpen={loginModalOpen}
            onClose={() => setLoginModalOpen(false)}
            isModal={true}
          />
        </Suspense>
      )}

      {/* =========================================================
          RODAPÉ INSTITUCIONAL EXCLUSIVO DA PÁGINA INICIAL ("/")
          - Carregamento sob demanda via IntersectionObserver
          - Visível exclusivamente na rota inicial ("/")
          - Ocultado em todas as demais rotas sem deixar espaços ou margens vazias
      ========================================================== */}
      {isHomePage && <HomeFooterLazy />}

      {/* =========================================================
          NOTIFICAÇÃO MODERNA DE SALVAMENTO DO PERFIL (CANTO SUPERIOR)
      ========================================================== */}
      <ProfileSaveNotification />

    </div>
  );
}
