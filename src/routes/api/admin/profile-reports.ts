import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import {
  assertSameSiteRequest,
  CrossSiteRequestError,
} from "@/lib/auth/isolation.server";
import {
  assertAdminResponse,
  verifyAdminRequest,
  AdminAuthError,
} from "@/lib/auth/admin.server";

const PROFILE_REPORT_REASON_LABELS: Record<string, string> = {
  harassment: "Assédio ou perseguição",
  hate: "Ofensas ou discurso abusivo",
  spam: "Spam ou publicidade indevida",
  impersonation: "Perfil falso ou tentativa de se passar por outra pessoa",
  inappropriate: "Conteúdo impróprio",
  other: "Outro",
};

export const Route = createFileRoute("/api/admin/profile-reports")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const authError = await assertAdminResponse(request);
          if (authError) return authError;

          const sql = await getSql();
          const url = new URL(request.url);
          const statusFilter = url.searchParams.get("status") || "pending";
          const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
          const limit = 15;
          const offset = (page - 1) * limit;

          let whereClause = "";
          const queryParams: any[] = [];

          if (statusFilter !== "all") {
            whereClause = `where pr."status" = $1`;
            queryParams.push(statusFilter);
          }

          const countRes = await sql.query(
            `select count(*)::int as count from "profile_report" pr ${whereClause}`,
            queryParams,
          );
          const countRows = Array.isArray(countRes) ? countRes : (countRes as any)?.rows ?? [];
          const total = countRows[0]?.count ?? 0;
          const totalPages = Math.max(1, Math.ceil(total / limit));

          const listQuery = `
            select
              pr."id",
              pr."reporterUserId",
              pr."reportedUserId",
              pr."reason",
              pr."description",
              pr."status",
              pr."adminNotes",
              pr."resolvedBy",
              pr."createdAt",
              pr."updatedAt",

              ru."name" as "reportedName",
              ru."nick" as "reportedNick",
              ru."email" as "reportedEmail",
              ru."image" as "reportedImage",

              rep."name" as "reporterName",
              rep."nick" as "reporterNick",
              rep."email" as "reporterEmail"

            from "profile_report" pr
            inner join "user" ru on ru."id" = pr."reportedUserId"
            left join "user" rep on rep."id" = pr."reporterUserId"
            ${whereClause}
            order.by pr."createdAt" desc
            limit ${limit} offset ${offset}
          `;

          // Note: order.by typo check -> order by
          const cleanQuery = listQuery.replace("order.by", "order by");
          const result = await sql.query(cleanQuery, queryParams);
          const rows = Array.isArray(result) ? result : (result as any)?.rows ?? [];

          const reports = rows.map((row: any) => ({
            id: row.id,
            reporterUserId: row.reporterUserId,
            reportedUserId: row.reportedUserId,
            reason: row.reason,
            reasonLabel: PROFILE_REPORT_REASON_LABELS[row.reason] || row.reason,
            description: row.description,
            status: row.status,
            adminNotes: row.adminNotes,
            resolvedBy: row.resolvedBy,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            reportedUser: {
              id: row.reportedUserId,
              name: row.reportedName || "Usuário",
              nick: row.reportedNick || "membro",
              email: row.reportedEmail,
              image: row.reportedImage,
            },
            reporterUser: {
              id: row.reporterUserId,
              name: row.reporterName || "Denunciante",
              nick: row.reporterNick,
              email: row.reporterEmail,
            },
          }));

          return Response.json({
            reports,
            pagination: {
              total,
              totalPages,
              page,
              limit,
            },
          });
        } catch (error) {
          if (error instanceof CrossSiteRequestError) {
            return Response.json({ error: error.message }, { status: error.status });
          }
          console.error("[api/admin/profile-reports] Erro ao listar denúncias de perfil:", error);
          return Response.json(
            { error: "Não foi possível carregar as denúncias de perfil." },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          assertSameSiteRequest();
          let adminSession: { id: string; email: string };
          try {
            adminSession = await verifyAdminRequest(request);
          } catch (err) {
            if (err instanceof AdminAuthError) {
              return Response.json({ error: err.message }, { status: err.status });
            }
            return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
          }

          let body: any;
          try {
            body = await request.json();
          } catch {
            return Response.json({ error: "JSON inválido." }, { status: 400 });
          }

          const reportId = typeof body?.reportId === "string" ? body.reportId.trim() : "";
          const status = typeof body?.status === "string" ? body.status.trim().toLowerCase() : "";
          const adminNotes = typeof body?.adminNotes === "string" ? body.adminNotes.trim() : null;

          if (!reportId) {
            return Response.json({ error: "reportId é obrigatório." }, { status: 400 });
          }

          if (!["pending", "reviewing", "resolved", "rejected"].includes(status)) {
            return Response.json({ error: "Status inválido." }, { status: 400 });
          }

          const sql = await getSql();

          const checkRes = await sql.query(
            `select "id" from "profile_report" where "id" = $1 limit 1`,
            [reportId],
          );
          const checkRows = Array.isArray(checkRes) ? checkRes : (checkRes as any)?.rows ?? [];
          if (checkRows.length === 0) {
            return Response.json({ error: "Denúncia não encontrada." }, { status: 404 });
          }

          await sql.query(
            `
              update "profile_report"
              set
                "status" = $1,
                "adminNotes" = coalesce($2, "adminNotes"),
                "resolvedBy" = $3,
                "updatedAt" = CURRENT_TIMESTAMP
              where "id" = $4
            `,
            [status, adminNotes, adminSession.id, reportId],
          );

          return Response.json({
            success: true,
            status,
          });
        } catch (error) {
          if (error instanceof CrossSiteRequestError) {
            return Response.json({ error: error.message }, { status: error.status });
          }
          console.error("[api/admin/profile-reports] Erro ao atualizar denúncia:", error);
          return Response.json(
            { error: "Não foi possível atualizar a denúncia." },
            { status: 500 },
          );
        }
      },
    },
  },
});
