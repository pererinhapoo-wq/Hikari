import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import { getSql } from "@/lib/db";
import {
  loadAllSettingsFromDb,
  saveSettingsToDb,
  invalidatePublicSettingsCache,
} from "@/lib/settings/settings.server";
import { invalidateCatalogEpisodesCacheAsync } from "@/lib/catalog-episodes";
import { invalidateHomePublicEpisodesCache } from "@/lib/home-episodes";
import { invalidateServerCatalogCachesAsync } from "@/lib/api";

const updateMaintenanceSchema = z.object({
  action: z.literal("update_maintenance"),
  maintenance_mode: z.boolean(),
  maintenance_message: z.string().trim().max(1000).optional(),
  maintenance_allow_admin_bypass: z.boolean().optional(),
});

const clearCacheSchema = z.object({
  action: z.literal("clear_cache"),
  target: z.enum(["episodes", "catalog", "settings", "all"]),
});

const pingDbSchema = z.object({
  action: z.literal("ping_db"),
});

const maintenanceActionSchema = z.discriminatedUnion("action", [
  updateMaintenanceSchema,
  clearCacheSchema,
  pingDbSchema,
]);

export interface MaintenanceTableStat {
  tableName: string;
  rowCount: number;
  status: "ok" | "error";
  error?: string;
  liveTuples?: number;
  deadTuples?: number;
  lastVacuum?: string | null;
  lastAnalyze?: string | null;
}

export const MAINTENANCE_TABLE_NAMES = [
  "catalog_anime",
  "catalog_season",
  "catalog_episode",
  "catalog_airing_schedule",
  "catalog_weekly_recurrence",
  "user",
  "profile",
  "comment",
  "comment_report",
  "admin_settings",
] as const;

type SqlClient = Awaited<ReturnType<typeof getSql>>;

