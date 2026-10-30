import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { resolveApiUser } from "@/lib/auth/api-session";
import { FALLBACK_ANIMES } from "@/lib/fallback-catalog";
import { displayTitle } from "@/lib/types";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const ANIME_META_TTL_MS = 1000 * 60 * 30;

type CachedAnimeMeta = {
  title: string | null;
  cover: string | null;
  expiresAt: number;
};

const animeMetaCache = new Map<string, CachedAnimeMeta>();

function normalizeUtcIsoString(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? new Date().toISOString()
      : value.toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    const hasExplicitTz = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(trimmed);
    const normalized =
      !hasExplicitTz &&
      /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)
        ? `${trimmed.replace(" ", "T")}Z`
        : trimmed;
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

async function resolveAnimeMetadataMap(
  animeIds: string[],
): Promise<Map<string, { title: string | null; cover: string | null }>> {
  const result = new Map<string, { title: string | null; cover: string | null }>();
  if (animeIds.length === 0) {
    return result;
  }

  const now = Date.now();
  const numericToFetch: number[] = [];

  for (const rawId of animeIds) {
    const id = rawId.trim();
    if (!id) continue;

    const cached = animeMetaCache.get(id);
    if (cached && cached.expiresAt > now) {
      result.set(id, { title: cached.title, cover: cached.cover });
      continue;
    }

    const numericId = Number(id);
    const fallback = FALLBACK_ANIMES.find(
      (a) =>
        a.id === id ||
        (!Number.isNaN(numericId) &&
          numericId > 0 &&
          (a.anilistId === numericId || a.malId === numericId)),
    );

    if (fallback) {
      const meta = {
        title: displayTitle(fallback) || null,
        cover: fallback.cover || null,
      };
      result.set(id, meta);
      animeMetaCache.set(id, { ...meta, expiresAt: now + ANIME_META_TTL_MS });
      continue;
    }

    if (Number.isInteger(numericId) && numericId > 0) {
      numericToFetch.push(numericId);
    }
  }

  if (numericToFetch.length > 0) {
    try {
      const uniqueNumeric = Array.from(new Set(numericToFetch)).slice(0, 50);
      const response = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: `
            query ($ids: [Int]) {
              Page(perPage: 50) {
                media(id_in: $ids, type: ANIME) {
                  id
                  title {
                    english
                    romaji
                    native
                  }
                  coverImage {
                    extraLarge
                    large
                  }
                }
              }
            }
          `,
          variables: { ids: uniqueNumeric },
        }),
        signal: AbortSignal.timeout(2500),
      });

      if (response.ok) {
        const json = (await response.json()) as {
          data?: {
            Page?: {
              media?: Array<{
                id?: number;
                title?: {
                  english?: string | null;
                  romaji?: string | null;
                  native?: string | null;
                } | null;
                coverImage?: {
                  extraLarge?: string | null;
                  large?: string | null;
                } | null;
              }>;
            };
          };
        };

        const mediaList = json?.data?.Page?.media ?? [];
        for (const media of mediaList) {
          if (!media?.id) continue;
          const key = String(media.id);
          const title =
            media.title?.english?.trim() ||
            media.title?.romaji?.trim() ||
            media.title?.native?.trim() ||
            null;
          const cover =
            media.coverImage?.extraLarge?.trim() ||
            media.coverImage?.large?.trim() ||
            null;

          result.set(key, { title, cover });
          animeMetaCache.set(key, {
            title,
            cover,
            expiresAt: now + ANIME_META_TTL_MS,
          });
        }
      }
    } catch {
      // Falha silenciosa de metadados externos: a notificação continua sendo exibida normalmente.
    }
  }

  return result;
}

const VALID_NOTIFICATION_PREDICATE = `
  n."userId" = $1
  and (n."actorId" is null or n."actorId" <> n."userId")
  and (
    n."commentId" is null
    or exists (
      select 1
      from "comment" c
      where c."id" = n."commentId"
    )
  )
  and (
    n."type" <> 'comment_like'
    or (
      n."commentId" is not null
      and exists (
        select 1
        from "comment_like" cl
        where cl."commentId" = n."commentId"
          and (cl."type" = 'like' or cl."type" is null)
          and cl."userId" <> n."userId"
      )
    )
  )
`;

