import { json } from "@tanstack/react-start";
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

function getDatabaseHash(value?: string) {
  if (!value || !value.trim()) {
    return "DATABASE_URL_NOT_SET";
  }

  return createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 12);
}

const runtimeDatabaseHash =
  getDatabaseHash(rawDatabaseUrl);

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
          return json(
            {
              notifications: [],
              unreadCount: 0,
              debug: {
                dbSource,
                databaseUrlConfigured:
                  dbSource === "neon",
                runtimeDatabaseHash,
              },
            },
            {
              status: 401,
            },
          );
        }

        const sql =
          await getSql();

        let notificationTableExists = false;
        let migration0011Registered = false;
        let migration010Registered = false;

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

        try {
          const migrationRows =
            await sql<{
              name: string;
            }>`
              select "name"
              from "_migrations"
              where "name" in (
                '0010_notification_fix.sql',
                '0011_notification_recreate.sql'
              )
              order by "name"
            `;

          migration0011Registered =
            migrationRows.some(
              (row) =>
                row.name ===
                "0011_notification_recreate.sql",
            );

          migration010Registered =
            migrationRows.some(
              (row) =>
                row.name ===
                "0010_notification_fix.sql",
            );
        } catch {
          migration0011Registered =
            false;
          migration010Registered =
            false;
        }

        if (!notificationTableExists) {
          return json({
            notifications: [],
            unreadCount: 0,

            debug: {
              dbSource,
              databaseUrlConfigured:
                dbSource === "neon",
              runtimeDatabaseHash,
              notificationTableExists,
              migration010Registered,
              migration0011Registered,
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
            actorId: string | null;
            actorName: string | null;
            actorImage: string | null;
          }>`
            select
              n."id",
              n."type",
              n."message",
              n."read",
              n."createdAt",
              n."actorId",
              u."name" as "actorName",
              u."image" as "actorImage"
            from "notification" n
            left join "user" u
              on u."id" = n."actorId"
            where
              n."userId" =
                ${session.user.id}
            order by
              n."createdAt" desc
            limit 50
          `;

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

        return json({
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
            migration010Registered,
            migration0011Registered,
          },
        });
      },
    },
  },
});
