#!/usr/bin/env node

/**
 * Script controlado de backfill de `country_of_origin` na tabela `catalog_anime`.
 *
 * Regras de segurança:
 * - Consulta apenas registros existentes com `"anilistId" IS NOT NULL AND "anilistId" > 0`.
 * - Por padrão processa somente registros com `"country_of_origin" IS NULL` (ou `--all` para revalidar).
 * - Atualiza exclusivamente quando o AniList retorna uma string ISO válida (ex.: "JP", "CN", "TW", "HK", "KR").
 * - NUNCA atribui "JP" como valor padrão quando o AniList não confirma a origem.
 * - NUNCA sobrescreve uma origem já confirmada com NULL por falha de requisição ou resposta ausente.
 * - Agrupa múltiplos `anilistId` em aliases GraphQL por lote (`a0: Media(id: ...) ...`) para respeitar rate-limit.
 * - Trata HTTP 429 (`Retry-After`) e falhas parciais por item/lote sem interromper o processo.
 * - NÃO deve ser executado contra o banco de produção automaticamente durante builds/deploys.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node scripts/backfill-country-of-origin.mjs [--dry-run] [--batch-size=25] [--delay-ms=900] [--limit=500] [--all]
 */

import { pathToFileURL } from "node:url";
import pg from "pg";

const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co";
export const DEFAULT_BATCH_SIZE = 25;
export const DEFAULT_DELAY_MS = 900;
export const MAX_BATCH_RETRIES = 4;

export function normalizeCountryOfOrigin(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return null;
  if (!/^[A-Z]{2,3}$/.test(trimmed)) return null;
  return trimmed;
}

export function buildAniListOriginBatchQuery(anilistIds) {
  const uniqueIds = Array.from(
    new Set(
      (Array.isArray(anilistIds) ? anilistIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );

  if (uniqueIds.length === 0) return null;

  const selections = uniqueIds.map(
    (id, index) => `  a${index}: Media(id: ${id}, type: ANIME) { id countryOfOrigin }`,
  );
  return {
    ids: uniqueIds,
    query: `query BackfillCountryOfOrigin {\n${selections.join("\n")}\n}`,
  };
}

function parseRetryAfterMs(headers, fallbackMs) {
  const rawHeader =
    typeof headers?.get === "function"
      ? headers.get("retry-after")
      : headers?.["retry-after"];
  if (rawHeader !== undefined && rawHeader !== null && String(rawHeader).trim() !== "") {
    const seconds = Number(String(rawHeader).trim());
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds * 1000);
    }
  }
  return fallbackMs;
}

function defaultSleep(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchAniListOriginBatch(
  anilistIds,
  {
    fetchFn = globalThis.fetch,
    sleepFn = defaultSleep,
    maxRetries = MAX_BATCH_RETRIES,
    baseRetryMs = 1500,
    timeoutMs = 12000,
  } = {},
) {
  const built = buildAniListOriginBatchQuery(anilistIds);
  if (!built) {
    return { origins: new Map(), error: null, rateLimitedCount: 0 };
  }

  let rateLimitedCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchFn(ANILIST_GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "Hikari/1.0 (country_of_origin backfill)",
        },
        body: JSON.stringify({ query: built.query }),
        signal:
          typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
            ? AbortSignal.timeout(timeoutMs)
            : undefined,
      });

      if (response.status === 429) {
        rateLimitedCount += 1;
        if (attempt < maxRetries) {
          const waitMs = parseRetryAfterMs(
            response.headers,
            baseRetryMs * Math.pow(2, attempt),
          );
          await sleepFn(waitMs);
          continue;
        }
        return {
          origins: new Map(),
          error: `HTTP 429 após ${maxRetries + 1} tentativas`,
          rateLimitedCount,
        };
      }

      if (!response.ok && response.status >= 500 && attempt < maxRetries) {
        await sleepFn(baseRetryMs * Math.pow(2, attempt));
        continue;
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch (jsonErr) {
        if (attempt < maxRetries) {
          await sleepFn(baseRetryMs * Math.pow(2, attempt));
          continue;
        }
        return {
          origins: new Map(),
          error: `Resposta JSON inválida do AniList: ${jsonErr?.message || jsonErr}`,
          rateLimitedCount,
        };
      }

      const origins = new Map();
      const dataObj = payload && typeof payload === "object" ? payload.data : null;
      if (dataObj && typeof dataObj === "object") {
        for (let i = 0; i < built.ids.length; i++) {
          const entry = dataObj[`a${i}`];
          if (!entry || typeof entry !== "object") continue;
          const mediaId = Number(entry.id);
          const normalized = normalizeCountryOfOrigin(entry.countryOfOrigin);
          if (Number.isInteger(mediaId) && mediaId > 0 && normalized) {
            origins.set(mediaId, normalized);
          }
        }
      }

      // Mesmo que existam erros parciais (ex.: um ID removido do AniList), preservamos
      // todas as origens confirmadas retornadas no lote.
      if (!response.ok && origins.size === 0) {
        return {
          origins,
          error: `HTTP ${response.status} do AniList`,
          rateLimitedCount,
        };
      }

      return { origins, error: null, rateLimitedCount };
    } catch (err) {
      if (attempt < maxRetries) {
        await sleepFn(baseRetryMs * Math.pow(2, attempt));
        continue;
      }
      return {
        origins: new Map(),
        error: err?.message || String(err),
        rateLimitedCount,
      };
    }
  }

  return { origins: new Map(), error: "Esgotadas tentativas no AniList", rateLimitedCount };
}

/**
 * Executa o backfill controlado usando um `client` ou pool PostgreSQL compatível.
 * Mantém NULL para itens não confirmados e NUNCA sobrescreve origem confirmada com NULL.
 */
