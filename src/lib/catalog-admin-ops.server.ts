import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { invalidateCatalogEpisodesCacheAsync } from "@/lib/catalog-episodes";
import { invalidateHomePublicEpisodesCacheAsync } from "@/lib/home-episodes";
import { invalidateServerCatalogCachesAsync } from "@/lib/api";
import { stripCatalogImageVersion } from "@/lib/image-utils";
import { resolveCatalogAnimeMediaWrite } from "@/lib/types";
import { deleteAnimeRecentBadgesFromDb } from "@/lib/catalog-badges";
import { invalidatePublicVisibilityCache } from "@/lib/public-visibility.server";
import { normalizeCountryOfOrigin } from "@/lib/public-visibility";
import type { RedisEvalClient } from "@/lib/redis";
import {
  discoverMatchingOrphanIdsFromUserTables,
  findCanonicalCatalogAnime,
  findMatchingTombstoneAliases,
  getAllAliasIdsForCanonical,
  inferIsDubbedFromTitles,
  mergeEpisodeHistory,
  normalizeIdentityTitle,
  parseEpisodeHistoryArray,
  reconcileAnimeIdentityReferences,
  resolveReregistrationTargetId,
  rowIsDubbed,
  snapshotCatalogEpisodesMap,
  upsertAliasMapping,
  type CatalogAnimeIdentityRow,
  type EpisodeHistoryEntry,
} from "@/lib/anime-identity";

export const seasonItemSchema = z.object({
  number: z.number().int().min(1, "number da temporada deve ser >= 1"),
  title: z.string().max(255).optional().nullable(),
  position: z.number().int().min(0).optional().nullable(),
});

export const animeAdminPostSchema = z.object({
  id: z.string().trim().min(1, "id é obrigatório").max(128, "id muito longo"),
  title: z.string().max(255).optional().nullable(),
  titleRomaji: z.string().max(255).optional().nullable(),
  titleEnglish: z.string().max(255).optional().nullable(),
  titleNative: z.string().max(255).optional().nullable(),
  cover: z.string().max(2048).optional().nullable(),
  banner: z.string().max(2048).optional().nullable(),
  coverExplicitlyEdited: z.boolean().optional(),
  bannerExplicitlyEdited: z.boolean().optional(),
  synopsis: z.string().max(10000).optional().nullable(),
  format: z.string().max(32).optional().nullable(),
  status: z.string().max(32).optional().nullable(),
  episodesCount: z.number().int().min(0).optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  season: z.string().max(32).optional().nullable(),
  genres: z.array(z.string().max(64)).optional().nullable(),
  trailerId: z.string().max(128).optional().nullable(),
  anilistId: z.number().int().optional().nullable(),
  malId: z.number().int().optional().nullable(),
  kitsuId: z.number().int().optional().nullable(),
  hidden: z.boolean().default(false).optional(),
  score: z.number().int().min(0).max(100).optional().nullable(),
  recentBadges: z
    .object({
      lancamento: z.boolean(),
      novo: z.boolean(),
      final: z.boolean(),
    })
    .optional()
    .nullable(),
  badgesExplicitlyEdited: z.boolean().optional(),
  countryOfOrigin: z.string().max(16).optional().nullable(),
  duplicateOfId: z.string().max(128).optional().nullable(),
  seasons: z.array(seasonItemSchema).optional().nullable(),
});

export type AdminCatalogAnimeUpsertInput = z.infer<typeof animeAdminPostSchema>;

export function sanitizeAdminCatalogImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("blob:")) {
    throw new Error("URLs com esquema temporário 'blob:' não são permitidas.");
  }
  if (lower.startsWith("data:") && trimmed.length > 2048) {
    throw new Error("Data URLs em Base64 excedem o limite de 2048 caracteres.");
  }
  return stripCatalogImageVersion(trimmed);
}

