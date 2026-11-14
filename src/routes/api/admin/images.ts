import { createFileRoute } from "@tanstack/react-router";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import { getSql } from "@/lib/db";

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

function detectImageProvider(url: string): "anilist" | "hikari" | "external" {
  if (url.includes("anilist.co")) return "anilist";
  if (url.startsWith("/") || url.includes("hikari")) return "hikari";
  return "external";
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

          // 1. Estatísticas globais de imagens
          const [statsRow] = await sql.query<{
            covers_count: string;
            banners_count: string;
            thumbnails_count: string;
            avatars_count: string;
          }>(`
            SELECT
              (SELECT COUNT(*) FROM "catalog_anime" WHERE "cover" IS NOT NULL AND "cover" != '')::text as covers_count,
              (SELECT COUNT(*) FROM "catalog_anime" WHERE "banner" IS NOT NULL AND "banner" != '')::text as banners_count,
              (SELECT COUNT(*) FROM "catalog_episode" WHERE "thumbnail" IS NOT NULL AND "thumbnail" != '')::text as thumbnails_count,
              (SELECT COUNT(*) FROM "user" u LEFT JOIN "profile" p ON p."userId" = u."id"
               WHERE (p."avatarUrl" IS NOT NULL AND p."avatarUrl" != '') OR (u."image" IS NOT NULL AND u."image" != ''))::text as avatars_count;
          `);

          const totalCovers = parseInt(statsRow?.covers_count || "0", 10);
          const totalBanners = parseInt(statsRow?.banners_count || "0", 10);
          const totalThumbnails = parseInt(statsRow?.thumbnails_count || "0", 10);
          const totalAvatars = parseInt(statsRow?.avatars_count || "0", 10);
          const totalAll = totalCovers + totalBanners + totalThumbnails + totalAvatars;

          // 2. Montagem de query unificada com UNION ALL
          const queries: string[] = [];

          if (typeParam === "all" || typeParam === "cover") {
            queries.push(`
              SELECT
                ('cover_' || "id") as "id",
                'cover' as "type",
                "cover" as "url",
                "id" as "entityId",
                "title" as "entityTitle",
                "format" as "subTitle",
                "updatedAt"::text as "updatedAt"
              FROM "catalog_anime"
              WHERE "cover" IS NOT NULL AND "cover" != ''
            `);
          }

          if (typeParam === "all" || typeParam === "banner") {
            queries.push(`
              SELECT
                ('banner_' || "id") as "id",
                'banner' as "type",
                "banner" as "url",
                "id" as "entityId",
                "title" as "entityTitle",
                "format" as "subTitle",
                "updatedAt"::text as "updatedAt"
              FROM "catalog_anime"
              WHERE "banner" IS NOT NULL AND "banner" != ''
            `);
          }

          if (typeParam === "all" || typeParam === "thumbnail") {
            queries.push(`
              SELECT
                ('thumb_' || e."id") as "id",
                'thumbnail' as "type",
                e."thumbnail" as "url",
                e."animeId" as "entityId",
                COALESCE(a."title", e."animeId") as "entityTitle",
                ('T' || e."seasonNumber" || 'E' || e."number" || ' - ' || COALESCE(e."title", '')) as "subTitle",
                e."updatedAt"::text as "updatedAt"
              FROM "catalog_episode" e
              LEFT JOIN "catalog_anime" a ON a."id" = e."animeId"
              WHERE e."thumbnail" IS NOT NULL AND e."thumbnail" != ''
            `);
          }

          if (typeParam === "all" || typeParam === "avatar") {
            queries.push(`
              SELECT
                ('avatar_' || u."id") as "id",
                'avatar' as "type",
                COALESCE(p."avatarUrl", u."image") as "url",
                u."id" as "entityId",
                COALESCE(p."displayName", u."name") as "entityTitle",
                COALESCE(p."nick", u."email") as "subTitle",
                u."updatedAt"::text as "updatedAt"
              FROM "user" u
              LEFT JOIN "profile" p ON p."userId" = u."id"
              WHERE (p."avatarUrl" IS NOT NULL AND p."avatarUrl" != '') OR (u."image" IS NOT NULL AND u."image" != '')
            `);
          }

          if (queries.length === 0) {
            return Response.json({
              ok: true,
              images: [],
              pagination: { total: 0, page: 1, limit, totalPages: 1 },
              stats: { totalAll, totalCovers, totalBanners, totalThumbnails, totalAvatars },
            });
          }

          const combinedSql = queries.join(" UNION ALL ");

          // 3. Aplica busca se informada
          let finalSql: string;
          let countSql: string;
          const params: unknown[] = [];

          if (search) {
            params.push(`%${search}%`);
            countSql = `SELECT COUNT(*)::text as total FROM (${combinedSql}) sub WHERE LOWER(sub."entityTitle") LIKE $1 OR LOWER(COALESCE(sub."subTitle", '')) LIKE $1 OR LOWER(sub."url") LIKE $1;`;
            finalSql = `SELECT * FROM (${combinedSql}) sub WHERE LOWER(sub."entityTitle") LIKE $1 OR LOWER(COALESCE(sub."subTitle", '')) LIKE $1 OR LOWER(sub."url") LIKE $1 ORDER BY sub."updatedAt" DESC LIMIT $2 OFFSET $3;`;
            params.push(limit, (page - 1) * limit);
          } else {
            countSql = `SELECT COUNT(*)::text as total FROM (${combinedSql}) sub;`;
            finalSql = `SELECT * FROM (${combinedSql}) sub ORDER BY sub."updatedAt" DESC LIMIT $1 OFFSET $2;`;
            params.push(limit, (page - 1) * limit);
          }

          const [countResult] = await sql.query<{ total: string }>(
            countSql,
            search ? [`%${search}%`] : [],
          );
          const totalFiltered = parseInt(countResult?.total || "0", 10);

          const rows = await sql.query<{
            id: string;
            type: string;
            url: string;
            entityId: string;
            entityTitle: string;
            subTitle: string | null;
            updatedAt: string;
          }>(finalSql, params);

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
              updatedAt: r.updatedAt,
              provider: detectImageProvider(cleanUrl),
              isBlobOrInvalid: isBlob,
            };
          });

          return Response.json({
            ok: true,
            images,
            pagination: {
              total: totalFiltered,
              page,
              limit,
              totalPages: Math.ceil(totalFiltered / limit) || 1,
            },
            stats: {
              totalAll,
              totalCovers,
              totalBanners,
              totalThumbnails,
              totalAvatars,
            },
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
