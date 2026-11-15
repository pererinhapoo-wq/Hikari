import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import {
  assertSameSiteRequest,
  CrossSiteRequestError,
} from "@/lib/auth/isolation.server";
import {
  AdminAuthError,
  verifyAdminRequest,
} from "@/lib/auth/admin.server";
import {
  isSystemProtectedAdmin,
  listActiveBansMap,
} from "@/lib/moderation-bans.server";
import type { ActiveUserBan } from "@/lib/moderation-ban-types";

const REPORT_REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  hate: "Ódio ou discurso de ódio",
  spoiler: "Spoiler não marcado",
  sexual: "Conteúdo sexual",
  harassment: "Assédio",
  other: "Outro",
};

export interface AdminCommentItem {
  id: string;
  animeId: string;
  animeTitle: string | null;
  animeCover: string | null;
  episodeId: string;
  content: string;
  imageUrl: string | null;
  parentId: string | null;
  isSpoiler: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
  userName: string;
  userNick: string | null;
  userEmail: string | null;
  userImage: string | null;
  userRole: "admin" | "user";
  isSystemAdmin: boolean;
  likesCount: number;
  dislikesCount: number;
  repliesCount: number;
  pendingReportCount: number;
  totalReportCount: number;
  reportReasons: Array<{ value: string; label: string }>;
  firstReportedAt: string | null;
  authorActiveBan: ActiveUserBan | null;
}

export interface AdminCommentsSummary {
  totalComments: number;
  totalRoots: number;
  totalReplies: number;
  reportedComments: number;
  pendingReports: number;
  spoilersCount: number;
  activeBansCount: number;
}

