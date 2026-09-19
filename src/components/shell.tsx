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
import { useEffect, useState } from "react";

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

  const [
    notificationsOpen,
    setNotificationsOpen,
  ] = useState(false);

  const [
    notifications,
    setNotifications,
  ] = useState<
    NotificationItem[]
  >([]);

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [
    notificationsLoading,
    setNotificationsLoading,
  ] = useState(false);

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
          const response =
            await fetch(
              "/api/notifications",
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

    loadNotifications();

    const interval =
      window.setInterval(
        loadNotifications,
        30000,
      );

    return () => {
      cancelled = true;

      window.clearInterval(
        interval,
      );
    };
  }, [user?.id]);

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
        const response =
          await fetch(
            "/api/notifications",
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
      ========================================================== */}
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
              onClick={() => {
                if (
                  notificationsOpen
                ) {
                  setNotificationsOpen(
                    false,
                  );
                } else {
                  openNotifications();
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
              onClick={() => {
                if (
                  notificationsOpen
                ) {
                  setNotificationsOpen(
                    false,
                  );
                } else {
                  openNotifications();
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
      </header>

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

          <div className="fixed right-4 top-16 z-50 w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-xl border border-border bg-bg shadow-2xl md:right-6 md:top-20">

            {/* CABEÇALHO */}
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
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

            {/* CARREGANDO */}
            {notificationsLoading ? (
              <div className="flex min-h-32 items-center justify-center px-5 py-8 text-center">
                <p className="text-sm text-muted">
                  Carregando...
                </p>
              </div>
            ) : notifications.length ===
              0 ? (

              /* SEM NOTIFICAÇÕES */
              <div className="flex min-h-32 items-center justify-center px-5 py-8 text-center">
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

              /* LISTA */
              <div className="max-h-[70vh] overflow-y-auto">

                {notifications.map(
                  (
                    notification,
                  ) => {

                    const hasEpisodeTarget =
                      Boolean(
                        notification.animeId &&
                        notification.episodeId,
                      );

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
                            "border-b border-border px-4 py-4 last:border-b-0",
                            !notification.read &&
                              "bg-elevated/50",
                          )}
                        >
                          <div className="flex gap-3">

                            {/* AVATAR DO AUTOR DA NOTIFICAÇÃO */}
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

                            {/* CONTEÚDO */}
                            <div className="min-w-0 flex-1">

                              {/* MENSAGEM */}
                              <p className="text-sm leading-5">
                                {
                                  notificationMessage
                                }
                              </p>

                              {/* CURTIDAS */}
                              {isLikeNotification && (
                                <div className="mt-2 flex items-center gap-2">

                                  {/* FOTOS SOBREPOSTAS */}
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

                              {/* ANIME */}
                              {(notification.animeCover ||
                                notification.animeTitle) && (
                                <div className="mt-3 flex items-center gap-3">

                                  {/* CAPA */}
                                  {notification.animeCover ? (
                                    <img
                                      src={
                                        notification.animeCover
                                      }
                                      alt=""
                                      className="h-16 w-11 shrink-0 rounded-md object-cover"
                                    />
                                  ) : null}

                                  {/* NOME + DESTINO */}
                                  <div className="min-w-0 flex-1">

                                    {notification.animeTitle && (
                                      <p className="truncate text-sm font-medium text-fg">
                                        {
                                          notification.animeTitle
                                        }
                                      </p>
                                    )}

                                    {hasEpisodeTarget &&
                                      (isLikeNotification ||
                                        isReplyNotification) && (
                                        <p className="mt-1 text-xs font-medium text-muted">
                                          {notification.commentId
                                            ? "Ver comentário"
                                            : "Ver episódio"}
                                        </p>
                                      )}

                                  </div>
                                </div>
                              )}

                              {/* DESTINO SEM INFORMAÇÃO DO ANIME */}
                              {hasEpisodeTarget &&
                                (isLikeNotification ||
                                  isReplyNotification) &&
                                !notification.animeCover &&
                                !notification.animeTitle && (
                                  <div className="mt-2">
                                    <span className="inline-flex items-center rounded-md bg-elevated px-2.5 py-1 text-xs font-medium text-fg">
                                      {notification.commentId
                                        ? "Ver comentário"
                                        : "Ver episódio"}
                                    </span>
                                  </div>
                                )}

                              {/* DATA */}
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

                            {/* NÃO LIDA */}
                            {!notification.read && (
                              <span className="mt-1 size-2 shrink-0 rounded-full bg-red-500" />
                            )}
                          </div>
                        </div>
                      );

                    {/* =================================================
                        NOTIFICAÇÃO COM DESTINO
                    ================================================== */}
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
                          onClick={() =>
                            setNotificationsOpen(
                              false,
                            )
                          }
                          className="block transition-colors hover:bg-elevated/70"
                        >
                          {
                            notificationContent
                          }
                        </Link>
                      );
                    }

                    {/* =================================================
                        NOTIFICAÇÃO SEM DESTINO
                    ================================================== */}
                    return (
                      <div
                        key={
                          notification.id
                        }
                      >
                        {
                          notificationContent
                        }
                      </div>
                    );
                  },
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

                {/* +18 */}
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

      {/* =========================================================
          CONTEÚDO PRINCIPAL
      ========================================================== */}
      <main className="mx-auto w-full max-w-6xl px-4 pb-5 sm:px-6 sm:pb-8">
        <Outlet />
      </main>

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
