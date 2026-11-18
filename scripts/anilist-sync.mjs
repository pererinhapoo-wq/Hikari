#!/usr/bin/env node

/**
 * Script de Sincronização Periódica da AniList — HIKARI
 *
 * Sincroniza dados da AniList (carga inicial completa com checkpoints retomáveis,
 * varredura incremental por UPDATED_AT_DESC com janela de sobreposição, rankings de
 * popularidade/trending/score, temporadas por estação/ano e calendário semanal
 * completo) salvando no Neon PostgreSQL e invalidando caches no Upstash Redis
 * com SCAN não-bloqueante e contadores atômicos de geração.
 *
 * Requisitos operacionais importantes:
 *  - Neon Advisory Lock (849201): No GitHub Actions, secrets.DATABASE_URL deve usar
 *    o endpoint DIRETO (non-pooled) do Neon para garantir que pg_try_advisory_lock
 *    e pg_advisory_unlock permaneçam na mesma sessão PostgreSQL do PoolClient.
 *  - Frequência em cron: O workflow do GitHub Actions roda sem '--manual'; este script
 *    lê 'anilist_sync_frequency' ('1_per_week' ou '2_per_week') em admin_settings e
 *    valida getUTCDay() (1 = Segunda, 4 = Quinta). Execuções via workflow_dispatch
 *    (GITHUB_EVENT_NAME === 'workflow_dispatch') ou '--manual' ignoram a trava de dia.
 *  - Modo '--test': Execução estritamente dry-run / somente leitura no banco e no Redis,
 *    com limite global de itens e teto rígido de requisições à AniList.
 *
 * Uso:
 *   node scripts/anilist-sync.mjs [--test] [--limit=N] [--frequency=1_per_week|2_per_week] [--manual]
 */

import { pathToFileURL } from "node:url";
import pg from "pg";
import { Redis } from "@upstash/redis";

export const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co";
export const RATE_LIMIT_DELAY_MS = 650;
export const ADVISORY_LOCK_ID = 849201;
export const MAX_TEST_LIMIT = 20;
export const MAX_TEST_REQUESTS = 3;
export const INCREMENTAL_OVERLAP_SECONDS = 86400; // 24h de segurança

export const INITIAL_STAGES = [
  "trending",
  "popular",
  "top",
  "recent",
  "seasons",
  "schedule",
];

export const INCREMENTAL_STAGES = [
  "incremental",
  "trending_refresh",
  "popular_refresh",
  "seasons",
  "schedule",
];

async function delay(ms) {
  if (!ms || ms <= 0) return;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Converte valores armazenados em admin_settings (que podem estar em JSON stringificado
 * pelo painel admin, ex.: '"2_per_week"', ou em texto plano, ex.: '2_per_week').
 */
export function parseAdminSettingValue(rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  if (typeof rawValue !== "string") return rawValue;
  const trimmed = rawValue.trim();
  if (!trimmed) return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function normalizeSyncFrequency(rawValue) {
  const parsed = parseAdminSettingValue(rawValue);
  if (parsed === "2_per_week") return "2_per_week";
  return "1_per_week";
}

export function isCronAllowedForFrequency(frequency, date = new Date()) {
  const dayOfWeekUTC = date.getUTCDay(); // 0=Dom, 1=Seg, 4=Qui
  if (frequency === "2_per_week") {
    return dayOfWeekUTC === 1 || dayOfWeekUTC === 4;
  }
  return dayOfWeekUTC === 1;
}

export function computeTitleNorm(title) {
  return String(title || "").trim().toLowerCase();
}

export function computeSearchBlob(title, titleRomaji, titleEnglish, titleNative) {
  return [title, titleRomaji, titleEnglish, titleNative]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isValidImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("blob:")) return false;
  if (lower.startsWith("data:") && trimmed.length > 2048) return false;
  return true;
}

export function isRemoteDefaultCdn(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return (
      host === "s4.anilist.co" ||
      host.endsWith(".anilist.co") ||
      host === "cdn.myanimelist.net" ||
      host.endsWith(".myanimelist.net") ||
      host === "media.kitsu.app" ||
      host.endsWith(".kitsu.app") ||
      host === "media.kitsu.io" ||
      host.endsWith(".kitsu.io")
    );
  } catch {
    return false;
  }
}

/**
 * Alinhado a src/lib/types.ts:
 * - Qualquer URL válida fora dos CDNs padrão (AniList/MAL/Kitsu) é considerada personalizada.
 * - Quando remoteDefaultUrl é informado e diferente do URL do CDN padrão salvo, também preserva
 *   se remoteDefaultUrl for diferente (quando explicitamente comparado). Na ausência de comparação,
 *   URLs de CDNs padrão só são travadas se a flag manual ("cover"/"banner") estiver presente.
 */
export function isCustomImageUrl(candidateUrl, remoteDefaultUrl = null) {
  if (!candidateUrl || typeof candidateUrl !== "string") return false;
  const trimmedCandidate = candidateUrl.trim();
  if (!trimmedCandidate || !isValidImageUrl(trimmedCandidate)) return false;

  if (!isRemoteDefaultCdn(trimmedCandidate)) {
    return true;
  }

  if (remoteDefaultUrl !== null && remoteDefaultUrl !== undefined) {
    const trimmedRemote = String(remoteDefaultUrl).trim();
    if (!trimmedRemote) return true;
    return trimmedCandidate !== trimmedRemote;
  }

  return false;
}

/**
 * Resolve todos os campos persistidos de um anime preservando campos manuais individuais
 * gravados por src/routes/api/admin/catalog-anime.ts e imagens customizadas.
 */
export function resolveCatalogAnimeFields(media, existingRow = null) {
  const anilistId = media.id;
  const incomingRomaji = media.title?.romaji?.trim() || null;
  const incomingEnglish = media.title?.english?.trim() || null;
  const incomingNative = media.title?.native?.trim() || null;
  const incomingTitle =
    incomingEnglish || incomingRomaji || incomingNative || `Anime ${anilistId}`;

  const malId = media.idMal || null;
  const incomingCover =
    media.coverImage?.extraLarge || media.coverImage?.large || null;
  const incomingBanner = media.bannerImage || null;
  const incomingSynopsis = media.description
    ? media.description.replace(/<[^>]*>?/gm, "").trim() || null
    : null;
  const format = media.format || null;
  const status = media.status || null;
  const episodesCount =
    typeof media.episodes === "number" ? media.episodes : null;
  const year = typeof media.seasonYear === "number" ? media.seasonYear : null;
  const season = media.season || null;
  const score =
    typeof media.averageScore === "number" ? media.averageScore : null;
  const popularity =
    typeof media.popularity === "number" ? media.popularity : null;
  const trending =
    typeof media.trending === "number" ? media.trending : null;
  const genres = Array.isArray(media.genres) ? media.genres.filter(Boolean) : [];
  const trailerId = media.trailer?.id || null;

  if (!existingRow) {
    const titleNorm = computeTitleNorm(incomingTitle);
    const searchBlob = computeSearchBlob(
      incomingTitle,
      incomingRomaji,
      incomingEnglish,
      incomingNative
    );
    return {
      internalId: `anilist-${anilistId}`,
      anilistId,
      malId,
      title: incomingTitle,
      titleRomaji: incomingRomaji,
      titleEnglish: incomingEnglish,
      titleNative: incomingNative,
      cover: incomingCover,
      banner: incomingBanner,
      synopsis: incomingSynopsis,
      format,
      status,
      episodesCount,
      year,
      season,
      score,
      popularity,
      trending,
      genres,
      trailerId,
      titleNorm,
      searchBlob,
    };
  }

  const manualFields = Array.isArray(existingRow.manual_fields)
    ? existingRow.manual_fields
    : [];

  const manualTitle = manualFields.includes("title");
  const manualRomaji = manualFields.includes("titleRomaji");
  const manualEnglish = manualFields.includes("titleEnglish");
  const manualNative = manualFields.includes("titleNative");
  const manualSynopsis = manualFields.includes("synopsis");
  const manualCover = manualFields.includes("cover");
  const manualBanner = manualFields.includes("banner");

  const existingCover = existingRow.cover || null;
  const existingBanner = existingRow.banner || null;

  const preserveCover =
    manualCover ||
    (existingCover && isValidImageUrl(existingCover) && !isRemoteDefaultCdn(existingCover));
  const preserveBanner =
    manualBanner ||
    (existingBanner && isValidImageUrl(existingBanner) && !isRemoteDefaultCdn(existingBanner));

  const finalCover = preserveCover ? existingCover : incomingCover || existingCover;
  const finalBanner = preserveBanner ? existingBanner : incomingBanner || existingBanner;

  const resolvedTitle = manualTitle
    ? existingRow.title
    : incomingTitle || existingRow.title;
  const resolvedRomaji = manualRomaji
    ? existingRow.titleRomaji
    : incomingRomaji || existingRow.titleRomaji;
  const resolvedEnglish = manualEnglish
    ? existingRow.titleEnglish
    : incomingEnglish || existingRow.titleEnglish;
  const resolvedNative = manualNative
    ? existingRow.titleNative
    : incomingNative || existingRow.titleNative;
  const resolvedSynopsis = manualSynopsis
    ? existingRow.synopsis
    : incomingSynopsis || existingRow.synopsis;

  const titleNorm = computeTitleNorm(resolvedTitle);
  const searchBlob = computeSearchBlob(
    resolvedTitle,
    resolvedRomaji,
    resolvedEnglish,
    resolvedNative
  );

  return {
    internalId: existingRow.id,
    anilistId,
    malId,
    title: resolvedTitle,
    titleRomaji: resolvedRomaji,
    titleEnglish: resolvedEnglish,
    titleNative: resolvedNative,
    cover: finalCover,
    banner: finalBanner,
    synopsis: resolvedSynopsis,
    format,
    status,
    episodesCount,
    year,
    season,
    score,
    popularity,
    trending,
    genres,
    trailerId,
    titleNorm,
    searchBlob,
  };
}

