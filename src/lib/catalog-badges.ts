import { getSql } from "@/lib/db";
import { invalidateHomePublicEpisodesCache } from "@/lib/home-episodes";
import { getRedisCatalogBadges, setRedisCatalogBadges, invalidateRedisCatalogBadges } from "@/lib/redis";
import {
  normalizeAnimeRecentBadges,
  type AnimeRecentBadges,
} from "@/lib/types";
export type { AnimeRecentBadges };

export const ANIME_RECENT_BADGES_KEY_PREFIX = "anime_recent_badges:";

export interface StoredAnimeRecentBadgesRecord {
  animeId: string;
  anilistId?: number | null;
  malId?: number | null;
  kitsuId?: number | null;
  lancamento: boolean;
  novo: boolean;
  final: boolean;
  updatedAt?: number;
}

export interface AnimeRecentBadgesLookup {
  byId: Map<string, AnimeRecentBadges>;
  byAnilistId: Map<number, AnimeRecentBadges>;
  byMalId: Map<number, AnimeRecentBadges>;
  byKitsuId: Map<number, AnimeRecentBadges>;
}

export function buildAnimeRecentBadgesKey(animeId: string): string {
  const cleanId = animeId.trim();
  const full = `${ANIME_RECENT_BADGES_KEY_PREFIX}${cleanId}`;
  return full.length <= 128 ? full : full.slice(0, 128);
}

function createEmptyLookup(): AnimeRecentBadgesLookup {
  return {
    byId: new Map(),
    byAnilistId: new Map(),
    byMalId: new Map(),
    byKitsuId: new Map(),
  };
}

function parseStoredRecord(
  key: string,
  rawValue: string,
): StoredAnimeRecentBadgesRecord | null {
  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredAnimeRecentBadgesRecord>;
    if (!parsed || typeof parsed !== "object") return null;
    const keyAnimeId = key.startsWith(ANIME_RECENT_BADGES_KEY_PREFIX)
      ? key.slice(ANIME_RECENT_BADGES_KEY_PREFIX.length)
      : "";
    const animeId =
      typeof parsed.animeId === "string" && parsed.animeId.trim()
        ? parsed.animeId.trim()
        : keyAnimeId;
    if (!animeId) return null;

    const badges = normalizeAnimeRecentBadges(parsed);
    return {
      animeId,
      anilistId:
        typeof parsed.anilistId === "number" && Number.isFinite(parsed.anilistId)
          ? parsed.anilistId
          : null,
      malId:
        typeof parsed.malId === "number" && Number.isFinite(parsed.malId)
          ? parsed.malId
          : null,
      kitsuId:
        typeof parsed.kitsuId === "number" && Number.isFinite(parsed.kitsuId)
          ? parsed.kitsuId
          : null,
      lancamento: badges.lancamento,
      novo: badges.novo,
      final: badges.final,
      updatedAt:
        typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
          ? parsed.updatedAt
          : undefined,
    };
  } catch {
    return null;
  }
}

let cachedBadgesResult: { data: AnimeRecentBadgesLookup; timestamp: number } | null = null;
let badgesInFlightPromise: Promise<AnimeRecentBadgesLookup> | null = null;
const BADGES_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos

function buildBadgesLookupFromRows(rows: Array<{ key: string; value: string }>): AnimeRecentBadgesLookup {
  const lookup = createEmptyLookup();
  for (const row of rows ?? []) {
    const record = parseStoredRecord(row.key, row.value);
    if (!record) continue;
    const badges = normalizeAnimeRecentBadges(record);
    lookup.byId.set(record.animeId, badges);
    if (record.anilistId && record.anilistId > 0 && !lookup.byAnilistId.has(record.anilistId)) {
      lookup.byAnilistId.set(record.anilistId, badges);
    }
    if (record.malId && record.malId > 0 && !lookup.byMalId.has(record.malId)) {
      lookup.byMalId.set(record.malId, badges);
    }
    if (record.kitsuId && record.kitsuId > 0 && !lookup.byKitsuId.has(record.kitsuId)) {
      lookup.byKitsuId.set(record.kitsuId, badges);
    }
  }
  return lookup;
}

export function invalidateAnimeRecentBadgesCache(): void {
  cachedBadgesResult = null;
  badgesInFlightPromise = null;
  invalidateHomePublicEpisodesCache();
  void invalidateRedisCatalogBadges().catch(() => {});
}

