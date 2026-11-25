import type { Sql } from "@/lib/db";

export type EpisodeHistoryEntry = {
  episodeId: string;
  seasonNumber: number;
  number: number;
};

export type CatalogAnimeIdentityRow = {
  id: string;
  title: string;
  anilistId: number | null;
  malId: number | null;
  kitsuId: number | null;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  cover: string | null;
  banner: string | null;
  synopsis: string | null;
  format: string | null;
  status: string | null;
  episodesCount: number | null;
  year: number | null;
  season: string | null;
  hidden?: boolean | null;
  archived_at?: string | null;
  episode_history?: unknown;
};

export type CatalogAnimeIdAliasRow = {
  old_id: string;
  current_id: string | null;
  anilist_id: number | null;
  mal_id: number | null;
  kitsu_id: number | null;
  title_norm: string | null;
  format: string | null;
  year: number | null;
  is_dubbed: boolean;
  episode_history: unknown;
  archived_at: string | null;
  created_at?: string | null;
  updated_at: string | null;
};

export type IdentityMatchInput = {
  id?: string | null;
  serverCatalogId?: string | null;
  anilistId?: number | null;
  malId?: number | null;
  kitsuId?: number | null;
  title?: string | null;
  titleRomaji?: string | null;
  titleEnglish?: string | null;
  titleNative?: string | null;
  format?: string | null;
  year?: number | null;
  isDubbed?: boolean | null;
};

export type CanonicalLookupResult = {
  canonicalId: string | null;
  row: CatalogAnimeIdentityRow | null;
  matchedBy: "id" | "alias" | "external_id" | "title" | null;
  resolvedFromAliasId?: string;
  aliasIds: string[];
  ambiguous: boolean;
  archivedMatchIds: string[];
};

const MAX_ALIAS_HOPS = 20;

function toEpochMs(ts: string | null | undefined): number {
  if (!ts) return 0;
  const parsed = Date.parse(ts);
  return Number.isFinite(parsed) ? parsed : 0;
}

const DUB_MARKER_REGEX =
  /(?:\((?:[^)]*\b(?:dublado|dublada|dubbed|dub|dual\s*audio|audio\s*dual|pt-?br)\b[^)]*)\)|\[(?:[^\]]*\b(?:dublado|dublada|dubbed|dub|dual\s*audio|audio\s*dual|pt-?br)\b[^\]]*)\]|\b(?:dublado|dublada|dubbed|dual\s*audio|audio\s*dual)\b|\bdub\b)/gi;

const SUB_MARKER_REGEX =
  /(?:\((?:[^)]*\b(?:legendado|legendada|subbed|sub)\b[^)]*)\)|\[(?:[^\]]*\b(?:legendado|legendada|subbed|sub)\b[^\]]*)\]|\b(?:legendado|legendada|subbed)\b)/gi;

export function parsePositiveIntId(val: unknown): number | null {
  if (typeof val === "number") {
    return Number.isSafeInteger(val) && val > 0 ? val : null;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export function parseNullableYear(val: unknown): number | null {
  if (typeof val === "number") {
    return Number.isSafeInteger(val) && val >= 1900 && val <= 2100 ? val : null;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!/^\d{4}$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return parsed >= 1900 && parsed <= 2100 ? parsed : null;
  }
  return null;
}

export function isDubbedTitleText(title: string | null | undefined): boolean {
  if (!title || typeof title !== "string") return false;
  DUB_MARKER_REGEX.lastIndex = 0;
  return DUB_MARKER_REGEX.test(title);
}

export function inferIsDubbedFromTitles(input: {
  title?: string | null;
  titleRomaji?: string | null;
  titleEnglish?: string | null;
  titleNative?: string | null;
  isDubbed?: boolean | null;
}): boolean | null {
  if (typeof input.isDubbed === "boolean") return input.isDubbed;
  const texts = [
    input.title,
    input.titleRomaji,
    input.titleEnglish,
    input.titleNative,
  ].filter((t): t is string => typeof t === "string" && t.trim().length > 0);
  if (texts.length === 0) return null;
  return texts.some((t) => isDubbedTitleText(t));
}

export function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalizes a title for structural identity comparison.
 * Removes ONLY audio markers (e.g. "(Dublado)", "[Dub]", "(Legendado)") and
 * normalizes whitespace/punctuation, while deliberately preserving sequel numbers,
 * Roman numerals, and subtitles ("2nd Season", "II", "Part 2", "Brotherhood", etc.).
 */
export function normalizeIdentityTitle(title: string | null | undefined): string {
  if (!title || typeof title !== "string") return "";
  let s = stripDiacritics(title).toLowerCase();
  // Remove audio tags first while retaining surrounding separators carefully
  DUB_MARKER_REGEX.lastIndex = 0;
  s = s.replace(DUB_MARKER_REGEX, " ");
  SUB_MARKER_REGEX.lastIndex = 0;
  s = s.replace(SUB_MARKER_REGEX, " ");
  // Normalize smart quotes, dashes, and separators without erasing numbers/letters
  s = s
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[·•・]/g, " ")
    // Replace isolated trailing separators left after removing "(Dublado)"
    .replace(/\s*[-–—:|/]+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

export function normalizeCatalogFormat(format: string | null | undefined): string {
  if (!format || typeof format !== "string") return "";
  const cleaned = stripDiacritics(format).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!cleaned) return "";
  if (cleaned === "tv_series" || cleaned === "serie" || cleaned === "series") {
    return "tv";
  }
  if (cleaned === "filme" || cleaned === "film") return "movie";
  if (cleaned === "especiais" || cleaned === "especial") return "special";
  return cleaned;
}

export function areFormatsCompatible(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeCatalogFormat(a);
  const nb = normalizeCatalogFormat(b);
  if (!na || !nb) return true;
  if (na === nb) return true;
  if (
    (na === "tv" && nb === "tv_short") ||
    (na === "tv_short" && nb === "tv")
  ) {
    return true;
  }
  return false;
}

export function areYearsCompatible(
  a: number | null | undefined,
  b: number | null | undefined,
): boolean {
  const ya = parseNullableYear(a);
  const yb = parseNullableYear(b);
  if (ya === null || yb === null) return true;
  return Math.abs(ya - yb) <= 1;
}

/**
 * Stricter fallback compatibility check when matching ONLY by normalized title
 * (without matching AniList/MAL/Kitsu external IDs).
 * - Never matches if known formats or years conflict.
 * - Never matches if known external IDs on both sides explicitly conflict.
 * - If either side lacks BOTH format and year, requires a non-trivial normalized
 *   title (>= 6 chars) so short/ambiguous titles never auto-associate blindly.
 */
export function isTitleFallbackCompatible(
  a: {
    titleNorms: string[];
    format?: string | null;
    year?: number | null;
    anilistId?: number | null;
    malId?: number | null;
    kitsuId?: number | null;
  },
  b: {
    format?: string | null;
    year?: number | null;
    anilistId?: number | null;
    malId?: number | null;
    kitsuId?: number | null;
  },
): boolean {
  if (!areFormatsCompatible(a.format, b.format)) return false;
  if (!areYearsCompatible(a.year, b.year)) return false;

  const aAnilist = parsePositiveIntId(a.anilistId);
  const bAnilist = parsePositiveIntId(b.anilistId);
  if (aAnilist !== null && bAnilist !== null && aAnilist !== bAnilist) return false;

  const aMal = parsePositiveIntId(a.malId);
  const bMal = parsePositiveIntId(b.malId);
  if (aMal !== null && bMal !== null && aMal !== bMal) return false;

  const aKitsu = parsePositiveIntId(a.kitsuId);
  const bKitsu = parsePositiveIntId(b.kitsuId);
  if (aKitsu !== null && bKitsu !== null && aKitsu !== bKitsu) return false;

  const hasAFormat = Boolean(normalizeCatalogFormat(a.format));
  const hasBFormat = Boolean(normalizeCatalogFormat(b.format));
  const hasAYear = parseNullableYear(a.year) !== null;
  const hasBYear = parseNullableYear(b.year) !== null;

  const formatVerified = hasAFormat && hasBFormat;
  const yearVerified = hasAYear && hasBYear;

  if (formatVerified && yearVerified) {
    return true;
  }
  if (formatVerified || yearVerified) {
    // One attribute verified and the other doesn't conflict — safe for >= 4 char titles
    return a.titleNorms.some((t) => t.length >= 4);
  }

  // Neither format nor year could be cross-checked on both sides: require distinctive title
  return a.titleNorms.some((t) => t.length >= 6);
}

export function collectNormalizedTitles(input: {
  title?: string | null;
  titleRomaji?: string | null;
  titleEnglish?: string | null;
  titleNative?: string | null;
}): string[] {
  const set = new Set<string>();
  for (const raw of [
    input.title,
    input.titleRomaji,
    input.titleEnglish,
    input.titleNative,
  ]) {
    const norm = normalizeIdentityTitle(raw);
    if (norm) set.add(norm);
  }
  return Array.from(set);
}

export function rowIsDubbed(row: {
  title?: string | null;
  titleRomaji?: string | null;
  titleEnglish?: string | null;
  titleNative?: string | null;
}): boolean {
  return Boolean(
    inferIsDubbedFromTitles({
      title: row.title,
      titleRomaji: row.titleRomaji,
      titleEnglish: row.titleEnglish,
      titleNative: row.titleNative,
    }),
  );
}

export function parseEpisodeHistoryArray(raw: unknown): EpisodeHistoryEntry[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      return [];
    }
  }
  const out: EpisodeHistoryEntry[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const episodeId =
      typeof obj.episodeId === "string" ? obj.episodeId.trim() : "";
    const number = Number(obj.number);
    const seasonNumber =
      obj.seasonNumber !== undefined && obj.seasonNumber !== null
        ? Number(obj.seasonNumber)
        : 1;
    if (
      episodeId &&
      Number.isFinite(number) &&
      number >= 0 &&
      Number.isFinite(seasonNumber) &&
      seasonNumber >= 0
    ) {
      out.push({
        episodeId,
        seasonNumber: Math.trunc(seasonNumber),
        number: Math.trunc(number),
      });
    }
  }
  return out;
}

export function mergeEpisodeHistory(
  existing: EpisodeHistoryEntry[],
  incoming: EpisodeHistoryEntry[],
): EpisodeHistoryEntry[] {
  const byEpisodeId = new Map<string, EpisodeHistoryEntry>();
  for (const entry of existing) {
    if (entry.episodeId) byEpisodeId.set(entry.episodeId, entry);
  }
  for (const entry of incoming) {
    if (entry.episodeId) byEpisodeId.set(entry.episodeId, entry);
  }
  return Array.from(byEpisodeId.values());
}

export function extractIdentityFromSnapshot(
  snapshot: unknown,
  fallbackId?: string | null,
): IdentityMatchInput {
  if (!snapshot || typeof snapshot !== "object") {
    const numericId = parsePositiveIntId(fallbackId);
    return {
      id: fallbackId ?? undefined,
      anilistId: numericId,
    };
  }
  const obj = snapshot as Record<string, unknown>;
  const anilistId =
    parsePositiveIntId(obj.anilistId) ?? parsePositiveIntId(fallbackId);
  const malId = parsePositiveIntId(obj.malId);
  const kitsuId = parsePositiveIntId(obj.kitsuId);
  const title = typeof obj.title === "string" ? obj.title : null;
  const titleRomaji =
    typeof obj.titleRomaji === "string" ? obj.titleRomaji : null;
  const titleEnglish =
    typeof obj.titleEnglish === "string" ? obj.titleEnglish : null;
  const titleNative =
    typeof obj.titleNative === "string" ? obj.titleNative : null;
  const format = typeof obj.format === "string" ? obj.format : null;
  const year = parseNullableYear(obj.year);
  const serverCatalogId =
    typeof obj.serverCatalogId === "string" && obj.serverCatalogId.trim()
      ? obj.serverCatalogId.trim()
      : null;

  return {
    id: serverCatalogId ?? fallbackId ?? undefined,
    serverCatalogId,
    anilistId,
    malId,
    kitsuId,
    title,
    titleRomaji,
    titleEnglish,
    titleNative,
    format,
    year,
    isDubbed: inferIsDubbedFromTitles({
      title,
      titleRomaji,
      titleEnglish,
      titleNative,
    }),
  };
}

