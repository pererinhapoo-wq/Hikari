import { Redis } from "@upstash/redis";
import type { AnimeCreditsResult } from "@/lib/api";
import type { DbCatalogAnimeRow } from "@/lib/catalog-server-overlay.server";
import type { CatalogEpisodesResult, PublicEpisodesResult } from "@/lib/catalog-episodes";
import type { HomeEpisodesResult } from "@/lib/home-episodes";
import type { Anime, Episode, HomeCatalog, Season, SlimAnime } from "@/lib/types";

const restUrl = typeof process !== "undefined" ? process.env.UPSTASH_REDIS_REST_URL?.trim() : undefined;
const restToken = typeof process !== "undefined" ? process.env.UPSTASH_REDIS_REST_TOKEN?.trim() : undefined;

let redisClient: Redis | null = null;

if (restUrl && restToken) {
  try {
    redisClient = new Redis({
      url: restUrl,
      token: restToken,
    });
  } catch (err) {
    console.warn("[redis] Falha ao inicializar cliente Upstash Redis:", err instanceof Error ? err.message : err);
    redisClient = null;
  }
}

export function getRedisClient(): Redis | null {
  return redisClient;
}

const CATALOG_REDIS_KEY = "hikari:catalog:index:v1";
const CATALOG_REDIS_TTL_SEC = 900; // 15 minutos

export async function getRedisCatalogIndex(): Promise<DbCatalogAnimeRow[] | null> {
  if (!redisClient || typeof window !== "undefined") return null;
  try {
    const data = await Promise.race([
      redisClient.get<DbCatalogAnimeRow[]>(CATALOG_REDIS_KEY),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 2500)),
    ]);
    if (Array.isArray(data)) {
      return data;
    }
    return null;
  } catch (err) {
    // Fail-open: falha no Redis não afeta a aplicação
    console.warn("[redis] Aviso ao buscar índice do catálogo no Redis (fallback para DB):", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setRedisCatalogIndex(rows: DbCatalogAnimeRow[]): Promise<void> {
  if (!redisClient || typeof window !== "undefined" || !Array.isArray(rows)) return;
  try {
    await Promise.race([
      redisClient.set(CATALOG_REDIS_KEY, rows, { ex: CATALOG_REDIS_TTL_SEC }),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 2500)),
    ]);
  } catch (err) {
    console.warn("[redis] Aviso ao salvar índice do catálogo no Redis:", err instanceof Error ? err.message : err);
  }
}

export async function invalidateRedisCatalogIndex(): Promise<void> {
  if (!redisClient || typeof window !== "undefined") return;
  try {
    await Promise.race([
      redisClient.del(CATALOG_REDIS_KEY),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 2500)),
    ]);
  } catch (err) {
    console.warn("[redis] Aviso ao invalidar índice do catálogo no Redis:", err instanceof Error ? err.message : err);
  }
}

const BADGES_REDIS_KEY = "hikari:catalog:badges:v1";
const BADGES_REDIS_TTL_SEC = 180; // 3 minutos (180 segundos)

export async function getRedisCatalogBadges(): Promise<Array<{ key: string; value: string }> | null> {
  if (!redisClient || typeof window !== "undefined") return null;
  try {
    const data = await Promise.race([
      redisClient.get<Array<{ key: string; value: string }>>(BADGES_REDIS_KEY),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 2500)),
    ]);
    if (Array.isArray(data)) {
      return data;
    }
    return null;
  } catch (err) {
    console.warn("[redis] Aviso ao buscar badges no Redis (fallback para DB):", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setRedisCatalogBadges(rows: Array<{ key: string; value: string }>): Promise<void> {
  if (!redisClient || typeof window !== "undefined" || !Array.isArray(rows)) return;
  try {
    await Promise.race([
      redisClient.set(BADGES_REDIS_KEY, rows, { ex: BADGES_REDIS_TTL_SEC }),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 2500)),
    ]);
  } catch (err) {
    console.warn("[redis] Aviso ao salvar badges no Redis:", err instanceof Error ? err.message : err);
  }
}

export async function invalidateRedisCatalogBadges(): Promise<void> {
  if (!redisClient || typeof window !== "undefined") return;
  try {
    await Promise.race([
      redisClient.del(BADGES_REDIS_KEY),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 2500)),
    ]);
  } catch (err) {
    console.warn("[redis] Aviso ao invalidar badges no Redis:", err instanceof Error ? err.message : err);
  }
}

const EPISODES_REDIS_KEY_PREFIX = "hikari:catalog:episodes:";
const EPISODES_REDIS_TTL_SEC = 180; // 180 segundos (3 minutos)

export async function getRedisCatalogEpisodes(animeId: string): Promise<CatalogEpisodesResult | null> {
  if (!redisClient || typeof window !== "undefined" || !animeId) return null;
  const key = `${EPISODES_REDIS_KEY_PREFIX}${animeId.trim()}:v1`;
  try {
    const data = await Promise.race([
      redisClient.get<CatalogEpisodesResult>(key),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 2500)),
    ]);
    if (data && typeof data === "object") {
      return data;
    }
    return null;
  } catch (err) {
    console.warn("[redis] Aviso ao buscar episódios no Redis (fallback para DB):", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setRedisCatalogEpisodes(animeId: string, data: CatalogEpisodesResult): Promise<void> {
  if (!redisClient || typeof window !== "undefined" || !animeId || !data) return;
  const key = `${EPISODES_REDIS_KEY_PREFIX}${animeId.trim()}:v1`;
  try {
    await Promise.race([
      redisClient.set(key, data, { ex: EPISODES_REDIS_TTL_SEC }),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 2500)),
    ]);
  } catch (err) {
    console.warn("[redis] Aviso ao salvar episódios no Redis:", err instanceof Error ? err.message : err);
  }
}

export async function invalidateRedisCatalogEpisodes(animeId?: string): Promise<void> {
  if (!redisClient || typeof window !== "undefined") return;
  try {
    const cleanId = animeId?.trim();
    if (cleanId) {
      const key = `${EPISODES_REDIS_KEY_PREFIX}${cleanId}:v1`;
      await Promise.race([
        redisClient.del(key),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 2500)),
      ]);
    }
  } catch (err) {
    console.warn("[redis] Aviso ao invalidar episódios no Redis:", err instanceof Error ? err.message : err);
  }
}

export function normalizeCatalogSearchQuery(query?: string): string {
  if (!query) return "";
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

const SEARCH_REDIS_KEY_PREFIX = "hikari:catalog:search:v1:";
const SEARCH_REDIS_TTL_SEC = 60; // 60 segundos

function buildSearchRedisKey(normalizedQuery: string, limit: number): string {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 12), 50);
  return `${SEARCH_REDIS_KEY_PREFIX}${encodeURIComponent(normalizedQuery)}:${safeLimit}`;
}

export async function getRedisCatalogSearch(
  query: string,
  limit: number,
): Promise<SlimAnime[] | null> {
  if (!redisClient || typeof window !== "undefined") return null;
  const clean = normalizeCatalogSearchQuery(query);
  if (!clean || clean.length < 2 || clean.length > 100) return null;

  const key = buildSearchRedisKey(clean, limit);
  try {
    const data = await Promise.race([
      redisClient.get<SlimAnime[]>(key),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 2500)),
    ]);
    if (Array.isArray(data)) {
      return data;
    }
    return null;
  } catch (err) {
    console.warn("[redis] Aviso ao buscar pesquisa no Redis (fallback para DB):", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setRedisCatalogSearch(
  query: string,
  limit: number,
  items: SlimAnime[],
): Promise<void> {
  if (!redisClient || typeof window !== "undefined" || !Array.isArray(items)) return;
  const clean = normalizeCatalogSearchQuery(query);
  if (!clean || clean.length < 2 || clean.length > 100) return;

  const key = buildSearchRedisKey(clean, limit);
  try {
    await Promise.race([
      redisClient.set(key, items, { ex: SEARCH_REDIS_TTL_SEC }),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 2500)),
    ]);
  } catch (err) {
    console.warn("[redis] Aviso ao salvar pesquisa no Redis:", err instanceof Error ? err.message : err);
  }
}

export async function invalidateRedisCatalogSearch(query?: string): Promise<void> {
  if (!redisClient || typeof window !== "undefined") return;
  try {
    const clean = query ? normalizeCatalogSearchQuery(query) : "";
    if (clean) {
      const pattern = `${SEARCH_REDIS_KEY_PREFIX}${encodeURIComponent(clean)}:*`;
      const keys = await Promise.race([
        redisClient.keys(pattern),
        new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 2500)),
      ]);
      if (Array.isArray(keys) && keys.length > 0) {
        await Promise.race([
          redisClient.del(...keys),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 2500)),
        ]);
      }
    } else {
      const keys = await Promise.race([
        redisClient.keys(`${SEARCH_REDIS_KEY_PREFIX}*`),
        new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 2500)),
      ]);
      if (Array.isArray(keys) && keys.length > 0) {
        await Promise.race([
          redisClient.del(...keys),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 2500)),
        ]);
      }
    }
  } catch (err) {
    console.warn("[redis] Aviso ao invalidar pesquisa no Redis:", err instanceof Error ? err.message : err);
  }
}

const DETAIL_REDIS_KEY_PREFIX = "hikari:catalog:detail:v1:";
const DETAIL_GLOBAL_GEN_KEY = "hikari:catalog:detail:gen:global:v1";
const DETAIL_ID_GEN_PREFIX = "hikari:catalog:detail:gen:id:v1:";
const DETAIL_REDIS_TTL_SEC = 1800; // 30 minutos (1800 segundos)
const REDIS_TIMEOUT_MS = 2500;
const DETAIL_CAS_MAX_ATTEMPTS = 4;

export type RedisAnimeDetailFence = {
  globalGen: string;
  idGens: Record<string, string>;
};

export type RedisAnimeDetailReadResult = {
  detail: Anime | null;
  fence: RedisAnimeDetailFence | null;
  status: "hit" | "miss" | "unavailable" | "failed";
};

export type RedisAnimeDetailWriteStatus =
  | "inserted"
  | "updated"
  | "unchanged"
  | "fenced"
  | "skipped"
  | "missing"
  | "conflict"
  | "unavailable"
  | "failed";

export type RedisAnimeDetailUpdateStatus =
  | "updated"
  | "unchanged"
  | "fenced"
  | "missing"
  | "conflict"
  | "unavailable"
  | "failed";

export type RedisAnimeDetailUpdateResult = {
  status: RedisAnimeDetailUpdateStatus;
  detail?: Anime;
};

// Prefixo ":" evita que o parseResponse automático do @upstash/redis faça JSON.parse
// e altere ordem/precisão antes da comparação byte-a-byte no CAS ou converta gerações.
const GET_DETAIL_OR_FENCE_SCRIPT = `
local v = redis.call("GET", KEYS[1])
if v then
  return {"hit", ":" .. v}
end
local out = { "miss", ":" .. tostring(redis.call("GET", KEYS[2]) or "0") }
for i = 3, #KEYS do
  out[#out + 1] = ":" .. tostring(redis.call("GET", KEYS[i]) or "0")
end
return out
`;

const CAPTURE_FENCE_SCRIPT = `
local out = { ":" .. tostring(redis.call("GET", KEYS[1]) or "0") }
for i = 2, #KEYS do
  out[#out + 1] = ":" .. tostring(redis.call("GET", KEYS[i]) or "0")
end
return out
`;

const READ_RAW_AND_FENCE_SCRIPT = `
local v = redis.call("GET", KEYS[1])
if not v then
  return {"missing"}
end
local g = tostring(redis.call("GET", KEYS[2]) or "0")
local idg = tostring(redis.call("GET", KEYS[3]) or "0")
return {"ok", ":" .. v, ":" .. g, ":" .. idg}
`;

const CAS_UPDATE_WITH_FENCE_SCRIPT = `
if #KEYS >= 2 then
  for i = 2, #KEYS do
    local currentGen = tostring(redis.call("GET", KEYS[i]) or "0")
    if currentGen ~= tostring(ARGV[i + 1]) then
      return {"fenced"}
    end
  end
end
local current = redis.call("GET", KEYS[1])
if not current then
  return {"missing"}
end
if current ~= ARGV[1] then
  return {"conflict", ":" .. current}
end
local pttl = redis.call("PTTL", KEYS[1])
if pttl > 0 then
  redis.call("SET", KEYS[1], ARGV[2], "PX", pttl)
elseif pttl == -1 then
  redis.call("SET", KEYS[1], ARGV[2])
else
  return {"missing"}
end
return {"updated"}
`;

