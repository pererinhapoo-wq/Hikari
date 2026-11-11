import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  startEpisodeSessionSchema,
  heartbeatEpisodeProgressSchema,
  getEpisodeProgressSchema,
  clearEpisodeProgressSchema,
  type StartEpisodeSessionInput,
  type StartEpisodeSessionResponse,
  type HeartbeatEpisodeProgressInput,
  type HeartbeatEpisodeProgressResponse,
  type GetEpisodeProgressInput,
  type EpisodeProgressRecord,
  type ClearEpisodeProgressInput,
  type ClearEpisodeProgressResponse,
} from "@/types/profile-playback";
import type { AnimeSnapshot } from "@/types/profile-tracking";

/**
 * Normaliza e constrói o snapshot de metadados essenciais do anime.
 */
function buildAnimeSnapshot(
  catalogRow: {
    title: string;
    titleRomaji: string | null;
    titleEnglish: string | null;
    titleNative: string | null;
    cover: string | null;
    banner: string | null;
    format: string | null;
    year: number | null;
    episodesCount: number | null;
    status: string | null;
  } | null,
  inputSnapshot?: AnimeSnapshot | null,
): AnimeSnapshot {
  return {
    title: catalogRow?.title ?? inputSnapshot?.title?.trim() ?? "Sem título",
    titleRomaji:
      catalogRow?.titleRomaji ?? inputSnapshot?.titleRomaji?.trim() ?? null,
    titleEnglish:
      catalogRow?.titleEnglish ?? inputSnapshot?.titleEnglish?.trim() ?? null,
    titleNative:
      catalogRow?.titleNative ?? inputSnapshot?.titleNative?.trim() ?? null,
    cover: catalogRow?.cover ?? inputSnapshot?.cover?.trim() ?? null,
    banner: catalogRow?.banner ?? inputSnapshot?.banner?.trim() ?? null,
    format: catalogRow?.format ?? inputSnapshot?.format?.trim() ?? null,
    year:
      catalogRow?.year !== undefined && catalogRow?.year !== null
        ? Number(catalogRow.year)
        : inputSnapshot?.year !== undefined && inputSnapshot?.year !== null
          ? Number(inputSnapshot.year)
          : null,
    episodesCount:
      catalogRow?.episodesCount !== undefined &&
      catalogRow?.episodesCount !== null
        ? Number(catalogRow.episodesCount)
        : inputSnapshot?.episodesCount !== undefined &&
            inputSnapshot?.episodesCount !== null
          ? Number(inputSnapshot.episodesCount)
          : null,
    status: catalogRow?.status ?? inputSnapshot?.status?.trim() ?? null,
    score:
      inputSnapshot?.score !== undefined && inputSnapshot?.score !== null
        ? Number(inputSnapshot.score)
        : null,
  };
}

/**
 * Executa o início de sessão de reprodução para um usuário autenticado.
 */
