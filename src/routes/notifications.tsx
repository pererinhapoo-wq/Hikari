import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  ArrowLeft,
  Bell,
  UserCircle,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import { cn } from "@/lib/utils";

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

export const Route = createFileRoute(
  "/notifications",
)({
  component: NotificationsPage,
});

function NotificationsPage() {
  const [
    notifications,
    setNotifications,
  ] = useState<
    NotificationItem[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  useEffect(() => {
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
            };

          if (cancelled) {
            return;
          }

          setNotifications(
            data.notifications ?? [],
          );
        } catch {
          if (!cancelled) {
            setNotifications([]);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

    void loadNotifications();

    return () => {
      cancelled = true;
    };
  }, []);

  async function markNotificationAsRead(
    id: string,
  ) {
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

    try {
      await fetch(
        "/api/notifications",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id,
          }),
        },
      );
    } catch {
      // A alteração visual permanece.
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl py-6 sm:py-8">

      {/* CABEÇALHO */}
      <div className="mb-6 flex items-center gap-3">

        <Link
          to="/"
          className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-fg"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-5" />
        </Link>

        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">
            Todas as notificações
          </h1>

          <p className="mt-1 text-sm text-muted">
            Suas atividades recentes
          </p>
        </div>

      </div>

      {/* CARREGANDO */}
      {loading && (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-border bg-bg px-5 py-10">
          <p className="text-sm text-muted">
            Carregando notificações...
          </p>
        </div>
      )}

      {/* VAZIO */}
      {!loading &&
        notifications.length === 0 && (
          <div className="flex min-h-60 items-center justify-center rounded-xl border border-border bg-bg px-5 py-10 text-center">
            <div>
              <Bell className="mx-auto mb-4 size-8 text-muted" />

              <p className="text-sm font-medium">
                Nenhuma notificação
              </p>

              <p className="mt-1 text-xs text-muted">
                Quando alguém interagir com seu perfil, aparecerá aqui.
              </p>
            </div>
          </div>
        )}

      {/* LISTA */}
      {!loading &&
        notifications.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-bg">

            {notifications.map(
              (notification) => {
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

                const content = (
                  <div
                    className={cn(
                      "border-b border-border px-4 py-4 last:border-b-0 sm:px-5",
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
                          <UserCircle className="size-5" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">

                        <div className="flex items-start gap-3">

                          <p className="min-w-0 flex-1 text-sm leading-5 text-fg">
                            {
                              notificationMessage
                            }
                          </p>

                          {!notification.read && (
                            <span className="mt-1 size-2 shrink-0 rounded-full bg-blue-500" />
                          )}

                        </div>

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
                                          "relative size-6 overflow-hidden rounded-full border-2 border-bg bg-elevated",
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
                                          <div className="flex size-full items-center justify-center text-[9px] font-semibold text-muted">
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
                              {likeCount}{" "}
                              {likeCount ===
                              1
                                ? "curtida"
                                : "curtidas"}
                            </span>
                          </div>
                        )}

                        {(notification.animeCover ||
                          notification.animeTitle) && (
                          <div className="mt-2 flex items-center gap-3">

                            {notification.animeCover ? (
                              <img
                                src={
                                  notification.animeCover
                                }
                                alt=""
                                className="h-16 w-12 shrink-0 rounded-md object-cover"
                              />
                            ) : null}

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

                        <p className="mt-2 text-[11px] text-muted">
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
                      }}
                      className="block transition-colors hover:bg-elevated/70"
                    >
                      {content}
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
                    {content}
                  </button>
                );
              },
            )}

          </div>
        )}

    </div>
  );
              }
