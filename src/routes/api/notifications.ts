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
} from "@/lib/notifications.functions";

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

          const result = await executeGetNotifications(sql, apiUser.id, {
            limit,
            offset,
            filter,
          });

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

          if (!notificationId && !deleteAll) {
            try {
              const body = await request.json();
              if (typeof body?.id === "string") {
                notificationId = body.id.trim();
              }
              if (body?.all === true) {
                deleteAll = true;
              }
            } catch {
              // Corpo JSON opcional
            }
          }

          if (!notificationId && !deleteAll) {
            return Response.json(
              { error: "Informe 'id' ou 'all: true'." },
              { status: 400 },
            );
          }

          if (deleteAll) {
            await executeDeleteAllNotifications(sql, apiUser.id);
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
