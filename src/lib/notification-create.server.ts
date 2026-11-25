import type { Sql } from "@/lib/db";

export type NotificationType =
  | "new_follower"
  | "follow_request"
  | "follow_accept"
  | "comment_like"
  | "comment_reply"
  | "episode"
  | "account_banned"
  | "account_unbanned";

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
  ignoreOnConflict?: boolean;
}

const EPISODE_NOTIFICATION_TYPES = new Set([
  "episode",
  "episode_published",
  "new_episode",
]);

const ONE_SHOT_CONFLICT_IGNORE_TYPES = new Set([
  "account_banned",
  "account_unbanned",
  "episode",
  "episode_published",
  "new_episode",
]);

export function buildNotificationDedupKey(params: {
  userId: string;
  actorId?: string | null;
  type: string;
  commentId?: string | null;
  animeId?: string | null;
  episodeId?: string | null;
  dedupKey?: string | null;
}): string {
  if (params.dedupKey && params.dedupKey.trim()) {
    return params.dedupKey.trim();
  }
  const { userId, actorId, type, commentId, episodeId } = params;
  const safeActor = actorId ? String(actorId).trim() : "";
  const safeComment = commentId ? String(commentId).trim() : "";
  const safeEpisode = episodeId ? String(episodeId).trim() : "";

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
    case "episode":
    case "episode_published":
    case "new_episode":
      return safeEpisode
        ? `episode:${userId}:${safeEpisode}`
        : `${type}:${userId}:${safeActor}`;
    default:
      if (safeComment) {
        return `${type}:${userId}:${safeActor}:${safeComment}`;
      }
      return `${type}:${userId}:${safeActor}`;
  }
}

const notificationLocks = new Map<string, Promise<unknown>>();

function isForeignKeyViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "23503";
}

/**
 * Criação atômica de notificação com validação de:
 * 1. Não gerar auto-notificações (actorId === userId).
 * 2. Não notificar o autor real de um episódio sobre o episódio que ele próprio cadastrou/publicou.
 * 3. Bloqueio mútuo via user_block em qualquer direção.
 * 4. Deduplicação persistente no PostgreSQL via UNIQUE ("dedupKey") e ON CONFLICT.
 * 5. Mutex em memória (notificationLocks) como otimização local adicional.
 */
