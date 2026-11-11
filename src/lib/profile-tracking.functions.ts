import { createServerFn } from "@tanstack/react-start";
import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  upsertAnimeTrackingSchema,
  getMyAnimeTrackingSchema,
  getMyAnimeTrackingPaginatedSchema,
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
} from "@/types/profile-tracking";

/**
 * Normaliza e constrói o snapshot de metadados essenciais do anime.
 * Se o anime existir no catálogo canônico ("catalog_anime"), aproveita os dados oficiais.
 * Se for anime local ("local-*") ou externo, preserva o snapshot recebido do cliente.
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

    // 1. Consulta catálogo canônico (se existir) para compor snapshot
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

    const hasScore = score !== undefined;
    const hasEpisodesWatched = episodesWatched !== undefined;

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
        "startedAt" = COALESCE(EXCLUDED."startedAt", "user_anime_tracking"."startedAt"),
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
      animeId,
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

    const sql = await getSql();

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
    }>(query, [userId, statusFilter, animeIdFilter]);

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

    const query = `
      DELETE FROM "user_anime_tracking"
      WHERE "userId" = $1 AND "animeId" = $2
      RETURNING "animeId";
    `;

    const rows = await sql.query<{ animeId: string }>(query, [userId, animeId]);

    if (rows.length === 0) {
      throw new Error("Acompanhamento não encontrado.");
    }

    return {
      success: true,
      removedAnimeId: animeId,
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
    const limit = data?.limit ?? 30;
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
    const limit = data?.limit ?? 30;
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

      // Garante atomicamente que a linha de acompanhamento exista e seja obtida com lock via ON CONFLICT DO UPDATE
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

      // Ordem rigorosa de bloqueios:
      // 1. user_anime_tracking FOR UPDATE
      // 3. user_watched_episode INSERT
      // 4. user_anime_tracking UPDATE do contador e status
      const atomicMarkQuery = `
        WITH tracking_lock AS (
          SELECT "userId", "animeId"
          FROM "user_anime_tracking"
          WHERE "userId" = $1 AND "animeId" = $2
          FOR UPDATE
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
            "episodesWatched" = ec.total,
            "status" = CASE WHEN uat."status" = 'planning' THEN 'watching' ELSE uat."status" END,
            "startedAt" = COALESCE(uat."startedAt", CURRENT_TIMESTAMP),
            "updatedAt" = CURRENT_TIMESTAMP
          FROM ep_count ec, tracking_lock tl
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
      }>(atomicMarkQuery, [userId, animeId, episodeId, episodeNumber]);

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


      // Ordem rigorosa de bloqueios:
      // 1. user_anime_tracking FOR UPDATE
      // 3. user_watched_episode DELETE
      // 4. user_anime_tracking UPDATE do contador
      const atomicUnmarkQuery = `
        WITH tracking_lock AS (
          SELECT "userId", "animeId"
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
            "episodesWatched" = ec.total,
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
      }>(atomicUnmarkQuery, [userId, animeId, episodeId]);

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