export async function executeAdminUpsertCatalogAnime(
  data: AdminCatalogAnimeUpsertInput,
  options?: { redisOverride?: RedisEvalClient | null },
): Promise<{
  animeId: string;
  reusedOriginalId: boolean;
  matchedBy: string;
  aliases: string[];
  cover: string | null;
  banner: string | null;
  updatedAt: number;
}> {
  const cleanCover = sanitizeAdminCatalogImageUrl(data.cover);
  const cleanBanner = sanitizeAdminCatalogImageUrl(data.banner);

  const canonicalTitle =
    data.title?.trim() ||
    data.titleRomaji?.trim() ||
    data.titleEnglish?.trim() ||
    data.titleNative?.trim() ||
    data.id;

  const genresArray = Array.isArray(data.genres)
    ? data.genres.map((g) => g.trim()).filter(Boolean)
    : null;

  const incomingIsDubbed = Boolean(
    inferIsDubbedFromTitles({
      title: canonicalTitle,
      titleRomaji: data.titleRomaji,
      titleEnglish: data.titleEnglish,
      titleNative: data.titleNative,
    }),
  );

  const manualFields: string[] = [];
  if (data.title !== undefined && data.title !== null && data.title.trim() !== "") {
    manualFields.push("title");
  }
  if (data.synopsis !== undefined && data.synopsis !== null && data.synopsis.trim() !== "") {
    manualFields.push("synopsis");
  }
  if (data.titleRomaji !== undefined && data.titleRomaji !== null && data.titleRomaji.trim() !== "") {
    manualFields.push("titleRomaji");
  }
  if (data.titleEnglish !== undefined && data.titleEnglish !== null && data.titleEnglish.trim() !== "") {
    manualFields.push("titleEnglish");
  }
  if (data.titleNative !== undefined && data.titleNative !== null && data.titleNative.trim() !== "") {
    manualFields.push("titleNative");
  }
  if (data.coverExplicitlyEdited) {
    manualFields.push("cover");
  }
  if (data.bannerExplicitlyEdited) {
    manualFields.push("banner");
  }

  const txResult = await withTransaction(async (tx) => {
    // 1. Resolver identidade canônica / reutilização segura de ID original em recadastro
    const reregResolution = await resolveReregistrationTargetId(tx, {
      requestedId: data.id,
      id: data.id,
      anilistId: data.anilistId ?? null,
      malId: data.malId ?? null,
      kitsuId: data.kitsuId ?? null,
      title: canonicalTitle,
      titleRomaji: data.titleRomaji,
      titleEnglish: data.titleEnglish,
      titleNative: data.titleNative,
      format: data.format,
      year: data.year,
      isDubbed: incomingIsDubbed,
    });
    const targetId = reregResolution.targetId || data.id;

    // Buscar linhas existentes (ativas OU arquivadas) para targetId, data.id ou IDs externos
    const existingRows = await tx.query<CatalogAnimeIdentityRow>(
      `SELECT "id", "title", "titleRomaji", "titleEnglish", "titleNative",
              "anilistId", "malId", "kitsuId", "format", "year",
              "cover", "banner", "synopsis", "status", "episodesCount", "season",
              "hidden", "archived_at", "episode_history"
       FROM "catalog_anime"
       WHERE "id" = $1
          OR "id" = $5
          OR ($2::int IS NOT NULL AND "anilistId" = $2)
          OR ($3::int IS NOT NULL AND "malId" = $3)
          OR ($4::int IS NOT NULL AND "kitsuId" = $4);`,
      [targetId, data.anilistId ?? null, data.malId ?? null, data.kitsuId ?? null, data.id],
    );

    const activeRows = existingRows.filter((r) => !r.archived_at);

    // Proteger unicidade entre registros ATIVOS diferentes (ex.: versão dublada separada)
    let resolvedAnilistId = data.anilistId ?? null;
    let resolvedMalId = data.malId ?? null;
    let resolvedKitsuId = data.kitsuId ?? null;

    for (const r of activeRows) {
      if (r.id === targetId) continue;
      if (resolvedAnilistId !== null && r.anilistId === resolvedAnilistId) {
        resolvedAnilistId = null;
      }
      if (resolvedMalId !== null && r.malId === resolvedMalId) {
        resolvedMalId = null;
      }
      if (resolvedKitsuId !== null && r.kitsuId === resolvedKitsuId) {
        resolvedKitsuId = null;
      }
    }

    // Liberar constraints UNIQUE em quaisquer registros ARQUIVADOS antigos que ainda
    // possam segurar os mesmos IDs externos antes de inserir/atualizar targetId.
    if (resolvedAnilistId !== null) {
      await tx.query(
        `UPDATE "catalog_anime"
         SET "anilistId" = NULL
         WHERE "id" <> $1 AND "archived_at" IS NOT NULL AND "anilistId" = $2;`,
        [targetId, resolvedAnilistId],
      );
    }
    if (resolvedMalId !== null) {
      await tx.query(
        `UPDATE "catalog_anime"
         SET "malId" = NULL
         WHERE "id" <> $1 AND "archived_at" IS NOT NULL AND "malId" = $2;`,
        [targetId, resolvedMalId],
      );
    }
    if (resolvedKitsuId !== null) {
      await tx.query(
        `UPDATE "catalog_anime"
         SET "kitsuId" = NULL
         WHERE "id" <> $1 AND "archived_at" IS NOT NULL AND "kitsuId" = $2;`,
        [targetId, resolvedKitsuId],
      );
    }

    const previousRow = existingRows.find((r) => r.id === targetId) ?? null;
    const targetExists = previousRow !== null;

    // Descobrir tombstones históricos (aliases com current_id IS NULL) e referências órfãs legadas
    const matchingTombstones = await findMatchingTombstoneAliases(tx, {
      id: data.id,
      anilistId: resolvedAnilistId,
      malId: resolvedMalId,
      kitsuId: resolvedKitsuId,
      title: canonicalTitle,
      titleRomaji: data.titleRomaji,
      titleEnglish: data.titleEnglish,
      titleNative: data.titleNative,
      format: data.format,
      year: data.year,
      isDubbed: incomingIsDubbed,
    });

    const legacyOrphanIds = await discoverMatchingOrphanIdsFromUserTables(tx, {
      canonicalId: targetId,
      anilistId: resolvedAnilistId,
      malId: resolvedMalId,
      kitsuId: resolvedKitsuId,
      title: canonicalTitle,
      titleRomaji: data.titleRomaji,
      titleEnglish: data.titleEnglish,
      titleNative: data.titleNative,
      format: data.format,
      year: data.year,
      isDubbed: incomingIsDubbed,
    });

    let mergedEpisodeHistory: EpisodeHistoryEntry[] = mergeEpisodeHistory(
      parseEpisodeHistoryArray(previousRow?.episode_history),
      reregResolution.mergedEpisodeHistory,
    );
    for (const tomb of matchingTombstones) {
      mergedEpisodeHistory = mergeEpisodeHistory(
        mergedEpisodeHistory,
        parseEpisodeHistoryArray(tomb.episode_history),
      );
    }
    for (const row of existingRows) {
      if (row.archived_at && row.id !== targetId) {
        mergedEpisodeHistory = mergeEpisodeHistory(
          mergedEpisodeHistory,
          parseEpisodeHistoryArray(row.episode_history),
        );
      }
    }

    const mediaWrite = resolveCatalogAnimeMediaWrite({
      cover: data.cover,
      banner: data.banner,
      coverExplicitlyEdited: data.coverExplicitlyEdited,
      bannerExplicitlyEdited: data.bannerExplicitlyEdited,
      targetExists,
      cleanCover,
      cleanBanner,
    });
    const hiddenProvided = data.hidden !== undefined && data.hidden !== null;
    const scoreProvided = data.score !== undefined && data.score !== null;

    const normTitle = normalizeIdentityTitle(canonicalTitle);
    const searchBlob = [
      canonicalTitle,
      data.titleRomaji?.trim() ?? "",
      data.titleEnglish?.trim() ?? "",
      data.titleNative?.trim() ?? "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const normalizedCountryOfOrigin = normalizeCountryOfOrigin(
      data.countryOfOrigin,
    );
    const cleanDuplicateOfId =
      typeof data.duplicateOfId === "string" && data.duplicateOfId.trim()
        ? data.duplicateOfId.trim()
        : null;

    let hasCountryOfOriginCol = true;
    let hasDuplicateOfIdCol = true;
    try {
      const colCheck = await tx.query<{ column_name: string }>(
        `SELECT "column_name"
         FROM "information_schema"."columns"
         WHERE "table_name" = 'catalog_anime'
           AND "column_name" IN ('country_of_origin', 'duplicate_of_id');`,
      );
      if (colCheck.length > 0) {
        const presentCols = new Set(colCheck.map((r) => r.column_name));
        hasCountryOfOriginCol = presentCols.has("country_of_origin");
        hasDuplicateOfIdCol = presentCols.has("duplicate_of_id");
      } else {
        hasCountryOfOriginCol = false;
        hasDuplicateOfIdCol = false;
      }
    } catch {
      hasCountryOfOriginCol = false;
      hasDuplicateOfIdCol = false;
    }

    const visibilityInsertCols: string[] = [];
    const visibilityInsertVals: string[] = [];
    const visibilityUpdates: string[] = [];
    const upsertParams: unknown[] = [
      targetId,
      canonicalTitle,
      resolvedAnilistId,
      resolvedMalId,
      resolvedKitsuId,
      data.titleRomaji?.trim() ?? null,
      data.titleEnglish?.trim() ?? null,
      data.titleNative?.trim() ?? null,
      mediaWrite.insertCover,
      mediaWrite.insertBanner,
      data.synopsis?.trim() ?? null,
      data.format?.trim() ?? null,
      data.status?.trim() ?? null,
      data.episodesCount ?? null,
      data.year ?? null,
      data.season?.trim() ?? null,
      genresArray,
      data.trailerId?.trim() ?? null,
      mediaWrite.shouldWriteCover,
      mediaWrite.shouldWriteBanner,
      data.hidden ?? false,
      data.score ?? null,
      hiddenProvided,
      scoreProvided,
      manualFields,
      normTitle,
      searchBlob,
      JSON.stringify(mergedEpisodeHistory),
    ];

    if (hasCountryOfOriginCol) {
      upsertParams.push(normalizedCountryOfOrigin);
      visibilityInsertCols.push(`"country_of_origin"`);
      visibilityInsertVals.push(`$${upsertParams.length}`);
      visibilityUpdates.push(
        `"country_of_origin" = COALESCE(NULLIF(EXCLUDED."country_of_origin", ''), "catalog_anime"."country_of_origin")`,
      );
    }
    if (hasDuplicateOfIdCol) {
      upsertParams.push(cleanDuplicateOfId);
      visibilityInsertCols.push(`"duplicate_of_id"`);
      visibilityInsertVals.push(`$${upsertParams.length}`);
      visibilityUpdates.push(
        `"duplicate_of_id" = COALESCE(NULLIF(EXCLUDED."duplicate_of_id", ''), "catalog_anime"."duplicate_of_id")`,
      );
    }

    const visInsertColsSql =
      visibilityInsertCols.length > 0
        ? `, ${visibilityInsertCols.join(", ")}`
        : "";
    const visInsertValsSql =
      visibilityInsertVals.length > 0
        ? `, ${visibilityInsertVals.join(", ")}`
        : "";
    const visUpdatesSql =
      visibilityUpdates.length > 0
        ? `,\n         ${visibilityUpdates.join(",\n         ")}`
        : "";

    // 2. Upsert do anime ativo (sempre limpando archived_at = NULL)
    const result = await tx.query<{
      id: string;
      cover: string | null;
      banner: string | null;
      anilistId: number | null;
      malId: number | null;
      kitsuId: number | null;
      title: string;
      titleRomaji: string | null;
      titleEnglish: string | null;
      titleNative: string | null;
      format: string | null;
      status: string | null;
      episodesCount: number | null;
      year: number | null;
      updatedAt: string | Date;
    }>(
      `INSERT INTO "catalog_anime" (
         "id", "title", "anilistId", "malId", "kitsuId",
         "titleRomaji", "titleEnglish", "titleNative",
         "cover", "banner", "synopsis", "format", "status",
         "episodesCount", "year", "season", "genres", "trailerId",
         "hidden", "score", "manual_fields",
         "title_norm", "search_blob", "archived_at", "episode_history"${visInsertColsSql},
         "createdAt", "updatedAt"
       )
       VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11, $12, $13,
         $14, $15, $16,
         COALESCE($17::text[], '{}'::text[]),
         $18,
         $21, $22,
         COALESCE($25::text[], '{}'::text[]),
         $26, $27, NULL, $28::jsonb${visInsertValsSql},
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       )
       ON CONFLICT ("id") DO UPDATE
       SET
         "title" = COALESCE(EXCLUDED."title", "catalog_anime"."title"),
         "anilistId" = COALESCE(EXCLUDED."anilistId", "catalog_anime"."anilistId"),
         "malId" = COALESCE(EXCLUDED."malId", "catalog_anime"."malId"),
         "kitsuId" = COALESCE(EXCLUDED."kitsuId", "catalog_anime"."kitsuId"),
         "titleRomaji" = COALESCE(EXCLUDED."titleRomaji", "catalog_anime"."titleRomaji"),
         "titleEnglish" = COALESCE(EXCLUDED."titleEnglish", "catalog_anime"."titleEnglish"),
         "titleNative" = COALESCE(EXCLUDED."titleNative", "catalog_anime"."titleNative"),
         "cover" = CASE
           WHEN $19::boolean THEN EXCLUDED."cover"
           ELSE "catalog_anime"."cover"
         END,
         "banner" = CASE
           WHEN $20::boolean THEN EXCLUDED."banner"
           ELSE "catalog_anime"."banner"
         END,
         "synopsis" = COALESCE(EXCLUDED."synopsis", "catalog_anime"."synopsis"),
         "format" = COALESCE(EXCLUDED."format", "catalog_anime"."format"),
         "status" = COALESCE(EXCLUDED."status", "catalog_anime"."status"),
         "episodesCount" = COALESCE(EXCLUDED."episodesCount", "catalog_anime"."episodesCount"),
         "year" = COALESCE(EXCLUDED."year", "catalog_anime"."year"),
         "season" = COALESCE(EXCLUDED."season", "catalog_anime"."season"),
         "genres" = CASE
           WHEN $17::text[] IS NOT NULL THEN EXCLUDED."genres"
           ELSE "catalog_anime"."genres"
         END,
         "trailerId" = CASE
           WHEN $18::text IS NOT NULL THEN EXCLUDED."trailerId"
           ELSE "catalog_anime"."trailerId"
         END,
         "hidden" = CASE
           WHEN $23::boolean THEN EXCLUDED."hidden"
           ELSE "catalog_anime"."hidden"
         END,
         "score" = CASE
           WHEN $24::boolean THEN EXCLUDED."score"
           ELSE "catalog_anime"."score"
         END,
         "manual_fields" = array(
           SELECT DISTINCT u
           FROM unnest(
             array_cat(
               COALESCE("catalog_anime"."manual_fields", '{}'::text[]),
               COALESCE($25::text[], '{}'::text[])
             )
           ) AS u
         ),
         "title_norm" = COALESCE(NULLIF(EXCLUDED."title_norm", ''), "catalog_anime"."title_norm"),
         "search_blob" = COALESCE(NULLIF(EXCLUDED."search_blob", ''), "catalog_anime"."search_blob"),
         "archived_at" = NULL,
         "episode_history" = EXCLUDED."episode_history"${visUpdatesSql},
         "updatedAt" = CURRENT_TIMESTAMP
       RETURNING "id", "cover", "banner", "anilistId", "malId", "kitsuId",
                 "title", "titleRomaji", "titleEnglish", "titleNative",
                 "format", "status", "episodesCount", "year", "updatedAt";`,
      upsertParams,
    );

    const savedRow = result[0];
    const canonicalSavedId = savedRow?.id || targetId;

    // 3. Upsert das temporadas quando fornecidas
    if (Array.isArray(data.seasons) && data.seasons.length > 0) {
      for (let i = 0; i < data.seasons.length; i++) {
        const s = data.seasons[i];
        const seasonNum = s.number;
        const seasonTitle = s.title?.trim() || `Temporada ${seasonNum}`;
        const seasonPos = s.position ?? i;

        await tx.query(
          `INSERT INTO "catalog_season" ("animeId", "number", "title", "position", "createdAt")
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT ("animeId", "number") DO UPDATE
           SET
             "title" = COALESCE(EXCLUDED."title", "catalog_season"."title"),
             "position" = EXCLUDED."position";`,
          [canonicalSavedId, seasonNum, seasonTitle, seasonPos],
        );
      }
    }

    // 4. Vincular oldIds -> canonicalSavedId em catalog_anime_id_alias e achatar cadeias anteriores
    await tx.query(
      `DELETE FROM "catalog_anime_id_alias" WHERE "old_id" = $1;`,
      [canonicalSavedId],
    );

    const oldIdsSet = new Set<string>();
    if (data.id !== canonicalSavedId) oldIdsSet.add(data.id);
    for (const srcId of reregResolution.sourceOldIds) {
      if (srcId && srcId !== canonicalSavedId) oldIdsSet.add(srcId);
    }
    for (const tomb of matchingTombstones) {
      if (tomb.old_id !== canonicalSavedId) oldIdsSet.add(tomb.old_id);
    }
    for (const legacyId of legacyOrphanIds) {
      if (legacyId !== canonicalSavedId) oldIdsSet.add(legacyId);
    }
    for (const row of existingRows) {
      if (
        row.id !== canonicalSavedId &&
        row.archived_at &&
        rowIsDubbed(row) === incomingIsDubbed
      ) {
        oldIdsSet.add(row.id);
      }
    }
    const existingPointingAliases = await getAllAliasIdsForCanonical(
      tx,
      canonicalSavedId,
    );
    for (const a of existingPointingAliases) {
      if (a !== canonicalSavedId) oldIdsSet.add(a);
    }

    const oldIdsList = Array.from(oldIdsSet);

    for (const oldId of oldIdsList) {
      await upsertAliasMapping(tx, {
        oldId,
        currentId: canonicalSavedId,
        anilistId: savedRow?.anilistId ?? resolvedAnilistId,
        malId: savedRow?.malId ?? resolvedMalId,
        kitsuId: savedRow?.kitsuId ?? resolvedKitsuId,
        titleNorm: normTitle || null,
        format: savedRow?.format ?? data.format ?? null,
        year: savedRow?.year ?? data.year ?? null,
        isDubbed: incomingIsDubbed,
        episodeHistory: mergedEpisodeHistory,
        archivedAt: null,
      });
    }

    const reconcileIds = new Set<string>(oldIdsList);
    if (savedRow?.anilistId && !incomingIsDubbed) {
      reconcileIds.add(String(savedRow.anilistId));
    }
    if (savedRow?.malId && !incomingIsDubbed) {
      reconcileIds.add(`mal-${savedRow.malId}`);
    }
    if (savedRow?.kitsuId && !incomingIsDubbed) {
      reconcileIds.add(`kitsu-${savedRow.kitsuId}`);
    }

    const canonicalSnapshot = {
      title: savedRow?.title ?? canonicalTitle,
      titleRomaji: savedRow?.titleRomaji ?? data.titleRomaji?.trim() ?? null,
      titleEnglish: savedRow?.titleEnglish ?? data.titleEnglish?.trim() ?? null,
      titleNative: savedRow?.titleNative ?? data.titleNative?.trim() ?? null,
      cover: savedRow?.cover ?? cleanCover,
      banner: savedRow?.banner ?? cleanBanner,
      format: savedRow?.format ?? data.format?.trim() ?? null,
      year: savedRow?.year ?? data.year ?? null,
      episodesCount: savedRow?.episodesCount ?? data.episodesCount ?? null,
      status: savedRow?.status ?? data.status?.trim() ?? null,
      anilistId: savedRow?.anilistId ?? resolvedAnilistId,
      malId: savedRow?.malId ?? resolvedMalId,
      kitsuId: savedRow?.kitsuId ?? resolvedKitsuId,
      serverCatalogId: canonicalSavedId,
    };

    // 5. Reconciliação automática das referências órfãs para canonicalSavedId
    await reconcileAnimeIdentityReferences(tx, {
      canonicalId: canonicalSavedId,
      oldIds: Array.from(reconcileIds),
      canonicalSnapshot,
      episodeHistory: mergedEpisodeHistory,
    });

    const allKnownAliases = await getAllAliasIdsForCanonical(tx, canonicalSavedId);

    return {
      canonicalSavedId,
      reusedOriginalId: reregResolution.reusedOriginalId,
      matchedBy: reregResolution.matchedBy,
      savedRow,
      previousRow,
      allKnownAliases,
      oldIdsList,
    };
  });

  const {
    canonicalSavedId,
    reusedOriginalId,
    matchedBy,
    savedRow,
    previousRow,
    allKnownAliases,
    oldIdsList,
  } = txResult;

  const invalidationExtraIds: Array<string | number | null | undefined> = [
    data.id !== canonicalSavedId ? data.id : null,
    ...oldIdsList,
    ...allKnownAliases,
    previousRow?.id,
    previousRow?.anilistId,
    previousRow?.malId ? `mal-${previousRow.malId}` : null,
    previousRow?.kitsuId ? `kitsu-${previousRow.kitsuId}` : null,
    data.anilistId,
    data.malId ? `mal-${data.malId}` : null,
    data.kitsuId ? `kitsu-${data.kitsuId}` : null,
  ];

  await invalidateCatalogEpisodesCacheAsync(
    canonicalSavedId,
    data.id !== canonicalSavedId ? data.id : undefined,
    ...invalidationExtraIds
      .map((v) => (typeof v === "number" ? String(v) : v ?? undefined))
      .filter((v): v is string => Boolean(v)),
  );
  await invalidateHomePublicEpisodesCacheAsync({
    skipHeroAndTrending: true,
    redisOverride: options?.redisOverride,
  });

  invalidatePublicVisibilityCache();

  await invalidateServerCatalogCachesAsync(
    canonicalSavedId,
    {
      anilistId: savedRow?.anilistId ?? data.anilistId,
      malId: savedRow?.malId ?? data.malId,
      kitsuId: savedRow?.kitsuId ?? data.kitsuId,
      extraIds: invalidationExtraIds,
    },
    options?.redisOverride,
  );

  const rawUpdatedAt = savedRow?.updatedAt;
  const parsedUpdatedAt =
    rawUpdatedAt instanceof Date
      ? rawUpdatedAt.getTime()
      : typeof rawUpdatedAt === "string"
        ? Date.parse(rawUpdatedAt)
        : Date.now();
  const updatedAtMs =
    Number.isFinite(parsedUpdatedAt) && parsedUpdatedAt > 0
      ? parsedUpdatedAt
      : Date.now();

  return {
    animeId: canonicalSavedId,
    reusedOriginalId,
    matchedBy,
    aliases: allKnownAliases,
    cover: savedRow?.cover ?? cleanCover,
    banner: savedRow?.banner ?? cleanBanner,
    updatedAt: updatedAtMs,
  };
}

