import crypto from "node:crypto";
import { dbSource, getPglite, getSql, type Sql } from "@/lib/db";
import type {
  AniListSyncCheckpointInfo,
  AniListSyncExecutionMode,
  AniListSyncProgressInfo,
  AniListSyncRunStatus,
  AniListSyncStatusSnapshot,
} from "./anilist-sync-types";
import {
  ADVISORY_LOCK_ID,
  normalizeSyncFrequency,
  parseAdminSettingValue,
  runSync,
} from "../../scripts/anilist-sync.mjs";

export const ANILIST_SYNC_STATUS_KEY = "anilist_sync_status";
export const DEFAULT_STALE_RUNNING_MS = 90_000;
export const DEFAULT_VERCEL_STEP_BUDGET_MS = 7_500;

export class AniListSyncConflictError extends Error {
  readonly status = 409;

  constructor(message = "Já existe uma sincronização AniList em execução.") {
    super(message);
    this.name = "AniListSyncConflictError";
  }
}

interface StoredSyncStatus {
  status: AniListSyncRunStatus;
  runId: string | null;
  mode: "initial" | "incremental" | null;
  startedAt: string | null;
  updatedAt: string | null;
  finishedAt: string | null;
  lastSuccessAt: string | null;
  errorMessage: string | null;
  triggeredBy?: string | null;
  progress: AniListSyncProgressInfo | null;
}

export interface SyncPoolClient {
  query<T = Record<string, unknown>>(
    sqlText: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  release(): void;
}

export interface SyncPool {
  connect(): Promise<SyncPoolClient>;
  end(): Promise<void>;
}

export interface AniListSyncDeps {
  pool?: SyncPool;
  sql?: Sql;
  redis?: unknown;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  rateLimitDelayMs?: number;
  backoffBaseMs?: number;
  retryAfterScaleMs?: number;
  retries?: number;
  timeBudgetMs?: number | null;
  staleRunningMs?: number;
  executionMode?: AniListSyncExecutionMode;
  initialLimits?: Record<string, number>;
  incrementalLimits?: Record<string, number>;
}

interface GlobalSyncRuntime {
  __hikariAniListSyncActivePromise__?: Promise<unknown> | null;
  __hikariAniListSyncRunId__?: string | null;
  __hikariPgliteLocks__?: Set<number>;
}

const globalSync = globalThis as typeof globalThis & GlobalSyncRuntime;

function getPgliteLockSet(): Set<number> {
  if (!globalSync.__hikariPgliteLocks__) {
    globalSync.__hikariPgliteLocks__ = new Set<number>();
  }
  return globalSync.__hikariPgliteLocks__;
}

export function resolveExecutionMode(
  deps?: AniListSyncDeps,
): AniListSyncExecutionMode {
  if (deps?.executionMode) return deps.executionMode;
  if (
    typeof process !== "undefined" &&
    (process.env.VERCEL === "1" || process.env.VERCEL === "true")
  ) {
    return "chunked";
  }
  return "background";
}

export async function waitForActiveAniListSync(): Promise<void> {
  const active = globalSync.__hikariAniListSyncActivePromise__;
  if (active) {
    await active.catch(() => undefined);
  }
}

async function createPglitePoolAdapter(): Promise<SyncPool> {
  const pg = await getPglite();
  const lockSet = getPgliteLockSet();

  const client: SyncPoolClient = {
    async query<T = Record<string, unknown>>(
      sqlText: string,
      params: unknown[] = [],
    ): Promise<{ rows: T[] }> {
      const normalized = sqlText.replace(/\s+/g, " ").trim();
      if (normalized.startsWith("SELECT pg_try_advisory_lock")) {
        const lockId = Number(params[0] ?? ADVISORY_LOCK_ID);
        if (lockSet.has(lockId)) {
          return { rows: [{ locked: false } as T] };
        }
        lockSet.add(lockId);
        return { rows: [{ locked: true } as T] };
      }
      if (normalized.startsWith("SELECT pg_advisory_unlock")) {
        const lockId = Number(params[0] ?? ADVISORY_LOCK_ID);
        const existed = lockSet.delete(lockId);
        return { rows: [{ pg_advisory_unlock: existed } as T] };
      }
      const res = await pg.query<T>(sqlText, params);
      return { rows: res.rows };
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

async function resolvePoolForSync(
  deps?: AniListSyncDeps,
): Promise<{ pool: SyncPool; ownsPool: boolean }> {
  if (deps?.pool) {
    return { pool: deps.pool, ownsPool: false };
  }

  const dbUrl = process.env.DATABASE_URL?.trim();
  if (dbSource === "neon" && dbUrl) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: dbUrl, max: 2 }) as unknown as SyncPool;
    return { pool, ownsPool: true };
  }

  const adapter = await createPglitePoolAdapter();
  return { pool: adapter, ownsPool: false };
}

async function querySqlRows<T = Record<string, unknown>>(
  text: string,
  params: unknown[],
  deps?: AniListSyncDeps,
): Promise<T[]> {
  if (deps?.sql) {
    return deps.sql.query<T>(text, params);
  }
  if (deps?.pool) {
    const client = await deps.pool.connect();
    try {
      const res = await client.query<T>(text, params);
      return res.rows;
    } finally {
      client.release();
    }
  }
  const sql = await getSql();
  return sql.query<T>(text, params);
}

async function readSetting(key: string, deps?: AniListSyncDeps): Promise<unknown> {
  try {
    const rows = await querySqlRows<{ value: string }>(
      `SELECT "value" FROM "admin_settings" WHERE "key" = $1 LIMIT 1;`,
      [key],
      deps,
    );
    if (rows.length === 0) return null;
    return parseAdminSettingValue(rows[0].value);
  } catch {
    return null;
  }
}

async function writeSetting(
  key: string,
  value: unknown,
  deps?: AniListSyncDeps,
): Promise<void> {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  await querySqlRows(
    `INSERT INTO "admin_settings" ("key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("key") DO UPDATE
     SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP;`,
    [key, serialized],
    deps,
  );
}

async function probeAdvisoryLockFree(deps?: AniListSyncDeps): Promise<boolean> {
  const { pool, ownsPool } = await resolvePoolForSync(deps);
  const client = await pool.connect();
  let acquired = false;
  try {
    const res = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked;",
      [ADVISORY_LOCK_ID],
    );
    acquired = Boolean(res.rows[0]?.locked);
    return acquired;
  } catch {
    // Se não for possível sondar o lock explicitamente, não bloqueia falso positivo
    return true;
  } finally {
    if (acquired) {
      await client
        .query("SELECT pg_advisory_unlock($1);", [ADVISORY_LOCK_ID])
        .catch(() => {});
    }
    client.release();
    if (ownsPool) {
      await pool.end().catch(() => {});
    }
  }
}

