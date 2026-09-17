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

          const session = await auth.api.getSession({
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

          const userId = session.user.id;

          console.log(
            "USUÁRIO DA CURTIDA:",
            userId,
          );

          // =====================================================
          // 2. LER JSON
          // =====================================================

          let body: Record<string, unknown>;

          try {
            body = await request.json();
          } catch {
            return Response.json(
              {
                error: "JSON inválido.",
              },
              { status: 400 },
            );
          }

          const commentId =
            typeof body.commentId === "string"
              ? body.commentId.trim()
              : "";

          if (!commentId) {
            return Response.json(
              {
                error: "commentId é obrigatório.",
              },
              { status: 400 },
            );
          }

          console.log(
            "ID DO COMENTÁRIO PARA CURTIDA:",
            commentId,
          );

          const sql = await getSql();

          // =====================================================
          // 3. VERIFICAR SE O COMENTÁRIO EXISTE
          // =====================================================

          const commentResult = await sql.query(
            `
              select
                "id"
              from "comment"
              where "id" = $1
              limit 1
            `,
            [commentId],
          );

          /*
           * IMPORTANTE:
           *
           * O adaptador de banco usado pelo Hikari pode retornar
           * o resultado de SELECT diretamente como um array.
           *
           * Em alguns ambientes ele pode retornar:
           *
           *   { rows: [...] }
           *
           * Por isso aceitamos os dois formatos.
           */

          const commentRows = Array.isArray(
            commentResult,
          )
            ? commentResult
            : commentResult?.rows ?? [];

          console.log(
            "QUANTIDADE DE COMENTÁRIOS ENCONTRADOS:",
            commentRows.length,
          );

          if (commentRows.length === 0) {
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
              [commentId, userId],
            );

          const existingLikeRows =
            Array.isArray(
              existingLikeResult,
            )
              ? existingLikeResult
              : existingLikeResult?.rows ?? [];

          // =====================================================
          // 5. SE JÁ CURTIU → REMOVER CURTIDA
          // =====================================================

          if (existingLikeRows.length > 0) {
            await sql.query(
              `
                delete from "comment_like"
                where "commentId" = $1
                  and "userId" = $2
              `,
              [commentId, userId],
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
              Array.isArray(countResult)
                ? countResult
                : countResult?.rows ?? [];

            const likes =
              Number(
                countRows[0]?.count ?? 0,
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
          // 7. CONTAR CURTIDAS
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
            Array.isArray(countResult)
              ? countResult
              : countResult?.rows ?? [];

          const likes =
            Number(
              countRows[0]?.count ?? 0,
            );

          console.log(
            "CURTIDA ADICIONADA:",
            commentId,
            likes,
          );

          // =====================================================
          // 8. RESPONDER
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
