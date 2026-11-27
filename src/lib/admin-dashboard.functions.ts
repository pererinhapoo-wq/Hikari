import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminMiddleware } from "@/lib/auth/middleware";
import type { Sql } from "@/lib/db";

export interface AdminSystemStatus {
  connected: boolean;
  dbSource: string;
  checkedAt: number;
  serverAnimesCount?: number;
  serverEpisodesCount?: number;
  serverPublishedEpisodesCount?: number;
  serverSeasonsCount?: number;
  serverUsersCount?: number;
  serverAdminsCount?: number;
  serverPendingReportsCount?: number;
  serverCommentsCount?: number;
  serverActiveBansCount?: number;
  maintenanceMode?: boolean;
  maintenanceAllowAdminBypass?: boolean;
  maintenanceMessage?: string;
  error?: string | null;
}

const MAINTENANCE_STATUS_KEYS = [
  "maintenance_mode",
  "maintenance_allow_admin_bypass",
  "maintenance_message",
] as const;

function parseSettingJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Consulta consolidada do estado do sistema administrativo.
 * Reduz ping + 6 contagens + bans + configurações para apenas 3 consultas paralelas,
 * eliminando o round-trip inicial de SELECT 1 e evitando carregar todas as 20+ configurações.
 */
export async function fetchAdminSystemStatusFromDb(
  sql: Sql,
  dbSource: string,
): Promise<AdminSystemStatus> {
  const { listActiveBansMap } = await import("@/lib/moderation-bans.server");

  const [countsRows, activeBansMap, maintenanceRows] = await Promise.all([
    sql.query<{
      animesCount: number;
      episodesCount: number;
      publishedEpisodesCount: number;
      seasonsCount: number;
      usersCount: number;
      adminsCount: number;
      pendingReportsCount: number;
      commentsCount: number;
    }>(`
      SELECT
        (SELECT count(*)::int FROM "catalog_anime" WHERE "archived_at" IS NULL) AS "animesCount",
        ep."total" AS "episodesCount",
        ep."published" AS "publishedEpisodesCount",
        (SELECT count(*)::int FROM "catalog_season") AS "seasonsCount",
        usr."totalUsers" AS "usersCount",
        usr."totalAdmins" AS "adminsCount",
        (SELECT count(*)::int FROM "comment_report" WHERE "status" = 'pending') AS "pendingReportsCount",
        (SELECT count(*)::int FROM "comment") AS "commentsCount"
      FROM (
        SELECT
          count(*)::int AS "total",
          count(*) FILTER (WHERE "published" = true)::int AS "published"
        FROM "catalog_episode"
      ) ep
      CROSS JOIN (
        SELECT
          count(u."id")::int AS "totalUsers",
          count(*) FILTER (WHERE COALESCE(p."role", 'user') = 'admin')::int AS "totalAdmins"
        FROM "user" u
        LEFT JOIN "profile" p ON p."userId" = u."id"
      ) usr;
    `),
    listActiveBansMap(sql),
    sql.query<{ key: string; value: string }>(
      `SELECT "key", "value" FROM "admin_settings" WHERE "key" = ANY($1::text[]);`,
      [[...MAINTENANCE_STATUS_KEYS]],
    ),
  ]);

  const counts = countsRows[0];
  let maintenanceMode = false;
  let maintenanceAllowAdminBypass = true;
  let maintenanceMessage = "";

  for (const row of maintenanceRows ?? []) {
    const parsed = parseSettingJson(row.value);
    if (row.key === "maintenance_mode") {
      maintenanceMode = Boolean(parsed);
    } else if (row.key === "maintenance_allow_admin_bypass") {
      maintenanceAllowAdminBypass = parsed !== false;
    } else if (row.key === "maintenance_message" && typeof parsed === "string") {
      maintenanceMessage = parsed;
    }
  }

  return {
    connected: true,
    dbSource,
    checkedAt: Date.now(),
    serverAnimesCount: Number(counts?.animesCount || 0),
    serverEpisodesCount: Number(counts?.episodesCount || 0),
    serverPublishedEpisodesCount: Number(counts?.publishedEpisodesCount || 0),
    serverSeasonsCount: Number(counts?.seasonsCount || 0),
    serverUsersCount: Number(counts?.usersCount || 0),
    serverAdminsCount: Number(counts?.adminsCount || 0),
    serverPendingReportsCount: Number(counts?.pendingReportsCount || 0),
    serverCommentsCount: Number(counts?.commentsCount || 0),
    serverActiveBansCount: activeBansMap.size,
    maintenanceMode,
    maintenanceAllowAdminBypass,
    maintenanceMessage,
    error: null,
  };
}