export async function executeStartEpisodeSession(
  userId: string,
  data: StartEpisodeSessionInput,
): Promise<StartEpisodeSessionResponse> {
  const { animeId, episodeId, episodeNumber, duration, animeSnapshot } = data;

  const sql = await getSql();

  // Consulta catálogo canônico para compor snapshot se existir
  const catalogRows = await sql.query<{
    title: string;
    titleRomaji: string | null;
    titleEnglish: string | null;
    titleNative: string | null;
    cover: string | null;
    banner: string | null;
    format: string | null;
    year: number | null;
    episodesCount: number | null;
    status: string | null;
  }>(
    `SELECT "title", "titleRomaji", "titleEnglish", "titleNative", "cover", "banner", "format", "year", "episodesCount", "status"
     FROM "catalog_anime" WHERE "id" = $1 LIMIT 1`,
    [animeId],
  );

  const catalogRow = catalogRows[0] ?? null;
  const cleanSnapshot = buildAnimeSnapshot(catalogRow, animeSnapshot);

  const newPlaybackSessionId = crypto.randomUUID();
  const durationParam = duration && duration > 0 ? Math.round(duration) : null;

  // 1. Garante de forma atômica e segura que o acompanhamento existe
  await sql.query(
    `INSERT INTO "user_anime_tracking" (
      "userId", "animeId", "status", "episodesWatched", "animeSnapshot", "startedAt", "createdAt", "updatedAt"
    )
    VALUES (
      $1, $2, 'watching', 0, $3::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("userId", "animeId") DO UPDATE
    SET "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "userId", "animeId";`,
    [userId, animeId, JSON.stringify(cleanSnapshot)],
  );

  // 2. Ordem estrita de bloqueios:
  // 1. user_anime_tracking (FOR UPDATE)
  // 2. user_episode_progress (UPSERT mantendo currentTime e resetando accumulatedTime/remainder)
  const atomicSessionQuery = `
    WITH tracking_lock AS (
      SELECT "userId", "animeId"
      FROM "user_anime_tracking"
      WHERE "userId" = $1 AND "animeId" = $2
      FOR UPDATE
    )
    INSERT INTO "user_episode_progress" (
      "userId", "animeId", "episodeId", "episodeNumber", "currentTime", "duration",
      "accumulatedTime", "accumulatedRemainderMs", "autoCompleteSuppressed", "playbackSessionId", "updatedAt"
    )
    SELECT
      tl."userId", tl."animeId", $3, $4, 0, $5, 0, 0, false, $6, CURRENT_TIMESTAMP
    FROM tracking_lock tl
    ON CONFLICT ("userId", "animeId", "episodeId") DO UPDATE
    SET
      "episodeNumber" = EXCLUDED."episodeNumber",
      "duration" = COALESCE(EXCLUDED."duration", "user_episode_progress"."duration"),
      "accumulatedTime" = 0,
      "accumulatedRemainderMs" = 0,
      "playbackSessionId" = EXCLUDED."playbackSessionId",
      "updatedAt" = CURRENT_TIMESTAMP,
      "currentTime" = CASE
        WHEN EXCLUDED."duration" IS NOT NULL AND "user_episode_progress"."currentTime" > EXCLUDED."duration"
        THEN EXCLUDED."duration"
        ELSE "user_episode_progress"."currentTime"
      END
    RETURNING "currentTime", "duration", "accumulatedTime", "autoCompleteSuppressed", "playbackSessionId";
  `;

  const rows = await sql.query<{
    currentTime: number;
    duration: number | null;
    accumulatedTime: number;
    autoCompleteSuppressed: boolean;
    playbackSessionId: string;
  }>(atomicSessionQuery, [
    userId,
    animeId,
    episodeId,
    episodeNumber,
    durationParam,
    newPlaybackSessionId,
  ]);

  const record = rows[0];
  if (!record) {
    throw new Error("Falha ao iniciar sessão de reprodução.");
  }

  return {
    playbackSessionId: record.playbackSessionId,
    currentTime: Number(record.currentTime) || 0,
    duration: record.duration !== null ? Number(record.duration) : null,
    accumulatedTime: Number(record.accumulatedTime) || 0,
    autoCompleteSuppressed: Boolean(record.autoCompleteSuppressed),
  };
}

/**
 * 1. startEpisodeSession — Iniciar uma sessão explícita de reprodução.
 */
export const startEpisodeSession = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(startEpisodeSessionSchema)
  .handler(async ({ context, data }): Promise<StartEpisodeSessionResponse> => {
    return executeStartEpisodeSession(context.userId, data);
  });

/**
 * Executa o heartbeat de progresso de reprodução para um usuário autenticado.
 */
