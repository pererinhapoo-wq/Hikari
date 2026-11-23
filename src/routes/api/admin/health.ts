import { createFileRoute } from "@tanstack/react-router";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import { getSql } from "@/lib/db";

export type HealthCheckScope = "all" | "core" | "external";

export interface SystemHealthReport {
  overallStatus: "healthy" | "degraded" | "unhealthy";
  coreStatus: "healthy" | "degraded" | "unhealthy";
  scope: HealthCheckScope;
  timestamp: string;
  database: {
    status: "online" | "degraded" | "offline";
    latencyMs: number;
    version: string;
    databaseName: string;
    serverTime: string;
    sizePretty: string;
    error?: string;
  };
  tables: Array<{
    name: string;
    count: number;
    description: string;
    status: "ok" | "error";
    error?: string;
  }>;
  externalServices: {
    anilist: {
      status: "online" | "degraded" | "offline" | "skipped";
      latencyMs: number;
      error?: string;
      checked: boolean;
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

export const HEALTH_TABLE_DEFINITIONS = [
  { name: "catalog_anime", desc: "Animes e títulos cadastrados" },
  { name: "catalog_season", desc: "Temporadas cadastradas" },
  { name: "catalog_episode", desc: "Episódios e players publicados" },
  { name: "user", desc: "Contas de usuários registradas" },
  { name: "profile", desc: "Perfis públicos e papéis administrativos" },
  { name: "session", desc: "Sessões ativas no Better Auth" },
  { name: "account", desc: "Contas de provedor de autenticação" },
  { name: "comment", desc: "Comentários da comunidade" },
  { name: "comment_report", desc: "Denúncias enviadas para moderação" },
  { name: "admin_settings", desc: "Configurações persistidas do Hikari" },
] as const;

type SqlClient = Awaited<ReturnType<typeof getSql>>;

export function collectRuntimeSnapshot(): SystemHealthReport["runtime"] {
  const mem = process.memoryUsage();
  return {
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
}

export async function collectTableCountsWithDiagnostics(
  sql: SqlClient,
): Promise<SystemHealthReport["tables"]> {
  const selectClauses = HEALTH_TABLE_DEFINITIONS.map(
    (t) => `(SELECT COUNT(*)::text FROM "${t.name}") AS "${t.name}"`,
  ).join(", ");

  try {
    const [combinedRow] = await sql.query<Record<string, string>>(
      `SELECT ${selectClauses};`,
    );

    if (combinedRow) {
      return HEALTH_TABLE_DEFINITIONS.map((t) => ({
        name: t.name,
        count: parseInt(combinedRow[t.name] || "0", 10),
        description: t.desc,
        status: "ok",
      }));
    }
  } catch (batchErr) {
    console.error("[health] Erro na contagem consolidada de tabelas:", batchErr);
  }

  // Fallback por tabela apenas em caso de erro na query consolidada para isolar qual tabela falhou
  return Promise.all(
    HEALTH_TABLE_DEFINITIONS.map(async (t) => {
      try {
        const [r] = await sql.query<{ count: string }>(
          `SELECT COUNT(*)::text as count FROM "${t.name}";`,
        );
        return {
          name: t.name,
          count: parseInt(r?.count || "0", 10),
          description: t.desc,
          status: "ok" as const,
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Falha ao consultar tabela";
        console.error(`[health] Falha ao contar registros da tabela "${t.name}":`, err);
        return {
          name: t.name,
          count: 0,
          description: t.desc,
          status: "error" as const,
          error: errMsg,
        };
      }
    }),
  );
}

export async function collectCoreHealthDiagnostics(sql: SqlClient): Promise<{
  coreStatus: SystemHealthReport["coreStatus"];
  database: SystemHealthReport["database"];
  tables: SystemHealthReport["tables"];
}> {
  const timestamp = new Date().toISOString();
  let dbStatus = "online" as "online" | "degraded" | "offline";
  let dbLatencyMs = 0;
  let dbVersion = "PostgreSQL";
  let dbName = "hikari";
  let dbServerTime = timestamp;
  let dbSizePretty = "Desconhecido";
  let dbError: string | undefined;

  const dbCheckPromise = (async () => {
    const start = performance.now();
    const [verRow] = await sql.query<{
      version: string;
      db_name: string;
      now_str: string;
    }>(
      `SELECT version() as version, current_database() as db_name, now()::text as now_str;`,
    );
    dbLatencyMs = Math.round(performance.now() - start);
    if (verRow) {
      dbVersion = verRow.version.split(" on ")[0] || verRow.version;
      dbName = verRow.db_name;
      dbServerTime = verRow.now_str;
    }
    if (dbLatencyMs > 600) {
      dbStatus = "degraded";
    }
  })().catch((err) => {
    console.error("[health] Erro ao consultar banco de dados:", err);
    dbStatus = "offline";
    dbError = err instanceof Error ? err.message : "Erro ao consultar banco de dados";
  });

  const dbSizePromise = sql
    .query<{ size_pretty: string }>(
      `SELECT pg_size_pretty(pg_database_size(current_database())) as size_pretty;`,
    )
    .then(([sizeRow]) => {
      if (sizeRow?.size_pretty) {
        dbSizePretty = sizeRow.size_pretty;
      }
    })
    .catch((err) => {
      console.warn("[health] Falha ao consultar tamanho do banco:", err);
      dbSizePretty = "Indisponível";
    });

  const tablesPromise = collectTableCountsWithDiagnostics(sql);

  const [, , tables] = await Promise.all([dbCheckPromise, dbSizePromise, tablesPromise]);
  const failedTables = tables.filter((t) => t.status === "error");

  let coreStatus: SystemHealthReport["coreStatus"] = "healthy";
  if (dbStatus === "offline") {
    coreStatus = "unhealthy";
  } else if (dbStatus === "degraded" || failedTables.length > 0) {
    coreStatus = "degraded";
    if (dbStatus === "online" && failedTables.length > 0) {
      dbError = `${failedTables.length} tabela(s) falharam na verificação: ${failedTables.map((t) => t.name).join(", ")}`;
    }
  }

  return {
    coreStatus,
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
      version: dbVersion,
      databaseName: dbName,
      serverTime: dbServerTime,
      sizePretty: dbSizePretty,
      ...(dbError ? { error: dbError } : {}),
    },
    tables,
  };
}

export async function checkAniListHealth(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 4000,
): Promise<SystemHealthReport["externalServices"]["anilist"]> {
  const aniStart = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const aniRes = await fetchImpl("https://graphql.anilist.co", {
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

    const latencyMs = Math.round(performance.now() - aniStart);

    if (aniRes.ok) {
      return {
        status: latencyMs > 1200 ? "degraded" : "online",
        latencyMs,
        checked: true,
      };
    }

    return {
      status: "degraded",
      latencyMs,
      error: `HTTP ${aniRes.status}`,
      checked: true,
    };
  } catch (aniErr) {
    const latencyMs = Math.round(performance.now() - aniStart);
    const isTimeout =
      (aniErr instanceof DOMException && aniErr.name === "AbortError") ||
      (aniErr instanceof Error && aniErr.name === "AbortError");
    const errMsg = isTimeout
      ? `Timeout após ${timeoutMs}ms`
      : aniErr instanceof Error
        ? aniErr.message
        : "Erro de rede ao consultar AniList";
    console.warn("[health] Falha na verificação externa AniList:", errMsg);
    return {
      status: "offline",
      latencyMs,
      error: errMsg,
      checked: true,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function computeOverallHealthStatus(
  coreStatus: SystemHealthReport["coreStatus"],
  anilist: SystemHealthReport["externalServices"]["anilist"],
): SystemHealthReport["overallStatus"] {
  if (coreStatus === "unhealthy") return "unhealthy";
  if (coreStatus === "degraded") return "degraded";
  if (anilist.checked && (anilist.status === "offline" || anilist.status === "degraded")) {
    return "degraded";
  }
  return "healthy";
}

export const Route = createFileRoute("/api/admin/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);

          const url = new URL(request.url);
          const rawScope = url.searchParams.get("scope");
          const scope: HealthCheckScope =
            rawScope === "core" || rawScope === "external" ? rawScope : "all";

          const timestamp = new Date().toISOString();
          const runtime = collectRuntimeSnapshot();

          if (scope === "external") {
            const anilist = await checkAniListHealth();
            return Response.json({
              ok: true,
              scope,
              timestamp,
              anilist,
              runtime,
              adminId,
            });
          }

          const sql = await getSql();

          if (scope === "core") {
            const core = await collectCoreHealthDiagnostics(sql);
            const anilist: SystemHealthReport["externalServices"]["anilist"] = {
              status: "skipped",
              latencyMs: 0,
              checked: false,
            };
            const report: SystemHealthReport = {
              overallStatus: core.coreStatus,
              coreStatus: core.coreStatus,
              scope,
              timestamp,
              database: core.database,
              tables: core.tables,
              externalServices: { anilist },
              runtime,
            };

            return Response.json({
              ok: true,
              report,
              adminId,
            });
          }

          // scope === "all": executa núcleo do banco e sonda externa em paralelo
          const [core, anilist] = await Promise.all([
            collectCoreHealthDiagnostics(sql),
            checkAniListHealth(),
          ]);

          const overallStatus = computeOverallHealthStatus(core.coreStatus, anilist);
          const report: SystemHealthReport = {
            overallStatus,
            coreStatus: core.coreStatus,
            scope,
            timestamp,
            database: core.database,
            tables: core.tables,
            externalServices: { anilist },
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
