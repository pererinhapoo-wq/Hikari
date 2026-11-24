import { dbSource, getSql } from "@/lib/db";
import { pingRedisHealth } from "@/lib/redis";
import type {
  CommandCenterDiagnosticsReport,
  DatabaseDiagnosticProbe,
  DiagnosticStatus,
  RedisDiagnosticProbe,
  RuntimeDiagnosticSnapshot,
} from "@/lib/admin-diagnostics.functions";

export const DB_SLOW_THRESHOLD_MS = 600;
export const REDIS_SLOW_THRESHOLD_MS = 400;
export const DB_PROBE_TIMEOUT_MS = 4000;

export function sanitizeDiagnosticError(
  err: unknown,
  fallbackMessage = "Falha de comunicação com o serviço.",
): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : fallbackMessage;

  if (!raw || !raw.trim()) {
    return fallbackMessage;
  }

  let sanitized = raw;

  const envSecrets = [
    process.env.DATABASE_URL,
    process.env.UPSTASH_REDIS_REST_URL,
    process.env.UPSTASH_REDIS_REST_TOKEN,
    process.env.BETTER_AUTH_SECRET,
  ];
  for (const secret of envSecrets) {
    if (secret && secret.trim().length > 0) {
      sanitized = sanitized.split(secret.trim()).join("[REDACTED]");
    }
  }

  sanitized = sanitized
    .replace(/(postgres(?:ql)?|rediss?|https?):\/\/[^\s"'`]+/gi, "[REDACTED_URL]")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [REDACTED]")
    .replace(
      /\b(token|auth|password|passwd|secret|key|apikey|api_key|connectionstring)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[REDACTED]",
    )
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) {
    return fallbackMessage;
  }

  return sanitized.length > 180 ? `${sanitized.slice(0, 177)}...` : sanitized;
}

export function collectSafeRuntimeSnapshot(): RuntimeDiagnosticSnapshot {
  const mem = process.memoryUsage();
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    uptimeSeconds: Math.max(0, Math.floor(process.uptime())),
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    environment: process.env.NODE_ENV || "development",
  };
}

export async function probeDatabaseHealth(): Promise<DatabaseDiagnosticProbe> {
  const backend = dbSource;
  const backendLabel =
    backend === "neon" ? "Neon PostgreSQL" : "PGlite (Fallback Local)";

  let timerId: ReturnType<typeof setTimeout> | undefined;

  try {
    const sql = await getSql();
    const start = performance.now();

    await Promise.race([
      sql.query<{ ok: number }>("SELECT 1 AS ok;"),
      new Promise<never>((_, reject) => {
        timerId = setTimeout(() => {
          reject(new Error(`Timeout após ${DB_PROBE_TIMEOUT_MS} ms na consulta SELECT 1.`));
        }, DB_PROBE_TIMEOUT_MS);
      }),
    ]);

    const latencyMs = Math.max(0, Math.round(performance.now() - start));

    if (backend === "pglite") {
      return {
        status: "ATENÇÃO",
        backend,
        backendLabel,
        connected: true,
        latencyMs,
        summary: "Fallback local PGlite ativo (Preview)",
        detail: `DATABASE_URL ausente; operando com PGlite local (não é Neon). SELECT 1 em ${latencyMs} ms.`,
      };
    }

    if (latencyMs > DB_SLOW_THRESHOLD_MS) {
      return {
        status: "ATENÇÃO",
        backend,
        backendLabel,
        connected: true,
        latencyMs,
        summary: "Neon PostgreSQL com latência elevada",
        detail: `SELECT 1 respondeu em ${latencyMs} ms (limite nominal: ${DB_SLOW_THRESHOLD_MS} ms).`,
      };
    }

    return {
      status: "SAUDÁVEL",
      backend,
      backendLabel,
      connected: true,
      latencyMs,
      summary: "Neon PostgreSQL operacional",
      detail: `SELECT 1 respondido em ${latencyMs} ms.`,
    };
  } catch (err) {
    return {
      status: "CRÍTICO",
      backend,
      backendLabel,
      connected: false,
      latencyMs: null,
      summary:
        backend === "neon"
          ? "Falha ao conectar ao Neon PostgreSQL"
          : "Falha ao consultar PGlite local",
      detail: sanitizeDiagnosticError(
        err,
        "Não foi possível executar SELECT 1 no banco de dados.",
      ),
    };
  } finally {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
  }
}