export async function executeHeartbeatEpisodeProgress(
  userId: string,
  data: HeartbeatEpisodeProgressInput,
): Promise<HeartbeatEpisodeProgressResponse> {
  const {
    animeId,
    episodeId,
    playbackSessionId,
    currentTime,
    duration,
    deltaMs,
    isPlaying = true,
    isBuffering = false,
    isSeeking = false,
    animeSnapshot,
  } = data;

  const sql = await getSql();

  // Garante que o acompanhamento existe
  const catalogRows = await sql.query<{
    title: string;
    titleRomaji: string | null;
    titleEnglish: string | null;
    titleNative: string | null;
    cover: string | null;
    banner: string | null;
    format: string | null;
    year: number | null;
    episodesCount: number | null;
    status: string | null;
  }>(
    `SELECT "title", "titleRomaji", "titleEnglish", "titleNative", "cover", "banner", "format", "year", "episodesCount", "status"
     FROM "catalog_anime" WHERE "id" = $1 LIMIT 1`,
    [animeId],
  );

  const catalogRow = catalogRows[0] ?? null;
  const cleanSnapshot = buildAnimeSnapshot(catalogRow, animeSnapshot);

  await sql.query(
    `INSERT INTO "user_anime_tracking" (
      "userId", "animeId", "status", "episodesWatched", "animeSnapshot", "startedAt", "createdAt", "updatedAt"
    )
    VALUES (
      $1, $2, 'watching', 0, $3::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("userId", "animeId") DO UPDATE
    SET "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "userId", "animeId";`,
    [userId, animeId, JSON.stringify(cleanSnapshot)],
  );

  const roundCurrentTime = Math.max(0, Math.round(currentTime));
  const roundDuration = duration && duration > 0 ? Math.round(duration) : null;
  const cleanDeltaMs = deltaMs !== undefined && deltaMs !== null ? Math.max(0, Math.round(deltaMs)) : null;

  // Ordem estrita de bloqueios:
  // 1. user_anime_tracking FOR UPDATE
  // 2. user_episode_progress FOR UPDATE (validando playbackSessionId)
  // 3. user_watched_episode INSERT (somente se critérios de 90% forem atendidos)
  // 4. user_anime_tracking e user_episode_progress UPDATE
  const atomicHeartbeatQuery = `
    WITH tracking_lock AS (
      SELECT "userId", "animeId"
      FROM "user_anime_tracking"
      WHERE "userId" = $1 AND "animeId" = $2
      FOR UPDATE
    ),
    progress_lock AS (
      SELECT
        uep."userId",
        uep."animeId",
        uep."episodeId",
        uep."episodeNumber",
        uep."currentTime",
        uep."duration",
        uep."accumulatedTime",
        uep."accumulatedRemainderMs",
        uep."autoCompleteSuppressed",
        uep."playbackSessionId",
        uep."updatedAt",
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - uep."updatedAt")) * 1000 AS "serverElapsedMs"
      FROM "user_episode_progress" uep
      JOIN tracking_lock tl ON tl."userId" = uep."userId" AND tl."animeId" = uep."animeId"
      WHERE uep."episodeId" = $3
        AND uep."playbackSessionId" = $4
      FOR UPDATE
    ),
    computed_progress AS (
      SELECT
        pl."userId",
        pl."animeId",
        pl."episodeId",
        pl."episodeNumber",
        pl."autoCompleteSuppressed",
        COALESCE($6, pl."duration") AS "effectiveDuration",
        LEAST(GREATEST(0, FLOOR(pl."serverElapsedMs")::int), 15000) AS "serverAllowedMs",
        CASE
          WHEN $8::boolean = true AND $9::boolean = false AND $10::boolean = false THEN
            CASE
              WHEN $7::int IS NOT NULL THEN
                LEAST(GREATEST(0, $7::int), LEAST(GREATEST(0, FLOOR(pl."serverElapsedMs")::int), 15000))
              ELSE
                LEAST(GREATEST(0, FLOOR(pl."serverElapsedMs")::int), 15000)
            END
          ELSE 0
        END AS "effectiveDeltaMs"
      FROM progress_lock pl
    ),
    accum_calc AS (
      SELECT
        cp.*,
        (pl."accumulatedRemainderMs" + cp."effectiveDeltaMs") AS "totalMs",
        FLOOR((pl."accumulatedRemainderMs" + cp."effectiveDeltaMs") / 1000)::int AS "addedSec",
        ((pl."accumulatedRemainderMs" + cp."effectiveDeltaMs") % 1000)::int AS "newRemainderMs",
        CASE
          WHEN cp."effectiveDuration" IS NOT NULL AND cp."effectiveDuration" > 0 THEN
            LEAST(pl."accumulatedTime" + FLOOR((pl."accumulatedRemainderMs" + cp."effectiveDeltaMs") / 1000)::int, cp."effectiveDuration")
          ELSE
            pl."accumulatedTime" + FLOOR((pl."accumulatedRemainderMs" + cp."effectiveDeltaMs") / 1000)::int
        END AS "newAccumulatedTime",
        CASE
          WHEN cp."effectiveDuration" IS NOT NULL AND cp."effectiveDuration" > 0 THEN
            LEAST(GREATEST(0, $5::int), cp."effectiveDuration")
          ELSE
            GREATEST(0, $5::int)
        END AS "newCurrentTime"
      FROM computed_progress cp
      JOIN progress_lock pl ON pl."userId" = cp."userId" AND pl."animeId" = cp."animeId" AND pl."episodeId" = cp."episodeId"
    ),
    completion_check AS (
      SELECT
        ac.*,
        CASE
          WHEN ac."effectiveDuration" IS NOT NULL
            AND ac."effectiveDuration" > 0
            AND ac."autoCompleteSuppressed" = false
            AND ac."newCurrentTime" >= (0.9 * ac."effectiveDuration")
            AND ac."newAccumulatedTime" >= (0.9 * ac."effectiveDuration")
          THEN true
          ELSE false
        END AS "shouldComplete"
      FROM accum_calc ac
    ),
    progress_update AS (
      UPDATE "user_episode_progress" uep
      SET
        "currentTime" = cc."newCurrentTime",
        "duration" = cc."effectiveDuration",
        "accumulatedTime" = cc."newAccumulatedTime",
        "accumulatedRemainderMs" = cc."newRemainderMs",
        "autoCompleteSuppressed" = CASE
          WHEN cc."shouldComplete" = true THEN true
          ELSE uep."autoCompleteSuppressed"
        END,
        "updatedAt" = CURRENT_TIMESTAMP
      FROM completion_check cc
      WHERE uep."userId" = cc."userId"
        AND uep."animeId" = cc."animeId"
        AND uep."episodeId" = cc."episodeId"
      RETURNING uep."currentTime", uep."duration", uep."accumulatedTime"
    ),
    watched_insert AS (
      INSERT INTO "user_watched_episode" (
        "userId", "animeId", "episodeId", "episodeNumber", "origin", "watchedAt"
      )
      SELECT
        cc."userId", cc."animeId", cc."episodeId", cc."episodeNumber", 'playback', CURRENT_TIMESTAMP
      FROM completion_check cc
      WHERE cc."shouldComplete" = true
      ON CONFLICT ("userId", "animeId", "episodeId") DO UPDATE
      SET "watchedAt" = "user_watched_episode"."watchedAt"
      RETURNING "episodeId"
    ),
    ep_count AS (
      SELECT (count(*)::int + 1) AS total
      FROM "user_watched_episode"
      WHERE "userId" = $1 AND "animeId" = $2 AND "episodeId" != $3
    ),
    tracking_update AS (
      UPDATE "user_anime_tracking" uat
      SET
        "episodesWatched" = ec.total,
        "status" = CASE WHEN uat."status" = 'planning' THEN 'watching' ELSE uat."status" END,
        "startedAt" = COALESCE(uat."startedAt", CURRENT_TIMESTAMP),
        "updatedAt" = CURRENT_TIMESTAMP
      FROM ep_count ec, completion_check cc
      WHERE uat."userId" = cc."userId"
        AND uat."animeId" = cc."animeId"
        AND cc."shouldComplete" = true
      RETURNING uat."episodesWatched"
    )
    SELECT
      cc."userId",
      cc."animeId",
      cc."episodeId",
      pu."currentTime",
      pu."duration",
      pu."accumulatedTime",
      cc."shouldComplete" AS "completed",
      COALESCE(
        (SELECT "episodesWatched" FROM tracking_update),
        (SELECT "episodesWatched" FROM "user_anime_tracking" WHERE "userId" = cc."userId" AND "animeId" = cc."animeId")
      ) AS "episodesWatched"
    FROM completion_check cc
    JOIN progress_update pu ON true;
  `;

  const rows = await sql.query<{
    currentTime: number;
    duration: number | null;
    accumulatedTime: number;
    completed: boolean;
    episodesWatched: number | null;
  }>(atomicHeartbeatQuery, [
    userId,
    animeId,
    episodeId,
    playbackSessionId,
    roundCurrentTime,
    roundDuration,
    cleanDeltaMs,
    isPlaying,
    isBuffering,
    isSeeking,
  ]);

  const result = rows[0];
  if (!result) {
    throw new Error("Sessão de reprodução inválida ou expirada.");
  }

  return {
    success: true,
    currentTime: Number(result.currentTime) || 0,
    duration: result.duration !== null ? Number(result.duration) : null,
    accumulatedTime: Number(result.accumulatedTime) || 0,
    completed: Boolean(result.completed),
    episodesWatched: result.episodesWatched !== null ? Number(result.episodesWatched) : undefined,
  };
}