export const Route = createFileRoute("/api/notifications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);

          if (!apiUser?.id) {
            return Response.json(
              { notifications: [], unreadCount: 0 },
              { status: 401 },
            );
          }

          const rowsResult = await sql.query(
            `
              select
                n."id",
                n."type",
                n."message",
                n."read",
                (n."createdAt" at time zone 'UTC') as "createdAt",
                n."actorId",
                case
                  when n."actorId" is not null then coalesce(
                    nullif(trim(p."nick"), ''),
                    nullif(trim(u."name"), ''),
                    'Usuário'
                  )
                  else null
                end as "actorName",
                u."image" as "actorImage",
                n."commentId",
                n."animeId",
                n."episodeId",
                case
                  when n."type" = 'comment_like' and n."commentId" is not null then (
                    select count(*)::int
                    from "comment_like" cl
                    where cl."commentId" = n."commentId"
                      and (cl."type" = 'like' or cl."type" is null)
                      and cl."userId" <> n."userId"
                  )
                  else 0
                end as "commentLikes"
              from "notification" n
              left join "user" u
                on u."id" = n."actorId"
              left join "profile" p
                on p."userId" = n."actorId"
              where ${VALID_NOTIFICATION_PREDICATE}
              order by n."createdAt" desc
              limit 50
            `,
            [apiUser.id],
          );

          const rawRows: any[] = Array.isArray(rowsResult)
            ? rowsResult
            : (rowsResult as any)?.rows ?? [];

          const unreadResult = await sql.query(
            `
              select count(*)::int as "unreadCount"
              from "notification" n
              where ${VALID_NOTIFICATION_PREDICATE}
                and n."read" = false
            `,
            [apiUser.id],
          );

          const unreadRows: any[] = Array.isArray(unreadResult)
            ? unreadResult
            : (unreadResult as any)?.rows ?? [];
          const unreadCount = Number(unreadRows[0]?.unreadCount ?? 0) || 0;

          const likeCommentIds = Array.from(
            new Set(
              rawRows
                .filter(
                  (r) =>
                    r.type === "comment_like" &&
                    typeof r.commentId === "string" &&
                    r.commentId.trim(),
                )
                .map((r) => String(r.commentId)),
            ),
          );

          const avatarsByCommentId = new Map<
            string,
            Array<{ id: string; name: string | null; image: string | null }>
          >();

          if (likeCommentIds.length > 0) {
            const placeholders = likeCommentIds
              .map((_, index) => `$${index + 2}`)
              .join(", ");

            const avatarResult = await sql.query(
              `
                select
                  cl."commentId",
                  u."id",
                  coalesce(
                    nullif(trim(p."nick"), ''),
                    nullif(trim(u."name"), ''),
                    'Usuário'
                  ) as "name",
                  u."image"
                from "comment_like" cl
                inner join "user" u
                  on u."id" = cl."userId"
                left join "profile" p
                  on p."userId" = u."id"
                where cl."userId" <> $1
                  and (cl."type" = 'like' or cl."type" is null)
                  and cl."commentId" in (${placeholders})
                order by cl."createdAt" desc
              `,
              [apiUser.id, ...likeCommentIds],
            );

            const avatarRows: any[] = Array.isArray(avatarResult)
              ? avatarResult
              : (avatarResult as any)?.rows ?? [];

            for (const row of avatarRows) {
              const cid = String(row.commentId);
              const list = avatarsByCommentId.get(cid) ?? [];
              if (list.length < 4 && !list.some((item) => item.id === String(row.id))) {
                list.push({
                  id: String(row.id),
                  name: row.name ? String(row.name) : null,
                  image: row.image ? String(row.image) : null,
                });
                avatarsByCommentId.set(cid, list);
              }
            }
          }

          const distinctAnimeIds = Array.from(
            new Set(
              rawRows
                .map((r) => (typeof r.animeId === "string" ? r.animeId.trim() : ""))
                .filter(Boolean),
            ),
          );
          const animeMetaMap = await resolveAnimeMetadataMap(distinctAnimeIds);

          const notifications = rawRows.map((row) => {
            const animeId = row.animeId ? String(row.animeId) : null;
            const commentId = row.commentId ? String(row.commentId) : null;
            const animeMeta = animeId ? animeMetaMap.get(animeId) : undefined;

            return {
              id: String(row.id),
              type: String(row.type),
              message: String(row.message),
              read: Boolean(row.read),
              createdAt: normalizeUtcIsoString(row.createdAt),
              actorId: row.actorId ? String(row.actorId) : null,
              actorName: row.actorName ? String(row.actorName) : null,
              actorImage: row.actorImage ? String(row.actorImage) : null,
              commentId,
              animeId,
              episodeId: row.episodeId ? String(row.episodeId) : null,
              animeTitle: animeMeta?.title ?? null,
              animeCover: animeMeta?.cover ?? null,
              commentLikes: Number(row.commentLikes ?? 0) || 0,
              likeAvatars:
                row.type === "comment_like" && commentId
                  ? avatarsByCommentId.get(commentId) ?? []
                  : [],
            };
          });

          return Response.json({
            notifications,
            unreadCount,
          });
        } catch (error) {
          console.error("[api/notifications] Erro no GET:", error);
          return Response.json(
            { error: "Não foi possível carregar as notificações." },
            { status: 500 },
          );
        }
      },

      PATCH: async ({ request }) => {
        try {
          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);

          if (!apiUser?.id) {
            return Response.json(
              { error: "É necessário estar autenticado." },
              { status: 401 },
            );
          }

          let body: any = {};
          try {
            body = await request.json();
          } catch {
            return Response.json(
              { error: "Formato de dados inválido." },
              { status: 400 },
            );
          }

          const notificationId =
            typeof body?.id === "string" ? body.id.trim() : "";
          const markAll = body?.all === true;

          if (!notificationId && !markAll) {
            return Response.json(
              { error: "Informe 'id' ou 'all: true'." },
              { status: 400 },
            );
          }

          if (markAll) {
            await sql.query(
              `
                update "notification"
                set "read" = true
                where "userId" = $1
                  and "read" = false
              `,
              [apiUser.id],
            );
          } else {
            await sql.query(
              `
                update "notification"
                set "read" = true
                where "id" = $1
                  and "userId" = $2
              `,
              [notificationId, apiUser.id],
            );
          }

          const unreadResult = await sql.query(
            `
              select count(*)::int as "unreadCount"
              from "notification" n
              where ${VALID_NOTIFICATION_PREDICATE}
                and n."read" = false
            `,
            [apiUser.id],
          );

          const unreadRows: any[] = Array.isArray(unreadResult)
            ? unreadResult
            : (unreadResult as any)?.rows ?? [];
          const unreadCount = Number(unreadRows[0]?.unreadCount ?? 0) || 0;

          return Response.json({
            ok: true,
            unreadCount,
          });
        } catch (error) {
          console.error("[api/notifications] Erro no PATCH:", error);
          return Response.json(
            { error: "Não foi possível atualizar a notificação." },
            { status: 500 },
          );
        }
      },
    },
  },
});
