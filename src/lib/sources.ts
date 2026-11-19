import { getSql } from "@/lib/db";
import {
  ANITUBE22_PROVIDER,
  buildAnitube22PlayerUrl,
  extractAnitube22ExternalId,
  extractAnitube22Lang,
  normalizeSourceLang,
  type EpisodeSourceItem,
  type SourceLang,
  type SourceStatus,
} from "@/lib/anitube22";
import {
  getRedisEpisodeSource,
  acquireEpisodeResolutionLock,
  releaseEpisodeResolutionLock,
  setRedisEpisodeSourceWithFence,
  invalidateRedisEpisodeSource,
} from "@/lib/redis";

export interface ResolvedEpisodeSource {
  directUrl: string | null;
  iframeUrl: string | null;
  provider?: string;
  unavailable?: boolean;
}

interface RawEpisodeSourceRow {
  id: string;
  episode_id: string;
  provider: string;
  external_id: string | null;
  lang: string | null;
  quality: string | null;
  priority: number;
  status: string | null;
  fail_count: number | null;
  last_checked_at: string | null;
  page_url: string | null;
  direct_url: string | null;
  resolved_at: string | null;
}

function mapSourceRow(row: RawEpisodeSourceRow): EpisodeSourceItem {
  const externalId =
    (row.external_id && row.external_id.trim()) ||
    extractAnitube22ExternalId(row.page_url) ||
    extractAnitube22ExternalId(row.direct_url) ||
    "";
  return {
    id: row.id,
    episodeId: row.episode_id,
    provider: row.provider,
    externalId,
    lang: normalizeSourceLang(row.lang),
    quality: row.quality ?? null,
    priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : 0,
    status: row.status === "broken" ? "broken" : "active",
    failCount: Number.isFinite(Number(row.fail_count)) ? Number(row.fail_count) : 0,
    lastCheckedAt: row.last_checked_at ?? null,
  };
}

/**
 * Lista todas as fontes cadastradas para um episódio ordenadas por prioridade (menor primeiro).
 * Por padrão omite fontes com status = 'broken'.
 */
export async function listEpisodeSources(
  episodeId: string,
  options?: {
    includeBroken?: boolean;
    lang?: SourceLang;
  },
): Promise<EpisodeSourceItem[]> {
  const cleanEpId = episodeId?.trim();
  if (!cleanEpId) return [];

  const sql = await getSql();
  const conditions: string[] = [`"episode_id" = $1`];
  const params: unknown[] = [cleanEpId];

  if (!options?.includeBroken) {
    conditions.push(`COALESCE("status", 'active') <> 'broken'`);
  }
  if (options?.lang) {
    params.push(normalizeSourceLang(options.lang));
    conditions.push(`COALESCE("lang", 'sub') = $${params.length}`);
  }

  const rows = await sql.query<RawEpisodeSourceRow>(
    `SELECT
       "id",
       "episode_id",
       "provider",
       "external_id",
       "lang",
       "quality",
       "priority",
       "status",
       "fail_count",
       "last_checked_at",
       "page_url",
       "direct_url",
       "resolved_at"
     FROM "episode_sources"
     WHERE ${conditions.join(" AND ")}
     ORDER BY "priority" ASC, "created_at" ASC;`,
    params,
  );

  return rows.map(mapSourceRow);
}

/**
 * Grava ou atualiza uma fonte durável em `episode_sources`.
 * Nunca persiste o parâmetro `time` nem URLs assinadas com `time=`.
 */