async function collectMaintenanceTableStats(sql: SqlClient): Promise<{
  tables: MaintenanceTableStat[];
  hasTableError: boolean;
}> {
  const selectClauses = MAINTENANCE_TABLE_NAMES.map(
    (name) => `(SELECT COUNT(*)::text FROM "${name}") AS "${name}"`,
  ).join(", ");

  const statMapPromise = sql
    .query<{
      relname: string;
      n_live_tup: string;
      n_dead_tup: string;
      last_vacuum: string | null;
      last_analyze: string | null;
    }>(`
      SELECT
        relname,
        n_live_tup::text,
        n_dead_tup::text,
        COALESCE(last_vacuum, last_autovacuum)::text as last_vacuum,
        COALESCE(last_analyze, last_autoanalyze)::text as last_analyze
      FROM pg_stat_user_tables;
    `)
    .then((statRows) => {
      const map = new Map<
        string,
        { live: number; dead: number; lastVacuum: string | null; lastAnalyze: string | null }
      >();
      for (const r of statRows) {
        map.set(r.relname, {
          live: parseInt(r.n_live_tup || "0", 10),
          dead: parseInt(r.n_dead_tup || "0", 10),
          lastVacuum: r.last_vacuum,
          lastAnalyze: r.last_analyze,
        });
      }
      return map;
    })
    .catch(() => new Map());

  const countsPromise = (async () => {
    try {
      const [combined] = await sql.query<Record<string, string>>(
        `SELECT ${selectClauses};`,
      );
      if (combined) {
        return MAINTENANCE_TABLE_NAMES.map((name) => ({
          name,
          rowCount: parseInt(combined[name] || "0", 10),
          status: "ok" as const,
          error: undefined as string | undefined,
        }));
      }
    } catch (batchErr) {
      console.error("[maintenance] Erro na contagem consolidada de tabelas:", batchErr);
    }

    // Fallback por tabela apenas quando a query consolidada falha para diagnosticar exatamente qual falhou
    return Promise.all(
      MAINTENANCE_TABLE_NAMES.map(async (name) => {
        try {
          const [row] = await sql.query<{ count: string }>(
            `SELECT COUNT(*)::text as count FROM "${name}";`,
          );
          return {
            name,
            rowCount: parseInt(row?.count || "0", 10),
            status: "ok" as const,
            error: undefined as string | undefined,
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Erro ao contar tabela";
          console.error(`[maintenance] Falha na tabela "${name}":`, err);
          return {
            name,
            rowCount: 0,
            status: "error" as const,
            error: errMsg,
          };
        }
      }),
    );
  })();

  const [statMap, countEntries] = await Promise.all([statMapPromise, countsPromise]);

  let hasTableError = false;
  const tables: MaintenanceTableStat[] = countEntries.map((entry) => {
    if (entry.status === "error") {
      hasTableError = true;
    }
    const st = statMap.get(entry.name);
    return {
      tableName: entry.name,
      rowCount: entry.rowCount,
      status: entry.status,
      ...(entry.error ? { error: entry.error } : {}),
      liveTuples: st?.live,
      deadTuples: st?.dead,
      lastVacuum: st?.lastVacuum || null,
      lastAnalyze: st?.lastAnalyze || null,
    };
  });

  return { tables, hasTableError };
}

export async function collectMaintenanceDiagnostics(sql: SqlClient) {
  let pingLatencyMs = 0;
  let dbPingStatus = "online" as "online" | "offline";
  let dbError: string | undefined;

  const pingPromise = (async () => {
    const pingStart = performance.now();
    await sql.query("SELECT 1;");
    pingLatencyMs = Math.round(performance.now() - pingStart);
  })().catch((err) => {
    dbPingStatus = "offline";
    dbError = err instanceof Error ? err.message : "Falha ao executar SELECT 1";
    console.error("[maintenance] Erro no ping do banco:", err);
  });

  const settingsPromise = loadAllSettingsFromDb();

  const sizePromise = sql
    .query<{
      size_bytes: string;
      size_pretty: string;
    }>(`
      SELECT
        pg_database_size(current_database())::text as size_bytes,
        pg_size_pretty(pg_database_size(current_database())) as size_pretty;
    `)
    .then(([sizeRow]) => ({
      dbSizeBytes: sizeRow ? parseInt(sizeRow.size_bytes || "0", 10) : 0,
      dbSizePretty: sizeRow?.size_pretty || "0 MB",
    }))
    .catch((sizeErr) => {
      console.warn("[maintenance] Não foi possível consultar tamanho do banco:", sizeErr);
      return { dbSizeBytes: 0, dbSizePretty: "Indisponível" };
    });

  const tablesPromise = collectMaintenanceTableStats(sql);

  const [, settings, sizeInfo, tableResult] = await Promise.all([
    pingPromise,
    settingsPromise,
    sizePromise,
    tablesPromise,
  ]);

  const status =
    dbPingStatus === "offline"
      ? "offline"
      : tableResult.hasTableError
        ? "degraded"
        : "online";

  if (!dbError && tableResult.hasTableError) {
    const failed = tableResult.tables
      .filter((t) => t.status === "error")
      .map((t) => t.tableName);
    dbError = `Falha ao consultar tabela(s): ${failed.join(", ")}`;
  }

  return {
    maintenance: {
      mode: Boolean(settings.maintenance_mode),
      message: settings.maintenance_message || "",
      allowAdminBypass: settings.maintenance_allow_admin_bypass !== false,
    },
    database: {
      status,
      latencyMs: pingLatencyMs,
      sizeBytes: sizeInfo.dbSizeBytes,
      sizePretty: sizeInfo.dbSizePretty,
      tables: tableResult.tables,
      ...(dbError ? { error: dbError } : {}),
    },
  };
}

export const Route = createFileRoute("/api/admin/maintenance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);

          const sql = await getSql();
          const diagnostics = await collectMaintenanceDiagnostics(sql);

          return Response.json({
            ok: true,
            adminId,
            ...diagnostics,
            serverTime: new Date().toISOString(),
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: err.status });
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[api/admin/maintenance] Erro:", err);
          return Response.json({ error: "Erro interno ao consultar manutenção." }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);

          let rawBody: unknown;
          try {
            rawBody = await request.json();
          } catch {
            return Response.json({ error: "JSON inválido." }, { status: 400 });
          }

          const parsed = maintenanceActionSchema.safeParse(rawBody);
          if (!parsed.success) {
            return Response.json(
              { error: parsed.error.issues[0]?.message || "Ação inválida." },
              { status: 400 },
            );
          }

          const payload = parsed.data;

          if (payload.action === "update_maintenance") {
            const updated = await saveSettingsToDb({
              maintenance_mode: payload.maintenance_mode,
              ...(payload.maintenance_message !== undefined
                ? { maintenance_message: payload.maintenance_message }
                : {}),
              ...(payload.maintenance_allow_admin_bypass !== undefined
                ? { maintenance_allow_admin_bypass: payload.maintenance_allow_admin_bypass }
                : {}),
            });

            return Response.json({
              ok: true,
              adminId,
              message: payload.maintenance_mode
                ? "Modo de manutenção ativado com sucesso!"
                : "Modo de manutenção desativado. Plataforma liberada ao público.",
              settings: updated,
              maintenance: {
                mode: updated.maintenance_mode,
                message: updated.maintenance_message,
                allowAdminBypass: updated.maintenance_allow_admin_bypass,
              },
            });
          }

          if (payload.action === "clear_cache") {
            const cleared: string[] = [];

            if (payload.target === "episodes" || payload.target === "all") {
              await invalidateCatalogEpisodesCacheAsync();
              invalidateHomePublicEpisodesCache();
              cleared.push("Cache de Episódios em Memória");
            }

            if (payload.target === "catalog" || payload.target === "all") {
              await invalidateServerCatalogCachesAsync();
              cleared.push("Cache de Catálogo de Animes");
            }

            if (payload.target === "settings" || payload.target === "all") {
              invalidatePublicSettingsCache();
              cleared.push("Cache de Configurações Públicas");
            }

            return Response.json({
              ok: true,
              adminId,
              target: payload.target,
              cleared,
              message: `Caches limpos com sucesso: ${cleared.join(", ")}.`,
            });
          }

          if (payload.action === "ping_db") {
            const sql = await getSql();
            const start = performance.now();
            await sql.query("SELECT 1;");
            const latencyMs = Math.round(performance.now() - start);

            return Response.json({
              ok: true,
              latencyMs,
              status: "online",
              timestamp: new Date().toISOString(),
            });
          }

          return Response.json({ error: "Ação não suportada." }, { status: 400 });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: err.status });
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[api/admin/maintenance] Erro de ação:", err);
          return Response.json({ error: "Erro interno ao processar operação." }, { status: 500 });
        }
      },
    },
  },
});