export async function executeCreateNotification(
  sql: Sql,
  params: CreateNotificationParams,
): Promise<{ success: boolean; notificationId?: string; reason?: string }> {
  const cleanUserId = typeof params.userId === "string" ? params.userId.trim() : "";
  const cleanActorId =
    typeof params.actorId === "string" && params.actorId.trim()
      ? params.actorId.trim()
      : null;

  if (!cleanUserId) {
    return { success: false, reason: "missing_user" };
  }

  if (cleanActorId && cleanActorId === cleanUserId) {
    return { success: false, reason: "self_action" };
  }

  const normalizedParams: CreateNotificationParams = {
    ...params,
    userId: cleanUserId,
    actorId: cleanActorId,
  };

  const dedupKey = buildNotificationDedupKey(normalizedParams);

  if (normalizedParams.bypassLock) {
    return executeCreateNotificationInternal(sql, normalizedParams, dedupKey);
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
    return await executeCreateNotificationInternal(sql, normalizedParams, dedupKey);
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

  // 2. Para notificações de episódio, verificar o autor real persistido em catalog_episode
  if (episodeId && EPISODE_NOTIFICATION_TYPES.has(type)) {
    try {
      const epAuthorRows = await sql<{ authorId: string | null }>`
        select "authorId"
        from "catalog_episode"
        where "id" = ${episodeId}
        limit 1
      `;
      const episodeAuthorId =
        typeof epAuthorRows[0]?.authorId === "string"
          ? epAuthorRows[0].authorId.trim()
          : "";
      if (episodeAuthorId && episodeAuthorId === userId) {
        return { success: false, reason: "self_episode_author" };
      }
    } catch {
      // Fail-open caso a tabela/coluna não exista em cenário isolado
    }
  }

  // 3. Não criar ou entregar notificações entre usuários com bloqueio ativo em qualquer direção
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

  // 4. Deduplicação persistente atômica via UNIQUE ("dedupKey")
  const newId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const shouldIgnoreOnConflict =
    params.ignoreOnConflict === true || ONE_SHOT_CONFLICT_IGNORE_TYPES.has(type);

  try {
    if (shouldIgnoreOnConflict) {
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
        on conflict ("dedupKey") do nothing
        returning "id"
      `;

      if (inserted.length === 0) {
        return { success: false, reason: "duplicate" };
      }
      return { success: true, notificationId: inserted[0].id };
    }

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
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return { success: false, reason: "missing_user_fk" };
    }
    throw err;
  }
}

export interface DispatchEpisodeNotificationsParams {
  animeId: string;
  candidateAnimeIds?: string[];
  episodeId: string;
  animeTitle?: string | null;
  episodeTitle?: string | null;
  episodeNumber?: number | null;
  episodeAuthorId?: string | null;
  publisherId?: string | null;
}

/**
 * Dispara notificações de novo episódio para seguidores/acompanhantes do anime,
 * garantindo que o autor real do episódio (persistido no banco) e quem o publicou
 * jamais recebam auto-notificações sobre o próprio episódio.
 */
export async function dispatchEpisodePublishedNotifications(
  sql: Sql,
  params: DispatchEpisodeNotificationsParams,
): Promise<{
  notifiedCount: number;
  excludedUserIds: string[];
  resolvedAuthorId: string | null;
}> {
  const canonicalAnimeId = params.animeId.trim();
  const episodeId = params.episodeId.trim();
  if (!canonicalAnimeId || !episodeId) {
    return { notifiedCount: 0, excludedUserIds: [], resolvedAuthorId: null };
  }

  let dbAuthorId: string | null = null;
  try {
    const epRows = await sql.query<{ authorId: string | null }>(
      `SELECT "authorId" FROM "catalog_episode" WHERE "id" = $1 LIMIT 1;`,
      [episodeId],
    );
    const rawAuthor = epRows[0]?.authorId;
    if (typeof rawAuthor === "string" && rawAuthor.trim()) {
      dbAuthorId = rawAuthor.trim();
    }
  } catch {
    // Non-fatal fallback
  }

  const explicitAuthorId =
    typeof params.episodeAuthorId === "string" && params.episodeAuthorId.trim()
      ? params.episodeAuthorId.trim()
      : null;
  const publisherId =
    typeof params.publisherId === "string" && params.publisherId.trim()
      ? params.publisherId.trim()
      : null;

  // Prioriza a autoria real persistida no episódio em catalog_episode
  const resolvedAuthorId = dbAuthorId || explicitAuthorId || publisherId || null;

  const excludedSet = new Set<string>();
  if (dbAuthorId) excludedSet.add(dbAuthorId);
  if (explicitAuthorId) excludedSet.add(explicitAuthorId);
  if (publisherId) excludedSet.add(publisherId);
  const excludedUserIds = Array.from(excludedSet);

  const animeIdsToMatch = Array.from(
    new Set(
      [canonicalAnimeId, ...(params.candidateAnimeIds ?? [])]
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );

  const followerQuery =
    excludedUserIds.length > 0
      ? await sql.query<{ userId: string }>(
          `SELECT DISTINCT u."userId"
           FROM (
             SELECT "userId" FROM "user_favorite"
             WHERE "animeId" = ANY($1) AND "targetType" = 'anime'
             UNION
             SELECT l."userId"
             FROM "user_custom_list_item" i
             JOIN "user_custom_list" l ON l."id" = i."listId"
             WHERE i."animeId" = ANY($1)
             UNION
             SELECT "userId" FROM "user_watched_episode"
             WHERE "animeId" = ANY($1)
             UNION
             SELECT "userId" FROM "user_anime_tracking"
             WHERE "animeId" = ANY($1)
           ) u
           INNER JOIN "user" usr ON usr."id" = u."userId"
           WHERE u."userId" != ALL($2::text[])
           LIMIT 2000;`,
          [animeIdsToMatch, excludedUserIds],
        )
      : await sql.query<{ userId: string }>(
          `SELECT DISTINCT u."userId"
           FROM (
             SELECT "userId" FROM "user_favorite"
             WHERE "animeId" = ANY($1) AND "targetType" = 'anime'
             UNION
             SELECT l."userId"
             FROM "user_custom_list_item" i
             JOIN "user_custom_list" l ON l."id" = i."listId"
             WHERE i."animeId" = ANY($1)
             UNION
             SELECT "userId" FROM "user_watched_episode"
             WHERE "animeId" = ANY($1)
             UNION
             SELECT "userId" FROM "user_anime_tracking"
             WHERE "animeId" = ANY($1)
           ) u
           INNER JOIN "user" usr ON usr."id" = u."userId"
           LIMIT 2000;`,
          [animeIdsToMatch],
        );

  const validFollowers = followerQuery.filter(
    (f) => f.userId && !excludedSet.has(f.userId.trim()),
  );

  if (validFollowers.length === 0) {
    return {
      notifiedCount: 0,
      excludedUserIds,
      resolvedAuthorId,
    };
  }

  const animeName = params.animeTitle?.trim() || canonicalAnimeId || "Anime";
  const epName =
    params.episodeTitle?.trim() ||
    (typeof params.episodeNumber === "number"
      ? `Episódio ${params.episodeNumber}`
      : "Novo episódio");
  const notifMessage = `Novo episódio disponível: ${animeName} - ${epName}`;
  const notifActorId = resolvedAuthorId;

  let notifiedCount = 0;
  const batchSize = 100;
  for (let i = 0; i < validFollowers.length; i += batchSize) {
    const chunk = validFollowers.slice(i, i + batchSize);
    const values: unknown[] = [];
    const valueRows: string[] = [];

    chunk.forEach((f, idx) => {
      const offset = idx * 8;
      const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const dedupKey = `episode:${f.userId}:${episodeId}`;
      valueRows.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, false, CURRENT_TIMESTAMP)`,
      );
      values.push(
        notifId,
        f.userId,
        notifActorId,
        "episode",
        notifMessage,
        canonicalAnimeId,
        episodeId,
        dedupKey,
      );
    });

    const inserted = await sql.query<{ id: string }>(
      `INSERT INTO "notification" (
         "id", "userId", "actorId", "type", "message",
         "animeId", "episodeId", "dedupKey", "read", "createdAt"
       )
       VALUES ${valueRows.join(", ")}
       ON CONFLICT ("dedupKey") DO NOTHING
       RETURNING "id";`,
      values,
    );
    notifiedCount += inserted.length;
  }

  return {
    notifiedCount,
    excludedUserIds,
    resolvedAuthorId,
  };
}