export async function upsertEpisodeSource(input: {
  episodeId: string;
  provider?: string;
  externalId: string;
  lang?: SourceLang | string | null;
  quality?: string | null;
  priority?: number;
}): Promise<EpisodeSourceItem | null> {
  const episodeId = input.episodeId?.trim();
  const provider = (input.provider || ANITUBE22_PROVIDER).trim().toLowerCase();
  const extracted =
    provider === ANITUBE22_PROVIDER
      ? extractAnitube22ExternalId(input.externalId)
      : input.externalId?.trim();

  if (!episodeId || !extracted) {
    return null;
  }

  const lang = normalizeSourceLang(
    typeof input.lang === "string"
      ? input.lang
      : extractAnitube22Lang(input.externalId),
  );
  const quality = input.quality?.trim() || null;
  const priority =
    typeof input.priority === "number" && Number.isFinite(input.priority)
      ? Math.max(0, Math.floor(input.priority))
      : 0;

  const sql = await getSql();
  const existing = await sql.query<{ id: string }>(
    `SELECT "id" FROM "episode_sources"
     WHERE "episode_id" = $1
       AND "provider" = $2
       AND "external_id" = $3
       AND "lang" = $4
     LIMIT 1;`,
    [episodeId, provider, extracted, lang],
  );

  if (existing[0]?.id) {
    const updated = await sql.query<RawEpisodeSourceRow>(
      `UPDATE "episode_sources"
       SET
         "quality" = COALESCE($2, "quality"),
         "priority" = $3,
         "status" = 'active',
         "fail_count" = 0,
         "page_url" = NULL,
         "direct_url" = NULL
       WHERE "id" = $1
       RETURNING
         "id", "episode_id", "provider", "external_id", "lang", "quality",
         "priority", "status", "fail_count", "last_checked_at",
         "page_url", "direct_url", "resolved_at";`,
      [existing[0].id, quality, priority],
    );
    return updated[0] ? mapSourceRow(updated[0]) : null;
  }

  const inserted = await sql.query<RawEpisodeSourceRow>(
    `INSERT INTO "episode_sources" (
       "episode_id", "provider", "external_id", "lang", "quality",
       "priority", "status", "fail_count", "last_checked_at",
       "page_url", "direct_url"
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'active', 0, NULL, NULL, NULL)
     RETURNING
       "id", "episode_id", "provider", "external_id", "lang", "quality",
       "priority", "status", "fail_count", "last_checked_at",
       "page_url", "direct_url", "resolved_at";`,
    [episodeId, provider, extracted, lang, quality, priority],
  );

  return inserted[0] ? mapSourceRow(inserted[0]) : null;
}

/**
 * Sincroniza fontes anitube22 salvas nos slots Player 1..5 com a tabela `episode_sources`,
 * armazenando exclusivamente identificadores duráveis (sem `time=` nem URL assinada).
 */
export async function syncCatalogEpisodeSlotsToSources(
  episodeId: string,
  slots: Array<{
    url?: string | null;
    priority: number;
    lang?: SourceLang | string | null;
    quality?: string | null;
  }>,
  options?: { replaceAnitube22?: boolean },
): Promise<EpisodeSourceItem[]> {
  const cleanEpId = episodeId?.trim();
  if (!cleanEpId) return [];

  const desiredKeys = new Set<string>();
  const saved: EpisodeSourceItem[] = [];

  for (const slot of slots) {
    const extId = extractAnitube22ExternalId(slot.url);
    if (!extId) continue;
    const lang = normalizeSourceLang(
      typeof slot.lang === "string" ? slot.lang : extractAnitube22Lang(slot.url),
    );
    desiredKeys.add(`${lang}:${extId}`);
    const row = await upsertEpisodeSource({
      episodeId: cleanEpId,
      provider: ANITUBE22_PROVIDER,
      externalId: extId,
      lang,
      quality: slot.quality ?? null,
      priority: slot.priority,
    });
    if (row) saved.push(row);
  }

  if (options?.replaceAnitube22 && desiredKeys.size > 0) {
    const sql = await getSql();
    const existingRows = await sql.query<{
      id: string;
      external_id: string | null;
      lang: string | null;
    }>(
      `SELECT "id", "external_id", "lang"
       FROM "episode_sources"
       WHERE "episode_id" = $1 AND "provider" = $2;`,
      [cleanEpId, ANITUBE22_PROVIDER],
    );

    for (const row of existingRows) {
      const key = `${normalizeSourceLang(row.lang)}:${row.external_id || ""}`;
      if (!desiredKeys.has(key)) {
        await sql.query(`DELETE FROM "episode_sources" WHERE "id" = $1;`, [row.id]);
      }
    }
  }

  return saved;
}

