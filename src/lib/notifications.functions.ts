import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";

export type NotificationType =
  | "new_follower"
  | "follow_request"
  | "follow_accept"
  | "comment_like"
  | "comment_reply";

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;

  actorId: string | null;
  actorName: string | null;
  actorNick: string | null;
  actorImage: string | null;

  commentId: string | null;
  animeId: string | null;
  episodeId: string | null;

  animeTitle?: string | null;
  animeCover?: string | null;
  animeSeasonNumber?: number | null;

  commentContent?: string | null;
  commentHasMedia?: boolean;
  commentIsSpoiler?: boolean;

  parentCommentId?: string | null;
  parentCommentContent?: string | null;
  parentCommentHasMedia?: boolean;
  parentCommentIsSpoiler?: boolean;
  parentCommentAuthorName?: string | null;

  commentLikes?: number;
  likeAvatars?: Array<{
    id: string;
    name: string | null;
    nick?: string | null;
    image: string | null;
  }>;

  isFollowingActor?: boolean;
  groupedIds?: string[];
  groupedFollowers?: Array<{
    id: string;
    name: string | null;
    nick: string | null;
    image: string | null;
  }>;
  totalFollowersCount?: number;
};

export type GetNotificationsParams = {
  limit?: number;
  offset?: number;
  filter?: "all" | "unread";
};

export type GetNotificationsResult = {
  notifications: NotificationItem[];
  unreadCount: number;
  totalCount: number;
  hasMore: boolean;
  limit: number;
  offset: number;
};

export interface CreateNotificationParams {
  userId: string;
  actorId?: string | null;
  type: NotificationType | string;
  message: string;
  commentId?: string | null;
  animeId?: string | null;
  episodeId?: string | null;
  dedupKey?: string | null;
  bypassLock?: boolean;
}

export interface RawNotificationRow {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  actorId: string | null;
  actorName: string | null;
  actorNick: string | null;
  actorImage: string | null;
  commentId: string | null;
  animeId: string | null;
  episodeId: string | null;
  commentContent: string | null;
  commentImageUrl: string | null;
  commentIsSpoiler: boolean | null;
  parentCommentId: string | null;
  parentCommentContent: string | null;
  parentCommentImageUrl: string | null;
  parentCommentIsSpoiler: boolean | null;
  parentCommentAuthorName: string | null;
  commentLikes: number | null;
  dedupKey?: string | null;
}

import { FALLBACK_ANIMES } from "@/lib/fallback-catalog";
import { displayTitle } from "@/lib/types";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const ANIME_META_TTL_MS = 1000 * 60 * 30;

type CachedAnimeMeta = {
  title: string | null;
  cover: string | null;
  seasonNumber: number | null;
  expiresAt: number;
};

const animeMetaCache = new Map<string, CachedAnimeMeta>();

function extractSeasonNumberFromText(value: string | null | undefined): number | null {
  if (!value) return null;
  const text = value.trim();
  if (!text) return null;

  const patterns = [
    /\b(?:season|temporada)\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*(?:ª|º|a|o)\s*temporada\b/i,
    /\b(\d{1,2})(?:st|nd|rd|th)\s+season\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const parsed = Number(match[1]);
      if (Number.isInteger(parsed) && parsed > 0 && parsed <= 50) {
        return parsed;
      }
    }
  }

  return null;
}

function inferSeasonNumber(params: {
  titles: Array<string | null | undefined>;
  format?: string | null;
  tvPrequelCount?: number;
}): number | null {
  for (const title of params.titles) {
    const explicit = extractSeasonNumberFromText(title);
    if (explicit !== null) {
      return explicit;
    }
  }

  const normalizedFormat = (params.format ?? "").toUpperCase();
  if (
    normalizedFormat === "TV" ||
    normalizedFormat === "TV_SHORT" ||
    normalizedFormat === "ONA"
  ) {
    const prequels = Math.max(0, Number(params.tvPrequelCount ?? 0) || 0);
    return prequels + 1;
  }

  return null;
}

export async function resolveAnimeMetadataMap(
  animeIds: string[],
): Promise<
  Map<
    string,
    { title: string | null; cover: string | null; seasonNumber: number | null }
  >