export async function loadAllAnimeRecentBadgesFromDb(): Promise<AnimeRecentBadgesLookup> {
  const now = Date.now();
  if (cachedBadgesResult && now - cachedBadgesResult.timestamp < BADGES_CACHE_TTL_MS) {
    return cachedBadgesResult.data;
  }

  if (badgesInFlightPromise) {
    return badgesInFlightPromise;
  }

  badgesInFlightPromise = (async () => {
    try {
      // 1. Tentar consultar no Upstash Redis (cache compartilhado)
      const redisRows = await getRedisCatalogBadges();
      if (Array.isArray(redisRows) && redisRows.length > 0) {
        const lookup = buildBadgesLookupFromRows(redisRows);
        cachedBadgesResult = {
          data: lookup,
          timestamp: Date.now(),
        };
        return lookup;
      }

      // 2. Se miss no Redis, consultar o PostgreSQL
      const sql = await getSql();
      const rows = await sql.query<{ key: string; value: string }>(
        `SELECT "key", "value"
         FROM "admin_settings"
         WHERE "key" LIKE $1;`,
        [`${ANIME_RECENT_BADGES_KEY_PREFIX}%`],
      );

      const validRows = rows ?? [];
      // Salvar de forma assíncrona no Redis (sem bloquear a resposta)
      void setRedisCatalogBadges(validRows).catch(() => {});

      const lookup = buildBadgesLookupFromRows(validRows);
      cachedBadgesResult = {
        data: lookup,
        timestamp: Date.now(),
      };
      return lookup;
    } catch (err) {
      console.warn("[catalog-badges] Falha segura ao carregar selos:", err);
      return cachedBadgesResult?.data ?? createEmptyLookup();
    } finally {
      badgesInFlightPromise = null;
    }
  })();

  return badgesInFlightPromise;
}

export function findAnimeRecentBadgesInLookup(
  lookup: AnimeRecentBadgesLookup,
  ids: {
    id?: string | null;
    serverCatalogId?: string | null;
    anilistId?: number | null;
    malId?: number | null;
    kitsuId?: number | null;
    allowExternalFallback?: boolean;
  },
): AnimeRecentBadges | null {
  const directCandidates = [ids.id, ids.serverCatalogId].filter(
    (v): v is string => typeof v === "string" && Boolean(v.trim()),
  );
  for (const cid of directCandidates) {
    const found = lookup.byId.get(cid.trim());
    if (found) return found;
  }

  if (ids.allowExternalFallback === false) {
    return null;
  }

  if (typeof ids.anilistId === "number" && ids.anilistId > 0) {
    const found = lookup.byAnilistId.get(ids.anilistId);
    if (found) return found;
  }
  if (typeof ids.malId === "number" && ids.malId > 0) {
    const found = lookup.byMalId.get(ids.malId);
    if (found) return found;
  }
  if (typeof ids.kitsuId === "number" && ids.kitsuId > 0) {
    const found = lookup.byKitsuId.get(ids.kitsuId);
    if (found) return found;
  }

  return null;
}

export async function loadAnimeRecentBadgesFromDb(ids: {
  id?: string | null;
  serverCatalogId?: string | null;
  anilistId?: number | null;
  malId?: number | null;
  kitsuId?: number | null;
  allowExternalFallback?: boolean;
}): Promise<AnimeRecentBadges | null> {
  const lookup = await loadAllAnimeRecentBadgesFromDb();
  return findAnimeRecentBadgesInLookup(lookup, ids);
}

export async function saveAnimeRecentBadgesToDb(input: {
  animeId: string;
  anilistId?: number | null;
  malId?: number | null;
  kitsuId?: number | null;
  badges: Partial<AnimeRecentBadges>;
  previousAliasId?: string | null;
}): Promise<AnimeRecentBadges> {
  const sql = await getSql();
  const normalized = normalizeAnimeRecentBadges(input.badges);
  const cleanId = input.animeId.trim();
  const key = buildAnimeRecentBadgesKey(cleanId);

  const record: StoredAnimeRecentBadgesRecord = {
    animeId: cleanId,
    anilistId: input.anilistId ?? null,
    malId: input.malId ?? null,
    kitsuId: input.kitsuId ?? null,
    lancamento: normalized.lancamento,
    novo: normalized.novo,
    final: normalized.final,
    updatedAt: Date.now(),
  };

  await sql.query(
    `INSERT INTO "admin_settings" ("key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("key") DO UPDATE
     SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP;`,
    [key, JSON.stringify(record)],
  );

  const prevId = input.previousAliasId?.trim();
  if (prevId && prevId !== cleanId) {
    await sql
      .query(`DELETE FROM "admin_settings" WHERE "key" = $1;`, [
        buildAnimeRecentBadgesKey(prevId),
      ])
      .catch(() => undefined);
  }

  invalidateAnimeRecentBadgesCache();
  return normalized;
}

export async function deleteAnimeRecentBadgesFromDb(
  animeId: string,
): Promise<void> {
  const cleanId = animeId?.trim();
  if (!cleanId) return;
  try {
    const sql = await getSql();
    await sql.query(`DELETE FROM "admin_settings" WHERE "key" = $1;`, [
      buildAnimeRecentBadgesKey(cleanId),
    ]);
    invalidateAnimeRecentBadgesCache();
  } catch (err) {
    console.warn("[catalog-badges] Falha ao remover selos de admin_settings:", err);
  }
}
