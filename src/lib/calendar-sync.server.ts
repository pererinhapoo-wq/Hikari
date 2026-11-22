import { dbSource, getSql, type DbSource, type Sql } from "@/lib/db";
import { getRedisClient, invalidateRedisCalendar } from "@/lib/redis";
import { invalidateLocalTodayScheduleCache } from "@/lib/calendar-schedule.server";
import { invalidateServerCatalogCachesAsync } from "@/lib/api";

export type CalendarSyncMode = "schedule" | "incremental" | "full" | "announcements";

export interface CalendarSyncResult {
  status: string;
  mode?: string;
  dryRun?: boolean;
  paused?: boolean;
  httpRequestsCount?: number;
  totalProcessed?: number;
  totalInserted?: number;
  totalUpdated?: number;
  importedSchedulesCount?: number;
  timestampUpdated?: boolean;
}

export interface CalendarSyncStatus {
  dbSource: DbSource;
  counts: {
    scheduleCount: number;
    animeCount: number;
    seasonCount: number;
  };
  scheduleRange: {
    minAiringAt: string | null;
    maxAiringAt: string | null;
  };
  settings: {
    initialCompleted: boolean;
    lastScheduleTimestamp: number | null;
    lastCatalogTimestamp: number | null;
    checkpoint: Record<string, unknown> | null;
    lastSummary: Record<string, unknown> | null;
  };
}

const activePgliteLocks = new Set<number>();