const SET_IF_MISSING_OR_READ_WITH_FENCE_SCRIPT = `
if #KEYS >= 2 then
  for i = 2, #KEYS do
    local currentGen = tostring(redis.call("GET", KEYS[i]) or "0")
    if currentGen ~= tostring(ARGV[i + 1]) then
      return {"fenced"}
    end
  end
end
local current = redis.call("GET", KEYS[1])
if not current then
  redis.call("SET", KEYS[1], ARGV[1], "EX", tonumber(ARGV[2]))
  return {"inserted"}
end
return {"exists", ":" .. current}
`;

const INVALIDATE_IDS_SCRIPT = `
local n = tonumber(ARGV[1]) or 0
for i = 1, n do
  redis.call("INCR", KEYS[i])
end
for i = n + 1, #KEYS do
  redis.call("DEL", KEYS[i])
end
return n
`;

const INCR_GLOBAL_GEN_SCRIPT = `
return ":" .. tostring(redis.call("INCR", KEYS[1]))
`;

async function withRedisTimeout<T>(promise: Promise<T>): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timerId = setTimeout(() => reject(new Error("Redis timeout")), REDIS_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
  }
}

function extractPrefixedRaw(value: unknown): string | null {
  if (typeof value === "string" && value.startsWith(":")) {
    return value.slice(1);
  }
  return null;
}

