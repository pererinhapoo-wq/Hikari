import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import { getSql, withTransaction } from "@/lib/db";
import { invalidateCatalogEpisodesCacheAsync } from "@/lib/catalog-episodes";
import { invalidateHomePublicEpisodesCache } from "@/lib/home-episodes";
import { invalidateServerCatalogCachesAsync } from "@/lib/api";
import { stripCatalogImageVersion } from "@/lib/image-utils";
import { resolveCatalogAnimeMediaWrite } from "@/lib/types";
import { deleteAnimeRecentBadgesFromDb } from "@/lib/catalog-badges";
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
  resolveAliasChainTarget,
  rowIsDubbed,
  snapshotCatalogEpisodesMap,
  type CatalogAnimeIdentityRow,
  type EpisodeHistoryEntry,
} from "@/lib/anime-identity.server";

const seasonItemSchema = z.object({
  number: z.number().int().min(1, "number da temporada deve ser >= 1"),
  title: z.string().max(255).optional().nullable(),
  position: z.number().int().min(0).optional().nullable(),
});

const animeAdminPostSchema = z.object({
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
  seasons: z.array(seasonItemSchema).optional().nullable(),
});

function sanitizeImageUrl(url?: string | null): string | null {
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

export const Route = createFileRoute("/api/admin/catalog-anime")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);

          let rawBody: unknown;
          try {
            rawBody = await request.json();
          } catch {
            return Response.json({ error: "JSON inválido." }, { status: 400 });
          }

          const parsed = animeAdminPostSchema.safeParse(rawBody);
          if (!parsed.success) {
            const firstError = parsed.error.issues[0]?.message || "Dados inválidos.";
            return Response.json(
              { error: firstError, details: parsed.error.issues },
              { status: 400 },
            );
          }

          const data = parsed.data;

          let cleanCover: string | null = null;
          let cleanBanner: string | null = null;
          try {
            cleanCover = sanitizeImageUrl(data.cover);
            cleanBanner = sanitizeImageUrl(data.banner);
          } catch (imgErr) {
            return Response.json(
              { error: imgErr instanceof Error ? imgErr.message : "URL de imagem inválida." },
              { status: 400 },
            );
          }

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
            // 1. Buscar linhas existentes (ativas OU arquivadas) para o ID ou IDs externos
            const existingRows = await tx.query<CatalogAnimeIdentityRow>(
              `SELECT "id", "title", "titleRomaji", "titleEnglish", "titleNative",
                      "anilistId", "malId", "kitsuId", "format", "year",
                      "cover", "banner", "synopsis", "status", "episodesCount", "season",
                      "hidden", "archived_at", "episode_history"
               FROM "catalog_anime"
               WHERE "id" = $1
                  OR ($2::int IS NOT NULL AND "anilistId" = $2)
                  OR ($3::int IS NOT NULL AND "malId" = $3)
                  OR ($4::int IS NOT NULL AND "kitsuId" = $4);`,
              [data.id, data.anilistId ?? null, data.malId ?? null, data.kitsuId ?? null],
            );

            const activeRows = existingRows.filter((r) => !r.archived_at);
            const exactActive = activeRows.find((r) => r.id === data.id);
            const exactArchived = existingRows.find(
              (r) => r.id === data.id && Boolean(r.archived_at),
            );

            const activeExternalMatch =
              activeRows.find(
                (r) =>
                  r.id !== data.id &&
                  rowIsDubbed(r) === incomingIsDubbed,
              ) ?? null;

            // Se data.id for um alias de outro anime ativo, resolver para o canônico ativo
            const aliasChain = !exactActive
              ? await resolveAliasChainTarget(tx, data.id)
              : null;

            let targetId = data.id;
            if (exactActive) {
              targetId = exactActive.id;
            } else if (aliasChain?.canonicalId) {
              targetId = aliasChain.canonicalId;
            } else if (activeExternalMatch && !incomingIsDubbed) {
              targetId = activeExternalMatch.id;
            } else if (exactArchived) {
              targetId = exactArchived.id;
            }

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

            const previousRow =
              existingRows.find((r) => r.id === targetId) ??
              aliasChain?.canonicalRow ??
              null;
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

            let mergedEpisodeHistory: EpisodeHistoryEntry[] = parseEpisodeHistoryArray(
              previousRow?.episode_history,
            );
            for (const tomb of matchingTombstones) {
              mergedEpisodeHistory = mergeEpisodeHistory(
                mergedEpisodeHistory,
                parseEpisodeHistoryArray(tomb.episode_history),
              );
            }
            // Se existirem registros arquivados com mesmo ID externo ou tombstone, herdar também seus episode_history
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
                 "title_norm", "search_blob", "archived_at", "episode_history",
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
                 $26, $27, NULL, $28::jsonb,
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
                 "episode_history" = EXCLUDED."episode_history",
                 "updatedAt" = CURRENT_TIMESTAMP
               RETURNING "id", "cover", "banner", "anilistId", "malId", "kitsuId",
                         "title", "titleRomaji", "titleEnglish", "titleNative",
                         "format", "status", "episodesCount", "year", "updatedAt";`,
              [
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
              ],
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
            // Se canonicalSavedId antes possuía registro em catalog_anime_id_alias (ex.: reativação com o mesmo id), removê-lo como tombstone
            await tx.query(
              `DELETE FROM "catalog_anime_id_alias" WHERE "old_id" = $1;`,
              [canonicalSavedId],
            );

            const oldIdsSet = new Set<string>();
            if (data.id !== canonicalSavedId) oldIdsSet.add(data.id);
            for (const tomb of matchingTombstones) {
              if (tomb.old_id !== canonicalSavedId) oldIdsSet.add(tomb.old_id);
            }
            for (const legacyId of legacyOrphanIds) {
              if (legacyId !== canonicalSavedId) oldIdsSet.add(legacyId);
            }
            for (const row of existingRows) {
              if (row.id !== canonicalSavedId && row.archived_at) {
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
            const historyJson = JSON.stringify(mergedEpisodeHistory);

            for (const oldId of oldIdsList) {
              await tx.query(
                `INSERT INTO "catalog_anime_id_alias" (
                   "old_id", "current_id", "anilist_id", "mal_id", "kitsu_id",
                   "title_norm", "format", "year", "is_dubbed", "episode_history",
                   "archived_at", "updated_at"
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NULL, CURRENT_TIMESTAMP)
                 ON CONFLICT ("old_id") DO UPDATE
                 SET
                   "current_id" = EXCLUDED."current_id",
                   "anilist_id" = COALESCE(EXCLUDED."anilist_id", "catalog_anime_id_alias"."anilist_id"),
                   "mal_id" = COALESCE(EXCLUDED."mal_id", "catalog_anime_id_alias"."mal_id"),
                   "kitsu_id" = COALESCE(EXCLUDED."kitsu_id", "catalog_anime_id_alias"."kitsu_id"),
                   "title_norm" = COALESCE(NULLIF(EXCLUDED."title_norm", ''), "catalog_anime_id_alias"."title_norm"),
                   "format" = COALESCE(EXCLUDED."format", "catalog_anime_id_alias"."format"),
                   "year" = COALESCE(EXCLUDED."year", "catalog_anime_id_alias"."year"),
                   "is_dubbed" = EXCLUDED."is_dubbed",
                   "episode_history" = EXCLUDED."episode_history",
                   "archived_at" = NULL,
                   "updated_at" = CURRENT_TIMESTAMP;`,
                [
                  oldId,
                  canonicalSavedId,
                  savedRow?.anilistId ?? resolvedAnilistId,
                  savedRow?.malId ?? resolvedMalId,
                  savedRow?.kitsuId ?? resolvedKitsuId,
                  normTitle || null,
                  savedRow?.format ?? data.format ?? null,
                  savedRow?.year ?? data.year ?? null,
                  incomingIsDubbed,
                  historyJson,
                ],
              );
            }

            if (oldIdsList.length > 0) {
              // Achatar cadeias antigas: aliases que apontavam para algum oldId agora apontam direto para canonicalSavedId
              await tx.query(
                `UPDATE "catalog_anime_id_alias"
                 SET "current_id" = $1,
                     "archived_at" = NULL,
                     "updated_at" = CURRENT_TIMESTAMP
                 WHERE "current_id" = ANY($2)
                   AND "old_id" <> $1;`,
                [canonicalSavedId, oldIdsList],
              );
            }

            // Incluir eventual anilistId numérico caso existam referências herdadas pelo ID numérico (desde que sem conflito de dublagem)
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
              savedRow,
              previousRow,
              allKnownAliases,
              oldIdsList,
            };
          });

          const { canonicalSavedId, savedRow, previousRow, allKnownAliases, oldIdsList } =
            txResult;

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
          invalidateHomePublicEpisodesCache();

          await invalidateServerCatalogCachesAsync(canonicalSavedId, {
            anilistId: savedRow?.anilistId ?? data.anilistId,
            malId: savedRow?.malId ?? data.malId,
            kitsuId: savedRow?.kitsuId ?? data.kitsuId,
            extraIds: invalidationExtraIds,
          });

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

          return Response.json({
            ok: true,
            animeId: canonicalSavedId,
            cover: savedRow?.cover ?? cleanCover,
            banner: savedRow?.banner ?? cleanBanner,
            updatedAt: updatedAtMs,
            adminId,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json(
              { error: "Origem cruzada não permitida." },
              { status: err.status },
            );
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }

          console.error("[api/admin/catalog-anime] Erro ao salvar anime:", err);
          return Response.json(
            { error: "Erro interno ao atualizar metadados do anime.", details: String(err) },
            { status: 500 },
          );
        }
      },

      DELETE: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);

          let animeId = "";
          let seasonNumber: number | null = null;
          const url = new URL(request.url);
          const qId = url.searchParams.get("id");
          const qSeason = url.searchParams.get("seasonNumber");

          if (qId) {
            animeId = qId.trim();
            if (qSeason) {
              const parsed = parseInt(qSeason, 10);
              if (!isNaN(parsed) && parsed >= 1) seasonNumber = parsed;
            }
          } else {
            try {
              const body = await request.json();
              if (body?.id) animeId = String(body.id).trim();
              if (typeof body?.seasonNumber === "number" && body.seasonNumber >= 1) {
                seasonNumber = body.seasonNumber;
              }
            } catch {
              // Body vazio ou não JSON
            }
          }

          if (!animeId) {
            return Response.json(
              { error: "Identificador 'id' do anime é obrigatório." },
              { status: 400 },
            );
          }

          if (seasonNumber !== null) {
            const sql = await getSql();
            const lookup = await findCanonicalCatalogAnime(sql, { id: animeId });
            const resolvedAnimeId = lookup.canonicalId ?? animeId;

            const seasonResult = await withTransaction(async (tx) => {
              const sRes = await tx.query<{ number: number }>(
                `DELETE FROM "catalog_season"
                 WHERE "animeId" = $1 AND "number" = $2
                 RETURNING "number";`,
                [resolvedAnimeId, seasonNumber],
              );

              const epRes = await tx.query<{ id: string }>(
                `DELETE FROM "catalog_episode"
                 WHERE "animeId" = $1 AND "seasonNumber" = $2
                 RETURNING "id";`,
                [resolvedAnimeId, seasonNumber],
              );

              const deletedEpIds = epRes.map((e) => e.id);
              if (deletedEpIds.length > 0) {
                await tx.query(
                  `DELETE FROM "episode_sources" WHERE "episode_id" = ANY($1);`,
                  [deletedEpIds],
                );
              }

              return { sRes, epRes };
            });

            const seasonAliases = new Set<string>([
              animeId,
              resolvedAnimeId,
              ...lookup.aliasIds,
            ]);
            if (lookup.row?.anilistId) seasonAliases.add(String(lookup.row.anilistId));
            if (lookup.row?.malId) seasonAliases.add(`mal-${lookup.row.malId}`);
            if (lookup.row?.kitsuId) seasonAliases.add(`kitsu-${lookup.row.kitsuId}`);

            await invalidateCatalogEpisodesCacheAsync(...Array.from(seasonAliases));
            if (seasonResult.sRes.length > 0 || seasonResult.epRes.length > 0) {
              invalidateHomePublicEpisodesCache();
            }

            return Response.json({
              ok: true,
              animeId: resolvedAnimeId,
              seasonNumber,
              found: seasonResult.sRes.length > 0,
              deletedEpisodesCount: seasonResult.epRes.length,
              adminId,
            });
          }

          // Exclusão lógica / arquivamento seguro do anime (sem perder referências de usuários nem histórico de episódios)
          const archiveResult = await withTransaction(async (tx) => {
            const lookup = await findCanonicalCatalogAnime(tx, { id: animeId });
            let target = lookup.row;

            // Caso não encontrado via ativo, verificar se o registro existe mesmo já arquivado pelo id exato
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

            // Registrar tombstone em catalog_anime_id_alias preservando externalIds + episode_history
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

            // Atualizar todos os aliases que apontavam para este ID para também virarem tombstones com metadados completos
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

            // Arquivar catalog_anime liberando unique keys anilistId/malId/kitsuId para permitir futuro recadastro
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

            // Limpar entidades dependentes do catálogo ativo após salvar snapshot de episode_history
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
            invalidateHomePublicEpisodesCache();
          }
          await invalidateServerCatalogCachesAsync(archiveResult.targetId, {
            anilistId: archiveResult.previousExternalIds?.anilistId,
            malId: archiveResult.previousExternalIds?.malId,
            kitsuId: archiveResult.previousExternalIds?.kitsuId,
            extraIds: archiveResult.allAliases,
          });

          return Response.json({
            ok: true,
            deletedId: archiveResult.targetId,
            requestedId: animeId,
            found: archiveResult.found,
            archived: archiveResult.found,
            adminId,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json(
              { error: "Origem cruzada não permitida." },
              { status: err.status },
            );
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }

          console.error("[api/admin/catalog-anime] Erro ao excluir anime:", err);
          return Response.json(
            { error: "Erro interno ao excluir anime.", details: String(err) },
            { status: 500 },
          );
        }
      },
    },
  },
});