/**
 * 2. heartbeatEpisodeProgress — Atualizar periodicamente o progresso da reprodução.
 */
export const heartbeatEpisodeProgress = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(heartbeatEpisodeProgressSchema)
  .handler(async ({ context, data }): Promise<HeartbeatEpisodeProgressResponse> => {
    return executeHeartbeatEpisodeProgress(context.userId, data);
  });

/**
 * Executa a consulta de progresso de um episódio para o usuário autenticado.
 */
export async function executeGetEpisodeProgress(
  userId: string,
  data: GetEpisodeProgressInput,
): Promise<EpisodeProgressRecord | null> {
  const { animeId, episodeId } = data;

  const sql = await getSql();

  const query = `
    SELECT
      uep."userId",
      uep."animeId",
      uep."episodeId",
      uep."episodeNumber",
      uep."currentTime",
      uep."duration",
      uep."accumulatedTime",
      uep."accumulatedRemainderMs",
      uep."autoCompleteSuppressed",
      uep."playbackSessionId",
      uep."updatedAt",
      CASE WHEN uwe."episodeId" IS NOT NULL THEN true ELSE false END AS "isWatched"
    FROM "user_episode_progress" uep
    LEFT JOIN "user_watched_episode" uwe
      ON uwe."userId" = uep."userId" AND uwe."animeId" = uep."animeId" AND uwe."episodeId" = uep."episodeId"
    WHERE uep."userId" = $1 AND uep."animeId" = $2 AND uep."episodeId" = $3;
  `;

  const rows = await sql.query<{
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
    isWatched: boolean;
  }>(query, [userId, animeId, episodeId]);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    userId: row.userId,
    animeId: row.animeId,
    episodeId: row.episodeId,
    episodeNumber: Number(row.episodeNumber),
    currentTime: Number(row.currentTime) || 0,
    duration: row.duration !== null ? Number(row.duration) : null,
    accumulatedTime: Number(row.accumulatedTime) || 0,
    accumulatedRemainderMs: Number(row.accumulatedRemainderMs) || 0,
    autoCompleteSuppressed: Boolean(row.autoCompleteSuppressed),
    playbackSessionId: row.playbackSessionId,
    isWatched: Boolean(row.isWatched),
    updatedAt: String(row.updatedAt),
  };
}

