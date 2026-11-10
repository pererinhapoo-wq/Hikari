import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { resolveApiUser } from "@/lib/auth/api-session";
import { executeCreateNotification } from "@/lib/notifications.functions";

export const Route = createFileRoute("/api/profile/follow")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);

          if (!apiUser?.id) {
            return Response.json(
              { error: "É necessário estar autenticado para seguir usuários." },
              { status: 401 },
            );
          }

          let body: any;
          try {
            body = await request.json();
          } catch {
            return Response.json(
              { error: "Formato de dados inválido (esperado JSON)." },
              { status: 400 },
            );
          }

          const targetUserId =
            typeof body?.targetUserId === "string" ? body.targetUserId.trim() : "";
          const action =
            typeof body?.action === "string" ? body.action.trim().toLowerCase() : "";

          if (!targetUserId) {
            return Response.json(
              { error: "O campo 'targetUserId' é obrigatório." },
              { status: 400 },
            );
          }

          const viewerId = apiUser.id;

          if (viewerId === targetUserId) {
            return Response.json(
              { error: "Você não pode seguir a si próprio." },
              { status: 400 },
            );
          }

          // Verificar perfil alvo
          const targetRows = await sql<{
            id: string;
            accountType: string | null;
            allowFollowers: boolean | null;
          }>`
            select
              u."id",
              p."accountType",
              p."allowFollowers"
            from "user" u
            left join "profile" p on p."userId" = u."id"
            where u."id" = ${targetUserId}
            limit 1
          `;

          const targetUser = targetRows[0];
          if (!targetUser) {
            return Response.json(
              { error: "Usuário alvo não encontrado." },
              { status: 404 },
            );
          }

          // Verificar bloqueio
          const blockRows = await sql<{ count: string }>`
            select count(*)::text as count
            from "user_block"
            where ("blockerId" = ${viewerId} and "blockedId" = ${targetUserId})
               or ("blockerId" = ${targetUserId} and "blockedId" = ${viewerId})
            limit 1
          `;
          if (Number(blockRows[0]?.count ?? "0") > 0) {
            return Response.json(
              { error: "Não é possível interagir com este perfil devido a um bloqueio." },
              { status: 403 },
            );
          }

          // Ação explícita de cancelar solicitação
          if (action === "cancel_request") {
            await sql`
              delete from "user_follow_request"
              where "requesterId" = ${viewerId}
                and "targetId" = ${targetUserId}
                and "status" = 'pending'
            `;

            const followerCountRows = await sql<{ count: string }>`
              select count(*)::text as count
              from "user_follow"
              where "followingId" = ${targetUserId}
            `;

            return Response.json({
              status: "none",
              following: false,
              hasPendingRequest: false,
              followersCount: Number(followerCountRows[0]?.count ?? "0"),
            });
          }

          // Verificar se já segue
          const followRows = await sql<{ count: string }>`
            select count(*)::text as count
            from "user_follow"
            where "followerId" = ${viewerId}
              and "followingId" = ${targetUserId}
            limit 1
          `;
          const isFollowing = Number(followRows[0]?.count ?? "0") > 0;

          // Se já segue (ou se solicitou unfollow):
          if (isFollowing || action === "unfollow") {
            await sql`
              delete from "user_follow"
              where "followerId" = ${viewerId}
                and "followingId" = ${targetUserId}
            `;
            await sql`
              delete from "user_follow_request"
              where "requesterId" = ${viewerId}
                and "targetId" = ${targetUserId}
            `;
            await sql`
              delete from "notification"
              where "userId" = ${targetUserId}
                and "actorId" = ${viewerId}
                and "type" = 'new_follower'
            `;

            const followerCountRows = await sql<{ count: string }>`
              select count(*)::text as count
              from "user_follow"
              where "followingId" = ${targetUserId}
            `;

            return Response.json({
              status: "none",
              following: false,
              hasPendingRequest: false,
              followersCount: Number(followerCountRows[0]?.count ?? "0"),
            });
          }

          // Se não segue:
          const allowFollowers = targetUser.allowFollowers ?? true;
          if (!allowFollowers) {
            return Response.json(
              { error: "Este usuário não está aceitando novos seguidores." },
              { status: 403 },
            );
          }

          const isPrivate = targetUser.accountType === "private";

          if (isPrivate) {
            // Perfil privado: criar ou atualizar solicitação
            await sql`
              insert into "user_follow_request" ("requesterId", "targetId", "status", "createdAt", "updatedAt")
              values (${viewerId}, ${targetUserId}, 'pending', current_timestamp, current_timestamp)
              on conflict ("requesterId", "targetId")
              do update set
                "status" = 'pending',
                "updatedAt" = current_timestamp
            `;

            const followerCountRows = await sql<{ count: string }>`
              select count(*)::text as count
              from "user_follow"
              where "followingId" = ${targetUserId}
            `;

            return Response.json({
              status: "requested",
              following: false,
              hasPendingRequest: true,
              followersCount: Number(followerCountRows[0]?.count ?? "0"),
            });
          } else {
            // Perfil público: vínculo imediato
            await sql`
              insert into "user_follow" ("followerId", "followingId", "createdAt")
              values (${viewerId}, ${targetUserId}, current_timestamp)
              on conflict ("followerId", "followingId") do nothing
            `;
            await sql`
              delete from "user_follow_request"
              where "requesterId" = ${viewerId}
                and "targetId" = ${targetUserId}
            `;

            try {
              const actorRow = await sql<{ name: string | null }>`
                select coalesce(p."displayName", p."nick", u."name", 'Usuário') as name
                from "user" u
                left join "profile" p on p."userId" = u."id"
                where u."id" = ${viewerId} limit 1
              `;
              const actorName = actorRow[0]?.name || "Usuário";
              await executeCreateNotification(sql, {
                userId: targetUserId,
                actorId: viewerId,
                type: "new_follower",
                message: `${actorName} começou a seguir você.`,
              });
            } catch {
              // Falha não-impeditiva
            }

            const followerCountRows = await sql<{ count: string }>`
              select count(*)::text as count
              from "user_follow"
              where "followingId" = ${targetUserId}
            `;

            return Response.json({
              status: "following",
              following: true,
              hasPendingRequest: false,
              followersCount: Number(followerCountRows[0]?.count ?? "0"),
            });
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Erro interno ao processar seguimento.";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
