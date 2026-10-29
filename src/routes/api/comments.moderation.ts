import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { resolveApiUser } from "@/lib/auth/api-session";

const ALLOWED_REPORT_REASONS = new Set([
  "spam",
  "hate",
  "spoiler",
  "sexual",
  "harassment",
  "other",
]);

export const Route = createFileRoute("/api/comments/moderation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);

          if (!apiUser?.id) {
            return Response.json(
              { error: "É necessário estar autenticado para realizar esta ação." },
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

          if (action !== "spoiler" && action !== "spam" && action !== "report") {
            return Response.json(
              { error: "Ação de moderação inválida." },
              { status: 400 },
            );
          }

          // Verifica se o comentário existe
          const commentCheck = await sql.query(
            `
              select "id", "userId", "isSpoiler"
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

          if (action === "spoiler") {
            // Marca o comentário como spoiler
            await sql.query(
              `
                update "comment"
                set
                  "isSpoiler" = true,
                  "updatedAt" = CURRENT_TIMESTAMP
                where "id" = $1
              `,
              [commentId],
            );

            return Response.json({
              success: true,
              action: "spoiler",
            });
          }

          if (action === "spam" || action === "report") {
            if (action === "report" && String(commentRows[0].userId) === apiUser.id) {
              return Response.json(
                { error: "Não é permitido denunciar o próprio comentário." },
                { status: 400 },
              );
            }

            const rawReason =
              typeof body?.reason === "string" ? body.reason.trim().toLowerCase() : "";

            const reason =
              action === "spam"
                ? "spam"
                : ALLOWED_REPORT_REASONS.has(rawReason)
                  ? rawReason
                  : "other";

            const reportId = `cr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

            // Insere ou atualiza o registro na tabela "comment_report"
            await sql.query(
              `
                insert into "comment_report" (
                  "id",
                  "commentId",
                  "userId",
                  "reason",
                  "status",
                  "createdAt"
                )
                values ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP)
                on conflict ("commentId", "userId")
                do update set
                  "reason" = $4,
                  "status" = 'pending'
              `,
              [reportId, commentId, apiUser.id, reason],
            );

            return Response.json({
              success: true,
              action,
            });
          }

          return Response.json(
            { error: "Ação não processada." },
            { status: 400 },
          );
        } catch (error) {
          console.error("[api/comments/moderation] Erro ao moderar comentário:", error);
          return Response.json(
            { error: "Não foi possível realizar esta ação." },
            { status: 500 },
          );
        }
      },
    },
  },
});
