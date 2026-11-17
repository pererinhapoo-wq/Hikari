import { Redis } from "@upstash/redis";
import type { DbCatalogAnimeRow } from "@/lib/catalog-server-overlay.server";
import type { CatalogEpisodesResult } from "@/lib/catalog-episodes";
import type { Anime, Episode, SlimAnime } from "@/lib/types";

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


