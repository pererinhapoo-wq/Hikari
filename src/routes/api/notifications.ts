import {
  createFileRoute,
} from "@tanstack/react-router";

import { createHash } from "node:crypto";

import {
  getSql,
  dbSource,
} from "@/lib/db";

import { auth } from "@/lib/auth/server";

const ANILIST =
  "https://graphql.anilist.co";

const JIKAN =
  "https://api.jikan.moe/v4";

const rawDatabaseUrl =
  typeof process !== "undefined"
    ? process.env.DATABASE_URL
    : undefined;

function getDatabaseHash(
  value?: string,
) {
  if (!value || !value.trim()) {
    return "DATABASE_URL_NOT_SET";
  }

  return createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 12);
}

const runtimeDatabaseHash =
  getDatabaseHash(
    rawDatabaseUrl,
  );

type AnimeInfo = {
  id: string;
  title: string;
  cover: string;
};

async function fetchAnimeInfo(
  animeId: string,
): Promise<AnimeInfo | null> {
  if (!animeId) {
    return null;
  }

  /*
   * NOTIFICAÇÕES QUE USAM JIKAN
   *
   * IDs nesse formato:
   * mal-12345
   */
  if (
    animeId.startsWith("mal-")
  ) {
    const malId = Number(
      animeId.replace(
        "mal-",
        "",
      ),
    );

    if (
      !Number.isFinite(malId)
    ) {
      return null;
    }

    try {
      const response =
        await fetch(
          `${JIKAN}/anime/${malId}`,
          {
            headers: {
              Accept:
                "application/json",
            },

            signal:
              AbortSignal.timeout(
                10000,
              ),
          },
        );

      if (!response.ok) {
        return null;
      }

      const json =
        (await response.json()) as {
          data?: {
            mal_id?: number;

            title?: string | null;

            title_english?:
              | string
              | null;

            title_japanese?:
              | string
              | null;

            images?: {
              jpg?: {
                large_image_url?:
                  | string
                  | null;

                image_url?:
                  | string
                  | null;
              };
            };
          };
        };

      const anime =
        json.data;

      if (!anime) {
        return null;
      }

      const title =
        anime.title_english ||
        anime.title ||
        anime.title_japanese ||
        "Anime";

      const cover =
        anime.images?.jpg
          ?.large_image_url ||
        anime.images?.jpg
          ?.image_url ||
        "";

      return {
        id: animeId,
        title,
        cover,
      };
    } catch {
      return null;
    }
  }

  /*
   * NOTIFICAÇÕES QUE USAM ANILIST
   *
   * O animeId do Hikari,
   * quando vem do AniList,
   * é o próprio ID numérico.
   */
  const anilistId =
    Number(animeId);

  if (
    !Number.isFinite(
      anilistId,
    )
  ) {
    return null;
  }

  try {
    const response =
      await fetch(
        ANILIST,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            query: `
              query NotificationAnime(
                $id: Int
              ) {
                Media(
                  id: $id,
                  type: ANIME
                ) {
                  id

                  title {
                    romaji
                    english
                    native
                  }

                  coverImage {
                    extraLarge
                    large
                  }
                }
              }
            `,

            variables: {
              id: anilistId,
            },
          }),

          signal:
            AbortSignal.timeout(
              10000,
            ),
        },
      );

    if (!response.ok) {
      throw new Error(
        "AniList indisponível",
      );
    }

    const json =
      (await response.json()) as {
        data?: {
          Media?: {
            id: number;

            title?: {
              romaji?:
                | string
                | null;

              english?:
                | string
                | null;

              native?:
                | string
                | null;
            } | null;

            coverImage?: {
              extraLarge?:
                | string
                | null;

              large?:
                | string
                | null;
            } | null;
          } | null;
        };
      };

    const media =
      json.data?.Media;

    if (!media) {
      throw new Error(
        "Anime não encontrado no AniList",
      );
    }

    const title =
      media.title?.english ||
      media.title?.romaji ||
      media.title?.native ||
      "Anime";

    const cover =
      media.coverImage
        ?.extraLarge ||
      media.coverImage
        ?.large ||
      "";

    return {
      id: animeId,
      title,
      cover,
    };
  } catch {
    /*
     * FALLBACK JIKAN
     *
     * Caso o AniList falhe,
     * tentamos buscar pelo ID
     * do AniList usando a busca
     * por título não é possível.
     *
     * Nesse caso simplesmente
     * retornamos null para não
     * quebrar as notificações.
     */
    return null;
  }
}