// 1. Query válida para Listagens / Rankings / Varredura Incremental (UPDATED_AT_DESC)
export const MEDIA_LIST_QUERY = `
query MediaListQuery($page: Int, $perPage: Int, $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
      currentPage
      lastPage
    }
    media(type: ANIME, sort: $sort) {
      id
      idMal
      updatedAt
      title {
        romaji
        english
        native
      }
      coverImage {
        extraLarge
        large
        color
      }
      bannerImage
      description(asHtml: false)
      format
      status
      episodes
      season
      seasonYear
      averageScore
      popularity
      trending
      genres
      trailer {
        id
        site
        thumbnail
      }
      studios(isMain: true) {
        nodes {
          name
        }
      }
      nextAiringEpisode {
        episode
        airingAt
      }
    }
  }
}
`;

// 2. Query para Cobertura de Temporadas por Estação e Ano
export const SEASON_QUERY = `
query SeasonQuery($season: MediaSeason, $year: Int, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
    }
    media(type: ANIME, season: $season, seasonYear: $year, sort: [POPULARITY_DESC]) {
      id
      idMal
      updatedAt
      title {
        romaji
        english
        native
      }
      coverImage {
        extraLarge
        large
        color
      }
      bannerImage
      description(asHtml: false)
      format
      status
      episodes
      season
      seasonYear
      averageScore
      popularity
      trending
      genres
      trailer {
        id
        site
        thumbnail
      }
    }
  }
}
`;

// 3. Query para Calendário (Airing Schedules completos em janela UTC)
export const AIRING_SCHEDULE_QUERY = `
query AiringScheduleQuery($start: Int, $end: Int, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
    }
    airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
      id
      airingAt
      timeUntilAiring
      episode
      media {
        id
        idMal
        updatedAt
        format
        status
        episodes
        season
        seasonYear
        averageScore
        popularity
        trending
        description(asHtml: false)
        title {
          romaji
          english
          native
        }
        coverImage {
          extraLarge
          large
          color
        }
        bannerImage
        genres
        trailer {
          id
          site
          thumbnail
        }
      }
    }
  }
}
`;

function parseRetryAfterMs(headers, fallbackMs, retryAfterScaleMs) {
  const rawHeader =
    typeof headers?.get === "function"
      ? headers.get("retry-after")
      : headers?.["retry-after"];
  if (rawHeader !== undefined && rawHeader !== null && String(rawHeader).trim() !== "") {
    const seconds = Number(String(rawHeader).trim());
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds * retryAfterScaleMs);
    }
    const parsedDate = Date.parse(String(rawHeader));
    if (Number.isFinite(parsedDate)) {
      const diffMs = Math.max(1000, parsedDate - Date.now());
      return retryAfterScaleMs === 1000 ? diffMs : Math.max(1, retryAfterScaleMs);
    }
  }
  return fallbackMs;
}

export async function fetchAniListWithRetry(
  query,
  variables = {},
  {
    retries = 4,
    fetchImpl = globalThis.fetch,
    rateLimitDelayMs = RATE_LIMIT_DELAY_MS,
    backoffBaseMs = rateLimitDelayMs > 0 ? 2000 : 1,
    retryAfterScaleMs = rateLimitDelayMs > 0 ? 1000 : 1,
    onRetry = null,
    onRequest = null,
  } = {}
) {
  let lastError = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt === 0) {
        await delay(rateLimitDelayMs);
      }

      onRequest?.({ variables, attempt });

      const res = await fetchImpl(ANILIST_GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "HikariPeriodicSync/2.0 (+https://hikari.app)",
        },
        body: JSON.stringify({ query, variables }),
      });

      if (res.status === 429) {
        const progressiveMs = backoffBaseMs * Math.pow(2, attempt);
        const waitMs = parseRetryAfterMs(res.headers, progressiveMs, retryAfterScaleMs);
        lastError = new Error("AniList HTTP error 429 (Rate Limited)");
        console.warn(
          `[anilist-sync] Rate limit (429) atingido na tentativa ${attempt + 1}/${retries}. Aguardando ${waitMs}ms...`
        );
        onRetry?.({ attempt: attempt + 1, status: 429, waitMs, reason: "rate_limit" });
        if (attempt < retries - 1) {
          await delay(waitMs);
          continue;
        }
        throw lastError;
      }

      if (!res.ok) {
        throw new Error(`AniList HTTP error ${res.status}`);
      }

      let json;
      try {
        json = await res.json();
      } catch (parseErr) {
        throw new Error(`Resposta JSON inválida da AniList: ${parseErr?.message || parseErr}`);
      }

      if (!json || typeof json !== "object") {
        throw new Error("Resposta da AniList vazia ou não é um objeto JSON.");
      }

      if (Array.isArray(json.errors) && json.errors.length > 0) {
        const msg = json.errors[0]?.message || "Erro desconhecido GraphQL";
        if (!json.data) {
          throw new Error(`AniList GraphQL error: ${msg}`);
        }
        console.warn(`[anilist-sync] Aviso da API AniList: ${msg}`);
      }

      if (!json.data || typeof json.data !== "object") {
        throw new Error("Resposta da AniList não contém campo 'data' válido.");
      }

      return json.data;
    } catch (err) {
      lastError = err;
      console.warn(
        `[anilist-sync] Tentativa ${attempt + 1}/${retries} falhou: ${err?.message || err}`
      );
      if (attempt < retries - 1) {
        const waitMs = backoffBaseMs * Math.pow(2, attempt);
        onRetry?.({
          attempt: attempt + 1,
          status: null,
          waitMs,
          reason: err?.message || "network_error",
        });
        await delay(waitMs);
      }
    }
  }

  throw lastError ?? new Error("Falha ao consultar AniList após múltiplas tentativas.");
}

