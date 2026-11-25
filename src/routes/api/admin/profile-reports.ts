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

const ALLOWED_STATUS_FILTERS = new Set([
  "all",
  "pending",
  "reviewing",
  "resolved",
  "rejected",
]);

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
          const rawStatus = (url.searchParams.get("status") || "pending")
            .trim()
            .toLowerCase();
          const statusFilter = ALLOWED_STATUS_FILTERS.has(rawStatus)
            ? rawStatus
            : "pending";
          const page = Math.max(
            1,
            parseInt(url.searchParams.get("page") || "1", 10) || 1,
          );
          const limit = 15;
          const offset = (page - 1) * limit;

          let whereClause = "";
          const filterParams: unknown[] = [];

          if (statusFilter !== "all") {
            whereClause = `where pr."status" = $1`;
            filterParams.push(statusFilter);
          }

          const [countRes, pendingRes] = await Promise.all([
            sql.query<{ count: number | string }>(
              `select count(*)::int as count from "profile_report" pr ${whereClause}`,
              filterParams,
            ),
            sql.query<{ count: number | string }>(
              `select count(*)::int as count from "profile_report" where "status" = 'pending'`,
            ),
          ]);

          const countRows = Array.isArray(countRes)
            ? countRes
            : (countRes as any)?.rows ?? [];
          const pendingRows = Array.isArray(pendingRes)
            ? pendingRes
            : (pendingRes as any)?.rows ?? [];

          const total = Number(countRows[0]?.count ?? 0);
          const pendingCount = Number(pendingRows[0]?.count ?? 0);
          const totalPages = Math.max(1, Math.ceil(total / limit));

          const listParams = [...filterParams, limit, offset];
          const limitIdx = filterParams.length + 1;
          const offsetIdx = filterParams.length + 2;

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

              coalesce(
                nullif(trim(rp."displayName"), ''),
                nullif(trim(ru."name"), ''),
                nullif(trim(rp."nick"), ''),
                'Usuário'
              ) as "reportedName",
              coalesce(
                nullif(trim(rp."nick"), ''),
                ru."id",
                pr."reportedUserId"
              ) as "reportedNick",
              ru."email" as "reportedEmail",
              coalesce(
                nullif(trim(rp."avatarUrl"), ''),
                nullif(trim(ru."image"), '')
              ) as "reportedImage",

              coalesce(
                nullif(trim(repp."displayName"), ''),
                nullif(trim(rep."name"), ''),
                nullif(trim(repp."nick"), ''),
                'Denunciante'
              ) as "reporterName",
              nullif(trim(repp."nick"), '') as "reporterNick",
              rep."email" as "reporterEmail"

            from "profile_report" pr
            left join "user" ru on ru."id" = pr."reportedUserId"
            left join "profile" rp on rp."userId" = pr."reportedUserId"
            left join "user" rep on rep."id" = pr."reporterUserId"
            left join "profile" repp on repp."userId" = pr."reporterUserId"
            ${whereClause}
            order by pr."createdAt" desc, pr."id" desc
            limit $${limitIdx} offset $${offsetIdx}
          `;

          const result = await sql.query(listQuery, listParams);
          const rows = Array.isArray(result)
            ? result
            : (result as any)?.rows ?? [];

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
              nick: row.reportedNick || row.reportedUserId,
              email: row.reportedEmail ?? null,
              image: row.reportedImage ?? null,
            },
            reporterUser: {
              id: row.reporterUserId,
              name: row.reporterName || "Denunciante",
              nick: row.reporterNick ?? null,
              email: row.reporterEmail ?? null,
            },
          }));

          return Response.json(
            {
              reports,
              pendingCount,
              pagination: {
                total,
                totalPages,
                page,
                limit,
              },
            },
            {
              headers: {
                "Cache-Control": "private, no-cache, no-store, must-revalidate",
              },
            },
          );
        } catch (error) {
          if (error instanceof CrossSiteRequestError) {
            return Response.json({ error: error.message }, { status: error.status });
          }
          console.error(
            "[api/admin/profile-reports] Erro ao listar denúncias de perfil:",
            error,
          );
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

          const reportId =
            typeof body?.reportId === "string" ? body.reportId.trim() : "";
          const status =
            typeof body?.status === "string" ? body.status.trim().toLowerCase() : "";
          const adminNotes =
            typeof body?.adminNotes === "string" ? body.adminNotes.trim() : null;

          if (!reportId) {
            return Response.json(
              { error: "reportId é obrigatório." },
              { status: 400 },
            );
          }

          if (!["pending", "reviewing", "resolved", "rejected"].includes(status)) {
            return Response.json({ error: "Status inválido." }, { status: 400 });
          }

          const sql = await getSql();

          const updatedRes = await sql.query<{ id: string; status: string }>(
            `
              update "profile_report"
              set
                "status" = $1,
                "adminNotes" = coalesce($2, "adminNotes"),
                "resolvedBy" = $3,
                "updatedAt" = CURRENT_TIMESTAMP
              where "id" = $4
              returning "id", "status"
            `,
            [status, adminNotes, adminSession.id, reportId],
          );

          const updatedRows = Array.isArray(updatedRes)
            ? updatedRes
            : (updatedRes as any)?.rows ?? [];
          if (updatedRows.length === 0) {
            return Response.json(
              { error: "Denúncia não encontrada." },
              { status: 404 },
            );
          }

          return Response.json({
            success: true,
            reportId: updatedRows[0].id,
            status: updatedRows[0].status,
          });
        } catch (error) {
          if (error instanceof CrossSiteRequestError) {
            return Response.json({ error: error.message }, { status: error.status });
          }
          console.error(
            "[api/admin/profile-reports] Erro ao atualizar denúncia:",
            error,
          );
          return Response.json(
            { error: "Não foi possível atualizar a denúncia." },
            { status: 500 },
          );
        }
      },
    },
  },
});