/**
 * Follows `catalog_anime_id_alias` from `startId` up to `MAX_ALIAS_HOPS` with
 * explicit loop detection (`visited` Set). Resolves to the final active row ID
 * in `catalog_anime` if one exists.
 */
export async function resolveAliasChainTarget(
  sql: Sql,
  startId: string,
): Promise<{
  canonicalId: string | null;
  canonicalRow: CatalogAnimeIdentityRow | null;
  visitedIds: string[];
  aliasRecords: CatalogAnimeIdAliasRow[];
  isCircular: boolean;
}> {
  const cleanStart = startId.trim();
  if (!cleanStart) {
    return {
      canonicalId: null,
      canonicalRow: null,
      visitedIds: [],
      aliasRecords: [],
      isCircular: false,
    };
  }

  const visited = new Set<string>();
  const visitedIds: string[] = [];
  const aliasRecords: CatalogAnimeIdAliasRow[] = [];
  let cursor: string | null = cleanStart;
  let isCircular = false;

  for (let hop = 0; hop < MAX_ALIAS_HOPS && cursor; hop += 1) {
    if (visited.has(cursor)) {
      isCircular = true;
      break;
    }
    visited.add(cursor);
    visitedIds.push(cursor);

    const activeRows = await sql<CatalogAnimeIdentityRow>`
      SELECT "id", "title", "anilistId", "malId", "kitsuId",
             "titleRomaji", "titleEnglish", "titleNative",
             "cover", "banner", "synopsis", "format", "status",
             "episodesCount", "year", "season", "hidden", "archived_at", "episode_history"
      FROM "catalog_anime"
      WHERE "id" = ${cursor}
        AND "archived_at" IS NULL
      LIMIT 1
    `;
    if (activeRows[0]) {
      return {
        canonicalId: activeRows[0].id,
        canonicalRow: activeRows[0],
        visitedIds,
        aliasRecords,
        isCircular,
      };
    }

    const aliasRows: CatalogAnimeIdAliasRow[] = await sql<CatalogAnimeIdAliasRow>`
      SELECT "old_id", "current_id", "anilist_id", "mal_id", "kitsu_id",
             "title_norm", "format", "year", "is_dubbed", "episode_history",
             "archived_at", "created_at", "updated_at"
      FROM "catalog_anime_id_alias"
      WHERE "old_id" = ${cursor}
      LIMIT 1
    `;
    const aliasRow: CatalogAnimeIdAliasRow | undefined = aliasRows[0];
    if (!aliasRow) {
      break;
    }
    aliasRecords.push(aliasRow);
    if (!aliasRow.current_id) {
      break;
    }
    if (visited.has(aliasRow.current_id)) {
      isCircular = true;
      break;
    }
    cursor = aliasRow.current_id.trim();
  }

  return {
    canonicalId: null,
    canonicalRow: null,
    visitedIds,
    aliasRecords,
    isCircular,
  };
}

/**
 * Checks in application code (prior to DB trigger) whether writing
 * `oldId -> currentId` in `catalog_anime_id_alias` would introduce a cycle.
 */
export async function wouldCreateAliasCycle(
  sql: Sql,
  oldId: string,
  currentId: string | null,
): Promise<boolean> {
  const cleanOld = oldId.trim();
  const cleanCurrent = currentId ? currentId.trim() : null;
  if (!cleanOld || !cleanCurrent) return false;
  if (cleanOld === cleanCurrent) return true;

  let cursor: string | null = cleanCurrent;
  const visited = new Set<string>([cleanOld]);

  for (let hop = 0; hop < MAX_ALIAS_HOPS && cursor; hop += 1) {
    if (visited.has(cursor)) {
      return true;
    }
    visited.add(cursor);

    const rows: Array<{ current_id: string | null }> = await sql<{ current_id: string | null }>`
      SELECT "current_id"
      FROM "catalog_anime_id_alias"
      WHERE "old_id" = ${cursor}
      LIMIT 1
    `;
    const next: string | null = rows[0]?.current_id?.trim() ?? null;
    if (!next) break;
    if (next === cleanOld || visited.has(next)) {
      return true;
    }
    cursor = next;
  }

  return false;
}

/**
 * Safely writes or updates an alias entry `oldId -> currentId` (or tombstone if `currentId === null`),
 * preventing self-links and multi-hop cycles, and flattening any pre-existing aliases that pointed to `oldId`.
 */
export async function upsertAliasMapping(
  sql: Sql,
  params: {
    oldId: string;
    currentId: string | null;
    anilistId?: number | null;
    malId?: number | null;
    kitsuId?: number | null;
    titleNorm?: string | null;
    format?: string | null;
    year?: number | null;
    isDubbed: boolean;
    episodeHistory?: EpisodeHistoryEntry[];
    archivedAt?: string | null;
  },
): Promise<{ written: boolean; cycleRejected: boolean }> {
  const cleanOld = params.oldId.trim();
  const cleanCurrent = params.currentId ? params.currentId.trim() : null;
  if (!cleanOld) {
    return { written: false, cycleRejected: false };
  }
  if (cleanCurrent && cleanCurrent === cleanOld) {
    return { written: false, cycleRejected: true };
  }
  if (cleanCurrent && (await wouldCreateAliasCycle(sql, cleanOld, cleanCurrent))) {
    return { written: false, cycleRejected: true };
  }

  const historyJson = JSON.stringify(params.episodeHistory ?? []);
  await sql`
    INSERT INTO "catalog_anime_id_alias" (
      "old_id", "current_id", "anilist_id", "mal_id", "kitsu_id",
      "title_norm", "format", "year", "is_dubbed", "episode_history",
      "archived_at", "created_at", "updated_at"
    )
    VALUES (
      ${cleanOld},
      ${cleanCurrent},
      ${params.anilistId ?? null},
      ${params.malId ?? null},
      ${params.kitsuId ?? null},
      ${params.titleNorm ?? null},
      ${params.format ?? null},
      ${params.year ?? null},
      ${Boolean(params.isDubbed)},
      ${historyJson}::jsonb,
      ${params.archivedAt ?? null}::timestamptz,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("old_id") DO UPDATE SET
      "current_id" = EXCLUDED."current_id",
      "anilist_id" = COALESCE(EXCLUDED."anilist_id", "catalog_anime_id_alias"."anilist_id"),
      "mal_id" = COALESCE(EXCLUDED."mal_id", "catalog_anime_id_alias"."mal_id"),
      "kitsu_id" = COALESCE(EXCLUDED."kitsu_id", "catalog_anime_id_alias"."kitsu_id"),
      "title_norm" = COALESCE(EXCLUDED."title_norm", "catalog_anime_id_alias"."title_norm"),
      "format" = COALESCE(EXCLUDED."format", "catalog_anime_id_alias"."format"),
      "year" = COALESCE(EXCLUDED."year", "catalog_anime_id_alias"."year"),
      "is_dubbed" = EXCLUDED."is_dubbed",
      "episode_history" = CASE
        WHEN jsonb_array_length(EXCLUDED."episode_history") > 0 THEN EXCLUDED."episode_history"
        ELSE "catalog_anime_id_alias"."episode_history"
      END,
      "archived_at" = CASE
        WHEN EXCLUDED."current_id" IS NULL THEN COALESCE(EXCLUDED."archived_at", CURRENT_TIMESTAMP)
        ELSE NULL
      END,
      "updated_at" = CURRENT_TIMESTAMP
  `;

  if (cleanCurrent) {
    // Flatten existing aliases that previously pointed to cleanOld -> cleanCurrent directly
    await sql`
      UPDATE "catalog_anime_id_alias"
      SET "current_id" = ${cleanCurrent},
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "current_id" = ${cleanOld}
        AND "old_id" <> ${cleanCurrent}
    `;
  }

  return { written: true, cycleRejected: false };
}

/**
 * Returns all `old_id` aliases (direct and transitive) pointing to `canonicalId`,
 * safely guarded against circular links.
 */
export async function getAllAliasIdsForCanonical(
  sql: Sql,
  canonicalId: string,
): Promise<string[]> {
  const cleanId = canonicalId.trim();
  if (!cleanId) return [];

  const collected = new Set<string>();
  let frontier = [cleanId];
  const visitedTargets = new Set<string>([cleanId]);

  for (let depth = 0; depth < MAX_ALIAS_HOPS && frontier.length > 0; depth += 1) {
    const rows = await sql<{ old_id: string }>`
      SELECT "old_id"
      FROM "catalog_anime_id_alias"
      WHERE "current_id" = ANY(${frontier})
    `;
    const nextFrontier: string[] = [];
    for (const row of rows) {
      const oldId = row.old_id?.trim();
      if (!oldId || oldId === cleanId) continue;
      if (!collected.has(oldId)) {
        collected.add(oldId);
      }
      if (!visitedTargets.has(oldId)) {
        visitedTargets.add(oldId);
        nextFrontier.push(oldId);
      }
    }
    frontier = nextFrontier;
  }

  return Array.from(collected);
}

/**
 * Finds all candidate active `catalog_anime` rows matching normalized title,
 * format, year, and dub status. Returns ambiguous=true if >1 distinct rows match.
 */
async function matchActiveCatalogByTitleAndAttributes(
  sql: Sql,
  params: {
    titles: string[];
    format?: string | null;
    year?: number | null;
    isDubbed: boolean | null;
    anilistId?: number | null;
    malId?: number | null;
    kitsuId?: number | null;
  },
): Promise<{
  match: CatalogAnimeIdentityRow | null;
  ambiguous: boolean;
}> {
  if (params.titles.length === 0) {
    return { match: null, ambiguous: false };
  }

  const activeRows = await sql<CatalogAnimeIdentityRow>`
    SELECT "id", "title", "anilistId", "malId", "kitsuId",
           "titleRomaji", "titleEnglish", "titleNative",
           "cover", "banner", "synopsis", "format", "status",
           "episodesCount", "year", "season", "hidden", "archived_at", "episode_history"
    FROM "catalog_anime"
    WHERE "archived_at" IS NULL
  `;

  if (activeRows.length === 0) {
    return { match: null, ambiguous: false };
  }

  const aliasTextByAnimeId = new Map<string, string[]>();
  try {
    const aliasTextRows = await sql<{ anime_id: string; alias: string }>`
      SELECT aa."anime_id", aa."alias"
      FROM "anime_alias" aa
      INNER JOIN "catalog_anime" ca ON ca."id" = aa."anime_id"
      WHERE ca."archived_at" IS NULL
    `;
    for (const r of aliasTextRows) {
      const norm = normalizeIdentityTitle(r.alias);
      if (!norm) continue;
      const list = aliasTextByAnimeId.get(r.anime_id) ?? [];
      list.push(norm);
      aliasTextByAnimeId.set(r.anime_id, list);
    }
  } catch {
    // anime_alias table might not be populated
  }

  const titleSet = new Set(params.titles);
  const candidates: CatalogAnimeIdentityRow[] = [];

  for (const row of activeRows) {
    const rowDubbed = rowIsDubbed(row);
    if (params.isDubbed !== null && rowDubbed !== params.isDubbed) {
      continue;
    }

    const rowNormTitles = collectNormalizedTitles({
      title: row.title,
      titleRomaji: row.titleRomaji,
      titleEnglish: row.titleEnglish,
      titleNative: row.titleNative,
    });
    const extraAliases = aliasTextByAnimeId.get(row.id) ?? [];
    const matchedNorms = Array.from(
      new Set([
        ...rowNormTitles.filter((t) => titleSet.has(t)),
        ...extraAliases.filter((t) => titleSet.has(t)),
      ]),
    );
    if (matchedNorms.length === 0) {
      continue;
    }

    if (
      !isTitleFallbackCompatible(
        {
          titleNorms: matchedNorms,
          format: params.format,
          year: params.year,
          anilistId: params.anilistId,
          malId: params.malId,
          kitsuId: params.kitsuId,
        },
        {
          format: row.format,
          year: row.year,
          anilistId: row.anilistId,
          malId: row.malId,
          kitsuId: row.kitsuId,
        },
      )
    ) {
      continue;
    }

    candidates.push(row);
  }

  if (candidates.length === 1) {
    return { match: candidates[0], ambiguous: false };
  }
  if (candidates.length > 1) {
    return { match: null, ambiguous: true };
  }
  return { match: null, ambiguous: false };
}

/**
 * Finds archived tombstones in `catalog_anime_id_alias` (`current_id IS NULL`)
 * matching external IDs or unambiguous compatible title+format+year+isDubbed.
 */
