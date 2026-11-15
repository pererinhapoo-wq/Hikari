import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "@/lib/auth/middleware";

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
  maintenanceMode?: boolean;
  maintenanceAllowAdminBypass?: boolean;
  maintenanceMessage?: string;
  error?: string | null;
}

/**
 * Server Function GET para checagem do sistema administrativo no Hikari Studio.
 * Retorna dados estritamente reais do PostgreSQL, sem simulações ou números fictícios.
 */
export const getAdminSystemStatus = createServerFn({
  method: "GET",
})
  .middleware([adminMiddleware])
  .handler(async (): Promise<AdminSystemStatus> => {
    const { getSql, dbSource } = await import("@/lib/db");
    const { loadAllSettingsFromDb } = await import(
      "@/lib/settings/settings.server"
    );

    try {
      const sql = await getSql();

      // 1. Testa conectividade real com SELECT 1
      const ping = await sql.query<{ ok: number }>("SELECT 1 as ok");
      if (!ping || ping.length === 0 || ping[0].ok !== 1) {
        return {
          connected: false,
          dbSource,
          checkedAt: Date.now(),
          error: "Resposta inesperada do banco de dados.",
        };
      }

      // 2. Consulta contagens reais das tabelas do sistema no PostgreSQL
      let serverAnimesCount = 0;
      let serverEpisodesCount = 0;
      let serverPublishedEpisodesCount = 0;
      let serverSeasonsCount = 0;
      let serverUsersCount = 0;
      let serverAdminsCount = 0;
      let serverPendingReportsCount = 0;
      let maintenanceMode = false;
      let maintenanceAllowAdminBypass = true;
      let maintenanceMessage = "";

      const [
        animesResult,
        episodesResult,
        seasonsResult,
        usersResult,
        reportsResult,
        settingsResult,
      ] = await Promise.allSettled([
        sql.query<{ count: number }>(
          'SELECT count(*)::int as count FROM "catalog_anime";',
        ),
        sql.query<{ count: number; published_count: number }>(
          `SELECT
             count(*)::int as count,
             count(case when "published" = true then 1 end)::int as published_count
           FROM "catalog_episode";`,
        ),
        sql.query<{ count: number }>(
          'SELECT count(*)::int as count FROM "catalog_season";',
        ),
        sql.query<{ total_users: number; total_admins: number }>(
          `SELECT
             count(u."id")::int as total_users,
             count(case when COALESCE(p."role", 'user') = 'admin' then 1 end)::int as total_admins
           FROM "user" u
           LEFT JOIN "profile" p ON p."userId" = u."id";`,
        ),
        sql.query<{ count: number }>(
          `SELECT count(*)::int as count FROM "comment_report" WHERE "status" = 'pending';`,
        ),
        loadAllSettingsFromDb(),
      ]);

      if (animesResult.status === "fulfilled") {
        serverAnimesCount = Number(animesResult.value[0]?.count || 0);
      }
      if (episodesResult.status === "fulfilled") {
        serverEpisodesCount = Number(episodesResult.value[0]?.count || 0);
        serverPublishedEpisodesCount = Number(
          episodesResult.value[0]?.published_count || 0,
        );
      }
      if (seasonsResult.status === "fulfilled") {
        serverSeasonsCount = Number(seasonsResult.value[0]?.count || 0);
      }
      if (usersResult.status === "fulfilled") {
        serverUsersCount = Number(usersResult.value[0]?.total_users || 0);
        serverAdminsCount = Number(usersResult.value[0]?.total_admins || 0);
      }
      if (reportsResult.status === "fulfilled") {
        serverPendingReportsCount = Number(reportsResult.value[0]?.count || 0);
      }
      if (settingsResult.status === "fulfilled") {
        maintenanceMode = Boolean(settingsResult.value.maintenance_mode);
        maintenanceAllowAdminBypass =
          settingsResult.value.maintenance_allow_admin_bypass !== false;
        maintenanceMessage = settingsResult.value.maintenance_message || "";
      }

      return {
        connected: true,
        dbSource,
        checkedAt: Date.now(),
        serverAnimesCount,
        serverEpisodesCount,
        serverPublishedEpisodesCount,
        serverSeasonsCount,
        serverUsersCount,
        serverAdminsCount,
        serverPendingReportsCount,
        maintenanceMode,
        maintenanceAllowAdminBypass,
        maintenanceMessage,
        error: null,
      };
    } catch (err: unknown) {
      return {
        connected: false,
        dbSource: dbSource || "unknown",
        checkedAt: Date.now(),
        error: err instanceof Error ? err.message : String(err),
      };
    }
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

/**
 * Retorna metadados essenciais de capa/banner/título salvos no PostgreSQL
 * para manter a listagem do Painel Administrativo alinhada ao site público.
 */
export const getAdminCatalogSyncMeta = createServerFn({
  method: "GET",
})
  .middleware([adminMiddleware])
  .handler(async (): Promise<AdminCatalogSyncMetaItem[]> => {
    const { getSql } = await import("@/lib/db");
    const { stripCatalogImageVersion } = await import("@/lib/image-utils");
    const { toTimestampMs } = await import(
      "@/lib/catalog-server-overlay.server"
    );

    try {
      const sql = await getSql();
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
         ORDER BY "updatedAt" DESC;`,
      );

      return (rows ?? []).map((row) => ({
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
    } catch (err) {
      console.warn("[admin-dashboard] Falha ao carregar metadados do catálogo:", err);
      return [];
    }
  });

