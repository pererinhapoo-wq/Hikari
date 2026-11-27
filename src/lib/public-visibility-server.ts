import { getSql, type Sql } from "@/lib/db";
import {
  BLOCKED_ANILIST_IDS,
  EMPTY_PUBLIC_VISIBILITY_CONTEXT,
  filterPublicAnimes,
  isConfirmedDonghuaOrigin,
  isPubliclyBlockedAnime,
  isPubliclyBlockedId,
  normalizeCountryOfOrigin,
  parseVisibilityIdentifier,
  type VisibilityAnimeCandidate,
  type VisibilityIndexContext,
} from "@/lib/public-visibility";

export interface VisibilityDbCatalogRow {
  id: string;
  anilistId: number | null;
  malId: number | null;
  kitsuId: number | null;
  countryOfOrigin: string | null;
  duplicateOfId: string | null;
}

export interface VisibilityDbAliasRow {
  oldId: string;
  currentId: string | null;
  anilistId: number | null;
  malId: number | null;
  kitsuId: number | null;
}

const VISIBILITY_CACHE_TTL_MS = 30 * 1000;

let cachedVisibilityContext: {
  ctx: VisibilityIndexContext;
  timestamp: number;
} | null = null;
let inFlightVisibilityPromise: Promise<VisibilityIndexContext> | null = null;
let visibilityCacheEpoch = 0;

export function invalidatePublicVisibilityCache(): void {
  visibilityCacheEpoch += 1;
  cachedVisibilityContext = null;
  inFlightVisibilityPromise = null;
}

function addCatalogRowToBlocked(
  row: VisibilityDbCatalogRow,
  blockedCatalogIds: Set<string>,
  blockedAnilistIds: Set<number>,
  blockedMalIds: Set<number>,
  blockedKitsuIds: Set<number>,
): void {
  const parsed = parseVisibilityIdentifier(row.id);
  if (parsed) {
    blockedCatalogIds.add(parsed.raw);
    blockedCatalogIds.add(parsed.normalized);
    if (parsed.anilistId) {
      blockedAnilistIds.add(parsed.anilistId);
      blockedCatalogIds.add(String(parsed.anilistId));
      blockedCatalogIds.add(`anilist-${parsed.anilistId}`);
    }
    if (parsed.malId) {
      blockedMalIds.add(parsed.malId);
      blockedCatalogIds.add(`mal-${parsed.malId}`);
    }
    if (parsed.kitsuId) {
      blockedKitsuIds.add(parsed.kitsuId);
      blockedCatalogIds.add(`kitsu-${parsed.kitsuId}`);
    }
  } else if (row.id.trim()) {
    blockedCatalogIds.add(row.id.trim());
  }

  if (typeof row.anilistId === "number" && row.anilistId > 0) {
    blockedAnilistIds.add(row.anilistId);
    blockedCatalogIds.add(String(row.anilistId));
    blockedCatalogIds.add(`anilist-${row.anilistId}`);
  }
  if (typeof row.malId === "number" && row.malId > 0) {
    blockedMalIds.add(row.malId);
    blockedCatalogIds.add(`mal-${row.malId}`);
  }
  if (typeof row.kitsuId === "number" && row.kitsuId > 0) {
    blockedKitsuIds.add(row.kitsuId);
    blockedCatalogIds.add(`kitsu-${row.kitsuId}`);
  }
}

