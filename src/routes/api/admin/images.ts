import { createFileRoute } from "@tanstack/react-router";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import { getSql, type Sql } from "@/lib/db";

export type ImageType = "cover" | "banner" | "thumbnail" | "avatar";

export interface AdminImageItem {
  id: string;
  type: ImageType;
  url: string;
  entityId: string;
  entityTitle: string;
  subTitle?: string | null;
  format?: string | null;
  updatedAt: string;
  provider: "anilist" | "hikari" | "external";
  isBlobOrInvalid: boolean;
}

export interface AdminImagesStats {
  totalAll: number;
  totalCovers: number;
  totalBanners: number;
  totalThumbnails: number;
  totalAvatars: number;
}

export interface AdminImagesQueryResult {
  images: AdminImageItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats: AdminImagesStats;
}

function detectImageProvider(url: string): "anilist" | "hikari" | "external" {
  if (url.includes("anilist.co")) return "anilist";
  if (url.startsWith("/") || url.includes("hikari")) return "hikari";
  return "external";
}

function formatUpdatedAtIso(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

/**
 * Executa a consulta otimizada da Central de Imagens:
 * - Preserva "updatedAt" como timestamptz nativo (sem ::text) na ordenação ORDER BY.
 * - Sem busca: reutiliza a contagem exata das estatísticas globais, eliminando o countSql separado.
 * - Com busca: combina contagem e paginação em uma única CTE com COUNT(*) OVER().
 */
export async function queryAdminImagesFromDb(
  sql: Sql,
  options: {
    typeParam: string;
    search: string;
    page: number;
    limit: number;
  },
): Promise<AdminImagesQueryResult> {
  const typeParam = (options.typeParam || "all").trim().toLowerCase();
  const search = (options.search || "").trim().toLowerCase();
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(96, Math.max(1, options.limit || 24));
  const offset = (page - 1) * limit;

  // 1. Estatísticas globais de imagens
  const [statsRow] = await sql.query<{
    covers_count: number;
    banners_count: number;
    thumbnails_count: number;
    avatars_count: number;
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM "catalog_anime" WHERE "archived_at" IS NULL AND "cover" IS NOT NULL AND "cover" != '') AS covers_count,
      (SELECT COUNT(*)::int FROM "catalog_anime" WHERE "archived_at" IS NULL AND "banner" IS NOT NULL AND "banner" != '') AS banners_count,
      (SELECT COUNT(*)::int FROM "catalog_episode" e INNER JOIN "catalog_anime" a ON a."id" = e."animeId" WHERE a."archived_at" IS NULL AND e."thumbnail" IS NOT NULL AND e."thumbnail" != '') AS thumbnails_count,
      (SELECT COUNT(*)::int FROM "user" u LEFT JOIN "profile" p ON p."userId" = u."id"
       WHERE (p."avatarUrl" IS NOT NULL AND p."avatarUrl" != '') OR (u."image" IS NOT NULL AND u."image" != '')) AS avatars_count;
  `);

  const totalCovers = Number(statsRow?.covers_count || 0);
  const totalBanners = Number(statsRow?.banners_count || 0);
  const totalThumbnails = Number(statsRow?.thumbnails_count || 0);
  const totalAvatars = Number(statsRow?.avatars_count || 0);
  const totalAll = totalCovers + totalBanners + totalThumbnails + totalAvatars;

  const stats: AdminImagesStats = {
    totalAll,
    totalCovers,
    totalBanners,
    totalThumbnails,
    totalAvatars,
  };

  // 2. Montagem de query unificada mantendo "updatedAt" nativo (timestamptz)
  const queries: string[] = [];

  if (typeParam === "all" || typeParam === "cover") {
    queries.push(`
      SELECT
        ('cover_' || "id") AS "id",
        'cover' AS "type",
        "cover" AS "url",
        "id" AS "entityId",
        "title" AS "entityTitle",
        "format" AS "subTitle",
        "updatedAt" AS "updatedAt"
      FROM "catalog_anime"
      WHERE "archived_at" IS NULL AND "cover" IS NOT NULL AND "cover" != ''
    `);
  }

  if (typeParam === "all" || typeParam === "banner") {
    queries.push(`
      SELECT
        ('banner_' || "id") AS "id",
        'banner' AS "type",
        "banner" AS "url",
        "id" AS "entityId",
        "title" AS "entityTitle",
        "format" AS "subTitle",
        "updatedAt" AS "updatedAt"
      FROM "catalog_anime"
      WHERE "archived_at" IS NULL AND "banner" IS NOT NULL AND "banner" != ''
    `);
  }

  if (typeParam === "all" || typeParam === "thumbnail") {
    queries.push(`
      SELECT
        ('thumb_' || e."id") AS "id",
        'thumbnail' AS "type",
        e."thumbnail" AS "url",
        e."animeId" AS "entityId",
        COALESCE(a."title", e."animeId") AS "entityTitle",
        ('T' || e."seasonNumber" || 'E' || e."number" || ' - ' || COALESCE(e."title", '')) AS "subTitle",
        e."updatedAt" AS "updatedAt"
      FROM "catalog_episode" e
      INNER JOIN "catalog_anime" a ON a."id" = e."animeId"
      WHERE a."archived_at" IS NULL AND e."thumbnail" IS NOT NULL AND e."thumbnail" != ''
    `);
  }

  if (typeParam === "all" || typeParam === "avatar") {
    queries.push(`
      SELECT
        ('avatar_' || u."id") AS "id",
        'avatar' AS "type",
        COALESCE(p."avatarUrl", u."image") AS "url",
        u."id" AS "entityId",
        COALESCE(p."displayName", u."name") AS "entityTitle",
        COALESCE(p."nick", u."email") AS "subTitle",
        u."updatedAt" AS "updatedAt"
      FROM "user" u
      LEFT JOIN "profile" p ON p."userId" = u."id"
      WHERE (p."avatarUrl" IS NOT NULL AND p."avatarUrl" != '') OR (u."image" IS NOT NULL AND u."image" != '')
    `);
  }

  if (queries.length === 0) {
    return {
      images: [],
      pagination: { total: 0, page: 1, limit, totalPages: 1 },
      stats,
    };
  }

  const combinedSql = queries.join(" UNION ALL ");

  let totalFiltered = 0;
  let rows: Array<{
    id: string;
    type: string;
    url: string;
    entityId: string;
    entityTitle: string;
    subTitle: string | null;
    updatedAt: string | Date;
    totalCount?: number;
  }>;

  if (search) {
    const searchLike = `%${search}%`;
    rows = await sql.query<{
      id: string;
      type: string;
      url: string;
      entityId: string;
      entityTitle: string;
      subTitle: string | null;
      updatedAt: string | Date;
      totalCount: number;
    }>(
      `WITH filtered AS (
         SELECT *
         FROM (${combinedSql}) sub
         WHERE LOWER(sub."entityTitle") LIKE $1
            OR LOWER(COALESCE(sub."subTitle", '')) LIKE $1
            OR LOWER(sub."url") LIKE $1
       )
       SELECT
         "id",
         "type",
         "url",
         "entityId",
         "entityTitle",
         "subTitle",
         "updatedAt",
         COUNT(*) OVER()::int AS "totalCount"
       FROM filtered
       ORDER BY "updatedAt" DESC NULLS LAST, "id" ASC
       LIMIT $2 OFFSET $3;`,
      [searchLike, limit, offset],
    );

    if (rows.length > 0) {
      totalFiltered = Number(rows[0].totalCount || 0);
    } else if (page > 1) {
      const [fallbackCount] = await sql.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM (${combinedSql}) sub
         WHERE LOWER(sub."entityTitle") LIKE $1
            OR LOWER(COALESCE(sub."subTitle", '')) LIKE $1
            OR LOWER(sub."url") LIKE $1;`,
        [searchLike],
      );
      totalFiltered = Number(fallbackCount?.total || 0);
    } else {
      totalFiltered = 0;
    }
  } else {
    if (typeParam === "cover") totalFiltered = totalCovers;
    else if (typeParam === "banner") totalFiltered = totalBanners;
    else if (typeParam === "thumbnail") totalFiltered = totalThumbnails;
    else if (typeParam === "avatar") totalFiltered = totalAvatars;
    else totalFiltered = totalAll;

    rows =
      totalFiltered === 0 || offset >= totalFiltered
        ? []
        : await sql.query<{
            id: string;
            type: string;
            url: string;
            entityId: string;
            entityTitle: string;
            subTitle: string | null;
            updatedAt: string | Date;
          }>(
            `SELECT
               sub."id",
               sub."type",
               sub."url",
               sub."entityId",
               sub."entityTitle",
               sub."subTitle",
               sub."updatedAt"
             FROM (${combinedSql}) sub
             ORDER BY sub."updatedAt" DESC NULLS LAST, sub."id" ASC
             LIMIT $1 OFFSET $2;`,
            [limit, offset],
          );
  }

  const images: AdminImageItem[] = rows.map((r) => {
    const cleanUrl = r.url?.trim() || "";
    const isBlob = cleanUrl.startsWith("blob:");

    return {
      id: r.id,
      type: r.type as ImageType,
      url: cleanUrl,
      entityId: r.entityId,
      entityTitle: r.entityTitle,
      subTitle: r.subTitle,
      updatedAt: formatUpdatedAtIso(r.updatedAt),
      provider: detectImageProvider(cleanUrl),
      isBlobOrInvalid: isBlob,
    };
  });

  return {
    images,
    pagination: {
      total: totalFiltered,
      page,
      limit,
      totalPages: Math.ceil(totalFiltered / limit) || 1,
    },
    stats,
  };
}

export const Route = createFileRoute("/api/admin/images")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);

          const url = new URL(request.url);
          const typeParam = (url.searchParams.get("type") || "all").trim().toLowerCase();
          const search = (url.searchParams.get("search") || "").trim().toLowerCase();
          const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
          const limit = Math.min(
            96,
            Math.max(1, parseInt(url.searchParams.get("limit") || "24", 10) || 24),
          );

          const sql = await getSql();
          const result = await queryAdminImagesFromDb(sql, {
            typeParam,
            search,
            page,
            limit,
          });

          return Response.json({
            ok: true,
            images: result.images,
            pagination: result.pagination,
            stats: result.stats,
            adminId,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: err.status });
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[api/admin/images] Erro:", err);
          return Response.json({ error: "Erro interno ao consultar imagens." }, { status: 500 });
        }
      },
    },
  },
});