function parseSettingJsonOrText(raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function toOptionalEpochMs(raw: unknown): number | null {
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : null;
}

function createSqlPoolAdapter(sql: Sql) {
  const client = {
    async query(sqlText: string, params: unknown[] = []) {
      const normalized = sqlText.replace(/\s+/g, " ").trim();
      if (normalized.startsWith("SELECT pg_try_advisory_lock")) {
        const lockId = Number(params[0] ?? 849201);
        if (activePgliteLocks.has(lockId)) {
          return { rows: [{ locked: false }] };
        }
        activePgliteLocks.add(lockId);
        return { rows: [{ locked: true }] };
      }
      if (normalized.startsWith("SELECT pg_advisory_unlock")) {
        const lockId = Number(params[0] ?? 849201);
        activePgliteLocks.delete(lockId);
        return { rows: [{ pg_advisory_unlock: true }] };
      }
      const rows = await sql.query(sqlText, params);
      return { rows };
    },
    release() {},
  };

  return {
    async connect() {
      return client;
    },
    async end() {},
  };
}

export async function getCalendarSyncStatus(deps?: {
  sql?: Sql;
}): Promise<CalendarSyncStatus> {
  const sql = deps?.sql ?? (await getSql());

  const [
    [scheduleRow],
    [animeRow],
    [seasonRow],
    [rangeRow],
    settingsRows,
  ] = await Promise.all([
    sql
      .query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM "catalog_airing_schedule";`,
      )
      .catch(() => [{ count: "0" }]),
    sql
      .query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM "catalog_anime";`,
      )
      .catch(() => [{ count: "0" }]),
    sql
      .query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM "catalog_season";`,
      )
      .catch(() => [{ count: "0" }]),
    sql
      .query<{ min_at: string | null; max_at: string | null }>(
        `SELECT
           MIN("airingAt")::text AS min_at,
           MAX("airingAt")::text AS max_at
         FROM "catalog_airing_schedule";`,
      )
      .catch(() => [{ min_at: null, max_at: null }]),
    sql
      .query<{ key: string; value: string }>(
        `SELECT "key", "value"
         FROM "admin_settings"
         WHERE "key" IN (
           'anilist_sync_initial_completed',
           'anilist_sync_schedule_last_timestamp',
           'anilist_sync_last_timestamp',
           'anilist_sync_checkpoint',
           'anilist_sync_last_summary'
         );`,
      )
      .catch(() => [] as Array<{ key: string; value: string }>),
  ]);

  const settingsMap = new Map<string, unknown>();
  for (const row of settingsRows) {
    settingsMap.set(row.key, parseSettingJsonOrText(row.value));
  }

  const rawInitial = settingsMap.get("anilist_sync_initial_completed");
  const rawCheckpoint = settingsMap.get("anilist_sync_checkpoint");
  const rawSummary = settingsMap.get("anilist_sync_last_summary");

  return {
    dbSource,
    counts: {
      scheduleCount: parseInt(scheduleRow?.count || "0", 10) || 0,
      animeCount: parseInt(animeRow?.count || "0", 10) || 0,
      seasonCount: parseInt(seasonRow?.count || "0", 10) || 0,
    },
    scheduleRange: {
      minAiringAt: rangeRow?.min_at ?? null,
      maxAiringAt: rangeRow?.max_at ?? null,
    },
    settings: {
      initialCompleted: rawInitial === true || String(rawInitial) === "true",
      lastScheduleTimestamp: toOptionalEpochMs(
        settingsMap.get("anilist_sync_schedule_last_timestamp"),
      ),
      lastCatalogTimestamp: toOptionalEpochMs(
        settingsMap.get("anilist_sync_last_timestamp"),
      ),
      checkpoint:
        rawCheckpoint &&
        typeof rawCheckpoint === "object" &&
        !Array.isArray(rawCheckpoint)
          ? (rawCheckpoint as Record<string, unknown>)
          : null,
      lastSummary:
        rawSummary && typeof rawSummary === "object" && !Array.isArray(rawSummary)
          ? (rawSummary as Record<string, unknown>)
          : null,
    },
  };
}

export async function runAdminCalendarSync(options?: {
  mode?: CalendarSyncMode;
  scheduleDaysForward?: number;
  timeBudgetMs?: number;
  sql?: Sql;
  pool?: unknown;
  redis?: unknown;
  fetchImpl?: typeof fetch;
  rateLimitDelayMs?: number;
  retries?: number;
  now?: () => Date;
}): Promise<CalendarSyncResult> {
  const mode: CalendarSyncMode = options?.mode ?? "schedule";
  const scheduleDaysForward = options?.scheduleDaysForward ?? 90;
  const timeBudgetMs = options?.timeBudgetMs ?? 25000;

  let poolToUse = options?.pool;
  let ownsPool = false;

  if (!poolToUse) {
    if (!options?.sql && dbSource === "neon" && process.env.DATABASE_URL) {
      const { default: pg } = await import("pg");
      poolToUse = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        max: 2,
        connectionTimeoutMillis: 8000,
      });
      ownsPool = true;
    } else {
      const sql = options?.sql ?? (await getSql());
      poolToUse = createSqlPoolAdapter(sql);
    }
  }

  try {
    const syncMod = (await import("../../scripts/anilist-sync.mjs")) as {
      runSync: (opts: Record<string, unknown>) => Promise<CalendarSyncResult>;
    };

    const result = await syncMod.runSync({
      pool: poolToUse,
      redis: options?.redis !== undefined ? options.redis : getRedisClient(),
      mode,
      scheduleDaysForward,
      timeBudgetMs,
      scheduleLimits: { maxSchedulePages: 60 },
      ...(options?.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options?.rateLimitDelayMs !== undefined
        ? { rateLimitDelayMs: options.rateLimitDelayMs }
        : {}),
      ...(options?.retries !== undefined ? { retries: options.retries } : {}),
      ...(options?.now ? { now: options.now } : {}),
    });

    if (result.status !== "skipped_locked") {
      invalidateLocalTodayScheduleCache();
      await Promise.allSettled([
        invalidateServerCatalogCachesAsync(),
        invalidateRedisCalendar(),
      ]);
    }

    return result;
  } finally {
    if (ownsPool && poolToUse && typeof (poolToUse as { end?: () => Promise<void> }).end === "function") {
      await (poolToUse as { end: () => Promise<void> }).end().catch(() => {});
    }
  }
}
