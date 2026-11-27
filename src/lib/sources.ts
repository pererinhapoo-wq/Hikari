import { getSql } from "@/lib/db";
import {
  ANITUBE22_INVALID_URL_ERROR,
  ANITUBE22_NOT_FOUND_ERROR,
  ANITUBE22_PROVIDER,
  ANITUBE22_WRONG_LANG_ERROR,
  buildAnitube22PlayerUrlFromParts,
  detectEpisodeLanguageHint,
  normalizeSourceLang,
  parseAnitube22PlayerUrl,
  parseExplicitSourceLang,
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

export class SourceValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "SourceValidationError";
    this.statusCode = statusCode;
  }
}

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

function extractNumericMp4Id(value?: string | null): string {
  if (!value || typeof value !== "string") return "";
  return value.match(/(\d+)\.mp4/i)?.[1] || "";
}

function mapSourceRow(row: RawEpisodeSourceRow): EpisodeSourceItem {
  const namePath = row.name_path?.trim() || null;
  const urlPath = row.url_path?.trim() || null;
  const imgUrl = row.img_url?.trim() || null;

  const externalId =
    (row.external_id && row.external_id.trim()) ||
    extractNumericMp4Id(namePath) ||
    extractNumericMp4Id(urlPath) ||
    "";

  const hasRequiredAnitubePaths =
    row.provider !== ANITUBE22_PROVIDER || (Boolean(namePath) && Boolean(urlPath));

  const status: SourceStatus = !hasRequiredAnitubePaths
    ? "incomplete"
    : row.status === "broken"
      ? "broken"
      : row.status === "incomplete"
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
    namePath,
    urlPath,
    imgUrl,
  };
}