export async function deleteEpisodeSourcesForEpisode(episodeId: string): Promise<void> {
  const cleanEpId = episodeId?.trim();
  if (!cleanEpId) return;
  const sql = await getSql();
  await sql.query(`DELETE FROM "episode_sources" WHERE "episode_id" = $1;`, [cleanEpId]);
}

export async function deleteEpisodeSourceById(sourceId: string): Promise<boolean> {
  const cleanId = sourceId?.trim();
  if (!cleanId) return false;
  const sql = await getSql();
  const rows = await sql.query<{ id: string }>(
    `DELETE FROM "episode_sources" WHERE "id" = $1 RETURNING "id";`,
    [cleanId],
  );
  return Boolean(rows[0]?.id);
}

/**
 * Registra o resultado da verificação do índice da fonte:
 * - Erro de rede do cliente: nunca incrementa fail_count e nunca marca como 'broken'.
 * - HTTP 4xx/5xx do índice: incrementa fail_count e marca status = 'broken' apenas após 2 falhas consecutivas.
 * - HTTP 2xx/3xx: zera fail_count e garante status = 'active'.
 */
export async function recordEpisodeSourceIndexResult(input: {
  sourceId: string;
  httpStatus?: number | null;
  clientNetworkError?: boolean;
}): Promise<{
  updated: boolean;
  status?: SourceStatus;
  failCount?: number;
  lastCheckedAt?: string | null;
}> {
  const cleanId = input.sourceId?.trim();
  if (!cleanId) return { updated: false };

  if (input.clientNetworkError) {
    return { updated: false };
  }

  const statusCode = input.httpStatus;
  if (typeof statusCode !== "number" || !Number.isFinite(statusCode)) {
    return { updated: false };
  }

  const sql = await getSql();

  if (statusCode >= 200 && statusCode < 400) {
    const rows = await sql.query<{
      status: string;
      fail_count: number;
      last_checked_at: string | null;
    }>(
      `UPDATE "episode_sources"
       SET
         "fail_count" = 0,
         "status" = 'active',
         "last_checked_at" = NOW()
       WHERE "id" = $1
       RETURNING "status", "fail_count", "last_checked_at";`,
      [cleanId],
    );
    if (!rows[0]) return { updated: false };
    return {
      updated: true,
      status: rows[0].status === "broken" ? "broken" : "active",
      failCount: rows[0].fail_count,
      lastCheckedAt: rows[0].last_checked_at,
    };
  }

  if (statusCode >= 400 && statusCode <= 599) {
    const rows = await sql.query<{
      status: string;
      fail_count: number;
      last_checked_at: string | null;
    }>(
      `UPDATE "episode_sources"
       SET
         "fail_count" = COALESCE("fail_count", 0) + 1,
         "status" = CASE
           WHEN COALESCE("fail_count", 0) + 1 >= 2 THEN 'broken'
           ELSE 'active'
         END,
         "last_checked_at" = NOW()
       WHERE "id" = $1
       RETURNING "status", "fail_count", "last_checked_at";`,
      [cleanId],
    );
    if (!rows[0]) return { updated: false };
    return {
      updated: true,
      status: rows[0].status === "broken" ? "broken" : "active",
      failCount: rows[0].fail_count,
      lastCheckedAt: rows[0].last_checked_at,
    };
  }

  return { updated: false };
}

/**
 * Verifica no servidor se o índice `playerricas.php` para um `external_id` do anitube22
 * está respondendo (2xx/3xx) ou retornando erro 4xx/5xx.
 * Erros de transporte/rede são classificados como `networkError: true` e não invalidam a fonte.
 */
export async function probeAnitube22SourceIndex(
  externalId: string,
  options?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<{
  ok: boolean;
  httpStatus: number | null;
  networkError: boolean;
}> {
  const cleanExtId = extractAnitube22ExternalId(externalId);
  if (!cleanExtId) {
    return { ok: false, httpStatus: 400, networkError: false };
  }

  const runtimeUrl = buildAnitube22PlayerUrl(cleanExtId);
  const fetchFn = options?.fetchImpl ?? fetch;

  try {
    const res = await fetchFn(runtimeUrl, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(options?.timeoutMs ?? 6000),
    });

    try {
      await res.body?.cancel();
    } catch {
      // ignore body cancel errors
    }

    if (res.status >= 400) {
      return { ok: false, httpStatus: res.status, networkError: false };
    }
    return { ok: true, httpStatus: res.status, networkError: false };
  } catch {
    return { ok: false, httpStatus: null, networkError: true };
  }
}

