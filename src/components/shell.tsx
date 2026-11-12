import {
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";

import {
  Bell,
  Bookmark,
  Calendar,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Compass,
  House,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  Search,
  Settings2,
  Tags,
  UserCircle,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ProfileDropdownMenu } from "@/components/profile/ProfileDropdownMenu";
import { signOut } from "@/lib/auth/client";
import {
  NotificationItemCard,
  type NotificationItem,
} from "@/components/notifications/notification-item-card";
import { isHikariAdmin } from "@/lib/auth/admin";
import { getBearerToken } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useHikariStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/lib/scroll-lock";
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

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
    const nextScrolled = window.scrollY > (isBannerPage ? 70 : 20);
    showHeaderRef.current = true;
    isScrolledRef.current = nextScrolled;
    setShowHeader(true);
    setIsScrolled(nextScrolled);
  }, [pathname, isBannerPage]);

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

      // Se qualquer painel/menu/busca estiver aberto, mantém o cabeçalho visível
      if (keepVisible) {
        commitHeaderState(currentScrollY > 20, true);
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
  }, [keepVisible, isBannerPage]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-transform duration-300 ease-out will-change-transform",
        showHeader
          ? "translate-y-0 pointer-events-auto"
          : "-translate-y-full pointer-events-none",
        isBannerPage
          ? isScrolled
            ? "border-b border-purple-500/15 bg-bg/85 shadow-[0_4px_24px_rgba(0,0,0,0.6)] backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
          : isScrolled
            ? "border-b border-purple-500/15 bg-bg/85 shadow-[0_4px_24px_rgba(0,0,0,0.6)] backdrop-blur-md"
            : "border-b border-border bg-bg/85 backdrop-blur-md",
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

