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
import { resolveAndConsolidateTrackingTarget } from "@/lib/tracking-canonical";

/**
 * Executa o início de sessão de reprodução para um usuário autenticado.
 */
export async function executeStartEpisodeSession(
  userId: string,
  data: StartEpisodeSessionInput,
): Promise<StartEpisodeSessionResponse> {
  const { animeId, episodeId, episodeNumber, duration, animeSnapshot } = data;

  const sql = await getSql();

  // Resolve animeId canônico e consolida eventuais duplicatas existentes
  const resolved = await resolveAndConsolidateTrackingTarget(
    sql,
    userId,
    animeId,
    animeSnapshot,
  );
  const targetAnimeId = resolved.canonicalAnimeId;
  const cleanSnapshot = resolved.mergedSnapshot;

  const newPlaybackSessionId = crypto.randomUUID();
  const durationParam = duration && duration > 0 ? Math.round(duration) : null;

  // 1. Garante de forma atômica e segura que o acompanhamento existe no ID canônico
  await sql.query(
    `INSERT INTO "user_anime_tracking" (
      "userId", "animeId", "status", "episodesWatched", "animeSnapshot", "startedAt", "createdAt", "updatedAt"
    )
    VALUES (
      $1, $2, 'watching', 0, $3::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("userId", "animeId") DO UPDATE
    SET
      "animeSnapshot" = COALESCE(EXCLUDED."animeSnapshot", "user_anime_tracking"."animeSnapshot"),
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "userId", "animeId";`,
    [userId, targetAnimeId, JSON.stringify(cleanSnapshot)],
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
      "accumulatedTime" = COALESCE("user_episode_progress"."accumulatedTime", 0),
      "accumulatedRemainderMs" = COALESCE("user_episode_progress"."accumulatedRemainderMs", 0),
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
    targetAnimeId,
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
    animeId: targetAnimeId,
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
 *
 * Otimização em 3 caminhos equivalentes semanticamente à query atômica original:
 * 1. Fast path ativo (`!mightComplete && willAdvanceTime`):
 *    - Quando `roundDuration` é conhecido e `10 * roundCurrentTime < 9 * roundDuration`,
 *      é matematicamente impossível atingir o critério de 90% (`shouldComplete = false`).
 *    - Executa um único `UPDATE ... FROM "user_anime_tracking" RETURNING` sem CTEs,
 *      sem `FOR UPDATE` em `user_anime_tracking`, sem consulta a `user_watched_episode`
 *      e sem segunda leitura PK em `user_episode_progress` ou `user_anime_tracking`.
 * 2. Fast path estático (`!mightComplete && !willAdvanceTime`):
 *    - Para pausas, buffering, seek ou `deltaMs = 0` abaixo de 90%, `effectiveDeltaMs = 0`.
 *    - Mantém `FOR UPDATE OF uep` (sem bloquear `user_anime_tracking`) e só executa
 *      `UPDATE` se `currentTime` ou `duration` mudaram, evitando escrita/dead tuples no-op.
 * 3. Caminho com avaliação de conclusão (`mightComplete`):
 *    - Preserva a ordem global de bloqueios (`1. user_anime_tracking FOR UPDATE`,
 *      `2. user_episode_progress FOR UPDATE`), elimina self-join entre CTEs,
 *      só consulta `user_watched_episode` quando `shouldComplete = true`, evita
 *      `UPDATE` no-op e reutiliza `prevEpisodesWatched` sem leitura duplicada.
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
  } = data;

  const sql = await getSql();

  const targetAnimeId = animeId;

  const roundCurrentTime = Math.max(0, Math.round(currentTime));
  const roundedDuration = duration && duration > 0 ? Math.round(duration) : null;
  const roundDuration = roundedDuration && roundedDuration > 0 ? roundedDuration : null;
  const cleanDeltaMs =
    deltaMs !== undefined && deltaMs !== null ? Math.max(0, Math.round(deltaMs)) : null;

  const mightComplete =
    roundDuration === null || 10 * roundCurrentTime >= 9 * roundDuration;
  const willAdvanceTime =
    isPlaying === true &&
    isBuffering === false &&
    isSeeking === false &&
    (cleanDeltaMs === null || cleanDeltaMs > 0);

  type HeartbeatRow = {
    currentTime: number;
    duration: number | null;
    accumulatedTime: number;
    completed: boolean;
    episodesWatched: number | null;
  };

  let rows: HeartbeatRow[];

  if (!mightComplete && willAdvanceTime && roundDuration !== null) {
    const fastActiveHeartbeatQuery = `
      UPDATE "user_episode_progress" uep
      SET
        "currentTime" = LEAST(GREATEST(0, $5::int), $6::int),
        "duration" = $6::int,
        "accumulatedTime" = LEAST(
          uep."accumulatedTime" + FLOOR((
            uep."accumulatedRemainderMs" +
            CASE
              WHEN $7::int IS NOT NULL THEN
                LEAST(
                  GREATEST(0, $7::int),
                  LEAST(GREATEST(0::bigint, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - uep."updatedAt")) * 1000)::bigint), 40000::bigint)::int
                )
              ELSE
                LEAST(GREATEST(0::bigint, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - uep."updatedAt")) * 1000)::bigint), 40000::bigint)::int
            END
          ) / 1000)::int,
          $6::int
        ),
        "accumulatedRemainderMs" = ((
          uep."accumulatedRemainderMs" +
          CASE
            WHEN $7::int IS NOT NULL THEN
              LEAST(
                GREATEST(0, $7::int),
                LEAST(GREATEST(0::bigint, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - uep."updatedAt")) * 1000)::bigint), 40000::bigint)::int
              )
            ELSE
              LEAST(GREATEST(0::bigint, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - uep."updatedAt")) * 1000)::bigint), 40000::bigint)::int
          END
        ) % 1000)::int,
        "updatedAt" = CURRENT_TIMESTAMP
      FROM "user_anime_tracking" uat
      WHERE uep."userId" = $1
        AND uep."animeId" = $2
        AND uep."episodeId" = $3
        AND uep."playbackSessionId" = $4
        AND uat."userId" = uep."userId"
        AND uat."animeId" = uep."animeId"
      RETURNING
        uep."currentTime",
        uep."duration",
        uep."accumulatedTime",
        false AS "completed",
        uat."episodesWatched";
    `;

    rows = await sql.query<HeartbeatRow>(fastActiveHeartbeatQuery, [
      userId,
      targetAnimeId,
      episodeId,
      playbackSessionId,
      roundCurrentTime,
      roundDuration,
      cleanDeltaMs,
    ]);
  } else if (!mightComplete && roundDuration !== null) {
    const fastStaticHeartbeatQuery = `
      WITH progress_lock AS (
        SELECT
          uep."userId",
          uep."animeId",
          uep."episodeId",
          uep."currentTime" AS "oldCurrentTime",
          uep."duration" AS "oldDuration",
          uep."accumulatedTime" AS "oldAccumulatedTime",
          uat."episodesWatched",
          LEAST(GREATEST(0, $5::int), $6::int) AS "newCurrentTime"
        FROM "user_episode_progress" uep
        INNER JOIN "user_anime_tracking" uat
          ON uat."userId" = uep."userId" AND uat."animeId" = uep."animeId"
        WHERE uep."userId" = $1
          AND uep."animeId" = $2
          AND uep."episodeId" = $3
          AND uep."playbackSessionId" = $4
        FOR UPDATE OF uep
      ),
      progress_update AS (
        UPDATE "user_episode_progress" uep
        SET
          "currentTime" = pl."newCurrentTime",
          "duration" = $6::int,
          "updatedAt" = CURRENT_TIMESTAMP
        FROM progress_lock pl
        WHERE uep."userId" = pl."userId"
          AND uep."animeId" = pl."animeId"
          AND uep."episodeId" = pl."episodeId"
          AND (
            uep."currentTime" IS DISTINCT FROM pl."newCurrentTime"
            OR uep."duration" IS DISTINCT FROM $6::int
          )
        RETURNING uep."currentTime", uep."duration", uep."accumulatedTime"
      )
      SELECT
        COALESCE(pu."currentTime", pl."oldCurrentTime") AS "currentTime",
        COALESCE(pu."duration", pl."oldDuration") AS "duration",
        COALESCE(pu."accumulatedTime", pl."oldAccumulatedTime") AS "accumulatedTime",
        false AS "completed",
        pl."episodesWatched"
      FROM progress_lock pl
      LEFT JOIN progress_update pu ON true;
    `;

    rows = await sql.query<HeartbeatRow>(fastStaticHeartbeatQuery, [
      userId,
      targetAnimeId,
      episodeId,
      playbackSessionId,
      roundCurrentTime,
      roundDuration,
    ]);
  } else {
    // Ordem estrita de bloqueios:
    // 1. user_anime_tracking FOR UPDATE
    // 2. user_episode_progress FOR UPDATE (validando playbackSessionId)
    // 3. user_watched_episode INSERT (somente se critérios de 90% forem atendidos)
    // 4. user_anime_tracking e user_episode_progress UPDATE (apenas quando necessário)
    const atomicHeartbeatQuery = `
      WITH tracking_lock AS (
        SELECT "userId", "animeId", "episodesWatched"
        FROM "user_anime_tracking"
        WHERE "userId" = $1 AND "animeId" = $2
        FOR UPDATE
      ),
      progress_calc AS (
        SELECT
          uep."userId",
          uep."animeId",
          uep."episodeId",
          uep."episodeNumber",
          uep."currentTime" AS "oldCurrentTime",
          uep."duration" AS "oldDuration",
          uep."accumulatedTime" AS "oldAccumulatedTime",
          uep."accumulatedRemainderMs" AS "oldRemainderMs",
          uep."autoCompleteSuppressed",
          tl."episodesWatched" AS "prevEpisodesWatched",
          COALESCE($6::int, uep."duration") AS "effectiveDuration",
          CASE
            WHEN COALESCE($6::int, uep."duration") IS NOT NULL AND COALESCE($6::int, uep."duration") > 0 THEN
              LEAST(GREATEST(0, $5::int), COALESCE($6::int, uep."duration"))
            ELSE
              GREATEST(0, $5::int)
          END AS "newCurrentTime",
          CASE
            WHEN $8::boolean = true AND $9::boolean = false AND $10::boolean = false THEN
              CASE
                WHEN $7::int IS NOT NULL THEN
                  LEAST(
                    GREATEST(0, $7::int),
                    LEAST(GREATEST(0::bigint, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - uep."updatedAt")) * 1000)::bigint), 40000::bigint)::int
                  )
                ELSE
                  LEAST(GREATEST(0::bigint, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - uep."updatedAt")) * 1000)::bigint), 40000::bigint)::int
              END
            ELSE 0
          END AS "effectiveDeltaMs"
        FROM "user_episode_progress" uep
        INNER JOIN tracking_lock tl
          ON tl."userId" = uep."userId" AND tl."animeId" = uep."animeId"
        WHERE uep."episodeId" = $3
          AND uep."playbackSessionId" = $4
        FOR UPDATE OF uep
      ),
      completion_check AS (
        SELECT
          pc.*,
          ((pc."oldRemainderMs" + pc."effectiveDeltaMs") % 1000)::int AS "newRemainderMs",
          CASE
            WHEN pc."effectiveDuration" IS NOT NULL AND pc."effectiveDuration" > 0 THEN
              LEAST(
                pc."oldAccumulatedTime" + FLOOR((pc."oldRemainderMs" + pc."effectiveDeltaMs") / 1000)::int,
                pc."effectiveDuration"
              )
            ELSE
              pc."oldAccumulatedTime" + FLOOR((pc."oldRemainderMs" + pc."effectiveDeltaMs") / 1000)::int
          END AS "newAccumulatedTime",
          (
            pc."effectiveDuration" IS NOT NULL
            AND pc."effectiveDuration" > 0
            AND pc."autoCompleteSuppressed" = false
            AND pc."newCurrentTime" >= (0.9 * pc."effectiveDuration")
            AND (
              CASE
                WHEN pc."effectiveDuration" IS NOT NULL AND pc."effectiveDuration" > 0 THEN
                  LEAST(
                    pc."oldAccumulatedTime" + FLOOR((pc."oldRemainderMs" + pc."effectiveDeltaMs") / 1000)::int,
                    pc."effectiveDuration"
                  )
                ELSE
                  pc."oldAccumulatedTime" + FLOOR((pc."oldRemainderMs" + pc."effectiveDeltaMs") / 1000)::int
              END
            ) >= (0.9 * pc."effectiveDuration")
          ) AS "shouldComplete"
        FROM progress_calc pc
      ),
      progress_update AS (
        UPDATE "user_episode_progress" uep
        SET
          "currentTime" = cc."newCurrentTime",
          "duration" = cc."effectiveDuration",
          "accumulatedTime" = cc."newAccumulatedTime",
          "accumulatedRemainderMs" = cc."newRemainderMs",
          "autoCompleteSuppressed" = CASE
            WHEN cc."shouldComplete" THEN true
            ELSE uep."autoCompleteSuppressed"
          END,
          "updatedAt" = CURRENT_TIMESTAMP
        FROM completion_check cc
        WHERE uep."userId" = cc."userId"
          AND uep."animeId" = cc."animeId"
          AND uep."episodeId" = cc."episodeId"
          AND (
            cc."shouldComplete"
            OR uep."currentTime" IS DISTINCT FROM cc."newCurrentTime"
            OR uep."duration" IS DISTINCT FROM cc."effectiveDuration"
            OR uep."accumulatedTime" IS DISTINCT FROM cc."newAccumulatedTime"
            OR uep."accumulatedRemainderMs" IS DISTINCT FROM cc."newRemainderMs"
          )
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
        ON CONFLICT ("userId", "animeId", "episodeId") DO NOTHING
        RETURNING "episodeId"
      ),
      tracking_update AS (
        UPDATE "user_anime_tracking" uat
        SET
          "episodesWatched" = (
            SELECT GREATEST(
              (count(*) FILTER (WHERE uwe."episodeId" != cc."episodeId"))::int + 1,
              CASE
                WHEN NOT COALESCE(bool_or(uwe."episodeId" = cc."episodeId"), false)
                  AND (cc."episodeNumber" <= 0 OR cc."episodeNumber" > cc."prevEpisodesWatched")
                  THEN cc."prevEpisodesWatched" + 1
                ELSE cc."prevEpisodesWatched"
              END
            )
            FROM "user_watched_episode" uwe
            WHERE uwe."userId" = cc."userId"
              AND uwe."animeId" = cc."animeId"
          ),
          "status" = CASE WHEN uat."status" = 'planning' THEN 'watching' ELSE uat."status" END,
          "startedAt" = COALESCE(uat."startedAt", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP
        FROM completion_check cc
        WHERE uat."userId" = cc."userId"
          AND uat."animeId" = cc."animeId"
          AND cc."shouldComplete" = true
        RETURNING uat."episodesWatched"
      )
      SELECT
        COALESCE(pu."currentTime", cc."oldCurrentTime") AS "currentTime",
        COALESCE(pu."duration", cc."oldDuration") AS "duration",
        COALESCE(pu."accumulatedTime", cc."oldAccumulatedTime") AS "accumulatedTime",
        cc."shouldComplete" AS "completed",
        COALESCE(
          (SELECT "episodesWatched" FROM tracking_update),
          cc."prevEpisodesWatched"
        ) AS "episodesWatched"
      FROM completion_check cc
      LEFT JOIN progress_update pu ON true;
    `;

    rows = await sql.query<HeartbeatRow>(atomicHeartbeatQuery, [
      userId,
      targetAnimeId,
      episodeId,
      playbackSessionId,
      roundCurrentTime,
      roundDuration,
      cleanDeltaMs,
      isPlaying,
      isBuffering,
      isSeeking,
    ]);
  }

  const result = rows[0];
  if (!result) {
    throw new Error("Sessão de reprodução inválida ou expirada.");
  }

  return {
    success: true,
    animeId: targetAnimeId,
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
  const resolved = await resolveAndConsolidateTrackingTarget(sql, userId, animeId);

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
    WHERE uep."userId" = $1 AND uep."animeId" = ANY($2::text[]) AND uep."episodeId" = $3
    ORDER BY uep."updatedAt" DESC
    LIMIT 1;
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
  }>(query, [userId, resolved.candidateIds, episodeId]);

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
  const resolved = await resolveAndConsolidateTrackingTarget(sql, userId, animeId);

  const query = `
    DELETE FROM "user_episode_progress"
    WHERE "userId" = $1 AND "animeId" = ANY($2::text[]) AND "episodeId" = $3
    RETURNING "episodeId";
  `;

  const rows = await sql.query<{ episodeId: string }>(query, [userId, resolved.candidateIds, episodeId]);

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
  .validator((d: unknown): { animeId: string; candidateIds?: string[] } => {
    if (typeof d === "object" && d !== null && "animeId" in d && typeof (d as { animeId: unknown }).animeId === "string") {
      const candidateIds =
        "candidateIds" in d && Array.isArray((d as { candidateIds?: unknown }).candidateIds)
          ? (d as { candidateIds: unknown[] }).candidateIds
              .filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
              .slice(0, 20)
          : undefined;
      return { animeId: (d as { animeId: string }).animeId, candidateIds };
    }
    throw new Error("animeId é obrigatório");
  })
  .handler(async ({ context, data }): Promise<string[]> => {
    try {
      const sql = await getSql();
      const resolved = await resolveAndConsolidateTrackingTarget(sql, context.userId, data.animeId);
      const allIds = Array.from(
        new Set([...resolved.candidateIds, ...(data.candidateIds ?? [])]),
      );
      const rows = await sql.query<{ episodeId: string }>(
        `SELECT DISTINCT "episodeId"
         FROM "user_watched_episode"
         WHERE "userId" = $1 AND "animeId" = ANY($2::text[])`,
        [context.userId, allIds],
      );
      return rows.map((r) => r.episodeId);
    } catch (err) {
      console.warn("[profile-playback] Falha ao consultar episódios assistidos do anime:", err);
      return [];
    }
  });