/**
 * Realiza varredura e remoção segura de chaves Redis via SCAN paginado (não-bloqueante).
 */
export async function scanAndDeleteByPattern(redis, pattern) {
  if (!redis) return 0;
  let cursor = "0";
  const foundKeys = new Set();
  let iterations = 0;

  try {
    do {
      iterations++;
      if (iterations > 500) break;
      const res = await redis.scan(cursor, { match: pattern, count: 100 });

      if (Array.isArray(res)) {
        cursor = String(res[0]);
        if (Array.isArray(res[1])) {
          for (const k of res[1]) foundKeys.add(k);
        }
      } else if (res && typeof res === "object") {
        cursor = String(res.cursor ?? "0");
        if (Array.isArray(res.keys)) {
          for (const k of res.keys) foundKeys.add(k);
        }
      } else {
        break;
      }
    } while (cursor !== "0" && cursor !== 0);

    if (foundKeys.size > 0) {
      const keys = Array.from(foundKeys);
      const BATCH_SIZE = 100;
      for (let i = 0; i < keys.length; i += BATCH_SIZE) {
        const batch = keys.slice(i, i + BATCH_SIZE);
        await redis.del(...batch);
      }
    }
    return foundKeys.size;
  } catch (err) {
    console.warn(
      `[anilist-sync] Aviso ao executar SCAN/DEL para padrão '${pattern}':`,
      err?.message || err
    );
    return 0;
  }
}

function buildSeasonCombinations(currentYear) {
  const targetYears = [currentYear - 1, currentYear, currentYear + 1];
  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const combos = [];
  for (const yr of targetYears) {
    for (const seas of seasons) {
      combos.push({ year: yr, season: seas });
    }
  }
  return combos;
}