function parseStoredStatus(raw: unknown): StoredSyncStatus | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const statusVal = obj.status;
  const status: AniListSyncRunStatus =
    statusVal === "running" ||
    statusVal === "completed" ||
    statusVal === "error" ||
    statusVal === "idle"
      ? statusVal
      : "idle";

  const mode =
    obj.mode === "initial" || obj.mode === "incremental" ? obj.mode : null;

  const rawProgress =
    obj.progress && typeof obj.progress === "object" && !Array.isArray(obj.progress)
      ? (obj.progress as Record<string, unknown>)
      : null;

  return {
    status,
    runId: typeof obj.runId === "string" ? obj.runId : null,
    mode,
    startedAt: typeof obj.startedAt === "string" ? obj.startedAt : null,
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : null,
    finishedAt: typeof obj.finishedAt === "string" ? obj.finishedAt : null,
    lastSuccessAt: typeof obj.lastSuccessAt === "string" ? obj.lastSuccessAt : null,
    errorMessage: typeof obj.errorMessage === "string" ? obj.errorMessage : null,
    triggeredBy: typeof obj.triggeredBy === "string" ? obj.triggeredBy : null,
    progress: rawProgress
      ? {
          stage: typeof rawProgress.stage === "string" ? rawProgress.stage : null,
          page:
            typeof rawProgress.page === "number" && Number.isFinite(rawProgress.page)
              ? rawProgress.page
              : null,
          seasonIndex:
            typeof rawProgress.seasonIndex === "number" &&
            Number.isFinite(rawProgress.seasonIndex)
              ? rawProgress.seasonIndex
              : null,
          totalProcessed: Number(rawProgress.totalProcessed) || 0,
          totalInserted: Number(rawProgress.totalInserted) || 0,
          totalUpdated: Number(rawProgress.totalUpdated) || 0,
          importedSchedulesCount: Number(rawProgress.importedSchedulesCount) || 0,
        }
      : null,
  };
}

