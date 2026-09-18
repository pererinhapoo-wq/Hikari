import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";
import { isHikariAdmin } from "@/lib/auth/admin";

type CommentAction = "edit" | "delete";

export const Route = createFileRoute(
  "/api/comments/edit",
)({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session =
            await auth.api.getSession({
              headers: request.headers,
            });

          if (!session?.user?.id) {
            return Response.json(
              {
                error:
                  "Você precisa estar logado.",
              },
              { status: 401 },
            );
          }

          let body: Record<
            string,
            unknown
          >;

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
            typeof body.commentId ===
            "string"
              ? body.commentId.trim()
              : "";

          const action =
            typeof body.action ===
            "string"
              ? body.action.trim()
              : "";

          const content =
            typeof body.content ===
            "string"
              ? body.content.trim()
              : "";

          const isSpoiler =
            typeof body.isSpoiler ===
            "boolean"
              ? body.isSpoiler
              : false;

          if (!commentId) {
            return Response.json(
              {
                error:
                  "commentId é obrigatório.",
              },
              { status: 400 },
            );
          }

          if (
            action !== "edit" &&
            action !== "delete"
          ) {
            return Response.json(
              {
                error:
                  "Ação inválida.",
              },
              { status: 400 },
            );
          }

          if (
            action === "edit" &&
            !content
          ) {
            return Response.json(
              {
                error:
                  "O comentário não pode ficar vazio.",
              },
              { status: 400 },
            );
          }

          if (
            action === "edit" &&
            content.length > 2000
          ) {
            return Response.json(
              {
                error:
                  "O comentário pode ter no máximo 2000 caracteres.",
              },
              { status: 400 },
            );
          }

          const sql =
            await getSql();

          const commentResult =
            await sql.query(
              `
                select
                  "id",
                  "userId"
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

          const isOwner =
            comment.userId ===
            session.user.id;

          const isAdmin =
            isHikariAdmin(
              session.user.email,
            );

          if (!isOwner && !isAdmin) {
            return Response.json(
              {
                error:
                  "Você não tem permissão para alterar este comentário.",
              },
              { status: 403 },
            );
          }

          if (
            action === "edit"
          ) {
            await sql.query(
              `
                update "comment"
                set
                  "content" = $1,
                  "isSpoiler" = $2,
                  "updatedAt" = CURRENT_TIMESTAMP
                where "id" = $3
              `,
              [
                content,
                isSpoiler,
                commentId,
              ],
            );

            const updatedResult =
              await sql.query(
                `
                  select
                    c."id",
                    c."animeId",
                    c."episodeId",
                    c."content",
                    c."parentId",
                    c."isSpoiler",
                    c."createdAt",
                    c."updatedAt",
                    c."userId",
                    coalesce(
                      u."name",
                      'Usuário'
                    ) as "userName",
                    u."image" as "userImage",
                    (
                      select count(*)::int
                      from "comment_like" cl
                      where cl."commentId" = c."id"
                    ) as "likes"
                  from "comment" c
                  left join "user" u
                    on u."id" = c."userId"
                  where c."id" = $1
                  limit 1
                `,
                [commentId],
              );

            const updatedRows =
              Array.isArray(
                updatedResult,
              )
                ? updatedResult
                : updatedResult?.rows ??
                  [];

            return Response.json({
              success: true,
              action: "edit",
              comment:
                updatedRows[0] ??
                null,
            });
          }

          await sql.query(
            `
              delete from "comment"
              where "id" = $1
            `,
            [commentId],
          );

          return Response.json({
            success: true,
            action: "delete",
            commentId,
          });
        } catch (error) {
          console.error(
            "ERRO AO EDITAR/EXCLUIR COMENTÁRIO:",
            error,
          );

          const message =
            error instanceof Error
              ? error.message
              : String(error);

          return Response.json(
            {
              error:
                "Não foi possível alterar o comentário.",
              details: message,
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