function isCatalogRowBlocked(
  row: VisibilityDbCatalogRow,
  blockedCatalogIds: ReadonlySet<string>,
  blockedAnilistIds: ReadonlySet<number>,
  blockedMalIds: ReadonlySet<number>,
  blockedKitsuIds: ReadonlySet<number>,
): boolean {
  if (isConfirmedDonghuaOrigin(row.countryOfOrigin)) {
    return true;
  }

  if (
    typeof row.anilistId === "number" &&
    row.anilistId > 0 &&
    blockedAnilistIds.has(row.anilistId)
  ) {
    return true;
  }
  if (
    typeof row.malId === "number" &&
    row.malId > 0 &&
    blockedMalIds.has(row.malId)
  ) {
    return true;
  }
  if (
    typeof row.kitsuId === "number" &&
    row.kitsuId > 0 &&
    blockedKitsuIds.has(row.kitsuId)
  ) {
    return true;
  }

  const parsed = parseVisibilityIdentifier(row.id);
  if (parsed) {
    if (
      blockedCatalogIds.has(parsed.raw) ||
      blockedCatalogIds.has(parsed.normalized)
    ) {
      return true;
    }
    if (parsed.anilistId && blockedAnilistIds.has(parsed.anilistId)) {
      return true;
    }
    if (parsed.malId && blockedMalIds.has(parsed.malId)) {
      return true;
    }
    if (parsed.kitsuId && blockedKitsuIds.has(parsed.kitsuId)) {
      return true;
    }
  } else if (row.id.trim() && blockedCatalogIds.has(row.id.trim())) {
    return true;
  }

  if (row.duplicateOfId && row.duplicateOfId.trim()) {
    const dupId = row.duplicateOfId.trim();
    const dupParsed = parseVisibilityIdentifier(dupId);
    if (blockedCatalogIds.has(dupId)) return true;
    if (dupParsed) {
      if (blockedCatalogIds.has(dupParsed.normalized)) return true;
      if (dupParsed.anilistId && blockedAnilistIds.has(dupParsed.anilistId)) {
        return true;
      }
      if (dupParsed.malId && blockedMalIds.has(dupParsed.malId)) {
        return true;
      }
      if (dupParsed.kitsuId && blockedKitsuIds.has(dupParsed.kitsuId)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calcula o fechamento transitivo da regra de visibilidade pública a partir
 * das linhas reais de `catalog_anime` e `catalog_anime_id_alias`:
 * - 22 IDs AniList bloqueados
 * - country_of_origin === "CN" (nunca "TW" ou "HK", nunca null)
 * - aliases históricos (`catalog_anime_id_alias`)
 * - duplicatas explícitas (`duplicate_of_id`) e vínculos por IDs externos reais
 * - Zero inferência por similaridade de título
 */
export function buildServerVisibilityContextFromRows(
  catalogRows: ReadonlyArray<VisibilityDbCatalogRow>,
  aliasRows: ReadonlyArray<VisibilityDbAliasRow>,
): VisibilityIndexContext {
  const blockedCatalogIds = new Set<string>();
  const blockedAnilistIds = new Set<number>(BLOCKED_ANILIST_IDS);
  const blockedMalIds = new Set<number>();
  const blockedKitsuIds = new Set<number>();
  const countryByCatalogId = new Map<string, string>();
  const countryByAnilistId = new Map<number, string>();
  const aliasToCanonicalId = new Map<string, string>();

  for (const blockedAni of BLOCKED_ANILIST_IDS) {
    blockedCatalogIds.add(String(blockedAni));
    blockedCatalogIds.add(`anilist-${blockedAni}`);
  }

  for (const row of catalogRows) {
    const origin = normalizeCountryOfOrigin(row.countryOfOrigin);
    if (origin) {
      countryByCatalogId.set(row.id.trim(), origin);
      if (typeof row.anilistId === "number" && row.anilistId > 0) {
        countryByAnilistId.set(row.anilistId, origin);
      }
    }
  }

  for (const alias of aliasRows) {
    const oldId = alias.oldId?.trim();
    const currentId = alias.currentId?.trim();
    if (oldId && currentId && oldId !== currentId) {
      aliasToCanonicalId.set(oldId, currentId);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    const beforeSize =
      blockedCatalogIds.size +
      blockedAnilistIds.size +
      blockedMalIds.size +
      blockedKitsuIds.size;

    for (const row of catalogRows) {
      if (
        isCatalogRowBlocked(
          row,
          blockedCatalogIds,
          blockedAnilistIds,
          blockedMalIds,
          blockedKitsuIds,
        )
      ) {
        addCatalogRowToBlocked(
          row,
          blockedCatalogIds,
          blockedAnilistIds,
          blockedMalIds,
          blockedKitsuIds,
        );
        if (row.duplicateOfId && row.duplicateOfId.trim()) {
          const dupId = row.duplicateOfId.trim();
          const dupParsed = parseVisibilityIdentifier(dupId);
          blockedCatalogIds.add(dupId);
          if (dupParsed) {
            blockedCatalogIds.add(dupParsed.normalized);
            if (dupParsed.anilistId) {
              blockedAnilistIds.add(dupParsed.anilistId);
              blockedCatalogIds.add(String(dupParsed.anilistId));
              blockedCatalogIds.add(`anilist-${dupParsed.anilistId}`);
            }
            if (dupParsed.malId) {
              blockedMalIds.add(dupParsed.malId);
              blockedCatalogIds.add(`mal-${dupParsed.malId}`);
            }
            if (dupParsed.kitsuId) {
              blockedKitsuIds.add(dupParsed.kitsuId);
              blockedCatalogIds.add(`kitsu-${dupParsed.kitsuId}`);
            }
          }
        }
      }
    }

    for (const alias of aliasRows) {
      const oldId = alias.oldId?.trim();
      const currentId = alias.currentId?.trim();
      const oldParsed = parseVisibilityIdentifier(oldId);
      const currentParsed = parseVisibilityIdentifier(currentId);

      const aliasBlocked =
        (oldId ? blockedCatalogIds.has(oldId) : false) ||
        (oldParsed
          ? blockedCatalogIds.has(oldParsed.normalized) ||
            Boolean(oldParsed.anilistId && blockedAnilistIds.has(oldParsed.anilistId)) ||
            Boolean(oldParsed.malId && blockedMalIds.has(oldParsed.malId)) ||
            Boolean(oldParsed.kitsuId && blockedKitsuIds.has(oldParsed.kitsuId))
          : false) ||
        (currentId ? blockedCatalogIds.has(currentId) : false) ||
        (currentParsed
          ? blockedCatalogIds.has(currentParsed.normalized) ||
            Boolean(
              currentParsed.anilistId &&
                blockedAnilistIds.has(currentParsed.anilistId),
            ) ||
            Boolean(currentParsed.malId && blockedMalIds.has(currentParsed.malId)) ||
            Boolean(
              currentParsed.kitsuId && blockedKitsuIds.has(currentParsed.kitsuId),
            )
          : false) ||
        Boolean(alias.anilistId && blockedAnilistIds.has(alias.anilistId)) ||
        Boolean(alias.malId && blockedMalIds.has(alias.malId)) ||
        Boolean(alias.kitsuId && blockedKitsuIds.has(alias.kitsuId));

      if (!aliasBlocked) continue;

      if (oldId) blockedCatalogIds.add(oldId);
      if (oldParsed) {
        blockedCatalogIds.add(oldParsed.normalized);
        if (oldParsed.anilistId) {
          blockedAnilistIds.add(oldParsed.anilistId);
          blockedCatalogIds.add(String(oldParsed.anilistId));
          blockedCatalogIds.add(`anilist-${oldParsed.anilistId}`);
        }
        if (oldParsed.malId) {
          blockedMalIds.add(oldParsed.malId);
          blockedCatalogIds.add(`mal-${oldParsed.malId}`);
        }
        if (oldParsed.kitsuId) {
          blockedKitsuIds.add(oldParsed.kitsuId);
          blockedCatalogIds.add(`kitsu-${oldParsed.kitsuId}`);
        }
      }
      if (currentId) blockedCatalogIds.add(currentId);
      if (currentParsed) {
        blockedCatalogIds.add(currentParsed.normalized);
        if (currentParsed.anilistId) {
          blockedAnilistIds.add(currentParsed.anilistId);
          blockedCatalogIds.add(String(currentParsed.anilistId));
          blockedCatalogIds.add(`anilist-${currentParsed.anilistId}`);
        }
        if (currentParsed.malId) {
          blockedMalIds.add(currentParsed.malId);
          blockedCatalogIds.add(`mal-${currentParsed.malId}`);
        }
        if (currentParsed.kitsuId) {
          blockedKitsuIds.add(currentParsed.kitsuId);
          blockedCatalogIds.add(`kitsu-${currentParsed.kitsuId}`);
        }
      }
      if (typeof alias.anilistId === "number" && alias.anilistId > 0) {
        blockedAnilistIds.add(alias.anilistId);
        blockedCatalogIds.add(String(alias.anilistId));
        blockedCatalogIds.add(`anilist-${alias.anilistId}`);
      }
      if (typeof alias.malId === "number" && alias.malId > 0) {
        blockedMalIds.add(alias.malId);
        blockedCatalogIds.add(`mal-${alias.malId}`);
      }
      if (typeof alias.kitsuId === "number" && alias.kitsuId > 0) {
        blockedKitsuIds.add(alias.kitsuId);
        blockedCatalogIds.add(`kitsu-${alias.kitsuId}`);
      }
    }

    const afterSize =
      blockedCatalogIds.size +
      blockedAnilistIds.size +
      blockedMalIds.size +
      blockedKitsuIds.size;
    if (afterSize > beforeSize) {
      changed = true;
    }
  }

  return {
    blockedCatalogIds,
    blockedAnilistIds,
    blockedMalIds,
    blockedKitsuIds,
    countryByCatalogId,
    countryByAnilistId,
    aliasToCanonicalId,
  };
}

async function queryVisibilityRowsFromSql(sql: Sql): Promise<{
  catalogRows: VisibilityDbCatalogRow[];
  aliasRows: VisibilityDbAliasRow[];
}> {
  let catalogRows: VisibilityDbCatalogRow[] = [];
  try {
    catalogRows = await sql.query<VisibilityDbCatalogRow>(
      `SELECT
         "id",
         "anilistId",
         "malId",
         "kitsuId",
         "country_of_origin" AS "countryOfOrigin",
         "duplicate_of_id" AS "duplicateOfId"
       FROM "catalog_anime";`,
    );
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "42703") {
      // Compatibilidade pré-migration 0052
      catalogRows = await sql.query<VisibilityDbCatalogRow>(
        `SELECT
           "id",
           "anilistId",
           "malId",
           "kitsuId",
           NULL::text AS "countryOfOrigin",
           NULL::text AS "duplicateOfId"
         FROM "catalog_anime";`,
      );
    } else {
      throw err;
    }
  }

  let aliasRows: VisibilityDbAliasRow[] = [];
  try {
    aliasRows = await sql.query<VisibilityDbAliasRow>(
      `SELECT
         "old_id" AS "oldId",
         "current_id" AS "currentId",
         "anilist_id" AS "anilistId",
         "mal_id" AS "malId",
         "kitsu_id" AS "kitsuId"
       FROM "catalog_anime_id_alias";`,
    );
  } catch {
    aliasRows = [];
  }

  return {
    catalogRows: Array.isArray(catalogRows) ? catalogRows : [],
    aliasRows: Array.isArray(aliasRows) ? aliasRows : [],
  };
}

export async function getServerPublicVisibilityContext(
  sqlOverride?: Sql,
): Promise<VisibilityIndexContext> {
  if (sqlOverride) {
    try {
      const { catalogRows, aliasRows } = await queryVisibilityRowsFromSql(
        sqlOverride,
      );
      return buildServerVisibilityContextFromRows(catalogRows, aliasRows);
    } catch {
      return EMPTY_PUBLIC_VISIBILITY_CONTEXT;
    }
  }

  const now = Date.now();
  if (
    cachedVisibilityContext &&
    now - cachedVisibilityContext.timestamp < VISIBILITY_CACHE_TTL_MS
  ) {
    return cachedVisibilityContext.ctx;
  }

  if (inFlightVisibilityPromise) {
    return inFlightVisibilityPromise;
  }

  const requestEpoch = visibilityCacheEpoch;
  let flightRef: Promise<VisibilityIndexContext> | null = null;
  const flight = (async (): Promise<VisibilityIndexContext> => {
    try {
      const sql = await getSql();
      const { catalogRows, aliasRows } = await queryVisibilityRowsFromSql(sql);
      const ctx = buildServerVisibilityContextFromRows(catalogRows, aliasRows);
      if (requestEpoch === visibilityCacheEpoch) {
        cachedVisibilityContext = { ctx, timestamp: Date.now() };
      }
      return ctx;
    } catch (err) {
      console.warn(
        "[public-visibility] Falha ao carregar índice de visibilidade (mantendo bloqueio mínimo de IDs e CN):",
        err instanceof Error ? err.message : err,
      );
      return EMPTY_PUBLIC_VISIBILITY_CONTEXT;
    } finally {
      if (inFlightVisibilityPromise === flightRef) {
        inFlightVisibilityPromise = null;
      }
    }
  })();

  flightRef = flight;
  inFlightVisibilityPromise = flight;
  return flight;
}

export async function isServerPubliclyBlockedId(
  id: string | number | null | undefined,
  sqlOverride?: Sql,
): Promise<boolean> {
  const ctx = await getServerPublicVisibilityContext(sqlOverride);
  return isPubliclyBlockedId(id, ctx);
}

export async function isServerPubliclyBlockedAnime(
  candidate: VisibilityAnimeCandidate | null | undefined,
  sqlOverride?: Sql,
): Promise<boolean> {
  if (!candidate) return false;
  if (isPubliclyBlockedAnime(candidate, EMPTY_PUBLIC_VISIBILITY_CONTEXT)) {
    return true;
  }
  const ctx = await getServerPublicVisibilityContext(sqlOverride);
  return isPubliclyBlockedAnime(candidate, ctx);
}

export async function filterServerPublicAnimes<
  T extends VisibilityAnimeCandidate,
>(
  items: ReadonlyArray<T> | null | undefined,
  sqlOverride?: Sql,
): Promise<T[]> {
  if (!Array.isArray(items) || items.length === 0) return [];
  const ctx = await getServerPublicVisibilityContext(sqlOverride);
  return filterPublicAnimes(items, ctx);
}
