import { createFileRoute } from "@tanstack/react-router";
import { getSql, type Sql } from "@/lib/db";
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

export interface AdminCommentsQueryResult {
  comments: AdminCommentItem[];
  summary: AdminCommentsSummary;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface ResolvedAnimeMeta {
  title: string;
  cover: string | null;
}

const MAX_PG_INT32 = 2147483647;

/**
 * Resolve metadados de animes (título e capa) em lote fora das consultas de contagem/paginação,
 * sem joins LATERAL e sem casts ::text em anilistId/kitsuId.
 */
async function resolveAnimeMetaBatch(
  sql: Sql,
  animeIds: string[],
): Promise<Map<string, ResolvedAnimeMeta>> {
  const result = new Map<string, ResolvedAnimeMeta>();
  const uniqueIds = Array.from(
    new Set(animeIds.map((id) => id.trim()).filter(Boolean)),
  );
  if (uniqueIds.length === 0) return result;

  const numericIds: number[] = [];
  for (const id of uniqueIds) {
    if (/^\d+$/.test(id)) {
      const parsed = Number(id);
      if (Number.isSafeInteger(parsed) && parsed > 0 && parsed <= MAX_PG_INT32) {
        numericIds.push(parsed);
      }
    }
  }

  const rows =
    numericIds.length > 0
      ? await sql.query<{
          id: string;
          anilistId: number | null;
          kitsuId: number | null;
          title: string;
          cover: string | null;
        }>(
          `SELECT "id", "anilistId", "kitsuId", "title", "cover"
           FROM "catalog_anime"
           WHERE "id" = ANY($1::text[])
              OR "anilistId" = ANY($2::int[])
              OR "kitsuId" = ANY($2::int[]);`,
          [uniqueIds, numericIds],
        )
      : await sql.query<{
          id: string;
          anilistId: number | null;
          kitsuId: number | null;
          title: string;
          cover: string | null;
        }>(
          `SELECT "id", "anilistId", "kitsuId", "title", "cover"
           FROM "catalog_anime"
           WHERE "id" = ANY($1::text[]);`,
          [uniqueIds],
        );

  const byId = new Map<string, ResolvedAnimeMeta>();
  const byAni = new Map<string, ResolvedAnimeMeta>();
  const byKitsu = new Map<string, ResolvedAnimeMeta>();

  for (const row of rows ?? []) {
    const meta: ResolvedAnimeMeta = {
      title: row.title,
      cover: row.cover ?? null,
    };
    byId.set(row.id, meta);
    if (row.anilistId !== null && row.anilistId !== undefined) {
      const key = String(row.anilistId);
      if (!byAni.has(key)) byAni.set(key, meta);
    }
    if (row.kitsuId !== null && row.kitsuId !== undefined) {
      const key = String(row.kitsuId);
      if (!byKitsu.has(key)) byKitsu.set(key, meta);
    }
  }

  for (const rawId of uniqueIds) {
    const matched =
      byId.get(rawId) ?? byAni.get(rawId) ?? byKitsu.get(rawId);
    if (matched) {
      result.set(rawId, matched);
    }
  }

  return result;
}

/**
 * Executa a consulta otimizada de comentários para a Moderação:
 * 1. Consolida as 6 subqueries de estatísticas em 2 agregações (1 varredura em comment, 1 em comment_report).
 * 2. Quando há busca textual, pré-resolve animes correspondentes fora da consulta de contagem.
 * 3. Elimina joins LATERAL e casts ::text em catalog_anime, paginando primeiro antes de agregar curtidas/respostas/denúncias.
 * 4. Resolve título/capa dos animes em lote apenas para os comentários da página atual.
 */
export async function queryAdminCommentsFromDb(
  sql: Sql,
  options: {
    search?: string;
    filter?: string;
    animeIdFilter?: string;
    userIdFilter?: string;
    page?: number;
    limit?: number;
  },
): Promise<AdminCommentsQueryResult> {
  const search = (options.search || "").trim().toLowerCase();
  const filter = (options.filter || "all").trim().toLowerCase();
  const animeIdFilter = (options.animeIdFilter || "").trim();
  const userIdFilter = (options.userIdFilter || "").trim();
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;
  const isReportedFilter =
    filter === "reported" || filter === "pending_reports";

  const [activeBansMap, statsRows, matchedAnimeIds] = await Promise.all([
    listActiveBansMap(sql),
    sql.query<{
      total_comments: number;
      total_roots: number;
      total_replies: number;
      spoilers_count: number;
      reported_comments: number;
      pending_reports: number;
    }>(`
      SELECT
        c_stats."total_comments",
        c_stats."total_roots",
        c_stats."total_replies",
        c_stats."spoilers_count",
        r_stats."reported_comments",
        r_stats."pending_reports"
      FROM (
        SELECT
          COUNT(*)::int AS "total_comments",
          COUNT(*) FILTER (WHERE "parentId" IS NULL)::int AS "total_roots",
          COUNT(*) FILTER (WHERE "parentId" IS NOT NULL)::int AS "total_replies",
          COUNT(*) FILTER (WHERE "isSpoiler" = true)::int AS "spoilers_count"
        FROM "comment"
      ) c_stats
      CROSS JOIN (
        SELECT
          COUNT(DISTINCT "commentId") FILTER (WHERE "status" = 'pending')::int AS "reported_comments",
          COUNT(*) FILTER (WHERE "status" = 'pending')::int AS "pending_reports"
        FROM "comment_report"
      ) r_stats;
    `),
    search
      ? sql
          .query<{
            id: string;
            anilistId: number | null;
            kitsuId: number | null;
          }>(
            `SELECT "id", "anilistId", "kitsuId"
             FROM "catalog_anime"
             WHERE LOWER("title") LIKE $1
                OR LOWER(COALESCE("titleRomaji", '')) LIKE $1
                OR LOWER(COALESCE("titleEnglish", '')) LIKE $1
                OR LOWER("id") LIKE $1;`,
            [`%${search}%`],
          )
          .then((matches) => {
            const ids = new Set<string>();
            for (const m of matches ?? []) {
              if (m.id) ids.add(m.id);
              if (m.anilistId !== null && m.anilistId !== undefined) {
                ids.add(String(m.anilistId));
              }
              if (m.kitsuId !== null && m.kitsuId !== undefined) {
                ids.add(String(m.kitsuId));
              }
            }
            return Array.from(ids);
          })
      : Promise.resolve<string[]>([]),
  ]);

  const statsRow = statsRows[0];
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (search) {
    params.push(`%${search}%`);
    const pIdx = params.length;
    const searchBranches = [
      `LOWER(c."content") LIKE $${pIdx}`,
      `LOWER(c."animeId") LIKE $${pIdx}`,
      `LOWER(c."episodeId") LIKE $${pIdx}`,
      `LOWER(COALESCE(u."name", '')) LIKE $${pIdx}`,
      `LOWER(COALESCE(u."email", '')) LIKE $${pIdx}`,
      `LOWER(COALESCE(p."nick", '')) LIKE $${pIdx}`,
    ];
    if (matchedAnimeIds.length > 0) {
      params.push(matchedAnimeIds);
      searchBranches.push(`c."animeId" = ANY($${params.length}::text[])`);
    }
    conditions.push(`(${searchBranches.join(" OR ")})`);
  }

  if (animeIdFilter) {
    params.push(animeIdFilter);
    conditions.push(`c."animeId" = $${params.length}`);
  }

  if (userIdFilter) {
    params.push(userIdFilter);
    conditions.push(`c."userId" = $${params.length}`);
  }

  if (filter === "spoilers") {
    conditions.push(`c."isSpoiler" = true`);
  } else if (filter === "roots") {
    conditions.push(`c."parentId" IS NULL`);
  } else if (filter === "replies") {
    conditions.push(`c."parentId" IS NOT NULL`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const listParams = [...params, limit, offset];
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;

  const userSearchJoins = search
    ? `LEFT JOIN "user" u ON u."id" = c."userId"
       LEFT JOIN "profile" p ON p."userId" = c."userId"`
    : "";

  const pendingRepCte = isReportedFilter
    ? `pending_rep AS (
         SELECT
           cr."commentId",
           COUNT(*)::int AS "pendingCount",
           ARRAY_AGG(DISTINCT cr."reason") AS "reasons",
           MIN(cr."createdAt") AS "firstReportedAt"
         FROM "comment_report" cr
         WHERE cr."status" = 'pending'
         GROUP BY cr."commentId"
       ),`
    : "";

  const matchedSelectSql = isReportedFilter
    ? `SELECT
         c."id",
         c."animeId",
         c."episodeId",
         c."content",
         c."imageUrl",
         c."parentId",
         c."isSpoiler",
         c."createdAt",
         c."updatedAt",
         c."userId",
         pr."pendingCount" AS "pendingReportCount",
         pr."reasons" AS "reportReasons",
         pr."firstReportedAt" AS "firstReportedAt"
       FROM "comment" c
       INNER JOIN pending_rep pr ON pr."commentId" = c."id"
       ${userSearchJoins}
       ${whereClause}`
    : `SELECT
         c."id",
         c."animeId",
         c."episodeId",
         c."content",
         c."imageUrl",
         c."parentId",
         c."isSpoiler",
         c."createdAt",
         c."updatedAt",
         c."userId",
         NULL::int AS "pendingReportCount",
         NULL::text[] AS "reportReasons",
         NULL::timestamptz AS "firstReportedAt"
       FROM "comment" c
       ${userSearchJoins}
       ${whereClause}`;

  const orderByPaged = isReportedFilter
    ? `ORDER BY "firstReportedAt" DESC NULLS LAST, "createdAt" DESC, "id" DESC`
    : `ORDER BY "createdAt" DESC, "id" DESC`;

  const orderByFinal = isReportedFilter
    ? `ORDER BY pg."firstReportedAt" DESC NULLS LAST, pg."createdAt" DESC, pg."id" DESC`
    : `ORDER BY pg."createdAt" DESC, pg."id" DESC`;

  const rows = await sql.query<{
    total: number;
    id: string | null;
    animeId: string | null;
    episodeId: string | null;
    content: string | null;
    imageUrl: string | null;
    parentId: string | null;
    isSpoiler: boolean | null;
    createdAt: string | Date | null;
    updatedAt: string | Date | null;
    userId: string | null;
    userName: string | null;
    userNick: string | null;
    userEmail: string | null;
    userImage: string | null;
    userRole: string | null;
    likesCount: number | null;
    dislikesCount: number | null;
    repliesCount: number | null;
    pendingReportCount: number | null;
    totalReportCount: number | null;
    reportReasons: string[] | null;
    firstReportedAt: string | Date | null;
  }>(
    `WITH
       ${pendingRepCte}
       matched AS (
         ${matchedSelectSql}
       ),
       counted AS (
         SELECT COUNT(*)::int AS "total" FROM matched
       ),
       paged AS (
         SELECT *
         FROM matched
         ${orderByPaged}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}
       ),
       like_agg AS (
         SELECT
           cl."commentId",
           COUNT(*) FILTER (WHERE cl."type" = 'like' OR cl."type" IS NULL)::int AS "likes",
           COUNT(*) FILTER (WHERE cl."type" = 'dislike')::int AS "dislikes"
         FROM "comment_like" cl
         WHERE cl."commentId" IN (SELECT "id" FROM paged)
         GROUP BY cl."commentId"
       ),
       reply_agg AS (
         SELECT
           r."parentId" AS "commentId",
           COUNT(*)::int AS "replies"
         FROM "comment" r
         WHERE r."parentId" IN (SELECT "id" FROM paged)
         GROUP BY r."parentId"
       ),
       report_agg AS (
         SELECT
           cr."commentId",
           COUNT(*) FILTER (WHERE cr."status" = 'pending')::int AS "pendingCount",
           COUNT(*)::int AS "totalCount",
           ARRAY_AGG(DISTINCT cr."reason") FILTER (WHERE cr."status" = 'pending') AS "reasons",
           MIN(cr."createdAt") FILTER (WHERE cr."status" = 'pending') AS "firstReportedAt"
         FROM "comment_report" cr
         WHERE cr."commentId" IN (SELECT "id" FROM paged)
         GROUP BY cr."commentId"
       )
     SELECT
       cnt."total",
       pg."id",
       pg."animeId",
       pg."episodeId",
       pg."content",
       pg."imageUrl",
       pg."parentId",
       pg."isSpoiler",
       pg."createdAt",
       pg."updatedAt",
       pg."userId",
       COALESCE(nullif(trim(u."name"), ''), nullif(trim(p."nick"), ''), 'Usuário') AS "userName",
       p."nick" AS "userNick",
       u."email" AS "userEmail",
       COALESCE(p."avatarUrl", u."image") AS "userImage",
       COALESCE(p."role", 'user') AS "userRole",
       COALESCE(la."likes", 0)::int AS "likesCount",
       COALESCE(la."dislikes", 0)::int AS "dislikesCount",
       COALESCE(ra."replies", 0)::int AS "repliesCount",
       COALESCE(pg."pendingReportCount", rep."pendingCount", 0)::int AS "pendingReportCount",
       COALESCE(rep."totalCount", 0)::int AS "totalReportCount",
       COALESCE(pg."reportReasons", rep."reasons") AS "reportReasons",
       COALESCE(pg."firstReportedAt", rep."firstReportedAt") AS "firstReportedAt"
     FROM counted cnt
     LEFT JOIN paged pg ON true
     LEFT JOIN "user" u ON u."id" = pg."userId"
     LEFT JOIN "profile" p ON p."userId" = pg."userId"
     LEFT JOIN like_agg la ON la."commentId" = pg."id"
     LEFT JOIN reply_agg ra ON ra."commentId" = pg."id"
     LEFT JOIN report_agg rep ON rep."commentId" = pg."id"
     ${orderByFinal};`,
    listParams,
  );

  const totalFiltered = Number(rows[0]?.total || 0);
  const validRows = (rows ?? []).filter(
    (r): r is typeof r & { id: string; animeId: string; userId: string } =>
      Boolean(r.id && r.animeId && r.userId),
  );

  const animeMetaMap =
    validRows.length > 0
      ? await resolveAnimeMetaBatch(
          sql,
          validRows.map((r) => r.animeId),
        )
      : new Map<string, ResolvedAnimeMeta>();

  const comments: AdminCommentItem[] = validRows.map((row) => {
    const isSysAdmin = isSystemProtectedAdmin({
      userId: row.userId,
      email: row.userEmail,
    });
    const rawReasons = Array.isArray(row.reportReasons)
      ? row.reportReasons
      : [];
    const animeMeta = animeMetaMap.get(String(row.animeId));

    return {
      id: String(row.id),
      animeId: String(row.animeId),
      animeTitle: animeMeta?.title ? String(animeMeta.title) : null,
      animeCover: animeMeta?.cover ? String(animeMeta.cover) : null,
      episodeId: String(row.episodeId ?? ""),
      content: String(row.content ?? ""),
      imageUrl: row.imageUrl ? String(row.imageUrl) : null,
      parentId: row.parentId ? String(row.parentId) : null,
      isSpoiler: Boolean(row.isSpoiler),
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : new Date(row.createdAt ?? 0).toISOString(),
      updatedAt:
        row.updatedAt instanceof Date
          ? row.updatedAt.toISOString()
          : new Date(row.updatedAt ?? 0).toISOString(),
      userId: String(row.userId),
      userName: row.userName ? String(row.userName) : "Usuário",
      userNick: row.userNick ? String(row.userNick) : null,
      userEmail: row.userEmail ? String(row.userEmail) : null,
      userImage: row.userImage ? String(row.userImage) : null,
      userRole: row.userRole === "admin" || isSysAdmin ? "admin" : "user",
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

  return {
    comments,
    summary,
    pagination: {
      total: totalFiltered,
      page,
      limit,
      totalPages: Math.ceil(totalFiltered / limit) || 1,
    },
  };
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

          const sql = await getSql();
          const result = await queryAdminCommentsFromDb(sql, {
            search,
            filter,
            animeIdFilter,
            userIdFilter,
            page,
            limit,
          });

          return Response.json(
            {
              ok: true,
              comments: result.comments,
              summary: result.summary,
              pagination: result.pagination,
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
