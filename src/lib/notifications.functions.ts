import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

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
    image: string | null;
  }>;
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
}

/**
 * Criação atômica de notificação com validação de:
 * 1. Não gerar auto-notificações (actorId === userId).
 * 2. Bloqueio mútuo via user_block em qualquer direção.
 * 3. Deduplicação inteligente de eventos.
 */
export async function executeCreateNotification(
  sql: any,
  params: CreateNotificationParams,
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

  // 3. Deduplicação inteligente
  // a) Para new_follower: se já houver notificação desse actor para esse user, atualiza timestamp e read = false
  if (type === "new_follower" && actorId) {
    const existing = await sql<{ id: string }>`
      select "id" from "notification"
      where "userId" = ${userId}
        and "actorId" = ${actorId}
        and "type" = 'new_follower'
      order by "createdAt" desc
      limit 1
    `;
    if (existing[0]?.id) {
      await sql`
        update "notification"
        set
          "read" = false,
          "message" = ${message},
          "createdAt" = current_timestamp
        where "id" = ${existing[0].id}
      `;
      return { success: true, notificationId: existing[0].id };
    }
  }

  // b) Para follow_request: se já houver notificação pendente desse actor, atualiza
  if (type === "follow_request" && actorId) {
    const existing = await sql<{ id: string }>`
      select "id" from "notification"
      where "userId" = ${userId}
        and "actorId" = ${actorId}
        and "type" = 'follow_request'
      order by "createdAt" desc
      limit 1
    `;
    if (existing[0]?.id) {
      await sql`
        update "notification"
        set
          "read" = false,
          "message" = ${message},
          "createdAt" = current_timestamp
        where "id" = ${existing[0].id}
      `;
      return { success: true, notificationId: existing[0].id };
    }
  }

  // c) Para follow_accept: se houver follow_request anterior pendente, limpa-o
  if (type === "follow_accept" && actorId) {
    await sql`
      delete from "notification"
      where "userId" = ${actorId}
        and "actorId" = ${userId}
        and "type" = 'follow_request'
    `;
    const existing = await sql<{ id: string }>`
      select "id" from "notification"
      where "userId" = ${userId}
        and "actorId" = ${actorId}
        and "type" = 'follow_accept'
      order by "createdAt" desc
      limit 1
    `;
    if (existing[0]?.id) {
      await sql`
        update "notification"
        set
          "read" = false,
          "message" = ${message},
          "createdAt" = current_timestamp
        where "id" = ${existing[0].id}
      `;
      return { success: true, notificationId: existing[0].id };
    }
  }

  // d) Para comment_reply: evita duplicatas exatas nos últimos 5 segundos
  if (type === "comment_reply" && commentId && actorId) {
    const recent = await sql<{ id: string }>`
      select "id" from "notification"
      where "userId" = ${userId}
        and "actorId" = ${actorId}
        and "commentId" = ${commentId}
        and "type" = 'comment_reply'
        and "createdAt" > current_timestamp - interval '5 seconds'
      limit 1
    `;
    if (recent[0]?.id) {
      return { success: true, notificationId: recent[0].id };
    }
  }

  // 4. Inserção com ID único
  const newId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  await sql`
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
      "episodeId"
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
      ${episodeId ?? null}
    )
  `;

  return { success: true, notificationId: newId };
}

/**
 * Consulta lista de notificações do usuário com suporte a paginação e isolamento.
 */
export async function executeGetNotifications(
  sql: any,
  userId: string,
  params?: GetNotificationsParams,
): Promise<GetNotificationsResult> {
  const limit = Math.min(50, Math.max(1, Number(params?.limit ?? 20)));
  const offset = Math.max(0, Number(params?.offset ?? 0));
  const filter = params?.filter === "unread" ? "unread" : "all";

  // Consulta otimizada com índices compostos, filtrando bloqueios mútuos
  const rows = await sql<{
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
  }>`
    with target_notifications as (
      select n.*
      from "notification" n
      where n."userId" = ${userId}
        ${filter === "unread" ? sql`and n."read" = false` : sql``}
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
      order by n."createdAt" desc
      limit ${limit + 1}
      offset ${offset}
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
      end as "parentCommentAuthorName"
    from target_notifications n
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
  `;
  const unreadCount = Number(unreadRows[0]?.count ?? "0") || 0;

  // Total count
  const totalRows = await sql<{ count: string }>`
    select count(*)::text as count
    from "notification" n
    where n."userId" = ${userId}
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
  `;
  const totalCount = Number(totalRows[0]?.count ?? "0") || 0;

  const notifications: NotificationItem[] = items.map((r) => ({
    id: r.id,
    type: r.type,
    message: r.message,
    read: Boolean(r.read),
    createdAt: r.createdAt,
    actorId: r.actorId,
    actorName: r.actorName,
    actorNick: r.actorNick,
    actorImage: r.actorImage,
    commentId: r.commentId,
    animeId: r.animeId,
    episodeId: r.episodeId,
    commentContent: r.commentContent,
    commentHasMedia: Boolean(r.commentImageUrl),
    commentIsSpoiler: Boolean(r.commentIsSpoiler),
    parentCommentId: r.parentCommentId,
    parentCommentContent: r.parentCommentContent,
    parentCommentHasMedia: Boolean(r.parentCommentImageUrl),
    parentCommentIsSpoiler: Boolean(r.parentCommentIsSpoiler),
    parentCommentAuthorName: r.parentCommentAuthorName,
  }));

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
  sql: any,
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
  `;
  return {
    unreadCount: Number(rows[0]?.count ?? "0") || 0,
  };
}

/**
 * Marca uma notificação como lida com validação de titularidade.
 */
export async function executeMarkNotificationAsRead(
  sql: any,
  userId: string,
  notificationId: string,
): Promise<{ success: boolean }> {
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
  sql: any,
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
  sql: any,
  userId: string,
  notificationId: string,
): Promise<{ success: boolean }> {
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
  sql: any,
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
