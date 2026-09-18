import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute("/api/comments/like")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // =====================================================
          // 1. VERIFICAR USUÁRIO LOGADO
          // =====================================================

          const session =
            await auth.api.getSession({
              headers: request.headers,
            });

          if (!session?.user?.id) {
            return Response.json(
              {
                error:
                  "Você precisa estar logado para curtir.",
              },
              { status: 401 },
            );
          }

          const userId =
            session.user.id;

          console.log(
            "USUÁRIO DA CURTIDA:",
            userId,
          );

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

          console.log(
            "ID DO COMENTÁRIO PARA CURTIDA:",
            commentId,
          );

          const sql =
            await getSql();

          // =====================================================
          // 3. VERIFICAR SE O COMENTÁRIO EXISTE
          //    E PEGAR:
          //    - dono do comentário
          //    - anime
          //    - episódio
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

          const commentRows =
            Array.isArray(
              commentResult,
            )
              ? commentResult
              : commentResult?.rows ??
                [];

          console.log(
            "QUANTIDADE DE COMENTÁRIOS ENCONTRADOS:",
            commentRows.length,
          );

          if (
            commentRows.length ===
            0
          ) {
            console.error(
              "COMENTÁRIO NÃO ENCONTRADO PARA CURTIDA:",
              commentId,
            );

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
          // 4. VERIFICAR SE O USUÁRIO JÁ CURTIU
          // =====================================================

          const existingLikeResult =
            await sql.query(
              `
                select
                  "id"
                from "comment_like"
                where "commentId" = $1
                  and "userId" = $2
                limit 1
              `,
              [
                commentId,
                userId,
              ],
            );

          const existingLikeRows =
            Array.isArray(
              existingLikeResult,
            )
              ? existingLikeResult
              : existingLikeResult?.rows ??
                [];

          // =====================================================
          // 5. SE JÁ CURTIU → REMOVER CURTIDA
          // =====================================================

          if (
            existingLikeRows.length >
            0
          ) {
            await sql.query(
              `
                delete from "comment_like"
                where "commentId" = $1
                  and "userId" = $2
              `,
              [
                commentId,
                userId,
              ],
            );

            // ===================================================
            // CONTAR CURTIDAS APÓS REMOVER
            // ===================================================

            const countResult =
              await sql.query(
                `
                  select
                    count(*)::int as "count"
                  from "comment_like"
                  where "commentId" = $1
                `,
                [commentId],
              );

            const countRows =
              Array.isArray(
                countResult,
              )
                ? countResult
                : countResult?.rows ??
                  [];

            const likes =
              Number(
                countRows[0]
                  ?.count ?? 0,
              );

            console.log(
              "CURTIDA REMOVIDA:",
              commentId,
              likes,
            );

            return Response.json({
              liked: false,
              likes,
            });
          }

          // =====================================================
          // 6. ADICIONAR CURTIDA
          // =====================================================

          const likeId =
            crypto.randomUUID();

          await sql.query(
            `
              insert into "comment_like" (
                "id",
                "commentId",
                "userId"
              )
              values ($1, $2, $3)
            `,
            [
              likeId,
              commentId,
              userId,
            ],
          );

          // =====================================================
          // 7. CRIAR NOTIFICAÇÃO
          // =====================================================
          //
          // Agora a notificação guarda:
          //
          // commentId
          // animeId
          // episodeId
          //
          // Isso permitirá que o Hikari saiba exatamente
          // onde a curtida aconteceu.
          //
          // A notificação não pode impedir a curtida.
          //
          // Também não notificamos quando o usuário curte
          // o próprio comentário.
          // =====================================================

          if (
            commentOwnerId &&
            commentOwnerId !== userId
          ) {
            try {
              const notificationId =
                crypto.randomUUID();

              const actorName =
                session.user.name ??
                "Alguém";

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

              console.log(
                "NOTIFICAÇÃO DE CURTIDA CRIADA:",
                {
                  notificationId,
                  commentId,
                  animeId,
                  episodeId,
                },
              );
            } catch (
              notificationError
            ) {
              console.error(
                "ERRO AO CRIAR NOTIFICAÇÃO DE CURTIDA:",
                notificationError,
              );

              // IMPORTANTE:
              // A curtida já foi salva.
              // Portanto, mesmo que a notificação
              // dê erro, a curtida continua válida.
            }
          }

          // =====================================================
          // 8. CONTAR CURTIDAS
          // =====================================================

          const countResult =
            await sql.query(
              `
                select
                  count(*)::int as "count"
                from "comment_like"
                where "commentId" = $1
              `,
              [commentId],
            );

          const countRows =
            Array.isArray(
              countResult,
            )
              ? countResult
              : countResult?.rows ??
                [];

          const likes =
            Number(
              countRows[0]
                ?.count ?? 0,
            );

          console.log(
            "CURTIDA ADICIONADA:",
            commentId,
            likes,
          );

          // =====================================================
          // 9. RESPONDER
          // =====================================================

          return Response.json({
            liked: true,
            likes,
          });
        } catch (error) {
          console.error(
            "ERRO REAL AO CURTIR COMENTÁRIO:",
            error,
          );

          const message =
            error instanceof Error
              ? error.message
              : String(error);

          return Response.json(
            {
              error:
                "Não foi possível alterar a curtida.",
              details: message,
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