function extractGenToken(value: unknown): string | null {
  if (typeof value === "string") {
    const raw = value.startsWith(":") ? value.slice(1) : value;
    return raw.length > 0 ? raw : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function buildFenceKeysAndArgs(
  fence?: RedisAnimeDetailFence,
): { keys: string[]; args: string[] } {
  if (!fence) {
    return { keys: [], args: [] };
  }
  const keys: string[] = [DETAIL_GLOBAL_GEN_KEY];
  const args: string[] = [fence.globalGen];
  for (const [fenceId, gen] of Object.entries(fence.idGens)) {
    const cleanFenceId = fenceId.trim();
    if (!cleanFenceId) continue;
    keys.push(`${DETAIL_ID_GEN_PREFIX}${cleanFenceId}`);
    args.push(gen);
  }
  return { keys, args };
}

function parseRawRedisAnime(raw: string): Anime | null {
  try {
    const parsed = JSON.parse(raw) as Anime;
    if (parsed && typeof parsed === "object" && typeof parsed.id === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function isGenericEpisodeTitle(title: string | undefined, epNumber: number): boolean {
  const clean = title?.trim() ?? "";
  return !clean || clean === `Episódio ${epNumber}`;
}

function mergeDetailPreservingEnrichments(incoming: Anime, existing: Anime): Anime | null {
  if (
    typeof existing.catalogUpdatedAt === "number" &&
    (typeof incoming.catalogUpdatedAt !== "number" ||
      existing.catalogUpdatedAt > incoming.catalogUpdatedAt)
  ) {
    return null;
  }

  let nextSeasons = incoming.seasons;
  if (
    (!incoming.streamingEpisodes || incoming.streamingEpisodes.length === 0) &&
    incoming.seasons?.[0]?.episodes?.length &&
    existing.seasons?.[0]?.episodes?.length
  ) {
    const existingEpMap = new Map<number, Episode>();
    for (const ep of existing.seasons[0].episodes) {
      if (!isGenericEpisodeTitle(ep.title, ep.number) || ep.aired) {
        existingEpMap.set(ep.number, ep);
      }
    }

    if (existingEpMap.size > 0) {
      let epsChanged = false;
      const mergedEpisodes = incoming.seasons[0].episodes.map((ep) => {
        const prev = existingEpMap.get(ep.number);
        if (!prev) return ep;

        const usePrevTitle =
          isGenericEpisodeTitle(ep.title, ep.number) &&
          !isGenericEpisodeTitle(prev.title, ep.number);
        const nextTitle = usePrevTitle ? prev.title : ep.title;
        const nextAired = ep.aired ?? prev.aired;

        if (nextTitle !== ep.title || nextAired !== ep.aired) {
          epsChanged = true;
          return {
            ...ep,
            title: nextTitle,
            ...(nextAired !== undefined ? { aired: nextAired } : {}),
          };
        }
        return ep;
      });

      if (epsChanged) {
        nextSeasons = [
          {
            ...incoming.seasons[0],
            episodes: mergedEpisodes,
          },
          ...incoming.seasons.slice(1),
        ];
      }
    }
  }

  return {
    ...incoming,
    characters:
      (incoming.characters?.length ?? 0) > 0
        ? incoming.characters
        : (existing.characters?.length ?? 0) > 0
          ? existing.characters
          : incoming.characters,
    staff:
      (incoming.staff?.length ?? 0) > 0
        ? incoming.staff
        : (existing.staff?.length ?? 0) > 0
          ? existing.staff
          : incoming.staff,
    studios:
      (incoming.studios?.length ?? 0) > 0
        ? incoming.studios
        : (existing.studios?.length ?? 0) > 0
          ? existing.studios
          : incoming.studios,
    images:
      (incoming.images?.length ?? 0) > 0
        ? incoming.images
        : (existing.images?.length ?? 0) > 0
          ? existing.images
          : incoming.images,
    resolvedMobileBanner: incoming.resolvedMobileBanner ?? existing.resolvedMobileBanner,
    seasons: nextSeasons,
  };
}

export async function captureRedisAnimeDetailFence(
  ids: string[],
): Promise<RedisAnimeDetailFence | null> {
  if (!redisClient || typeof window !== "undefined") return null;
  const cleanIds = Array.from(
    new Set(ids.map((v) => v.trim()).filter(Boolean)),
  );
  const keys = [
    DETAIL_GLOBAL_GEN_KEY,
    ...cleanIds.map((cleanId) => `${DETAIL_ID_GEN_PREFIX}${cleanId}`),
  ];

  try {
    const res = await withRedisTimeout(
      redisClient.eval<never[], unknown[]>(CAPTURE_FENCE_SCRIPT, keys, []),
    );
    if (!Array.isArray(res) || res.length !== keys.length) {
      return null;
    }
    const globalGen = extractGenToken(res[0]);
    if (!globalGen) return null;

    const idGens: Record<string, string> = {};
    for (let i = 0; i < cleanIds.length; i++) {
      const token = extractGenToken(res[i + 1]);
      if (!token) return null;
      idGens[cleanIds[i]] = token;
    }
    return { globalGen, idGens };
  } catch (err) {
    console.warn("[redis] Aviso ao capturar fence de geração no Redis:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getRedisAnimeDetailWithFence(
  id: string,
  aliasIds?: string[],
): Promise<RedisAnimeDetailReadResult> {
  if (!redisClient || typeof window !== "undefined") {
    return { status: "unavailable", detail: null, fence: null };
  }
  const cleanId = id?.trim();
  if (!cleanId) {
    return { status: "unavailable", detail: null, fence: null };
  }

  const fenceIds = Array.from(
    new Set([cleanId, ...(aliasIds ?? []).map((v) => v.trim()).filter(Boolean)]),
  );
  const key = `${DETAIL_REDIS_KEY_PREFIX}${cleanId}`;
  const keys = [
    key,
    DETAIL_GLOBAL_GEN_KEY,
    ...fenceIds.map((fid) => `${DETAIL_ID_GEN_PREFIX}${fid}`),
  ];

  try {
    const res = await withRedisTimeout(
      redisClient.eval<never[], unknown[]>(
        GET_DETAIL_OR_FENCE_SCRIPT,
        keys,
        [],
      ),
    );

    if (!Array.isArray(res)) {
      return { status: "failed", detail: null, fence: null };
    }

    if (res[0] === "hit") {
      const raw = extractPrefixedRaw(res[1]);
      const parsed = raw ? parseRawRedisAnime(raw) : null;
      if (parsed) {
        return { status: "hit", detail: parsed, fence: null };
      }
      const fallbackFence = await captureRedisAnimeDetailFence(fenceIds);
      if (!fallbackFence) {
        return { status: "failed", detail: null, fence: null };
      }
      return { status: "miss", detail: null, fence: fallbackFence };
    }

    if (res[0] === "miss") {
      if (res.length !== 2 + fenceIds.length) {
        return { status: "failed", detail: null, fence: null };
      }
      const globalGen = extractGenToken(res[1]);
      if (!globalGen) {
        return { status: "failed", detail: null, fence: null };
      }
      const idGens: Record<string, string> = {};
      for (let i = 0; i < fenceIds.length; i++) {
        const token = extractGenToken(res[i + 2]);
        if (!token) {
          return { status: "failed", detail: null, fence: null };
        }
        idGens[fenceIds[i]] = token;
      }
      return {
        status: "miss",
        detail: null,
        fence: {
          globalGen,
          idGens,
        },
      };
    }

    return { status: "failed", detail: null, fence: null };
  } catch (err) {
    console.warn("[redis] Aviso ao buscar detalhe do anime no Redis (fallback para DB/API):", err instanceof Error ? err.message : err);
    return { status: "failed", detail: null, fence: null };
  }
}

export async function getRedisAnimeDetail(id: string): Promise<Anime | null> {
  if (!redisClient || typeof window !== "undefined" || !id) return null;
  const cleanId = id.trim();
  if (!cleanId) return null;
  const key = `${DETAIL_REDIS_KEY_PREFIX}${cleanId}`;
  try {
    const data = await withRedisTimeout(redisClient.get<Anime>(key));
    if (data && typeof data === "object" && typeof data.id === "string") {
      return data;
    }
    return null;
  } catch (err) {
    console.warn("[redis] Aviso ao buscar detalhe do anime no Redis (fallback para DB/API):", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setRedisAnimeDetail(
  id: string,
  data: Anime,
  fence?: RedisAnimeDetailFence | null,
): Promise<RedisAnimeDetailWriteStatus> {
  if (!redisClient || typeof window !== "undefined") {
    return "unavailable";
  }
  const cleanId = id?.trim();
  if (!cleanId || !data) {
    return "unavailable";
  }
  // Quando a captura de fence falhou em um Redis ativo (fence === null),
  // não gravamos sem proteção de geração (fail-open apenas no retorno ao usuário).
  if (fence === null) {
    return "failed";
  }

  // Cada chave gravada precisa ter seu próprio identificador protegido no fence.
  // Se o alias foi descoberto somente depois da captura do fence, recusamos gravar nele.
  if (fence !== undefined && !Object.prototype.hasOwnProperty.call(fence.idGens, cleanId)) {
    return "skipped";
  }

  const key = `${DETAIL_REDIS_KEY_PREFIX}${cleanId}`;
  const { keys: fenceKeys, args: fenceArgs } = buildFenceKeysAndArgs(fence);

  try {
    const initialRaw = JSON.stringify(data);
    const initialRes = await withRedisTimeout(
      redisClient.eval<string[], unknown[]>(
        SET_IF_MISSING_OR_READ_WITH_FENCE_SCRIPT,
        [key, ...fenceKeys],
        [initialRaw, String(DETAIL_REDIS_TTL_SEC), ...fenceArgs],
      ),
    );

    if (!Array.isArray(initialRes)) {
      return "failed";
    }
    if (initialRes[0] === "fenced") {
      return "fenced";
    }
    if (initialRes[0] === "inserted") {
      return "inserted";
    }
    if (initialRes[0] !== "exists") {
      return "failed";
    }

    let expectedRaw = extractPrefixedRaw(initialRes[1]);
    if (!expectedRaw) return "failed";

    for (let attempt = 0; attempt < DETAIL_CAS_MAX_ATTEMPTS; attempt++) {
      const existing = parseRawRedisAnime(expectedRaw);
      if (!existing) return "failed";

      const merged = mergeDetailPreservingEnrichments(data, existing);
      if (!merged) return "unchanged";

      const nextRaw = JSON.stringify(merged);
      if (nextRaw === expectedRaw) return "unchanged";

      const casRes = await withRedisTimeout(
        redisClient.eval<string[], unknown[]>(
          CAS_UPDATE_WITH_FENCE_SCRIPT,
          [key, ...fenceKeys],
          [expectedRaw, nextRaw, ...fenceArgs],
        ),
      );

      if (!Array.isArray(casRes)) return "failed";
      if (casRes[0] === "fenced") return "fenced";
      if (casRes[0] === "updated") return "updated";
      if (casRes[0] === "missing") return "missing";
      if (casRes[0] === "conflict") {
        const latestRaw = extractPrefixedRaw(casRes[1]);
        if (!latestRaw) return "conflict";
        expectedRaw = latestRaw;
        continue;
      }
      return "failed";
    }

    return "conflict";
  } catch (err) {
    console.warn("[redis] Aviso ao salvar detalhe do anime no Redis:", err instanceof Error ? err.message : err);
    return "failed";
  }
}

export async function updateRedisAnimeDetailAtomic(
  id: string,
  mergeDetail: (current: Anime) => Anime | null,
): Promise<RedisAnimeDetailUpdateResult> {
  if (!redisClient || typeof window !== "undefined") {
    return { status: "unavailable" };
  }
  const cleanId = id?.trim();
  if (!cleanId) {
    return { status: "unavailable" };
  }

  const key = `${DETAIL_REDIS_KEY_PREFIX}${cleanId}`;
  const idGenKey = `${DETAIL_ID_GEN_PREFIX}${cleanId}`;

  try {
    const readRes = await withRedisTimeout(
      redisClient.eval<never[], unknown[]>(
        READ_RAW_AND_FENCE_SCRIPT,
        [key, DETAIL_GLOBAL_GEN_KEY, idGenKey],
        [],
      ),
    );

    if (!Array.isArray(readRes) || readRes[0] === "missing") {
      return { status: "missing" };
    }

    if (readRes[0] !== "ok") {
      return { status: "failed" };
    }

    let expectedRaw = extractPrefixedRaw(readRes[1]);
    const globalGen = extractGenToken(readRes[2]);
    const idGen = extractGenToken(readRes[3]);
    if (!expectedRaw || !globalGen || !idGen) {
      return { status: "failed" };
    }

    for (let attempt = 0; attempt < DETAIL_CAS_MAX_ATTEMPTS; attempt++) {
      const currentObj = parseRawRedisAnime(expectedRaw);
      if (!currentObj) {
        return { status: "failed" };
      }

      const nextObj = mergeDetail(currentObj);
      if (!nextObj) {
        return { status: "unchanged", detail: currentObj };
      }

      const nextRaw = JSON.stringify(nextObj);
      if (nextRaw === expectedRaw) {
        return { status: "unchanged", detail: currentObj };
      }

      const casRes = await withRedisTimeout(
        redisClient.eval<string[], unknown[]>(
          CAS_UPDATE_WITH_FENCE_SCRIPT,
          [key, DETAIL_GLOBAL_GEN_KEY, idGenKey],
          [expectedRaw, nextRaw, globalGen, idGen],
        ),
      );

      if (!Array.isArray(casRes)) {
        return { status: "failed" };
      }

      if (casRes[0] === "fenced") {
        return { status: "fenced" };
      }

      if (casRes[0] === "missing") {
        return { status: "missing" };
      }

      if (casRes[0] === "updated") {
        return { status: "updated", detail: nextObj };
      }

      if (casRes[0] === "conflict") {
        const latestRaw = extractPrefixedRaw(casRes[1]);
        if (!latestRaw) {
          return { status: "conflict" };
        }
        expectedRaw = latestRaw;
        continue;
      }

      return { status: "failed" };
    }

    return { status: "conflict" };
  } catch (err) {
    console.warn("[redis] Aviso ao atualizar detalhe do anime atomicamente no Redis:", err instanceof Error ? err.message : err);
    return { status: "failed" };
  }
}

export async function invalidateRedisAnimeDetail(
  animeId?: string | null,
  externalIds?: {
    anilistId?: number | null;
    malId?: number | null;
    kitsuId?: number | null;
    extraIds?: Array<string | number | null | undefined>;
  },
): Promise<void> {
  if (!redisClient || typeof window !== "undefined") return;
  try {
    const targetIds = new Set<string>();
    const cleanId = animeId?.trim();
    if (cleanId) {
      targetIds.add(cleanId);
    }
    if (typeof externalIds?.anilistId === "number" && externalIds.anilistId > 0) {
      targetIds.add(String(externalIds.anilistId));
    }
    if (typeof externalIds?.malId === "number" && externalIds.malId > 0) {
      targetIds.add(`mal-${externalIds.malId}`);
    }
    if (typeof externalIds?.kitsuId === "number" && externalIds.kitsuId > 0) {
      targetIds.add(`kitsu-${externalIds.kitsuId}`);
    }
    if (Array.isArray(externalIds?.extraIds)) {
      for (const extra of externalIds.extraIds) {
        if (typeof extra === "string" && extra.trim()) {
          targetIds.add(extra.trim());
        } else if (typeof extra === "number" && Number.isFinite(extra) && extra > 0) {
          targetIds.add(String(extra));
        }
      }
    }

    if (targetIds.size > 0) {
      const idList = Array.from(targetIds);
      const genKeys = idList.map((tid) => `${DETAIL_ID_GEN_PREFIX}${tid}`);
      const detailKeys = idList.map((tid) => `${DETAIL_REDIS_KEY_PREFIX}${tid}`);
      await withRedisTimeout(
        redisClient.eval<[string], number>(
          INVALIDATE_IDS_SCRIPT,
          [...genKeys, ...detailKeys],
          [String(genKeys.length)],
        ),
      );
    } else {
      // Incrementa primeiro a geração global atomicamente para fechar imediatamente
      // o fence de buscas em andamento em todas as instâncias antes de remover as chaves.
      await withRedisTimeout(
        redisClient.eval<never[], string>(
          INCR_GLOBAL_GEN_SCRIPT,
          [DETAIL_GLOBAL_GEN_KEY],
          [],
        ),
      );
      const keys = await withRedisTimeout(
        redisClient.keys(`${DETAIL_REDIS_KEY_PREFIX}*`),
      );
      if (Array.isArray(keys) && keys.length > 0) {
        const CHUNK_SIZE = 200;
        for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
          const batch = keys.slice(i, i + CHUNK_SIZE);
          await withRedisTimeout(redisClient.del(...batch));
        }
      }
    }
  } catch (err) {
    console.warn("[redis] Aviso ao invalidar detalhe do anime no Redis:", err instanceof Error ? err.message : err);
  }
}

const HOME_CATALOG_REDIS_KEY_PREFIX = "hikari:home:catalog:v1:";
const HOME_CATALOG_REDIS_TTL_SEC = 600; // 10 minutos

const HOME_TODAY_RAW_REDIS_KEY_PREFIX = "hikari:home:today-raw:v1:";
const HOME_TODAY_RAW_REDIS_TTL_SEC = 900; // 15 minutos

const HOME_SEASON_REDIS_KEY_PREFIX = "hikari:home:season:v1:";
const HOME_SEASON_REDIS_TTL_SEC = 1800; // 30 minutos

const HOME_ENVELOPE_PREFIX = "v1|";

export type HomeTodayRawEntryShape = {
  id: number;
  airingAt: number;
  episode: number;
  media?: unknown;
};

export type RedisHomeWriteStatus =
  | "inserted"
  | "updated"
  | "kept"
  | "skipped"
  | "unavailable"
  | "failed";

const GET_HOME_CACHE_SCRIPT = `
local v = redis.call("GET", KEYS[1])
if not v then
  return nil
end
return ":" .. v
`;

// Grava somente se a chave não existir ou se o novo dado foi buscado mais recentemente
// que o atualmente armazenado, evitando que voos concorrentes mais antigos ou lentos
// sobrescrevam dados válidos mais novos.
const SET_NEWER_HOME_CACHE_SCRIPT = `
local cur = redis.call("GET", KEYS[1])
if not cur then
  redis.call("SET", KEYS[1], ARGV[1], "EX", tonumber(ARGV[3]))
  return {"inserted"}
end
local curTs = tonumber(string.match(cur, "^v1|(%d+)|"))
local nextTs = tonumber(ARGV[2])
if curTs and nextTs and nextTs <= curTs then
  return {"kept"}
end
redis.call("SET", KEYS[1], ARGV[1], "EX", tonumber(ARGV[3]))
return {"updated"}
`;

function encodeHomeEnvelope(fetchedAt: number, data: unknown): string {
  const safeTs =
    typeof fetchedAt === "number" && Number.isFinite(fetchedAt) && fetchedAt > 0
      ? Math.floor(fetchedAt)
      : Date.now();
  return `${HOME_ENVELOPE_PREFIX}${safeTs}|${JSON.stringify(data)}`;
}

function decodeHomeEnvelope<T>(raw: string): T | null {
  try {
    let jsonPayload = raw;
    if (raw.startsWith(HOME_ENVELOPE_PREFIX)) {
      const secondSep = raw.indexOf("|", HOME_ENVELOPE_PREFIX.length);
      if (secondSep === -1) return null;
      jsonPayload = raw.slice(secondSep + 1);
    }
    return JSON.parse(jsonPayload) as T;
  } catch {
    return null;
  }
}

async function readHomeRedisEnvelope<T>(key: string): Promise<T | null> {
  if (!redisClient || typeof window !== "undefined") return null;
  const res = await withRedisTimeout(
    redisClient.eval<never[], unknown>(GET_HOME_CACHE_SCRIPT, [key], []),
  );
  const raw = extractPrefixedRaw(res);
  if (!raw) return null;
  return decodeHomeEnvelope<T>(raw);
}

async function writeHomeRedisEnvelope(
  key: string,
  ttlSec: number,
  fetchedAt: number,
  data: unknown,
): Promise<RedisHomeWriteStatus> {
  if (!redisClient || typeof window !== "undefined") {
    return "unavailable";
  }
  const safeTs =
    typeof fetchedAt === "number" && Number.isFinite(fetchedAt) && fetchedAt > 0
      ? Math.floor(fetchedAt)
      : Date.now();
  const payload = encodeHomeEnvelope(safeTs, data);
  const res = await withRedisTimeout(
    redisClient.eval<string[], unknown[]>(
      SET_NEWER_HOME_CACHE_SCRIPT,
      [key],
      [payload, String(safeTs), String(ttlSec)],
    ),
  );
  if (!Array.isArray(res)) return "failed";
  if (res[0] === "inserted") return "inserted";
  if (res[0] === "updated") return "updated";
  if (res[0] === "kept") return "kept";
  return "failed";
}

function isValidAniListHomeCatalog(value: unknown): value is HomeCatalog {
  if (!value || typeof value !== "object") return false;
  const cat = value as Partial<HomeCatalog>;
  return (
    cat.source === "anilist" &&
    Array.isArray(cat.trending) &&
    cat.trending.length > 0 &&
    Array.isArray(cat.popular) &&
    cat.popular.length > 0 &&
    Array.isArray(cat.season) &&
    cat.season.length > 0 &&
    Array.isArray(cat.todaySchedule) &&
    typeof cat.seasonYear === "number" &&
    typeof cat.seasonName === "string"
  );
}

function isValidTodayRawEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") return false;
  const item = entry as Partial<HomeTodayRawEntryShape>;
  return (
    typeof item.id === "number" &&
    Number.isFinite(item.id) &&
    typeof item.airingAt === "number" &&
    Number.isFinite(item.airingAt) &&
    item.airingAt > 0 &&
    typeof item.episode === "number" &&
    Number.isFinite(item.episode)
  );
}

function isValidAniListSlimList(items: unknown): items is SlimAnime[] {
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.every(
    (item) =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as SlimAnime).id === "string" &&
      (item as SlimAnime).id.length > 0 &&
      (item as SlimAnime).source === "anilist",
  );
}

export async function getRedisHomeCatalog(
  todayKey: string,
): Promise<HomeCatalog | null> {
  if (!redisClient || typeof window !== "undefined") return null;
  const cleanDay = todayKey?.trim();
  if (!cleanDay) return null;

  const key = `${HOME_CATALOG_REDIS_KEY_PREFIX}${cleanDay}`;
  try {
    const parsed = await readHomeRedisEnvelope<HomeCatalog>(key);
    return isValidAniListHomeCatalog(parsed) ? parsed : null;
  } catch (err) {
    console.warn(
      "[redis] Aviso ao buscar catálogo da Home no Redis (fallback para AniList):",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function setRedisHomeCatalog(
  todayKey: string,
  catalog: HomeCatalog,
  fetchedAt: number,
): Promise<RedisHomeWriteStatus> {
  if (!redisClient || typeof window !== "undefined") return "unavailable";
  const cleanDay = todayKey?.trim();
  if (!cleanDay || !isValidAniListHomeCatalog(catalog)) {
    return "skipped";
  }

  const key = `${HOME_CATALOG_REDIS_KEY_PREFIX}${cleanDay}`;
  try {
    return await writeHomeRedisEnvelope(
      key,
      HOME_CATALOG_REDIS_TTL_SEC,
      fetchedAt,
      catalog,
    );
  } catch (err) {
    console.warn(
      "[redis] Aviso ao salvar catálogo da Home no Redis:",
      err instanceof Error ? err.message : err,
    );
    return "failed";
  }
}

export async function getRedisHomeTodayRaw<T extends HomeTodayRawEntryShape>(
  todayKey: string,
): Promise<T[] | null> {
  if (!redisClient || typeof window !== "undefined") return null;
  const cleanDay = todayKey?.trim();
  if (!cleanDay) return null;

  const key = `${HOME_TODAY_RAW_REDIS_KEY_PREFIX}${cleanDay}`;
  try {
    const parsed = await readHomeRedisEnvelope<unknown[]>(key);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const valid = parsed.filter(isValidTodayRawEntry) as T[];
    return valid.length > 0 ? valid : null;
  } catch (err) {
    console.warn(
      "[redis] Aviso ao buscar grade bruta de hoje no Redis (fallback para AniList):",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function setRedisHomeTodayRaw<T extends HomeTodayRawEntryShape>(
  todayKey: string,
  entries: T[],
  fetchedAt: number,
): Promise<RedisHomeWriteStatus> {
  if (!redisClient || typeof window !== "undefined") return "unavailable";
  const cleanDay = todayKey?.trim();
  if (!cleanDay || !Array.isArray(entries) || entries.length === 0) {
    return "skipped";
  }
  const valid = entries.filter(isValidTodayRawEntry);
  if (valid.length === 0) {
    return "skipped";
  }

  const key = `${HOME_TODAY_RAW_REDIS_KEY_PREFIX}${cleanDay}`;
  try {
    return await writeHomeRedisEnvelope(
      key,
      HOME_TODAY_RAW_REDIS_TTL_SEC,
      fetchedAt,
      valid,
    );
  } catch (err) {
    console.warn(
      "[redis] Aviso ao salvar grade bruta de hoje no Redis:",
      err instanceof Error ? err.message : err,
    );
    return "failed";
  }
}

export async function getRedisHomeSeason(
  year: number,
  season: string,
): Promise<SlimAnime[] | null> {
  if (!redisClient || typeof window !== "undefined") return null;
  const cleanSeason = season?.trim().toUpperCase();
  if (!Number.isFinite(year) || year <= 0 || !cleanSeason) return null;

  const key = `${HOME_SEASON_REDIS_KEY_PREFIX}${Math.floor(year)}:${cleanSeason}`;
  try {
    const parsed = await readHomeRedisEnvelope<SlimAnime[]>(key);
    return isValidAniListSlimList(parsed) ? parsed : null;
  } catch (err) {
    console.warn(
      "[redis] Aviso ao buscar temporada da Home no Redis (fallback para AniList):",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function setRedisHomeSeason(
  year: number,
  season: string,
  items: SlimAnime[],
  fetchedAt: number,
): Promise<RedisHomeWriteStatus> {
  if (!redisClient || typeof window !== "undefined") return "unavailable";
  const cleanSeason = season?.trim().toUpperCase();
  if (
    !Number.isFinite(year) ||
    year <= 0 ||
    !cleanSeason ||
    !isValidAniListSlimList(items)
  ) {
    return "skipped";
  }

  const key = `${HOME_SEASON_REDIS_KEY_PREFIX}${Math.floor(year)}:${cleanSeason}`;
  try {
    return await writeHomeRedisEnvelope(
      key,
      HOME_SEASON_REDIS_TTL_SEC,
      fetchedAt,
      items,
    );
  } catch (err) {
    console.warn(
      "[redis] Aviso ao salvar temporada da Home no Redis:",
      err instanceof Error ? err.message : err,
    );
    return "failed";
  }
}

const HOME_EPISODES_REDIS_KEY = "hikari:home:episodes:v1";
const HOME_EPISODES_GEN_KEY = "hikari:home:episodes:gen:v1";
const HOME_EPISODES_REDIS_TTL_SEC = 180; // 180 segundos

const PUBLIC_CATALOG_EPISODES_REDIS_KEY = "hikari:catalog:episodes:public:v1";
const PUBLIC_CATALOG_EPISODES_GEN_KEY = "hikari:catalog:episodes:public:gen:v1";
const PUBLIC_CATALOG_EPISODES_REDIS_TTL_SEC = 180; // 180 segundos

const PUBLIC_EPISODES_ENVELOPE_PREFIX = "v1|";
const PUBLIC_EPISODES_MAX_REDIS_BYTES = 950_000;

export type RedisPublicEpisodesReadResult<T> = {
  status: "hit" | "miss" | "unavailable" | "failed";
  data: T | null;
  fence: string | null;
};

export type RedisPublicEpisodesWriteStatus =
  | "inserted"
  | "updated"
  | "kept"
  | "fenced"
  | "skipped"
  | "unavailable"
  | "failed";

// Lê a chave verificando atomicamente se a geração embutida no valor bate com a geração atual.
// Em hit válido, devolve prefixado com ":" para evitar JSON.parse automático do @upstash/redis.
const GET_PUBLIC_EPISODES_OR_FENCE_SCRIPT = `
local curGen = tostring(redis.call("GET", KEYS[2]) or "0")
local v = redis.call("GET", KEYS[1])
if v then
  local storedGen = string.match(v, "^v1|(%d+)|")
  if storedGen and storedGen == curGen then
    return {"hit", ":" .. v}
  end
end
return {"miss", ":" .. curGen}
`;

// Grava somente se a geração não mudou desde o início da consulta (fence) e, quando já existir
// dado válido na mesma geração, preserva o registro mais recente (por fetchedAt).
const SET_PUBLIC_EPISODES_WITH_FENCE_SCRIPT = `
local curGen = tostring(redis.call("GET", KEYS[2]) or "0")
if curGen ~= tostring(ARGV[2]) then
  return {"fenced"}
end
local cur = redis.call("GET", KEYS[1])
if not cur then
  redis.call("SET", KEYS[1], ARGV[1], "EX", tonumber(ARGV[4]))
  return {"inserted"}
end
local curGenInVal, curTsStr = string.match(cur, "^v1|(%d+)|(%d+)|")
local curTs = tonumber(curTsStr)
local nextTs = tonumber(ARGV[3])
if curGenInVal == curGen and curTs and nextTs and nextTs <= curTs then
  return {"kept"}
end
redis.call("SET", KEYS[1], ARGV[1], "EX", tonumber(ARGV[4]))
return {"updated"}
`;

const INVALIDATE_PUBLIC_EPISODES_SCRIPT = `
local newGen = redis.call("INCR", KEYS[1])
redis.call("DEL", KEYS[2])
return ":" .. tostring(newGen)
`;

function getUtf8ByteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

function encodePublicEpisodesEnvelope(
  gen: string,
  fetchedAt: number,
  data: unknown,
): string {
  const safeGen = /^\d+$/.test(gen) ? gen : "0";
  const safeTs =
    typeof fetchedAt === "number" && Number.isFinite(fetchedAt) && fetchedAt > 0
      ? Math.floor(fetchedAt)
      : Date.now();
  return `${PUBLIC_EPISODES_ENVELOPE_PREFIX}${safeGen}|${safeTs}|${JSON.stringify(data)}`;
}

function decodePublicEpisodesEnvelope<T>(raw: string): T | null {
  try {
    if (!raw.startsWith(PUBLIC_EPISODES_ENVELOPE_PREFIX)) return null;
    const genStart = PUBLIC_EPISODES_ENVELOPE_PREFIX.length;
    const secondSep = raw.indexOf("|", genStart);
    if (secondSep === -1) return null;
    const thirdSep = raw.indexOf("|", secondSep + 1);
    if (thirdSep === -1) return null;
    const jsonPayload = raw.slice(thirdSep + 1);
    return JSON.parse(jsonPayload) as T;
  } catch {
    return null;
  }
}

function isValidPublicEpisodeShape(ep: unknown): boolean {
  if (!ep || typeof ep !== "object") return false;
  const row = ep as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    row.id.length > 0 &&
    typeof row.animeId === "string" &&
    row.animeId.length > 0 &&
    typeof row.seasonNumber === "number" &&
    Number.isFinite(row.seasonNumber) &&
    typeof row.number === "number" &&
    Number.isFinite(row.number) &&
    row.published === true
  );
}

function isValidPublicEpisodesPayload(
  value: unknown,
): value is HomeEpisodesResult | PublicEpisodesResult {
  if (!value || typeof value !== "object") return false;
  const res = value as Partial<HomeEpisodesResult | PublicEpisodesResult>;
  if (res.status !== "success" && res.status !== "empty") return false;
  if (!Array.isArray(res.episodes)) return false;
  if (
    typeof res.total !== "number" ||
    !Number.isFinite(res.total) ||
    res.total !== res.episodes.length
  ) {
    return false;
  }
  if (res.status === "empty" && res.episodes.length !== 0) return false;
  if (res.status === "success" && res.episodes.length === 0) return false;
  return res.episodes.every(isValidPublicEpisodeShape);
}

async function readPublicEpisodesWithFence<T extends HomeEpisodesResult | PublicEpisodesResult>(
  valueKey: string,
  genKey: string,
  logLabel: string,
): Promise<RedisPublicEpisodesReadResult<T>> {
  if (!redisClient || typeof window !== "undefined") {
    return { status: "unavailable", data: null, fence: null };
  }

  try {
    const res = await withRedisTimeout(
      redisClient.eval<never[], unknown[]>(
        GET_PUBLIC_EPISODES_OR_FENCE_SCRIPT,
        [valueKey, genKey],
        [],
      ),
    );

    if (!Array.isArray(res) || res.length < 2) {
      return { status: "failed", data: null, fence: null };
    }

    if (res[0] === "hit") {
      const raw = extractPrefixedRaw(res[1]);
      const parsed = raw ? decodePublicEpisodesEnvelope<T>(raw) : null;
      if (parsed && isValidPublicEpisodesPayload(parsed)) {
        return { status: "hit", data: parsed, fence: null };
      }
      // Payload inválido ou corrompido: captura fence atual e trata como miss
      const genRes = await withRedisTimeout(
        redisClient.eval<never[], unknown[]>(
          CAPTURE_FENCE_SCRIPT,
          [genKey],
          [],
        ),
      );
      const genToken = Array.isArray(genRes) ? extractGenToken(genRes[0]) : null;
      if (!genToken) {
        return { status: "failed", data: null, fence: null };
      }
      return { status: "miss", data: null, fence: genToken };
    }

    if (res[0] === "miss") {
      const genToken = extractGenToken(res[1]);
      if (!genToken) {
        return { status: "failed", data: null, fence: null };
      }
      return { status: "miss", data: null, fence: genToken };
    }

    return { status: "failed", data: null, fence: null };
  } catch (err) {
    console.warn(
      `[redis] Aviso ao buscar ${logLabel} no Redis (fallback para DB):`,
      err instanceof Error ? err.message : err,
    );
    return { status: "failed", data: null, fence: null };
  }
}

async function writePublicEpisodesWithFence(
  valueKey: string,
  genKey: string,
  ttlSec: number,
  data: HomeEpisodesResult | PublicEpisodesResult,
  fence: string | null,
  fetchedAt: number,
  logLabel: string,
): Promise<RedisPublicEpisodesWriteStatus> {
  if (!redisClient || typeof window !== "undefined") {
    return "unavailable";
  }
  if (!fence) {
    return "failed";
  }
  if (!isValidPublicEpisodesPayload(data)) {
    return "skipped";
  }

  try {
    const safeTs =
      typeof fetchedAt === "number" && Number.isFinite(fetchedAt) && fetchedAt > 0
        ? Math.floor(fetchedAt)
        : Date.now();
    const payload = encodePublicEpisodesEnvelope(fence, safeTs, data);
    if (getUtf8ByteLength(payload) > PUBLIC_EPISODES_MAX_REDIS_BYTES) {
      console.warn(
        `[redis] Payload de ${logLabel} excede limite seguro para Redis (${PUBLIC_EPISODES_MAX_REDIS_BYTES} bytes); mantendo somente DB/RAM.`,
      );
      return "skipped";
    }

    const res = await withRedisTimeout(
      redisClient.eval<string[], unknown[]>(
        SET_PUBLIC_EPISODES_WITH_FENCE_SCRIPT,
        [valueKey, genKey],
        [payload, fence, String(safeTs), String(ttlSec)],
      ),
    );

    if (!Array.isArray(res)) return "failed";
    if (res[0] === "inserted") return "inserted";
    if (res[0] === "updated") return "updated";
    if (res[0] === "kept") return "kept";
    if (res[0] === "fenced") return "fenced";
    return "failed";
  } catch (err) {
    console.warn(
      `[redis] Aviso ao salvar ${logLabel} no Redis:`,
      err instanceof Error ? err.message : err,
    );
    return "failed";
  }
}

export async function getRedisHomePublicEpisodesWithFence(): Promise<
  RedisPublicEpisodesReadResult<HomeEpisodesResult>
> {
  return readPublicEpisodesWithFence<HomeEpisodesResult>(
    HOME_EPISODES_REDIS_KEY,
    HOME_EPISODES_GEN_KEY,
    "episódios públicos da Home",
  );
}

export async function setRedisHomePublicEpisodes(
  result: HomeEpisodesResult,
  fence: string | null,
  fetchedAt: number,
): Promise<RedisPublicEpisodesWriteStatus> {
  return writePublicEpisodesWithFence(
    HOME_EPISODES_REDIS_KEY,
    HOME_EPISODES_GEN_KEY,
    HOME_EPISODES_REDIS_TTL_SEC,
    result,
    fence,
    fetchedAt,
    "episódios públicos da Home",
  );
}

export async function invalidateRedisHomePublicEpisodes(): Promise<void> {
  if (!redisClient || typeof window !== "undefined") return;
  try {
    await withRedisTimeout(
      redisClient.eval<never[], unknown>(
        INVALIDATE_PUBLIC_EPISODES_SCRIPT,
        [HOME_EPISODES_GEN_KEY, HOME_EPISODES_REDIS_KEY],
        [],
      ),
    );
  } catch (err) {
    console.warn(
      "[redis] Aviso ao invalidar episódios públicos da Home no Redis:",
      err instanceof Error ? err.message : err,
    );
  }
}

function buildPublicCatalogEpisodesRedisKey(
  limit: number,
  offset: number,
): string {
  if (limit === 10000 && offset === 0) {
    return PUBLIC_CATALOG_EPISODES_REDIS_KEY;
  }
  return `${PUBLIC_CATALOG_EPISODES_REDIS_KEY}:${limit}:${offset}`;
}

export async function getRedisPublicCatalogEpisodesWithFence(
  limit: number,
  offset: number,
): Promise<RedisPublicEpisodesReadResult<PublicEpisodesResult>> {
  const valueKey = buildPublicCatalogEpisodesRedisKey(limit, offset);
  return readPublicEpisodesWithFence<PublicEpisodesResult>(
    valueKey,
    PUBLIC_CATALOG_EPISODES_GEN_KEY,
    "listagem pública /episodes",
  );
}

export async function setRedisPublicCatalogEpisodes(
  result: PublicEpisodesResult,
  limit: number,
  offset: number,
  fence: string | null,
  fetchedAt: number,
): Promise<RedisPublicEpisodesWriteStatus> {
  const valueKey = buildPublicCatalogEpisodesRedisKey(limit, offset);
  return writePublicEpisodesWithFence(
    valueKey,
    PUBLIC_CATALOG_EPISODES_GEN_KEY,
    PUBLIC_CATALOG_EPISODES_REDIS_TTL_SEC,
    result,
    fence,
    fetchedAt,
    "listagem pública /episodes",
  );
}

export async function invalidateRedisPublicCatalogEpisodes(): Promise<void> {
  if (!redisClient || typeof window !== "undefined") return;
  try {
    await withRedisTimeout(
      redisClient.eval<never[], unknown>(
        INVALIDATE_PUBLIC_EPISODES_SCRIPT,
        [PUBLIC_CATALOG_EPISODES_GEN_KEY, PUBLIC_CATALOG_EPISODES_REDIS_KEY],
        [],
      ),
    );
  } catch (err) {
    console.warn(
      "[redis] Aviso ao invalidar listagem pública /episodes no Redis:",
      err instanceof Error ? err.message : err,
    );
  }
}

export type CachedEpisodeSourcePayload = {
  directUrl: string | null;
  iframeUrl: string | null;
  provider?: string;
  resolvedAt: string | null;
  pageUrl?: string;
};

const EPISODE_SOURCE_REDIS_KEY_PREFIX = "ep:src:";
const EPISODE_SOURCE_MAX_TTL_SEC = 600; // 10 minutes

export async function getRedisEpisodeSource(
  episodeId: string,
): Promise<CachedEpisodeSourcePayload | null> {
  if (!redisClient || typeof window !== "undefined") return null;
  const cleanId = episodeId?.trim();
  if (!cleanId) return null;
  const key = `${EPISODE_SOURCE_REDIS_KEY_PREFIX}${cleanId}`;
  try {
    const data = await withRedisTimeout(
      redisClient.get<CachedEpisodeSourcePayload>(key),
    );
    if (data && typeof data === "object") {
      return data;
    }
    return null;
  } catch (err) {
    console.warn(
      "[redis] Aviso ao buscar fonte do episódio no Redis (fallback para DB):",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function setRedisEpisodeSource(
  episodeId: string,
  payload: CachedEpisodeSourcePayload,
  ttlSec: number,
): Promise<void> {
  if (!redisClient || typeof window !== "undefined") return;
  const cleanId = episodeId?.trim();
  if (!cleanId || !payload) return;
  const key = `${EPISODE_SOURCE_REDIS_KEY_PREFIX}${cleanId}`;
  const safeTtl = Math.min(
    Math.max(10, Math.floor(ttlSec)),
    EPISODE_SOURCE_MAX_TTL_SEC,
  );
  try {
    await withRedisTimeout(
      redisClient.set(key, payload, { ex: safeTtl }),
    );
  } catch (err) {
    console.warn(
      "[redis] Aviso ao salvar fonte do episódio no Redis:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function invalidateRedisEpisodeSource(
  episodeId: string,
): Promise<void> {
  if (!redisClient || typeof window !== "undefined") return;
  const cleanId = episodeId?.trim();
  if (!cleanId) return;

  const sourceKey = `${EPISODE_SOURCE_REDIS_KEY_PREFIX}${cleanId}`;
  const genKey = `${EPISODE_GEN_KEY_PREFIX}${cleanId}`;

  try {
    await withRedisTimeout(
      redisClient.eval<never[], unknown>(
        INVALIDATE_EPISODE_SOURCE_SCRIPT,
        [sourceKey, genKey],
        [],
      ),
    );
  } catch (err) {
    console.warn(
      "[redis] Aviso ao invalidar fonte do episódio no Redis:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function getRedisSegMode(host: string): Promise<string | null> {
  if (!redisClient || typeof window !== "undefined") return null;
  const clean = host?.trim().toLowerCase();
  if (!clean) return null;
  try {
    return await withRedisTimeout(redisClient.get<string>(`segmode:${clean}`));
  } catch {
    return null;
  }
}

export async function setRedisSegMode(
  host: string,
  mode: string,
  ttl: number,
): Promise<void> {
  if (!redisClient || typeof window !== "undefined") return;
  const clean = host?.trim().toLowerCase();
  if (!clean) return;
  try {
    await withRedisTimeout(
      redisClient.set(`segmode:${clean}`, mode, { ex: ttl }),
    );
  } catch {
    // fail-open
  }
}

export async function getRedisPlaylistCache(
  url: string,
): Promise<string | null> {
  if (!redisClient || typeof window !== "undefined") return null;
  const clean = url?.trim();
  if (!clean) return null;
  try {
    return await withRedisTimeout(redisClient.get<string>(`p:${clean}`));
  } catch {
    return null;
  }
}

export async function setRedisPlaylistCache(
  url: string,
  content: string,
  ttl: number,
): Promise<void> {
  if (!redisClient || typeof window !== "undefined") return;
  const clean = url?.trim();
  if (!clean) return;
  try {
    await withRedisTimeout(
      redisClient.set(`p:${clean}`, content, { ex: ttl }),
    );
  } catch {
    // fail-open
  }
}

export async function getRedisCircuitBreaker(
  episodeId: string,
): Promise<number> {
  if (!redisClient || typeof window !== "undefined") return 0;
  const clean = episodeId?.trim();
  if (!clean) return 0;
  try {
    const val = await withRedisTimeout(
      redisClient.get<number>(`cb:${clean}`),
    );
    return Number(val) || 0;
  } catch {
    return 0;
  }
}

export async function incrementRedisCircuitBreaker(
  episodeId: string,
  ttl: number,
): Promise<number> {
  if (!redisClient || typeof window !== "undefined") return 0;
  const clean = episodeId?.trim();
  if (!clean) return 0;
  try {
    const count = await withRedisTimeout(redisClient.incr(`cb:${clean}`));
    if (count === 1) {
      await withRedisTimeout(redisClient.expire(`cb:${clean}`, ttl));
    }
    return Number(count) || 0;
  } catch {
    return 0;
  }
}

export async function resetRedisCircuitBreaker(
  episodeId: string,
): Promise<void> {
  if (!redisClient || typeof window !== "undefined") return;
  const clean = episodeId?.trim();
  if (!clean) return;
  try {
    await withRedisTimeout(redisClient.del(`cb:${clean}`));
  } catch {
    // fail-open
  }
}


const EPISODE_LOCK_KEY_PREFIX = "ep:lock:";
const EPISODE_GEN_KEY_PREFIX = "ep:gen:";
const EPISODE_LOCK_TTL_MS = 10000; // 10 seconds lock timeout

const ACQUIRE_EPISODE_LOCK_SCRIPT = `
local locked = redis.call("SET", KEYS[1], ARGV[1], "NX", "PX", tonumber(ARGV[2]))
local gen = redis.call("GET", KEYS[2])
if not gen then
  gen = "1"
  redis.call("SET", KEYS[2], gen)
end
if locked then
  return {"acquired", gen}
else
  return {"busy", gen}
end
`;

const RELEASE_EPISODE_LOCK_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if current == ARGV[1] then
  redis.call("DEL", KEYS[1])
  return {"released"}
end
return {"not_owner"}
`;

const SET_EPISODE_SOURCE_WITH_FENCE_SCRIPT = `
local curGen = tostring(redis.call("GET", KEYS[2]) or "1")
if curGen ~= tostring(ARGV[2]) then
  return {"fenced"}
end
redis.call("SET", KEYS[1], ARGV[1], "EX", tonumber(ARGV[3]))
return {"updated"}
`;

const INVALIDATE_EPISODE_SOURCE_SCRIPT = `
redis.call("DEL", KEYS[1])
local newGen = redis.call("INCR", KEYS[2])
return tostring(newGen)
`;

export async function acquireEpisodeResolutionLock(
  episodeId: string,
  token: string,
): Promise<{ acquired: boolean; generation: string }> {
  if (!redisClient || typeof window !== "undefined") {
    return { acquired: true, generation: "1" };
  }
  const cleanId = episodeId?.trim();
  if (!cleanId) return { acquired: true, generation: "1" };

  const lockKey = `${EPISODE_LOCK_KEY_PREFIX}${cleanId}`;
  const genKey = `${EPISODE_GEN_KEY_PREFIX}${cleanId}`;

  try {
    const res = await withRedisTimeout(
      redisClient.eval<string[], unknown[]>(
        ACQUIRE_EPISODE_LOCK_SCRIPT,
        [lockKey, genKey],
        [token, String(EPISODE_LOCK_TTL_MS)],
      ),
    );
    if (Array.isArray(res) && res.length >= 2) {
      const status = res[0];
      const gen = extractGenToken(res[1]) ?? "1";
      return { acquired: status === "acquired", generation: gen };
    }
    return { acquired: false, generation: "1" };
  } catch (err) {
    console.warn(
      "[redis] Aviso ao adquirir lock de resolução do episódio (fallback fail-open):",
      err instanceof Error ? err.message : err,
    );
    return { acquired: true, generation: "1" };
  }
}

export async function releaseEpisodeResolutionLock(
  episodeId: string,
  token: string,
): Promise<void> {
  if (!redisClient || typeof window !== "undefined") return;
  const cleanId = episodeId?.trim();
  if (!cleanId) return;

  const lockKey = `${EPISODE_LOCK_KEY_PREFIX}${cleanId}`;
  try {
    await withRedisTimeout(
      redisClient.eval<string[], unknown[]>(
        RELEASE_EPISODE_LOCK_SCRIPT,
        [lockKey],
        [token],
      ),
    );
  } catch (err) {
    console.warn(
      "[redis] Aviso ao liberar lock de resolução do episódio:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function setRedisEpisodeSourceWithFence(
  episodeId: string,
  payload: CachedEpisodeSourcePayload,
  ttlSec: number,
  generation: string,
): Promise<"updated" | "fenced" | "failed" | "unavailable"> {
  if (!redisClient || typeof window !== "undefined") return "unavailable";
  const cleanId = episodeId?.trim();
  if (!cleanId || !payload) return "failed";

  const sourceKey = `${EPISODE_SOURCE_REDIS_KEY_PREFIX}${cleanId}`;
  const genKey = `${EPISODE_GEN_KEY_PREFIX}${cleanId}`;
  const safeTtl = Math.min(
    Math.max(10, Math.floor(ttlSec)),
    EPISODE_SOURCE_MAX_TTL_SEC,
  );

  try {
    const raw = JSON.stringify(payload);
    const res = await withRedisTimeout(
      redisClient.eval<string[], unknown[]>(
        SET_EPISODE_SOURCE_WITH_FENCE_SCRIPT,
        [sourceKey, genKey],
        [raw, generation, String(safeTtl)],
      ),
    );
    if (Array.isArray(res)) {
      if (res[0] === "updated") return "updated";
      if (res[0] === "fenced") return "fenced";
    }
    return "failed";
  } catch (err) {
    console.warn(
      "[redis] Aviso ao salvar fonte do episódio com fence no Redis:",
      err instanceof Error ? err.message : err,
    );
    return "failed";
  }
}

export type ProgressRecordPayload = {
  userKey: string;
  episodeId: string;
  position: number;
  duration: number;
  event: "interval" | "pause" | "seek" | "hide";
  updated_at?: string;
};

const PROGRESS_TTL_SEC = 604800; // 7 dias
const PROGRESS_QUEUE_KEY = "prog:queue";
const PROGRESS_QUEUE_MAX_INDEX = 4999; // LTRIM 0 4999 (máximo 5000 itens)

const RECORD_PROGRESS_SCRIPT = `
local rl = redis.call("SET", KEYS[1], "1", "EX", tonumber(ARGV[1]), "NX")
if not rl then
  return 0
end
redis.call("HSET", KEYS[2], "position", ARGV[2], "duration", ARGV[3], "event", ARGV[4], "updated_at", ARGV[5])
redis.call("EXPIRE", KEYS[2], tonumber(ARGV[6]))
redis.call("LPUSH", KEYS[3], ARGV[7])
redis.call("LTRIM", KEYS[3], 0, tonumber(ARGV[8]))
return 1
`;

const DRAIN_PROGRESS_QUEUE_SCRIPT = `
local out = {}
local count = tonumber(ARGV[1]) or 500
for i = 1, count do
  local item = redis.call("RPOP", KEYS[1])
  if not item then
    break
  end
  out[#out + 1] = item
end
return out
`;

const CLEANUP_DRAINED_HASH_SCRIPT = `
local cur = redis.call("HGET", KEYS[1], "updated_at")
if not cur or cur == ARGV[1] then
  return redis.call("HDEL", KEYS[1], "position", "duration", "event", "updated_at")
end
return 0
`;

const inMemoryProgressStore = new Map<
  string,
  { position: string; duration: string; event: string; updated_at: string }
>();
const inMemoryProgressQueue: string[] = [];
const inMemoryRateLimit = new Map<string, number>();

export function splitProgressQueueEntry(
  entry: string,
): { userKey: string; episodeId: string } | null {
  const sepIdx = entry.lastIndexOf("|");
  if (sepIdx <= 0 || sepIdx >= entry.length - 1) return null;
  return {
    userKey: entry.slice(0, sepIdx),
    episodeId: entry.slice(sepIdx + 1),
  };
}

export async function recordProgressInRedis(
  payload: ProgressRecordPayload,
): Promise<{ accepted: boolean }> {
  const { userKey, episodeId, position, duration, event } = payload;
  const nowIso = payload.updated_at || new Date().toISOString();
  const rlKey = `prog:rl:${userKey}`;
  const hashKey = `prog:${userKey}:${episodeId}`;
  const queueVal = `${userKey}|${episodeId}`;

  if (redisClient && typeof window === "undefined") {
    try {
      const res = await withRedisTimeout(
        redisClient.eval<string[], number>(
          RECORD_PROGRESS_SCRIPT,
          [rlKey, hashKey, PROGRESS_QUEUE_KEY],
          [
            "5",
            String(position),
            String(duration),
            event,
            nowIso,
            String(PROGRESS_TTL_SEC),
            queueVal,
            String(PROGRESS_QUEUE_MAX_INDEX),
          ],
        ),
      );
      return { accepted: Number(res) === 1 };
    } catch (err) {
      console.warn("[redis] Falha ao gravar progresso no Redis:", err);
    }
  }

  const nowMs = Date.now();
  const lastTime = inMemoryRateLimit.get(userKey) || 0;
  if (nowMs - lastTime < 5000) {
    return { accepted: false };
  }
  inMemoryRateLimit.set(userKey, nowMs);
  inMemoryProgressStore.set(hashKey, {
    position: String(position),
    duration: String(duration),
    event,
    updated_at: nowIso,
  });
  inMemoryProgressQueue.unshift(queueVal);
  if (inMemoryProgressQueue.length > 5000) {
    inMemoryProgressQueue.length = 5000;
  }
  return { accepted: true };
}

export async function getProgressFromRedis(
  userKey: string,
  episodeId: string,
): Promise<{ position: number; duration: number } | null> {
  const hashKey = `prog:${userKey}:${episodeId}`;

  if (redisClient && typeof window === "undefined") {
    try {
      const data = await withRedisTimeout(
        redisClient.hgetall<Record<string, string>>(hashKey),
      );
      if (data && data.position !== undefined) {
        return {
          position: Math.max(0, parseInt(String(data.position), 10) || 0),
          duration: Math.max(0, parseInt(String(data.duration), 10) || 0),
        };
      }
    } catch (err) {
      console.warn("[redis] Falha ao ler progresso do Redis:", err);
    }
  }

  const mem = inMemoryProgressStore.get(hashKey);
  if (mem && mem.position) {
    return {
      position: Math.max(0, parseInt(mem.position, 10) || 0),
      duration: Math.max(0, parseInt(mem.duration, 10) || 0),
    };
  }
  return null;
}

export async function drainProgressFromQueue(
  limit = 500,
): Promise<
  Array<{
    userKey: string;
    episodeId: string;
    position: number;
    duration: number;
    updated_at: string;
  }>
> {
  if (typeof window !== "undefined") {
    return [];
  }

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 500);
  const rawItems: string[] = [];

  if (redisClient) {
    try {
      const popped = await withRedisTimeout(
        redisClient.eval<string[], string[]>(
          DRAIN_PROGRESS_QUEUE_SCRIPT,
          [PROGRESS_QUEUE_KEY],
          [String(safeLimit)],
        ),
      );
      if (Array.isArray(popped)) {
        for (const item of popped) {
          if (typeof item === "string" && item) {
            rawItems.push(item);
          }
        }
      }
    } catch (err) {
      console.warn("[redis] Falha ao drenar fila de progresso:", err);
    }
  } else {
    for (let i = 0; i < safeLimit; i++) {
      const item = inMemoryProgressQueue.pop();
      if (!item) break;
      rawItems.push(item);
    }
  }

  if (rawItems.length === 0) return [];

  // Deduplica mantendo a ocorrência mais recente do lote
  const orderedUniqueKeys: string[] = [];
  const seen = new Set<string>();
  for (let i = rawItems.length - 1; i >= 0; i--) {
    const key = rawItems[i];
    if (!seen.has(key)) {
      seen.add(key);
      orderedUniqueKeys.push(key);
    }
  }
  orderedUniqueKeys.reverse();

  const parsedEntries: Array<{
    raw: string;
    userKey: string;
    episodeId: string;
    hashKey: string;
  }> = [];

  for (const item of orderedUniqueKeys) {
    const split = splitProgressQueueEntry(item);
    if (!split) continue;
    parsedEntries.push({
      raw: item,
      userKey: split.userKey,
      episodeId: split.episodeId,
      hashKey: `prog:${split.userKey}:${split.episodeId}`,
    });
  }

  if (parsedEntries.length === 0) return [];

  const dedupedMap = new Map<
    string,
    {
      userKey: string;
      episodeId: string;
      position: number;
      duration: number;
      updated_at: string;
    }
  >();

  if (redisClient) {
    try {
      const pipe = redisClient.pipeline();
      for (const entry of parsedEntries) {
        pipe.hgetall<Record<string, string>>(entry.hashKey);
      }
      const results = await withRedisTimeout(
        pipe.exec<Array<Record<string, string> | null>>(),
      );

      for (let i = 0; i < parsedEntries.length; i++) {
        const entry = parsedEntries[i];
        const data = results[i];
        if (!data || data.position === undefined) continue;
        const position = Math.max(0, parseInt(String(data.position), 10) || 0);
        const duration = Math.max(0, parseInt(String(data.duration), 10) || 0);
        const updated_at =
          typeof data.updated_at === "string" && data.updated_at
            ? data.updated_at
            : new Date().toISOString();

        const existing = dedupedMap.get(entry.raw);
        if (!existing || existing.updated_at < updated_at) {
          dedupedMap.set(entry.raw, {
            userKey: entry.userKey,
            episodeId: entry.episodeId,
            position,
            duration,
            updated_at,
          });
        }
      }
    } catch (err) {
      console.warn("[redis] Falha ao ler hashes de progresso no dreno:", err);
    }
  } else {
    for (const entry of parsedEntries) {
      const data = inMemoryProgressStore.get(entry.hashKey) ?? null;
      if (!data || data.position === undefined) continue;
      const position = Math.max(0, parseInt(data.position, 10) || 0);
      const duration = Math.max(0, parseInt(data.duration, 10) || 0);
      const updated_at = data.updated_at || new Date().toISOString();
      dedupedMap.set(entry.raw, {
        userKey: entry.userKey,
        episodeId: entry.episodeId,
        position,
        duration,
        updated_at,
      });
    }
  }

  return Array.from(dedupedMap.values());
}

export async function cleanupDrainedProgressHashes(
  drained: Array<{ userKey: string; episodeId: string; updated_at: string }>,
): Promise<void> {
  if (drained.length === 0) return;

  if (redisClient) {
    try {
      const pipe = redisClient.pipeline();
      for (const item of drained) {
        const hashKey = `prog:${item.userKey}:${item.episodeId}`;
        pipe.eval(CLEANUP_DRAINED_HASH_SCRIPT, [hashKey], [item.updated_at]);
      }
      await withRedisTimeout(pipe.exec());
    } catch (err) {
      console.warn("[redis] Falha ao limpar hashes drenados (HDEL):", err);
    }
    return;
  }

  for (const item of drained) {
    const hashKey = `prog:${item.userKey}:${item.episodeId}`;
    const mem = inMemoryProgressStore.get(hashKey);
    if (!mem || mem.updated_at === item.updated_at) {
      inMemoryProgressStore.delete(hashKey);
    }
  }
}

/* ============================================================================
 * CALENDÁRIO SEMANAL: Cache e Invalidação com Shared Generation Counter
 * Chaves:
 *   - hikari:calendar:gen:v1 (contador atômico de geração)
 *   - hikari:calendar:week:v1:<weekKey> (dados da semana serializados com geração)
 * ============================================================================ */

const CALENDAR_WEEK_REDIS_KEY_PREFIX = "hikari:calendar:week:v1:";
const CALENDAR_GEN_KEY = "hikari:calendar:gen:v1";
const CALENDAR_REDIS_TTL_SEC = 1800; // 30 minutos

export async function getRedisCalendarGen(): Promise<string> {
  if (!redisClient || typeof window !== "undefined") return "0";
  try {
    const gen = await withRedisTimeout(redisClient.get<string | number>(CALENDAR_GEN_KEY));
    return gen !== null && gen !== undefined ? String(gen) : "0";
  } catch (err) {
    console.warn("[redis] Falha ao ler geração do calendário:", err instanceof Error ? err.message : err);
    return "0";
  }
}

export async function getRedisCalendarSchedule<T = unknown>(weekKey: string): Promise<T | null> {
  if (!redisClient || typeof window !== "undefined" || !weekKey) return null;
  const key = `${CALENDAR_WEEK_REDIS_KEY_PREFIX}${weekKey}`;
  try {
    const pipe = redisClient.pipeline();
    pipe.get<string | number>(CALENDAR_GEN_KEY);
    pipe.get<{ gen: string; data: T } | string>(key);
    const results = await withRedisTimeout(pipe.exec<[string | number | null, unknown]>());

    const curGen = results[0] !== null && results[0] !== undefined ? String(results[0]) : "0";
    const cached = results[1];

    if (!cached) return null;

    let envelope: { gen?: string; data?: T } | null = null;
    if (typeof cached === "string") {
      try {
        envelope = JSON.parse(cached);
      } catch {
        return null;
      }
    } else if (typeof cached === "object" && cached !== null) {
      envelope = cached as { gen?: string; data?: T };
    }

    if (envelope && envelope.gen === curGen && envelope.data) {
      return envelope.data;
    }
    return null;
  } catch (err) {
    console.warn("[redis] Falha ao buscar calendário no Redis:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setRedisCalendarSchedule<T = unknown>(weekKey: string, data: T): Promise<void> {
  if (!redisClient || typeof window !== "undefined" || !weekKey || !data) return;
  const key = `${CALENDAR_WEEK_REDIS_KEY_PREFIX}${weekKey}`;
  try {
    const curGen = await getRedisCalendarGen();
    const payload = JSON.stringify({ gen: curGen, data });
    await withRedisTimeout(redisClient.set(key, payload, { ex: CALENDAR_REDIS_TTL_SEC }));
  } catch (err) {
    console.warn("[redis] Falha ao salvar calendário no Redis:", err instanceof Error ? err.message : err);
  }
}

export async function invalidateRedisCalendar(): Promise<void> {
  if (!redisClient || typeof window !== "undefined") return;
  try {
    await withRedisTimeout(redisClient.incr(CALENDAR_GEN_KEY));
  } catch (err) {
    console.warn("[redis] Falha ao incrementar geração do calendário:", err instanceof Error ? err.message : err);
  }
}

/* ============================================================================
 * CRÉDITOS E EPISÓDIOS EXTERNOS (ELENCO/STAFF E EPISÓDIOS JIKAN)
 * Chaves versionadas e isoladas por anime com fence atômico de geração:
 *   - hikari:catalog:credits:v1:<scopeKey> (TTL 7200s = 2h)
 *   - hikari:catalog:credits:gen:global:v1
 *   - hikari:catalog:credits:gen:id:v1:<id>
 *   - hikari:catalog:jikan-episodes:v1:<malId> (TTL 1800s = 30m)
 *   - hikari:catalog:jikan-episodes:gen:global:v1
 *   - hikari:catalog:jikan-episodes:gen:id:v1:<id>
 * ============================================================================ */

export type RedisEvalClient = Pick<Redis, "eval" | "del" | "keys">;

export const CREDITS_REDIS_KEY_PREFIX = "hikari:catalog:credits:v1:";
export const CREDITS_GLOBAL_GEN_KEY = "hikari:catalog:credits:gen:global:v1";
export const CREDITS_ID_GEN_PREFIX = "hikari:catalog:credits:gen:id:v1:";
export const CREDITS_REDIS_TTL_SEC = 7200; // 2 horas (alinhado ao domínio credits)

export const JIKAN_EPISODES_REDIS_KEY_PREFIX = "hikari:catalog:jikan-episodes:v1:";
export const JIKAN_EPISODES_GLOBAL_GEN_KEY = "hikari:catalog:jikan-episodes:gen:global:v1";
export const JIKAN_EPISODES_ID_GEN_PREFIX = "hikari:catalog:jikan-episodes:gen:id:v1:";
export const JIKAN_EPISODES_REDIS_TTL_SEC = 1800; // 30 minutos

export type RedisScopedFence = {
  globalGen: string;
  idGens: Record<string, string>;
};

export type RedisCreditsReadResult = {
  status: "hit" | "miss" | "unavailable" | "failed";
  credits: AnimeCreditsResult | null;
  fence: RedisScopedFence | null;
};

export type RedisJikanEpisodesReadResult = {
  status: "hit" | "miss" | "unavailable" | "failed";
  seasons: Season[] | null;
  fence: RedisScopedFence | null;
};

export type RedisScopedWriteStatus =
  | "inserted"
  | "fenced"
  | "skipped"
  | "unavailable"
  | "failed";

type RedisScopedEnvelope<T> = {
  v: 1;
  globalGen: string;
  idGens: Record<string, string>;
  data: T;
};

const GET_ENVELOPE_OR_FENCE_SCRIPT = `
local v = redis.call("GET", KEYS[1])
local g = tostring(redis.call("GET", KEYS[2]) or "0")
local out = { v and (":" .. v) or "", ":" .. g }
for i = 3, #KEYS do
  out[#out + 1] = ":" .. tostring(redis.call("GET", KEYS[i]) or "0")
end
return out
`;

const SET_ENVELOPE_WITH_FENCE_SCRIPT = `
if #KEYS >= 2 then
  for i = 2, #KEYS do
    local currentGen = tostring(redis.call("GET", KEYS[i]) or "0")
    if currentGen ~= tostring(ARGV[i + 1]) then
      return {"fenced"}
    end
  end
end
redis.call("SET", KEYS[1], ARGV[1], "EX", tonumber(ARGV[2]))
return {"inserted"}
`;

function resolveScopedRedisClient(
  override?: RedisEvalClient | null,
): RedisEvalClient | null {
  if (override !== undefined) {
    return override;
  }
  if (!redisClient || typeof window !== "undefined") {
    return null;
  }
  return redisClient;
}

function normalizeScopeText(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizePositiveInt(value?: number | null): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

export function collectCatalogInvalidationTargetIds(
  animeId?: string | null,
  externalIds?: {
    anilistId?: number | null;
    malId?: number | null;
    kitsuId?: number | null;
    extraIds?: Array<string | number | null | undefined>;
  },
): string[] {
  const targetIds = new Set<string>();
  const cleanId = animeId?.trim();
  if (cleanId) {
    targetIds.add(cleanId);
  }
  const anilistId = normalizePositiveInt(externalIds?.anilistId);
  if (anilistId > 0) {
    targetIds.add(String(anilistId));
  }
  const malId = normalizePositiveInt(externalIds?.malId);
  if (malId > 0) {
    targetIds.add(`mal-${malId}`);
  }
  const kitsuId = normalizePositiveInt(externalIds?.kitsuId);
  if (kitsuId > 0) {
    targetIds.add(`kitsu-${kitsuId}`);
  }
  if (Array.isArray(externalIds?.extraIds)) {
    for (const extra of externalIds.extraIds) {
      if (typeof extra === "string" && extra.trim()) {
        targetIds.add(extra.trim());
      } else if (typeof extra === "number" && Number.isFinite(extra) && extra > 0) {
        targetIds.add(String(Math.floor(extra)));
      }
    }
  }
  return Array.from(targetIds);
}

export function buildCreditsRedisScopeKey(input: {
  anilistId?: number;
  malId?: number;
  kitsuId?: number;
  skipAnilist?: boolean;
  titles?: string[];
  year?: number | null;
  format?: string | null;
  animeId?: string;
}): string {
  const ani = normalizePositiveInt(input.anilistId);
  const mal = normalizePositiveInt(input.malId);
  const kit = normalizePositiveInt(input.kitsuId);
  const skip = input.skipAnilist ? 1 : 0;
  const year = normalizePositiveInt(input.year);
  const fmt = normalizeScopeText(input.format) || "-";

  const cleanTitles = (input.titles ?? [])
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  const firstNorm = normalizeScopeText(cleanTitles[0] ?? "");
  const allNorm = cleanTitles.map((t) => normalizeScopeText(t)).filter(Boolean);
  const titlePart =
    allNorm.length <= 1
      ? encodeURIComponent(firstNorm).slice(0, 64) || "-"
      : `${encodeURIComponent(firstNorm).slice(0, 48)}~${fnv1aHex(allNorm.join("|"))}`;

  if (ani === 0 && mal === 0 && kit === 0) {
    const cleanAnimeId = input.animeId?.trim();
    const idSeg = cleanAnimeId ? `id-${encodeURIComponent(cleanAnimeId).slice(0, 64)}` : "local";
    return `${idSeg}:${skip}:${year}:${fmt}:${titlePart}`;
  }

  return `${ani}:${mal}:${kit}:${skip}:${year}:${fmt}:${titlePart}`;
}

export function buildCreditsRedisKey(scopeKey: string): string {
  return `${CREDITS_REDIS_KEY_PREFIX}${scopeKey.trim()}`;
}

export function buildJikanEpisodesRedisKey(malId: number): string {
  return `${JIKAN_EPISODES_REDIS_KEY_PREFIX}${Math.floor(malId)}`;
}

function buildScopedFenceArrays(
  globalGenKey: string,
  idGenPrefix: string,
  fence: RedisScopedFence,
): { keys: string[]; args: string[] } {
  const keys: string[] = [globalGenKey];
  const args: string[] = [fence.globalGen];
  for (const [fid, gen] of Object.entries(fence.idGens)) {
    const cleanFid = fid.trim();
    if (!cleanFid) continue;
    keys.push(`${idGenPrefix}${cleanFid}`);
    args.push(gen);
  }
  return { keys, args };
}

function isEnvelopeFenceValid(
  envelope: { globalGen?: unknown; idGens?: unknown },
  currentGlobalGen: string,
  currentIdGens: Record<string, string>,
): boolean {
  if (String(envelope.globalGen ?? "") !== currentGlobalGen) {
    return false;
  }
  const storedIdGens =
    envelope.idGens && typeof envelope.idGens === "object"
      ? (envelope.idGens as Record<string, unknown>)
      : {};
  for (const [fid, curGen] of Object.entries(currentIdGens)) {
    const stored = String(storedIdGens[fid] ?? "0");
    if (stored !== curGen) {
      return false;
    }
  }
  return true;
}

function isValidCreditsData(data: unknown): data is AnimeCreditsResult {
  if (!data || typeof data !== "object") return false;
  const c = data as AnimeCreditsResult;
  return (
    Array.isArray(c.studios) &&
    Array.isArray(c.characters) &&
    Array.isArray(c.staff)
  );
}

function isValidJikanEpisodesData(data: unknown): data is Season[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  const first = data[0] as Season | undefined;
  return Boolean(first && Array.isArray(first.episodes) && first.episodes.length > 0);
}

export async function getRedisAnimeCreditsWithFence(
  scopeKey: string,
  aliasIds?: string[],
  redisOverride?: RedisEvalClient | null,
): Promise<RedisCreditsReadResult> {
  const client = resolveScopedRedisClient(redisOverride);
  if (!client) {
    return { status: "unavailable", credits: null, fence: null };
  }
  const cleanScope = scopeKey?.trim();
  if (!cleanScope) {
    return { status: "unavailable", credits: null, fence: null };
  }

  const fenceIds = Array.from(
    new Set((aliasIds ?? []).map((v) => v.trim()).filter(Boolean)),
  );
  const valueKey = buildCreditsRedisKey(cleanScope);
  const keys = [
    valueKey,
    CREDITS_GLOBAL_GEN_KEY,
    ...fenceIds.map((fid) => `${CREDITS_ID_GEN_PREFIX}${fid}`),
  ];

  try {
    const res = await withRedisTimeout(
      client.eval<never[], unknown[]>(GET_ENVELOPE_OR_FENCE_SCRIPT, keys, []),
    );
    if (!Array.isArray(res) || res.length !== 2 + fenceIds.length) {
      return { status: "failed", credits: null, fence: null };
    }

    const globalGen = extractGenToken(res[1]);
    if (!globalGen) {
      return { status: "failed", credits: null, fence: null };
    }

    const idGens: Record<string, string> = {};
    for (let i = 0; i < fenceIds.length; i++) {
      const token = extractGenToken(res[i + 2]);
      if (!token) {
        return { status: "failed", credits: null, fence: null };
      }
      idGens[fenceIds[i]] = token;
    }

    const fence: RedisScopedFence = { globalGen, idGens };
    const raw = extractPrefixedRaw(res[0]);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as RedisScopedEnvelope<AnimeCreditsResult>;
        if (
          parsed &&
          parsed.v === 1 &&
          isEnvelopeFenceValid(parsed, globalGen, idGens) &&
          isValidCreditsData(parsed.data)
        ) {
          return { status: "hit", credits: parsed.data, fence };
        }
      } catch {
        // Envelope inválido: trata como miss para rebuscar e sobrescrever
      }
    }

    return { status: "miss", credits: null, fence };
  } catch (err) {
    console.warn(
      "[redis] Aviso ao buscar créditos do anime no Redis (fail-open para upstream):",
      err instanceof Error ? err.message : err,
    );
    return { status: "failed", credits: null, fence: null };
  }
}

export async function setRedisAnimeCredits(
  scopeKey: string,
  credits: AnimeCreditsResult,
  fence?: RedisScopedFence | null,
  redisOverride?: RedisEvalClient | null,
): Promise<RedisScopedWriteStatus> {
  const client = resolveScopedRedisClient(redisOverride);
  if (!client) {
    return "unavailable";
  }
  const cleanScope = scopeKey?.trim();
  if (!cleanScope || !isValidCreditsData(credits)) {
    return "skipped";
  }
  if (fence === null) {
    return "failed";
  }

  const activeFence: RedisScopedFence = fence ?? { globalGen: "0", idGens: {} };
  const envelope: RedisScopedEnvelope<AnimeCreditsResult> = {
    v: 1,
    globalGen: activeFence.globalGen,
    idGens: activeFence.idGens,
    data: credits,
  };

  const valueKey = buildCreditsRedisKey(cleanScope);
  const { keys: fenceKeys, args: fenceArgs } = buildScopedFenceArrays(
    CREDITS_GLOBAL_GEN_KEY,
    CREDITS_ID_GEN_PREFIX,
    activeFence,
  );

  try {
    const raw = JSON.stringify(envelope);
    const res = await withRedisTimeout(
      client.eval<string[], unknown[]>(
        SET_ENVELOPE_WITH_FENCE_SCRIPT,
        [valueKey, ...fenceKeys],
        [raw, String(CREDITS_REDIS_TTL_SEC), ...fenceArgs],
      ),
    );
    if (!Array.isArray(res)) return "failed";
    if (res[0] === "fenced") return "fenced";
    if (res[0] === "inserted") return "inserted";
    return "failed";
  } catch (err) {
    console.warn(
      "[redis] Aviso ao salvar créditos do anime no Redis:",
      err instanceof Error ? err.message : err,
    );
    return "failed";
  }
}

export async function invalidateRedisAnimeCredits(
  animeId?: string | null,
  externalIds?: {
    anilistId?: number | null;
    malId?: number | null;
    kitsuId?: number | null;
    extraIds?: Array<string | number | null | undefined>;
  },
  redisOverride?: RedisEvalClient | null,
): Promise<void> {
  const client = resolveScopedRedisClient(redisOverride);
  if (!client) return;

  try {
    const idList = collectCatalogInvalidationTargetIds(animeId, externalIds);
    if (idList.length > 0) {
      const genKeys = idList.map((tid) => `${CREDITS_ID_GEN_PREFIX}${tid}`);
      await withRedisTimeout(
        client.eval<[string], number>(
          INVALIDATE_IDS_SCRIPT,
          genKeys,
          [String(genKeys.length)],
        ),
      );
    } else {
      await withRedisTimeout(
        client.eval<never[], string>(
          INCR_GLOBAL_GEN_SCRIPT,
          [CREDITS_GLOBAL_GEN_KEY],
          [],
        ),
      );
      const keys = await withRedisTimeout(
        client.keys(`${CREDITS_REDIS_KEY_PREFIX}*`),
      );
      if (Array.isArray(keys) && keys.length > 0) {
        const CHUNK_SIZE = 200;
        for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
          await withRedisTimeout(client.del(...keys.slice(i, i + CHUNK_SIZE)));
        }
      }
    }
  } catch (err) {
    console.warn(
      "[redis] Aviso ao invalidar créditos no Redis:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function getRedisAnimeJikanEpisodesWithFence(
  malId: number,
  aliasIds?: string[],
  redisOverride?: RedisEvalClient | null,
): Promise<RedisJikanEpisodesReadResult> {
  const client = resolveScopedRedisClient(redisOverride);
  if (!client) {
    return { status: "unavailable", seasons: null, fence: null };
  }
  const cleanMalId = normalizePositiveInt(malId);
  if (cleanMalId <= 0) {
    return { status: "unavailable", seasons: null, fence: null };
  }

  const fenceIds = Array.from(
    new Set([
      `mal-${cleanMalId}`,
      ...(aliasIds ?? []).map((v) => v.trim()).filter(Boolean),
    ]),
  );
  const valueKey = buildJikanEpisodesRedisKey(cleanMalId);
  const keys = [
    valueKey,
    JIKAN_EPISODES_GLOBAL_GEN_KEY,
    ...fenceIds.map((fid) => `${JIKAN_EPISODES_ID_GEN_PREFIX}${fid}`),
  ];

  try {
    const res = await withRedisTimeout(
      client.eval<never[], unknown[]>(GET_ENVELOPE_OR_FENCE_SCRIPT, keys, []),
    );
    if (!Array.isArray(res) || res.length !== 2 + fenceIds.length) {
      return { status: "failed", seasons: null, fence: null };
    }

    const globalGen = extractGenToken(res[1]);
    if (!globalGen) {
      return { status: "failed", seasons: null, fence: null };
    }

    const idGens: Record<string, string> = {};
    for (let i = 0; i < fenceIds.length; i++) {
      const token = extractGenToken(res[i + 2]);
      if (!token) {
        return { status: "failed", seasons: null, fence: null };
      }
      idGens[fenceIds[i]] = token;
    }

    const fence: RedisScopedFence = { globalGen, idGens };
    const raw = extractPrefixedRaw(res[0]);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as RedisScopedEnvelope<Season[]>;
        if (
          parsed &&
          parsed.v === 1 &&
          isEnvelopeFenceValid(parsed, globalGen, idGens) &&
          isValidJikanEpisodesData(parsed.data)
        ) {
          return { status: "hit", seasons: parsed.data, fence };
        }
      } catch {
        // Envelope inválido: trata como miss
      }
    }

    return { status: "miss", seasons: null, fence };
  } catch (err) {
    console.warn(
      "[redis] Aviso ao buscar episódios Jikan no Redis (fail-open para upstream):",
      err instanceof Error ? err.message : err,
    );
    return { status: "failed", seasons: null, fence: null };
  }
}

export async function setRedisAnimeJikanEpisodes(
  malId: number,
  seasons: Season[],
  fence?: RedisScopedFence | null,
  redisOverride?: RedisEvalClient | null,
): Promise<RedisScopedWriteStatus> {
  const client = resolveScopedRedisClient(redisOverride);
  if (!client) {
    return "unavailable";
  }
  const cleanMalId = normalizePositiveInt(malId);
  if (cleanMalId <= 0 || !isValidJikanEpisodesData(seasons)) {
    return "skipped";
  }
  if (fence === null) {
    return "failed";
  }

  const activeFence: RedisScopedFence = fence ?? { globalGen: "0", idGens: {} };
  const envelope: RedisScopedEnvelope<Season[]> = {
    v: 1,
    globalGen: activeFence.globalGen,
    idGens: activeFence.idGens,
    data: seasons,
  };

  const valueKey = buildJikanEpisodesRedisKey(cleanMalId);
  const { keys: fenceKeys, args: fenceArgs } = buildScopedFenceArrays(
    JIKAN_EPISODES_GLOBAL_GEN_KEY,
    JIKAN_EPISODES_ID_GEN_PREFIX,
    activeFence,
  );

  try {
    const raw = JSON.stringify(envelope);
    const res = await withRedisTimeout(
      client.eval<string[], unknown[]>(
        SET_ENVELOPE_WITH_FENCE_SCRIPT,
        [valueKey, ...fenceKeys],
        [raw, String(JIKAN_EPISODES_REDIS_TTL_SEC), ...fenceArgs],
      ),
    );
    if (!Array.isArray(res)) return "failed";
    if (res[0] === "fenced") return "fenced";
    if (res[0] === "inserted") return "inserted";
    return "failed";
  } catch (err) {
    console.warn(
      "[redis] Aviso ao salvar episódios Jikan no Redis:",
      err instanceof Error ? err.message : err,
    );
    return "failed";
  }
}

export async function invalidateRedisAnimeJikanEpisodes(
  animeId?: string | null,
  externalIds?: {
    anilistId?: number | null;
    malId?: number | null;
    kitsuId?: number | null;
    extraIds?: Array<string | number | null | undefined>;
  },
  redisOverride?: RedisEvalClient | null,
): Promise<void> {
  const client = resolveScopedRedisClient(redisOverride);
  if (!client) return;

  try {
    const idList = collectCatalogInvalidationTargetIds(animeId, externalIds);
    if (idList.length > 0) {
      const genKeys = idList.map((tid) => `${JIKAN_EPISODES_ID_GEN_PREFIX}${tid}`);
      const directValueKeys = new Set<string>();
      const explicitMalId = normalizePositiveInt(externalIds?.malId);
      if (explicitMalId > 0) {
        directValueKeys.add(buildJikanEpisodesRedisKey(explicitMalId));
      }
      for (const tid of idList) {
        const malMatch = /^mal-(\d+)$/.exec(tid);
        if (malMatch) {
          const parsed = normalizePositiveInt(Number(malMatch[1]));
          if (parsed > 0) {
            directValueKeys.add(buildJikanEpisodesRedisKey(parsed));
          }
        }
      }
      await withRedisTimeout(
        client.eval<[string], number>(
          INVALIDATE_IDS_SCRIPT,
          [...genKeys, ...Array.from(directValueKeys)],
          [String(genKeys.length)],
        ),
      );
    } else {
      await withRedisTimeout(
        client.eval<never[], string>(
          INCR_GLOBAL_GEN_SCRIPT,
          [JIKAN_EPISODES_GLOBAL_GEN_KEY],
          [],
        ),
      );
      const keys = await withRedisTimeout(
        client.keys(`${JIKAN_EPISODES_REDIS_KEY_PREFIX}*`),
      );
      if (Array.isArray(keys) && keys.length > 0) {
        const CHUNK_SIZE = 200;
        for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
          await withRedisTimeout(client.del(...keys.slice(i, i + CHUNK_SIZE)));
        }
      }
    }
  } catch (err) {
    console.warn(
      "[redis] Aviso ao invalidar episódios Jikan no Redis:",
      err instanceof Error ? err.message : err,
    );
  }
}

type EpisodesRamInvalidator = (ids: string[]) => void;
const episodesRamInvalidators = new Set<EpisodesRamInvalidator>();

export function registerJikanEpisodesRamInvalidator(fn: EpisodesRamInvalidator): () => void {
  episodesRamInvalidators.add(fn);
  return () => {
    episodesRamInvalidators.delete(fn);
  };
}

export function notifyJikanEpisodesRamInvalidation(ids: string[]): void {
  for (const fn of episodesRamInvalidators) {
    try {
      fn(ids);
    } catch {
      // ignore
    }
  }
}