export async function findMatchingTombstoneAliases(
  sql: Sql,
  input: IdentityMatchInput,
): Promise<CatalogAnimeIdAliasRow[]> {
  const anilistId = parsePositiveIntId(input.anilistId);
  const malId = parsePositiveIntId(input.malId);
  const kitsuId = parsePositiveIntId(input.kitsuId);
  const normTitles = collectNormalizedTitles(input);
  const inputDubbed = inferIsDubbedFromTitles(input);

  const tombstones = await sql<CatalogAnimeIdAliasRow>`
    SELECT "old_id", "current_id", "anilist_id", "mal_id", "kitsu_id",
           "title_norm", "format", "year", "is_dubbed", "episode_history",
           "archived_at", "created_at", "updated_at"
    FROM "catalog_anime_id_alias"
    WHERE "current_id" IS NULL
    ORDER BY COALESCE("archived_at", "updated_at") DESC
  `;

  const extMatched: CatalogAnimeIdAliasRow[] = [];
  const titleMatched: CatalogAnimeIdAliasRow[] = [];
  const normSet = new Set(normTitles);

  for (const row of tombstones) {
    const dubMatches =
      inputDubbed === null ? true : Boolean(row.is_dubbed) === inputDubbed;
    if (!dubMatches) continue;

    const extMatch =
      (anilistId !== null && row.anilist_id === anilistId) ||
      (malId !== null && row.mal_id === malId) ||
      (kitsuId !== null && row.kitsu_id === kitsuId);

    if (extMatch) {
      extMatched.push(row);
      continue;
    }

    const rowNorm = row.title_norm ? normalizeIdentityTitle(row.title_norm) : "";
    if (
      rowNorm &&
      normSet.has(rowNorm) &&
      isTitleFallbackCompatible(
        {
          titleNorms: [rowNorm],
          format: input.format,
          year: input.year,
          anilistId,
          malId,
          kitsuId,
        },
        {
          format: row.format,
          year: row.year,
          anilistId: row.anilist_id,
          malId: row.mal_id,
          kitsuId: row.kitsu_id,
        },
      )
    ) {
      titleMatched.push(row);
    }
  }

  if (extMatched.length > 0) {
    return extMatched;
  }

  // Only return title-matched tombstones if they don't represent multiple conflicting identities
  if (titleMatched.length > 1) {
    const distinctExternalKeys = new Set(
      titleMatched
        .map((r) =>
          [r.anilist_id ?? "", r.mal_id ?? "", r.kitsu_id ?? "", normalizeCatalogFormat(r.format), r.year ?? ""].join("|"),
        )
        .filter((k) => k !== "||||"),
    );
    if (distinctExternalKeys.size > 1) {
      return [];
    }
  }

  return titleMatched;
}

/**
 * Resolves any identifier (direct ID, historical alias ID, external AniList/MAL/Kitsu ID,
 * or unambiguous normalized title+format+year+isDubbed) to the active canonical `catalog_anime`.
 */
export async function findCanonicalCatalogAnime(
  sql: Sql,
  input: IdentityMatchInput,
): Promise<CanonicalLookupResult> {
  const rawId = typeof input.id === "string" ? input.id.trim() : "";
  const numericRawId = parsePositiveIntId(rawId);
  const inputDubbed = inferIsDubbedFromTitles(input);

  let resolvedFromAliasId: string | undefined;
  let lastAliasMetadata: IdentityMatchInput | null = null;
  let visitedChainIds: string[] = [];

  const candidateLookupIds = Array.from(
    new Set(
      [
        rawId,
        typeof input.serverCatalogId === "string"
          ? input.serverCatalogId.trim()
          : "",
      ].filter(Boolean),
    ),
  );

  for (const lookupId of candidateLookupIds) {
    // 1. Direct active match
    const directRows = await sql<CatalogAnimeIdentityRow>`
      SELECT "id", "title", "anilistId", "malId", "kitsuId",
             "titleRomaji", "titleEnglish", "titleNative",
             "cover", "banner", "synopsis", "format", "status",
             "episodesCount", "year", "season", "hidden", "archived_at", "episode_history"
      FROM "catalog_anime"
      WHERE "id" = ${lookupId}
        AND "archived_at" IS NULL
      LIMIT 1
    `;
    if (directRows[0]) {
      const aliasIds = await getAllAliasIdsForCanonical(sql, directRows[0].id);
      return {
        canonicalId: directRows[0].id,
        row: directRows[0],
        matchedBy: lookupId === rawId ? "id" : "alias",
        resolvedFromAliasId:
          rawId && rawId !== directRows[0].id ? rawId : undefined,
        aliasIds,
        ambiguous: false,
        archivedMatchIds: [],
      };
    }

    // 2. Alias chain lookup
    const chain = await resolveAliasChainTarget(sql, lookupId);
    if (visitedChainIds.length === 0) {
      visitedChainIds = chain.visitedIds;
    }
    if (chain.canonicalRow && chain.canonicalId) {
      const aliasIds = await getAllAliasIdsForCanonical(sql, chain.canonicalId);
      return {
        canonicalId: chain.canonicalId,
        row: chain.canonicalRow,
        matchedBy: "alias",
        resolvedFromAliasId: rawId || lookupId,
        aliasIds: Array.from(new Set([...aliasIds, ...chain.visitedIds])).filter(
          (x) => x !== chain.canonicalId,
        ),
        ambiguous: false,
        archivedMatchIds: [],
      };
    }
  }

  if (rawId) {
    const chain = await resolveAliasChainTarget(sql, rawId);
    visitedChainIds = chain.visitedIds;

    // Check if an archived tombstone row exists for rawId (to recover metadata for re-resolution)
    if (chain.aliasRecords.length > 0) {
      const tail = chain.aliasRecords[chain.aliasRecords.length - 1];
      lastAliasMetadata = {
        anilistId: tail.anilist_id,
        malId: tail.mal_id,
        kitsuId: tail.kitsu_id,
        title: tail.title_norm,
        format: tail.format,
        year: tail.year,
        isDubbed: tail.is_dubbed,
      };
    } else {
      // Fallback: check archived catalog_anime row directly in case it was archived without alias metadata
      const archivedRows = await sql<CatalogAnimeIdentityRow>`
        SELECT "id", "title", "anilistId", "malId", "kitsuId",
               "titleRomaji", "titleEnglish", "titleNative",
               "cover", "banner", "synopsis", "format", "status",
               "episodesCount", "year", "season", "hidden", "archived_at", "episode_history"
        FROM "catalog_anime"
        WHERE "id" = ${rawId}
          AND "archived_at" IS NOT NULL
        LIMIT 1
      `;
      if (archivedRows[0]) {
        lastAliasMetadata = {
          anilistId: archivedRows[0].anilistId,
          malId: archivedRows[0].malId,
          kitsuId: archivedRows[0].kitsuId,
          title: archivedRows[0].title,
          titleRomaji: archivedRows[0].titleRomaji,
          titleEnglish: archivedRows[0].titleEnglish,
          titleNative: archivedRows[0].titleNative,
          format: archivedRows[0].format,
          year: archivedRows[0].year,
          isDubbed: rowIsDubbed(archivedRows[0]),
        };
      } else {
        // Last-resort metadata recovery for legacy hard-deleted IDs whose
        // references still preserve an animeSnapshot in user tables.
        const snapRows = await sql<{ animeSnapshot: unknown }>`
          SELECT "animeSnapshot" FROM (
            SELECT "animeSnapshot", "updatedAt" AS ts
            FROM "user_anime_tracking"
            WHERE "animeId" = ${rawId} AND "animeSnapshot" IS NOT NULL
            UNION ALL
            SELECT "animeSnapshot", "addedAt" AS ts
            FROM "user_custom_list_item"
            WHERE "animeId" = ${rawId} AND "animeSnapshot" IS NOT NULL
            UNION ALL
            SELECT "animeSnapshot", "createdAt" AS ts
            FROM "user_favorite"
            WHERE "targetType" = 'anime' AND "animeId" = ${rawId} AND "animeSnapshot" IS NOT NULL
          ) refs
          ORDER BY ts DESC
          LIMIT 1
        `;
        if (snapRows[0]?.animeSnapshot) {
          lastAliasMetadata = extractIdentityFromSnapshot(
            snapRows[0].animeSnapshot,
            rawId,
          );
        }
      }
    }
  }

  const effectiveAnilistId =
    parsePositiveIntId(input.anilistId) ??
    parsePositiveIntId(lastAliasMetadata?.anilistId) ??
    numericRawId;
  const effectiveMalId =
    parsePositiveIntId(input.malId) ??
    parsePositiveIntId(lastAliasMetadata?.malId);
  const effectiveKitsuId =
    parsePositiveIntId(input.kitsuId) ??
    parsePositiveIntId(lastAliasMetadata?.kitsuId);
  const effectiveDubbed =
    inputDubbed !== null
      ? inputDubbed
      : typeof lastAliasMetadata?.isDubbed === "boolean"
        ? lastAliasMetadata.isDubbed
        : null;
  const effectiveFormat = input.format ?? lastAliasMetadata?.format ?? null;
  const effectiveYear =
    parseNullableYear(input.year) ??
    parseNullableYear(lastAliasMetadata?.year);

  // 3. External IDs lookup among active catalog rows
  if (
    effectiveAnilistId !== null ||
    effectiveMalId !== null ||
    effectiveKitsuId !== null
  ) {
    const extRows = await sql<CatalogAnimeIdentityRow>`
      SELECT "id", "title", "anilistId", "malId", "kitsuId",
             "titleRomaji", "titleEnglish", "titleNative",
             "cover", "banner", "synopsis", "format", "status",
             "episodesCount", "year", "season", "hidden", "archived_at", "episode_history"
      FROM "catalog_anime"
      WHERE "archived_at" IS NULL
        AND (
          (${effectiveAnilistId}::integer IS NOT NULL AND "anilistId" = ${effectiveAnilistId})
          OR (${effectiveMalId}::integer IS NOT NULL AND "malId" = ${effectiveMalId})
          OR (${effectiveKitsuId}::integer IS NOT NULL AND "kitsuId" = ${effectiveKitsuId})
        )
    `;

    const compatible = extRows.filter((row) => {
      if (effectiveDubbed !== null && rowIsDubbed(row) !== effectiveDubbed) {
        return false;
      }
      return true;
    });

    if (compatible.length === 1) {
      const target = compatible[0];
      const aliasIds = await getAllAliasIdsForCanonical(sql, target.id);
      if (rawId && rawId !== target.id) {
        resolvedFromAliasId = rawId;
      }
      return {
        canonicalId: target.id,
        row: target,
        matchedBy: "external_id",
        resolvedFromAliasId,
        aliasIds,
        ambiguous: false,
        archivedMatchIds: visitedChainIds,
      };
    }
    if (compatible.length > 1) {
      return {
        canonicalId: null,
        row: null,
        matchedBy: null,
        aliasIds: [],
        ambiguous: true,
        archivedMatchIds: visitedChainIds,
      };
    }
  }

  // 4. Unambiguous normalized title + format + year + isDubbed fallback
  const candidateTitles = Array.from(
    new Set([
      ...collectNormalizedTitles(input),
      ...(lastAliasMetadata ? collectNormalizedTitles(lastAliasMetadata) : []),
    ]),
  );

  if (candidateTitles.length > 0) {
    const titleMatch = await matchActiveCatalogByTitleAndAttributes(sql, {
      titles: candidateTitles,
      format: effectiveFormat,
      year: effectiveYear,
      isDubbed: effectiveDubbed,
      anilistId: effectiveAnilistId,
      malId: effectiveMalId,
      kitsuId: effectiveKitsuId,
    });
    if (titleMatch.ambiguous) {
      return {
        canonicalId: null,
        row: null,
        matchedBy: null,
        aliasIds: [],
        ambiguous: true,
        archivedMatchIds: visitedChainIds,
      };
    }
    if (titleMatch.match) {
      const target = titleMatch.match;
      const aliasIds = await getAllAliasIdsForCanonical(sql, target.id);
      if (rawId && rawId !== target.id) {
        resolvedFromAliasId = rawId;
      }
      return {
        canonicalId: target.id,
        row: target,
        matchedBy: "title",
        resolvedFromAliasId,
        aliasIds,
        ambiguous: false,
        archivedMatchIds: visitedChainIds,
      };
    }
  }

  return {
    canonicalId: null,
    row: null,
    matchedBy: null,
    aliasIds: [],
    ambiguous: false,
    archivedMatchIds: visitedChainIds,
  };
}