async function getEpisodeLanguageHintFromDb(episodeId: string): Promise<SourceLang | null> {
  const sql = await getSql();
  const rows = await sql.query<{
    episodeAudio: string | null;
    episodeTitle: string | null;
    seasonTitle: string | null;
    animeTitle: string | null;
    animeTitleEnglish: string | null;
    animeTitleNative: string | null;
  }>(
    `SELECT
       e."audio" AS "episodeAudio",
       e."title" AS "episodeTitle",
       s."title" AS "seasonTitle",
       a."title" AS "animeTitle",
       a."titleEnglish" AS "animeTitleEnglish",
       a."titleNative" AS "animeTitleNative"
     FROM "catalog_episode" e
     LEFT JOIN "catalog_season" s
       ON s."animeId" = e."animeId" AND s."number" = e."seasonNumber"
     LEFT JOIN "catalog_anime" a
       ON a."id" = e."animeId"
     WHERE e."id" = $1
     LIMIT 1;`,
    [episodeId],
  );

  const row = rows[0];
  if (!row) return null;

  const explicitAudio = parseExplicitSourceLang(
    typeof row.episodeAudio === "string" ? row.episodeAudio : null,
  );
  if (explicitAudio) {
    return explicitAudio;
  }

  return detectEpisodeLanguageHint([
    row.episodeTitle,
    row.seasonTitle,
    row.animeTitle,
    row.animeTitleEnglish,
    row.animeTitleNative,
  ]);
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
    conditions.push(
      `("provider" <> '${ANITUBE22_PROVIDER}' OR (COALESCE("name_path", '') <> '' AND COALESCE("url_path", '') <> ''))`,
    );
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

export async function upsertEpisodeSource(
  input: {
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
  },
  options?: {
    fetchImpl?: typeof fetch;
    skipProbe?: boolean;
    expectedLangHint?: SourceLang | null;
  },
): Promise<EpisodeSourceItem> {
  const episodeId = input.episodeId?.trim();
  if (!episodeId) {
    throw new SourceValidationError("episodeId é obrigatório.", 400);
  }

  const provider = (input.provider || ANITUBE22_PROVIDER).trim().toLowerCase();

  const lang = parseExplicitSourceLang(typeof input.lang === "string" ? input.lang : null);
  if (!lang) {
    throw new SourceValidationError("Selecione o idioma da fonte (legendado ou dublado).", 400);
  }

  const fullInput = (input.fullUrl || input.externalId || "").trim();
  const parsed = parseAnitube22PlayerUrl(fullInput);

  if (!parsed) {
    throw new SourceValidationError(ANITUBE22_INVALID_URL_ERROR, 400);
  }

  const extId = parsed.externalId;
  const namePath = parsed.namePath;
  const urlPath = parsed.urlPath;
  const imgUrl = parsed.imgUrl;

  const expectedLang =
    options?.expectedLangHint !== undefined
      ? options.expectedLangHint
      : await getEpisodeLanguageHintFromDb(episodeId);
  if (expectedLang && expectedLang !== lang) {
    throw new SourceValidationError(ANITUBE22_WRONG_LANG_ERROR, 400);
  }

  if (provider === ANITUBE22_PROVIDER && !options?.skipProbe) {
    const probe = await probeAnitube22SourceIndex(
      {
        externalId: extId,
        namePath,
        urlPath,
        imgUrl,
      },
      { fetchImpl: options?.fetchImpl },
    );
    if (!probe.networkError && probe.httpStatus === 404) {
      throw new SourceValidationError(ANITUBE22_NOT_FOUND_ERROR, 404);
    }
  }

  const sql = await getSql();
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
  options?: {
    replaceAnitube22?: boolean;
    fetchImpl?: typeof fetch;
    skipProbe?: boolean;
    episodeAudio?: SourceLang | string | null;
  },
): Promise<EpisodeSourceItem[]> {
  const cleanEpId = episodeId?.trim();
  if (!cleanEpId) return [];

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

  const existingLangsByUrl = new Map<string, SourceLang[]>();
  let hasExistingDubSource = false;
  for (const row of existingRows) {
    const normalizedRowLang = normalizeSourceLang(row.lang);
    if (normalizedRowLang === "dub") {
      hasExistingDubSource = true;
    }
    const urlKey = row.url_path?.trim() || "";
    if (!urlKey) continue;
    const list = existingLangsByUrl.get(urlKey) ?? [];
    list.push(normalizedRowLang);
    existingLangsByUrl.set(urlKey, list);
  }

  const explicitEpisodeLang = parseExplicitSourceLang(
    typeof options?.episodeAudio === "string" ? options.episodeAudio : null,
  );

  const desiredKeys = new Set<string>();
  const replacedLangs = new Set<SourceLang>();
  const saved: EpisodeSourceItem[] = [];
  let cachedHint: SourceLang | null | undefined = undefined;

  for (const slot of slots) {
    if (!slot.url) continue;
    const parsed = parseAnitube22PlayerUrl(slot.url);
    if (!parsed) continue;

    if (cachedHint === undefined) {
      cachedHint = await getEpisodeLanguageHintFromDb(cleanEpId);
    }

    const explicitLang = parseExplicitSourceLang(
      typeof slot.lang === "string" ? slot.lang : null,
    );
    const existingForUrl = existingLangsByUrl.get(parsed.urlPath) ?? [];
    const preservedExistingLang: SourceLang | null =
      existingForUrl.includes("dub") && explicitLang !== "sub" && explicitEpisodeLang !== "sub"
        ? "dub"
        : existingForUrl.length === 1
          ? existingForUrl[0]
          : null;

    const effectiveHint = explicitEpisodeLang ?? cachedHint ?? null;
    const lang: SourceLang =
      explicitLang ??
      (preservedExistingLang === "dub" && !explicitEpisodeLang
        ? "dub"
        : explicitEpisodeLang ?? preservedExistingLang ?? effectiveHint ?? "sub");

    if (explicitLang) {
      replacedLangs.add(explicitLang);
    } else if (explicitEpisodeLang) {
      replacedLangs.add(explicitEpisodeLang);
    }

    desiredKeys.add(`${lang}:${parsed.urlPath}`);
    try {
      const row = await upsertEpisodeSource(
        {
          episodeId: cleanEpId,
          provider: ANITUBE22_PROVIDER,
          fullUrl: slot.url,
          externalId: parsed.externalId,
          lang,
          quality: slot.quality ?? null,
          priority: slot.priority,
        },
        {
          fetchImpl: options?.fetchImpl,
          skipProbe: options?.skipProbe,
          expectedLangHint: explicitLang ?? explicitEpisodeLang ?? cachedHint,
        },
      );
      if (row) saved.push(row);
    } catch {
      // ignore invalid or 404 sources during batch sync
    }
  }

  if (options?.replaceAnitube22 && desiredKeys.size > 0) {
    const canPruneUnclassifiedSubOnly =
      replacedLangs.size === 0 &&
      !hasExistingDubSource &&
      cachedHint !== "dub";

    const staleIds: string[] = [];
    for (const row of existingRows) {
      const rowLang = normalizeSourceLang(row.lang);
      const key = `${rowLang}:${row.url_path || ""}`;
      if (desiredKeys.has(key)) continue;

      if (rowLang === "dub") {
        // Nunca apagar fonte 'dub' existente a menos que uma substituição explícita de 'dub' tenha sido solicitada
        if (replacedLangs.has("dub")) {
          staleIds.push(row.id);
        }
        continue;
      }

      if (replacedLangs.has("sub") || canPruneUnclassifiedSubOnly) {
        staleIds.push(row.id);
      }
    }
    if (staleIds.length > 0) {
      await sql.query(
        `DELETE FROM "episode_sources" WHERE "id" = ANY($1::uuid[]);`,
        [staleIds],
      );
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
         AND COALESCE("status", 'active') <> 'incomplete'
         AND ("provider" <> '${ANITUBE22_PROVIDER}' OR (COALESCE("name_path", '') <> '' AND COALESCE("url_path", '') <> ''))
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
         AND COALESCE("status", 'active') <> 'incomplete'
         AND ("provider" <> '${ANITUBE22_PROVIDER}' OR (COALESCE("name_path", '') <> '' AND COALESCE("url_path", '') <> ''))
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

function isProviderSoft404Body(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  if (
    normalized === "deleted 404 not found" ||
    normalized === "404 not found" ||
    /^deleted\s+404\s+not\s+found\b/i.test(normalized)
  ) {
    return true;
  }
  if (normalized.length < 300 && /deleted\s*404\s*not\s*found/i.test(normalized)) {
    return true;
  }
  return false;
}

export async function probeAnitube22SourceIndex(
  input: string | { externalId?: string; namePath: string; urlPath: string; imgUrl?: string },
  options?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<{
  ok: boolean;
  httpStatus: number | null;
  networkError: boolean;
}> {
  let runtimeUrl = "";
  if (typeof input === "object" && input !== null && input.namePath?.trim() && input.urlPath?.trim()) {
    runtimeUrl = buildAnitube22PlayerUrlFromParts({
      namePath: input.namePath,
      urlPath: input.urlPath,
      imgUrl: input.imgUrl || "",
    });
  } else if (typeof input === "string") {
    const parsed = parseAnitube22PlayerUrl(input);
    if (!parsed) {
      return { ok: false, httpStatus: 400, networkError: false };
    }
    runtimeUrl = buildAnitube22PlayerUrlFromParts(parsed);
  } else {
    return { ok: false, httpStatus: 400, networkError: false };
  }

  const fetchFn = options?.fetchImpl ?? fetch;

  try {
    const res = await fetchFn(runtimeUrl, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(options?.timeoutMs ?? 6000),
    });

    const contentType = res.headers?.get("content-type")?.toLowerCase() || "";
    let bodyText = "";
    if (!contentType || contentType.includes("text") || contentType.includes("html") || contentType.includes("json")) {
      try {
        bodyText = await res.text();
      } catch {
        // ignore
      }
    } else {
      try {
        await res.body?.cancel();
      } catch {
        // ignore
      }
    }

    if (res.status >= 400) {
      return { ok: false, httpStatus: res.status, networkError: false };
    }

    if (bodyText && isProviderSoft404Body(bodyText)) {
      return { ok: false, httpStatus: 404, networkError: false };
    }

    return { ok: true, httpStatus: res.status, networkError: false };
  } catch {
    return { ok: false, httpStatus: null, networkError: true };
  }
}

export async function probeAnitube22PlayerUrl(
  rawUrl: string,
  options?: { clientOffline?: boolean; fetchImpl?: typeof fetch },
): Promise<{
  ok: boolean;
  httpStatus: number | null;
  clientNetworkError: boolean;
  status: SourceStatus;
}> {
  if (options?.clientOffline) {
    return {
      ok: false,
      httpStatus: null,
      clientNetworkError: true,
      status: "active",
    };
  }

  const parsed = parseAnitube22PlayerUrl(rawUrl);
  if (!parsed) {
    return {
      ok: false,
      httpStatus: null,
      clientNetworkError: false,
      status: "incomplete",
    };
  }

  const probe = await probeAnitube22SourceIndex(parsed, {
    fetchImpl: options?.fetchImpl,
  });

  if (probe.networkError) {
    return {
      ok: false,
      httpStatus: null,
      clientNetworkError: true,
      status: "active",
    };
  }

  return {
    ok: probe.ok,
    httpStatus: probe.httpStatus,
    clientNetworkError: false,
    status: probe.ok ? "active" : "broken",
  };
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
  if (mapped.provider !== ANITUBE22_PROVIDER) {
    return {
      sourceId: cleanId,
      ok: true,
      httpStatus: 200,
      clientNetworkError: false,
      status: mapped.status,
      failCount: mapped.failCount,
    };
  }

  if (mapped.status === "incomplete" || !row.name_path?.trim() || !row.url_path?.trim()) {
    return {
      sourceId: cleanId,
      ok: false,
      httpStatus: null,
      clientNetworkError: false,
      status: "incomplete",
      failCount: mapped.failCount,
    };
  }

  const probe = await probeAnitube22SourceIndex(
    {
      externalId: mapped.externalId,
      namePath: row.name_path,
      urlPath: row.url_path,
      imgUrl: row.img_url || "",
    },
    {
      fetchImpl: options?.fetchImpl,
    },
  );

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
         AND ("provider" <> '${ANITUBE22_PROVIDER}' OR (COALESCE("name_path", '') <> '' AND COALESCE("url_path", '') <> ''))
       ORDER BY "priority" ASC, "created_at" ASC
       LIMIT 1;`,
      [cleanEpId],
    );

    const sourceRecord = rows[0];
    if (sourceRecord) {
      const mapped = mapSourceRow(sourceRecord);
      if (
        mapped.provider === ANITUBE22_PROVIDER &&
        sourceRecord.name_path?.trim() &&
        sourceRecord.url_path?.trim()
      ) {
        const resolvedIframeUrl = buildAnitube22PlayerUrlFromParts({
          namePath: sourceRecord.name_path,
          urlPath: sourceRecord.url_path,
          imgUrl: sourceRecord.img_url || "",
        });

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