export async function executeAdminArchiveCatalogAnime(
  animeId: string,
  options?: { redisOverride?: RedisEvalClient | null },
): Promise<{
  found: boolean;
  targetId: string;
  allAliases: string[];
}> {
  const archiveResult = await withTransaction(async (tx) => {
    const lookup = await findCanonicalCatalogAnime(tx, { id: animeId });
    let target = lookup.row;

    if (!target) {
      const directRows = await tx.query<CatalogAnimeIdentityRow>(
        `SELECT "id", "title", "anilistId", "malId", "kitsuId",
                "titleRomaji", "titleEnglish", "titleNative",
                "cover", "banner", "synopsis", "format", "status",
                "episodesCount", "year", "season", "hidden", "archived_at", "episode_history"
         FROM "catalog_anime"
         WHERE "id" = $1
         LIMIT 1;`,
        [animeId],
      );
      target = directRows[0] ?? null;
    }

    if (!target) {
      return {
        found: false,
        targetId: animeId,
        previousExternalIds: null as {
          anilistId?: number | null;
          malId?: number | null;
          kitsuId?: number | null;
        } | null,
        allAliases: [animeId],
      };
    }

    const existingEpSnapshot = await snapshotCatalogEpisodesMap(tx, target.id);
    const mergedHistory = mergeEpisodeHistory(
      parseEpisodeHistoryArray(target.episode_history),
      existingEpSnapshot,
    );
    const historyJson = JSON.stringify(mergedHistory);

    const previousAliases = await getAllAliasIdsForCanonical(tx, target.id);
    const previousExternalIds = {
      anilistId: target.anilistId,
      malId: target.malId,
      kitsuId: target.kitsuId,
    };

    const normTitle =
      normalizeIdentityTitle(
        target.title ||
          target.titleRomaji ||
          target.titleEnglish ||
          target.titleNative,
      ) || null;
    const dubbed = rowIsDubbed(target);

    await tx.query(
      `INSERT INTO "catalog_anime_id_alias" (
         "old_id", "current_id", "anilist_id", "mal_id", "kitsu_id",
         "title_norm", "format", "year", "is_dubbed", "episode_history",
         "archived_at", "updated_at"
       )
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("old_id") DO UPDATE
       SET
         "current_id" = NULL,
         "anilist_id" = COALESCE(EXCLUDED."anilist_id", "catalog_anime_id_alias"."anilist_id"),
         "mal_id" = COALESCE(EXCLUDED."mal_id", "catalog_anime_id_alias"."mal_id"),
         "kitsu_id" = COALESCE(EXCLUDED."kitsu_id", "catalog_anime_id_alias"."kitsu_id"),
         "title_norm" = COALESCE(EXCLUDED."title_norm", "catalog_anime_id_alias"."title_norm"),
         "format" = COALESCE(EXCLUDED."format", "catalog_anime_id_alias"."format"),
         "year" = COALESCE(EXCLUDED."year", "catalog_anime_id_alias"."year"),
         "is_dubbed" = EXCLUDED."is_dubbed",
         "episode_history" = EXCLUDED."episode_history",
         "archived_at" = CURRENT_TIMESTAMP,
         "updated_at" = CURRENT_TIMESTAMP;`,
      [
        target.id,
        target.anilistId,
        target.malId,
        target.kitsuId,
        normTitle,
        target.format,
        target.year,
        dubbed,
        historyJson,
      ],
    );

    if (previousAliases.length > 0) {
      await tx.query(
        `UPDATE "catalog_anime_id_alias"
         SET "current_id" = NULL,
             "anilist_id" = COALESCE("anilist_id", $2),
             "mal_id" = COALESCE("mal_id", $3),
             "kitsu_id" = COALESCE("kitsu_id", $4),
             "title_norm" = COALESCE("title_norm", $5),
             "format" = COALESCE("format", $6),
             "year" = COALESCE("year", $7),
             "is_dubbed" = $8,
             "episode_history" = $9::jsonb,
             "archived_at" = CURRENT_TIMESTAMP,
             "updated_at" = CURRENT_TIMESTAMP
         WHERE "current_id" = $1 OR "old_id" = ANY($10);`,
        [
          target.id,
          target.anilistId,
          target.malId,
          target.kitsuId,
          normTitle,
          target.format,
          target.year,
          dubbed,
          historyJson,
          previousAliases,
        ],
      );
    }

    await tx.query(
      `UPDATE "catalog_anime"
       SET "archived_at" = CURRENT_TIMESTAMP,
           "hidden" = true,
           "anilistId" = NULL,
           "malId" = NULL,
           "kitsuId" = NULL,
           "episode_history" = $2::jsonb,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $1;`,
      [target.id, historyJson],
    );

    const epRows = await tx.query<{ id: string }>(
      `DELETE FROM "catalog_episode"
       WHERE "animeId" = $1
       RETURNING "id";`,
      [target.id],
    );
    const deletedEpIds = epRows.map((e) => e.id);
    if (deletedEpIds.length > 0) {
      await tx.query(
        `DELETE FROM "episode_sources" WHERE "episode_id" = ANY($1);`,
        [deletedEpIds],
      );
    }
    await tx.query(`DELETE FROM "catalog_season" WHERE "animeId" = $1;`, [
      target.id,
    ]);
    await tx.query(
      `DELETE FROM "catalog_airing_schedule" WHERE "animeId" = $1;`,
      [target.id],
    );
    await tx.query(
      `DELETE FROM "catalog_weekly_recurrence" WHERE "animeId" = $1;`,
      [target.id],
    );

    return {
      found: true,
      targetId: target.id,
      previousExternalIds,
      allAliases: Array.from(new Set([animeId, target.id, ...previousAliases])),
    };
  });

  await deleteAnimeRecentBadgesFromDb(archiveResult.targetId);
  for (const aliasId of archiveResult.allAliases) {
    if (aliasId !== archiveResult.targetId) {
      await deleteAnimeRecentBadgesFromDb(aliasId);
    }
  }

  const epInvalidationIds: Array<string | undefined> = [
    ...archiveResult.allAliases,
    archiveResult.previousExternalIds?.anilistId
      ? String(archiveResult.previousExternalIds.anilistId)
      : undefined,
    archiveResult.previousExternalIds?.malId
      ? `mal-${archiveResult.previousExternalIds.malId}`
      : undefined,
    archiveResult.previousExternalIds?.kitsuId
      ? `kitsu-${archiveResult.previousExternalIds.kitsuId}`
      : undefined,
  ];
  await invalidateCatalogEpisodesCacheAsync(...epInvalidationIds);
  if (archiveResult.found) {
    await invalidateHomePublicEpisodesCacheAsync({
      skipHeroAndTrending: true,
      redisOverride: options?.redisOverride,
    });
  }
  invalidatePublicVisibilityCache();

  await invalidateServerCatalogCachesAsync(
    archiveResult.targetId,
    {
      anilistId: archiveResult.previousExternalIds?.anilistId,
      malId: archiveResult.previousExternalIds?.malId,
      kitsuId: archiveResult.previousExternalIds?.kitsuId,
      extraIds: archiveResult.allAliases,
    },
    options?.redisOverride,
  );

  return {
    found: archiveResult.found,
    targetId: archiveResult.targetId,
    allAliases: archiveResult.allAliases,
  };
}
