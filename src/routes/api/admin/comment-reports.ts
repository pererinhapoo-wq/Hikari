import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";
import { isHikariAdmin } from "@/lib/auth/admin";

type ReportAction =
  | "resolve"
  | "delete";

const REPORT_REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  hate: "Ódio ou discurso de ódio",
  spoiler: "Spoiler não marcado",
  sexual: "Conteúdo sexual",
  harassment: "Assédio",
  other: "Outro",
};

export const Route = createFileRoute(
  "/api/admin/comment-reports",
)({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const session =
            await auth.api.getSession({
              headers: request.headers,
            });

          const email =
            session?.user?.email ?? null;

          if (!session?.user?.id || !isHikariAdmin(email)) {
            return Response.json(
              {
                error:
                  "Acesso permitido somente ao administrador.",
              },
              { status: 403 },
            );
          }

          const sql = await getSql();

          const result = await sql.query(
            `
              select
                c."id" as "commentId",
                c."animeId",
                c."episodeId",
                c."content",
                c."parentId",
                c."isSpoiler",
                c."createdAt",
                c."updatedAt",

                u."id" as "userId",
                coalesce(
                  u."name",
                  'Usuário'
                ) as "userName",
                u."email" as "userEmail",
                u."image" as "userImage",

                count(cr."id")::int as "reportCount",

                min(cr."createdAt") as "firstReportedAt",

                array_agg(
                  distinct cr."reason"
                ) as "reasons"

              from "comment_report" cr

              inner join "comment" c
                on c."id" = cr."commentId"

              left join "user" u
                on u."id" = c."userId"

              where cr."status" = 'pending'

              group by
                c."id",
                c."animeId",
                c."episodeId",
                c."content",
                c."parentId",
                c."isSpoiler",
                c."createdAt",
                c."updatedAt",
                u."id",
                u."name",
                u."email",
                u."image"

              order by
                min(cr."createdAt") desc
            `,
          );

          const rows = Array.isArray(result)
            ? result
            : result?.rows ?? [];

          const reports = rows.map(
            (row) => ({
              commentId: row.commentId,
              animeId: row.animeId,
              episodeId: row.episodeId,
              content: row.content,
              parentId: row.parentId,
              isSpoiler: Boolean(
                row.isSpoiler,
              ),
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,

              userId: row.userId,
              userName:
                row.userName ||
                "Usuário",
              userEmail:
                row.userEmail ?? null,
              userImage:
                row.userImage ?? null,

              reportCount:
                Number(
                  row.reportCount ?? 0,
                ) || 0,

              firstReportedAt:
                row.firstReportedAt,

              reasons: Array.isArray(
                row.reasons,
              )
                ? row.reasons.map(
                    (reason: unknown) => ({
                      value: String(
                        reason,
                      ),
                      label:
                        REPORT_REASON_LABELS[
                          String(
                            reason,
                          )
                        ] ??
                        String(
                          reason,
                        ),
                    }),
                  )
                : [],
            }),
          );

          return Response.json({
            reports,
          });
        } catch (error) {
          console.error(
            "ERRO REAL AO LISTAR DENÚNCIAS:",
            error,
          );

          return Response.json(
            {
              error:
                "Não foi possível carregar as denúncias.",
            },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const session =
            await auth.api.getSession({
              headers: request.headers,
            });

          const email =
            session?.user?.email ?? null;

          if (!session?.user?.id || !isHikariAdmin(email)) {
            return Response.json(
              {
                error:
                  "Acesso permitido somente ao administrador.",
              },
              { status: 403 },
            );
          }

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

          const action =
            typeof body.action ===
            "string"
              ? body.action.trim()
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

          if (
            action !== "resolve" &&
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

          const sql =
            await getSql();

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

          if (
            action === "resolve"
          ) {
            await sql.query(
              `
                update "comment_report"
                set
                  "status" = 'resolved',
                  "resolvedAt" = CURRENT_TIMESTAMP,
                  "resolvedBy" = $2
                where "commentId" = $1
                  and "status" = 'pending'
              `,
              [
                commentId,
                session.user.id,
              ],
            );

            return Response.json({
              success: true,
              action: "resolve",
            });
          }

          if (
            action === "delete"
          ) {
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
            "ERRO REAL NA MODERAÇÃO ADMINISTRATIVA:",
            error,
          );

          const message =
            error instanceof Error
              ? error.message
              : String(error);

          return Response.json(
            {
              error:
                "Não foi possível realizar a ação.",
              details: message,
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
