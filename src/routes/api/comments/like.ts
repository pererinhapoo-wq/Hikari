import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute("/api/comments/like")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // =====================================================
          // 1. Verificar usuário logado
          // =====================================================
          const session = await auth.api.getSession({
            headers: request.headers,
          });

          if (!session?.user?.id) {
            return Response.json(
              {
                error: "Você precisa estar logado para curtir.",
              },
              { status: 401 },
            );
          }

          // =====================================================
          // 2. Ler comentário
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

          const sql = await getSql();

          // =====================================================
          // 3. Verificar se o comentário existe
          // =====================================================
          const comment = await sql.query(
            `
              select "id"
              from "comment"
              where "id" = $1
              limit 1
            `,
            [commentId],
          );

          if (!comment?.rows || comment.rows.length === 0) {
            return Response.json(
              {
                error: "Comentário não encontrado.",
              },
              { status: 404 },
            );
          }

          // =====================================================
          // 4. Verificar se o usuário já curtiu
          // =====================================================
          const existingLike = await sql.query(
            `
              select "id"
              from "comment_like"
              where "commentId" = $1
                and "userId" = $2
              limit 1
            `,
            [commentId, session.user.id],
          );

          let liked = false;

          // =====================================================
          // 5. Curtir ou remover curtida
          // =====================================================
          if (existingLike?.rows && existingLike.rows.length > 0) {
            await sql.query(
              `
                delete from "comment_like"
                where "commentId" = $1
                  and "userId" = $2
              `,
              [commentId, session.user.id],
            );

            liked = false;
          } else {
            const id = crypto.randomUUID();

            await sql.query(
              `
                insert into "comment_like" (
                  "id",
                  "commentId",
                  "userId"
                )
                values ($1, $2, $3)
              `,
              [id, commentId, session.user.id],
            );

            liked = true;
          }

          // =====================================================
          // 6. Contar curtidas
          // =====================================================
          const countResult = await sql.query(
            `
              select count(*)::int as "count"
              from "comment_like"
              where "commentId" = $1
            `,
            [commentId],
          );

          const likes =
            countResult?.rows?.[0]?.count ?? 0;

          // =====================================================
          // 7. Resposta
          // =====================================================
          return Response.json({
            liked,
            likes,
          });
        } catch (error) {
          console.error(
            "ERRO AO CURTIR COMENTÁRIO:",
            error,
          );

          const message =
            error instanceof Error
              ? error.message
              : String(error);

          return Response.json(
            {
              error: "Não foi possível alterar a curtida.",
              details: message,
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