export async function probeRedisHealth(): Promise<RedisDiagnosticProbe> {
  try {
    const ping = await pingRedisHealth();

    if (!ping.configured || ping.status === "unconfigured") {
      return {
        status: "INDISPONÍVEL",
        configured: false,
        connected: false,
        latencyMs: null,
        summary: "Upstash Redis não configurado",
        detail:
          "Credenciais do Upstash ausentes neste ambiente; cache operando em modo fail-open.",
      };
    }

    if (!ping.ok) {
      const isTimeout = ping.status === "timeout";
      return {
        status: "CRÍTICO",
        configured: true,
        connected: false,
        latencyMs: ping.latencyMs,
        summary: isTimeout
          ? "Timeout no PING do Upstash Redis"
          : "Falha no PING do Upstash Redis",
        detail: sanitizeDiagnosticError(
          ping.error,
          isTimeout
            ? "Limite de 2500 ms excedido ao verificar o Redis."
            : "Erro ao verificar conectividade com o Upstash Redis.",
        ),
      };
    }

    const latencyMs = ping.latencyMs ?? 0;
    if (latencyMs > REDIS_SLOW_THRESHOLD_MS) {
      return {
        status: "ATENÇÃO",
        configured: true,
        connected: true,
        latencyMs,
        summary: "Upstash Redis com latência elevada",
        detail: `PING respondeu em ${latencyMs} ms (limite nominal: ${REDIS_SLOW_THRESHOLD_MS} ms).`,
      };
    }

    return {
      status: "SAUDÁVEL",
      configured: true,
      connected: true,
      latencyMs,
      summary: "Upstash Redis operacional",
      detail: `PING respondido em ${latencyMs} ms.`,
    };
  } catch (err) {
    return {
      status: "CRÍTICO",
      configured: true,
      connected: false,
      latencyMs: null,
      summary: "Erro inesperado na sonda do Redis",
      detail: sanitizeDiagnosticError(
        err,
        "Não foi possível verificar a conectividade do Upstash Redis.",
      ),
    };
  }
}

function summarizeOverallDiagnostics(
  database: DatabaseDiagnosticProbe,
  redis: RedisDiagnosticProbe,
): {
  overallStatus: DiagnosticStatus;
  overallTitle: string;
  overallMessage: string;
} {
  if (database.status === "CRÍTICO" || redis.status === "CRÍTICO") {
    const failedParts: string[] = [];
    if (database.status === "CRÍTICO") {
      failedParts.push(database.backendLabel);
    }
    if (redis.status === "CRÍTICO") {
      failedParts.push("Upstash Redis");
    }
    return {
      overallStatus: "CRÍTICO",
      overallTitle: "FALHA CRÍTICA DETECTADA",
      overallMessage: `Sonda falhou em ${failedParts.join(" e ")}. Verifique os detalhes dos subsistemas abaixo.`,
    };
  }

  if (database.backend === "pglite" && !redis.configured) {
    return {
      overallStatus: "ATENÇÃO",
      overallTitle: "AMBIENTE LOCAL DE PREVIEW ATIVO",
      overallMessage: `Banco operando em fallback local PGlite (${database.latencyMs ?? 0} ms) e Upstash Redis não configurado neste ambiente. Nenhuma falha de conectividade detectada.`,
    };
  }

  if (database.status === "ATENÇÃO" || redis.status === "ATENÇÃO") {
    const notes: string[] = [];
    if (database.status === "ATENÇÃO") {
      notes.push(database.summary);
    }
    if (redis.status === "ATENÇÃO") {
      notes.push(redis.summary);
    }
    if (redis.status === "INDISPONÍVEL") {
      notes.push("Upstash Redis não configurado neste ambiente");
    }
    return {
      overallStatus: "ATENÇÃO",
      overallTitle: "INFRAESTRUTURA EM ATENÇÃO",
      overallMessage: `${notes.join(" • ")}.`,
    };
  }

  if (database.status === "SAUDÁVEL" && redis.status === "INDISPONÍVEL") {
    return {
      overallStatus: "ATENÇÃO",
      overallTitle: "BANCO SAUDÁVEL • REDIS INDISPONÍVEL",
      overallMessage: `Neon PostgreSQL operacional (${database.latencyMs ?? 0} ms), enquanto o Upstash Redis não está configurado neste ambiente (modo fail-open).`,
    };
  }

  return {
    overallStatus: "SAUDÁVEL",
    overallTitle: "INFRAESTRUTURA PRINCIPAL SAUDÁVEL",
    overallMessage: `Neon PostgreSQL (${database.latencyMs ?? 0} ms) e Upstash Redis (${redis.latencyMs ?? 0} ms) responderam dentro dos limites nominais.`,
  };
}

export async function collectCommandCenterDiagnostics(): Promise<CommandCenterDiagnosticsReport> {
  const startedAt = performance.now();

  const [dbSettled, redisSettled] = await Promise.allSettled([
    probeDatabaseHealth(),
    probeRedisHealth(),
  ]);

  const database: DatabaseDiagnosticProbe =
    dbSettled.status === "fulfilled"
      ? dbSettled.value
      : {
          status: "CRÍTICO",
          backend: dbSource,
          backendLabel:
            dbSource === "neon" ? "Neon PostgreSQL" : "PGlite (Fallback Local)",
          connected: false,
          latencyMs: null,
          summary: "Falha inesperada na sonda do banco",
          detail: sanitizeDiagnosticError(dbSettled.reason),
        };

  const redis: RedisDiagnosticProbe =
    redisSettled.status === "fulfilled"
      ? redisSettled.value
      : {
          status: "CRÍTICO",
          configured: true,
          connected: false,
          latencyMs: null,
          summary: "Falha inesperada na sonda do Redis",
          detail: sanitizeDiagnosticError(redisSettled.reason),
        };

  const runtime = collectSafeRuntimeSnapshot();
  const overall = summarizeOverallDiagnostics(database, redis);
  const probeDurationMs = Math.max(0, Math.round(performance.now() - startedAt));

  return {
    overallStatus: overall.overallStatus,
    overallTitle: overall.overallTitle,
    overallMessage: overall.overallMessage,
    checkedAt: new Date().toISOString(),
    probeDurationMs,
    activeProbesCount: 2,
    totalSubsystemsCount: 4,
    database,
    redis,
    runtime,
  };
}