export const Route =
  createFileRoute(
    "/api/notifications",
  )({
    server: {
      handlers: {
        GET: async ({
          request,
        }) => {
          const session =
            await auth.api.getSession({
              headers:
                request.headers,
            });

          if (
            !session?.user
          ) {
            return Response.json(
              {
                notifications: [],
                unreadCount: 0,
              },
              {
                status: 401,
              },
            );
          }

          const sql =
            await getSql();

          let notificationTableExists =
            false;

          try {
            const tableRows =
              await sql<{
                exists: boolean;
              }>`
                select exists (
                  select 1
                  from information_schema.tables
                  where
                    table_schema = 'public'
                    and table_name = 'notification'
                ) as exists
              `;

            notificationTableExists =
              Boolean(
                tableRows[0]
                  ?.exists,
              );
          } catch {
            notificationTableExists =
              false;
          }

          if (
            !notificationTableExists
          ) {
            return Response.json({
              notifications: [],
              unreadCount: 0,

              debug: {
                dbSource,

                databaseUrlConfigured:
                  dbSource ===
                  "neon",

                runtimeDatabaseHash,

                notificationTableExists,
              },
            });
          }

          const notifications =
            await sql<{
              id: string;

              type: string;

              message: string;

              read: boolean;

              createdAt: string;

              actorId:
                | string
                | null;

              actorName:
                | string
                | null;

              actorImage:
                | string
                | null;

              commentId:
                | string
                | null;

              animeId:
                | string
                | null;

              episodeId:
                | string
                | null;

              commentLikes:
                number;
            }>`
              select
                n."id",
                n."type",
                n."message",
                n."read",
                n."createdAt",

                n."actorId",

                u."name"
                  as "actorName",

                u."image"
                  as "actorImage",

                n."commentId",
                n."animeId",
                n."episodeId",

                coalesce(
                  (
                    select
                      count(*)::int
                    from "comment_like" cl
                    where
                      cl."commentId" =
                        n."commentId"
                  ),
                  0
                ) as "commentLikes"

              from "notification" n

              left join "user" u
                on u."id" =
                  n."actorId"

              where
                n."userId" =
                  ${session.user.id}

              order by
                n."createdAt" desc

              limit 50
            `;

          /*
           * BUSCAR DADOS DOS ANIMES
           *
           * Fazemos isso depois da
           * consulta das notificações
           * para não alterar a estrutura
           * do banco.
           */

          const animeIds =
            Array.from(
              new Set(
                notifications
                  .map(
                    (
                      notification,
                    ) =>
                      notification.animeId,
                  )
                  .filter(
                    (
                      id,
                    ): id is string =>
                      Boolean(id),
                  ),
              ),
            );

          const animeInfoEntries =
            await Promise.all(
              animeIds.map(
                async (
                  animeId,
                ) => {
                  const info =
                    await fetchAnimeInfo(
                      animeId,
                    );

                  return [
                    animeId,
                    info,
                  ] as const;
                },
              ),
            );

          const animeInfoMap =
            new Map<
              string,
              AnimeInfo | null
            >(
              animeInfoEntries,
            );

          const enrichedNotifications =
            notifications.map(
              (
                notification,
              ) => {
                const anime =
                  notification.animeId
                    ? animeInfoMap.get(
                        notification.animeId,
                      ) ?? null
                    : null;

                return {
                  ...notification,

                  animeTitle:
                    anime?.title ??
                    null,

                  animeCover:
                    anime?.cover ??
                    null,
                };
              },
            );

          const unreadRows =
            await sql<{
              count: string;
            }>`
              select
                count(*)::text
                  as count

              from "notification"

              where
                "userId" =
                  ${session.user.id}

                and
                "read" = false
            `;

          return Response.json({
            notifications:
              enrichedNotifications,

            unreadCount:
              Number(
                unreadRows[0]
                  ?.count ??
                  "0",
              ),

            debug: {
              dbSource,

              databaseUrlConfigured:
                dbSource ===
                "neon",

              runtimeDatabaseHash,

              notificationTableExists,

              animeInfoLoaded:
                animeInfoMap.size,
            },
          });
        },
      },
    },
  });