> {
  const result = new Map<
    string,
    { title: string | null; cover: string | null; seasonNumber: number | null }
  >();
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
      result.set(id, {
        title: cached.title,
        cover: cached.cover,
        seasonNumber: cached.seasonNumber,
      });
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
        seasonNumber: inferSeasonNumber({
          titles: [
            fallback.titles.english,
            fallback.titles.romaji,
            fallback.titles.native,
          ],
          format: fallback.format,
        }),
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
                  format
                  title {
                    english
                    romaji
                    native
                  }
                  coverImage {
                    extraLarge
                    large
                  }
                  relations {
                    edges {
                      relationType(version: 2)
                      node {
                        id
                        type
                        format
                      }
                    }
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
                format?: string | null;
                title?: {
                  english?: string | null;
                  romaji?: string | null;
                  native?: string | null;
                } | null;
                coverImage?: {
                  extraLarge?: string | null;
                  large?: string | null;
                } | null;
                relations?: {
                  edges?: Array<{
                    relationType?: string | null;
                    node?: {
                      id?: number;
                      type?: string | null;
                      format?: string | null;
                    } | null;
                  }> | null;
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

          const tvPrequelCount = (media.relations?.edges ?? []).filter(
            (edge) => {
              const rel = (edge?.relationType ?? "").toUpperCase();
              const nodeType = (edge?.node?.type ?? "").toUpperCase();
              const nodeFormat = (edge?.node?.format ?? "").toUpperCase();
              return (
                rel === "PREQUEL" &&
                nodeType === "ANIME" &&
                (nodeFormat === "TV" ||
                  nodeFormat === "TV_SHORT" ||
                  nodeFormat === "ONA")
              );
            },
          ).length;

          const seasonNumber = inferSeasonNumber({
            titles: [
              media.title?.english,
              media.title?.romaji,
              media.title?.native,
            ],
            format: media.format,
            tvPrequelCount,
          });

          result.set(key, { title, cover, seasonNumber });
          animeMetaCache.set(key, {
            title,
            cover,
            seasonNumber,
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

export function buildNotificationDedupKey(params: {
  userId: string;
  actorId?: string | null;
  type: string;
  commentId?: string | null;
  dedupKey?: string | null;
}): string {
  if (params.dedupKey && params.dedupKey.trim()) {
    return params.dedupKey.trim();
  }
  const { userId, actorId, type, commentId } = params;
  const safeActor = actorId ? String(actorId).trim() : "";
  const safeComment = commentId ? String(commentId).trim() : "";

  switch (type) {
    case "new_follower":
      return `new_follower:${userId}:${safeActor}`;
    case "follow_request":
      return `follow_request:${userId}:${safeActor}`;
    case "follow_accept":
      return `follow_accept:${userId}:${safeActor}`;
    case "comment_like":
      return `comment_like:${userId}:${safeComment}`;
    case "comment_reply":
      return `comment_reply:${userId}:${safeActor}:${safeComment}`;
    default:
      if (safeComment) {
        return `${type}:${userId}:${safeActor}:${safeComment}`;
      }
      return `${type}:${userId}:${safeActor}`;
  }
}

const notificationLocks = new Map<string, Promise<unknown>>();

/**
 * Criação atômica de notificação com validação de:
 * 1. Não gerar auto-notificações (actorId === userId).
 * 2. Bloqueio mútuo via user_block em qualquer direção.
 * 3. Deduplicação persistente no PostgreSQL via UNIQUE ("dedupKey") e ON CONFLICT.
 * 4. Mutex em memória (notificationLocks) como otimização local adicional.
 */
export async function executeCreateNotification(
  sql: Sql,
  params: CreateNotificationParams,
): Promise<{ success: boolean; notificationId?: string; reason?: string }> {
  // 1. Evitar notificações para ações do próprio usuário logo no início
  if (params.actorId && params.actorId === params.userId) {
    return { success: false, reason: "self_action" };
  }

  const dedupKey = buildNotificationDedupKey(params);

  // Se bypassLock for solicitado (ex: teste de concorrência pura entre instâncias), vai direto ao banco
  if (params.bypassLock) {
    return executeCreateNotificationInternal(sql, params, dedupKey);
  }

  const lockKey = dedupKey;
  const previous = notificationLocks.get(lockKey) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  notificationLocks.set(lockKey, previous.then(() => current, () => current));

  await previous;
  try {
    return await executeCreateNotificationInternal(sql, params, dedupKey);
  } finally {
    release();
    if (notificationLocks.get(lockKey) === current) {
      notificationLocks.delete(lockKey);
    }
  }
}

async function executeCreateNotificationInternal(
  sql: Sql,
  params: CreateNotificationParams,
  dedupKey: string,
): Promise<{ success: boolean; notificationId?: string; reason?: string }> {
  const { userId, actorId, type, message, commentId, animeId, episodeId } = params;

  // 1. Evitar notificações para ações do próprio usuário
  if (actorId && actorId === userId) {
    return { success: false, reason: "self_action" };
  }

  // 2. Não criar ou entregar notificações entre usuários com bloqueio ativo em qualquer direção
  if (actorId) {
    const blockRows = await sql<{ count: string }>`
      select count(*)::text as count
      from "user_block"
      where ("blockerId" = ${userId} and "blockedId" = ${actorId})
         or ("blockerId" = ${actorId} and "blockedId" = ${userId})
      limit 1
    `;
    if (Number(blockRows[0]?.count ?? "0") > 0) {
      return { success: false, reason: "blocked_user" };
    }
  }

  // 3. Deduplicação persistente atômica via INSERT ... ON CONFLICT ("dedupKey") DO UPDATE
  const newId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const inserted = await sql<{ id: string }>`
    insert into "notification" (
      "id",
      "userId",
      "actorId",
      "type",
      "message",
      "read",
      "createdAt",
      "commentId",
      "animeId",
      "episodeId",
      "dedupKey"
    )
    values (
      ${newId},
      ${userId},
      ${actorId ?? null},
      ${type},
      ${message},
      false,
      current_timestamp,
      ${commentId ?? null},
      ${animeId ?? null},
      ${episodeId ?? null},
      ${dedupKey}
    )
    on conflict ("dedupKey") do update
    set
      "actorId" = coalesce(excluded."actorId", "notification"."actorId"),
      "message" = excluded."message",
      "read" = false,
      "createdAt" = current_timestamp,
      "commentId" = coalesce(excluded."commentId", "notification"."commentId"),
      "animeId" = coalesce(excluded."animeId", "notification"."animeId"),
      "episodeId" = coalesce(excluded."episodeId", "notification"."episodeId")
    returning "id"
  `;

  const returnedId = inserted[0]?.id || newId;
  return { success: true, notificationId: returnedId };
}

/**
 * Consulta lista de notificações do usuário com suporte a paginação e isolamento.
 */
export async function executeGetNotifications(
  sql: Sql,
  userId: string,
  params?: GetNotificationsParams,
): Promise<GetNotificationsResult> {
  const limit = Math.min(50, Math.max(1, Number(params?.limit ?? 20)));
  const offset = Math.max(0, Number(params?.offset ?? 0));
  const filter = params?.filter === "unread" ? "unread" : "all";

  // Consulta otimizada com índices compostos, filtrando bloqueios mútuos e recursos válidos
  const rows: RawNotificationRow[] = await sql<RawNotificationRow>`
    with target_notifications as (
      select n.*
      from "notification" n
      where n."userId" = ${userId}
        and (${filter} = 'all' or n."read" = false)
        and (
          n."actorId" is null
          or not exists (
            select 1 from "user_block" ub
            where (ub."blockerId" = ${userId} and ub."blockedId" = n."actorId")
               or (ub."blockerId" = n."actorId" and ub."blockedId" = ${userId})
          )
        )
        and (
          n."commentId" is null
          or exists (
            select 1 from "comment" c
            where c."id" = n."commentId"
          )
        )
        and (
          n."type" <> 'comment_like'
          or (
            n."commentId" is not null
            and exists (
              select 1 from "comment_like" cl
              where cl."commentId" = n."commentId"
                and (cl."type" = 'like' or cl."type" is null)
                and cl."userId" <> n."userId"
            )
          )
        )
      order by n."createdAt" desc
      limit ${limit + 1}
      offset ${offset}
    ),
    like_counts as (
      select
        cl."commentId",
        count(*)::int as "likesCount"
      from "comment_like" cl
      where (cl."type" = 'like' or cl."type" is null)
        and cl."userId" <> ${userId}
        and cl."commentId" in (
          select distinct tn."commentId"
          from target_notifications tn
          where tn."type" = 'comment_like'
            and tn."commentId" is not null
        )
      group by cl."commentId"
    )
    select
      n."id",
      n."type",
      n."message",
      n."read",
      to_char(n."createdAt" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAt",
      n."actorId",
      case
        when n."actorId" is not null then coalesce(
          nullif(trim(p."displayName"), ''),
          nullif(trim(p."nick"), ''),
          nullif(trim(u."name"), ''),
          'Usuário'
        )
        else null
      end as "actorName",
      p."nick" as "actorNick",
      coalesce(p."avatarUrl", u."image") as "actorImage",
      n."commentId",
      coalesce(
        nullif(trim(n."animeId"), ''),
        nullif(trim(c."animeId"), '')
      ) as "animeId",
      coalesce(
        nullif(trim(n."episodeId"), ''),
        nullif(trim(c."episodeId"), '')
      ) as "episodeId",
      c."content" as "commentContent",
      c."imageUrl" as "commentImageUrl",
      coalesce(c."isSpoiler", false) as "commentIsSpoiler",
      c."parentId" as "parentCommentId",
      pc."content" as "parentCommentContent",
      pc."imageUrl" as "parentCommentImageUrl",
      coalesce(pc."isSpoiler", false) as "parentCommentIsSpoiler",
      case
        when pc."userId" is not null then coalesce(
          nullif(trim(pp."displayName"), ''),
          nullif(trim(pp."nick"), ''),
          nullif(trim(pu."name"), ''),
          'Usuário'
        )
        else null
      end as "parentCommentAuthorName",
      case
        when n."type" = 'comment_like' and n."commentId" is not null then coalesce(lc."likesCount", 0)::int
        else 0
      end as "commentLikes"
    from target_notifications n
    left join like_counts lc on lc."commentId" = n."commentId"
    left join "user" u on u."id" = n."actorId"
    left join "profile" p on p."userId" = n."actorId"
    left join "comment" c on c."id" = n."commentId"
    left join "comment" pc on pc."id" = c."parentId"
    left join "user" pu on pu."id" = pc."userId"
    left join "profile" pp on pp."userId" = pc."userId"
    order by n."createdAt" desc
  `;

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  // Unread count em query separada, sem carregar histórico completo
  const unreadRows = await sql<{ count: string }>`
    select count(*)::text as count
    from "notification" n
    where n."userId" = ${userId}
      and n."read" = false
      and (
        n."actorId" is null
        or not exists (
          select 1 from "user_block" ub
          where (ub."blockerId" = ${userId} and ub."blockedId" = n."actorId")
             or (ub."blockerId" = n."actorId" and ub."blockedId" = ${userId})
        )
      )
      and (
        n."commentId" is null
        or exists (
          select 1 from "comment" c
          where c."id" = n."commentId"
        )
      )
      and (
        n."type" <> 'comment_like'
        or (
          n."commentId" is not null
          and exists (
            select 1 from "comment_like" cl
            where cl."commentId" = n."commentId"
              and (cl."type" = 'like' or cl."type" is null)
              and cl."userId" <> n."userId"
          )
        )
      )
  `;
  const unreadCount = Number(unreadRows[0]?.count ?? "0") || 0;

  // Total count
  const totalRows = await sql<{ count: string }>`
    select count(*)::text as count
    from "notification" n
    where n."userId" = ${userId}
      and (${filter} = 'all' or n."read" = false)
      and (
        n."actorId" is null
        or not exists (
          select 1 from "user_block" ub
          where (ub."blockerId" = ${userId} and ub."blockedId" = n."actorId")
             or (ub."blockerId" = n."actorId" and ub."blockedId" = ${userId})
        )
      )
      and (
        n."commentId" is null
        or exists (
          select 1 from "comment" c
          where c."id" = n."commentId"
        )
      )
      and (
        n."type" <> 'comment_like'
        or (
          n."commentId" is not null
          and exists (
            select 1 from "comment_like" cl
            where cl."commentId" = n."commentId"
              and (cl."type" = 'like' or cl."type" is null)
              and cl."userId" <> n."userId"
          )
        )
      )
  `;
  const totalCount = Number(totalRows[0]?.count ?? "0") || 0;

  // Verifica se o usuário atual já segue os atores das notificações
  const actorIds: string[] = Array.from(
    new Set<string>(
      items
        .map((r: RawNotificationRow) => r.actorId)
        .filter((id): id is string => Boolean(id) && id !== userId),
    ),
  );

  const followingActorIdSet = new Set<string>();
  if (actorIds.length > 0) {
    const followRows = await sql<{ followingId: string }>`
      select "followingId"
      from "user_follow"
      where "followerId" = ${userId}
        and "followingId" = any(${actorIds}::text[])
    `;
    for (const row of followRows) {
      if (row.followingId) {
        followingActorIdSet.add(row.followingId);
      }
    }
  }

  // Carrega avatares de likes
  const likeCommentIds: string[] = Array.from(
    new Set<string>(
      items
        .filter((r: RawNotificationRow) => r.type === "comment_like" && Boolean(r.commentId))
        .map((r: RawNotificationRow) => String(r.commentId)),
    ),
  );

  const avatarsByCommentId = new Map<
    string,
    Array<{ id: string; name: string | null; nick: string | null; image: string | null }>
  >();

  if (likeCommentIds.length > 0) {
    const avatarRows = await sql<{
      commentId: string;
      id: string;
      name: string | null;
      nick: string | null;
      image: string | null;
    }>`
      select
        cl."commentId",
        u."id",
        coalesce(
          nullif(trim(p."displayName"), ''),
          nullif(trim(p."nick"), ''),
          nullif(trim(u."name"), ''),
          'Usuário'
        ) as "name",
        p."nick",
        coalesce(p."avatarUrl", u."image") as "image"
      from "comment_like" cl
      inner join "user" u on u."id" = cl."userId"
      left join "profile" p on p."userId" = u."id"
      where cl."userId" <> ${userId}
        and (cl."type" = 'like' or cl."type" is null)
        and cl."commentId" = any(${likeCommentIds}::text[])
      order by cl."createdAt" desc
    `;

    for (const row of avatarRows) {
      const cid = String(row.commentId);
      const list = avatarsByCommentId.get(cid) ?? [];
      if (list.length < 5 && !list.some((item) => item.id === String(row.id))) {
        list.push({
          id: String(row.id),
          name: row.name ? String(row.name) : null,
          nick: row.nick ? String(row.nick) : null,
          image: row.image ? String(row.image) : null,
        });
        avatarsByCommentId.set(cid, list);
      }
    }
  }

  // Resolve metadados de anime
  const distinctAnimeIds: string[] = Array.from(
    new Set<string>(
      items
        .map((r: RawNotificationRow) => (typeof r.animeId === "string" ? r.animeId.trim() : ""))
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const animeMetaMap = await resolveAnimeMetadataMap(distinctAnimeIds);

  const unbundledNotifications: NotificationItem[] = items.map((r: RawNotificationRow) => {
    const animeId = r.animeId ? String(r.animeId) : null;
    const commentId = r.commentId ? String(r.commentId) : null;
    const animeMeta = animeId ? animeMetaMap.get(animeId) : undefined;
    const isFollowingActor = Boolean(r.actorId && followingActorIdSet.has(r.actorId));

    return {
      id: r.id,
      type: r.type,
      message: r.message,
      read: Boolean(r.read),
      createdAt: r.createdAt,
      actorId: r.actorId,
      actorName: r.actorName,
      actorNick: r.actorNick,
      actorImage: r.actorImage,
      commentId,
      animeId,
      episodeId: r.episodeId,
      animeTitle: animeMeta?.title ?? null,
      animeCover: animeMeta?.cover ?? null,
      animeSeasonNumber: animeMeta?.seasonNumber ?? null,
      commentContent: r.commentContent,
      commentHasMedia: Boolean(r.commentImageUrl),
      commentIsSpoiler: Boolean(r.commentIsSpoiler),
      parentCommentId: r.parentCommentId,
      parentCommentContent: r.parentCommentContent,
      parentCommentHasMedia: Boolean(r.parentCommentImageUrl),
      parentCommentIsSpoiler: Boolean(r.parentCommentIsSpoiler),
      parentCommentAuthorName: r.parentCommentAuthorName,
      commentLikes: Number(r.commentLikes ?? 0) || 0,
      likeAvatars:
        r.type === "comment_like" && commentId
          ? avatarsByCommentId.get(commentId) ?? []
          : [],
      isFollowingActor,
    };
  });

  // Agrupamento de novos seguidores:
  // Quando houver 1 ou 2 novos seguidores, mostrar notificações individuais.
  // A partir de 3 novos seguidores, agrupar em uma notificação.
  const followerItems = unbundledNotifications.filter((n) => n.type === "new_follower");
  let notifications: NotificationItem[] = unbundledNotifications;

  if (followerItems.length >= 3) {
    const newest = followerItems[0];
    const groupedIds = followerItems.map((f) => f.id);
    const allRead = followerItems.every((f) => f.read);

    const distinctFollowers = Array.from(
      new Map(
        followerItems
          .filter((f) => Boolean(f.actorId))
          .map((f) => [
            f.actorId!,
            {
              id: f.actorId!,
              name: f.actorName,
              nick: f.actorNick,
              image: f.actorImage,
            },
          ]),
      ).values(),
    );

    const firstNames = distinctFollowers
      .slice(0, 2)
      .map((f) => f.name || (f.nick ? `@${f.nick}` : "Usuário"))
      .join(", ");
    const remainingCount = followerItems.length - 2;
    const groupMessage =
      remainingCount > 0
        ? `${firstNames} e mais ${remainingCount} pessoas começaram a seguir você.`
        : `Você tem ${followerItems.length} novos seguidores.`;

    const groupedItem: NotificationItem = {
      id: `grouped-followers-${newest.id}`,
      type: "grouped_followers",
      message: groupMessage,
      read: allRead,
      createdAt: newest.createdAt,
      actorId: newest.actorId,
      actorName: newest.actorName,
      actorNick: newest.actorNick,
      actorImage: newest.actorImage,
      commentId: null,
      animeId: null,
      episodeId: null,
      commentLikes: 0,
      likeAvatars: [],
      groupedIds,
      groupedFollowers: distinctFollowers,
      totalFollowersCount: followerItems.length,
    };

    let inserted = false;
    const collapsed: NotificationItem[] = [];
    for (const item of unbundledNotifications) {
      if (item.type === "new_follower") {
        if (!inserted) {
          collapsed.push(groupedItem);
          inserted = true;
        }
      } else {
        collapsed.push(item);
      }
    }
    notifications = collapsed;
  }

  return {
    notifications,
    unreadCount,
    totalCount,
    hasMore,
    limit,
    offset,
  };
}

/**
 * Consulta quantidade de notificações não lidas.
 */
export async function executeGetUnreadNotificationCount(
  sql: Sql,
  userId: string,
): Promise<{ unreadCount: number }> {
  const rows = await sql<{ count: string }>`
    select count(*)::text as count
    from "notification" n
    where n."userId" = ${userId}
      and n."read" = false
      and (
        n."actorId" is null
        or not exists (
          select 1 from "user_block" ub
          where (ub."blockerId" = ${userId} and ub."blockedId" = n."actorId")
             or (ub."blockerId" = n."actorId" and ub."blockedId" = ${userId})
        )
      )
      and (
        n."commentId" is null
        or exists (
          select 1 from "comment" c
          where c."id" = n."commentId"
        )
      )
      and (
        n."type" <> 'comment_like'
        or (
          n."commentId" is not null
          and exists (
            select 1 from "comment_like" cl
            where cl."commentId" = n."commentId"
              and (cl."type" = 'like' or cl."type" is null)
              and cl."userId" <> n."userId"
          )
        )
      )
  `;
  return {
    unreadCount: Number(rows[0]?.count ?? "0") || 0,
  };
}

/**
 * Marca uma notificação como lida com validação de titularidade.
 */
export async function executeMarkNotificationAsRead(
  sql: Sql,
  userId: string,
  notificationId: string,
): Promise<{ success: boolean }> {
  if (notificationId.startsWith("grouped-followers-")) {
    const result = await sql`
      update "notification"
      set "read" = true
      where "userId" = ${userId}
        and "type" = 'new_follower'
        and "read" = false
      returning "id"
    `;
    return { success: result.length > 0 };
  }

  const result = await sql`
    update "notification"
    set "read" = true
    where "id" = ${notificationId}
      and "userId" = ${userId}
      and "read" = false
    returning "id"
  `;
  return { success: result.length > 0 };
}

/**
 * Marca todas as notificações do usuário como lidas.
 */
export async function executeMarkAllNotificationsAsRead(
  sql: Sql,
  userId: string,
): Promise<{ success: boolean; updatedCount: number }> {
  const result = await sql`
    update "notification"
    set "read" = true
    where "userId" = ${userId}
      and "read" = false
    returning "id"
  `;
  return { success: true, updatedCount: result.length };
}

/**
 * Exclui uma notificação individual com validação de titularidade.
 */
export async function executeDeleteNotification(
  sql: Sql,
  userId: string,
  notificationId: string,
): Promise<{ success: boolean }> {
  if (notificationId.startsWith("grouped-followers-")) {
    const result = await sql`
      delete from "notification"
      where "userId" = ${userId}
        and "type" = 'new_follower'
      returning "id"
    `;
    return { success: result.length > 0 };
  }

  const result = await sql`
    delete from "notification"
    where "id" = ${notificationId}
      and "userId" = ${userId}
    returning "id"
  `;
  return { success: result.length > 0 };
}

/**
 * Exclui todas as notificações do usuário autenticado.
 */
export async function executeDeleteAllNotifications(
  sql: Sql,
  userId: string,
): Promise<{ success: boolean; deletedCount: number }> {
  const result = await sql`
    delete from "notification"
    where "userId" = ${userId}
    returning "id"
  `;
  return { success: true, deletedCount: result.length };
}

/* ============================================================ */
/* SERVER FUNCTIONS AUTENTICADAS (TanStack Start)                */
/* ============================================================ */

export const getNotificationsSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  offset: z.number().int().min(0).optional(),
  filter: z.enum(["all", "unread"]).optional(),
});

export const singleNotificationSchema = z.object({
  id: z.string().trim().min(1, "ID da notificação é obrigatório"),
});

/**
 * Listar notificações do usuário autenticado com paginação sob demanda.
 */
export const getNotifications = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .validator((d?: GetNotificationsParams) =>
    getNotificationsSchema.optional().parse(d),
  )
  .handler(async ({ context, data }): Promise<GetNotificationsResult> => {
    const sql = await getSql();
    return executeGetNotifications(sql, context.userId, data);
  });

/**
 * Consultar quantidade de notificações não lidas.
 */
export const getUnreadNotificationCount = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ unreadCount: number }> => {
    const sql = await getSql();
    return executeGetUnreadNotificationCount(sql, context.userId);
  });

/**
 * Marcar uma notificação como lida.
 */
export const markNotificationAsRead = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator((d: { id: string }) => singleNotificationSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return executeMarkNotificationAsRead(sql, context.userId, data.id);
  });

/**
 * Marcar todas as notificações como lidas.
 */
export const markAllNotificationsAsRead = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return executeMarkAllNotificationsAsRead(sql, context.userId);
  });

/**
 * Excluir uma notificação individual.
 */
export const deleteNotification = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator((d: { id: string }) => singleNotificationSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return executeDeleteNotification(sql, context.userId, data.id);
  });

/**
 * Excluir todas as notificações do usuário autenticado.
 */
export const deleteAllNotifications = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return executeDeleteAllNotifications(sql, context.userId);
  });