/**
 * 3. getEpisodeProgress — Consultar o progresso salvo de um episódio.
 */
export const getEpisodeProgress = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .validator(getEpisodeProgressSchema)
  .handler(async ({ context, data }): Promise<EpisodeProgressRecord | null> => {
    return executeGetEpisodeProgress(context.userId, data);
  });

/**
 * Executa a limpeza do progresso salvo de um episódio para o usuário autenticado.
 */
export async function executeClearEpisodeProgress(
  userId: string,
  data: ClearEpisodeProgressInput,
): Promise<ClearEpisodeProgressResponse> {
  const { animeId, episodeId } = data;

  const sql = await getSql();

  const query = `
    DELETE FROM "user_episode_progress"
    WHERE "userId" = $1 AND "animeId" = $2 AND "episodeId" = $3
    RETURNING "episodeId";
  `;

  const rows = await sql.query<{ episodeId: string }>(query, [userId, animeId, episodeId]);

  return {
    success: true,
    cleared: rows.length > 0,
    episodeId,
  };
}

/**
 * 4. clearEpisodeProgress — Limpar o progresso salvo quando solicitado.
 */
export const clearEpisodeProgress = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(clearEpisodeProgressSchema)
  .handler(async ({ context, data }): Promise<ClearEpisodeProgressResponse> => {
    return executeClearEpisodeProgress(context.userId, data);
  });

/**
 * 5. getUserWatchedEpisodesCatalog — Retorna todos os episódios assistidos do usuário autenticado agrupados por anime.
 * Utilizado para hidratação e sincronização autoritativa no cliente.
 */
export const getUserWatchedEpisodesCatalog = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Record<string, string[]>> => {
    try {
      const sql = await getSql();
      const rows = await sql.query<{ animeId: string; episodeId: string }>(
        `SELECT "animeId", "episodeId"
         FROM "user_watched_episode"
         WHERE "userId" = $1
         ORDER BY "watchedAt" ASC;`,
        [context.userId],
      );

      const map: Record<string, string[]> = {};
      for (const r of rows) {
        if (!map[r.animeId]) {
          map[r.animeId] = [];
        }
        if (!map[r.animeId].includes(r.episodeId)) {
          map[r.animeId].push(r.episodeId);
        }
      }
      return map;
    } catch (err) {
      console.warn("[profile-playback] Falha ao consultar episódios assistidos do usuário:", err);
      return {};
    }
  });

/**
 * 6. getAnimeWatchedEpisodes — Retorna a lista autoritativa de IDs de episódios assistidos para um anime específico.
 */
export const getAnimeWatchedEpisodes = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .validator((d: unknown): { animeId: string } => {
    if (typeof d === "object" && d !== null && "animeId" in d && typeof (d as { animeId: unknown }).animeId === "string") {
      return { animeId: (d as { animeId: string }).animeId };
    }
    throw new Error("animeId é obrigatório");
  })
  .handler(async ({ context, data }): Promise<string[]> => {
    try {
      const sql = await getSql();
      const rows = await sql.query<{ episodeId: string }>(
        `SELECT "episodeId"
         FROM "user_watched_episode"
         WHERE "userId" = $1 AND "animeId" = $2
         ORDER BY "watchedAt" ASC;`,
        [context.userId, data.animeId],
      );
      return rows.map((r) => r.episodeId);
    } catch (err) {
      console.warn("[profile-playback] Falha ao consultar episódios assistidos do anime:", err);
      return [];
    }
  });
