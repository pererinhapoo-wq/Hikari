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
import { invalidateCatalogEpisodesCache } from "@/lib/catalog-episodes";
import { invalidateServerCatalogCaches } from "@/lib/api";

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

export const Route = createFileRoute("/api/admin/maintenance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);

          const sql = await getSql();

          // 1. Mede latência do banco de dados (Ping)
          const pingStart = performance.now();
          await sql.query("SELECT 1;");
          const pingLatencyMs = Math.round(performance.now() - pingStart);

          // 2. Carrega configurações atuais de manutenção
          const settings = await loadAllSettingsFromDb();

          // 3. Tamanho do banco de dados
          let dbSizePretty = "Desconhecido";
          let dbSizeBytes = 0;
          try {
            const [sizeRow] = await sql.query<{
              size_bytes: string;
              size_pretty: string;
            }>(`
              SELECT
                pg_database_size(current_database())::text as size_bytes,
                pg_size_pretty(pg_database_size(current_database())) as size_pretty;
            `);
            if (sizeRow) {
              dbSizeBytes = parseInt(sizeRow.size_bytes || "0", 10);
              dbSizePretty = sizeRow.size_pretty || "0 MB";
            }
          } catch (sizeErr) {
            console.warn("[maintenance] Não foi possível consultar tamanho do banco:", sizeErr);
          }

          // 4. Estatísticas de tabelas (Linhas e tuplas ativas/mortas)
          let tableStats: Array<{
            tableName: string;
            rowCount: number;
            liveTuples?: number;
            deadTuples?: number;
            lastVacuum?: string | null;
            lastAnalyze?: string | null;
          }> = [];

          try {
            // Contagem exata de linhas das tabelas principais
            const countsPromise = Promise.all([
              sql.query<{ count: string }>(`SELECT COUNT(*)::text as count FROM "catalog_anime";`).catch(() => [{ count: "0" }]),
              sql.query<{ count: string }>(`SELECT COUNT(*)::text as count FROM "catalog_season";`).catch(() => [{ count: "0" }]),
              sql.query<{ count: string }>(`SELECT COUNT(*)::text as count FROM "catalog_episode";`).catch(() => [{ count: "0" }]),
              sql.query<{ count: string }>(`SELECT COUNT(*)::text as count FROM "user";`).catch(() => [{ count: "0" }]),
              sql.query<{ count: string }>(`SELECT COUNT(*)::text as count FROM "profile";`).catch(() => [{ count: "0" }]),
              sql.query<{ count: string }>(`SELECT COUNT(*)::text as count FROM "comment";`).catch(() => [{ count: "0" }]),
              sql.query<{ count: string }>(`SELECT COUNT(*)::text as count FROM "comment_reports";`).catch(() => [{ count: "0" }]),
              sql.query<{ count: string }>(`SELECT COUNT(*)::text as count FROM "admin_settings";`).catch(() => [{ count: "0" }]),
            ]);

            const [
              [animeCount],
              [seasonCount],
              [episodeCount],
              [userCount],
              [profileCount],
              [commentCount],
              [reportCount],
              [settingsCount],
            ] = await countsPromise;

            // Estatísticas de vacuum / analyze do Postgres
            const statMap = new Map<string, { live: number; dead: number; lastVacuum: string | null; lastAnalyze: string | null }>();
            try {
              const statRows = await sql.query<{
                relname: string;
                n_live_tup: string;
                n_dead_tup: string;
                last_vacuum: string | null;
                last_analyze: string | null;
                last_autovacuum: string | null;
                last_autoanalyze: string | null;
              }>(`
                SELECT
                  relname,
                  n_live_tup::text,
                  n_dead_tup::text,
                  COALESCE(last_vacuum, last_autovacuum)::text as last_vacuum,
                  COALESCE(last_analyze, last_autoanalyze)::text as last_analyze
                FROM pg_stat_user_tables;
              `);

              for (const r of statRows) {
                statMap.set(r.relname, {
                  live: parseInt(r.n_live_tup || "0", 10),
                  dead: parseInt(r.n_dead_tup || "0", 10),
                  lastVacuum: r.last_vacuum,
                  lastAnalyze: r.last_analyze,
                });
              }
            } catch {
              // pg_stat_user_tables pode não estar disponível em todos os tiers
            }

            const formatTable = (name: string, count: string) => {
              const st = statMap.get(name);
              return {
                tableName: name,
                rowCount: parseInt(count, 10),
                liveTuples: st?.live,
                deadTuples: st?.dead,
                lastVacuum: st?.lastVacuum || null,
                lastAnalyze: st?.lastAnalyze || null,
              };
            };

            tableStats = [
              formatTable("catalog_anime", animeCount?.count || "0"),
              formatTable("catalog_season", seasonCount?.count || "0"),
              formatTable("catalog_episode", episodeCount?.count || "0"),
              formatTable("user", userCount?.count || "0"),
              formatTable("profile", profileCount?.count || "0"),
              formatTable("comment", commentCount?.count || "0"),
              formatTable("comment_reports", reportCount?.count || "0"),
              formatTable("admin_settings", settingsCount?.count || "0"),
            ];
          } catch (tabErr) {
            console.warn("[maintenance] Erro ao contabilizar tabelas:", tabErr);
          }

          return Response.json({
            ok: true,
            adminId,
            maintenance: {
              mode: Boolean(settings.maintenance_mode),
              message: settings.maintenance_message || "",
              allowAdminBypass: settings.maintenance_allow_admin_bypass !== false,
            },
            database: {
              status: "online",
              latencyMs: pingLatencyMs,
              sizeBytes: dbSizeBytes,
              sizePretty: dbSizePretty,
              tables: tableStats,
            },
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
              invalidateCatalogEpisodesCache();
              cleared.push("Cache de Episódios em Memória");
            }

            if (payload.target === "catalog" || payload.target === "all") {
              invalidateServerCatalogCaches();
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
