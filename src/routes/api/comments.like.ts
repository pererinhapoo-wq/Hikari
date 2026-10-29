import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { resolveApiUser } from "@/lib/auth/api-session";

export const Route = createFileRoute("/api/comments/like")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);

          if (!apiUser?.id) {
            return Response.json(
              { error: "É necessário estar autenticado para reagir a um comentário." },
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

          const commentId =
            typeof body?.commentId === "string" ? body.commentId.trim() : "";
          const reaction =
            typeof body?.reaction === "string" ? body.reaction.trim().toLowerCase() : "";

          if (!commentId) {
            return Response.json(
              { error: "O campo 'commentId' é obrigatório." },
              { status: 400 },
            );
          }

          if (reaction !== "like" && reaction !== "dislike") {
            return Response.json(
              { error: "A reação deve ser 'like' ou 'dislike'." },
              { status: 400 },
            );
          }

          // Verifica se o comentário existe
          const commentCheck = await sql.query(
            `
              select "id"
              from "comment"
              where "id" = $1
              limit 1
            `,
            [commentId],
          );

          const commentRows: any[] = Array.isArray(commentCheck)
            ? commentCheck
            : (commentCheck as any)?.rows ?? [];

          if (commentRows.length === 0) {
            return Response.json(
              { error: "Comentário não encontrado." },
              { status: 404 },
            );
          }

          // Busca reação existente do usuário
          const existingReactionCheck = await sql.query(
            `
              select "id", "type"
              from "comment_like"
              where "commentId" = $1 and "userId" = $2
              limit 1
            `,
            [commentId, apiUser.id],
          );

          const existingRows: any[] = Array.isArray(existingReactionCheck)
            ? existingReactionCheck
            : (existingReactionCheck as any)?.rows ?? [];

          const existing = existingRows[0];

          if (existing) {
            const currentType = existing.type || "like";
            if (currentType === reaction) {
              // Mesma reação clicada novamente -> remove (toggle off)
              await sql.query(
                `
                  delete from "comment_like"
                  where "id" = $1
                `,
                [existing.id],
              );
            } else {
              // Reação oposta -> atualiza para a nova
              await sql.query(
                `
                  update "comment_like"
                  set "type" = $1
                  where "id" = $2
                `,
                [reaction, existing.id],
              );
            }
          } else {
            // Nenhuma reação prévia -> insere nova
            const reactionId = `cl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            await sql.query(
              `
                insert into "comment_like" ("id", "commentId", "userId", "type", "createdAt")
                values ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                on conflict ("commentId", "userId")
                do update set "type" = $4
              `,
              [reactionId, commentId, apiUser.id, reaction],
            );
          }

          // Recalcula contagens exatas consolidadas no banco
          const countsResult = await sql.query(
            `
              select
                (
                  select count(*)::int
                  from "comment_like"
                  where "commentId" = $1 and ("type" = 'like' or "type" is null)
                ) as "likes",
                (
                  select count(*)::int
                  from "comment_like"
                  where "commentId" = $1 and "type" = 'dislike'
                ) as "dislikes",
                (
                  select "type"
                  from "comment_like"
                  where "commentId" = $1 and "userId" = $2
                  limit 1
                ) as "userReaction"
            `,
            [commentId, apiUser.id],
          );

          const countsRows: any[] = Array.isArray(countsResult)
            ? countsResult
            : (countsResult as any)?.rows ?? [];

          const counts = countsRows[0] ?? {
            likes: 0,
            dislikes: 0,
            userReaction: null,
          };

          const userReaction =
            counts.userReaction === "like" || counts.userReaction === "dislike"
              ? counts.userReaction
              : null;

          return Response.json({
            likes: Number(counts.likes) || 0,
            dislikes: Number(counts.dislikes) || 0,
            liked: userReaction === "like",
            disliked: userReaction === "dislike",
            userReaction,
          });
        } catch (error) {
          console.error("[api/comments/like] Erro ao registrar reação:", error);
          return Response.json(
            { error: "Não foi possível registrar a reação." },
            { status: 500 },
          );
        }
      },
    },
  },
});
