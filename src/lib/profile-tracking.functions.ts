import { createServerFn } from "@tanstack/react-start";
import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import {
  upsertAnimeTrackingSchema,
  getMyAnimeTrackingSchema,
  getMyAnimeTrackingPaginatedSchema,
  getPublicAnimeTrackingSchema,
  getPublicAnimeTrackingPaginatedSchema,
  getAnimeTrackingByStatusSchema,
  removeAnimeTrackingSchema,
  getMyWatchedEpisodesSchema,
  markEpisodeWatchedSchema,
  unmarkEpisodeWatchedSchema,
  type UserAnimeTrackingRecord,
  type UserAnimeTrackingItem,
  type PaginatedAnimeTrackingResponse,
  type WatchedEpisodesResponse,
  type WatchedEpisodeItem,
  type AnimeSnapshot,
  type TrackingStatus,
  getAnimeUserInitialStateSchema,
  type AnimeUserInitialState,
} from "@/types/profile-tracking";
import {
  consolidateUserTrackingDuplicates,
  dedupePublicTrackingItems,
  resolveAndConsolidateTrackingTarget,
} from "@/lib/tracking-canonical";

/**
 * 1. upsertAnimeTracking — Criar ou atualizar acompanhamento de anime.
 * Operação privada vinculada exclusivamente ao context.userId.
 * Permite nota entre 0 e 10 (numeric(3,1)), episódios assistidos >= 0 e status válidos.
 */