/**
 * Given any route or stored anime ID, resolves the full list of candidate IDs
 * (`canonicalId` + all known aliases + matching numeric external IDs) so
 * comments, watched status, and playback lookups seamlessly span old and new IDs.
 */
export async function resolveAnimeCandidateIdsFromDb(
  sql: Sql,
  inputId: string,
): Promise<{
  canonicalId: string;
  candidateIds: string[];
  resolvedFromAliasId?: string;
  row: CatalogAnimeIdentityRow | null;
}> {
  const cleanId = inputId.trim();
  if (!cleanId) {
    return { canonicalId: "", candidateIds: [], row: null };
  }

  const lookup = await findCanonicalCatalogAnime(sql, { id: cleanId });
  const ids = new Set<string>([cleanId]);

  if (lookup.canonicalId && lookup.row) {
    ids.add(lookup.canonicalId);
    for (const a of lookup.aliasIds) ids.add(a);
    if (lookup.row.anilistId) ids.add(String(lookup.row.anilistId));
    if (lookup.row.malId) ids.add(String(lookup.row.malId));
    if (lookup.row.kitsuId) ids.add(String(lookup.row.kitsuId));
    return {
      canonicalId: lookup.canonicalId,
      candidateIds: Array.from(ids),
      resolvedFromAliasId:
        lookup.canonicalId !== cleanId ? cleanId : undefined,
      row: lookup.row,
    };
  }

  // Also include transitive aliases pointing directly to cleanId if cleanId is not in catalog_anime
  const backAliases = await getAllAliasIdsForCanonical(sql, cleanId);
  for (const a of backAliases) ids.add(a);

  return {
    canonicalId: cleanId,
    candidateIds: Array.from(ids),
    row: null,
  };
}

export async function snapshotCatalogEpisodesMap(
  sql: Sql,
  animeId: string,
): Promise<EpisodeHistoryEntry[]> {
  const cleanId = animeId.trim();
  if (!cleanId) return [];
  const rows = await sql<{
    id: string;
    seasonNumber: number | null;
    number: number;
  }>`
    SELECT "id", "seasonNumber", "number"
    FROM "catalog_episode"
    WHERE "animeId" = ${cleanId}
  `;
  return rows.map((r) => ({
    episodeId: r.id,
    seasonNumber: Number(r.seasonNumber ?? 1),
    number: Number(r.number),
  }));
}

/**
 * Discovers existing orphaned references in `user_anime_tracking`,
 * `user_custom_list_item`, and `user_favorite` whose `animeId` does not
 * match any active `catalog_anime` (and is not yet aliased to an active anime),
 * and whose snapshot or numeric ID unambiguously matches the provided anime.
 */
export async function discoverMatchingOrphanIdsFromUserTables(
  sql: Sql,
  target: IdentityMatchInput & { canonicalId: string },
): Promise<string[]> {
  const normTitles = new Set(collectNormalizedTitles(target));
  const targetDubbed = inferIsDubbedFromTitles(target);
  const anilistId = parsePositiveIntId(target.anilistId);
  const malId = parsePositiveIntId(target.malId);
  const kitsuId = parsePositiveIntId(target.kitsuId);

  const orphanRows = await sql<{
    animeId: string;
    animeSnapshot: unknown;
  }>`
    WITH all_refs AS (
      SELECT DISTINCT ON ("animeId") "animeId", "animeSnapshot"
      FROM "user_anime_tracking"
      UNION ALL
      SELECT DISTINCT ON ("animeId") "animeId", "animeSnapshot"
      FROM "user_custom_list_item"
      UNION ALL
      SELECT DISTINCT ON ("animeId") "animeId", "animeSnapshot"
      FROM "user_favorite"
      WHERE "targetType" = 'anime' AND "animeId" IS NOT NULL
    )
    SELECT DISTINCT ON (r."animeId") r."animeId", r."animeSnapshot"
    FROM all_refs r
    LEFT JOIN "catalog_anime" ca
      ON ca."id" = r."animeId" AND ca."archived_at" IS NULL
    WHERE ca."id" IS NULL
      AND r."animeId" <> ${target.canonicalId}
  `;

  if (orphanRows.length === 0) return [];

  // Exclude IDs already aliased to another DIFFERENT active anime
  const activeAliases = await sql<{ old_id: string; current_id: string }>`
    SELECT a."old_id", a."current_id"
    FROM "catalog_anime_id_alias" a
    INNER JOIN "catalog_anime" ca
      ON ca."id" = a."current_id" AND ca."archived_at" IS NULL
    WHERE a."current_id" IS NOT NULL
      AND a."current_id" <> ${target.canonicalId}
  `;
  const claimedByOther = new Set(activeAliases.map((a) => a.old_id));

  const matchedIds = new Set<string>();

  for (const row of orphanRows) {
    const candidateId = row.animeId?.trim();
    if (!candidateId || claimedByOther.has(candidateId)) continue;

    const snap = extractIdentityFromSnapshot(row.animeSnapshot, candidateId);
    const snapDubbed = inferIsDubbedFromTitles(snap);
    if (
      targetDubbed !== null &&
      snapDubbed !== null &&
      snapDubbed !== targetDubbed
    ) {
      continue;
    }

    const extMatch =
      (anilistId !== null && snap.anilistId === anilistId) ||
      (malId !== null && snap.malId === malId) ||
      (kitsuId !== null && snap.kitsuId === kitsuId);

    if (extMatch) {
      matchedIds.add(candidateId);
      continue;
    }

    const snapTitles = collectNormalizedTitles(snap);
    const matchedNorms = snapTitles.filter((t) => normTitles.has(t));
    if (
      matchedNorms.length > 0 &&
      isTitleFallbackCompatible(
        {
          titleNorms: matchedNorms,
          format: target.format,
          year: target.year,
          anilistId,
          malId,
          kitsuId,
        },
        {
          format: snap.format,
          year: snap.year,
          anilistId: snap.anilistId,
          malId: snap.malId,
          kitsuId: snap.kitsuId,
        },
      )
    ) {
      matchedIds.add(candidateId);
    }
  }

  return Array.from(matchedIds);
}

export type ReregistrationTargetResolution = {
  targetId: string;
  reusedOriginalId: boolean;
  matchedBy: "active_id" | "active_alias" | "active_external" | "active_title" | "archived_reuse" | "tombstone_reuse" | "new";
  sourceOldIds: string[];
  mergedEpisodeHistory: EpisodeHistoryEntry[];
};

/**
 * Resolves the canonical internal ID to use when an admin creates, saves, or imports an anime.
 * Order of precedence:
 * 1. Existing active `catalog_anime` (exact ID, alias chain, external ID with same sub/dub version, or unambiguous title+format+year+isDubbed).
 * 2. Archived `catalog_anime` (`archived_at IS NOT NULL`) matching ID, external ID, or unambiguous title+format+year+isDubbed — reuses original ID when safe & compatible!
 * 3. Historical tombstone in `catalog_anime_id_alias` (`current_id IS NULL`) — reuses original ID when safe & not held by another active anime.
 * 4. Otherwise keeps `requestedId`.
 */
export async function resolveReregistrationTargetId(
  sql: Sql,
  input: IdentityMatchInput & { requestedId: string },
): Promise<ReregistrationTargetResolution> {
  const requestedId = input.requestedId.trim();
  const isDubbed = Boolean(inferIsDubbedFromTitles(input));
  const anilistId = parsePositiveIntId(input.anilistId);
  const malId = parsePositiveIntId(input.malId);
  const kitsuId = parsePositiveIntId(input.kitsuId);
  const normTitles = collectNormalizedTitles(input);

  // 1. Check exact active ID match
  if (requestedId) {
    const activeExact = await sql<CatalogAnimeIdentityRow>`
      SELECT "id", "title", "anilistId", "malId", "kitsuId",
             "titleRomaji", "titleEnglish", "titleNative",
             "cover", "banner", "synopsis", "format", "status",
             "episodesCount", "year", "season", "hidden", "archived_at", "episode_history"
      FROM "catalog_anime"
      WHERE "id" = ${requestedId}
        AND "archived_at" IS NULL
      LIMIT 1
    `;
    if (activeExact[0]) {
      const prevHist = parseEpisodeHistoryArray(activeExact[0].episode_history);
      return {
        targetId: activeExact[0].id,
        reusedOriginalId: false,
        matchedBy: "active_id",
        sourceOldIds: [],
        mergedEpisodeHistory: prevHist,
      };
    }
  }

  // 2. Check active alias/external/title resolution via findCanonicalCatalogAnime
  const activeCanonical = await findCanonicalCatalogAnime(sql, {
    ...input,
    id: requestedId,
    isDubbed,
  });
  if (activeCanonical.canonicalId && activeCanonical.row) {
    const matchedBy =
      activeCanonical.matchedBy === "alias"
        ? "active_alias"
        : activeCanonical.matchedBy === "external_id"
          ? "active_external"
          : "active_title";
    const sourceOldIds = Array.from(
      new Set([
        ...(requestedId && requestedId !== activeCanonical.canonicalId ? [requestedId] : []),
        ...activeCanonical.aliasIds,
      ]),
    );
    return {
      targetId: activeCanonical.canonicalId,
      reusedOriginalId: activeCanonical.canonicalId !== requestedId,
      matchedBy,
      sourceOldIds,
      mergedEpisodeHistory: parseEpisodeHistoryArray(activeCanonical.row.episode_history),
    };
  }

  // 3. No active match: look for archived catalog_anime rows with matching is_dubbed
  const archivedRows = await sql<CatalogAnimeIdentityRow>`
    SELECT "id", "title", "anilistId", "malId", "kitsuId",
           "titleRomaji", "titleEnglish", "titleNative",
           "cover", "banner", "synopsis", "format", "status",
           "episodesCount", "year", "season", "hidden", "archived_at", "episode_history"
    FROM "catalog_anime"
    WHERE "archived_at" IS NOT NULL
    ORDER BY "archived_at" DESC
  `;

  const compatibleArchivedByExt: CatalogAnimeIdentityRow[] = [];
  const compatibleArchivedByTitle: CatalogAnimeIdentityRow[] = [];

  for (const row of archivedRows) {
    if (rowIsDubbed(row) !== isDubbed) continue;

    if (requestedId && row.id === requestedId) {
      // Exact archived ID match — verify it isn't a totally different anime
      const conflictingExt =
        (anilistId !== null && row.anilistId !== null && row.anilistId !== anilistId) ||
        (malId !== null && row.malId !== null && row.malId !== malId) ||
        (kitsuId !== null && row.kitsuId !== null && row.kitsuId !== kitsuId);
      if (!conflictingExt) {
        return {
          targetId: row.id,
          reusedOriginalId: true,
          matchedBy: "archived_reuse",
          sourceOldIds: [],
          mergedEpisodeHistory: parseEpisodeHistoryArray(row.episode_history),
        };
      }
    }

    const extMatch =
      (anilistId !== null && row.anilistId === anilistId) ||
      (malId !== null && row.malId === malId) ||
      (kitsuId !== null && row.kitsuId === kitsuId);

    if (extMatch) {
      compatibleArchivedByExt.push(row);
      continue;
    }

    if (normTitles.length > 0) {
      const rowNorms = collectNormalizedTitles(row);
      const normSet = new Set(normTitles);
      const matchedNorms = rowNorms.filter((t) => normSet.has(t));
      if (
        matchedNorms.length > 0 &&
        isTitleFallbackCompatible(
          {
            titleNorms: matchedNorms,
            format: input.format,
            year: input.year,
            anilistId,
            malId,
            kitsuId,
          },
          {
            format: row.format,
            year: row.year,
            anilistId: row.anilistId,
            malId: row.malId,
            kitsuId: row.kitsuId,
          },
        )
      ) {
        compatibleArchivedByTitle.push(row);
      }
    }
  }

  // Pick candidate from archived catalog_anime
  let archivedCandidates =
    compatibleArchivedByExt.length > 0
      ? compatibleArchivedByExt
      : compatibleArchivedByTitle;

  // Ambiguity check on title-only archived candidates: if >1 distinct identities, abort auto-reuse
  if (compatibleArchivedByExt.length === 0 && compatibleArchivedByTitle.length > 1) {
    const distinctKeys = new Set(
      compatibleArchivedByTitle.map((r) =>
        [r.anilistId ?? "", r.malId ?? "", r.kitsuId ?? "", normalizeCatalogFormat(r.format), r.year ?? ""].join("|"),
      ),
    );
    if (distinctKeys.size > 1) {
      archivedCandidates = [];
    }
  }

  const tombstones = await findMatchingTombstoneAliases(sql, {
    ...input,
    isDubbed,
  });

  if (archivedCandidates.length > 0) {
    // Prefer exact requestedId if present among candidates, else most recently archived
    const chosen =
      archivedCandidates.find((r) => r.id === requestedId) ??
      archivedCandidates[0];
    let mergedHistory = parseEpisodeHistoryArray(chosen.episode_history);
    const sourceOldIds = new Set<string>();
    for (const c of archivedCandidates) {
      mergedHistory = mergeEpisodeHistory(
        mergedHistory,
        parseEpisodeHistoryArray(c.episode_history),
      );
      if (c.id !== chosen.id) sourceOldIds.add(c.id);
    }
    for (const t of tombstones) {
      mergedHistory = mergeEpisodeHistory(
        mergedHistory,
        parseEpisodeHistoryArray(t.episode_history),
      );
      if (t.old_id !== chosen.id) sourceOldIds.add(t.old_id);
    }
    if (requestedId && requestedId !== chosen.id) {
      sourceOldIds.add(requestedId);
    }
    return {
      targetId: chosen.id,
      reusedOriginalId: true,
      matchedBy: "archived_reuse",
      sourceOldIds: Array.from(sourceOldIds),
      mergedEpisodeHistory: mergedHistory,
    };
  }

  // 4. Fallback: check tombstone aliases from pre-soft-archive deletes
  if (tombstones.length > 0) {
    let reusableTombstoneId: string | null = null;
    for (const t of tombstones) {
      const existingActive = await sql<{ id: string }>`
        SELECT "id" FROM "catalog_anime"
        WHERE "id" = ${t.old_id} AND "archived_at" IS NULL
        LIMIT 1
      `;
      if (!existingActive[0]) {
        reusableTombstoneId = t.old_id;
        break;
      }
    }

    const chosenId = reusableTombstoneId || requestedId;
    let mergedHistory: EpisodeHistoryEntry[] = [];
    const sourceOldIds = new Set<string>();
    for (const t of tombstones) {
      mergedHistory = mergeEpisodeHistory(
        mergedHistory,
        parseEpisodeHistoryArray(t.episode_history),
      );
      if (t.old_id !== chosenId) sourceOldIds.add(t.old_id);
    }
    if (requestedId && requestedId !== chosenId) {
      sourceOldIds.add(requestedId);
    }

    if (chosenId) {
      return {
        targetId: chosenId,
        reusedOriginalId: Boolean(reusableTombstoneId),
        matchedBy: "tombstone_reuse",
        sourceOldIds: Array.from(sourceOldIds),
        mergedEpisodeHistory: mergedHistory,
      };
    }
  }

  return {
    targetId: requestedId,
    reusedOriginalId: false,
    matchedBy: "new",
    sourceOldIds: [],
    mergedEpisodeHistory: [],
  };
}