let inFlightSystemStatus: Promise<AdminSystemStatus> | null = null;

/**
 * Server Function GET para checagem do sistema administrativo no Hikari Studio.
 * Retorna dados estritamente reais do PostgreSQL, sem simulações ou números fictícios.
 */
export const getAdminSystemStatus = createServerFn({
  method: "GET",
})
  .middleware([adminMiddleware])
  .handler(async (): Promise<AdminSystemStatus> => {
    if (inFlightSystemStatus) {
      return inFlightSystemStatus;
    }

    const { getSql, dbSource } = await import("@/lib/db");

    let flightPromise: Promise<AdminSystemStatus> | null = null;
    const promise = (async (): Promise<AdminSystemStatus> => {
      try {
        const sql = await getSql();
        return await fetchAdminSystemStatusFromDb(sql, dbSource);
      } catch (err: unknown) {
        return {
          connected: false,
          dbSource: dbSource || "unknown",
          checkedAt: Date.now(),
          error: err instanceof Error ? err.message : String(err),
        };
      } finally {
        if (inFlightSystemStatus === flightPromise) {
          inFlightSystemStatus = null;
        }
      }
    })();

    flightPromise = promise;
    inFlightSystemStatus = promise;
    return promise;
  });

export interface AdminCatalogSyncMetaItem {
  id: string;
  anilistId: number | null;
  malId: number | null;
  kitsuId: number | null;
  cover: string | null;
  banner: string | null;
  title: string;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  hidden: boolean;
  updatedAt: number;
}

export const adminCatalogSyncMetaInputSchema = z
  .object({
    sinceUpdatedAt: z.number().nonnegative().optional(),
    limit: z.number().int().min(1).max(2000).optional(),
    includeBadges: z.boolean().optional(),
    ids: z.array(z.string().min(1)).max(1000).optional(),
    anilistIds: z.array(z.number().int().positive()).max(1000).optional(),
    malIds: z.array(z.number().int().positive()).max(1000).optional(),
    kitsuIds: z.array(z.number().int().positive()).max(1000).optional(),
  })
  .optional();

export type AdminCatalogSyncMetaInput = z.infer<
  typeof adminCatalogSyncMetaInputSchema
>;

