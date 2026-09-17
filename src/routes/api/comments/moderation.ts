import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";

const REPORT_REASONS = [
  "spam",
  "hate",
  "spoiler",
  "sexual",
  "harassment",
  "other",
] as const;

type ReportReason = (typeof REPORT_REASONS)[number];

export const Route = createFileRoute(
  "/api/comments/moderation",
)({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({
            headers: request.headers,
          });

          if (!session?.user?.id) {
            return Response.json(
              {
                error:
                  "Você precisa estar logado para realizar esta ação.",
              },
              { status: 401 },
            );
          }

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

          const action =
            typeof body.action === "string"
              ? body.action.trim()
              : "";

          const reason =
            typeof body.reason === "string"
              ? body.reason.trim()
              : "";

          if (!commentId || !action) {
            return Response.json(
              {
                error:
                  "commentId e action são obrigatórios.",
              },
              { status: 400 },
            );
          }

          if (
            action !== "spoiler" &&
            action !== "report" &&
            action !== "spam"
          ) {
            return Response.json(
              {
                error:
                  "Ação de moderação inválida.",
              },
              { status: 400 },
            );
          }

          const sql = await getSql();

          const commentResult = await sql.query(
            `
              select
                "id",
                "isSpoiler"
              from "comment"
              where "id" = $1
              limit 1
            `,
            [commentId],
          );

          const commentRows = Array.isArray(
            commentResult,
          )
            ? commentResult
            : commentResult?.rows ?? [];

          if (commentRows.length === 0) {
            return Response.json(
              {
                error:
                  "Comentário não encontrado.",
              },
              { status: 404 },
            );
          }

          /*
           * MARCAR COMO SPOILER
           *
           * Qualquer usuário logado pode sinalizar
           * um comentário que contém spoiler.
           */
          if (action === "spoiler") {
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

            console.log(
              "COMENTÁRIO MARCADO COMO SPOILER:",
              commentId,
              session.user.id,
            );

            return Response.json({
              success: true,
              action: "spoiler",
              isSpoiler: true,
            });
          }

          /*
           * MARCAR COMO SPAM
           *
           * Spam será enviado para a mesma tabela
           * de denúncias para futura análise da moderação.
           */
          if (action === "spam") {
            const reportId =
              crypto.randomUUID();

            await sql.query(
              `
                insert into "comment_report" (
                  "id",
                  "commentId",
                  "userId",
                  "reason"
                )
                values (
                  $1,
                  $2,
                  $3,
                  $4
                )
                on conflict (
                  "commentId",
                  "userId"
                )
                do update set
                  "reason" = excluded."reason"
              `,
              [
                reportId,
                commentId,
                session.user.id,
                "spam",
              ],
            );

            console.log(
              "COMENTÁRIO MARCADO COMO SPAM:",
              commentId,
              session.user.id,
            );

            return Response.json({
              success: true,
              action: "spam",
            });
          }

          /*
           * DENÚNCIA NORMAL
           */
          if (action === "report") {
            if (
              !REPORT_REASONS.includes(
                reason as ReportReason,
              )
            ) {
              return Response.json(
                {
                  error:
                    "Motivo de denúncia inválido.",
                },
                { status: 400 },
              );
            }

            const reportId =
              crypto.randomUUID();

            await sql.query(
              `
                insert into "comment_report" (
                  "id",
                  "commentId",
                  "userId",
                  "reason"
                )
                values (
                  $1,
                  $2,
                  $3,
                  $4
                )
                on conflict (
                  "commentId",
                  "userId"
                )
                do update set
                  "reason" = excluded."reason"
              `,
              [
                reportId,
                commentId,
                session.user.id,
                reason,
              ],
            );

            console.log(
              "DENÚNCIA DE COMENTÁRIO REGISTRADA:",
              {
                commentId,
                userId: session.user.id,
                reason,
              },
            );

            return Response.json({
              success: true,
              action: "report",
            });
          }

          return Response.json(
            {
              error:
                "Não foi possível realizar a ação.",
            },
            { status: 400 },
          );
        } catch (error) {
          console.error(
            "ERRO REAL NA MODERAÇÃO DO COMENTÁRIO:",
            error,
          );

          const message =
            error instanceof Error
              ? error.message
              : String(error);

          return Response.json(
            {
              error:
                "Não foi possível realizar esta ação.",
              details: message,
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