function HomeFooterLazy() {
  const [isLoaded, setIsLoaded] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isLoaded) return;

    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      setIsLoaded(true);
      return;
    }

    const target = sentinelRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          setIsLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin: "500px 0px" },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [isLoaded]);

  return (
    <>
      {/* Sentinela leve para detecção de rolagem com margem antecipada de 500px */}
      {!isLoaded && (
        <div
          ref={sentinelRef}
          className="h-px w-full pointer-events-none opacity-0"
          aria-hidden="true"
        />
      )}

      {/* Conteúdo do rodapé carregado e montado sob demanda */}
      {isLoaded && (
        <footer className="relative mt-12 w-full border-t border-purple-500/15 bg-gradient-to-b from-[#08070d] via-[#0d0b17] to-[#05040a] text-xs text-muted shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
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
                  <Logo size="md" />
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
      )}
    </>
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

  const notificationsPanel =
    useNotificationPanelPresence(notificationsOpen, 170);

  const notificationsRef = useRef<NotificationItem[]>([]);
  notificationsRef.current = notifications;

  const hasLoadedNotificationsRef = useRef(false);
  const pendingReadTokensRef = useRef<Map<string, string>>(new Map());

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

  useEffect(() => {
    if (!userId) {
      hasLoadedNotificationsRef.current = false;
      pendingReadTokensRef.current.clear();
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

          hasLoadedNotificationsRef.current = true;

          const reconciled = reconcileNotifications(
            data.notifications ?? [],
            Number(data.unreadCount ?? 0),
          );

          setNotifications(reconciled.notifications);
          setUnreadCount(reconciled.unreadCount);
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
  }, [userId, reconcileNotifications]);

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
          new CustomEvent("hikari:notifications-updated"),
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
    for (const item of notifications.slice(0, 10)) {
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

  const openNotifications =
    async () => {
      setNotificationsOpen(
        true,
      );

      if (!user) {
        return;
      }

      const showInitialLoader = !hasLoadedNotificationsRef.current;
      if (showInitialLoader) {
        setNotificationsLoading(true);
      }

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

        hasLoadedNotificationsRef.current = true;

        const reconciled = reconcileNotifications(
          data.notifications ?? [],
          Number(data.unreadCount ?? 0),
        );

        setNotifications(reconciled.notifications);
        setUnreadCount(reconciled.unreadCount);
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
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">

          {/* LADO ESQUERDO: Menu Mobile + Logo + Navegação Desktop */}
          <div className="flex items-center gap-3 sm:gap-6">
            {/* BOTÃO MENU (visível em telas menores que md) */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex size-10 items-center justify-center rounded-xl text-fg hover:bg-elevated/70 transition-colors md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="size-5" />
            </button>

            {/* LOGO OFICIAL HIKARI */}
            <div className="flex items-center">
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

              {/* Explorar */}
              <Link
                to="/browse/$section"
                params={{ section: "popular" }}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]",
                  pathname.startsWith("/browse")
                    ? "bg-[#a855f7]/15 text-[#c084fc] font-semibold shadow-[inset_0_0_0_1px_rgba(168,85,247,0.3)]"
                    : "text-muted hover:bg-elevated/70 hover:text-fg",
                )}
              >
                <Compass className="size-4" />
                <span>Explorar</span>
              </Link>
            </nav>
          </div>

          {/* AÇÕES DA DIREITA */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* BUSCA — escondida na área de Notícias */}
            {!pathname.startsWith("/news") && (
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((value) => !value);
                }}
                onMouseEnter={() => void prefetchSearchModal()}
                onFocus={() => void prefetchSearchModal()}
                className="flex size-10 items-center justify-center rounded-xl text-muted hover:bg-elevated hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]"
                aria-label="Buscar"
                title="Buscar (Ctrl+K)"
                aria-expanded={searchOpen}
              >
                <Search className="size-4 sm:size-5" />
              </button>
            )}

            {/* NOTIFICAÇÕES */}
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
                "relative flex size-10 items-center justify-center rounded-xl text-muted hover:bg-elevated hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]",
                "motion-safe:transition-[color,background-color,transform] motion-safe:duration-150 motion-safe:active:scale-95 motion-reduce:transition-none motion-reduce:transform-none",
                notificationsOpen && "bg-elevated text-fg",
              )}
              aria-label="Notificações"
              aria-expanded={notificationsOpen}
            >
              <Bell className="size-4 sm:size-5" />

              {unreadCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex min-w-4 h-4 sm:min-w-5 sm:h-5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] sm:text-[10px] font-bold leading-none text-white ring-2 ring-bg tabular-nums">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {/* PERFIL (QUANDO AUTENTICADO) OU BOTÃO ENTRAR (QUANDO VISITANTE) */}
            {user ? (
              <ProfileDropdownMenu user={user} />
            ) : (
              <button
                type="button"
                onClick={() => setLoginModalOpen(true)}
                onMouseEnter={() => void prefetchLoginMenu()}
                onFocus={() => void prefetchLoginMenu()}
                className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-[#a855f7]/40 bg-[#a855f7] px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#9333ea] hover:shadow-[0_0_20px_rgba(168,85,247,0.35)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]"
                aria-label="Entrar na conta"
              >
                <LogIn className="size-3.5 sm:size-4" />
                <span>Entrar</span>
              </button>
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
          PAINEL FLUTUANTE DE NOTIFICAÇÕES (COMPACTO E DISCRETO)
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
              "fixed right-3 sm:right-6 top-14 sm:top-16 z-50 flex w-[calc(100vw-1.5rem)] max-w-[360px] sm:max-w-[380px] origin-top-right flex-col overflow-hidden rounded-2xl border border-purple-500/25 bg-[#0e0c18]/95 shadow-[0_16px_48px_rgba(0,0,0,0.7),0_0_24px_rgba(168,85,247,0.12)] backdrop-blur-xl",
              "motion-safe:transition-[opacity,transform] motion-safe:duration-[170ms] motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none",
              notificationsPanel.visible
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 -translate-y-1.5 scale-[0.98]",
              notificationsPanel.closing && "pointer-events-none",
            )}
          >
            {/* CABEÇALHO COMPACTO */}
            <div className="flex shrink-0 items-center justify-between border-b border-purple-500/15 px-3.5 py-2.5 bg-white/[0.02]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex size-7 items-center justify-center rounded-lg bg-purple-500/15 text-[#c084fc] shrink-0">
                  <Bell className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xs font-bold text-fg tracking-tight">
                      Notificações
                    </h2>
                    {unreadCount > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-purple-500/25 px-1 text-[9px] font-bold text-[#c084fc] tabular-nums">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted truncate">
                    Suas atividades recentes
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsAsReadAction}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold text-[#c084fc] hover:bg-purple-500/15 transition-colors active:scale-95"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck className="size-3" />
                    <span>Lidas</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setNotificationsOpen(false)}
                  className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-fg transition-colors"
                  aria-label="Fechar notificações"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            {/* CORPO DO PAINEL COM ROLAGEM INTERNA */}
            {notificationsLoading ? (
              <div className="flex min-h-36 flex-1 items-center justify-center px-4 py-8 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="size-5 animate-spin text-[#c084fc]" />
                  <p className="text-xs text-muted">Carregando notificações...</p>
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex min-h-36 flex-1 items-center justify-center px-4 py-8 text-center">
                <div>
                  <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-[#c084fc]/70">
                    <Bell className="size-5" />
                  </div>
                  <p className="text-xs font-semibold text-fg">Nenhuma notificação</p>
                  <p className="mt-0.5 text-[11px] text-muted max-w-[220px]">
                    Novos seguidores, comentários e curtidas aparecerão aqui.
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-h-[min(380px,calc(100dvh-12rem))] min-h-0 flex-1 overflow-y-auto overscroll-contain divide-y divide-purple-500/10">
                {notifications.slice(0, 10).map((notification) => (
                  <NotificationItemCard
                    key={notification.id}
                    notification={notification}
                    localAnimes={localAnimes}
                    compact
                    onMarkAsRead={(id) => void markNotificationsAsRead([id])}
                    onDelete={(id) => void deleteNotificationAction(id)}
                    onNavigate={() => setNotificationsOpen(false)}
                  />
                ))}
              </div>
            )}

            {/* ACESSO A TODAS AS NOTIFICAÇÕES */}
            {!notificationsLoading && notifications.length > 0 && (
              <Link
                to="/notifications"
                onClick={() => setNotificationsOpen(false)}
                className="flex shrink-0 items-center justify-center gap-1.5 border-t border-purple-500/15 bg-white/[0.02] py-2.5 text-center text-xs font-semibold text-[#c084fc] hover:bg-purple-500/10 hover:text-[#d8b4fe] transition-colors"
              >
                <span>Ver todas as notificações</span>
                <ChevronRight className="size-3.5" />
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

                  {/* Explorar */}
                  <Link
                    to="/browse/$section"
                    params={{ section: "popular" }}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-4 rounded-xl px-4 py-3.5 text-base font-medium transition-colors",
                      pathname.startsWith("/browse")
                        ? "bg-[#a855f7]/15 text-[#c084fc] font-semibold shadow-[inset_0_0_0_1px_rgba(168,85,247,0.3)]"
                        : "text-muted hover:bg-elevated hover:text-fg",
                    )}
                  >
                    <Compass className="size-5" />
                    <span>Explorar</span>
                  </Link>

                  {user && (
                    <Link
                      to="/my-list"
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-4 rounded-xl px-4 py-3.5 text-base font-medium transition-colors",
                        pathname.startsWith("/my-list")
                          ? "bg-[#a855f7]/15 text-[#c084fc] font-semibold shadow-[inset_0_0_0_1px_rgba(168,85,247,0.3)]"
                          : "text-muted hover:bg-elevated hover:text-fg",
                      )}
                    >
                      <Bookmark className="size-5" />
                      <span>Minha Lista</span>
                    </Link>
                  )}

                  {user ? (
                    <>
                      <Link
                        to="/account"
                        onClick={() => setMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-4 rounded-xl px-4 py-3.5 text-base font-medium transition-colors",
                          pathname.startsWith("/account")
                            ? "bg-[#a855f7]/15 text-[#c084fc] font-semibold shadow-[inset_0_0_0_1px_rgba(168,85,247,0.3)]"
                            : "text-muted hover:bg-elevated hover:text-fg",
                        )}
                      >
                        <UserCircle className="size-5" />
                        <span>Meu Perfil</span>
                      </Link>
                    </>
                  ) : (
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

                  {user && (
                    <button
                      type="button"
                      onClick={async () => {
                        setMenuOpen(false);
                        try {
                          await signOut();
                          window.location.reload();
                        } catch {
                          window.location.reload();
                        }
                      }}
                      className="flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-base font-medium text-rose-400 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="size-5" />
                      <span>Sair</span>
                    </button>
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

    </div>
  );
}
