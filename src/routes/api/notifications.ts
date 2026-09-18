import { json } from "@tanstack/react-start";
import {
  createFileRoute,
} from "@tanstack/react-router";

import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";

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
            },
            {
              status: 401,
            },
          );
        }

        const sql =
          await getSql();

        /*
         * Diagnóstico temporário:
         * verifica se a tabela notification realmente
         * existe no mesmo banco usado pelo Runtime.
         */
        const tableCheck =
          await sql<{
            exists: boolean;
          }>`
            select
              to_regclass(
                'public.notification'
              ) is not null as "exists"
          `;

        const notificationExists =
          Boolean(
            tableCheck[0]?.exists,
          );

        /*
         * Verifica se a migration 0011
         * está registrada neste mesmo banco.
         */
        let migrationExists =
          false;

        try {
          const migrationCheck =
            await sql<{
              exists: boolean;
            }>`
              select exists (
                select 1
                from "_migrations"
                where "name" =
                  '0011_notification_recreate.sql'
              ) as "exists"
            `;

          migrationExists =
            Boolean(
              migrationCheck[0]?.exists,
            );
        } catch {
          migrationExists = false;
        }

        /*
         * Se a tabela não existe, não deixa a API
         * quebrar. Retorna o diagnóstico.
         */
        if (!notificationExists) {
          return json({
            notifications: [],
            unreadCount: 0,

            debug: {
              notificationTableExists:
                false,

              migration0011Registered:
                migrationExists,
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
              on u."id" =
                n."actorId"
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
            notificationTableExists:
              true,

            migration0011Registered:
              migrationExists,
          },
        });
      },
    },
  },
});
