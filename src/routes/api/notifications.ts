import {
  createFileRoute,
} from "@tanstack/react-router";
import { createHash } from "node:crypto";

import { getSql, dbSource } from "@/lib/db";
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

        // =====================================================
        // VERIFICAR SE A TABELA EXISTE
        // =====================================================

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

        // =====================================================
        // BUSCAR NOTIFICAÇÕES
        // =====================================================

        const notifications =
          await sql<{
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
              n."episodeId"

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

        // =====================================================
        // CONTAR NÃO LIDAS
        // =====================================================

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
          notifications,

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