export async function runCountryOfOriginBackfill({
  client,
  dryRun = false,
  includeConfirmed = false,
  batchSize = DEFAULT_BATCH_SIZE,
  delayMs = DEFAULT_DELAY_MS,
  limit = null,
  fetchFn = globalThis.fetch,
  sleepFn = defaultSleep,
  maxRetries = MAX_BATCH_RETRIES,
  baseRetryMs = 1500,
  logger = console,
}) {
  if (!client || typeof client.query !== "function") {
    throw new Error("Client SQL válido é obrigatório para o backfill.");
  }

  const safeBatchSize = Math.max(1, Math.min(50, Math.floor(Number(batchSize) || DEFAULT_BATCH_SIZE)));
  const parsedDelay = Number(delayMs);
  const safeDelayMs = Math.max(
    0,
    Math.floor(Number.isFinite(parsedDelay) ? parsedDelay : DEFAULT_DELAY_MS),
  );
  const safeLimit =
    limit !== null && limit !== undefined && Number(limit) > 0
      ? Math.floor(Number(limit))
      : null;

  const whereParts = [`"anilistId" IS NOT NULL`, `"anilistId" > 0`];
  if (!includeConfirmed) {
    whereParts.push(`("country_of_origin" IS NULL OR btrim("country_of_origin") = '')`);
  }

  const params = [];
  let limitSql = "";
  if (safeLimit !== null) {
    params.push(safeLimit);
    limitSql = `LIMIT $${params.length}`;
  }

  const rowsRes = await client.query(
    `SELECT "id", "anilistId", "country_of_origin" AS "countryOfOrigin"
     FROM "catalog_anime"
     WHERE ${whereParts.join(" AND ")}
     ORDER BY "updatedAt" DESC NULLS LAST, "id" ASC
     ${limitSql};`,
    params,
  );

  const candidates = (rowsRes.rows || []).filter(
    (r) => typeof r.anilistId === "number" && r.anilistId > 0,
  );

  const summary = {
    totalCandidates: candidates.length,
    batchesProcessed: 0,
    batchesFailed: 0,
    rateLimitedCount: 0,
    confirmedCount: 0,
    updatedCount: 0,
    skippedNullCount: 0,
    preservedExistingCount: 0,
    dryRun: Boolean(dryRun),
    errors: [],
  };

  if (candidates.length === 0) {
    return summary;
  }

  const uniqueAnilistIds = Array.from(new Set(candidates.map((r) => r.anilistId)));

  for (let offset = 0; offset < uniqueAnilistIds.length; offset += safeBatchSize) {
    const batchIds = uniqueAnilistIds.slice(offset, offset + safeBatchSize);
    if (offset > 0 && safeDelayMs > 0) {
      await sleepFn(safeDelayMs);
    }

    const batchRes = await fetchAniListOriginBatch(batchIds, {
      fetchFn,
      sleepFn,
      maxRetries,
      baseRetryMs,
    });

    summary.batchesProcessed += 1;
    summary.rateLimitedCount += batchRes.rateLimitedCount;

    if (batchRes.error) {
      summary.batchesFailed += 1;
      summary.errors.push(batchRes.error);
      logger?.warn?.(
        `[backfill-country-of-origin] Lote ${summary.batchesProcessed} falhou sem interromper: ${batchRes.error}`,
      );
      continue;
    }

    for (const aniId of batchIds) {
      const origin = batchRes.origins.get(aniId) ?? null;
      const matchingRows = candidates.filter((c) => c.anilistId === aniId);

      if (!origin) {
        summary.skippedNullCount += matchingRows.length;
        for (const row of matchingRows) {
          if (normalizeCountryOfOrigin(row.countryOfOrigin)) {
            summary.preservedExistingCount += 1;
          }
        }
        continue;
      }

      summary.confirmedCount += matchingRows.length;

      if (dryRun) {
        continue;
      }

      // Atualiza exclusivamente quando há valor válido confirmado e nunca sobrescreve com NULL
      const updateRes = await client.query(
        `UPDATE "catalog_anime"
         SET "country_of_origin" = $1,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "anilistId" = $2
           AND ("country_of_origin" IS DISTINCT FROM $1);`,
        [origin, aniId],
      );
      summary.updatedCount +=
        typeof updateRes?.rowCount === "number" ? updateRes.rowCount : 0;
    }
  }

  return summary;
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const readNumArg = (prefix, fallback) => {
    const found = args.find((a) => a.startsWith(prefix));
    if (!found) return fallback;
    const parsed = Number(found.slice(prefix.length));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };

  return {
    dryRun: args.includes("--dry-run"),
    includeConfirmed: args.includes("--all"),
    batchSize: readNumArg("--batch-size=", DEFAULT_BATCH_SIZE),
    delayMs: readNumArg("--delay-ms=", DEFAULT_DELAY_MS),
    limit: readNumArg("--limit=", null),
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "[backfill-country-of-origin] ERRO: DATABASE_URL é obrigatório para executar o backfill.",
    );
    process.exit(1);
  }

  const cli = parseCliArgs(process.argv);
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 1,
  });

  const client = await pool.connect();
  try {
    const summary = await runCountryOfOriginBackfill({
      client,
      dryRun: cli.dryRun,
      includeConfirmed: cli.includeConfirmed,
      batchSize: cli.batchSize,
      delayMs: cli.delayMs,
      limit: cli.limit,
    });
    console.log("[backfill-country-of-origin] Concluído:", JSON.stringify(summary, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

const isDirectRun =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((err) => {
    console.error(
      "[backfill-country-of-origin] Falha fatal:",
      err?.message || err,
    );
    process.exit(1);
  });
}