export const upsertAnimeTracking = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(upsertAnimeTrackingSchema)
  .handler(async ({ context, data }): Promise<UserAnimeTrackingRecord> => {
    const userId = context.userId;
    const { animeId, status = "planning", score, episodesWatched, animeSnapshot, startedAt, completedAt } = data;

    const sql = await getSql();

    // 1. Resolve ID canônico e consolida duplicatas pré-existentes do mesmo anime
    const resolved = await resolveAndConsolidateTrackingTarget(
      sql,
      userId,
      animeId,
      animeSnapshot,
    );
    const targetAnimeId = resolved.canonicalAnimeId;
    const cleanSnapshot = resolved.mergedSnapshot;

    const hasScore = score !== undefined;
    const hasEpisodesWatched = episodesWatched !== undefined && episodesWatched !== null;

    // Consulta registro anterior para detectar se o progresso de episódios foi alterado
    const existingTrackingRows = await sql.query<{
      episodesWatched: number;
    }>(
      `SELECT "episodesWatched" FROM "user_anime_tracking" WHERE "userId" = $1 AND "animeId" = $2 LIMIT 1`,
      [userId, targetAnimeId],
    );
    const prevEpWatched = existingTrackingRows[0]?.episodesWatched ?? resolved.existingEpisodesWatched;

    // Tratamento coerente de datas
    let startedParam: string | null = startedAt ?? null;
    let completedParam: string | null = completedAt ?? null;

    if (status === "watching" && !startedParam) {
      startedParam = new Date().toISOString();
    } else if (status === "completed") {
      if (!completedParam) completedParam = new Date().toISOString();
      if (!startedParam) startedParam = new Date().toISOString();
    }

    const query = `
      INSERT INTO "user_anime_tracking" (
        "userId", "animeId", "status", "score", "episodesWatched", "animeSnapshot",
        "startedAt", "completedAt", "createdAt", "updatedAt"
      )
      VALUES (
        $1, $2, $3, $4, COALESCE($5, 0), $6::jsonb,
        $7::timestamptz, $8::timestamptz, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("userId", "animeId") DO UPDATE
      SET
        "status" = EXCLUDED."status",
        "score" = CASE WHEN $9::boolean = true THEN EXCLUDED."score" ELSE "user_anime_tracking"."score" END,
        "episodesWatched" = CASE WHEN $10::boolean = true THEN EXCLUDED."episodesWatched" ELSE "user_anime_tracking"."episodesWatched" END,
        "animeSnapshot" = COALESCE(EXCLUDED."animeSnapshot", "user_anime_tracking"."animeSnapshot"),
        "startedAt" = COALESCE("user_anime_tracking"."startedAt", EXCLUDED."startedAt"),
        "completedAt" = CASE
          WHEN EXCLUDED."status" = 'completed' THEN COALESCE(EXCLUDED."completedAt", "user_anime_tracking"."completedAt", CURRENT_TIMESTAMP)
          ELSE EXCLUDED."completedAt"
        END,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "userId", "animeId", "status", "score", "episodesWatched", "animeSnapshot", "startedAt", "completedAt", "createdAt", "updatedAt";
    `;

    const rows = await sql.query<{
      userId: string;
      animeId: string;
      status: TrackingStatus;
      score: string | number | null;
      episodesWatched: number;
      animeSnapshot: unknown;
      startedAt: string | null;
      completedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>(query, [
      userId,
      targetAnimeId,
      status,
      score ?? null,
      episodesWatched ?? null,
      JSON.stringify(cleanSnapshot),
      startedParam,
      completedParam,
      hasScore,
      hasEpisodesWatched,
    ]);

    const record = rows[0];
    if (!record) {
      throw new Error("Não foi possível salvar o acompanhamento do anime.");
    }

    // Se o progresso de episódios foi atualizado ou marcado com valor positivo, registra na tabela user_watched_episode
    const finalWatched = Number(record.episodesWatched) || 0;
    if (hasEpisodesWatched && finalWatched > 0 && (prevEpWatched === null || prevEpWatched !== finalWatched)) {
      try {
        const epRows = await sql.query<{ id: string }>(
          `SELECT "id" FROM "catalog_episode" WHERE "animeId" = $1 AND "number" = $2 LIMIT 1`,
          [targetAnimeId, finalWatched],
        );
        const resolvedEpId = epRows[0]?.id || `${targetAnimeId}-ep-${finalWatched}`;

        await sql.query(
          `INSERT INTO "user_watched_episode" (
            "userId", "animeId", "episodeId", "episodeNumber", "origin", "watchedAt"
          )
          VALUES ($1, $2, $3, $4, 'manual', CURRENT_TIMESTAMP)
          ON CONFLICT ("userId", "animeId", "episodeId") DO UPDATE
          SET "watchedAt" = CURRENT_TIMESTAMP, "episodeNumber" = EXCLUDED."episodeNumber", "origin" = 'manual'`,
          [userId, targetAnimeId, resolvedEpId, finalWatched],
        );
      } catch (err) {
        console.warn("Erro ao registrar episódio assistido na tabela user_watched_episode:", err);
      }
    }

    return {
      userId: record.userId,
      animeId: record.animeId,
      status: record.status,
      score: record.score !== null && record.score !== undefined ? Number(record.score) : null,
      episodesWatched: Number(record.episodesWatched) || 0,
      animeSnapshot: cleanSnapshot,
      startedAt: record.startedAt ? String(record.startedAt) : null,
      completedAt: record.completedAt ? String(record.completedAt) : null,
      createdAt: String(record.createdAt),
      updatedAt: String(record.updatedAt),
    };
  });

/**
 * 2. getMyAnimeTracking — Consultar acompanhamentos do usuário autenticado.
 * Retorna lista enriquecida com dados canônicos do catálogo ou snapshot.
 */
export const getMyAnimeTracking = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .validator(getMyAnimeTrackingSchema)
  .handler(async ({ context, data }): Promise<UserAnimeTrackingItem[]> => {
    const userId = context.userId;
    const statusFilter = data?.status ?? null;
    const animeIdFilter = data?.animeId ? data.animeId.trim() : null;
    const isMinimal = Boolean(data?.minimal);

    const sql = await getSql();

    const rawCandidateIds = [
      ...(animeIdFilter ? [animeIdFilter] : []),
      ...(data?.animeIds ?? []).map((id) => id.trim()).filter(Boolean),
    ];

    if (animeIdFilter) {
      const resolved = await resolveAndConsolidateTrackingTarget(
        sql,
        userId,
        animeIdFilter,
        data?.animeSnapshot,
      );
      rawCandidateIds.push(...resolved.candidateIds);
    }

    const uniqueCandidateIds = Array.from(new Set(rawCandidateIds));
    const animeIdsFilter =
      uniqueCandidateIds.length > 0 ? uniqueCandidateIds : null;

    if (isMinimal) {
      const rows = await sql.query<{
        userId: string;
        animeId: string;
        status: TrackingStatus;
        score: string | number | null;
        episodesWatched: number;
        startedAt: string | null;
        completedAt: string | null;
        createdAt: string;
        updatedAt: string;
      }>(
        `SELECT
           uat."userId",
           uat."animeId",
           uat."status",
           uat."score",
           uat."episodesWatched",
           uat."startedAt",
           uat."completedAt",
           uat."createdAt",
           uat."updatedAt"
         FROM "user_anime_tracking" uat
         WHERE uat."userId" = $1
           AND ($2::text IS NULL OR uat."status" = $2)
           AND ($3::text[] IS NULL OR uat."animeId" = ANY($3::text[]))
         ORDER BY uat."updatedAt" DESC;`,
        [userId, statusFilter, animeIdsFilter],
      );

      return rows.map((row) => ({
        userId: row.userId,
        animeId: row.animeId,
        status: row.status,
        score: row.score !== null && row.score !== undefined ? Number(row.score) : null,
        episodesWatched: Number(row.episodesWatched) || 0,
        title: "",
        titleRomaji: null,
        titleEnglish: null,
        titleNative: null,
        cover: null,
        banner: null,
        format: null,
        year: null,
        episodesCount: null,
        animeStatus: null,
        startedAt: row.startedAt ? String(row.startedAt) : null,
        completedAt: row.completedAt ? String(row.completedAt) : null,
        createdAt: String(row.createdAt),
        updatedAt: String(row.updatedAt),
        animeSnapshot: null,
      }));
    }

    const query = `
      SELECT
        uat."userId",
        uat."animeId",
        uat."status",
        uat."score",
        uat."episodesWatched",
        uat."animeSnapshot",
        uat."startedAt",
        uat."completedAt",
        uat."createdAt",
        uat."updatedAt",
        ca."title" AS "catalogTitle",
        ca."titleRomaji" AS "catalogTitleRomaji",
        ca."titleEnglish" AS "catalogTitleEnglish",
        ca."titleNative" AS "catalogTitleNative",
        ca."cover" AS "catalogCover",
        ca."banner" AS "catalogBanner",
        ca."format" AS "catalogFormat",
        ca."year" AS "catalogYear",
        ca."episodesCount" AS "catalogEpisodesCount",
        ca."status" AS "catalogStatus"
      FROM "user_anime_tracking" uat
      LEFT JOIN "catalog_anime" ca ON ca."id" = uat."animeId"
      WHERE uat."userId" = $1
        AND ($2::text IS NULL OR uat."status" = $2)
        AND ($3::text[] IS NULL OR uat."animeId" = ANY($3::text[]))
      ORDER BY uat."updatedAt" DESC;
    `;

    const rows = await sql.query<{
      userId: string;
      animeId: string;
      status: TrackingStatus;
      score: string | number | null;
      episodesWatched: number;
      animeSnapshot: unknown;
      startedAt: string | null;
      completedAt: string | null;
      createdAt: string;
      updatedAt: string;
      catalogTitle: string | null;
      catalogTitleRomaji: string | null;
      catalogTitleEnglish: string | null;
      catalogTitleNative: string | null;
      catalogCover: string | null;
      catalogBanner: string | null;
      catalogFormat: string | null;
      catalogYear: number | null;
      catalogEpisodesCount: number | null;
      catalogStatus: string | null;
    }>(query, [userId, statusFilter, animeIdsFilter]);

    return rows.map((row) => {
      let snapshotObj: AnimeSnapshot | null = null;
      if (row.animeSnapshot && typeof row.animeSnapshot === "object" && !Array.isArray(row.animeSnapshot)) {
        snapshotObj = row.animeSnapshot as AnimeSnapshot;
      } else if (typeof row.animeSnapshot === "string") {
        try {
          snapshotObj = JSON.parse(row.animeSnapshot) as AnimeSnapshot;
        } catch {
          snapshotObj = null;
        }
      }

      const title =
        row.catalogTitle ||
        (typeof snapshotObj?.title === "string" ? snapshotObj.title : null) ||
        "Sem título";

      const cover =
        row.catalogCover ||
        (typeof snapshotObj?.cover === "string" ? snapshotObj.cover : null);

      const banner =
        row.catalogBanner ||
        (typeof snapshotObj?.banner === "string" ? snapshotObj.banner : null);

      const format =
        row.catalogFormat ||
        (typeof snapshotObj?.format === "string" ? snapshotObj.format : null);

      const year =
        row.catalogYear !== null && row.catalogYear !== undefined
          ? Number(row.catalogYear)
          : typeof snapshotObj?.year === "number"
            ? snapshotObj.year
            : null;

      const episodesCount =
        row.catalogEpisodesCount !== null && row.catalogEpisodesCount !== undefined
          ? Number(row.catalogEpisodesCount)
          : typeof snapshotObj?.episodesCount === "number"
            ? snapshotObj.episodesCount
            : null;

      const animeStatus =
        row.catalogStatus ||
        (typeof snapshotObj?.status === "string" ? snapshotObj.status : null);

      return {
        userId: row.userId,
        animeId: row.animeId,
        status: row.status,
        score: row.score !== null && row.score !== undefined ? Number(row.score) : null,
        episodesWatched: Number(row.episodesWatched) || 0,
        title,
        titleRomaji: row.catalogTitleRomaji || snapshotObj?.titleRomaji || null,
        titleEnglish: row.catalogTitleEnglish || snapshotObj?.titleEnglish || null,
        titleNative: row.catalogTitleNative || snapshotObj?.titleNative || null,
        cover,
        banner,
        format,
        year,
        episodesCount,
        animeStatus,
        startedAt: row.startedAt ? String(row.startedAt) : null,
        completedAt: row.completedAt ? String(row.completedAt) : null,
        createdAt: String(row.createdAt),
        updatedAt: String(row.updatedAt),
        animeSnapshot: snapshotObj,
      };
    });
  });

/**
 * 2a-pub. executeGetPublicAnimeTracking & getPublicAnimeTracking — Consultar acompanhamentos
 * reais de outro perfil respeitando visibilidade da conta (pública / privada + seguidores aprovados)
 * e bloqueios mútuos, sem misturar com privacidade de listas/favoritos/histórico/comentários.
 */
export async function executeGetPublicAnimeTracking(
  sql: Sql,
  targetUserId: string,
  viewerId: string | null,
  options?: {
    status?: TrackingStatus;
    animeId?: string;
    minimal?: boolean;
  },
): Promise<UserAnimeTrackingItem[]> {
  const cleanTargetUserId = (targetUserId || "").trim();
  if (!cleanTargetUserId) {
    throw new Error("Usuário não informado.");
  }

  const { evaluateUserPrivacy } = await import("@/lib/profile.functions");
  const privacy = await evaluateUserPrivacy(sql, cleanTargetUserId, viewerId);

  if (!privacy.canViewAccount) {
    throw new Error("As estatísticas deste perfil são privadas.");
  }

  if (viewerId && viewerId !== cleanTargetUserId) {
    const blockRows = await sql.query<{ hasBlock: boolean }>(
      `SELECT exists (
        SELECT 1 FROM "user_block"
        WHERE ("blockerId" = $1 AND "blockedId" = $2)
           OR ("blockerId" = $2 AND "blockedId" = $1)
      ) AS "hasBlock"`,
      [viewerId, cleanTargetUserId],
    );
    if (blockRows[0]?.hasBlock) {
      throw new Error("Não foi possível acessar as estatísticas deste perfil.");
    }
  }

  const statusFilter = options?.status ?? null;
  const animeIdFilter = options?.animeId ? options.animeId.trim() : null;
  const isMinimal = Boolean(options?.minimal);

  if (isMinimal) {
    const rows = await sql.query<{
      userId: string;
      animeId: string;
      status: TrackingStatus;
      score: string | number | null;
      episodesWatched: number;
      startedAt: string | null;
      completedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>(
      `SELECT
         uat."userId",
         uat."animeId",
         uat."status",
         uat."score",
         uat."episodesWatched",
         uat."startedAt",
         uat."completedAt",
         uat."createdAt",
         uat."updatedAt"
       FROM "user_anime_tracking" uat
       WHERE uat."userId" = $1
         AND ($2::text IS NULL OR uat."status" = $2)
         AND ($3::text IS NULL OR uat."animeId" = $3)
       ORDER BY uat."updatedAt" DESC;`,
      [cleanTargetUserId, statusFilter, animeIdFilter],
    );

    return rows.map((row) => ({
      userId: row.userId,
      animeId: row.animeId,
      status: row.status,
      score:
        row.score !== null &&
        row.score !== undefined &&
        String(row.score).trim() !== ""
          ? Number(row.score)
          : null,
      episodesWatched: Number(row.episodesWatched) || 0,
      title: "",
      titleRomaji: null,
      titleEnglish: null,
      titleNative: null,
      cover: null,
      banner: null,
      format: null,
      year: null,
      episodesCount: null,
      animeStatus: null,
      startedAt: row.startedAt ? String(row.startedAt) : null,
      completedAt: row.completedAt ? String(row.completedAt) : null,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      animeSnapshot: null,
    }));
  }

  const query = `
    SELECT
      uat."userId",
      uat."animeId",
      uat."status",
      uat."score",
      uat."episodesWatched",
      uat."animeSnapshot",
      uat."startedAt",
      uat."completedAt",
      uat."createdAt",
      uat."updatedAt",
      ca."title" AS "catalogTitle",
      ca."titleRomaji" AS "catalogTitleRomaji",
      ca."titleEnglish" AS "catalogTitleEnglish",
      ca."titleNative" AS "catalogTitleNative",
      ca."cover" AS "catalogCover",
      ca."banner" AS "catalogBanner",
      ca."format" AS "catalogFormat",
      ca."year" AS "catalogYear",
      ca."episodesCount" AS "catalogEpisodesCount",
      ca."status" AS "catalogStatus"
    FROM "user_anime_tracking" uat
    LEFT JOIN "catalog_anime" ca ON ca."id" = uat."animeId"
    WHERE uat."userId" = $1
      AND ($2::text IS NULL OR uat."status" = $2)
      AND ($3::text IS NULL OR uat."animeId" = $3)
    ORDER BY uat."updatedAt" DESC;
  `;

  const rows = await sql.query<{
    userId: string;
    animeId: string;
    status: TrackingStatus;
    score: string | number | null;
    episodesWatched: number;
    animeSnapshot: unknown;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
    catalogTitle: string | null;
    catalogTitleRomaji: string | null;
    catalogTitleEnglish: string | null;
    catalogTitleNative: string | null;
    catalogCover: string | null;
    catalogBanner: string | null;
    catalogFormat: string | null;
    catalogYear: number | null;
    catalogEpisodesCount: number | null;
    catalogStatus: string | null;
  }>(query, [cleanTargetUserId, statusFilter, animeIdFilter]);

  const items = rows.map((row) => {
    let snapshotObj: AnimeSnapshot | null = null;
    if (
      row.animeSnapshot &&
      typeof row.animeSnapshot === "object" &&
      !Array.isArray(row.animeSnapshot)
    ) {
      snapshotObj = row.animeSnapshot as AnimeSnapshot;
    } else if (typeof row.animeSnapshot === "string") {
      try {
        snapshotObj = JSON.parse(row.animeSnapshot) as AnimeSnapshot;
      } catch {
        snapshotObj = null;
      }
    }

    const title =
      row.catalogTitle ||
      (typeof snapshotObj?.title === "string" ? snapshotObj.title : null) ||
      "Sem título";

    const cover =
      row.catalogCover ||
      (typeof snapshotObj?.cover === "string" ? snapshotObj.cover : null);

    const banner =
      row.catalogBanner ||
      (typeof snapshotObj?.banner === "string" ? snapshotObj.banner : null);

    const format =
      row.catalogFormat ||
      (typeof snapshotObj?.format === "string" ? snapshotObj.format : null);

    const year =
      row.catalogYear !== null && row.catalogYear !== undefined
        ? Number(row.catalogYear)
        : typeof snapshotObj?.year === "number"
          ? snapshotObj.year
          : null;

    const episodesCount =
      row.catalogEpisodesCount !== null && row.catalogEpisodesCount !== undefined
        ? Number(row.catalogEpisodesCount)
        : typeof snapshotObj?.episodesCount === "number"
          ? snapshotObj.episodesCount
          : null;

    const animeStatus =
      row.catalogStatus ||
      (typeof snapshotObj?.status === "string" ? snapshotObj.status : null);

    return {
      userId: row.userId,
      animeId: row.animeId,
      status: row.status,
      score:
        row.score !== null &&
        row.score !== undefined &&
        String(row.score).trim() !== ""
          ? Number(row.score)
          : null,
      episodesWatched: Number(row.episodesWatched) || 0,
      title,
      titleRomaji: row.catalogTitleRomaji || snapshotObj?.titleRomaji || null,
      titleEnglish: row.catalogTitleEnglish || snapshotObj?.titleEnglish || null,
      titleNative: row.catalogTitleNative || snapshotObj?.titleNative || null,
      cover,
      banner,
      format,
      year,
      episodesCount,
      animeStatus,
      startedAt: row.startedAt ? String(row.startedAt) : null,
      completedAt: row.completedAt ? String(row.completedAt) : null,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      animeSnapshot: snapshotObj,
    };
  });

  return animeIdFilter ? items : dedupePublicTrackingItems(items);
}

export const getPublicAnimeTracking = createServerFn({
  method: "GET",
})
  .middleware([optionalAuthMiddleware])
  .validator(getPublicAnimeTrackingSchema)
  .handler(async ({ context, data }): Promise<UserAnimeTrackingItem[]> => {
    const viewerId = context?.userId ?? null;
    const sql = await getSql();
    return executeGetPublicAnimeTracking(sql, data.userId, viewerId, {
      status: data.status,
      animeId: data.animeId,
      minimal: data.minimal,
    });
  });

/**
 * 2b. getMyAnimeTrackingPaginated — Consultar acompanhamentos com paginação real
 * no banco de dados em lotes configuráveis (padrão 24).
 * Retorna itens da página requisitada, contagens completas por status e metadados de paginação.
 */
export const getMyAnimeTrackingPaginated = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .validator(getMyAnimeTrackingPaginatedSchema)
  .handler(async ({ context, data }): Promise<PaginatedAnimeTrackingResponse> => {
    const userId = context.userId;
    const statusFilter = data?.status && data.status !== ("all" as unknown) ? data.status : null;
    const page = Math.max(1, data?.page ?? 1);
    const limit = Math.min(100, Math.max(1, data?.limit ?? 24));
    const offset = (page - 1) * limit;

    const sql = await getSql();

    if (page === 1) {
      await consolidateUserTrackingDuplicates(sql, userId);
    }

    // 1. Contagens totais agrupadas por status em uma consulta rápida única
    const countRows = await sql.query<{ status: TrackingStatus; count: number }>(
      `SELECT "status", count(*)::int AS count
       FROM "user_anime_tracking"
       WHERE "userId" = $1
       GROUP BY "status"`,
      [userId],
    );

    const counts: Record<"all" | TrackingStatus, number> = {
      all: 0,
      watching: 0,
      completed: 0,
      on_hold: 0,
      dropped: 0,
      planning: 0,
    };

    let totalAll = 0;
    for (const r of countRows) {
      if (r.status in counts) {
        const c = Number(r.count) || 0;
        counts[r.status] = c;
        totalAll += c;
      }
    }
    counts.all = totalAll;

    const currentTotal = statusFilter ? counts[statusFilter] ?? 0 : totalAll;
    const totalPages = Math.ceil(currentTotal / limit) || 1;

    // 2. Consulta paginada das obras com LIMIT e OFFSET reais na fonte de dados
    const itemsQuery = `
      SELECT
        uat."userId",
        uat."animeId",
        uat."status",
        uat."score",
        uat."episodesWatched",
        uat."animeSnapshot",
        uat."startedAt",
        uat."completedAt",
        uat."createdAt",
        uat."updatedAt",
        ca."title" AS "catalogTitle",
        ca."titleRomaji" AS "catalogTitleRomaji",
        ca."titleEnglish" AS "catalogTitleEnglish",
        ca."titleNative" AS "catalogTitleNative",
        ca."cover" AS "catalogCover",
        ca."banner" AS "catalogBanner",
        ca."format" AS "catalogFormat",
        ca."year" AS "catalogYear",
        ca."episodesCount" AS "catalogEpisodesCount",
        ca."status" AS "catalogStatus"
      FROM "user_anime_tracking" uat
      LEFT JOIN "catalog_anime" ca ON ca."id" = uat."animeId"
      WHERE uat."userId" = $1
        AND ($2::text IS NULL OR uat."status" = $2)
      ORDER BY uat."updatedAt" DESC
      LIMIT $3 OFFSET $4;
    `;

    const rows = await sql.query<{
      userId: string;
      animeId: string;
      status: TrackingStatus;
      score: string | number | null;
      episodesWatched: number;
      animeSnapshot: unknown;
      startedAt: string | null;
      completedAt: string | null;
      createdAt: string;
      updatedAt: string;
      catalogTitle: string | null;
      catalogTitleRomaji: string | null;
      catalogTitleEnglish: string | null;
      catalogTitleNative: string | null;
      catalogCover: string | null;
      catalogBanner: string | null;
      catalogFormat: string | null;
      catalogYear: number | null;
      catalogEpisodesCount: number | null;
      catalogStatus: string | null;
    }>(itemsQuery, [userId, statusFilter, limit, offset]);

    const items: UserAnimeTrackingItem[] = rows.map((row) => {
      let snapshotObj: AnimeSnapshot | null = null;
      if (row.animeSnapshot && typeof row.animeSnapshot === "object" && !Array.isArray(row.animeSnapshot)) {
        snapshotObj = row.animeSnapshot as AnimeSnapshot;
      } else if (typeof row.animeSnapshot === "string") {
        try {
          snapshotObj = JSON.parse(row.animeSnapshot) as AnimeSnapshot;
        } catch {
          snapshotObj = null;
        }
      }

      const title =
        row.catalogTitle ||
        (typeof snapshotObj?.title === "string" ? snapshotObj.title : null) ||
        "Sem título";

      const cover =
        row.catalogCover ||
        (typeof snapshotObj?.cover === "string" ? snapshotObj.cover : null);

      const banner =
        row.catalogBanner ||
        (typeof snapshotObj?.banner === "string" ? snapshotObj.banner : null);

      const format =
        row.catalogFormat ||
        (typeof snapshotObj?.format === "string" ? snapshotObj.format : null);

      const year =
        row.catalogYear !== null && row.catalogYear !== undefined
          ? Number(row.catalogYear)
          : typeof snapshotObj?.year === "number"
            ? snapshotObj.year
            : null;

      const episodesCount =
        row.catalogEpisodesCount !== null && row.catalogEpisodesCount !== undefined
          ? Number(row.catalogEpisodesCount)
          : typeof snapshotObj?.episodesCount === "number"
            ? snapshotObj.episodesCount
            : null;

      const animeStatus =
        row.catalogStatus ||
        (typeof snapshotObj?.status === "string" ? snapshotObj.status : null);

      return {
        userId: row.userId,
        animeId: row.animeId,
        status: row.status,
        score: row.score !== null && row.score !== undefined ? Number(row.score) : null,
        episodesWatched: Number(row.episodesWatched) || 0,
        title,
        titleRomaji: row.catalogTitleRomaji || snapshotObj?.titleRomaji || null,
        titleEnglish: row.catalogTitleEnglish || snapshotObj?.titleEnglish || null,
        titleNative: row.catalogTitleNative || snapshotObj?.titleNative || null,
        cover,
        banner,
        format,
        year,
        episodesCount,
        animeStatus,
        startedAt: row.startedAt ? String(row.startedAt) : null,
        completedAt: row.completedAt ? String(row.completedAt) : null,
        createdAt: String(row.createdAt),
        updatedAt: String(row.updatedAt),
        animeSnapshot: snapshotObj,
      };
    });

    const hasMore = offset + items.length < currentTotal;

    return {
      items,
      total: currentTotal,
      page,
      limit,
      totalPages,
      hasMore,
      counts,
    };
  });

/**
 * 2c-pub. executeGetPublicAnimeTrackingPaginated & getPublicAnimeTrackingPaginated —
 * Consulta paginada real no banco de dados para listas públicas de acompanhamento de outro perfil,
 * filtrando estritamente pelo userId visitado e respeitando privacidade da conta e bloqueios mútuos.
 */
export async function executeGetPublicAnimeTrackingPaginated(
  sql: Sql,
  targetUserId: string,
  viewerId: string | null,
  options?: {
    status?: TrackingStatus;
    page?: number;
    limit?: number;
  },
): Promise<PaginatedAnimeTrackingResponse> {
  const cleanTargetUserId = (targetUserId || "").trim();
  if (!cleanTargetUserId) {
    throw new Error("Usuário não informado.");
  }

  const { evaluateUserPrivacy } = await import("@/lib/profile.functions");
  const privacy = await evaluateUserPrivacy(sql, cleanTargetUserId, viewerId);

  if (!privacy.canViewAccount) {
    throw new Error("As listas de animes deste perfil são privadas.");
  }

  if (viewerId && viewerId !== cleanTargetUserId) {
    const blockRows = await sql.query<{ hasBlock: boolean }>(
      `SELECT exists (
        SELECT 1 FROM "user_block"
        WHERE ("blockerId" = $1 AND "blockedId" = $2)
           OR ("blockerId" = $2 AND "blockedId" = $1)
      ) AS "hasBlock"`,
      [viewerId, cleanTargetUserId],
    );
    if (blockRows[0]?.hasBlock) {
      throw new Error("Não foi possível acessar as listas de animes deste perfil.");
    }
  }

  const statusFilter =
    options?.status && options.status !== ("all" as unknown) ? options.status : null;
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 24));
  const offset = (page - 1) * limit;

  const countRows = await sql.query<{ status: TrackingStatus; count: number }>(
    `SELECT "status", count(*)::int AS count
     FROM "user_anime_tracking"
     WHERE "userId" = $1
     GROUP BY "status"`,
    [cleanTargetUserId],
  );

  const counts: Record<"all" | TrackingStatus, number> = {
    all: 0,
    watching: 0,
    completed: 0,
    on_hold: 0,
    dropped: 0,
    planning: 0,
  };

  let totalAll = 0;
  for (const r of countRows) {
    if (r.status in counts) {
      const c = Number(r.count) || 0;
      counts[r.status] = c;
      totalAll += c;
    }
  }
  counts.all = totalAll;

  const currentTotal = statusFilter ? counts[statusFilter] ?? 0 : totalAll;
  const totalPages = Math.ceil(currentTotal / limit) || 1;

  const itemsQuery = `
    SELECT
      uat."userId",
      uat."animeId",
      uat."status",
      uat."score",
      uat."episodesWatched",
      uat."animeSnapshot",
      uat."startedAt",
      uat."completedAt",
      uat."createdAt",
      uat."updatedAt",
      ca."title" AS "catalogTitle",
      ca."titleRomaji" AS "catalogTitleRomaji",
      ca."titleEnglish" AS "catalogTitleEnglish",
      ca."titleNative" AS "catalogTitleNative",
      ca."cover" AS "catalogCover",
      ca."banner" AS "catalogBanner",
      ca."format" AS "catalogFormat",
      ca."year" AS "catalogYear",
      ca."episodesCount" AS "catalogEpisodesCount",
      ca."status" AS "catalogStatus"
    FROM "user_anime_tracking" uat
    LEFT JOIN "catalog_anime" ca ON ca."id" = uat."animeId"
    WHERE uat."userId" = $1
      AND ($2::text IS NULL OR uat."status" = $2)
    ORDER BY uat."updatedAt" DESC
    LIMIT $3 OFFSET $4;
  `;

  const rows = await sql.query<{
    userId: string;
    animeId: string;
    status: TrackingStatus;
    score: string | number | null;
    episodesWatched: number;
    animeSnapshot: unknown;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
    catalogTitle: string | null;
    catalogTitleRomaji: string | null;
    catalogTitleEnglish: string | null;
    catalogTitleNative: string | null;
    catalogCover: string | null;
    catalogBanner: string | null;
    catalogFormat: string | null;
    catalogYear: number | null;
    catalogEpisodesCount: number | null;
    catalogStatus: string | null;
  }>(itemsQuery, [cleanTargetUserId, statusFilter, limit, offset]);

  const items: UserAnimeTrackingItem[] = rows.map((row) => {
    let snapshotObj: AnimeSnapshot | null = null;
    if (
      row.animeSnapshot &&
      typeof row.animeSnapshot === "object" &&
      !Array.isArray(row.animeSnapshot)
    ) {
      snapshotObj = row.animeSnapshot as AnimeSnapshot;
    } else if (typeof row.animeSnapshot === "string") {
      try {
        snapshotObj = JSON.parse(row.animeSnapshot) as AnimeSnapshot;
      } catch {
        snapshotObj = null;
      }
    }

    const title =
      row.catalogTitle ||
      (typeof snapshotObj?.title === "string" ? snapshotObj.title : null) ||
      "Sem título";

    const cover =
      row.catalogCover ||
      (typeof snapshotObj?.cover === "string" ? snapshotObj.cover : null);

    const banner =
      row.catalogBanner ||
      (typeof snapshotObj?.banner === "string" ? snapshotObj.banner : null);

    const format =
      row.catalogFormat ||
      (typeof snapshotObj?.format === "string" ? snapshotObj.format : null);

    const year =
      row.catalogYear !== null && row.catalogYear !== undefined
        ? Number(row.catalogYear)
        : typeof snapshotObj?.year === "number"
          ? snapshotObj.year
          : null;

    const episodesCount =
      row.catalogEpisodesCount !== null && row.catalogEpisodesCount !== undefined
        ? Number(row.catalogEpisodesCount)
        : typeof snapshotObj?.episodesCount === "number"
          ? snapshotObj.episodesCount
          : null;

    const animeStatus =
      row.catalogStatus ||
      (typeof snapshotObj?.status === "string" ? snapshotObj.status : null);

    return {
      userId: row.userId,
      animeId: row.animeId,
      status: row.status,
      score:
        row.score !== null &&
        row.score !== undefined &&
        String(row.score).trim() !== ""
          ? Number(row.score)
          : null,
      episodesWatched: Number(row.episodesWatched) || 0,
      title,
      titleRomaji: row.catalogTitleRomaji || snapshotObj?.titleRomaji || null,
      titleEnglish: row.catalogTitleEnglish || snapshotObj?.titleEnglish || null,
      titleNative: row.catalogTitleNative || snapshotObj?.titleNative || null,
      cover,
      banner,
      format,
      year,
      episodesCount,
      animeStatus,
      startedAt: row.startedAt ? String(row.startedAt) : null,
      completedAt: row.completedAt ? String(row.completedAt) : null,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      animeSnapshot: snapshotObj,
    };
  });

  const dedupedItems = dedupePublicTrackingItems(items);
  const hasMore = offset + items.length < currentTotal;

  return {
    items: dedupedItems,
    total: currentTotal,
    page,
    limit,
    totalPages,
    hasMore,
    counts,
  };
}

