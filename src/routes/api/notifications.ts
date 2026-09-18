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
            select count(*)::text as count
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
        });
      },
    },
  },
});