export async function fetchAdminCatalogSyncMetaFromDb(
  sql: Sql,
  input?: AdminCatalogSyncMetaInput,
): Promise<AdminCatalogSyncMetaItem[]> {
  const { stripCatalogImageVersion } = await import("@/lib/image-utils");
  const { toTimestampMs } = await import(
    "@/lib/catalog-server-overlay.server"
  );

  const hasIdsFilter =
    input?.ids !== undefined ||
    input?.anilistIds !== undefined ||
    input?.malIds !== undefined ||
    input?.kitsuIds !== undefined;

  const ids = input?.ids?.filter(Boolean) ?? [];
  const anilistIds = input?.anilistIds?.filter((n) => n > 0) ?? [];
  const malIds = input?.malIds?.filter((n) => n > 0) ?? [];
  const kitsuIds = input?.kitsuIds?.filter((n) => n > 0) ?? [];

  if (
    hasIdsFilter &&
    ids.length === 0 &&
    anilistIds.length === 0 &&
    malIds.length === 0 &&
    kitsuIds.length === 0
  ) {
    return [];
  }

  const conditions: string[] = ['"archived_at" IS NULL'];
  const params: unknown[] = [];

  if (typeof input?.sinceUpdatedAt === "number" && input.sinceUpdatedAt > 0) {
    params.push(input.sinceUpdatedAt);
    conditions.push(`"updatedAt" > to_timestamp($${params.length} / 1000.0)`);
  }

  if (hasIdsFilter) {
    const idBranches: string[] = [];
    if (ids.length > 0) {
      params.push(ids);
      idBranches.push(`"id" = ANY($${params.length}::text[])`);
    }
    if (anilistIds.length > 0) {
      params.push(anilistIds);
      idBranches.push(`"anilistId" = ANY($${params.length}::int[])`);
    }
    if (malIds.length > 0) {
      params.push(malIds);
      idBranches.push(`"malId" = ANY($${params.length}::int[])`);
    }
    if (kitsuIds.length > 0) {
      params.push(kitsuIds);
      idBranches.push(`"kitsuId" = ANY($${params.length}::int[])`);
    }
    if (idBranches.length > 0) {
      conditions.push(`(${idBranches.join(" OR ")})`);
    }
  }

  const limit = Math.min(2000, Math.max(1, input?.limit ?? 500));
  params.push(limit);
  const limitParam = `$${params.length}`;

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await sql.query<{
    id: string;
    anilistId: number | null;
    malId: number | null;
    kitsuId: number | null;
    cover: string | null;
    banner: string | null;
    title: string;
    titleRomaji: string | null;
    titleEnglish: string | null;
    titleNative: string | null;
    hidden: boolean;
    updatedAt: string | Date | null;
  }>(
    `SELECT
       "id", "anilistId", "malId", "kitsuId",
       "cover", "banner", "title", "titleRomaji",
       "titleEnglish", "titleNative", "hidden", "updatedAt"
     FROM "catalog_anime"
     ${whereClause}
     ORDER BY "updatedAt" DESC
     LIMIT ${limitParam};`,
    params,
  );

  if (!rows || rows.length === 0) {
    return [];
  }

  return rows.map((row) => ({
    id: row.id,
    anilistId: row.anilistId ?? null,
    malId: row.malId ?? null,
    kitsuId: row.kitsuId ?? null,
    cover: row.cover ? stripCatalogImageVersion(row.cover) : null,
    banner: row.banner ? stripCatalogImageVersion(row.banner) : null,
    title: row.title,
    titleRomaji: row.titleRomaji ?? null,
    titleEnglish: row.titleEnglish ?? null,
    titleNative: row.titleNative ?? null,
    hidden: Boolean(row.hidden),
    updatedAt: toTimestampMs(row.updatedAt),
  }));
}

/**
 * Retorna metadados essenciais de capa/banner/título salvos no PostgreSQL
 * para manter a listagem do Painel Administrativo alinhada ao site público.
 * Suporta filtro incremental (sinceUpdatedAt), escopo por IDs e limite seguro.
 */
export const getAdminCatalogSyncMeta = createServerFn({
  method: "GET",
})
  .middleware([adminMiddleware])
  .validator((data: unknown) => adminCatalogSyncMetaInputSchema.parse(data))
  .handler(async ({ data }): Promise<AdminCatalogSyncMetaItem[]> => {
    const { getSql } = await import("@/lib/db");

    try {
      const sql = await getSql();
      return await fetchAdminCatalogSyncMetaFromDb(sql, data);
    } catch (err) {
      console.warn(
        "[admin-dashboard] Falha ao carregar metadados do catálogo:",
        err,
      );
      return [];
    }
  });

const adminSearchSchema = z.object({
  q: z.string().optional(),
  genre: z.string().optional(),
  year: z.string().optional(),
  format: z.string().optional(),
  status: z.string().optional(),
  sort: z.string().optional(),
  page: z.number().optional(),
  adult: z.boolean().optional(),
});

const adminDetailIdSchema = z.object({
  id: z.string(),
});

/**
 * Busca administrativa sem filtro de visibilidade pública para permitir
 * consultar, editar e restaurar donghuas ("CN") e os 22 IDs bloqueados.
 */
export const searchAdminCatalog = createServerFn({
  method: "GET",
})
  .middleware([adminMiddleware])
  .validator(adminSearchSchema)
  .handler(async ({ data }) => {
    const { executeSearchCatalog } = await import("@/lib/api");
    return await executeSearchCatalog(data, { allowBlocked: true });
  });

/**
 * Detalhes administrativos sem filtro de visibilidade pública.
 */
export const fetchAdminAnimeDetail = createServerFn({
  method: "GET",
})
  .middleware([adminMiddleware])
  .validator(adminDetailIdSchema)
  .handler(async ({ data }) => {
    const { executeFetchAnimeDetail } = await import("@/lib/api");
    return await executeFetchAnimeDetail(data.id, { allowBlocked: true });
  });
