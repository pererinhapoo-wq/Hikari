import { createFileRoute } from "@tanstack/react-router";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import { getSql } from "@/lib/db";

export interface SystemHealthReport {
  overallStatus: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  database: {
    status: "online" | "degraded" | "offline";
    latencyMs: number;
    version: string;
    databaseName: string;
    serverTime: string;
    sizePretty: string;
  };
  tables: Array<{
    name: string;
    count: number;
    description: string;
  }>;
  externalServices: {
    anilist: {
      status: "online" | "degraded" | "offline";
      latencyMs: number;
      error?: string;
    };
  };
  runtime: {
    nodeVersion: string;
    platform: string;
    arch: string;
    uptimeSeconds: number;
    memoryMb: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    environment: string;
  };
}

export const Route = createFileRoute("/api/admin/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);

          const timestamp = new Date().toISOString();

          // 1. Diagnóstico do Neon PostgreSQL
          const sql = await getSql();
          let dbStatus: "online" | "degraded" | "offline" = "online";
          let dbLatencyMs = 0;
          let dbVersion = "PostgreSQL";
          let dbName = "hikari";
          let dbServerTime = timestamp;
          let dbSizePretty = "Desconhecido";

          try {
            const start = performance.now();
            const [verRow] = await sql.query<{
              version: string;
              db_name: string;
              now_str: string;
            }>(`SELECT version() as version, current_database() as db_name, now()::text as now_str;`);

            dbLatencyMs = Math.round(performance.now() - start);

            if (verRow) {
              dbVersion = verRow.version.split(" on ")[0] || verRow.version;
              dbName = verRow.db_name;
              dbServerTime = verRow.now_str;
            }

            if (dbLatencyMs > 600) {
              dbStatus = "degraded";
            }

            const [sizeRow] = await sql.query<{ size_pretty: string }>(
              `SELECT pg_size_pretty(pg_database_size(current_database())) as size_pretty;`,
            ).catch(() => [{ size_pretty: "N/A" }]);

            if (sizeRow?.size_pretty) {
              dbSizePretty = sizeRow.size_pretty;
            }
          } catch (dbErr) {
            console.error("[health] Erro ao consultar banco de dados:", dbErr);
            dbStatus = "offline";
          }

          // 2. Contagem de Linhas por Tabela
          const tableQueries = [
            { name: "catalog_anime", desc: "Animes e títulos cadastrados" },
            { name: "catalog_season", desc: "Temporadas cadastradas" },
            { name: "catalog_episode", desc: "Episódios e players publicados" },
            { name: "user", desc: "Contas de usuários registradas" },
            { name: "profile", desc: "Perfis públicos e papéis administrativos" },
            { name: "session", desc: "Sessões ativas no Better Auth" },
            { name: "account", desc: "Contas de provedor de autenticação" },
            { name: "comment", desc: "Comentários da comunidade" },
            { name: "comment_reports", desc: "Denúncias enviadas para moderação" },
            { name: "admin_settings", desc: "Configurações persistidas do Hikari" },
          ];

          const tableCounts = await Promise.all(
            tableQueries.map(async (t) => {
              try {
                const [r] = await sql.query<{ count: string }>(
                  `SELECT COUNT(*)::text as count FROM "${t.name}";`,
                );
                return {
                  name: t.name,
                  count: parseInt(r?.count || "0", 10),
                  description: t.desc,
                };
              } catch {
                return {
                  name: t.name,
                  count: 0,
                  description: t.desc,
                };
              }
            }),
          );

          // 3. Teste de conectividade com serviço externo (AniList GraphQL API)
          let anilistStatus: "online" | "degraded" | "offline" = "offline";
          let anilistLatencyMs = 0;
          let anilistError: string | undefined;

          try {
            const aniStart = performance.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const aniRes = await fetch("https://graphql.anilist.co", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                query: "{ Page(page: 1, perPage: 1) { pageInfo { total } } }",
              }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            anilistLatencyMs = Math.round(performance.now() - aniStart);

            if (aniRes.ok) {
              anilistStatus = anilistLatencyMs > 1200 ? "degraded" : "online";
            } else {
              anilistStatus = "degraded";
              anilistError = `HTTP ${aniRes.status}`;
            }
          } catch (aniErr) {
            anilistStatus = "offline";
            anilistError = aniErr instanceof Error ? aniErr.message : "Timeout / Erro de rede";
          }

          // 4. Runtime Node.js
          const mem = process.memoryUsage();
          const runtime = {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            uptimeSeconds: Math.floor(process.uptime()),
            memoryMb: {
              rss: Math.round(mem.rss / 1024 / 1024),
              heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
              heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
              external: Math.round(mem.external / 1024 / 1024),
            },
            environment: process.env.NODE_ENV || "development",
          };

          // 5. Cálculo do Status Geral
          let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
          if (dbStatus === "offline") {
            overallStatus = "unhealthy";
          } else if (dbStatus === "degraded" || anilistStatus === "offline") {
            overallStatus = "degraded";
          }

          const report: SystemHealthReport = {
            overallStatus,
            timestamp,
            database: {
              status: dbStatus,
              latencyMs: dbLatencyMs,
              version: dbVersion,
              databaseName: dbName,
              serverTime: dbServerTime,
              sizePretty: dbSizePretty,
            },
            tables: tableCounts,
            externalServices: {
              anilist: {
                status: anilistStatus,
                latencyMs: anilistLatencyMs,
                error: anilistError,
              },
            },
            runtime,
          };

          return Response.json({
            ok: true,
            report,
            adminId,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: err.status });
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[api/admin/health] Erro:", err);
          return Response.json({ error: "Erro ao gerar diagnóstico do sistema." }, { status: 500 });
        }
      },
    },
  },
});
