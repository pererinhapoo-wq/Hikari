import {
  createFileRoute,
} from "@tanstack/react-router";

import { createHash } from "node:crypto";

import {
  getSql,
  dbSource,
} from "@/lib/db";

import { auth } from "@/lib/auth/server";

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

export const Route = createFileRoute(
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

        if (!session?.user) {
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
              tableRows[0]?.exists,
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
                dbSource === "neon",
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
              string | null;

            actorName:
              string | null;

            actorImage:
              string | null;

            commentId:
              string | null;

            animeId:
              string | null;

            episodeId:
              string | null;

            animeTitle:
              string | null;

            animeCover:
              string | null;

            commentLikes:
              number;

            likeAvatars: Array<{
              id: string;
              name: string | null;
              image: string | null;
            }>;
          }>`
            select
              n."id",
              n."type",
              n."message",
              n."read",
              n."createdAt",

              n."actorId",

              u."name" as "actorName",
              u."image" as "actorImage",

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
              ) as "commentLikes",

              coalesce(
                (
                  select
                    json_agg(
                      json_build_object(
                        'id',
                        liker."id",
                        'name',
                        liker."name",
                        'image',
                        liker."image"
                      )
                    )
                  from (
                    select
                      cl2."userId",
                      cl2."id"
                    from "comment_like" cl2
                    where
                      cl2."commentId" =
                        n."commentId"
                    order by
                      cl2."id" desc
                    limit 2
                  ) recent_likes

                  left join "user" liker
                    on liker."id" =
                      recent_likes."userId"
                ),
                '[]'::json
              ) as "likeAvatars"

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

        const enrichedNotifications =
          await Promise.all(
            notifications.map(
              async (notification) => {
                let animeTitle:
                  | string
                  | null = null;

                let animeCover:
                  | string
                  | null = null;

                const animeId =
                  notification.animeId;

                if (animeId) {
                  try {
                    if (
                      animeId.startsWith(
                        "mal-",
                      )
                    ) {
                      const malId =
                        animeId.replace(
                          "mal-",
                          "",
                        );

                      const response =
                        await fetch(
                          `https://api.jikan.moe/v4/anime/${encodeURIComponent(
                            malId,
                          )}`,
                          {
                            headers: {
                              Accept:
                                "application/json",
                            },
                          },
                        );

                      if (
                        response.ok
                      ) {
                        const data =
                          (await response.json()) as {
                            data?: {
                              title?: string;
                              title_english?: string | null;
                              title_japanese?: string | null;
                              images?: {
                                jpg?: {
                                  large_image_url?: string | null;
                                  image_url?: string | null;
                                };
                              };
                            };
                          };

                        const anime =
                          data.data;

                        animeTitle =
                          anime?.title_english ||
                          anime?.title ||
                          anime?.title_japanese ||
                          null;

                        animeCover =
                          anime?.images?.jpg
                            ?.large_image_url ||
                          anime?.images?.jpg
                            ?.image_url ||
                          null;
                      }
                    } else {
                      const numericId =
                        Number(
                          animeId,
                        );

                      if (
                        Number.isFinite(
                          numericId,
                        )
                      ) {
                        const response =
                          await fetch(
                            "https://graphql.anilist.co",
                            {
                              method:
                                "POST",
                              headers: {
                                "Content-Type":
                                  "application/json",
                                Accept:
                                  "application/json",
                              },
                              body: JSON.stringify(
                                {
                                  query: `
                                    query (
                                      $id: Int
                                    ) {
                                      Media(
                                        id: $id
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
                                    id: numericId,
                                  },
                                },
                              ),
                            },
                          );

                        if (
                          response.ok
                        ) {
                          const data =
                            (await response.json()) as {
                              data?: {
                                Media?: {
                                  title?: {
                                    romaji?: string | null;
                                    english?: string | null;
                                    native?: string | null;
                                  };

                                  coverImage?: {
                                    extraLarge?: string | null;
                                    large?: string | null;
                                  };
                                };
                              };
                            };

                          const anime =
                            data.data
                              ?.Media;

                          animeTitle =
                            anime?.title
                              ?.english ||
                            anime?.title
                              ?.romaji ||
                            anime?.title
                              ?.native ||
                            null;

                          animeCover =
                            anime?.coverImage
                              ?.extraLarge ||
                            anime?.coverImage
                              ?.large ||
                            null;
                        }
                      }
                    }
                  } catch {
                    // Se o serviço externo falhar,
                    // a notificação continua funcionando.
                  }
                }

                return {
                  ...notification,
                  animeTitle,
                  animeCover,
                  likeAvatars:
                    Array.isArray(
                      notification.likeAvatars,
                    )
                      ? notification.likeAvatars
                      : [],
                };
              },
            ),
          );

        const unreadRows =
          await sql<{
            count: string;
          }>`
            select
              count(*)::text as count

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
                ?.count ?? "0",
            ),

          debug: {
            dbSource,
            databaseUrlConfigured:
              dbSource === "neon",
            runtimeDatabaseHash,
            notificationTableExists,
          },
        });
      },
    },
  },
});