export const Route = createFileRoute("/api/admin/comments")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
          try {
            await verifyAdminRequest(request);
          } catch (err) {
            if (err instanceof AdminAuthError) {
              return Response.json({ error: err.message }, { status: err.status });
            }
            return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
          }

          const url = new URL(request.url);
          const search = (url.searchParams.get("search") || "").trim().toLowerCase();
          const filter = (url.searchParams.get("filter") || "all").trim().toLowerCase();
          const animeIdFilter = (url.searchParams.get("animeId") || "").trim();
          const userIdFilter = (url.searchParams.get("userId") || "").trim();
          const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
          const limit = Math.min(
            50,
            Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20),
          );
          const offset = (page - 1) * limit;

          const sql = await getSql();
          const activeBansMap = await listActiveBansMap(sql);

          const [statsRow] = await sql.query<{
            total_comments: number;
            total_roots: number;
            total_replies: number;
            spoilers_count: number;
            reported_comments: number;
            pending_reports: number;
          }>(`
            SELECT
              (SELECT COUNT(*)::int FROM "comment") AS total_comments,
              (SELECT COUNT(*)::int FROM "comment" WHERE "parentId" IS NULL) AS total_roots,
              (SELECT COUNT(*)::int FROM "comment" WHERE "parentId" IS NOT NULL) AS total_replies,
              (SELECT COUNT(*)::int FROM "comment" WHERE "isSpoiler" = true) AS spoilers_count,
              (SELECT COUNT(DISTINCT "commentId")::int FROM "comment_report" WHERE "status" = 'pending') AS reported_comments,
              (SELECT COUNT(*)::int FROM "comment_report" WHERE "status" = 'pending') AS pending_reports;
          `);

          const conditions: string[] = [];
          const params: unknown[] = [];

          if (search) {
            params.push(`%${search}%`);
            const pIdx = params.length;
            conditions.push(`(
              LOWER(c."content") LIKE $${pIdx} OR
              LOWER(c."animeId") LIKE $${pIdx} OR
              LOWER(c."episodeId") LIKE $${pIdx} OR
              LOWER(COALESCE(u."name", '')) LIKE $${pIdx} OR
              LOWER(COALESCE(u."email", '')) LIKE $${pIdx} OR
              LOWER(COALESCE(p."nick", '')) LIKE $${pIdx} OR
              LOWER(COALESCE(ca."title", '')) LIKE $${pIdx}
            )`);
          }

          if (animeIdFilter) {
            params.push(animeIdFilter);
            conditions.push(`c."animeId" = $${params.length}`);
          }

          if (userIdFilter) {
            params.push(userIdFilter);
            conditions.push(`c."userId" = $${params.length}`);
          }

          if (filter === "reported" || filter === "pending_reports") {
            conditions.push(`EXISTS (
              SELECT 1 FROM "comment_report" cr_f
              WHERE cr_f."commentId" = c."id" AND cr_f."status" = 'pending'
            )`);
          } else if (filter === "spoilers") {
            conditions.push(`c."isSpoiler" = true`);
          } else if (filter === "roots") {
            conditions.push(`c."parentId" IS NULL`);
          } else if (filter === "replies") {
            conditions.push(`c."parentId" IS NOT NULL`);
          }

          const whereClause =
            conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

          const countRows = await sql.query<{ total: number }>(
            `SELECT COUNT(c."id")::int AS total
             FROM "comment" c
             LEFT JOIN "user" u ON u."id" = c."userId"
             LEFT JOIN "profile" p ON p."userId" = c."userId"
             LEFT JOIN LATERAL (
               SELECT ca_inner."title"
               FROM "catalog_anime" ca_inner
               WHERE ca_inner."id" = c."animeId"
                  OR ca_inner."anilistId"::text = c."animeId"
                  OR ca_inner."kitsuId"::text = c."animeId"
               LIMIT 1
             ) ca ON true
             ${whereClause};`,
            params,
          );

          const totalFiltered = Number(countRows[0]?.total || 0);

          const listParams = [...params, limit, offset];
          const limitIdx = params.length + 1;
          const offsetIdx = params.length + 2;

          const rows = await sql.query<{
            id: string;
            animeId: string;
            animeTitle: string | null;
            animeCover: string | null;
            episodeId: string;
            content: string;
            imageUrl: string | null;
            parentId: string | null;
            isSpoiler: boolean;
            createdAt: string | Date;
            updatedAt: string | Date;
            userId: string;
            userName: string | null;
            userNick: string | null;
            userEmail: string | null;
            userImage: string | null;
            userRole: string | null;
            likesCount: number;
            dislikesCount: number;
            repliesCount: number;
            pendingReportCount: number;
            totalReportCount: number;
            reportReasons: string[] | null;
            firstReportedAt: string | Date | null;
          }>(
            `SELECT
               c."id",
               c."animeId",
               ca."title" AS "animeTitle",
               ca."cover" AS "animeCover",
               c."episodeId",
               c."content",
               c."imageUrl",
               c."parentId",
               c."isSpoiler",
               c."createdAt",
               c."updatedAt",
               c."userId",
               COALESCE(nullif(trim(u."name"), ''), nullif(trim(p."nick"), ''), 'Usuário') AS "userName",
               p."nick" AS "userNick",
               u."email" AS "userEmail",
               COALESCE(p."avatarUrl", u."image") AS "userImage",
               COALESCE(p."role", 'user') AS "userRole",
               COALESCE(lc."likes", 0)::int AS "likesCount",
               COALESCE(lc."dislikes", 0)::int AS "dislikesCount",
               COALESCE(rc."replies", 0)::int AS "repliesCount",
               COALESCE(rp."pendingCount", 0)::int AS "pendingReportCount",
               COALESCE(rp."totalCount", 0)::int AS "totalReportCount",
               rp."reasons" AS "reportReasons",
               rp."firstReportedAt" AS "firstReportedAt"
             FROM "comment" c
             LEFT JOIN "user" u ON u."id" = c."userId"
             LEFT JOIN "profile" p ON p."userId" = c."userId"
             LEFT JOIN LATERAL (
               SELECT ca_inner."title", ca_inner."cover"
               FROM "catalog_anime" ca_inner
               WHERE ca_inner."id" = c."animeId"
                  OR ca_inner."anilistId"::text = c."animeId"
                  OR ca_inner."kitsuId"::text = c."animeId"
               LIMIT 1
             ) ca ON true
             LEFT JOIN LATERAL (
               SELECT
                 COUNT(*) FILTER (WHERE cl."type" = 'like' OR cl."type" IS NULL)::int AS "likes",
                 COUNT(*) FILTER (WHERE cl."type" = 'dislike')::int AS "dislikes"
               FROM "comment_like" cl
               WHERE cl."commentId" = c."id"
             ) lc ON true
             LEFT JOIN LATERAL (
               SELECT COUNT(*)::int AS "replies"
               FROM "comment" r
               WHERE r."parentId" = c."id"
             ) rc ON true
             LEFT JOIN LATERAL (
               SELECT
                 COUNT(*) FILTER (WHERE cr."status" = 'pending')::int AS "pendingCount",
                 COUNT(*)::int AS "totalCount",
                 ARRAY_AGG(DISTINCT cr."reason") FILTER (WHERE cr."status" = 'pending') AS "reasons",
                 MIN(cr."createdAt") FILTER (WHERE cr."status" = 'pending') AS "firstReportedAt"
               FROM "comment_report" cr
               WHERE cr."commentId" = c."id"
             ) rp ON true
             ${whereClause}
             ORDER BY
               ${filter === "reported" || filter === "pending_reports" ? 'rp."firstReportedAt" DESC NULLS LAST,' : ""}
               c."createdAt" DESC,
               c."id" DESC
             LIMIT $${limitIdx} OFFSET $${offsetIdx};`,
            listParams,
          );

          const comments: AdminCommentItem[] = (rows ?? []).map((row) => {
            const isSysAdmin = isSystemProtectedAdmin({
              userId: row.userId,
              email: row.userEmail,
            });
            const rawReasons = Array.isArray(row.reportReasons)
              ? row.reportReasons
              : [];
            return {
              id: String(row.id),
              animeId: String(row.animeId),
              animeTitle: row.animeTitle ? String(row.animeTitle) : null,
              animeCover: row.animeCover ? String(row.animeCover) : null,
              episodeId: String(row.episodeId),
              content: String(row.content ?? ""),
              imageUrl: row.imageUrl ? String(row.imageUrl) : null,
              parentId: row.parentId ? String(row.parentId) : null,
              isSpoiler: Boolean(row.isSpoiler),
              createdAt:
                row.createdAt instanceof Date
                  ? row.createdAt.toISOString()
                  : new Date(row.createdAt).toISOString(),
              updatedAt:
                row.updatedAt instanceof Date
                  ? row.updatedAt.toISOString()
                  : new Date(row.updatedAt).toISOString(),
              userId: String(row.userId),
              userName: row.userName ? String(row.userName) : "Usuário",
              userNick: row.userNick ? String(row.userNick) : null,
              userEmail: row.userEmail ? String(row.userEmail) : null,
              userImage: row.userImage ? String(row.userImage) : null,
              userRole:
                row.userRole === "admin" || isSysAdmin ? "admin" : "user",
              isSystemAdmin: isSysAdmin,
              likesCount: Number(row.likesCount) || 0,
              dislikesCount: Number(row.dislikesCount) || 0,
              repliesCount: Number(row.repliesCount) || 0,
              pendingReportCount: Number(row.pendingReportCount) || 0,
              totalReportCount: Number(row.totalReportCount) || 0,
              reportReasons: rawReasons.map((r) => ({
                value: String(r),
                label: REPORT_REASON_LABELS[String(r)] ?? String(r),
              })),
              firstReportedAt: row.firstReportedAt
                ? row.firstReportedAt instanceof Date
                  ? row.firstReportedAt.toISOString()
                  : new Date(row.firstReportedAt).toISOString()
                : null,
              authorActiveBan: activeBansMap.get(String(row.userId)) ?? null,
            };
          });

          const summary: AdminCommentsSummary = {
            totalComments: Number(statsRow?.total_comments || 0),
            totalRoots: Number(statsRow?.total_roots || 0),
            totalReplies: Number(statsRow?.total_replies || 0),
            reportedComments: Number(statsRow?.reported_comments || 0),
            pendingReports: Number(statsRow?.pending_reports || 0),
            spoilersCount: Number(statsRow?.spoilers_count || 0),
            activeBansCount: activeBansMap.size,
          };

          return Response.json(
            {
              ok: true,
              comments,
              summary,
              pagination: {
                total: totalFiltered,
                page,
                limit,
                totalPages: Math.ceil(totalFiltered / limit) || 1,
              },
            },
            {
              headers: {
                "Cache-Control": "private, no-cache, no-store, must-revalidate",
              },
            },
          );
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[api/admin/comments] Erro no GET:", err);
          return Response.json(
            { error: "Não foi possível carregar os comentários no Admin." },
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

          let body: Record<string, unknown>;
          try {
            body = (await request.json()) as Record<string, unknown>;
          } catch {
            return Response.json({ error: "JSON inválido." }, { status: 400 });
          }

          const commentId =
            typeof body.commentId === "string" ? body.commentId.trim() : "";
          const action =
            typeof body.action === "string"
              ? body.action.trim().toLowerCase()
              : "";

          if (!commentId) {
            return Response.json(
              { error: "O campo 'commentId' é obrigatório." },
              { status: 400 },
            );
          }

          if (
            action !== "delete" &&
            action !== "resolve_reports" &&
            action !== "toggle_spoiler"
          ) {
            return Response.json(
              { error: "Ação administrativa inválida." },
              { status: 400 },
            );
          }

          const sql = await getSql();
          const existing = await sql.query<{ id: string; isSpoiler: boolean }>(
            `SELECT "id", "isSpoiler" FROM "comment" WHERE "id" = $1 LIMIT 1;`,
            [commentId],
          );

          if (!existing || existing.length === 0) {
            return Response.json(
              { error: "Comentário não encontrado." },
              { status: 404 },
            );
          }

          if (action === "delete") {
            await sql.query(`DELETE FROM "comment" WHERE "id" = $1;`, [commentId]);
            return Response.json({ ok: true, action: "delete", commentId });
          }

          if (action === "resolve_reports") {
            await sql.query(
              `UPDATE "comment_report"
               SET
                 "status" = 'resolved',
                 "resolvedAt" = CURRENT_TIMESTAMP,
                 "resolvedBy" = $2
               WHERE "commentId" = $1
                 AND "status" = 'pending';`,
              [commentId, adminSession.id],
            );
            return Response.json({
              ok: true,
              action: "resolve_reports",
              commentId,
            });
          }

          const nextSpoiler =
            typeof body.isSpoiler === "boolean"
              ? body.isSpoiler
              : !existing[0].isSpoiler;

          await sql.query(
            `UPDATE "comment"
             SET "isSpoiler" = $1, "updatedAt" = CURRENT_TIMESTAMP
             WHERE "id" = $2;`,
            [nextSpoiler, commentId],
          );

          return Response.json({
            ok: true,
            action: "toggle_spoiler",
            commentId,
            isSpoiler: nextSpoiler,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[api/admin/comments] Erro no POST:", err);
          return Response.json(
            { error: "Não foi possível executar a ação no comentário." },
            { status: 500 },
          );
        }
      },
    },
  },
});