/**
 * Reconciles user references (`user_anime_tracking`, `user_custom_list_item`,
 * `user_favorite`, `user_episode_progress`, `user_watched_episode`, `comment`,
 * `comment_typing`, `notification`) from all `oldIds` to `canonicalId`.
 * Safe against SQL 21000 / 23505 conflicts and CHECK constraints.
 */
export async function reconcileAnimeIdentityReferences(
  sql: Sql,
  params: {
    canonicalId: string;
    oldIds: string[];
    canonicalSnapshot?: Record<string, unknown> | null;
    episodeHistory?: EpisodeHistoryEntry[];
  },
): Promise<{
  migratedTrackingUsers: number;
  migratedListItems: number;
  migratedFavorites: number;
  migratedProgressRows: number;
  migratedWatchedRows: number;
  migratedComments: number;
  migratedNotifications: number;
}> {
  const canonicalId = params.canonicalId.trim();
  const sourceIds = Array.from(
    new Set(
      params.oldIds
        .map((x) => x.trim())
        .filter((x) => x.length > 0 && x !== canonicalId),
    ),
  );

  if (!canonicalId || sourceIds.length === 0) {
    return {
      migratedTrackingUsers: 0,
      migratedListItems: 0,
      migratedFavorites: 0,
      migratedProgressRows: 0,
      migratedWatchedRows: 0,
      migratedComments: 0,
      migratedNotifications: 0,
    };
  }

  const allIds = [canonicalId, ...sourceIds];
  const snapshotJson = params.canonicalSnapshot
    ? JSON.stringify(params.canonicalSnapshot)
    : null;

  // 1. Reconcile user_anime_tracking
  const trackingRows = await sql<{
    userId: string;
    animeId: string;
    status: string;
    score: string | number | null;
    episodesWatched: number;
    animeSnapshot: unknown;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>`
    SELECT "userId", "animeId", "status", "score", "episodesWatched",
           "animeSnapshot", "startedAt"::text, "completedAt"::text,
           "createdAt"::text, "updatedAt"::text
    FROM "user_anime_tracking"
    WHERE "animeId" = ANY(${allIds})
    ORDER BY "updatedAt" DESC, "createdAt" ASC
  `;

  const trackingByUser = new Map<string, typeof trackingRows>();
  for (const row of trackingRows) {
    const group = trackingByUser.get(row.userId) ?? [];
    group.push(row);
    trackingByUser.set(row.userId, group);
  }

  let migratedTrackingUsers = 0;
  for (const [userId, group] of trackingByUser.entries()) {
    const hasNonCanonical = group.some((r) => r.animeId !== canonicalId);
    if (!hasNonCanonical && group.length <= 1) continue;

    migratedTrackingUsers += 1;
    // group is sorted by updatedAt DESC
    const freshest = group[0];
    const maxEpisodes = Math.max(...group.map((r) => Number(r.episodesWatched ?? 0)));
    const firstNonNullScore =
      group.find((r) => r.score !== null && r.score !== undefined)?.score ?? null;
    const minCreatedAt = group
      .map((r) => r.createdAt)
      .sort()[0] ?? freshest.createdAt;
    const startedDates = group
      .map((r) => r.startedAt)
      .filter((d): d is string => Boolean(d))
      .sort();
    const completedDates = group
      .map((r) => r.completedAt)
      .filter((d): d is string => Boolean(d))
      .sort();
    const STATUS_RANK: Record<string, number> = {
      completed: 5,
      watching: 4,
      on_hold: 3,
      dropped: 2,
      planning: 1,
    };
    const mergedStatus =
      group
        .slice()
        .sort((a, b) => {
          const rankDiff =
            (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0);
          if (rankDiff !== 0) return rankDiff;
          return toEpochMs(b.updatedAt) - toEpochMs(a.updatedAt);
        })[0]?.status || "planning";
    const mergedSnapObj =
      params.canonicalSnapshot ??
      (group.find((r) => r.animeSnapshot && typeof r.animeSnapshot === "object")
        ?.animeSnapshot as Record<string, unknown> | undefined) ??
      null;
    const mergedSnapJson = mergedSnapObj ? JSON.stringify(mergedSnapObj) : null;

    await sql`
      DELETE FROM "user_anime_tracking"
      WHERE "userId" = ${userId}
        AND "animeId" = ANY(${allIds})
    `;

    await sql`
      INSERT INTO "user_anime_tracking" (
        "userId", "animeId", "status", "score", "episodesWatched",
        "animeSnapshot", "startedAt", "completedAt", "createdAt", "updatedAt"
      )
      VALUES (
        ${userId},
        ${canonicalId},
        ${mergedStatus},
        ${firstNonNullScore},
        ${maxEpisodes},
        ${mergedSnapJson}::jsonb,
        ${startedDates[0] ?? null}::timestamptz,
        ${completedDates[completedDates.length - 1] ?? null}::timestamptz,
        ${minCreatedAt}::timestamptz,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("userId", "animeId") DO UPDATE SET
        "status" = EXCLUDED."status",
        "score" = COALESCE(EXCLUDED."score", "user_anime_tracking"."score"),
        "episodesWatched" = GREATEST("user_anime_tracking"."episodesWatched", EXCLUDED."episodesWatched"),
        "animeSnapshot" = COALESCE(EXCLUDED."animeSnapshot", "user_anime_tracking"."animeSnapshot"),
        "startedAt" = COALESCE("user_anime_tracking"."startedAt", EXCLUDED."startedAt"),
        "completedAt" = COALESCE(EXCLUDED."completedAt", "user_anime_tracking"."completedAt"),
        "updatedAt" = CURRENT_TIMESTAMP
    `;
  }

  // 2. Reconcile user_custom_list_item
  const listItemRows = await sql<{
    listId: string;
    animeId: string;
    position: number;
    animeSnapshot: unknown;
    addedAt: string;
  }>`
    SELECT "listId", "animeId", "position", "animeSnapshot", "addedAt"::text
    FROM "user_custom_list_item"
    WHERE "animeId" = ANY(${allIds})
    ORDER BY "position" ASC, "addedAt" ASC
  `;

  const itemsByList = new Map<string, typeof listItemRows>();
  for (const row of listItemRows) {
    const group = itemsByList.get(row.listId) ?? [];
    group.push(row);
    itemsByList.set(row.listId, group);
  }

  let migratedListItems = 0;
  for (const [listId, group] of itemsByList.entries()) {
    const hasNonCanonical = group.some((r) => r.animeId !== canonicalId);
    if (!hasNonCanonical) continue;

    migratedListItems += 1;
    const canonicalRow = group.find((r) => r.animeId === canonicalId);
    const keepPosition =
      canonicalRow?.position ?? Math.min(...group.map((r) => Number(r.position ?? 0)));
    const keepAddedAt =
      canonicalRow?.addedAt ??
      group.map((r) => r.addedAt).sort()[0] ??
      new Date().toISOString();
    const keepSnapshot =
      snapshotJson ??
      (canonicalRow?.animeSnapshot
        ? JSON.stringify(canonicalRow.animeSnapshot)
        : group[0]?.animeSnapshot
          ? JSON.stringify(group[0].animeSnapshot)
          : null);

    await sql`
      DELETE FROM "user_custom_list_item"
      WHERE "listId" = ${listId}
        AND "animeId" = ANY(${allIds})
    `;

    await sql`
      INSERT INTO "user_custom_list_item" (
        "listId", "animeId", "position", "animeSnapshot", "addedAt"
      )
      VALUES (
        ${listId},
        ${canonicalId},
        ${keepPosition},
        ${keepSnapshot}::jsonb,
        ${keepAddedAt}::timestamptz
      )
      ON CONFLICT ("listId", "animeId") DO UPDATE SET
        "animeSnapshot" = COALESCE(EXCLUDED."animeSnapshot", "user_custom_list_item"."animeSnapshot")
    `;
  }

  // 3. Reconcile user_favorite
  const favRows = await sql<{
    id: string;
    userId: string;
    animeId: string;
    position: number;
    animeSnapshot: unknown;
    createdAt: string;
  }>`
    SELECT "id", "userId", "animeId", "position", "animeSnapshot", "createdAt"::text
    FROM "user_favorite"
    WHERE "targetType" = 'anime'
      AND "animeId" = ANY(${allIds})
    ORDER BY "position" ASC, "createdAt" ASC
  `;

  const favsByUser = new Map<string, typeof favRows>();
  for (const row of favRows) {
    const group = favsByUser.get(row.userId) ?? [];
    group.push(row);
    favsByUser.set(row.userId, group);
  }

  let migratedFavorites = 0;
  for (const [, group] of favsByUser.entries()) {
    const hasNonCanonical = group.some((r) => r.animeId !== canonicalId);
    if (!hasNonCanonical) continue;

    migratedFavorites += 1;
    const canonicalRow = group.find((r) => r.animeId === canonicalId);
    const winner = canonicalRow ?? group[0];
    const loserIds = group.filter((r) => r.id !== winner.id).map((r) => r.id);

    if (loserIds.length > 0) {
      await sql`
        DELETE FROM "user_favorite"
        WHERE "id" = ANY(${loserIds})
      `;
    }

    const updatedSnap =
      snapshotJson ??
      (winner.animeSnapshot ? JSON.stringify(winner.animeSnapshot) : null);

    await sql`
      UPDATE "user_favorite"
      SET "animeId" = ${canonicalId},
          "animeSnapshot" = COALESCE(${updatedSnap}::jsonb, "animeSnapshot")
      WHERE "id" = ${winner.id}
    `;
  }

  // 4. Build episode remapping table from episodeHistory -> current active catalog_episode
  const oldEpMeta = new Map<string, { seasonNumber: number; number: number }>();
  if (params.episodeHistory) {
    for (const entry of params.episodeHistory) {
      oldEpMeta.set(entry.episodeId, {
        seasonNumber: entry.seasonNumber,
        number: entry.number,
      });
    }
  }

  const currentEpisodes = await sql<{
    id: string;
    seasonNumber: number | null;
    number: number;
  }>`
    SELECT "id", "seasonNumber", "number"
    FROM "catalog_episode"
    WHERE "animeId" = ${canonicalId}
  `;

  const bySeasonNum = new Map<string, string>();
  for (const ep of currentEpisodes) {
    const s = Number(ep.seasonNumber ?? 1);
    const n = Number(ep.number);
    bySeasonNum.set(`${s}:${n}`, ep.id);
  }

  const mapEpisodeId = (oldEpId: string): string => {
    const meta = oldEpMeta.get(oldEpId);
    if (meta) {
      const exact = bySeasonNum.get(`${meta.seasonNumber}:${meta.number}`);
      if (exact) return exact;
    }
    return oldEpId;
  };

  // 5. Reconcile user_episode_progress safely in JS before delete+insert
  const progressRows = await sql<{
    userId: string;
    animeId: string;
    episodeId: string;
    episodeNumber: number;
    currentTime: number;
    duration: number | null;
    accumulatedTime: number;
    accumulatedRemainderMs: number;
    autoCompleteSuppressed: boolean;
    playbackSessionId: string | null;
    updatedAt: string;
  }>`
    SELECT "userId", "animeId", "episodeId", "episodeNumber",
           "currentTime", "duration", "accumulatedTime",
           "accumulatedRemainderMs", "autoCompleteSuppressed",
           "playbackSessionId", "updatedAt"::text
    FROM "user_episode_progress"
    WHERE "animeId" = ANY(${allIds})
    ORDER BY "updatedAt" DESC
  `;

  let migratedProgressRows = 0;
  if (progressRows.length > 0) {
    type ProgressAgg = (typeof progressRows)[number] & {
      needsRewrite: boolean;
    };
    const groupedProgress = new Map<string, ProgressAgg>();

    for (const row of progressRows) {
      const mappedEpId = mapEpisodeId(row.episodeId);
      const key = `${row.userId}::${mappedEpId}`;
      const needsRewrite =
        row.animeId !== canonicalId || mappedEpId !== row.episodeId;

      const existing = groupedProgress.get(key);
      if (!existing) {
        groupedProgress.set(key, {
          ...row,
          animeId: canonicalId,
          episodeId: mappedEpId,
          needsRewrite,
        });
      } else {
        const durations = [existing.duration, row.duration].filter(
          (d): d is number => typeof d === "number" && Number.isFinite(d) && d > 0,
        );
        const mergedDuration =
          durations.length > 0 ? Math.max(...durations) : null;
        let mergedCurrent = Math.max(
          Number(existing.currentTime ?? 0),
          Number(row.currentTime ?? 0),
        );
        let mergedAccumulated = Math.max(
          Number(existing.accumulatedTime ?? 0),
          Number(row.accumulatedTime ?? 0),
        );
        if (mergedDuration !== null) {
          mergedCurrent = Math.min(mergedCurrent, mergedDuration);
          mergedAccumulated = Math.min(mergedAccumulated, mergedDuration);
        }
        groupedProgress.set(key, {
          userId: existing.userId,
          animeId: canonicalId,
          episodeId: mappedEpId,
          episodeNumber: Math.max(
            Number(existing.episodeNumber ?? 0),
            Number(row.episodeNumber ?? 0),
          ),
          currentTime: mergedCurrent,
          duration: mergedDuration,
          accumulatedTime: mergedAccumulated,
          accumulatedRemainderMs: Math.min(
            999,
            Math.max(
              Number(existing.accumulatedRemainderMs ?? 0),
              Number(row.accumulatedRemainderMs ?? 0),
            ),
          ),
          autoCompleteSuppressed:
            Boolean(existing.autoCompleteSuppressed) ||
            Boolean(row.autoCompleteSuppressed),
          playbackSessionId:
            existing.playbackSessionId ?? row.playbackSessionId ?? null,
          updatedAt:
            toEpochMs(existing.updatedAt) >= toEpochMs(row.updatedAt)
              ? existing.updatedAt
              : row.updatedAt,
          needsRewrite: true,
        });
      }
    }

    const anyProgressNeedsRewrite = Array.from(groupedProgress.values()).some(
      (g) => g.needsRewrite,
    );

    if (anyProgressNeedsRewrite) {
      await sql`
        DELETE FROM "user_episode_progress"
        WHERE "animeId" = ANY(${allIds})
      `;

      for (const item of groupedProgress.values()) {
        const safeDuration =
          item.duration !== null && Number(item.duration) > 0
            ? Math.trunc(Number(item.duration))
            : null;
        let safeCurrent = Math.max(0, Math.trunc(Number(item.currentTime ?? 0)));
        let safeAccumulated = Math.max(
          0,
          Math.trunc(Number(item.accumulatedTime ?? 0)),
        );
        if (safeDuration !== null) {
          safeCurrent = Math.min(safeCurrent, safeDuration);
          safeAccumulated = Math.min(safeAccumulated, safeDuration);
        }
        const safeRemainder = Math.max(
          0,
          Math.min(999, Math.trunc(Number(item.accumulatedRemainderMs ?? 0))),
        );

        await sql`
          INSERT INTO "user_episode_progress" (
            "userId", "animeId", "episodeId", "episodeNumber",
            "currentTime", "duration", "accumulatedTime",
            "accumulatedRemainderMs", "autoCompleteSuppressed",
            "playbackSessionId", "updatedAt"
          )
          VALUES (
            ${item.userId},
            ${canonicalId},
            ${item.episodeId},
            ${Math.max(0, Math.trunc(Number(item.episodeNumber ?? 0)))},
            ${safeCurrent},
            ${safeDuration},
            ${safeAccumulated},
            ${safeRemainder},
            ${Boolean(item.autoCompleteSuppressed)},
            ${item.playbackSessionId},
            ${item.updatedAt}::timestamptz
          )
        `;
        migratedProgressRows += 1;
      }
    }
  }

  // 6. Reconcile user_watched_episode safely in JS before delete+insert
  const watchedRows = await sql<{
    userId: string;
    animeId: string;
    episodeId: string;
    episodeNumber: number;
    origin: string;
    watchedAt: string;
  }>`
    SELECT "userId", "animeId", "episodeId", "episodeNumber", "origin", "watchedAt"::text
    FROM "user_watched_episode"
    WHERE "animeId" = ANY(${allIds})
    ORDER BY "watchedAt" DESC
  `;

  let migratedWatchedRows = 0;
  if (watchedRows.length > 0) {
    type WatchedAgg = (typeof watchedRows)[number] & { needsRewrite: boolean };
    const groupedWatched = new Map<string, WatchedAgg>();

    for (const row of watchedRows) {
      const mappedEpId = mapEpisodeId(row.episodeId);
      const key = `${row.userId}::${mappedEpId}`;
      const needsRewrite =
        row.animeId !== canonicalId || mappedEpId !== row.episodeId;

      const existing = groupedWatched.get(key);
      if (!existing) {
        groupedWatched.set(key, {
          ...row,
          animeId: canonicalId,
          episodeId: mappedEpId,
          needsRewrite,
        });
      } else {
        groupedWatched.set(key, {
          userId: existing.userId,
          animeId: canonicalId,
          episodeId: mappedEpId,
          episodeNumber: Math.max(
            Number(existing.episodeNumber ?? 0),
            Number(row.episodeNumber ?? 0),
          ),
          origin:
            existing.origin === "playback" || row.origin === "playback"
              ? "playback"
              : "manual",
          watchedAt:
            toEpochMs(existing.watchedAt) >= toEpochMs(row.watchedAt)
              ? existing.watchedAt
              : row.watchedAt,
          needsRewrite: true,
        });
      }
    }

    const anyWatchedNeedsRewrite = Array.from(groupedWatched.values()).some(
      (g) => g.needsRewrite,
    );

    if (anyWatchedNeedsRewrite) {
      await sql`
        DELETE FROM "user_watched_episode"
        WHERE "animeId" = ANY(${allIds})
      `;

      for (const item of groupedWatched.values()) {
        await sql`
          INSERT INTO "user_watched_episode" (
            "userId", "animeId", "episodeId", "episodeNumber", "origin", "watchedAt"
          )
          VALUES (
            ${item.userId},
            ${canonicalId},
            ${item.episodeId},
            ${Math.max(0, Math.trunc(Number(item.episodeNumber ?? 0)))},
            ${item.origin === "playback" ? "playback" : "manual"},
            ${item.watchedAt}::timestamptz
          )
        `;
        migratedWatchedRows += 1;
      }
    }
  }

  // 7. Reconcile comment, comment_typing, and notification animeId (+ mapped episodeId where known)
  const commentRows = await sql<{
    id: string;
    animeId: string;
    episodeId: string;
  }>`
    SELECT "id", "animeId", "episodeId"
    FROM "comment"
    WHERE "animeId" = ANY(${sourceIds})
  `;
  let migratedComments = 0;
  for (const c of commentRows) {
    const meta = oldEpMeta.get(c.episodeId);
    const mappedEp =
      meta && bySeasonNum.get(`${meta.seasonNumber}:${meta.number}`)
        ? bySeasonNum.get(`${meta.seasonNumber}:${meta.number}`)!
        : c.episodeId;
    await sql`
      UPDATE "comment"
      SET "animeId" = ${canonicalId},
          "episodeId" = ${mappedEp}
      WHERE "id" = ${c.id}
    `;
    migratedComments += 1;
  }

  // Also remap comments already on canonicalId that still carry an old episodeId
  for (const [oldEpId, meta] of oldEpMeta.entries()) {
    const mappedEp = bySeasonNum.get(`${meta.seasonNumber}:${meta.number}`);
    if (mappedEp && mappedEp !== oldEpId) {
      await sql`
        UPDATE "comment"
        SET "episodeId" = ${mappedEp}
        WHERE "animeId" = ${canonicalId}
          AND "episodeId" = ${oldEpId}
      `;
    }
  }

  await sql`
    DELETE FROM "comment_typing"
    WHERE "animeId" = ANY(${sourceIds})
  `;

  const notifRows = await sql<{
    id: string;
    animeId: string;
    episodeId: string | null;
  }>`
    SELECT "id", "animeId", "episodeId"
    FROM "notification"
    WHERE "animeId" = ANY(${sourceIds})
  `;
  let migratedNotifications = 0;
  for (const n of notifRows) {
    let mappedEp = n.episodeId;
    if (n.episodeId) {
      const meta = oldEpMeta.get(n.episodeId);
      if (meta) {
        mappedEp = bySeasonNum.get(`${meta.seasonNumber}:${meta.number}`) ?? n.episodeId;
      }
    }
    await sql`
      UPDATE "notification"
      SET "animeId" = ${canonicalId},
          "episodeId" = ${mappedEp}
      WHERE "id" = ${n.id}
    `;
    migratedNotifications += 1;
  }

  // 8. Reconcile unauthenticated/lightweight `progress` table rows when episode IDs changed
  const progressEpPairs: Array<{ oldEpId: string; newEpId: string }> = [];
  for (const [oldEpId, meta] of oldEpMeta.entries()) {
    const mappedEp = bySeasonNum.get(`${meta.seasonNumber}:${meta.number}`);
    if (mappedEp && mappedEp !== oldEpId) {
      progressEpPairs.push({ oldEpId, newEpId: mappedEp });
    }
  }
  await remapSimpleProgressEpisodeIds(sql, progressEpPairs);

  return {
    migratedTrackingUsers,
    migratedListItems,
    migratedFavorites,
    migratedProgressRows,
    migratedWatchedRows,
    migratedComments,
    migratedNotifications,
  };
}

/**
 * Called when an episode is created/upserted in `catalog_episode`.
 * Looks up historical `episode_history` on `catalog_anime` and all alias records
 * pointing to `animeId`, finds any old episodeId matching `(seasonNumber, number)`,
 * and remaps `user_episode_progress`, `user_watched_episode`, `comment`, and `notification`.
 */
export async function reconcileEpisodeIdentityReferences(
  sql: Sql,
  params: {
    animeId: string;
    episodeId: string;
    seasonNumber: number;
    number: number;
  },
): Promise<{ remappedOldEpisodeIds: string[] }> {
  const animeId = params.animeId.trim();
  const episodeId = params.episodeId.trim();
  const seasonNumber = Math.trunc(params.seasonNumber);
  const number = Math.trunc(params.number);

  if (!animeId || !episodeId) {
    return { remappedOldEpisodeIds: [] };
  }

  const animeRows = await sql<{ episode_history: unknown }>`
    SELECT "episode_history"
    FROM "catalog_anime"
    WHERE "id" = ${animeId}
    LIMIT 1
  `;

  const aliasIds = await getAllAliasIdsForCanonical(sql, animeId);
  const aliasRows =
    aliasIds.length > 0
      ? await sql<{ episode_history: unknown }>`
          SELECT "episode_history"
          FROM "catalog_anime_id_alias"
          WHERE "old_id" = ANY(${aliasIds})
        `
      : [];

  let combinedHistory: EpisodeHistoryEntry[] = [];
  for (const row of [...animeRows, ...aliasRows]) {
    combinedHistory = mergeEpisodeHistory(
      combinedHistory,
      parseEpisodeHistoryArray(row.episode_history),
    );
  }

  const matchingOldEpisodeIds = Array.from(
    new Set(
      combinedHistory
        .filter(
          (entry) =>
            entry.seasonNumber === seasonNumber &&
            entry.number === number &&
            entry.episodeId !== episodeId,
        )
        .map((entry) => entry.episodeId),
    ),
  );

  if (matchingOldEpisodeIds.length === 0) {
    return { remappedOldEpisodeIds: [] };
  }

  const candidateAnimeIds = [animeId, ...aliasIds];
  const candidateEpisodeIds = [episodeId, ...matchingOldEpisodeIds];

  // Remap user_episode_progress safely (merge duplicates per userId before delete+insert)
  const progRows = await sql<{
    userId: string;
    animeId: string;
    episodeId: string;
    episodeNumber: number;
    currentTime: number;
    duration: number | null;
    accumulatedTime: number;
    accumulatedRemainderMs: number;
    autoCompleteSuppressed: boolean;
    playbackSessionId: string | null;
    updatedAt: string;
  }>`
    SELECT "userId", "animeId", "episodeId", "episodeNumber",
           "currentTime", "duration", "accumulatedTime",
           "accumulatedRemainderMs", "autoCompleteSuppressed",
           "playbackSessionId", "updatedAt"::text
    FROM "user_episode_progress"
    WHERE "animeId" = ANY(${candidateAnimeIds})
      AND "episodeId" = ANY(${candidateEpisodeIds})
    ORDER BY "updatedAt" DESC
  `;

  if (progRows.length > 0) {
    const byUser = new Map<string, typeof progRows>();
    for (const r of progRows) {
      const list = byUser.get(r.userId) ?? [];
      list.push(r);
      byUser.set(r.userId, list);
    }

    for (const [userId, group] of byUser.entries()) {
      const needsRemap = group.some(
        (r) => r.animeId !== animeId || r.episodeId !== episodeId,
      );
      if (!needsRemap) continue;

      const durations = group
        .map((r) => r.duration)
        .filter((d): d is number => typeof d === "number" && d > 0);
      const mergedDuration = durations.length > 0 ? Math.max(...durations) : null;
      let mergedCurrent = Math.max(...group.map((r) => Number(r.currentTime ?? 0)));
      let mergedAccum = Math.max(
        ...group.map((r) => Number(r.accumulatedTime ?? 0)),
      );
      if (mergedDuration !== null) {
        mergedCurrent = Math.min(mergedCurrent, mergedDuration);
        mergedAccum = Math.min(mergedAccum, mergedDuration);
      }
      const freshest = group[0];

      await sql`
        DELETE FROM "user_episode_progress"
        WHERE "userId" = ${userId}
          AND "animeId" = ANY(${candidateAnimeIds})
          AND "episodeId" = ANY(${candidateEpisodeIds})
      `;

      await sql`
        INSERT INTO "user_episode_progress" (
          "userId", "animeId", "episodeId", "episodeNumber",
          "currentTime", "duration", "accumulatedTime",
          "accumulatedRemainderMs", "autoCompleteSuppressed",
          "playbackSessionId", "updatedAt"
        )
        VALUES (
          ${userId},
          ${animeId},
          ${episodeId},
          ${number},
          ${Math.max(0, Math.trunc(mergedCurrent))},
          ${mergedDuration !== null ? Math.trunc(mergedDuration) : null},
          ${Math.max(0, Math.trunc(mergedAccum))},
          ${Math.max(0, Math.min(999, Math.max(...group.map((r) => Number(r.accumulatedRemainderMs ?? 0)))))},
          ${group.some((r) => Boolean(r.autoCompleteSuppressed))},
          ${freshest.playbackSessionId},
          ${freshest.updatedAt}::timestamptz
        )
      `;
    }
  }

  // Remap user_watched_episode safely
  const watchedRows = await sql<{
    userId: string;
    animeId: string;
    episodeId: string;
    episodeNumber: number;
    origin: string;
    watchedAt: string;
  }>`
    SELECT "userId", "animeId", "episodeId", "episodeNumber", "origin", "watchedAt"::text
    FROM "user_watched_episode"
    WHERE "animeId" = ANY(${candidateAnimeIds})
      AND "episodeId" = ANY(${candidateEpisodeIds})
    ORDER BY "watchedAt" DESC
  `;

  if (watchedRows.length > 0) {
    const byUser = new Map<string, typeof watchedRows>();
    for (const r of watchedRows) {
      const list = byUser.get(r.userId) ?? [];
      list.push(r);
      byUser.set(r.userId, list);
    }

    for (const [userId, group] of byUser.entries()) {
      const needsRemap = group.some(
        (r) => r.animeId !== animeId || r.episodeId !== episodeId,
      );
      if (!needsRemap) continue;

      const freshest = group[0];
      const origin = group.some((r) => r.origin === "playback")
        ? "playback"
        : "manual";

      await sql`
        DELETE FROM "user_watched_episode"
        WHERE "userId" = ${userId}
          AND "animeId" = ANY(${candidateAnimeIds})
          AND "episodeId" = ANY(${candidateEpisodeIds})
      `;

      await sql`
        INSERT INTO "user_watched_episode" (
          "userId", "animeId", "episodeId", "episodeNumber", "origin", "watchedAt"
        )
        VALUES (
          ${userId},
          ${animeId},
          ${episodeId},
          ${number},
          ${origin},
          ${freshest.watchedAt}::timestamptz
        )
      `;
    }
  }

  await sql`
    UPDATE "comment"
    SET "episodeId" = ${episodeId}
    WHERE "animeId" = ANY(${candidateAnimeIds})
      AND "episodeId" = ANY(${matchingOldEpisodeIds})
  `;

  await sql`
    UPDATE "notification"
    SET "episodeId" = ${episodeId}
    WHERE "animeId" = ANY(${candidateAnimeIds})
      AND "episodeId" = ANY(${matchingOldEpisodeIds})
  `;

  await remapSimpleProgressEpisodeIds(
    sql,
    matchingOldEpisodeIds.map((oldEpId) => ({ oldEpId, newEpId: episodeId })),
  );

  return { remappedOldEpisodeIds: matchingOldEpisodeIds };
}

async function remapSimpleProgressEpisodeIds(
  sql: Sql,
  pairs: Array<{ oldEpId: string; newEpId: string }>,
): Promise<void> {
  const validPairs = pairs.filter(
    (p) => p.oldEpId && p.newEpId && p.oldEpId !== p.newEpId,
  );
  if (validPairs.length === 0) return;

  for (const { oldEpId, newEpId } of validPairs) {
    const existing = await sql<{
      user_key: string;
      episode_id: string;
      position: number;
      duration: number;
      updated_at: string;
    }>`
      SELECT "user_key", "episode_id", "position", "duration", "updated_at"::text
      FROM "progress"
      WHERE "episode_id" IN (${oldEpId}, ${newEpId})
      ORDER BY "updated_at" DESC
    `;

    if (existing.length === 0) continue;

    const byUser = new Map<string, typeof existing>();
    for (const r of existing) {
      const list = byUser.get(r.user_key) ?? [];
      list.push(r);
      byUser.set(r.user_key, list);
    }

    for (const [userKey, group] of byUser.entries()) {
      if (!group.some((r) => r.episode_id === oldEpId)) continue;
      const mergedDuration = Math.max(
        0,
        ...group.map((r) => Math.trunc(Number(r.duration ?? 0))),
      );
      let mergedPosition = Math.max(
        0,
        ...group.map((r) => Math.trunc(Number(r.position ?? 0))),
      );
      if (mergedDuration > 0) {
        mergedPosition = Math.min(mergedPosition, mergedDuration);
      }
      const freshest = group[0];

      await sql`
        DELETE FROM "progress"
        WHERE "user_key" = ${userKey}
          AND "episode_id" IN (${oldEpId}, ${newEpId})
      `;

      await sql`
        INSERT INTO "progress" ("user_key", "episode_id", "position", "duration", "updated_at")
        VALUES (
          ${userKey},
          ${newEpId},
          ${mergedPosition},
          ${mergedDuration},
          ${freshest.updated_at}::timestamptz
        )
        ON CONFLICT ("user_key", "episode_id") DO UPDATE SET
          "position" = GREATEST("progress"."position", EXCLUDED."position"),
          "duration" = GREATEST("progress"."duration", EXCLUDED."duration"),
          "updated_at" = GREATEST("progress"."updated_at", EXCLUDED."updated_at")
      `;
    }
  }
}

export type ResolvedCatalogMetadata = {
  requestedId: string;
  canonicalId: string;
  isActive: boolean;
  title: string;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  cover: string | null;
  banner: string | null;
  format: string | null;
  status: string | null;
  episodesCount: number | null;
  year: number | null;
  anilistId: number | null;
  malId: number | null;
  kitsuId: number | null;
};

/**
 * Batch-resolves catalog metadata for a list of `animeId`s (which may include
 * old/deleted IDs, alias chains, archived IDs, or external prefix IDs).
 * Prioritizes active `catalog_anime` rows (both direct & via `catalog_anime_id_alias`),
 * and only falls back to archived/tombstone metadata with `isActive: false` when
 * no active target exists.
 */
export async function resolveCatalogMetadataMap(
  sql: Sql,
  rawIds: Array<string | null | undefined>,
): Promise<Map<string, ResolvedCatalogMetadata>> {
  const uniqueIds = Array.from(
    new Set(
      rawIds
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean),
    ),
  );
  const result = new Map<string, ResolvedCatalogMetadata>();
  if (uniqueIds.length === 0) return result;

  // 1. Direct lookup on catalog_anime (both active & archived)
  const directRows = await sql<CatalogAnimeIdentityRow>`
    SELECT "id", "title", "anilistId", "malId", "kitsuId",
           "titleRomaji", "titleEnglish", "titleNative",
           "cover", "banner", "synopsis", "format", "status",
           "episodesCount", "year", "season", "hidden", "archived_at", "episode_history"
    FROM "catalog_anime"
    WHERE "id" = ANY(${uniqueIds})
  `;

  const rowById = new Map<string, CatalogAnimeIdentityRow>();
  for (const r of directRows) {
    rowById.set(r.id, r);
  }

  // 2. Follow alias chains for any requested ID missing or archived
  const unresolvedForAlias = uniqueIds.filter((id) => {
    const row = rowById.get(id);
    return !row || row.archived_at !== null;
  });

  const aliasChainTargetById = new Map<string, string>();
  const tombstoneById = new Map<string, CatalogAnimeIdAliasRow>();

  if (unresolvedForAlias.length > 0) {
    let frontier = [...unresolvedForAlias];
    const visited = new Set<string>(frontier);
    const edges = new Map<string, CatalogAnimeIdAliasRow>();

    for (let depth = 0; depth < 16 && frontier.length > 0; depth += 1) {
      const aliasRows = await sql<CatalogAnimeIdAliasRow>`
        SELECT "old_id", "current_id", "anilist_id", "mal_id", "kitsu_id",
               "title_norm", "format", "year", "is_dubbed", "episode_history",
               "archived_at", "created_at", "updated_at"
        FROM "catalog_anime_id_alias"
        WHERE "old_id" = ANY(${frontier})
      `;
      const nextFrontier: string[] = [];
      for (const a of aliasRows) {
        edges.set(a.old_id, a);
        if (a.current_id && !visited.has(a.current_id)) {
          visited.add(a.current_id);
          nextFrontier.push(a.current_id);
        }
      }
      frontier = nextFrontier;
    }

    const terminalCandidateIds = new Set<string>();
    for (const startId of unresolvedForAlias) {
      let cur: string | null = startId;
      const seen = new Set<string>();
      let lastRow: CatalogAnimeIdAliasRow | undefined;
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        const edge = edges.get(cur);
        if (!edge) break;
        lastRow = edge;
        if (!edge.current_id) {
          cur = null;
          break;
        }
        cur = edge.current_id;
      }
      if (cur && cur !== startId) {
        aliasChainTargetById.set(startId, cur);
        terminalCandidateIds.add(cur);
      }
      if (lastRow) {
        tombstoneById.set(startId, lastRow);
      }
    }

    const missingTerminalIds = Array.from(terminalCandidateIds).filter(
      (id) => !rowById.has(id),
    );
    if (missingTerminalIds.length > 0) {
      const termRows = await sql<CatalogAnimeIdentityRow>`
        SELECT "id", "title", "anilistId", "malId", "kitsuId",
               "titleRomaji", "titleEnglish", "titleNative",
               "cover", "banner", "synopsis", "format", "status",
               "episodesCount", "year", "season", "hidden", "archived_at", "episode_history"
        FROM "catalog_anime"
        WHERE "id" = ANY(${missingTerminalIds})
      `;
      for (const r of termRows) {
        rowById.set(r.id, r);
      }
    }
  }

  // 3. External prefix fallback for IDs still without an active catalog row
  const stillMissingActive = uniqueIds.filter((id) => {
    const direct = rowById.get(id);
    if (direct && direct.archived_at === null) return false;
    const aliasedId = aliasChainTargetById.get(id);
    const aliasedRow = aliasedId ? rowById.get(aliasedId) : undefined;
    return !aliasedRow || aliasedRow.archived_at !== null;
  });

  const extMatchByRequestedId = new Map<string, CatalogAnimeIdentityRow>();
  if (stillMissingActive.length > 0) {
    const anilistLookups: number[] = [];
    const malLookups: number[] = [];
    const kitsuLookups: number[] = [];
    const parsedByReq = new Map<
      string,
      { anilistId: number | null; malId: number | null; kitsuId: number | null; isDubbedHint: boolean | null }
    >();

    for (const id of stillMissingActive) {
      const parsed = extractIdentityFromSnapshot(null, id);
      const direct = rowById.get(id);
      const tomb = tombstoneById.get(id);
      const aId = parsed.anilistId ?? direct?.anilistId ?? tomb?.anilist_id ?? null;
      const mId = parsed.malId ?? direct?.malId ?? tomb?.mal_id ?? null;
      const kId = parsed.kitsuId ?? direct?.kitsuId ?? tomb?.kitsu_id ?? null;
      const dubbedHint = direct
        ? rowIsDubbed(direct)
        : tomb
          ? tomb.is_dubbed
          : null;
      parsedByReq.set(id, { anilistId: aId, malId: mId, kitsuId: kId, isDubbedHint: dubbedHint });
      if (aId) anilistLookups.push(aId);
      if (mId) malLookups.push(mId);
      if (kId) kitsuLookups.push(kId);
    }

    if (anilistLookups.length > 0 || malLookups.length > 0 || kitsuLookups.length > 0) {
      const extCandidates = await sql<CatalogAnimeIdentityRow>`
        SELECT "id", "title", "anilistId", "malId", "kitsuId",
               "titleRomaji", "titleEnglish", "titleNative",
               "cover", "banner", "synopsis", "format", "status",
               "episodesCount", "year", "season", "hidden", "archived_at", "episode_history"
        FROM "catalog_anime"
        WHERE "archived_at" IS NULL
          AND (
            (${anilistLookups.length > 0}::boolean AND "anilistId" = ANY(${anilistLookups}))
            OR (${malLookups.length > 0}::boolean AND "malId" = ANY(${malLookups}))
            OR (${kitsuLookups.length > 0}::boolean AND "kitsuId" = ANY(${kitsuLookups}))
          )
      `;

      for (const reqId of stillMissingActive) {
        const ref = parsedByReq.get(reqId);
        if (!ref) continue;
        const matching = extCandidates.filter((c) => {
          const idMatches =
            (ref.anilistId !== null && c.anilistId === ref.anilistId) ||
            (ref.malId !== null && c.malId === ref.malId) ||
            (ref.kitsuId !== null && c.kitsuId === ref.kitsuId);
          if (!idMatches) return false;
          if (ref.isDubbedHint !== null) {
            return rowIsDubbed(c) === ref.isDubbedHint;
          }
          return true;
        });
        if (matching.length === 1) {
          extMatchByRequestedId.set(reqId, matching[0]);
        } else if (matching.length > 1 && ref.isDubbedHint === null) {
          const nonDub = matching.filter((m) => !rowIsDubbed(m));
          if (nonDub.length === 1) {
            extMatchByRequestedId.set(reqId, nonDub[0]);
          }
        }
      }
    }
  }

  for (const reqId of uniqueIds) {
    const direct = rowById.get(reqId);
    if (direct && direct.archived_at === null) {
      result.set(reqId, {
        requestedId: reqId,
        canonicalId: direct.id,
        isActive: true,
        title: direct.title,
        titleRomaji: direct.titleRomaji,
        titleEnglish: direct.titleEnglish,
        titleNative: direct.titleNative,
        cover: direct.cover,
        banner: direct.banner,
        format: direct.format,
        status: direct.status,
        episodesCount: direct.episodesCount,
        year: direct.year,
        anilistId: direct.anilistId,
        malId: direct.malId,
        kitsuId: direct.kitsuId,
      });
      continue;
    }

    const aliasedId = aliasChainTargetById.get(reqId);
    const aliasedRow = aliasedId ? rowById.get(aliasedId) : undefined;
    if (aliasedRow && aliasedRow.archived_at === null) {
      result.set(reqId, {
        requestedId: reqId,
        canonicalId: aliasedRow.id,
        isActive: true,
        title: aliasedRow.title,
        titleRomaji: aliasedRow.titleRomaji,
        titleEnglish: aliasedRow.titleEnglish,
        titleNative: aliasedRow.titleNative,
        cover: aliasedRow.cover,
        banner: aliasedRow.banner,
        format: aliasedRow.format,
        status: aliasedRow.status,
        episodesCount: aliasedRow.episodesCount,
        year: aliasedRow.year,
        anilistId: aliasedRow.anilistId,
        malId: aliasedRow.malId,
        kitsuId: aliasedRow.kitsuId,
      });
      continue;
    }

    const extMatch = extMatchByRequestedId.get(reqId);
    if (extMatch && extMatch.archived_at === null) {
      result.set(reqId, {
        requestedId: reqId,
        canonicalId: extMatch.id,
        isActive: true,
        title: extMatch.title,
        titleRomaji: extMatch.titleRomaji,
        titleEnglish: extMatch.titleEnglish,
        titleNative: extMatch.titleNative,
        cover: extMatch.cover,
        banner: extMatch.banner,
        format: extMatch.format,
        status: extMatch.status,
        episodesCount: extMatch.episodesCount,
        year: extMatch.year,
        anilistId: extMatch.anilistId,
        malId: extMatch.malId,
        kitsuId: extMatch.kitsuId,
      });
      continue;
    }

    // Fallback to archived catalog_anime row if no active catalog entry exists
    const archivedOrTerm = aliasedRow ?? direct;
    if (archivedOrTerm) {
      result.set(reqId, {
        requestedId: reqId,
        canonicalId: archivedOrTerm.id,
        isActive: false,
        title: archivedOrTerm.title,
        titleRomaji: archivedOrTerm.titleRomaji,
        titleEnglish: archivedOrTerm.titleEnglish,
        titleNative: archivedOrTerm.titleNative,
        cover: archivedOrTerm.cover,
        banner: archivedOrTerm.banner,
        format: archivedOrTerm.format,
        status: archivedOrTerm.status,
        episodesCount: archivedOrTerm.episodesCount,
        year: archivedOrTerm.year,
        anilistId: archivedOrTerm.anilistId,
        malId: archivedOrTerm.malId,
        kitsuId: archivedOrTerm.kitsuId,
      });
      continue;
    }
  }

  return result;
}

