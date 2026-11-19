import { getSql } from "@/lib/db";
import {
  ANITUBE22_PROVIDER,
  ANITUBE22_THUMB_BASE,
  ANITUBE22_R2_BASE,
  buildAnitube22PlayerUrl,
  buildAnitube22PlayerUrlFromParts,
  extractAnitube22ExternalId,
  extractAnitube22Lang,
  normalizeSourceLang,
  parseAnitube22PlayerUrl,
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
  name_path: string | null;
  url_path: string | null;
  img_url: string | null;
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
  const status =
    row.status === "broken"
      ? "broken"
      : row.status === "incomplete"
        ? "incomplete"
        : (!row.name_path || !row.url_path) && row.provider === ANITUBE22_PROVIDER
          ? "incomplete"
          : "active";
  return {
    id: row.id,
    episodeId: row.episode_id,
    provider: row.provider,
    externalId,
    lang: normalizeSourceLang(row.lang),
    quality: row.quality ?? null,
    priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : 0,
    status,
    failCount: Number.isFinite(Number(row.fail_count)) ? Number(row.fail_count) : 0,
    lastCheckedAt: row.last_checked_at ?? null,
    namePath: row.name_path ?? null,
    urlPath: row.url_path ?? null,
    imgUrl: row.img_url ?? null,
  };
}

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
    conditions.push(`COALESCE("status", 'active') NOT IN ('broken', 'incomplete')`);
  } else {
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
       "name_path",
       "url_path",
       "img_url",
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

export async function upsertEpisodeSource(input: {
  episodeId: string;
  provider?: string;
  externalId?: string;
  fullUrl?: string;
  namePath?: string;
  urlPath?: string;
  imgUrl?: string;
  lang?: SourceLang | string | null;
  quality?: string | null;
  priority?: number;
}): Promise<EpisodeSourceItem> {
  const episodeId = input.episodeId?.trim();
  const provider = (input.provider || ANITUBE22_PROVIDER).trim().toLowerCase();

  let namePath = input.namePath?.trim() || "";
  let urlPath = input.urlPath?.trim() || "";
  let imgUrl = input.imgUrl?.trim() || "";
  let extId = input.externalId?.trim() || "";

  const fullInput = input.fullUrl || input.externalId || "";
  const parsed = parseAnitube22PlayerUrl(fullInput);
  if (parsed) {
    extId = parsed.externalId;
    namePath = parsed.namePath;
    urlPath = parsed.urlPath;
    imgUrl = parsed.imgUrl;
  } else if (!extId && namePath) {
    const m = namePath.match(/(\d+)\.mp4/i);
    if (m) extId = m[1];
  } else if (!extId && fullInput && /^\d{3,16}$/.test(fullInput)) {
    extId = fullInput;
  }

  if (extId && (!namePath || !urlPath)) {
    namePath = namePath || `apphd/${extId}.mp4`;
    urlPath = urlPath || `${ANITUBE22_R2_BASE}/${extId}.mp4`;
    imgUrl = imgUrl || `${ANITUBE22_THUMB_BASE}/${extId}/default.jpg`;
  }

  if (!episodeId || !extId || !namePath || !urlPath) {
    throw new Error("URL completa do player anitube22 (com name e url) é obrigatória.");
  }

  const lang = normalizeSourceLang(
    typeof input.lang === "string" ? input.lang : (parsed?.lang || extractAnitube22Lang(fullInput)),
  );

  const sql = await getSql();
  const epRows = await sql.query<{ title?: string }>(
    `SELECT "title" FROM "catalog_episode" WHERE "id" = $1 LIMIT 1;`,
    [episodeId],
  );
  if (epRows[0]?.title) {
    const epTitle = epRows[0].title.toLowerCase();
    const isEpisodeDubbed = /\bdub\b|\bdublado\b|\bdublada\b|\bdublagem\b|\bpt-br\b/i.test(epTitle);
    const isEpisodeSubbed = /\bleg\b|\blegendado\b|\blegendada\b|\bsub\b|\bsubbed\b|\boriginal\b/i.test(epTitle);
    const isSourceDub = lang === "dub";

    if (isEpisodeDubbed && !isSourceDub) {
      throw new Error("O idioma da fonte (legendado) não corresponde ao episódio (dublado).");
    }
    if (isEpisodeSubbed && isSourceDub) {
      throw new Error("O idioma da fonte (dublado) não corresponde ao episódio (legendado).");
    }
  }

  if (provider === ANITUBE22_PROVIDER) {
    const probe = await probeAnitube22SourceIndex({ externalId: extId, namePath, urlPath, imgUrl });
    if (!probe.networkError && probe.httpStatus === 404) {
      throw new Error("ID não encontrado no provedor.");
    }
  }

  const quality = input.quality?.trim() || null;
  const priority =
    typeof input.priority === "number" && Number.isFinite(input.priority)
      ? Math.max(0, Math.floor(input.priority))
      : 0;

  // Chave única: (episode_id, provider, lang, url_path)
  const existing = await sql.query<{ id: string }>(
    `SELECT "id" FROM "episode_sources"
     WHERE "episode_id" = $1
       AND "provider" = $2
       AND "lang" = $3
       AND "url_path" = $4
     LIMIT 1;`,
    [episodeId, provider, lang, urlPath],
  );

  if (existing[0]?.id) {
    const updated = await sql.query<RawEpisodeSourceRow>(
      `UPDATE "episode_sources"
       SET
         "external_id" = $2,
         "name_path" = $3,
         "img_url" = $4,
         "quality" = COALESCE($5, "quality"),
         "priority" = $6,
         "status" = 'active',
         "fail_count" = 0,
         "page_url" = NULL,
         "direct_url" = NULL
       WHERE "id" = $1
       RETURNING
         "id", "episode_id", "provider", "external_id", "lang", "quality",
         "priority", "status", "fail_count", "last_checked_at",
         "name_path", "url_path", "img_url", "page_url", "direct_url", "resolved_at";`,
      [existing[0].id, extId, namePath, imgUrl, quality, priority],
    );
    return updated[0] ? mapSourceRow(updated[0]) : null!;
  }

  const inserted = await sql.query<RawEpisodeSourceRow>(
    `INSERT INTO "episode_sources" (
       "episode_id", "provider", "external_id", "lang", "quality",
       "priority", "status", "fail_count", "name_path", "url_path", "img_url",
       "page_url", "direct_url"
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'active', 0, $7, $8, $9, NULL, NULL)
     RETURNING
       "id", "episode_id", "provider", "external_id", "lang", "quality",
       "priority", "status", "fail_count", "last_checked_at",
       "name_path", "url_path", "img_url", "page_url", "direct_url", "resolved_at";`,
    [episodeId, provider, extId, lang, quality, priority, namePath, urlPath, imgUrl],
  );

  return inserted[0] ? mapSourceRow(inserted[0]) : null!;
}

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
    if (!slot.url) continue;
    const parsed = parseAnitube22PlayerUrl(slot.url);
    const extId = parsed?.externalId || extractAnitube22ExternalId(slot.url);
    if (!extId) continue;
    const lang = normalizeSourceLang(
      typeof slot.lang === "string" ? slot.lang : (parsed?.lang || extractAnitube22Lang(slot.url)),
    );
    const urlPath = parsed?.urlPath || slot.url;
    desiredKeys.add(`${lang}:${urlPath}`);
    try {
      const row = await upsertEpisodeSource({
        episodeId: cleanEpId,
        provider: ANITUBE22_PROVIDER,
        fullUrl: slot.url,
        externalId: extId,
        lang,
        quality: slot.quality ?? null,
        priority: slot.priority,
      });
      if (row) saved.push(row);
    } catch {
      // ignore invalid or 404 sources during batch sync
    }
  }

  if (options?.replaceAnitube22 && desiredKeys.size > 0) {
    const sql = await getSql();
    const existingRows = await sql.query<{
      id: string;
      url_path: string | null;
      lang: string | null;
    }>(
      `SELECT "id", "url_path", "lang"
       FROM "episode_sources"
       WHERE "episode_id" = $1 AND "provider" = $2;`,
      [cleanEpId, ANITUBE22_PROVIDER],
    );

    for (const row of existingRows) {
      const key = `${normalizeSourceLang(row.lang)}:${row.url_path || ""}`;
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

export async function probeAnitube22SourceIndex(
  input: string | { externalId: string; namePath: string; urlPath: string; imgUrl?: string },
  options?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<{
  ok: boolean;
  httpStatus: number | null;
  networkError: boolean;
}> {
  let runtimeUrl = "";
  if (typeof input === "object" && input !== null && input.namePath && input.urlPath) {
    runtimeUrl = buildAnitube22PlayerUrlFromParts({
      namePath: input.namePath,
      urlPath: input.urlPath,
      imgUrl: input.imgUrl || `${ANITUBE22_THUMB_BASE}/${input.externalId}/default.jpg`,
    });
  } else {
    const cleanExtId = extractAnitube22ExternalId(typeof input === "string" ? input : input.externalId);
    if (!cleanExtId) {
      return { ok: false, httpStatus: 400, networkError: false };
    }
    runtimeUrl = buildAnitube22PlayerUrl(cleanExtId);
  }

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
      // ignore
    }

    if (res.status >= 400) {
      return { ok: false, httpStatus: res.status, networkError: false };
    }
    return { ok: true, httpStatus: res.status, networkError: false };
  } catch {
    return { ok: false, httpStatus: null, networkError: true };
  }
}

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
       "name_path", "url_path", "img_url", "page_url", "direct_url", "resolved_at"
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
  if (mapped.provider !== ANITUBE22_PROVIDER || (!mapped.namePath && !mapped.externalId)) {
    return {
      sourceId: cleanId,
      ok: true,
      httpStatus: 200,
      clientNetworkError: false,
      status: mapped.status,
      failCount: mapped.failCount,
    };
  }

  const probe = await probeAnitube22SourceIndex({
    externalId: mapped.externalId,
    namePath: row.name_path || `apphd/${mapped.externalId}.mp4`,
    urlPath: row.url_path || `${ANITUBE22_R2_BASE}/${mapped.externalId}.mp4`,
    imgUrl: row.img_url || undefined,
  }, {
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
         "name_path", "url_path", "img_url", "page_url", "direct_url", "resolved_at"
       FROM "episode_sources"
       WHERE "episode_id" = $1
         AND COALESCE("status", 'active') NOT IN ('broken', 'incomplete')
       ORDER BY "priority" ASC, "created_at" ASC
       LIMIT 1;`,
      [cleanEpId],
    );

    const sourceRecord = rows[0];
    if (sourceRecord) {
      const mapped = mapSourceRow(sourceRecord);
      if (mapped.provider === ANITUBE22_PROVIDER && mapped.externalId) {
        const resolvedIframeUrl =
          sourceRecord.name_path && sourceRecord.url_path
            ? buildAnitube22PlayerUrlFromParts({
                namePath: sourceRecord.name_path,
                urlPath: sourceRecord.url_path,
                imgUrl: sourceRecord.img_url || `${ANITUBE22_THUMB_BASE}/${mapped.externalId}/default.jpg`,
              })
            : buildAnitube22PlayerUrl(mapped.externalId);

        return {
          directUrl: null,
          iframeUrl: resolvedIframeUrl,
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