export const getPublicAnimeTrackingPaginated = createServerFn({
  method: "GET",
})
  .middleware([optionalAuthMiddleware])
  .validator(getPublicAnimeTrackingPaginatedSchema)
  .handler(async ({ context, data }): Promise<PaginatedAnimeTrackingResponse> => {
    const viewerId = context?.userId ?? null;
    const sql = await getSql();
    return executeGetPublicAnimeTrackingPaginated(sql, data.userId, viewerId, {
      status: data.status,
      page: data.page,
      limit: data.limit,
    });
  });

/**
 * 3. getAnimeTrackingByStatus — Consultar acompanhamentos filtrados por status.
 */
export const getAnimeTrackingByStatus = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .validator(getAnimeTrackingByStatusSchema)
  .handler(async ({ context, data }): Promise<UserAnimeTrackingItem[]> => {
    const userId = context.userId;
    const status = data.status;

    const sql = await getSql();
    await consolidateUserTrackingDuplicates(sql, userId);

    const query = `
      SELECT
        uat."userId",
        uat."animeId",
        uat."status",
        uat."score",
        uat."episodesWatched",
        uat."animeSnapshot",
        uat."startedAt",
        uat."completedAt",
        uat."createdAt",
        uat."updatedAt",
        ca."title" AS "catalogTitle",
        ca."titleRomaji" AS "catalogTitleRomaji",
        ca."titleEnglish" AS "catalogTitleEnglish",
        ca."titleNative" AS "catalogTitleNative",
        ca."cover" AS "catalogCover",
        ca."banner" AS "catalogBanner",
        ca."format" AS "catalogFormat",
        ca."year" AS "catalogYear",
        ca."episodesCount" AS "catalogEpisodesCount",
        ca."status" AS "catalogStatus"
      FROM "user_anime_tracking" uat
      LEFT JOIN "catalog_anime" ca ON ca."id" = uat."animeId"
      WHERE uat."userId" = $1
        AND uat."status" = $2
      ORDER BY uat."updatedAt" DESC;
    `;

    const rows = await sql.query<{
      userId: string;
      animeId: string;
      status: TrackingStatus;
      score: string | number | null;
      episodesWatched: number;
      animeSnapshot: unknown;
      startedAt: string | null;
      completedAt: string | null;
      createdAt: string;
      updatedAt: string;
      catalogTitle: string | null;
      catalogTitleRomaji: string | null;
      catalogTitleEnglish: string | null;
      catalogTitleNative: string | null;
      catalogCover: string | null;
      catalogBanner: string | null;
      catalogFormat: string | null;
      catalogYear: number | null;
      catalogEpisodesCount: number | null;
      catalogStatus: string | null;
    }>(query, [userId, status]);

    return rows.map((row) => {
      let snapshotObj: AnimeSnapshot | null = null;
      if (row.animeSnapshot && typeof row.animeSnapshot === "object" && !Array.isArray(row.animeSnapshot)) {
        snapshotObj = row.animeSnapshot as AnimeSnapshot;
      } else if (typeof row.animeSnapshot === "string") {
        try {
          snapshotObj = JSON.parse(row.animeSnapshot) as AnimeSnapshot;
        } catch {
          snapshotObj = null;
        }
      }

      const title =
        row.catalogTitle ||
        (typeof snapshotObj?.title === "string" ? snapshotObj.title : null) ||
        "Sem título";

      const cover =
        row.catalogCover ||
        (typeof snapshotObj?.cover === "string" ? snapshotObj.cover : null);

      const banner =
        row.catalogBanner ||
        (typeof snapshotObj?.banner === "string" ? snapshotObj.banner : null);

      const format =
        row.catalogFormat ||
        (typeof snapshotObj?.format === "string" ? snapshotObj.format : null);

      const year =
        row.catalogYear !== null && row.catalogYear !== undefined
          ? Number(row.catalogYear)
          : typeof snapshotObj?.year === "number"
            ? snapshotObj.year
            : null;

      const episodesCount =
        row.catalogEpisodesCount !== null && row.catalogEpisodesCount !== undefined
          ? Number(row.catalogEpisodesCount)
          : typeof snapshotObj?.episodesCount === "number"
            ? snapshotObj.episodesCount
            : null;

      const animeStatus =
        row.catalogStatus ||
        (typeof snapshotObj?.status === "string" ? snapshotObj.status : null);

      return {
        userId: row.userId,
        animeId: row.animeId,
        status: row.status,
        score: row.score !== null && row.score !== undefined ? Number(row.score) : null,
        episodesWatched: Number(row.episodesWatched) || 0,
        title,
        titleRomaji: row.catalogTitleRomaji || snapshotObj?.titleRomaji || null,
        titleEnglish: row.catalogTitleEnglish || snapshotObj?.titleEnglish || null,
        titleNative: row.catalogTitleNative || snapshotObj?.titleNative || null,
        cover,
        banner,
        format,
        year,
        episodesCount,
        animeStatus,
        startedAt: row.startedAt ? String(row.startedAt) : null,
        completedAt: row.completedAt ? String(row.completedAt) : null,
        createdAt: String(row.createdAt),
        updatedAt: String(row.updatedAt),
        animeSnapshot: snapshotObj,
      };
    });
  });

