import { json } from "@tanstack/react-start";
import {
  createFileRoute,
} from "@tanstack/react-router";

import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute(
  "/api/profile/follow",
)({
  server: {
    handlers: {
      POST: async ({
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
              error:
                "Você precisa estar conectado.",
            },
            {
              status: 401,
            },
          );
        }

        let body: {
          targetUserId?: unknown;
        };

        try {
          body =
            (await request.json()) as {
              targetUserId?: unknown;
            };
        } catch {
          return json(
            {
              error:
                "Dados inválidos.",
            },
            {
              status: 400,
            },
          );
        }

        const targetUserId =
          typeof body.targetUserId ===
          "string"
            ? body.targetUserId.trim()
            : "";

        if (!targetUserId) {
          return json(
            {
              error:
                "Usuário alvo não informado.",
            },
            {
              status: 400,
            },
          );
        }

        const currentUserId =
          session.user.id;

        if (
          targetUserId ===
          currentUserId
        ) {
          return json(
            {
              error:
                "Você não pode seguir a si mesmo.",
            },
            {
              status: 400,
            },
          );
        }

        const sql =
          await getSql();

        const targetUser =
          await sql<{
            id: string;
          }>`
            select "id"
            from "user"
            where "id" =
              ${targetUserId}
            limit 1
          `;

        if (
          targetUser.length ===
          0
        ) {
          return json(
            {
              error:
                "Usuário não encontrado.",
            },
            {
              status: 404,
            },
          );
        }

        const existing =
          await sql<{
            followerId: string;
            followingId: string;
          }>`
            select
              "followerId",
              "followingId"
            from "user_follow"
            where
              "followerId" =
                ${currentUserId}
              and
              "followingId" =
                ${targetUserId}
            limit 1
          `;

        let following = false;

        if (
          existing.length > 0
        ) {
          await sql`
            delete from "user_follow"
            where
              "followerId" =
                ${currentUserId}
              and
              "followingId" =
                ${targetUserId}
          `;

          following = false;
        } else {
          await sql`
            insert into "user_follow" (
              "followerId",
              "followingId"
            )
            values (
              ${currentUserId},
              ${targetUserId}
            )
            on conflict (
              "followerId",
              "followingId"
            )
            do nothing
          `;

          following = true;

          /*
           * A notificação é independente do seguimento.
           * Se houver algum problema na criação dela,
           * o usuário continua seguindo normalmente.
           */
          try {
            await sql`
              insert into "notification" (
                "id",
                "userId",
                "actorId",
                "type",
                "message"
              )
              values (
                ${crypto.randomUUID()},
                ${targetUserId},
                ${currentUserId},
                'follow',
                ${session.user.name ?? "Alguém"} || ' começou a seguir você.'
              )
            `;
          } catch {
            // Não interrompe o seguimento se a notificação falhar.
          }
        }

        const followerRows =
          await sql<{
            count: string;
          }>`
            select count(*)::text as count
            from "user_follow"
            where
              "followingId" =
                ${targetUserId}
          `;

        const followingRows =
          await sql<{
            count: string;
          }>`
            select count(*)::text as count
            from "user_follow"
            where
              "followerId" =
                ${targetUserId}
          `;

        return json({
          following,

          followersCount:
            Number(
              followerRows[0]
                ?.count ?? "0",
            ),

          followingCount:
            Number(
              followingRows[0]
                ?.count ?? "0",
            ),
        });
      },
    },
  },
});