export async function runSync(options = {}) {
  const args = options.argv ?? process.argv.slice(2);
  const isTestRun = args.includes("--test");
  const isManualRun =
    args.includes("--manual") || process.env.GITHUB_EVENT_NAME === "workflow_dispatch";

  const limitArgIndex = args.findIndex((a) => a.startsWith("--limit="));
  const parsedLimitArg =
    limitArgIndex !== -1 ? parseInt(args[limitArgIndex].split("=")[1], 10) : NaN;
  const limitParam = isTestRun
    ? Math.min(
        Math.max(1, Number.isFinite(parsedLimitArg) ? parsedLimitArg : 5),
        MAX_TEST_LIMIT
      )
    : Number.isFinite(parsedLimitArg) && parsedLimitArg > 0
      ? parsedLimitArg
      : null;

  const freqArgIndex = args.findIndex((a) => a.startsWith("--frequency="));
  const cliFrequency =
    freqArgIndex !== -1 ? args[freqArgIndex].split("=")[1] : null;

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const rateLimitDelayMs = options.rateLimitDelayMs ?? RATE_LIMIT_DELAY_MS;
  const backoffBaseMs =
    options.backoffBaseMs ?? (rateLimitDelayMs > 0 ? 2000 : 1);
  const retryAfterScaleMs =
    options.retryAfterScaleMs ?? (rateLimitDelayMs > 0 ? 1000 : 1);
  const nowProvider = options.now ?? (() => new Date());
  const retryCount = options.retries ?? 4;
  const runClockStart = Date.now();
  const timeBudgetMs =
    typeof options.timeBudgetMs === "number" && options.timeBudgetMs > 0
      ? options.timeBudgetMs
      : null;
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
  const isTimeBudgetExceeded = () =>
    timeBudgetMs !== null && Date.now() - runClockStart >= timeBudgetMs;

  const DATABASE_URL = process.env.DATABASE_URL;
  const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  console.log("=======================================================");
  console.log("[anilist-sync] Sincronização Periódica da AniList (Hikari)");
  console.log(
    `[anilist-sync] Modo: ${isTestRun ? "TESTE (DRY-RUN / SOMENTE LEITURA)" : "PRODUÇÃO"} | Manual: ${isManualRun ? "SIM" : "NÃO"}`
  );
  if (isTestRun) {
    console.log(
      `[anilist-sync] Limite global de teste: ${limitParam} registros | Teto HTTP: ${MAX_TEST_REQUESTS} requisições`
    );
  }
  console.log("=======================================================\n");

  if (!options.pool && !DATABASE_URL) {
    throw new Error("[anilist-sync] ERRO: DATABASE_URL não definida.");
  }

  const ownsPool = !options.pool;
  const pool =
    options.pool ?? new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
  const client = await pool.connect();

  let hasLock = false;
  let hasIncompleteSync = false;
  let pausedByTimeBudget = false;
  let redis = options.redis ?? null;

  if (!redis && !isTestRun && UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    try {
      redis = new Redis({
        url: UPSTASH_REDIS_REST_URL,
        token: UPSTASH_REDIS_REST_TOKEN,
      });
      console.log("[anilist-sync] Upstash Redis conectado.");
    } catch (e) {
      console.warn(
        "[anilist-sync] Aviso: Falha ao iniciar Redis:",
        e?.message || e
      );
    }
  } else if (isTestRun) {
    console.log(
      "[anilist-sync] [DRY-RUN] Redis configurado em modo simulação (nenhuma chave será modificada)."
    );
  }

  const touchedAnimeIds = new Set();
  let httpRequestsCount = 0;

  async function requestAniList(query, variables) {
    if (isTestRun && httpRequestsCount >= MAX_TEST_REQUESTS) {
      throw new Error(
        `[DRY-RUN] Teto rígido de ${MAX_TEST_REQUESTS} requisições atingido no modo --test.`
      );
    }
    return fetchAniListWithRetry(query, variables, {
      retries: retryCount,
      fetchImpl,
      rateLimitDelayMs,
      backoffBaseMs,
      retryAfterScaleMs,
      onRequest: ({ attempt }) => {
        if (attempt === 0) {
          httpRequestsCount++;
        }
      },
      onRetry: options.onRetry,
    });
  }

  async function readAdminSetting(key) {
    try {
      const res = await client.query(
        `SELECT "value" FROM "admin_settings" WHERE "key" = $1 LIMIT 1;`,
        [key]
      );
      if (res.rows.length > 0) {
        return parseAdminSettingValue(res.rows[0].value);
      }
      return null;
    } catch {
      return null;
    }
  }

  async function upsertAdminSetting(key, value) {
    if (isTestRun) return;
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    await client.query(
      `INSERT INTO "admin_settings" ("key", "value", "createdAt", "updatedAt")
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("key") DO UPDATE
       SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP;`,
      [key, serialized]
    );
  }

  async function deleteAdminSetting(key) {
    if (isTestRun) return;
    await client.query(`DELETE FROM "admin_settings" WHERE "key" = $1;`, [key]);
  }

  try {
    // 0. Concorrência: Advisory Lock exclusivo na mesma conexão/PoolClient
    const lockRes = await client.query(
      "SELECT pg_try_advisory_lock($1) AS locked;",
      [ADVISORY_LOCK_ID]
    );
    hasLock = Boolean(lockRes.rows[0]?.locked);
    if (!hasLock) {
      console.log(
        `[anilist-sync] Outro processo de sincronização já está em execução (advisory lock ${ADVISORY_LOCK_ID} ativo). Finalizando com segurança.`
      );
      return { status: "skipped_locked" };
    }
    console.log(
      `[anilist-sync] Advisory Lock ${ADVISORY_LOCK_ID} adquirido com sucesso.`
    );

    // 1. Verificar Frequência configurada em admin_settings
    const rawSettingFreq = cliFrequency ?? (await readAdminSetting("anilist_sync_frequency"));
    const frequency = normalizeSyncFrequency(rawSettingFreq);
    console.log(`[anilist-sync] Frequência configurada: ${frequency}`);

    // Validação de Frequência para execução automática (cron) em UTC
    if (!isManualRun) {
      const now = nowProvider();
      const dayOfWeekUTC = now.getUTCDay();
      console.log(
        `[anilist-sync] Execução agendada (cron). Dia da semana atual em UTC (0-6): ${dayOfWeekUTC}`
      );

      if (!isCronAllowedForFrequency(frequency, now)) {
        console.log(
          `[anilist-sync] Execução agendada ignorada para '${frequency}' no dia UTC ${dayOfWeekUTC}.`
        );
        return { status: "skipped_frequency", frequency, dayOfWeekUTC };
      }
    } else {
      console.log(
        "[anilist-sync] Execução manual detectada (workflow_dispatch/CLI). Ignorando restrição de dia da semana."
      );
    }

    // 2. Verificar colunas disponíveis em catalog_anime (compatível antes e após migration 0037)
    let hasTitleNormCol = true;
    let hasSearchBlobCol = true;
    let hasPopularityCol = true;
    let hasTrendingCol = true;
    let hasManualFieldsCol = true;
    try {
      const colRes = await client.query(
        `SELECT "column_name"
         FROM "information_schema"."columns"
         WHERE "table_name" = 'catalog_anime'
           AND "column_name" IN ('title_norm', 'search_blob', 'popularity', 'trending', 'manual_fields');`
      );
      if (colRes.rows.length > 0) {
        const present = new Set(colRes.rows.map((r) => r.column_name));
        hasTitleNormCol = present.has("title_norm");
        hasSearchBlobCol = present.has("search_blob");
        hasPopularityCol = present.has("popularity");
        hasTrendingCol = present.has("trending");
        hasManualFieldsCol = present.has("manual_fields");
        if (!hasPopularityCol || !hasTrendingCol) {
          console.warn(
            "[anilist-sync] Aviso: Colunas 'popularity' e/ou 'trending' ausentes em catalog_anime (migration 0037 ainda não aplicada). Rankings serão ignorados até a migration."
          );
        }
      }
    } catch {
      // Fallback para ambientes de teste simplificados
    }

    // 3. Ler estado da sincronização: carga inicial vs incremental e checkpoint retomável
    const rawInitialCompleted = await readAdminSetting("anilist_sync_initial_completed");
    const isInitialCompleted =
      rawInitialCompleted === true || String(rawInitialCompleted) === "true";

    const rawLastTs = await readAdminSetting("anilist_sync_last_timestamp");
    const lastSyncTimestamp =
      Number.isFinite(Number(rawLastTs)) && Number(rawLastTs) > 0
        ? Math.floor(Number(rawLastTs))
        : 0;

    const rawCheckpoint = await readAdminSetting("anilist_sync_checkpoint");
    const savedCheckpoint =
      rawCheckpoint && typeof rawCheckpoint === "object" && !Array.isArray(rawCheckpoint)
        ? rawCheckpoint
        : null;

    const syncMode = isInitialCompleted ? "incremental" : "initial";
    const runStartTime = nowProvider().getTime();
    const cutoffSec =
      lastSyncTimestamp > 0
        ? Math.floor(lastSyncTimestamp / 1000) - INCREMENTAL_OVERLAP_SECONDS
        : 0;

    console.log(
      `[anilist-sync] Estratégia: ${syncMode.toUpperCase()} | initialCompleted=${isInitialCompleted} | lastSyncTimestamp=${lastSyncTimestamp}${savedCheckpoint ? ` | checkpoint=${JSON.stringify(savedCheckpoint)}` : ""}`
    );

    let totalProcessed = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let importedSchedulesCount = 0;
    let simulatedReadsCount = 0;

    /**
     * Upsert real (ou simulação dry-run em --test) preservando campos manuais e imagens customizadas.
     */
    async function upsertAnime(media) {
      const anilistId = media.id;
      const selectCols = [
        `"id"`,
        `"cover"`,
        `"banner"`,
        `"title"`,
        `"titleRomaji"`,
        `"titleEnglish"`,
        `"titleNative"`,
        `"synopsis"`,
        ...(hasManualFieldsCol ? [`"manual_fields"`] : []),
      ].join(", ");

      const existingRes = await client.query(
        `SELECT ${selectCols}
         FROM "catalog_anime"
         WHERE "anilistId" = $1
         LIMIT 1;`,
        [anilistId]
      );

      const existingRow = existingRes.rows[0] || null;
      const resolved = resolveCatalogAnimeFields(media, existingRow);

      if (isTestRun) {
        simulatedReadsCount++;
        if (!existingRow) totalInserted++;
        else totalUpdated++;
        touchedAnimeIds.add(resolved.internalId);
        touchedAnimeIds.add(String(anilistId));
        return resolved.internalId;
      }

      if (!existingRow) {
        const extraCols = [
          ...(hasTitleNormCol ? [`"title_norm"`] : []),
          ...(hasSearchBlobCol ? [`"search_blob"`] : []),
          ...(hasPopularityCol ? [`"popularity"`] : []),
          ...(hasTrendingCol ? [`"trending"`] : []),
        ];
        const params = [
          resolved.internalId,
          resolved.title,
          resolved.anilistId,
          resolved.malId,
          resolved.titleRomaji,
          resolved.titleEnglish,
          resolved.titleNative,
          resolved.cover,
          resolved.banner,
          resolved.synopsis,
          resolved.format,
          resolved.status,
          resolved.episodesCount,
          resolved.year,
          resolved.season,
          resolved.genres,
          resolved.trailerId,
          resolved.score,
        ];
        const extraPlaceholders = [];
        for (const col of extraCols) {
          if (col === `"title_norm"`) params.push(resolved.titleNorm);
          else if (col === `"search_blob"`) params.push(resolved.searchBlob);
          else if (col === `"popularity"`) params.push(resolved.popularity);
          else if (col === `"trending"`) params.push(resolved.trending);
          extraPlaceholders.push(`$${params.length}`);
        }

        const extraColSql = extraCols.length > 0 ? `, ${extraCols.join(", ")}` : "";
        const extraValSql =
          extraPlaceholders.length > 0 ? `, ${extraPlaceholders.join(", ")}` : "";

        await client.query(
          `INSERT INTO "catalog_anime" (
             "id", "title", "anilistId", "malId", "titleRomaji", "titleEnglish", "titleNative",
             "cover", "banner", "synopsis", "format", "status", "episodesCount", "year", "season",
             "genres", "trailerId", "score", "manual_fields"${extraColSql}, "createdAt", "updatedAt"
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
             $16, $17, $18, '{}'::text[]${extraValSql}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
           )
           ON CONFLICT ("id") DO NOTHING;`,
          params
        );
        totalInserted++;
      } else {
        const params = [
          anilistId,
          resolved.title,
          resolved.titleRomaji,
          resolved.titleEnglish,
          resolved.titleNative,
          resolved.cover,
          resolved.banner,
          resolved.synopsis,
          resolved.format,
          resolved.status,
          resolved.episodesCount,
          resolved.year,
          resolved.season,
          resolved.genres,
          resolved.trailerId,
          resolved.score,
        ];
        const extraUpdates = [];
        if (hasTitleNormCol) {
          params.push(resolved.titleNorm);
          extraUpdates.push(`"title_norm" = $${params.length}`);
        }
        if (hasSearchBlobCol) {
          params.push(resolved.searchBlob);
          extraUpdates.push(`"search_blob" = $${params.length}`);
        }
        if (hasPopularityCol) {
          params.push(resolved.popularity);
          extraUpdates.push(`"popularity" = COALESCE($${params.length}, "popularity")`);
        }
        if (hasTrendingCol) {
          params.push(resolved.trending);
          extraUpdates.push(`"trending" = COALESCE($${params.length}, "trending")`);
        }

        const extraUpdateSql =
          extraUpdates.length > 0 ? `,\n             ${extraUpdates.join(",\n             ")}` : "";

        await client.query(
          `UPDATE "catalog_anime" SET
             "title" = COALESCE($2, "title"),
             "titleRomaji" = COALESCE($3, "titleRomaji"),
             "titleEnglish" = COALESCE($4, "titleEnglish"),
             "titleNative" = COALESCE($5, "titleNative"),
             "cover" = COALESCE($6, "cover"),
             "banner" = COALESCE($7, "banner"),
             "synopsis" = COALESCE($8, "synopsis"),
             "format" = COALESCE($9, "format"),
             "status" = COALESCE($10, "status"),
             "episodesCount" = COALESCE($11, "episodesCount"),
             "year" = COALESCE($12, "year"),
             "season" = COALESCE($13, "season"),
             "genres" = CASE WHEN array_length($14::text[], 1) > 0 THEN $14::text[] ELSE "genres" END,
             "trailerId" = COALESCE($15, "trailerId"),
             "score" = COALESCE($16, "score")${extraUpdateSql},
             "updatedAt" = CURRENT_TIMESTAMP
           WHERE "anilistId" = $1;`,
          params
        );
        totalUpdated++;
      }

      touchedAnimeIds.add(resolved.internalId);
      touchedAnimeIds.add(String(anilistId));
      return resolved.internalId;
    }

    async function upsertScheduleEntry(item, internalId) {
      if (isTestRun) {
        importedSchedulesCount++;
        return;
      }
      const epNumber = item.episode;
      const anilistId = item.media.id;
      const airingDate = new Date(item.airingAt * 1000).toISOString();
      const schedId = `sched-${anilistId}-${epNumber}`;
      const timeUntilAiring = item.timeUntilAiring ?? null;

      await client.query(
        `INSERT INTO "catalog_airing_schedule" (
           "id", "anilistId", "animeId", "episode", "airingAt", "timeUntilAiring", "createdAt", "updatedAt"
         ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT ("anilistId", "episode") DO UPDATE
         SET
           "animeId" = EXCLUDED."animeId",
           "airingAt" = EXCLUDED."airingAt",
           "timeUntilAiring" = EXCLUDED."timeUntilAiring",
           "updatedAt" = CURRENT_TIMESTAMP;`,
        [schedId, anilistId, internalId, epNumber, airingDate, timeUntilAiring]
      );
      importedSchedulesCount++;
    }

    // =========================================================================
    // MODO --test: Execução segura DRY-RUN / SOMENTE LEITURA com limite global
    // =========================================================================
    if (isTestRun) {
      const globalLimit = limitParam ?? 5;
      const remaining = () => Math.max(0, globalLimit - totalProcessed);

      const mediaBudget =
        globalLimit >= 3 ? Math.max(1, globalLimit - 2) : globalLimit;
      const seasonBudget = globalLimit >= 2 ? 1 : 0;

      console.log(
        `[anilist-sync] [DRY-RUN] 1/3 Testando consulta de mídia (budget: ${mediaBudget}, global: ${globalLimit})...`
      );
      const mediaData = await requestAniList(MEDIA_LIST_QUERY, {
        page: 1,
        perPage: Math.min(mediaBudget, 10),
        sort: syncMode === "initial" ? ["TRENDING_DESC", "POPULARITY_DESC"] : ["UPDATED_AT_DESC"],
      });
      const mPage = mediaData?.Page;
      if (!mPage || !Array.isArray(mPage.media)) {
        throw new Error("[DRY-RUN] Resposta inválida da AniList na consulta de mídia.");
      }
      for (const media of mPage.media) {
        if (totalProcessed >= globalLimit) break;
        if (totalProcessed >= mediaBudget && remaining() <= seasonBudget + 1) break;
        totalProcessed++;
        await upsertAnime(media);
      }

      if (remaining() > 0 && httpRequestsCount < MAX_TEST_REQUESTS) {
        const nowYear = nowProvider().getUTCFullYear();
        const nowMonth = nowProvider().getUTCMonth();
        const currentSeason =
          nowMonth <= 2
            ? "WINTER"
            : nowMonth <= 5
              ? "SPRING"
              : nowMonth <= 8
                ? "SUMMER"
                : "FALL";
        const seasBudgetForCall =
          remaining() >= 2 ? Math.max(1, remaining() - 1) : remaining();

        console.log(
          `[anilist-sync] [DRY-RUN] 2/3 Testando temporada ${currentSeason} ${nowYear} (budget: ${seasBudgetForCall})...`
        );
        const seasData = await requestAniList(SEASON_QUERY, {
          season: currentSeason,
          year: nowYear,
          page: 1,
          perPage: Math.min(seasBudgetForCall, 10),
        });
        const sPage = seasData?.Page;
        if (!sPage || !Array.isArray(sPage.media)) {
          throw new Error("[DRY-RUN] Resposta inválida da AniList na consulta de temporada.");
        }
        let seasTaken = 0;
        for (const media of sPage.media) {
          if (totalProcessed >= globalLimit || seasTaken >= seasBudgetForCall) break;
          seasTaken++;
          totalProcessed++;
          await upsertAnime(media);
        }
      }

      if (remaining() > 0 && httpRequestsCount < MAX_TEST_REQUESTS) {
        const nowSec = Math.floor(nowProvider().getTime() / 1000);
        const endSec = nowSec + 14 * 86400;
        const schedBudget = remaining();
        console.log(
          `[anilist-sync] [DRY-RUN] 3/3 Testando calendário (janela 14d UTC, budget: ${schedBudget})...`
        );
        const schedData = await requestAniList(AIRING_SCHEDULE_QUERY, {
          start: nowSec,
          end: endSec,
          page: 1,
          perPage: Math.min(schedBudget, 10),
        });
        const aPage = schedData?.Page;
        if (!aPage || !Array.isArray(aPage.airingSchedules)) {
          throw new Error("[DRY-RUN] Resposta inválida da AniList no calendário.");
        }
        for (const item of aPage.airingSchedules) {
          if (totalProcessed >= globalLimit) break;
          if (!item.media || !item.airingAt || !item.episode) continue;
          totalProcessed++;
          const internalId = await upsertAnime(item.media);
          await upsertScheduleEntry(item, internalId);
        }
      }

      console.log("\n=======================================================");
      console.log("[anilist-sync] [DRY-RUN] RELATÓRIO DO MODO --test:");
      console.log(`  - Executado: Advisory Lock 849201, leitura de admin_settings/schema, ${httpRequestsCount} requisições AniList, ${simulatedReadsCount} verificações SELECT em catalog_anime.`);
      console.log(`  - Simulado (ZERO escritas): ${totalInserted} inserções, ${totalUpdated} atualizações, ${importedSchedulesCount} entradas de calendário, checkpoint/marcadores e invalidação Redis.`);
      console.log(`  - Registros processados (limite global ${globalLimit}): ${totalProcessed}`);
      console.log("=======================================================\n");

      return {
        status: "dry_run_success",
        mode: syncMode,
        dryRun: true,
        globalLimit,
        httpRequestsCount,
        totalProcessed,
        simulatedInserted: totalInserted,
        simulatedUpdated: totalUpdated,
        simulatedSchedulesCount: importedSchedulesCount,
        timestampUpdated: false,
      };
    }

    // =========================================================================
    // EXECUÇÃO REAL (CARGA INICIAL OU INCREMENTAL COM CHECKPOINTS RETOMÁVEIS)
    // =========================================================================
    const currentYear = nowProvider().getUTCFullYear();
    const seasonCombos = buildSeasonCombinations(currentYear);

    const activeCheckpointValid =
      savedCheckpoint &&
      savedCheckpoint.mode === syncMode &&
      ((syncMode === "initial" && INITIAL_STAGES.includes(savedCheckpoint.stage)) ||
        (syncMode === "incremental" && INCREMENTAL_STAGES.includes(savedCheckpoint.stage)));

    const stageList = syncMode === "initial" ? INITIAL_STAGES : INCREMENTAL_STAGES;
    const resumeStage = activeCheckpointValid ? savedCheckpoint.stage : stageList[0];
    const resumeStageIdx = Math.max(0, stageList.indexOf(resumeStage));
    const resumePage = activeCheckpointValid
      ? Math.max(1, Number(savedCheckpoint.page) || 1)
      : 1;
    const resumeSeasonIndex = activeCheckpointValid
      ? Math.max(0, Number(savedCheckpoint.seasonIndex) || 0)
      : 0;
    const floorTimestamp =
      activeCheckpointValid &&
      Number.isFinite(Number(savedCheckpoint.startedAt)) &&
      Number(savedCheckpoint.startedAt) > 0
        ? Math.floor(Number(savedCheckpoint.startedAt))
        : runStartTime;

    if (activeCheckpointValid) {
      console.log(
        `[anilist-sync] Retomando execução anterior a partir da etapa '${resumeStage}' (página ${resumePage}, temporadaIdx ${resumeSeasonIndex}).`
      );
    }

    async function reportProgress(stage, page, seasonIndex = 0) {
      if (!onProgress) return;
      try {
        await onProgress({
          mode: syncMode,
          stage,
          page,
          seasonIndex,
          totalProcessed,
          totalInserted,
          totalUpdated,
          importedSchedulesCount,
        });
      } catch {
        // Ignora falhas de notificação de progresso para não interromper a sincronização
      }
    }

    /**
     * Executa uma etapa paginada de MEDIA_LIST_QUERY (rankings ou incremental UPDATED_AT_DESC).
     */
    async function runMediaStage({
      stageName,
      sort,
      maxPages,
      perPage = 50,
      startPage = 1,
      useCutoff = false,
      strictPagination = false,
    }) {
      const hadIncompleteBeforeStage = hasIncompleteSync;
      console.log(
        `[anilist-sync] Etapa '${stageName}' (sort: ${sort.join(",")}, startPage: ${startPage}, maxPages: ${maxPages}${useCutoff ? `, cutoffSec: ${cutoffSec}` : ""})...`
      );
      let page = startPage;
      let pagesProcessed = 0;
      let hasNextPage = true;
      let reachedCutoff = false;

      while (hasNextPage && pagesProcessed < maxPages) {
        const data = await requestAniList(MEDIA_LIST_QUERY, {
          page,
          perPage,
          sort,
        });
        const pageData = data?.Page;
        if (!pageData || !Array.isArray(pageData.media)) {
          throw new Error(
            `Resposta inválida da AniList na etapa '${stageName}' (página ${page}).`
          );
        }

        if (pageData.media.length === 0) {
          hasNextPage = false;
          break;
        }

        const hitLimitParam = () => limitParam !== null && totalProcessed >= limitParam;

        await client.query("BEGIN");
        try {
          for (const media of pageData.media) {
            if (
              useCutoff &&
              cutoffSec > 0 &&
              typeof media.updatedAt === "number" &&
              media.updatedAt < cutoffSec
            ) {
              reachedCutoff = true;
              break;
            }
            if (hitLimitParam()) break;
            totalProcessed++;
            await upsertAnime(media);
          }

          hasNextPage = reachedCutoff
            ? false
            : Boolean(pageData.pageInfo?.hasNextPage);

          const reachedLimitNow = hitLimitParam();
          const shouldSaveNextPageCheckpoint =
            !hadIncompleteBeforeStage &&
            !hasIncompleteSync &&
            hasNextPage &&
            !reachedLimitNow &&
            (strictPagination || pagesProcessed + 1 < maxPages);

          if (shouldSaveNextPageCheckpoint) {
            await upsertAdminSetting("anilist_sync_checkpoint", {
              mode: syncMode,
              stage: stageName,
              page: page + 1,
              seasonIndex: 0,
              startedAt: floorTimestamp,
              updatedAt: Date.now(),
            });
          }

          await client.query("COMMIT");
        } catch (txErr) {
          await client.query("ROLLBACK").catch(() => {});
          throw txErr;
        }

        pagesProcessed++;
        await reportProgress(stageName, page, 0);

        if (reachedCutoff || hitLimitParam()) {
          break;
        }
        if (hasNextPage && pagesProcessed < maxPages && isTimeBudgetExceeded()) {
          pausedByTimeBudget = true;
          break;
        }
        page++;
      }

      if (
        !pausedByTimeBudget &&
        strictPagination &&
        hasNextPage &&
        !(limitParam && totalProcessed >= limitParam)
      ) {
        console.error(
          `[anilist-sync] ERRO: Limite de ${maxPages} páginas atingido em '${stageName}' com hasNextPage ainda verdadeiro.`
        );
        hasIncompleteSync = true;
      }

      // Avança checkpoint para a próxima etapa somente se nenhuma etapa marcou execução incompleta
      if (!pausedByTimeBudget && !hadIncompleteBeforeStage && !hasIncompleteSync) {
        const nextStageIdx = stageList.indexOf(stageName) + 1;
        if (nextStageIdx < stageList.length) {
          await upsertAdminSetting("anilist_sync_checkpoint", {
            mode: syncMode,
            stage: stageList[nextStageIdx],
            page: 1,
            seasonIndex: 0,
            startedAt: floorTimestamp,
            updatedAt: Date.now(),
          });
          if (isTimeBudgetExceeded()) {
            pausedByTimeBudget = true;
          }
        }
      }
    }

    /**
     * Executa cobertura das 12 temporadas (ano anterior, atual e próximo) com checkpoint por temporada/página.
     */
    async function runSeasonsStage({
      startSeasonIndex = 0,
      startPage = 1,
      perPage = 50,
      maxSeasonPages = 25,
    }) {
      const hadIncompleteBeforeStage = hasIncompleteSync;
      console.log(
        `[anilist-sync] Etapa 'seasons' (iniciando em índice ${startSeasonIndex}/${seasonCombos.length}, página ${startPage})...`
      );
      let firstFailureCheckpoint = null;

      for (let idx = startSeasonIndex; idx < seasonCombos.length; idx++) {
        const { season: seas, year: yr } = seasonCombos[idx];
        let seasonPage = idx === startSeasonIndex ? startPage : 1;
        let seasonPagesProcessed = 0;
        let seasonHasNext = true;

        try {
          while (seasonHasNext && seasonPagesProcessed < maxSeasonPages) {
            const seasData = await requestAniList(SEASON_QUERY, {
              season: seas,
              year: yr,
              page: seasonPage,
              perPage,
            });
            const sPage = seasData?.Page;
            if (!sPage || !Array.isArray(sPage.media)) {
              throw new Error(
                `Resposta inválida da AniList na temporada ${seas} ${yr} (página ${seasonPage}).`
              );
            }

            if (sPage.media.length === 0) {
              seasonHasNext = false;
              break;
            }

            await client.query("BEGIN");
            try {
              for (const media of sPage.media) {
                await upsertAnime(media);
              }
              seasonHasNext = Boolean(sPage.pageInfo?.hasNextPage);
              if (
                !hadIncompleteBeforeStage &&
                !hasIncompleteSync &&
                !firstFailureCheckpoint &&
                seasonHasNext
              ) {
                await upsertAdminSetting("anilist_sync_checkpoint", {
                  mode: syncMode,
                  stage: "seasons",
                  page: seasonPage + 1,
                  seasonIndex: idx,
                  startedAt: floorTimestamp,
                  updatedAt: Date.now(),
                });
              }
              await client.query("COMMIT");
            } catch (seasTxErr) {
              await client.query("ROLLBACK").catch(() => {});
              throw seasTxErr;
            }

            seasonPagesProcessed++;
            seasonPage++;
            await reportProgress("seasons", seasonPage - 1, idx);

            if (
              !hasIncompleteSync &&
              !firstFailureCheckpoint &&
              seasonHasNext &&
              seasonPagesProcessed < maxSeasonPages &&
              isTimeBudgetExceeded()
            ) {
              pausedByTimeBudget = true;
              break;
            }
          }

          if (pausedByTimeBudget) {
            break;
          }

          if (seasonHasNext) {
            console.error(
              `[anilist-sync] ERRO: Limite de ${maxSeasonPages} páginas atingido na temporada ${seas} ${yr} com hasNextPage ainda verdadeiro.`
            );
            hasIncompleteSync = true;
            if (!firstFailureCheckpoint) {
              firstFailureCheckpoint = {
                stage: "seasons",
                seasonIndex: idx,
                page: seasonPage,
              };
            }
          } else if (
            !hadIncompleteBeforeStage &&
            !hasIncompleteSync &&
            !firstFailureCheckpoint &&
            idx + 1 < seasonCombos.length
          ) {
            await upsertAdminSetting("anilist_sync_checkpoint", {
              mode: syncMode,
              stage: "seasons",
              page: 1,
              seasonIndex: idx + 1,
              startedAt: floorTimestamp,
              updatedAt: Date.now(),
            });
            if (isTimeBudgetExceeded()) {
              pausedByTimeBudget = true;
              break;
            }
          }
        } catch (seasErr) {
          console.error(
            `[anilist-sync] ERRO na importação da temporada ${seas} ${yr}:`,
            seasErr?.message || seasErr
          );
          hasIncompleteSync = true;
          if (!firstFailureCheckpoint) {
            firstFailureCheckpoint = {
              stage: "seasons",
              seasonIndex: idx,
              page: seasonPage,
            };
          }
        }
      }

      if (!hadIncompleteBeforeStage && !pausedByTimeBudget) {
        if (firstFailureCheckpoint) {
          await upsertAdminSetting("anilist_sync_checkpoint", {
            mode: syncMode,
            stage: "seasons",
            page: firstFailureCheckpoint.page,
            seasonIndex: firstFailureCheckpoint.seasonIndex,
            startedAt: floorTimestamp,
            updatedAt: Date.now(),
          });
        } else if (!hasIncompleteSync) {
          await upsertAdminSetting("anilist_sync_checkpoint", {
            mode: syncMode,
            stage: "schedule",
            page: 1,
            seasonIndex: 0,
            startedAt: floorTimestamp,
            updatedAt: Date.now(),
          });
          if (isTimeBudgetExceeded()) {
            pausedByTimeBudget = true;
          }
        }
      }
    }

    /**
     * Executa importação completa de Airing Schedules (próximos 14 dias em UTC) para catalog_airing_schedule.
     */
    async function runScheduleStage({ startPage = 1, maxSchedulePages = 30 }) {
      const hadIncompleteBeforeStage = hasIncompleteSync;
      console.log(
        `[anilist-sync] Etapa 'schedule' (próximos 14 dias UTC, iniciando página ${startPage})...`
      );
      const nowSec = Math.floor(nowProvider().getTime() / 1000);
      const endSec = nowSec + 14 * 86400;
      let schedulePage = startPage;
      let schedulePagesProcessed = 0;
      let scheduleHasNext = true;

      try {
        while (scheduleHasNext && schedulePagesProcessed < maxSchedulePages) {
          const schedData = await requestAniList(AIRING_SCHEDULE_QUERY, {
            start: nowSec,
            end: endSec,
            page: schedulePage,
            perPage: 50,
          });
          const sPage = schedData?.Page;
          if (!sPage || !Array.isArray(sPage.airingSchedules)) {
            throw new Error(
              `Resposta inválida da AniList no calendário (página ${schedulePage}).`
            );
          }

          if (sPage.airingSchedules.length === 0) {
            scheduleHasNext = false;
            break;
          }

          await client.query("BEGIN");
          try {
            for (const item of sPage.airingSchedules) {
              if (!item.media || !item.airingAt || !item.episode) continue;
              const internalId = await upsertAnime(item.media);
              await upsertScheduleEntry(item, internalId);
            }
            scheduleHasNext = Boolean(sPage.pageInfo?.hasNextPage);
            if (!hadIncompleteBeforeStage && !hasIncompleteSync && scheduleHasNext) {
              await upsertAdminSetting("anilist_sync_checkpoint", {
                mode: syncMode,
                stage: "schedule",
                page: schedulePage + 1,
                seasonIndex: 0,
                startedAt: floorTimestamp,
                updatedAt: Date.now(),
              });
            }
            await client.query("COMMIT");
          } catch (schedTxErr) {
            await client.query("ROLLBACK").catch(() => {});
            throw schedTxErr;
          }

          schedulePagesProcessed++;
          schedulePage++;
          await reportProgress("schedule", schedulePage - 1, 0);

          if (
            scheduleHasNext &&
            schedulePagesProcessed < maxSchedulePages &&
            isTimeBudgetExceeded()
          ) {
            pausedByTimeBudget = true;
            break;
          }
        }

        if (!pausedByTimeBudget && scheduleHasNext) {
          console.error(
            `[anilist-sync] ERRO: Limite de ${maxSchedulePages} páginas atingido no calendário com hasNextPage ainda verdadeiro.`
          );
          hasIncompleteSync = true;
        }
      } catch (schedErr) {
        console.error(
          "[anilist-sync] ERRO ao importar Airing Schedules:",
          schedErr?.message || schedErr
        );
        hasIncompleteSync = true;
      }
    }

    // Execução sequencial das etapas conforme o modo (initial vs incremental)
    const initialLimits = options.initialLimits ?? {};
    const incrementalLimits = options.incrementalLimits ?? {};

    if (syncMode === "initial") {
      if (!hasIncompleteSync && !pausedByTimeBudget && resumeStageIdx <= INITIAL_STAGES.indexOf("trending")) {
        await runMediaStage({
          stageName: "trending",
          sort: ["TRENDING_DESC", "POPULARITY_DESC"],
          maxPages: initialLimits.trendingPages ?? 10,
          perPage: 50,
          startPage: resumeStage === "trending" ? resumePage : 1,
        });
      }
      if (!hasIncompleteSync && !pausedByTimeBudget && resumeStageIdx <= INITIAL_STAGES.indexOf("popular")) {
        await runMediaStage({
          stageName: "popular",
          sort: ["POPULARITY_DESC"],
          maxPages: initialLimits.popularPages ?? 20,
          perPage: 50,
          startPage: resumeStage === "popular" ? resumePage : 1,
        });
      }
      if (!hasIncompleteSync && !pausedByTimeBudget && resumeStageIdx <= INITIAL_STAGES.indexOf("top")) {
        await runMediaStage({
          stageName: "top",
          sort: ["SCORE_DESC"],
          maxPages: initialLimits.topPages ?? 10,
          perPage: 50,
          startPage: resumeStage === "top" ? resumePage : 1,
        });
      }
      if (!hasIncompleteSync && !pausedByTimeBudget && resumeStageIdx <= INITIAL_STAGES.indexOf("recent")) {
        await runMediaStage({
          stageName: "recent",
          sort: ["UPDATED_AT_DESC"],
          maxPages: initialLimits.recentPages ?? 5,
          perPage: 50,
          startPage: resumeStage === "recent" ? resumePage : 1,
        });
      }
      if (!hasIncompleteSync && !pausedByTimeBudget && resumeStageIdx <= INITIAL_STAGES.indexOf("seasons")) {
        await runSeasonsStage({
          startSeasonIndex: resumeStage === "seasons" ? resumeSeasonIndex : 0,
          startPage: resumeStage === "seasons" ? resumePage : 1,
          perPage: 50,
          maxSeasonPages: initialLimits.seasonPages ?? 15,
        });
      }
      if (!hasIncompleteSync && !pausedByTimeBudget && resumeStageIdx <= INITIAL_STAGES.indexOf("schedule")) {
        await runScheduleStage({
          startPage: resumeStage === "schedule" ? resumePage : 1,
          maxSchedulePages: initialLimits.schedulePages ?? 30,
        });
      }
    } else {
      if (!hasIncompleteSync && !pausedByTimeBudget && resumeStageIdx <= INCREMENTAL_STAGES.indexOf("incremental")) {
        await runMediaStage({
          stageName: "incremental",
          sort: ["UPDATED_AT_DESC"],
          maxPages: incrementalLimits.incrementalPages ?? 50,
          perPage: 50,
          startPage: resumeStage === "incremental" ? resumePage : 1,
          useCutoff: true,
          strictPagination: true,
        });
      }
      if (!hasIncompleteSync && !pausedByTimeBudget && resumeStageIdx <= INCREMENTAL_STAGES.indexOf("trending_refresh")) {
        await runMediaStage({
          stageName: "trending_refresh",
          sort: ["TRENDING_DESC", "POPULARITY_DESC"],
          maxPages: incrementalLimits.trendingPages ?? 2,
          perPage: 50,
          startPage: resumeStage === "trending_refresh" ? resumePage : 1,
        });
      }
      if (!hasIncompleteSync && !pausedByTimeBudget && resumeStageIdx <= INCREMENTAL_STAGES.indexOf("popular_refresh")) {
        await runMediaStage({
          stageName: "popular_refresh",
          sort: ["POPULARITY_DESC"],
          maxPages: incrementalLimits.popularPages ?? 2,
          perPage: 50,
          startPage: resumeStage === "popular_refresh" ? resumePage : 1,
        });
      }
      if (!hasIncompleteSync && !pausedByTimeBudget && resumeStageIdx <= INCREMENTAL_STAGES.indexOf("seasons")) {
        await runSeasonsStage({
          startSeasonIndex: resumeStage === "seasons" ? resumeSeasonIndex : 0,
          startPage: resumeStage === "seasons" ? resumePage : 1,
          perPage: 50,
          maxSeasonPages: incrementalLimits.seasonPages ?? 25,
        });
      }
      if (!hasIncompleteSync && !pausedByTimeBudget && resumeStageIdx <= INCREMENTAL_STAGES.indexOf("schedule")) {
        await runScheduleStage({
          startPage: resumeStage === "schedule" ? resumePage : 1,
          maxSchedulePages: incrementalLimits.schedulePages ?? 30,
        });
      }
    }

    console.log(
      `[anilist-sync] Entradas de calendário em catalog_airing_schedule: ${importedSchedulesCount}`
    );

    // 4. Atualizar marcadores de conclusão SOMENTE se todas as etapas tiveram sucesso integral
    if (!hasIncompleteSync && !pausedByTimeBudget) {
      await client.query("BEGIN");
      try {
        if (syncMode === "initial") {
          await upsertAdminSetting("anilist_sync_initial_completed", "true");
        }
        await upsertAdminSetting("anilist_sync_last_timestamp", String(floorTimestamp));
        await deleteAdminSetting("anilist_sync_checkpoint");
        await client.query("COMMIT");
      } catch (markerErr) {
        await client.query("ROLLBACK").catch(() => {});
        throw markerErr;
      }

      console.log("\n=======================================================");
      console.log(
        `[anilist-sync] SUCESSO (${syncMode}): Sincronização concluída na íntegra!`
      );
      console.log(
        `[anilist-sync] Títulos processados: ${totalProcessed} | Inseridos: ${totalInserted} | Atualizados: ${totalUpdated}`
      );
      console.log("=======================================================\n");
    } else if (pausedByTimeBudget && !hasIncompleteSync) {
      console.log("\n=======================================================");
      console.log(
        `[anilist-sync] PAUSA CONTROLADA (${syncMode}): Orçamento de tempo da etapa atingido; checkpoint preservado para continuação imediata.`
      );
      console.log("=======================================================\n");
    } else {
      console.error("\n=======================================================");
      console.error(
        "[anilist-sync] ERRO: Sincronização INCOMPLETA. Marcadores finais NÃO foram avançados; checkpoint preservado para retomada."
      );
      console.error(
        `[anilist-sync] Parcial -> Processados: ${totalProcessed} | Inseridos: ${totalInserted} | Atualizados: ${totalUpdated}`
      );
      console.error("=======================================================\n");
    }

    // 5. Invalidação seletiva no Upstash Redis (SCAN não-bloqueante + contadores atômicos, fail-open)
    if (redis && !pausedByTimeBudget) {
      console.log(
        "[anilist-sync] Invalidando caches seletivos no Upstash Redis via SCAN e contadores atômicos..."
      );
      try {
        await redis.incr("hikari:calendar:gen:v1");
        await redis.incr("hikari:catalog:episodes:public:gen:v1");
        await redis.incr("hikari:home:episodes:gen:v1");
        await redis.incr("hikari:catalog:detail:gen:global:v1");

        const directKeys = [
          "hikari:catalog:index:v1",
          "hikari:catalog:badges:v1",
          "hikari:home:episodes:v1",
          "hikari:catalog:episodes:public:v1",
        ];

        // Invalidação seletiva por IDs tocados (consistente com fence global + id)
        if (touchedAnimeIds.size > 0 && touchedAnimeIds.size <= 500) {
          for (const id of touchedAnimeIds) {
            await redis.incr(`hikari:catalog:detail:gen:id:v1:${id}`);
            directKeys.push(`hikari:catalog:detail:v1:${id}`);
          }
        }

        const CHUNK_DEL = 100;
        for (let i = 0; i < directKeys.length; i += CHUNK_DEL) {
          await redis.del(...directKeys.slice(i, i + CHUNK_DEL));
        }

        const patternsToScan = [
          "hikari:home:today-raw:v1:*",
          "hikari:calendar:week:v1:*",
          "calendar:*",
          "calendar:proxy:*",
          "calendar:week:*",
          "hikari:catalog:search:v1:*",
          "hikari:catalog:detail:v1:*",
          "hikari:home:catalog:v1:*",
          "hikari:home:season:v1:*",
        ];

        for (const pattern of patternsToScan) {
          await scanAndDeleteByPattern(redis, pattern);
        }

        console.log(
          "[anilist-sync] Invalidação seletiva no Upstash Redis concluída via SCAN."
        );
      } catch (redisErr) {
        console.warn(
          "[anilist-sync] Aviso: Falha ao invalidar Redis (fail-open preservado):",
          redisErr?.message || redisErr
        );
      }
    }

    if (pausedByTimeBudget && !hasIncompleteSync) {
      return {
        status: "paused_checkpoint",
        mode: syncMode,
        dryRun: false,
        paused: true,
        httpRequestsCount,
        totalProcessed,
        totalInserted,
        totalUpdated,
        importedSchedulesCount,
        timestampUpdated: false,
      };
    }

    if (hasIncompleteSync) {
      throw new Error(
        "Sincronização da AniList incompleta devido a falha de etapa ou limite de paginação. Checkpoint preservado e anilist_sync_last_timestamp não avançado."
      );
    }

    return {
      status: "success",
      mode: syncMode,
      dryRun: false,
      httpRequestsCount,
      totalProcessed,
      totalInserted,
      totalUpdated,
      importedSchedulesCount,
      timestampUpdated: true,
      initialCompleted: true,
    };
  } catch (err) {
    console.error(
      "[anilist-sync] ERRO CRÍTICO na sincronização (marcador preservado):",
      err?.message || err
    );
    throw err;
  } finally {
    if (hasLock) {
      try {
        await client.query("SELECT pg_advisory_unlock($1);", [ADVISORY_LOCK_ID]);
        console.log(
          `[anilist-sync] Advisory Lock ${ADVISORY_LOCK_ID} liberado.`
        );
      } catch {
        // ignore unlock error on disconnect
      }
    }
    client.release();
    if (ownsPool) {
      await pool.end();
    }
  }
}

const isDirectRun =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runSync()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("[anilist-sync] Falha fatal:", err?.message || err);
      process.exit(1);
    });
}
