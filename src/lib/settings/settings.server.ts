import { getSql } from "@/lib/db";
import {
  getRedisPublicSettingsWithFence,
  invalidateRedisPublicSettings,
  scheduleRedisBackgroundWrite,
  setRedisPublicSettings,
} from "@/lib/redis";
import {
  type HikariAdminSettings,
  type HikariPublicSettings,
  DEFAULT_ADMIN_SETTINGS,
  DEFAULT_PUBLIC_SETTINGS,
  adminSettingsSchema,
  toPublicSettings,
} from "./settings-types";

let cachedPublicSettings: HikariPublicSettings | null = null;
let lastPublicCacheTime = 0;
let publicSettingsInFlightPromise: Promise<HikariPublicSettings> | null = null;
let publicSettingsCacheEpoch = 0;
const PUBLIC_CACHE_TTL_MS = 60 * 1000; // 60s cache

export function invalidatePublicSettingsCache(options?: { skipRedis?: boolean }): void {
  publicSettingsCacheEpoch += 1;
  cachedPublicSettings = null;
  lastPublicCacheTime = 0;
  publicSettingsInFlightPromise = null;
  if (!options?.skipRedis) {
    void invalidateRedisPublicSettings().catch(() => {});
  }
}

async function fetchAllSettingsFromDbStrict(): Promise<HikariAdminSettings> {
  const sql = await getSql();

  const allowedKeys = Object.keys(DEFAULT_ADMIN_SETTINGS);
  const rows = await sql.query<{ key: string; value: string }>(
    `SELECT "key", "value" FROM "admin_settings" WHERE "key" = ANY($1::text[]);`,
    [allowedKeys],
  );

  const dbMap = new Map<string, unknown>();
  for (const r of rows) {
    try {
      dbMap.set(r.key, JSON.parse(r.value));
    } catch {
      dbMap.set(r.key, r.value);
    }
  }

  const merged: Record<string, unknown> = { ...DEFAULT_ADMIN_SETTINGS };
  for (const [k, v] of dbMap.entries()) {
    if (k in DEFAULT_ADMIN_SETTINGS && v !== undefined && v !== null) {
      merged[k] = v;
    }
  }

  const parseResult = adminSettingsSchema.safeParse(merged);
  if (parseResult.success) {
    return parseResult.data;
  }

  console.warn(
    "[settings.server] Schema validation fallback na leitura de admin_settings:",
    parseResult.error,
  );
  return DEFAULT_ADMIN_SETTINGS;
}

export async function loadAllSettingsFromDb(): Promise<HikariAdminSettings> {
  try {
    return await fetchAllSettingsFromDbStrict();
  } catch (err) {
    console.warn("[settings.server] Erro ao consultar admin_settings do PostgreSQL:", err);
    return DEFAULT_ADMIN_SETTINGS;
  }
}

export async function saveSettingsToDb(
  updates: Partial<HikariAdminSettings>,
): Promise<HikariAdminSettings> {
  const sql = await getSql();

  const entries = Object.entries(updates).filter(
    ([k, v]) => k in DEFAULT_ADMIN_SETTINGS && v !== undefined,
  );

  if (entries.length === 0) {
    return loadAllSettingsFromDb();
  }

  if (entries.length === 1) {
    const [key, value] = entries[0];
    await sql.query(
      `INSERT INTO "admin_settings" ("key", "value", "createdAt", "updatedAt")
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("key") DO UPDATE
       SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP;`,
      [key, JSON.stringify(value)],
    );
  } else {
    const keys = entries.map(([k]) => k);
    const values = entries.map(([, v]) => JSON.stringify(v));
    await sql.query(
      `INSERT INTO "admin_settings" ("key", "value", "createdAt", "updatedAt")
       SELECT k, v, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       FROM UNNEST($1::text[], $2::text[]) AS t(k, v)
       ON CONFLICT ("key") DO UPDATE
       SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP;`,
      [keys, values],
    );
  }

  invalidatePublicSettingsCache({ skipRedis: true });
  await invalidateRedisPublicSettings().catch(() => {});
  return loadAllSettingsFromDb();
}

export async function loadPublicSettingsFromDb(): Promise<HikariPublicSettings> {
  const now = Date.now();
  if (cachedPublicSettings && now - lastPublicCacheTime < PUBLIC_CACHE_TTL_MS) {
    return cachedPublicSettings;
  }

  if (publicSettingsInFlightPromise) {
    return publicSettingsInFlightPromise;
  }

  const requestEpoch = publicSettingsCacheEpoch;
  let flightRef: Promise<HikariPublicSettings> | null = null;

  const currentFlight = (async (): Promise<HikariPublicSettings> => {
    try {
      const redisRead = await getRedisPublicSettingsWithFence();
      if (redisRead.status === "hit" && redisRead.data) {
        if (requestEpoch === publicSettingsCacheEpoch) {
          cachedPublicSettings = redisRead.data;
          lastPublicCacheTime = Date.now();
        }
        return redisRead.data;
      }

      const fetchStartedAt = Date.now();
      const all = await fetchAllSettingsFromDbStrict();
      const publicSettings = toPublicSettings(all);

      if (requestEpoch === publicSettingsCacheEpoch) {
        cachedPublicSettings = publicSettings;
        lastPublicCacheTime = Date.now();
        if (redisRead.fence) {
          scheduleRedisBackgroundWrite(
            setRedisPublicSettings(publicSettings, redisRead.fence, fetchStartedAt),
            "setRedisPublicSettings",
          );
        }
      }
      return publicSettings;
    } catch (err) {
      console.warn("[settings.server] Falha ao montar configurações públicas:", err);
      return DEFAULT_PUBLIC_SETTINGS;
    } finally {
      if (publicSettingsInFlightPromise === flightRef) {
        publicSettingsInFlightPromise = null;
      }
    }
  })();

  flightRef = currentFlight;
  publicSettingsInFlightPromise = currentFlight;
  return currentFlight;
}