function parseCheckpoint(raw: unknown): AniListSyncCheckpointInfo | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const mode =
    obj.mode === "initial" || obj.mode === "incremental" ? obj.mode : "initial";
  const stage = typeof obj.stage === "string" && obj.stage.trim() ? obj.stage : "trending";
  return {
    mode,
    stage,
    page: Math.max(1, Number(obj.page) || 1),
    seasonIndex: Math.max(0, Number(obj.seasonIndex) || 0),
    startedAt:
      Number.isFinite(Number(obj.startedAt)) && Number(obj.startedAt) > 0
        ? Math.floor(Number(obj.startedAt))
        : null,
    updatedAt:
      Number.isFinite(Number(obj.updatedAt)) && Number(obj.updatedAt) > 0
        ? Math.floor(Number(obj.updatedAt))
        : null,
  };
}

function resolveLastSuccessIso(
  stored: StoredSyncStatus | null,
  rawLastTs: unknown,
): string | null {
  const storedTs = stored?.lastSuccessAt ? Date.parse(stored.lastSuccessAt) : NaN;
  const cliTsNum = Number(rawLastTs);
  const hasCliTs = Number.isFinite(cliTsNum) && cliTsNum > 0;

  if (Number.isFinite(storedTs) && storedTs > 0) {
    if (hasCliTs && cliTsNum > storedTs) {
      return new Date(cliTsNum).toISOString();
    }
    return stored!.lastSuccessAt;
  }

  if (hasCliTs) {
    return new Date(cliTsNum).toISOString();
  }
  return null;
}

function buildSnapshot(params: {
  stored: StoredSyncStatus | null;
  checkpoint: AniListSyncCheckpointInfo | null;
  initialCompleted: boolean;
  lastSuccessAt: string | null;
  frequency: "1_per_week" | "2_per_week";
  executionMode: AniListSyncExecutionMode;
}): AniListSyncStatusSnapshot {
  const { stored, checkpoint, initialCompleted, lastSuccessAt, frequency, executionMode } =
    params;

  let status: AniListSyncRunStatus = stored?.status ?? "idle";
  if (status === "idle" && lastSuccessAt && !checkpoint && !stored?.errorMessage) {
    status = "completed";
  }

  const inProcessRunning = Boolean(globalSync.__hikariAniListSyncActivePromise__);
  const needsStep =
    status === "running" && executionMode === "chunked" && !inProcessRunning;

  return {
    status,
    runId: stored?.runId ?? null,
    mode: stored?.mode ?? (initialCompleted ? "incremental" : "initial"),
    startedAt: stored?.startedAt ?? null,
    updatedAt: stored?.updatedAt ?? null,
    finishedAt: stored?.finishedAt ?? null,
    lastSuccessAt,
    errorMessage: stored?.errorMessage ?? null,
    incomplete: Boolean(checkpoint),
    checkpoint,
    initialCompleted,
    frequency,
    executionMode,
    needsStep,
    progress: stored?.progress ?? null,
  };
}

function getIsoNow(deps?: AniListSyncDeps): { nowMs: number; nowIso: string } {
  const date = deps?.now ? deps.now() : new Date();
  return { nowMs: date.getTime(), nowIso: date.toISOString() };
}

