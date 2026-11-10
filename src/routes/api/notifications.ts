import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { resolveApiUser } from "@/lib/auth/api-session";
import {
  executeGetNotifications,
  executeGetUnreadNotificationCount,
  executeMarkNotificationAsRead,
  executeMarkAllNotificationsAsRead,
  executeDeleteNotification,
  executeDeleteAllNotifications,
  executeCreateNotification,
} from "@/lib/notifications.functions";
import type { Sql } from "@/lib/db";

async function seedInitialDevNotifications(sql: Sql, targetUser: string) {
  try {
    const actors = [
      { id: "actor_hinata", name: "Hinata Hyuga", nick: "hinata_h", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" },
      { id: "actor_naruto", name: "Naruto Uzumaki", nick: "naruto_u", avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150" },
      { id: "actor_sasuke", name: "Sasuke Uchiha", nick: "sasuke_u", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" },
      { id: "actor_sakura", name: "Sakura Haruno", nick: "sakura_h", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150" },
    ];

    for (const a of actors) {
      await sql`
        insert into "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt")
        values (${a.id}, ${a.name}, ${a.id + "@test.com"}, true, ${a.avatar}, current_timestamp, current_timestamp)
        on conflict ("id") do update set "name" = ${a.name}, "image" = ${a.avatar}
      `;
      await sql`
        insert into "profile" ("userId", "nick", "displayName", "avatarUrl", "accountType")
        values (${a.id}, ${a.nick}, ${a.name}, ${a.avatar}, 'public')
        on conflict ("userId") do update set "displayName" = ${a.name}, "nick" = ${a.nick}, "avatarUrl" = ${a.avatar}
      `;
    }

    // 1. Grouped followers (4 followers)
    for (const a of actors) {
      await executeCreateNotification(sql, {
        userId: targetUser,
        actorId: a.id,
        type: "new_follower",
        message: `${a.name} começou a seguir você.`,
      });
    }

    // 2. Comment & Reply
    const commentId = `seed_cmt_${targetUser}_1`;
    const replyId = `seed_rep_${targetUser}_1`;
    await sql`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "createdAt")
      values (${commentId}, ${targetUser}, 'solo-leveling', 'ep-1', 'A animação da transformação e os efeitos sonoros ficaram espetaculares!', current_timestamp)
      on conflict ("id") do nothing
    `;
    await sql`
      insert into "comment" ("id", "userId", "parentId", "animeId", "episodeId", "content", "createdAt")
      values (${replyId}, ${actors[0].id}, ${commentId}, 'solo-leveling', 'ep-1', 'Concordo plenamente! A trilha sonora dessa cena também arrepiou.', current_timestamp)
      on conflict ("id") do nothing
    `;
    await executeCreateNotification(sql, {
      userId: targetUser,
      actorId: actors[0].id,
      type: "comment_reply",
      message: `${actors[0].name} respondeu ao seu comentário.`,
      commentId: replyId,
      animeId: "solo-leveling",
      episodeId: "ep-1",
    });

    // 3. Likes on comment
    const commentId2 = `seed_cmt_${targetUser}_2`;
    await sql`
      insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "createdAt")
      values (${commentId2}, ${targetUser}, 'frieren', 'ep-4', 'Que obra de arte sensível e que direção de arte impecável.', current_timestamp)
      on conflict ("id") do nothing
    `;
    for (let i = 1; i <= 3; i++) {
      await sql`
        insert into "comment_like" ("id", "commentId", "userId", "type", "createdAt")
        values (${`like_${i}_${commentId2}`}, ${commentId2}, ${actors[i].id}, 'like', current_timestamp)
        on conflict ("id") do nothing
      `;
    }
    await executeCreateNotification(sql, {
      userId: targetUser,
      actorId: actors[1].id,
      type: "comment_like",
      message: `${actors[1].name} e mais 2 pessoas curtiram seu comentário.`,
      commentId: commentId2,
      animeId: "frieren",
      episodeId: "ep-4",
    });
  } catch (err) {
    console.warn("[api/notifications] Erro no seed inicial de preview:", err);
  }
}

export const Route = createFileRoute("/api/notifications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);

          if (!apiUser?.id) {
            return Response.json(
              { notifications: [], unreadCount: 0, totalCount: 0, hasMore: false },
              { status: 401 },
            );
          }

          const url = new URL(request.url);
          const limit = url.searchParams.has("limit")
            ? Number(url.searchParams.get("limit"))
            : 50;
          const offset = url.searchParams.has("offset")
            ? Number(url.searchParams.get("offset"))
            : 0;
          const filter =
            url.searchParams.get("filter") === "unread" ? "unread" : "all";

          let result = await executeGetNotifications(sql, apiUser.id, {
            limit,
            offset,
            filter,
          });

          // No ambiente dev/preview, se não houver notificações, popular automaticamente
          if (
            result.totalCount === 0 &&
            (!process.env.DATABASE_URL || apiUser.id === "dev-user")
          ) {
            await seedInitialDevNotifications(sql, apiUser.id);
            result = await executeGetNotifications(sql, apiUser.id, {
              limit,
              offset,
              filter,
            });
          }

          return Response.json(result, {
            headers: {
              "Cache-Control": "private, no-cache, no-store, must-revalidate",
            },
          });
        } catch (error) {
          console.error("[api/notifications] Erro no GET:", error);
          return Response.json(
            { error: "Não foi possível carregar as notificações." },
            {
              status: 500,
              headers: {
                "Cache-Control": "private, no-cache, no-store, must-revalidate",
              },
            },
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
          const notificationIds: string[] = Array.isArray(body?.ids)
            ? Array.from(
                new Set<string>(
                  (body.ids as unknown[])
                    .filter((item): item is string => typeof item === "string")
                    .map((item) => item.trim())
                    .filter(Boolean),
                ),
              ).slice(0, 100)
            : [];
          const markAll = body?.all === true;

          if (!notificationId && notificationIds.length === 0 && !markAll) {
            return Response.json(
              { error: "Informe 'id', 'ids' ou 'all: true'." },
              { status: 400 },
            );
          }

          if (markAll) {
            await executeMarkAllNotificationsAsRead(sql, apiUser.id);
          } else if (notificationIds.length > 0) {
            await sql`
              update "notification"
              set "read" = true
              where "userId" = ${apiUser.id}
                and "id" = any(${notificationIds}::text[])
                and "read" = false
            `;
          } else if (notificationId) {
            await executeMarkNotificationAsRead(sql, apiUser.id, notificationId);
          }

          const { unreadCount } = await executeGetUnreadNotificationCount(
            sql,
            apiUser.id,
          );

          return Response.json(
            {
              ok: true,
              unreadCount,
            },
            {
              headers: {
                "Cache-Control": "private, no-cache, no-store, must-revalidate",
              },
            },
          );
        } catch (error) {
          console.error("[api/notifications] Erro no PATCH:", error);
          return Response.json(
            { error: "Não foi possível atualizar a notificação." },
            {
              status: 500,
              headers: {
                "Cache-Control": "private, no-cache, no-store, must-revalidate",
              },
            },
          );
        }
      },

      DELETE: async ({ request }) => {
        try {
          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);

          if (!apiUser?.id) {
            return Response.json(
              { error: "Não autorizado." },
              { status: 401 },
            );
          }

          const url = new URL(request.url);
          let notificationId = url.searchParams.get("id")?.trim() || "";
          let deleteAll = url.searchParams.get("all") === "true";
          let notificationIds: string[] = [];

          if (!notificationId && !deleteAll) {
            try {
              const body = await request.json();
              if (typeof body?.id === "string") {
                notificationId = body.id.trim();
              }
              if (Array.isArray(body?.ids)) {
                notificationIds = body.ids
                  .filter((id: unknown): id is string => typeof id === "string")
                  .map((id: string) => id.trim())
                  .filter(Boolean);
              }
              if (body?.all === true) {
                deleteAll = true;
              }
            } catch {
              // Corpo JSON opcional
            }
          }

          if (!notificationId && notificationIds.length === 0 && !deleteAll) {
            return Response.json(
              { error: "Informe 'id', 'ids' ou 'all: true'." },
              { status: 400 },
            );
          }

          if (deleteAll) {
            await executeDeleteAllNotifications(sql, apiUser.id);
          } else if (notificationIds.length > 0) {
            await sql`
              delete from "notification"
              where "userId" = ${apiUser.id}
                and "id" = any(${notificationIds}::text[])
            `;
          } else if (notificationId) {
            await executeDeleteNotification(sql, apiUser.id, notificationId);
          }

          const { unreadCount } = await executeGetUnreadNotificationCount(
            sql,
            apiUser.id,
          );

          return Response.json(
            {
              ok: true,
              unreadCount,
            },
            {
              headers: {
                "Cache-Control": "private, no-cache, no-store, must-revalidate",
              },
            },
          );
        } catch (error) {
          console.error("[api/notifications] Erro no DELETE:", error);
          return Response.json(
            { error: "Não foi possível excluir a notificação." },
            {
              status: 500,
              headers: {
                "Cache-Control": "private, no-cache, no-store, must-revalidate",
              },
            },
          );
        }
      },
    },
  },
});