/**
 * Verifica um registro de `episode_sources` por ID e atualiza `fail_count`/`status` apenas em resposta HTTP real.
 */
export async function checkAndRecordEpisodeSource(
  sourceId: string,
  options?: {
    clientOffline?: boolean;
    fetchImpl?: typeof fetch;
  },
): Promise<{
  sourceId: string;
  ok: boolean;
  httpStatus: number | null;
  clientNetworkError: boolean;
  status: SourceStatus;
  failCount: number;
}> {
  const cleanId = sourceId?.trim();
  if (!cleanId) {
    return {
      sourceId: "",
      ok: false,
      httpStatus: null,
      clientNetworkError: true,
      status: "active",
      failCount: 0,
    };
  }

  if (options?.clientOffline) {
    return {
      sourceId: cleanId,
      ok: false,
      httpStatus: null,
      clientNetworkError: true,
      status: "active",
      failCount: 0,
    };
  }

  const sql = await getSql();
  const rows = await sql.query<RawEpisodeSourceRow>(
    `SELECT
       "id", "episode_id", "provider", "external_id", "lang", "quality",
       "priority", "status", "fail_count", "last_checked_at",
       "page_url", "direct_url", "resolved_at"
     FROM "episode_sources"
     WHERE "id" = $1
     LIMIT 1;`,
    [cleanId],
  );

  const row = rows[0];
  if (!row) {
    return {
      sourceId: cleanId,
      ok: false,
      httpStatus: 404,
      clientNetworkError: false,
      status: "broken",
      failCount: 2,
    };
  }

  const mapped = mapSourceRow(row);
  if (mapped.provider !== ANITUBE22_PROVIDER || !mapped.externalId) {
    return {
      sourceId: cleanId,
      ok: true,
      httpStatus: 200,
      clientNetworkError: false,
      status: mapped.status,
      failCount: mapped.failCount,
    };
  }

  const probe = await probeAnitube22SourceIndex(mapped.externalId, {
    fetchImpl: options?.fetchImpl,
  });

  if (probe.networkError) {
    return {
      sourceId: cleanId,
      ok: false,
      httpStatus: null,
      clientNetworkError: true,
      status: mapped.status,
      failCount: mapped.failCount,
    };
  }

  const recorded = await recordEpisodeSourceIndexResult({
    sourceId: cleanId,
    httpStatus: probe.httpStatus,
    clientNetworkError: false,
  });

  return {
    sourceId: cleanId,
    ok: probe.ok,
    httpStatus: probe.httpStatus,
    clientNetworkError: false,
    status: recorded.status ?? mapped.status,
    failCount: recorded.failCount ?? mapped.failCount,
  };
}

/**
 * Resolve a fonte do episódio a partir da tabela episode_sources.
 * Para provedor anitube22, gera apenas a URL de iframe em runtime sem armazenar `time=` nem usar proxy.
 */