export async function getAniListSyncStatus(
  deps?: AniListSyncDeps,
): Promise<AniListSyncStatusSnapshot> {
  const [rawStatus, rawCheckpoint, rawInitialCompleted, rawLastTs, rawFreq] =
    await Promise.all([
      readSetting(ANILIST_SYNC_STATUS_KEY, deps),
      readSetting("anilist_sync_checkpoint", deps),
      readSetting("anilist_sync_initial_completed", deps),
      readSetting("anilist_sync_last_timestamp", deps),
      readSetting("anilist_sync_frequency", deps),
    ]);

  let stored = parseStoredStatus(rawStatus);
  const checkpoint = parseCheckpoint(rawCheckpoint);
  const initialCompleted =
    rawInitialCompleted === true || String(rawInitialCompleted) === "true";
  const lastSuccessAt = resolveLastSuccessIso(stored, rawLastTs);
  const frequency = normalizeSyncFrequency(rawFreq) as "1_per_week" | "2_per_week";
  const executionMode = resolveExecutionMode(deps);

  // Recuperação automática caso um processo serverless tenha sido encerrado sem atualizar o status
  const staleMs = deps?.staleRunningMs ?? DEFAULT_STALE_RUNNING_MS;
  const inProcessRunning = Boolean(globalSync.__hikariAniListSyncActivePromise__);

  if (stored?.status === "running" && !inProcessRunning) {
    const updatedMs = stored.updatedAt
      ? Date.parse(stored.updatedAt)
      : stored.startedAt
        ? Date.parse(stored.startedAt)
        : 0;
    const { nowMs, nowIso } = getIsoNow(deps);

    if (!Number.isFinite(updatedMs) || nowMs - updatedMs >= staleMs) {
      const lockFree = await probeAdvisoryLockFree(deps);
      if (lockFree) {
        const recovered: StoredSyncStatus = {
          ...stored,
          status: "error",
          updatedAt: nowIso,
          finishedAt: nowIso,
          lastSuccessAt,
          errorMessage:
            "A execução anterior foi interrompida ou excedeu o tempo limite do servidor. O checkpoint foi preservado para retomada.",
        };
        await writeSetting(ANILIST_SYNC_STATUS_KEY, recovered, deps);
        stored = recovered;
      }
    }
  }

  return buildSnapshot({
    stored,
    checkpoint,
    initialCompleted,
    lastSuccessAt,
    frequency,
    executionMode,
  });
}

async function executeSyncSlice(
  params: {
    runId: string;
    currentStored: StoredSyncStatus;
    timeBudgetMs: number | null;
  },
  deps?: AniListSyncDeps,
): Promise<AniListSyncStatusSnapshot> {
  const { runId, currentStored, timeBudgetMs } = params;
  const { pool, ownsPool } = await resolvePoolForSync(deps);
  let lastProgress: AniListSyncProgressInfo | null = currentStored.progress;

  try {
    const syncResult = await runSync({
      argv: ["--manual"],
      runId,
      pool,
      redis: deps?.redis,
      fetchImpl: deps?.fetchImpl,
      now: deps?.now,
      rateLimitDelayMs: deps?.rateLimitDelayMs,
      backoffBaseMs: deps?.backoffBaseMs,
      retryAfterScaleMs: deps?.retryAfterScaleMs,
      retries: deps?.retries,
      timeBudgetMs: timeBudgetMs ?? undefined,
      initialLimits: deps?.initialLimits,
      incrementalLimits: deps?.incrementalLimits,
      onProgress: async (prog: {
        mode: "initial" | "incremental";
        stage: string;
        page: number;
        seasonIndex: number;
        totalProcessed: number;
        totalInserted: number;
        totalUpdated: number;
        importedSchedulesCount: number;
      }) => {
        const { nowIso } = getIsoNow(deps);
        lastProgress = {
          stage: prog.stage,
          page: prog.page,
          seasonIndex: prog.seasonIndex,
          totalProcessed: prog.totalProcessed,
          totalInserted: prog.totalInserted,
          totalUpdated: prog.totalUpdated,
          importedSchedulesCount: prog.importedSchedulesCount,
        };
        const latest: StoredSyncStatus = {
          ...currentStored,
          status: "running",
          runId,
          mode: prog.mode,
          updatedAt: nowIso,
          errorMessage: null,
          progress: lastProgress,
        };
        await writeSetting(ANILIST_SYNC_STATUS_KEY, latest, deps);
      },
    });

    const { nowIso } = getIsoNow(deps);

    if (syncResult.status === "paused_checkpoint") {
      const pausedState: StoredSyncStatus = {
        ...currentStored,
        status: "running",
        runId,
        mode: syncResult.mode === "initial" ? "initial" : "incremental",
        updatedAt: nowIso,
        finishedAt: null,
        errorMessage: null,
        progress: {
          stage: lastProgress?.stage ?? null,
          page: lastProgress?.page ?? null,
          seasonIndex: lastProgress?.seasonIndex ?? null,
          totalProcessed: syncResult.totalProcessed ?? lastProgress?.totalProcessed ?? 0,
          totalInserted: syncResult.totalInserted ?? lastProgress?.totalInserted ?? 0,
          totalUpdated: syncResult.totalUpdated ?? lastProgress?.totalUpdated ?? 0,
          importedSchedulesCount:
            syncResult.importedSchedulesCount ?? lastProgress?.importedSchedulesCount ?? 0,
        },
      };
      await writeSetting(ANILIST_SYNC_STATUS_KEY, pausedState, deps);
    } else if (
      syncResult.status === "skipped_locked" ||
      syncResult.status === "skipped_conflict"
    ) {
      throw new AniListSyncConflictError(
        "Conflito de execução: outra sincronização AniList está ativa.",
      );
    } else {
      const completedState: StoredSyncStatus = {
        ...currentStored,
        status: "completed",
        runId,
        mode: syncResult.mode === "initial" ? "initial" : "incremental",
        updatedAt: nowIso,
        finishedAt: nowIso,
        lastSuccessAt: nowIso,
        errorMessage: null,
        progress: {
          stage: "completed",
          page: null,
          seasonIndex: null,
          totalProcessed: syncResult.totalProcessed ?? 0,
          totalInserted: syncResult.totalInserted ?? 0,
          totalUpdated: syncResult.totalUpdated ?? 0,
          importedSchedulesCount: syncResult.importedSchedulesCount ?? 0,
        },
      };
      await writeSetting(ANILIST_SYNC_STATUS_KEY, completedState, deps);
    }
  } catch (err) {
    const { nowIso } = getIsoNow(deps);
    if (err instanceof AniListSyncConflictError) {
      throw err;
    }

    const message =
      err instanceof Error
        ? err.message
        : "Falha inesperada durante a sincronização AniList.";

    const latestRaw = await readSetting(ANILIST_SYNC_STATUS_KEY, deps);
    const latestParsed = parseStoredStatus(latestRaw);
    const baseState =
      latestParsed && latestParsed.runId === runId ? latestParsed : currentStored;

    const erroredState: StoredSyncStatus = {
      ...baseState,
      status: "error",
      runId,
      updatedAt: nowIso,
      finishedAt: nowIso,
      lastSuccessAt: baseState.lastSuccessAt ?? currentStored.lastSuccessAt,
      progress: lastProgress ?? baseState.progress,
      errorMessage: message,
    };
    await writeSetting(ANILIST_SYNC_STATUS_KEY, erroredState, deps).catch(() => {});
  } finally {
    if (ownsPool) {
      await pool.end().catch(() => {});
    }
  }

  return getAniListSyncStatus(deps);
}