/**
 * Resolves all equivalent `episodeId`s (active + historical `episode_history`)
 * for a given `(candidateAnimeIds, episodeId)` by matching `(seasonNumber, number)`.
 */
export async function resolveEquivalentEpisodeIdsFromDb(
  sql: Sql,
  candidateAnimeIds: string[],
  episodeId: string,
): Promise<{ canonicalEpisodeId: string; candidateEpisodeIds: string[] }> {
  const cleanEpId = episodeId.trim();
  const cleanAnimeIds = Array.from(
    new Set(candidateAnimeIds.map((x) => x.trim()).filter(Boolean)),
  );
  if (!cleanEpId) {
    return { canonicalEpisodeId: "", candidateEpisodeIds: [] };
  }
  if (cleanAnimeIds.length === 0) {
    return { canonicalEpisodeId: cleanEpId, candidateEpisodeIds: [cleanEpId] };
  }

  const [activeEpisodes, animeHistRows, aliasHistRows] = await Promise.all([
    sql<{ id: string; animeId: string; seasonNumber: number | null; number: number }>`
      SELECT "id", "animeId", "seasonNumber", "number"
      FROM "catalog_episode"
      WHERE "animeId" = ANY(${cleanAnimeIds})
    `,
    sql<{ episode_history: unknown }>`
      SELECT "episode_history"
      FROM "catalog_anime"
      WHERE "id" = ANY(${cleanAnimeIds})
    `,
    sql<{ episode_history: unknown }>`
      SELECT "episode_history"
      FROM "catalog_anime_id_alias"
      WHERE "old_id" = ANY(${cleanAnimeIds})
         OR "current_id" = ANY(${cleanAnimeIds})
    `,
  ]);

  let targetKey: { seasonNumber: number; number: number } | null = null;
  const activeMatch = activeEpisodes.find((ep) => ep.id === cleanEpId);
  if (activeMatch) {
    targetKey = {
      seasonNumber: Math.trunc(Number(activeMatch.seasonNumber ?? 1)),
      number: Math.trunc(Number(activeMatch.number)),
    };
  }

  let combinedHistory: EpisodeHistoryEntry[] = [];
  for (const row of [...animeHistRows, ...aliasHistRows]) {
    combinedHistory = mergeEpisodeHistory(
      combinedHistory,
      parseEpisodeHistoryArray(row.episode_history),
    );
  }

  if (!targetKey) {
    const histMatch = combinedHistory.find((entry) => entry.episodeId === cleanEpId);
    if (histMatch) {
      targetKey = {
        seasonNumber: histMatch.seasonNumber,
        number: histMatch.number,
      };
    }
  }

  if (!targetKey) {
    return { canonicalEpisodeId: cleanEpId, candidateEpisodeIds: [cleanEpId] };
  }

  const equivalentIds = new Set<string>([cleanEpId]);
  let canonicalEpId: string | null = null;

  for (const ep of activeEpisodes) {
    const s = Math.trunc(Number(ep.seasonNumber ?? 1));
    const n = Math.trunc(Number(ep.number));
    if (s === targetKey.seasonNumber && n === targetKey.number) {
      equivalentIds.add(ep.id);
      if (!canonicalEpId || ep.animeId === cleanAnimeIds[0]) {
        canonicalEpId = ep.id;
      }
    }
  }

  for (const entry of combinedHistory) {
    if (
      entry.seasonNumber === targetKey.seasonNumber &&
      entry.number === targetKey.number
    ) {
      equivalentIds.add(entry.episodeId);
    }
  }

  return {
    canonicalEpisodeId: canonicalEpId || cleanEpId,
    candidateEpisodeIds: Array.from(equivalentIds),
  };
}
