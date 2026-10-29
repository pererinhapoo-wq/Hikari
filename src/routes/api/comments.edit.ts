import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { resolveApiUser } from "@/lib/auth/api-session";
import { isHikariAdmin } from "@/lib/auth/admin";

export const Route = createFileRoute("/api/comments/edit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);

          if (!apiUser?.id) {
            return Response.json(
              { error: "É necessário estar autenticado para modificar um comentário." },
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
          const action =
            typeof body?.action === "string" ? body.action.trim().toLowerCase() : "";

          if (!commentId) {
            return Response.json(
              { error: "O campo 'commentId' é obrigatório." },
              { status: 400 },
            );
          }

          if (action !== "edit" && action !== "delete") {
            return Response.json(
              { error: "Ação inválida (esperado 'edit' ou 'delete')." },
              { status: 400 },
            );
          }

          // Busca o comentário no banco
          const commentCheck = await sql.query(
            `
              select "id", "userId", "content", "isSpoiler", "parentId"
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

          const targetComment = commentRows[0];
          const isOwner = String(targetComment.userId) === apiUser.id;
          const isAdmin = Boolean(apiUser.email && isHikariAdmin(apiUser.email));

          if (!isOwner && !isAdmin) {
            return Response.json(
              { error: "Você não tem permissão para alterar este comentário." },
              { status: 403 },
            );
          }

          if (action === "edit") {
            const rawContent =
              typeof body?.content === "string" ? body.content.trim() : "";
            const isSpoiler = Boolean(body?.isSpoiler);

            if (!rawContent) {
              return Response.json(
                { error: "O conteúdo do comentário não pode estar vazio." },
                { status: 400 },
              );
            }

            if (rawContent.length > 5000) {
              return Response.json(
                { error: "O comentário excede o limite de 5.000 caracteres." },
                { status: 400 },
              );
            }

            const updateResult = await sql.query(
              `
                update "comment"
                set
                  "content" = $1,
                  "isSpoiler" = $2,
                  "updatedAt" = CURRENT_TIMESTAMP
                where "id" = $3
                returning "id", "content", "isSpoiler", "updatedAt"
              `,
              [rawContent, isSpoiler, commentId],
            );

            const updatedRows: any[] = Array.isArray(updateResult)
              ? updateResult
              : (updateResult as any)?.rows ?? [];

            const updated = updatedRows[0] ?? {
              id: commentId,
              content: rawContent,
              isSpoiler,
              updatedAt: new Date().toISOString(),
            };

            return Response.json({
              comment: {
                id: String(updated.id),
                content: String(updated.content),
                isSpoiler: Boolean(updated.isSpoiler),
                updatedAt:
                  updated.updatedAt instanceof Date
                    ? updated.updatedAt.toISOString()
                    : new Date(updated.updatedAt).toISOString(),
              },
            });
          }

          if (action === "delete") {
            // A chave estrangeira parentId possui onDelete cascade nas migrações reais,
            // garantindo a exclusão atômica e consistente tanto do comentário quanto de suas respostas.
            await sql.query(
              `
                delete from "comment"
                where "id" = $1
              `,
              [commentId],
            );

            return Response.json({
              success: true,
            });
          }

          return Response.json(
            { error: "Ação não processada." },
            { status: 400 },
          );
        } catch (error) {
          console.error("[api/comments/edit] Erro ao editar/excluir comentário:", error);
          return Response.json(
            { error: "Não foi possível realizar esta ação no comentário." },
            { status: 500 },
          );
        }
      },
    },
  },
});
