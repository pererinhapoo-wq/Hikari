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
  updated_at: string | null;
};

export type IdentityMatchInput = {
  id?: string | null;
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

    const aliasRows = await sql<CatalogAnimeIdAliasRow>`
      SELECT "old_id", "current_id", "anilist_id", "mal_id", "kitsu_id",
             "title_norm", "format", "year", "is_dubbed", "episode_history",
             "archived_at", "updated_at"
      FROM "catalog_anime_id_alias"
      WHERE "old_id" = ${cursor}
      LIMIT 1
    `;
    const aliasRow = aliasRows[0];
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
    if (!areFormatsCompatible(params.format, row.format)) {
      continue;
    }
    if (!areYearsCompatible(params.year, row.year)) {
      continue;
    }

    const rowNormTitles = collectNormalizedTitles({
      title: row.title,
      titleRomaji: row.titleRomaji,
      titleEnglish: row.titleEnglish,
      titleNative: row.titleNative,
    });
    const extraAliases = aliasTextByAnimeId.get(row.id) ?? [];
    const hasTitleMatch =
      rowNormTitles.some((t) => titleSet.has(t)) ||
      extraAliases.some((t) => titleSet.has(t));

    if (hasTitleMatch) {
      candidates.push(row);
    }
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
 * matching external IDs or compatible title+format+year+isDubbed.
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
           "archived_at", "updated_at"
    FROM "catalog_anime_id_alias"
    WHERE "current_id" IS NULL
  `;

  const matched: CatalogAnimeIdAliasRow[] = [];
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
      matched.push(row);
      continue;
    }

    const rowNorm = row.title_norm ? normalizeIdentityTitle(row.title_norm) : "";
    if (
      rowNorm &&
      normSet.has(rowNorm) &&
      areFormatsCompatible(input.format, row.format) &&
      areYearsCompatible(input.year, row.year)
    ) {
      matched.push(row);
    }
  }

  return matched;
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

  if (rawId) {
    // 1. Direct active match
    const directRows = await sql<CatalogAnimeIdentityRow>`
      SELECT "id", "title", "anilistId", "malId", "kitsuId",
             "titleRomaji", "titleEnglish", "titleNative",
             "cover", "banner", "synopsis", "format", "status",
             "episodesCount", "year", "season", "hidden", "archived_at", "episode_history"
      FROM "catalog_anime"
      WHERE "id" = ${rawId}
        AND "archived_at" IS NULL
      LIMIT 1
    `;
    if (directRows[0]) {
      const aliasIds = await getAllAliasIdsForCanonical(sql, directRows[0].id);
      return {
        canonicalId: directRows[0].id,
        row: directRows[0],
        matchedBy: "id",
        aliasIds,
        ambiguous: false,
        archivedMatchIds: [],
      };
    }

    // 2. Alias chain lookup
    const chain = await resolveAliasChainTarget(sql, rawId);
    visitedChainIds = chain.visitedIds;
    if (chain.canonicalRow && chain.canonicalId) {
      const aliasIds = await getAllAliasIdsForCanonical(sql, chain.canonicalId);
      return {
        canonicalId: chain.canonicalId,
        row: chain.canonicalRow,
        matchedBy: "alias",
        resolvedFromAliasId: rawId,
        aliasIds: Array.from(new Set([...aliasIds, ...chain.visitedIds])).filter(
          (x) => x !== chain.canonicalId,
        ),
        ambiguous: false,
        archivedMatchIds: [],
      };
    }

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
    if (
      snapTitles.some((t) => normTitles.has(t)) &&
      areFormatsCompatible(target.format, snap.format) &&
      areYearsCompatible(target.year, snap.year)
    ) {
      matchedIds.add(candidateId);
    }
  }

  return Array.from(matchedIds);
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
    const mergedStatus =
      freshest.status ||
      group.find((r) => r.status === "completed")?.status ||
      "planning";
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
  const byNumberOnly = new Map<number, string | null>();
  for (const ep of currentEpisodes) {
    const s = Number(ep.seasonNumber ?? 1);
    const n = Number(ep.number);
    bySeasonNum.set(`${s}:${n}`, ep.id);
    if (byNumberOnly.has(n)) {
      byNumberOnly.set(n, null); // ambiguous across multiple seasons
    } else {
      byNumberOnly.set(n, ep.id);
    }
  }

  const mapEpisodeId = (oldEpId: string, epNumber: number): string => {
    const meta = oldEpMeta.get(oldEpId);
    if (meta) {
      const exact = bySeasonNum.get(`${meta.seasonNumber}:${meta.number}`);
      if (exact) return exact;
    }
    const fallbackByNum = byNumberOnly.get(Number(epNumber));
    if (fallbackByNum) return fallbackByNum;
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
      const mappedEpId = mapEpisodeId(row.episodeId, row.episodeNumber);
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
      const mappedEpId = mapEpisodeId(row.episodeId, row.episodeNumber);
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

  return { remappedOldEpisodeIds: matchingOldEpisodeIds };
}