export async function startAniListSync(
  params: { adminId: string },
  deps?: AniListSyncDeps,
): Promise<{ accepted: true; snapshot: AniListSyncStatusSnapshot }> {
  if (globalSync.__hikariAniListSyncActivePromise__) {
    throw new AniListSyncConflictError(
      "Já existe uma sincronização AniList em execução neste servidor.",
    );
  }

  // Garante que status antigo travado seja recuperado antes da checagem de concorrência
  const preSnapshot = await getAniListSyncStatus(deps);
  if (preSnapshot.status === "running") {
    throw new AniListSyncConflictError(
      "Já existe uma sincronização AniList em andamento. Aguarde a conclusão.",
    );
  }

  const lockFree = await probeAdvisoryLockFree(deps);
  if (!lockFree) {
    throw new AniListSyncConflictError(
      "Outra sincronização AniList está ativa no banco de dados (advisory lock 849201).",
    );
  }

  const runId = crypto.randomUUID();
  const { nowIso } = getIsoNow(deps);
  const executionMode = resolveExecutionMode(deps);

  const initialState: StoredSyncStatus = {
    status: "running",
    runId,
    mode: preSnapshot.initialCompleted ? "incremental" : "initial",
    startedAt: nowIso,
    updatedAt: nowIso,
    finishedAt: null,
    lastSuccessAt: preSnapshot.lastSuccessAt,
    errorMessage: null,
    triggeredBy: params.adminId,
    progress: {
      stage: preSnapshot.checkpoint?.stage ?? (preSnapshot.initialCompleted ? "incremental" : "trending"),
      page: preSnapshot.checkpoint?.page ?? 1,
      seasonIndex: preSnapshot.checkpoint?.seasonIndex ?? 0,
      totalProcessed: 0,
      totalInserted: 0,
      totalUpdated: 0,
      importedSchedulesCount: 0,
    },
  };

  // Aquisição atômica de execução com SELECT ... FOR UPDATE em admin_settings
  const { pool, ownsPool } = await resolvePoolForSync(deps);
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");
    await client.query(
      `INSERT INTO "admin_settings" ("key", "value", "createdAt", "updatedAt")
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("key") DO NOTHING;`,
      [ANILIST_SYNC_STATUS_KEY, JSON.stringify({ status: "idle" })],
    );

    const lockedRows = await client.query<{ value: string }>(
      `SELECT "value" FROM "admin_settings" WHERE "key" = $1 FOR UPDATE;`,
      [ANILIST_SYNC_STATUS_KEY],
    );

    if (lockedRows.rows.length > 0) {
      const current = parseStoredStatus(parseAdminSettingValue(lockedRows.rows[0].value));
      const staleMs = deps?.staleRunningMs ?? DEFAULT_STALE_RUNNING_MS;
      const { nowMs } = getIsoNow(deps);
      const updatedMs = current?.updatedAt ? Date.parse(current.updatedAt) : current?.startedAt ? Date.parse(current.startedAt) : 0;
      const isStale = current?.status === "running" && Number.isFinite(updatedMs) && nowMs - updatedMs >= staleMs;

      if (current?.status === "running" && !isStale) {
        await client.query("ROLLBACK;").catch(() => {});
        throw new AniListSyncConflictError(
          "Já existe uma sincronização AniList em andamento.",
        );
      }
    }

    await client.query(
      `UPDATE "admin_settings" SET "value" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE "key" = $1;`,
      [ANILIST_SYNC_STATUS_KEY, JSON.stringify(initialState)],
    );
    await client.query("COMMIT;");
  } catch (err) {
    await client.query("ROLLBACK;").catch(() => {});
    throw err;
  } finally {
    client.release();
    if (ownsPool) {
      await pool.end().catch(() => {});
    }
  }

  if (executionMode === "background") {
    globalSync.__hikariAniListSyncRunId__ = runId;
    const bgPromise = executeSyncSlice(
      {
        runId,
        currentStored: initialState,
        timeBudgetMs: deps?.timeBudgetMs ?? null,
      },
      deps,
    ).finally(() => {
      if (globalSync.__hikariAniListSyncActivePromise__ === bgPromise) {
        globalSync.__hikariAniListSyncActivePromise__ = null;
        globalSync.__hikariAniListSyncRunId__ = null;
      }
    });
    globalSync.__hikariAniListSyncActivePromise__ = bgPromise;
  }

  const snapshot = await getAniListSyncStatus(deps);
  return {
    accepted: true,
    snapshot,
  };
}