export async function resolveEpisode(
  episodeId: string,
  fallbackIframeUrl?: string | null,
): Promise<ResolvedEpisodeSource> {
  const iframeUrl = fallbackIframeUrl ?? null;
  const cleanEpId = episodeId?.trim();
  if (!cleanEpId) {
    return { directUrl: null, iframeUrl, unavailable: true };
  }

  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;
  const safetyMarginMs = 30000;

  try {
    const sql = await getSql();
    const rows = await sql.query<RawEpisodeSourceRow>(
      `SELECT
         "id", "episode_id", "provider", "external_id", "lang", "quality",
         "priority", "status", "fail_count", "last_checked_at",
         "page_url", "direct_url", "resolved_at"
       FROM "episode_sources"
       WHERE "episode_id" = $1
         AND COALESCE("status", 'active') <> 'broken'
       ORDER BY "priority" ASC, "created_at" ASC
       LIMIT 1;`,
      [cleanEpId],
    );

    const sourceRecord = rows[0];
    if (sourceRecord) {
      const mapped = mapSourceRow(sourceRecord);
      if (mapped.provider === ANITUBE22_PROVIDER && mapped.externalId) {
        return {
          directUrl: null,
          iframeUrl: buildAnitube22PlayerUrl(mapped.externalId),
          provider: ANITUBE22_PROVIDER,
          unavailable: false,
        };
      }
    }

    const cached = await getRedisEpisodeSource(cleanEpId);
    if (cached && cached.directUrl && cached.provider !== ANITUBE22_PROVIDER) {
      const cachedResolvedAtTime = cached.resolvedAt
        ? new Date(cached.resolvedAt).getTime()
        : 0;
      const remainingMs = tenMinutes - (now - cachedResolvedAtTime);
      if (
        remainingMs > safetyMarginMs &&
        now - cachedResolvedAtTime <= tenMinutes
      ) {
        const proxyDirectUrl = cached.directUrl.startsWith("http")
          ? `/api/hls?u=${encodeURIComponent(cached.directUrl)}`
          : cached.directUrl;
        return {
          directUrl: proxyDirectUrl,
          iframeUrl,
          provider: cached.provider,
          unavailable: false,
        };
      }
    }

    if (!sourceRecord || !sourceRecord.page_url) {
      return { directUrl: null, iframeUrl, unavailable: true };
    }

    const lockToken =
      Math.random().toString(36).substring(2) + Date.now().toString(36);
    const { acquired, generation } = await acquireEpisodeResolutionLock(
      cleanEpId,
      lockToken,
    );

    let directUrl = sourceRecord.direct_url;
    let resolvedAtStr = sourceRecord.resolved_at;
    const resolvedAtTime = sourceRecord.resolved_at
      ? new Date(sourceRecord.resolved_at).getTime()
      : 0;

    if (!directUrl || Date.now() - resolvedAtTime > tenMinutes) {
      try {
        const workerResolveUrl = `https://hikari-hls.workers.dev/resolve?page_url=${encodeURIComponent(sourceRecord.page_url)}`;
        const res = await fetch(workerResolveUrl, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = (await res.json()) as { directUrl?: string };
          if (data?.directUrl) {
            directUrl = data.directUrl;
            await sql.query(
              `UPDATE "episode_sources" SET "direct_url" = $1, "resolved_at" = NOW() WHERE "id" = $2;`,
              [directUrl, sourceRecord.id],
            );
            resolvedAtStr = new Date().toISOString();
            await invalidateRedisEpisodeSource(cleanEpId);
          }
        }
      } catch {
        // Falha na re-resolução de rede
      }
    }

    if (acquired) {
      await releaseEpisodeResolutionLock(cleanEpId, lockToken);
    }

    if (!directUrl) {
      return { directUrl: null, iframeUrl, unavailable: true };
    }

    const finalResolvedAtTime = resolvedAtStr
      ? new Date(resolvedAtStr).getTime()
      : Date.now();
    const remainingMs = tenMinutes - (Date.now() - finalResolvedAtTime);
    const ttlSec = Math.floor((remainingMs - safetyMarginMs) / 1000);

    if (ttlSec > 10) {
      await setRedisEpisodeSourceWithFence(
        cleanEpId,
        {
          directUrl,
          iframeUrl,
          provider: sourceRecord.provider,
          resolvedAt: resolvedAtStr ?? new Date().toISOString(),
          pageUrl: sourceRecord.page_url,
        },
        ttlSec,
        generation,
      );
    }

    const proxyDirectUrl = directUrl.startsWith("http")
      ? `/api/hls?u=${encodeURIComponent(directUrl)}`
      : directUrl;

    return {
      directUrl: proxyDirectUrl,
      iframeUrl,
      provider: sourceRecord.provider,
      unavailable: false,
    };
  } catch (err) {
    console.warn("[Hikari] Falha segura ao resolver fonte do episódio:", err);
    return { directUrl: null, iframeUrl, unavailable: true };
  }
}
