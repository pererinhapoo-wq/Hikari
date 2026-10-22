import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { resolveApiUser } from "@/lib/auth/api-session";

export const Route = createFileRoute(
  "/api/comments/like",
)({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const sql =
            await getSql();

          // =====================================================
          // 1. VERIFICAR USUÁRIO LOGADO
          // =====================================================

          const user =
            await resolveApiUser(request, sql);

          if (!user?.id) {
            return Response.json(
              {
                error:
                  "Você precisa estar logado para reagir ao comentário.",
              },
              { status: 401 },
            );
          }

          const userId =
            user.id;

          // =====================================================
          // 2. LER JSON
          // =====================================================

          let body: Record<
            string,
            unknown
          >;

          try {
            body =
              await request.json();
          } catch {
            return Response.json(
              {
                error:
                  "JSON inválido.",
              },
              { status: 400 },
            );
          }

          const commentId =
            typeof body.commentId ===
            "string"
              ? body.commentId.trim()
              : "";

          if (!commentId) {
            return Response.json(
              {
                error:
                  "commentId é obrigatório.",
              },
              { status: 400 },
            );
          }

          // Identificar tipo de reação: "like" ou "dislike"
          const rawReaction =
            typeof body.reaction === "string"
              ? body.reaction.trim().toLowerCase()
              : typeof body.type === "string"
                ? body.type.trim().toLowerCase()
                : "like";

          const targetReaction: "like" | "dislike" =
            rawReaction === "dislike" ? "dislike" : "like";

          // =====================================================
          // 3. PEGAR DADOS DO COMENTÁRIO
          // =====================================================

          const commentResult =
            await sql.query(
              `
                select
                  "id",
                  "userId",
                  "animeId",
                  "episodeId"
                from "comment"
                where "id" = $1
                limit 1
              `,
              [commentId],
            );

          const commentRows: any[] =
            Array.isArray(
              commentResult,
            )
              ? commentResult
              : (commentResult as any)?.rows ??
                [];

          if (
            commentRows.length ===
            0
          ) {
            return Response.json(
              {
                error:
                  "Comentário não encontrado.",
              },
              { status: 404 },
            );
          }

          const comment =
            commentRows[0];

          const commentOwnerId =
            comment?.userId ??
            null;

          const animeId =
            comment?.animeId ??
            null;

          const episodeId =
            comment?.episodeId ??
            null;

          // =====================================================
          // 4. VERIFICAR REAÇÃO ATUAL DO USUÁRIO
          // =====================================================

          const existingReactionResult =
            await sql.query(
              `
                select
                  "id",
                  coalesce("type", 'like') as "type"
                from "comment_like"
                where
                  "commentId" = $1
                  and
                  "userId" = $2
                limit 1
              `,
              [
                commentId,
                userId,
              ],
            );

          const existingRows: any[] =
            Array.isArray(
              existingReactionResult,
            )
              ? existingReactionResult
              : (existingReactionResult as any)?.rows ??
                [];

          let finalReaction: "like" | "dislike" | null = null;

          if (existingRows.length > 0) {
            const currentReaction = existingRows[0]?.type;

            if (currentReaction === targetReaction) {
              // Se o usuário clicou na mesma reação ativa → remove (retira a própria reação)
              await sql.query(
                `
                  delete from "comment_like"
                  where
                    "commentId" = $1
                    and
                    "userId" = $2
                `,
                [commentId, userId],
              );
              finalReaction = null;
            } else {
              // Se o usuário trocou de like para dislike (ou vice-versa) → atualiza a reação
              await sql.query(
                `
                  update "comment_like"
                  set
                    "type" = $1,
                    "createdAt" = CURRENT_TIMESTAMP
                  where
                    "commentId" = $2
                    and
                    "userId" = $3
                `,
                [targetReaction, commentId, userId],
              );
              finalReaction = targetReaction;
            }
          } else {
            // Nova reação adicionada
            const reactionId = crypto.randomUUID();

            await sql.query(
              `
                insert into "comment_like" (
                  "id",
                  "commentId",
                  "userId",
                  "type"
                )
                values (
                  $1,
                  $2,
                  $3,
                  $4
                )
              `,
              [
                reactionId,
                commentId,
                userId,
                targetReaction,
              ],
            );
            finalReaction = targetReaction;
          }

          // Notificação apenas quando a reação final for "like" e o dono não for o autor
          if (
            finalReaction === "like" &&
            commentOwnerId &&
            commentOwnerId !== userId
          ) {
            try {
              const notificationId = crypto.randomUUID();
              const actorName = user.name ?? "Alguém";

              await sql.query(
                `
                  insert into "notification" (
                    "id",
                    "userId",
                    "actorId",
                    "type",
                    "message",
                    "commentId",
                    "animeId",
                    "episodeId"
                  )
                  values (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8
                  )
                `,
                [
                  notificationId,
                  commentOwnerId,
                  userId,
                  "comment_like",
                  `${actorName} curtiu seu comentário.`,
                  commentId,
                  animeId,
                  episodeId,
                ],
              );
            } catch (notificationError) {
              console.error(
                "ERRO AO CRIAR NOTIFICAÇÃO DE CURTIDA:",
                notificationError,
              );
            }
          }

          // =====================================================
          // 5. CONTAR LIKES E DISLIKES ATUALIZADOS
          // =====================================================

          const countResult =
            await sql.query(
              `
                select
                  count(*) filter (where coalesce("type", 'like') = 'like')::int as "likes",
                  count(*) filter (where "type" = 'dislike')::int as "dislikes"
                from "comment_like"
                where
                  "commentId" = $1
              `,
              [commentId],
            );

          const countRows: any[] =
            Array.isArray(countResult)
              ? countResult
              : (countResult as any)?.rows ?? [];

          const likes =
            Number(countRows[0]?.likes ?? 0);

          const dislikes =
            Number(countRows[0]?.dislikes ?? 0);

          return Response.json({
            success: true,
            userReaction: finalReaction,
            liked: finalReaction === "like",
            disliked: finalReaction === "dislike",
            likes,
            dislikes,
          });
        } catch (error) {
          console.error(
            "ERRO AO PROCESSAR REAÇÃO NO COMENTÁRIO:",
            error,
          );

          const message =
            error instanceof Error
              ? error.message
              : String(error);

          return Response.json(
            {
              error:
                "Não foi possível processar a reação.",
              details: message,
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