export async function stepAniListSync(
  params?: { runId?: string | null },
  deps?: AniListSyncDeps,
): Promise<AniListSyncStatusSnapshot> {
  if (globalSync.__hikariAniListSyncActivePromise__) {
    throw new AniListSyncConflictError(
      "Uma etapa da sincronização AniList já está sendo processada.",
    );
  }

  const rawStatus = await readSetting(ANILIST_SYNC_STATUS_KEY, deps);
  const stored = parseStoredStatus(rawStatus);

  if (!stored || stored.status !== "running") {
    return getAniListSyncStatus(deps);
  }

  if (params?.runId && stored.runId && params.runId !== stored.runId) {
    throw new AniListSyncConflictError(
      "Identificador de execução divergente — outra sincronização está ativa.",
    );
  }

  const runId = stored.runId ?? crypto.randomUUID();
  const timeBudgetMs = deps?.timeBudgetMs ?? DEFAULT_VERCEL_STEP_BUDGET_MS;

  globalSync.__hikariAniListSyncRunId__ = runId;
  const stepPromise = executeSyncSlice(
    {
      runId,
      currentStored: stored,
      timeBudgetMs,
    },
    deps,
  ).finally(() => {
    if (globalSync.__hikariAniListSyncActivePromise__ === stepPromise) {
      globalSync.__hikariAniListSyncActivePromise__ = null;
      globalSync.__hikariAniListSyncRunId__ = null;
    }
  });
  globalSync.__hikariAniListSyncActivePromise__ = stepPromise;

  return stepPromise;
}