/**
 * 4. removeAnimeTracking — Remover acompanhamento de anime do usuário autenticado.
 */
export const removeAnimeTracking = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(removeAnimeTrackingSchema)
  .handler(async ({ context, data }): Promise<{ success: boolean; removedAnimeId: string }> => {
    const userId = context.userId;
    const { animeId } = data;

    const sql = await getSql();
    const resolved = await resolveAndConsolidateTrackingTarget(sql, userId, animeId);

    const query = `
      DELETE FROM "user_anime_tracking"
      WHERE "userId" = $1 AND "animeId" = ANY($2::text[])
      RETURNING "animeId";
    `;

    const rows = await sql.query<{ animeId: string }>(query, [userId, resolved.candidateIds]);

    if (rows.length === 0) {
      throw new Error("Acompanhamento não encontrado.");
    }

    return {
      success: true,
      removedAnimeId: rows[0].animeId,
    };
  });

/**
 * 5. getMyWatchedEpisodes — Consultar histórico paginado de episódios assistidos do usuário.
 */
export const getMyWatchedEpisodes = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .validator(getMyWatchedEpisodesSchema)
  .handler(async ({ context, data }): Promise<WatchedEpisodesResponse> => {
    const userId = context.userId;
    const animeId = data?.animeId ? data.animeId.trim() : null;
    const page = data?.page ?? 1;
    const limit = data?.limit ?? 15;
    const offset = (page - 1) * limit;

    const sql = await getSql();

    const countQuery = `
      SELECT count(*)::int AS total
      FROM "user_watched_episode"
      WHERE "userId" = $1
        AND ($2::text IS NULL OR "animeId" = $2);
    `;

    const countRows = await sql.query<{ total: number }>(countQuery, [userId, animeId]);
    const total = Number(countRows[0]?.total) || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const itemsQuery = `
      SELECT
        uwe."userId",
        uwe."animeId",
        uwe."episodeId",
        uwe."episodeNumber",
        uwe."origin",
        uwe."watchedAt",
        COALESCE(ca."title", (uat."animeSnapshot"->>'title'), 'Sem título') AS "animeTitle",
        COALESCE(ca."cover", (uat."animeSnapshot"->>'cover')) AS "animeCover"
      FROM "user_watched_episode" uwe
      LEFT JOIN "catalog_anime" ca ON ca."id" = uwe."animeId"
      LEFT JOIN "user_anime_tracking" uat ON uat."userId" = uwe."userId" AND uat."animeId" = uwe."animeId"
      WHERE uwe."userId" = $1
        AND ($2::text IS NULL OR uwe."animeId" = $2)
      ORDER BY uwe."watchedAt" DESC
      LIMIT $3 OFFSET $4;
    `;

    const rows = await sql.query<{
      userId: string;
      animeId: string;
      episodeId: string;
      episodeNumber: number;
      origin: "playback" | "manual";
      watchedAt: string;
      animeTitle: string;
      animeCover: string | null;
    }>(itemsQuery, [userId, animeId, limit, offset]);

    const items: WatchedEpisodeItem[] = rows.map((r) => ({
      userId: r.userId,
      animeId: r.animeId,
      episodeId: r.episodeId,
      episodeNumber: Number(r.episodeNumber),
      origin: r.origin,
      watchedAt: String(r.watchedAt),
      animeTitle: r.animeTitle,
      animeCover: r.animeCover ?? null,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  });

/**
 * Consultar histórico de episódios assistidos público respeitando privacidade.
 */
export const getPublicWatchedEpisodes = createServerFn({
  method: "GET",
})
  .middleware([optionalAuthMiddleware])
  .validator((d: { userId: string; page?: number; limit?: number; animeId?: string }) => d)
  .handler(async ({ context, data }): Promise<WatchedEpisodesResponse> => {
    const viewerId = context?.userId ?? null;
    const targetUserId = (data?.userId || "").trim();
    if (!targetUserId) throw new Error("Usuário não informado.");

    const sql = await getSql();
    const { evaluateUserPrivacy } = await import("@/lib/profile.functions");
    const privacy = await evaluateUserPrivacy(sql, targetUserId, viewerId);
    if (!privacy.canViewHistory) {
      throw new Error("O histórico de episódios deste perfil é privado.");
    }

    const animeId = data?.animeId ? data.animeId.trim() : null;
    const page = data?.page ?? 1;
    const limit = data?.limit ?? 15;
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT count(*)::int AS total
      FROM "user_watched_episode"
      WHERE "userId" = $1
        AND ($2::text IS NULL OR "animeId" = $2);
    `;

    const countRows = await sql.query<{ total: number }>(countQuery, [targetUserId, animeId]);
    const total = Number(countRows[0]?.total) || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const itemsQuery = `
      SELECT
        uwe."userId",
        uwe."animeId",
        uwe."episodeId",
        uwe."episodeNumber",
        uwe."origin",
        uwe."watchedAt",
        COALESCE(ca."title", (uat."animeSnapshot"->>'title'), 'Sem título') AS "animeTitle",
        COALESCE(ca."cover", (uat."animeSnapshot"->>'cover')) AS "animeCover"
      FROM "user_watched_episode" uwe
      LEFT JOIN "catalog_anime" ca ON ca."id" = uwe."animeId"
      LEFT JOIN "user_anime_tracking" uat ON uat."userId" = uwe."userId" AND uat."animeId" = uwe."animeId"
      WHERE uwe."userId" = $1
        AND ($2::text IS NULL OR uwe."animeId" = $2)
      ORDER BY uwe."watchedAt" DESC
      LIMIT $3 OFFSET $4;
    `;

    const rows = await sql.query<{
      userId: string;
      animeId: string;
      episodeId: string;
      episodeNumber: number;
      origin: "playback" | "manual";
      watchedAt: string;
      animeTitle: string;
      animeCover: string | null;
    }>(itemsQuery, [targetUserId, animeId, limit, offset]);

    const items: WatchedEpisodeItem[] = rows.map((r) => ({
      userId: r.userId,
      animeId: r.animeId,
      episodeId: r.episodeId,
      episodeNumber: Number(r.episodeNumber),
      origin: r.origin,
      watchedAt: String(r.watchedAt),
      animeTitle: r.animeTitle,
      animeCover: r.animeCover ?? null,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  });

/**
 * 6. markEpisodeWatched — Marcar manualmente um episódio como assistido.
 * Respeita a ordem global de bloqueios:
 * 1. user_anime_tracking (FOR UPDATE)
 * 2. user_episode_progress (dispensado pois não é utilizado)
 * 3. user_watched_episode (inserção com origin = 'manual')
 * 4. Atualização atômica do contador episodesWatched e status no acompanhamento.
 */
export const markEpisodeWatched = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(markEpisodeWatchedSchema)
  .handler(
    async ({
      context,
      data,
    }): Promise<{
      success: boolean;
      animeId: string;
      episodeId: string;
      episodeNumber: number;
      episodesWatched: number;
    }> => {
      const userId = context.userId;
      const { animeId, episodeId, episodeNumber, animeSnapshot } = data;

      const sql = await getSql();

      // Resolve animeId canônico e consolida duplicatas antes de registrar episódio
      const resolved = await resolveAndConsolidateTrackingTarget(
        sql,
        userId,
        animeId,
        animeSnapshot,
      );
      const targetAnimeId = resolved.canonicalAnimeId;
      const cleanSnapshot = resolved.mergedSnapshot;

      // Garante atomicamente que a linha de acompanhamento exista
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

      // Ordem rigorosa de bloqueios:
      // 1. user_anime_tracking FOR UPDATE
      // 2. Verifica estado pré-existente do episódio (evita regressão de contagem manual)
      // 3. user_watched_episode INSERT
      // 4. user_anime_tracking UPDATE do contador e status
      const atomicMarkQuery = `
        WITH tracking_lock AS (
          SELECT "userId", "animeId", "episodesWatched"
          FROM "user_anime_tracking"
          WHERE "userId" = $1 AND "animeId" = $2
          FOR UPDATE
        ),
        existing_ep AS (
          SELECT exists (
            SELECT 1 FROM "user_watched_episode"
            WHERE "userId" = $1 AND "animeId" = $2 AND "episodeId" = $3
          ) AS "wasWatched"
        ),
        watched_insert AS (
          INSERT INTO "user_watched_episode" (
            "userId", "animeId", "episodeId", "episodeNumber", "origin", "watchedAt"
          )
          SELECT tl."userId", tl."animeId", $3, $4, 'manual', CURRENT_TIMESTAMP
          FROM tracking_lock tl
          ON CONFLICT ("userId", "animeId", "episodeId") DO UPDATE
          SET "watchedAt" = CURRENT_TIMESTAMP
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
            "episodesWatched" = GREATEST(
              ec.total,
              CASE
                WHEN ee."wasWatched" = false AND ($4::int <= 0 OR $4::int > tl."episodesWatched")
                  THEN tl."episodesWatched" + 1
                ELSE tl."episodesWatched"
              END
            ),
            "status" = CASE WHEN uat."status" = 'planning' THEN 'watching' ELSE uat."status" END,
            "startedAt" = COALESCE(uat."startedAt", CURRENT_TIMESTAMP),
            "updatedAt" = CURRENT_TIMESTAMP
          FROM ep_count ec, tracking_lock tl, existing_ep ee
          WHERE uat."userId" = tl."userId" AND uat."animeId" = tl."animeId"
          RETURNING uat."episodesWatched", uat."status"
        )
        SELECT
          tl."userId",
          tl."animeId",
          $3 AS "episodeId",
          $4::int AS "episodeNumber",
          tu."episodesWatched"
        FROM tracking_lock tl
        CROSS JOIN tracking_update tu;
      `;

      const results = await sql.query<{
        userId: string;
        animeId: string;
        episodeId: string;
        episodeNumber: number;
        episodesWatched: number;
      }>(atomicMarkQuery, [userId, targetAnimeId, episodeId, episodeNumber]);

      const res = results[0];
      if (!res) {
        throw new Error("Falha ao registrar episódio como assistido.");
      }

      return {
        success: true,
        animeId: res.animeId,
        episodeId: res.episodeId,
        episodeNumber: Number(res.episodeNumber),
        episodesWatched: Number(res.episodesWatched),
      };
    },
  );

/**
 * 7. unmarkEpisodeWatched — Desmarcar manualmente um episódio do histórico.
 * Respeita a ordem global de bloqueios:
 * 1. user_anime_tracking (FOR UPDATE)
 * 2. user_episode_progress (dispensado)
 * 3. user_watched_episode (DELETE)
 * 4. Atualização atômica do contador episodesWatched no acompanhamento.
 */
export const unmarkEpisodeWatched = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(unmarkEpisodeWatchedSchema)
  .handler(
    async ({
      context,
      data,
    }): Promise<{
      success: boolean;
      animeId: string;
      episodeId: string;
      episodesWatched: number;
    }> => {
      const userId = context.userId;
      const { animeId, episodeId } = data;

      const sql = await getSql();
      const resolved = await resolveAndConsolidateTrackingTarget(sql, userId, animeId);
      const targetAnimeId = resolved.canonicalAnimeId;

      // Ordem rigorosa de bloqueios:
      // 1. user_anime_tracking FOR UPDATE
      // 3. user_watched_episode DELETE
      // 4. user_anime_tracking UPDATE do contador
      const atomicUnmarkQuery = `
        WITH tracking_lock AS (
          SELECT "userId", "animeId", "episodesWatched"
          FROM "user_anime_tracking"
          WHERE "userId" = $1 AND "animeId" = $2
          FOR UPDATE
        ),
        deleted_ep AS (
          DELETE FROM "user_watched_episode" uwe
          USING tracking_lock tl
          WHERE uwe."userId" = tl."userId"
            AND uwe."animeId" = tl."animeId"
            AND uwe."episodeId" = $3
          RETURNING uwe."episodeId"
        ),
        ep_count AS (
          SELECT count(*)::int AS total
          FROM "user_watched_episode"
          WHERE "userId" = $1 AND "animeId" = $2 AND "episodeId" != $3
        ),
        tracking_update AS (
          UPDATE "user_anime_tracking" uat
          SET
            "episodesWatched" = GREATEST(
              ec.total,
              GREATEST(0, tl."episodesWatched" - 1)
            ),
            "updatedAt" = CURRENT_TIMESTAMP
          FROM ep_count ec, tracking_lock tl, deleted_ep de
          WHERE uat."userId" = tl."userId" AND uat."animeId" = tl."animeId"
          RETURNING uat."episodesWatched"
        )
        SELECT
          tl."userId",
          tl."animeId",
          (SELECT count(*)::int FROM deleted_ep) AS "deletedCount",
          COALESCE(
            (SELECT "episodesWatched" FROM tracking_update),
            (SELECT "episodesWatched" FROM "user_anime_tracking" WHERE "userId" = $1 AND "animeId" = $2)
          ) AS "episodesWatched"
        FROM tracking_lock tl;
      `;

      const results = await sql.query<{
        userId: string;
        animeId: string;
        deletedCount: number;
        episodesWatched: number;
      }>(atomicUnmarkQuery, [userId, targetAnimeId, episodeId]);

      const res = results[0];
      if (!res || res.deletedCount === 0) {
        throw new Error("Episódio não encontrado no histórico de assistidos.");
      }

      return {
        success: true,
        animeId: res.animeId,
        episodeId,
        episodesWatched: Number(res.episodesWatched) || 0,
      };
    },
  );

/**
 * 11. fetchAnimeUserInitialState — Carrega o estado inicial do usuário para a página de detalhes
 * (acompanhamento, favoritos e continuar assistindo) em uma única chamada no loader para eliminar flash.
 */
export const fetchAnimeUserInitialState = createServerFn({
  method: "GET",
})
  .middleware([optionalAuthMiddleware])
  .validator(getAnimeUserInitialStateSchema)
  .handler(async ({ context, data }): Promise<AnimeUserInitialState | null> => {
    const userId = context.userId;
    if (!userId) {
      return null;
    }

    const sql = await getSql();
    const rawCandidateIds = [
      data.animeId,
      ...(data.candidateIds ?? []),
    ]
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter(Boolean);

    try {
      const resolved = await resolveAndConsolidateTrackingTarget(
        sql,
        userId,
        data.animeId,
      );
      if (resolved?.candidateIds?.length) {
        rawCandidateIds.push(...resolved.candidateIds);
      }
    } catch {
      // Ignora erro se registro do anime ainda não existe
    }

    const candidateIds = Array.from(new Set(rawCandidateIds));
    if (candidateIds.length === 0) {
      return null;
    }

    const titlesList = (data.titles ?? [])
      .map((t) => (typeof t === "string" ? t.toLowerCase().trim() : ""))
      .filter(Boolean);
    const normalizedTitles = new Set(titlesList);

    // 1. Busca acompanhamento em user_anime_tracking
    const trackingRows = await sql.query<{
      userId: string;
      animeId: string;
      status: TrackingStatus;
      score: string | number | null;
      episodesWatched: number;
      createdAt: string;
      updatedAt: string;
    }>(
      `SELECT
         uat."userId",
         uat."animeId",
         uat."status",
         uat."score",
         uat."episodesWatched",
         uat."createdAt",
         uat."updatedAt"
       FROM "user_anime_tracking" uat
       WHERE uat."userId" = $1
         AND (
           uat."animeId" = ANY($2::text[])
           OR ($3::text[] IS NOT NULL AND array_length($3::text[], 1) > 0 AND LOWER(TRIM(COALESCE(uat."animeSnapshot"->>'title', uat."animeSnapshot"->>'titleRomaji', uat."animeSnapshot"->>'titleEnglish', ''))) = ANY($3::text[]))
         )
       ORDER BY uat."updatedAt" DESC
       LIMIT 1;`,
      [userId, candidateIds, titlesList.length > 0 ? titlesList : null],
    );

    // 2. Busca favoritos oficiais em user_favorite
    const favoriteRows = await sql.query<{
      id: string;
      targetType: "anime" | "character" | "studio" | "company" | "person";
      targetId: string;
      title: string | null;
      nativeTitle: string | null;
    }>(
      `SELECT
         uf."id",
         uf."targetType",
         COALESCE(uf."animeId", uf."characterId", uf."studioId", uf."companyId", uf."personId") AS "targetId",
         COALESCE(ca."title", cc."name", cs."name", cco."name", cp."name") AS "title",
         COALESCE(ca."titleNative", cc."nativeName", cp."nativeName") AS "nativeTitle"
       FROM "user_favorite" uf
       LEFT JOIN "catalog_anime" ca ON uf."targetType" = 'anime' AND uf."animeId" = ca."id"
       LEFT JOIN "catalog_character" cc ON uf."targetType" = 'character' AND uf."characterId" = cc."id"
       LEFT JOIN "catalog_studio" cs ON uf."targetType" = 'studio' AND uf."studioId" = cs."id"
       LEFT JOIN "catalog_company" cco ON uf."targetType" = 'company' AND uf."companyId" = cco."id"
       LEFT JOIN "catalog_person" cp ON uf."targetType" = 'person' AND uf."personId" = cp."id"
       WHERE uf."userId" = $1;`,
      [userId],
    );

    const idsSet = new Set(candidateIds);
    const favMatch = favoriteRows.find((row) => {
      if (row.targetType !== "anime") return false;
      if (idsSet.has(row.targetId)) return true;
      const t = (row.title || "").toLowerCase().trim();
      const nt = (row.nativeTitle || "").toLowerCase().trim();
      if (t && normalizedTitles.has(t)) return true;
      if (nt && normalizedTitles.has(nt)) return true;
      return false;
    });

    const isFavorite = Boolean(favMatch);
    const favFavoriteId = favMatch?.id ?? null;

    // 3. Progresso técnico de reprodução e episódios assistidos
    const progressRows = await sql.query<{
      episodeId: string;
      episodeNumber: number;
      currentTime: number;
      duration: number | null;
      updatedAt: string;
    }>(
      `SELECT "episodeId", "episodeNumber", "currentTime", "duration", "updatedAt"
       FROM "user_episode_progress"
       WHERE "userId" = $1 AND "animeId" = ANY($2::text[])
       ORDER BY "updatedAt" DESC
       LIMIT 1;`,
      [userId, candidateIds],
    );

    const watchedRows = await sql.query<{
      episodeId: string;
      episodeNumber: number;
      watchedAt: string;
    }>(
      `SELECT "episodeId", "episodeNumber", "watchedAt"
       FROM "user_watched_episode"
       WHERE "userId" = $1 AND "animeId" = ANY($2::text[])
       ORDER BY "watchedAt" DESC;`,
      [userId, candidateIds],
    );

    let continueEpisode: { id: string; number: number } | null = null;
    if (progressRows.length > 0) {
      continueEpisode = {
        id: progressRows[0].episodeId,
        number: progressRows[0].episodeNumber,
      };
    } else if (watchedRows.length > 0) {
      continueEpisode = {
        id: watchedRows[0].episodeId,
        number: watchedRows[0].episodeNumber,
      };
    }

    const trackingRow = trackingRows[0] ?? null;

    return {
      userId,
      tracking: trackingRow
        ? {
            status: trackingRow.status,
            score:
              trackingRow.score !== null && trackingRow.score !== undefined
                ? Number(trackingRow.score)
                : null,
            episodesWatched: Number(trackingRow.episodesWatched) || 0,
            animeId: trackingRow.animeId,
            createdAt: String(trackingRow.createdAt),
            updatedAt: String(trackingRow.updatedAt),
          }
        : null,
      isFavorite,
      favFavoriteId,
      favoriteEntities: favoriteRows.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        title: r.title,
      })),
      continueEpisode,
      watchedEpisodeIds: watchedRows.map((r) => r.episodeId),
    };
  });

