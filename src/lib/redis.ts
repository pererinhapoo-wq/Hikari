import { Redis } from "@upstash/redis";
import type { DbCatalogAnimeRow } from "@/lib/catalog-server-overlay.server";

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
