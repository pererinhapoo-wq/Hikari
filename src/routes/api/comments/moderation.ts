import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";

type ModerationAction =
  | "spoiler"
  | "report"
  | "spam";

const REPORT_REASONS = [
  "spam",
  "hate",
  "unmarked_spoiler",
  "sexual",
  "harassment",
  "other",
] as const;

export const Route = createFileRoute(
  "/api/comments/moderation",
)({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          /* ============================================ */
          /* AUTENTICAÇÃO                                 */
          /* ============================================ */

          const session =
            await auth.api.getSession({
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

          /* ============================================ */
          /* LER JSON                                     */
          /* ============================================ */

          let body: Record<
            string,
            unknown
          >;

          try {
            body = await request.json();
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

          const action =
            typeof body.action ===
            "string"
              ? body.action.trim()
              : "";

          const reason =
            typeof body.reason ===
            "string"
              ? body.reason.trim()
              : "";

          /* ============================================ */
          /* VALIDAÇÃO                                    */
          /* ============================================ */

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

          const sql =
            await getSql();

          /* ============================================ */
          /* VERIFICAR COMENTÁRIO                          */
          /* ============================================ */

          const commentResult =
            await sql.query(
              `
                select
                  "id"
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

          /* ============================================ */
          /* MARCAR COMO SPOILER                           */
          /* ============================================ */

          if (
            action === "spoiler"
          ) {
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

          /* ============================================ */
          /* MARCAR COMO SPAM                              */
          /* ============================================ */

          if (
            action === "spam"
          ) {
            const existingResult =
              await sql.query(
                `
                  select
                    "id"
                  from "comment_report"
                  where "commentId" = $1
                    and "userId" = $2
                  limit 1
                `,
                [
                  commentId,
                  session.user.id,
                ],
              );

            const existingRows =
              Array.isArray(
                existingResult,
              )
                ? existingResult
                : existingResult?.rows ??
                  [];

            if (
              existingRows.length ===
              0
            ) {
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
                `,
                [
                  crypto.randomUUID(),
                  commentId,
                  session.user.id,
                  "spam",
                ],
              );
            }

            return Response.json({
              success: true,
              action: "spam",
            });
          }

          /* ============================================ */
          /* DENÚNCIA                                    */
          /* ============================================ */

          if (
            action === "report"
          ) {
            if (
              !REPORT_REASONS.includes(
                reason as
                  (typeof REPORT_REASONS)[number],
              )
            ) {
              return Response.json(
                {
                  error:
                    "Motivo da denúncia inválido.",
                },
                { status: 400 },
              );
            }

            const existingResult =
              await sql.query(
                `
                  select
                    "id"
                  from "comment_report"
                  where "commentId" = $1
                    and "userId" = $2
                  limit 1
                `,
                [
                  commentId,
                  session.user.id,
                ],
              );

            const existingRows =
              Array.isArray(
                existingResult,
              )
                ? existingResult
                : existingResult?.rows ??
                  [];

            if (
              existingRows.length >
              0
            ) {
              return Response.json({
                success: true,
                action: "report",
                alreadyReported:
                  true,
              });
            }

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
              `,
              [
                crypto.randomUUID(),
                commentId,
                session.user.id,
                reason,
              ],
            );

            return Response.json({
              success: true,
              action: "report",
            });
          }

          return Response.json(
            {
              error:
                "Ação não processada.",
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
