import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import { getSql, withTransaction } from "@/lib/db";
import {
  loadAllSettingsFromDb,
  saveSettingsToDb,
  invalidatePublicSettingsCache,
} from "@/lib/settings/settings.server";
import { invalidateCatalogEpisodesCacheAsync } from "@/lib/catalog-episodes";
import { invalidateHomePublicEpisodesCache } from "@/lib/home-episodes";
import { invalidateServerCatalogCachesAsync } from "@/lib/api";
import { sanitizePlayableVideoUrl } from "@/lib/published-episodes";
import { syncCatalogEpisodeSlotsToSources } from "@/lib/sources";
import { validateHikariPlayerEpisodeId } from "@/lib/hikari-player";
import { parseAnitube22PlayerUrl } from "@/lib/anitube22";
import { SOURCE_SYNC_CONCURRENCY, runWithConcurrency } from "@/lib/concurrency";
import { resolveEpisodeBadgesPatch } from "@/lib/episode-writer";
import {
  discoverMatchingOrphanIdsFromUserTables,
  findMatchingTombstoneAliases,
  getAllAliasIdsForCanonical,
  inferIsDubbedFromTitles,
  mergeEpisodeHistory,
  normalizeIdentityTitle,
  parseEpisodeHistoryArray,
  reconcileAnimeIdentityReferences,
  reconcileEpisodeIdentityReferences,
  type EpisodeHistoryEntry,
} from "@/lib/anime-identity.server";

const episodeSchema = z.object({
  id: z.string().trim().min(1).max(128),
  number: z.number().int().min(0),
  title: z.string().max(255).optional().nullable(),
  thumbnail: z.string().max(2048).optional().nullable(),
  duration: z.string().max(64).optional().nullable(),
  synopsis: z.string().max(10000).optional().nullable(),
  videoUrl: z.string().max(2048).optional().nullable(),
  videoUrl2: z.string().max(2048).optional().nullable(),
  videoUrl3: z.string().max(2048).optional().nullable(),
  videoUrl4: z.string().max(2048).optional().nullable(),
  videoUrl5: z.string().max(2048).optional().nullable(),
  hikariPlayerEpisodeId: z.string().max(255).optional().nullable(),
  recentBadges: z
    .object({
      lancamento: z.boolean().optional(),
      novo: z.boolean().optional(),
      final: z.boolean().optional(),
    })
    .optional()
    .nullable(),
  published: z.boolean().optional(),
});

const seasonSchema = z.object({
  id: z.string().optional().nullable(),
  number: z.number().int().min(1),
  title: z.string().max(255).optional().nullable(),
  position: z.number().int().min(0).optional().nullable(),
  episodes: z.array(episodeSchema).default([]),
});

const animeSchema = z.object({
  id: z.string().trim().min(1).max(128),
  titleRomaji: z.string().max(255).optional().nullable(),
  titleEnglish: z.string().max(255).optional().nullable(),
  titleNative: z.string().max(255).optional().nullable(),
  cover: z.string().max(2048).optional().nullable(),
  banner: z.string().max(2048).optional().nullable(),
  synopsis: z.string().max(15000).optional().nullable(),
  score: z.number().min(0).max(100).optional().nullable(),
  genres: z.array(z.string().max(64)).default([]),
  format: z.string().max(32).optional().nullable(),
  status: z.string().max(32).optional().nullable(),
  episodesCount: z.number().int().optional().nullable(),
  season: z.string().max(32).optional().nullable(),
  year: z.number().int().optional().nullable(),
  trailerId: z.string().max(255).optional().nullable(),
  hidden: z.boolean().default(false),
  seasons: z.array(seasonSchema).default([]),
});

const backupPackageSchema = z.object({
  version: z.string().optional(),
  exportedAt: z.string().optional(),
  catalog: z.array(animeSchema).optional(),
  animes: z.array(animeSchema).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const Route = createFileRoute("/api/admin/backup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);

          const url = new URL(request.url);
          const type = (url.searchParams.get("type") || "full").trim().toLowerCase();
          const sql = await getSql();

          const now = new Date().toISOString().split("T")[0];

          // 1. Exportação de Configurações
          if (type === "settings") {
            const settings = await loadAllSettingsFromDb();
            const payload = {
              version: "2.0",
              type: "settings",
              exportedAt: new Date().toISOString(),
              adminId,
              settings,
            };

            return new Response(JSON.stringify(payload, null, 2), {
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": `attachment; filename="hikari-settings-backup-${now}.json"`,
              },
            });
          }

          // 2. Consulta do Catálogo Completo (Animes + Temporadas + Episódios)
          const animes = await sql.query<{
            id: string;
            title: string;
            titleEnglish: string | null;
            titleNative: string | null;
            cover: string | null;
            banner: string | null;
            synopsis: string | null;
            score: number | null;
            genres: string[] | null;
            format: string | null;
            status: string | null;
            episodesCount: number | null;
            season: string | null;
            year: number | null;
            trailerId: string | null;
            hidden: boolean | null;
          }>(`
            SELECT
              "id", "title", "titleEnglish", "titleNative",
              "cover", "banner", "synopsis", "score",
              "genres", "format", "status", "episodesCount",
              "season", "year", "trailerId", "hidden"
            FROM "catalog_anime"
            WHERE "archived_at" IS NULL
            ORDER BY "title" ASC;
          `);

          const seasons = await sql.query<{
            animeId: string;
            number: number;
            title: string | null;
            position: number;
          }>(`
            SELECT s."animeId", s."number", s."title", s."position"
            FROM "catalog_season" s
            INNER JOIN "catalog_anime" a ON a."id" = s."animeId"
            WHERE a."archived_at" IS NULL
            ORDER BY s."animeId" ASC, s."number" ASC;
          `);

          const episodes = await sql.query<{
            id: string;
            animeId: string;
            seasonNumber: number;
            number: number;
            title: string | null;
            thumbnail: string | null;
            duration: string | null;
            synopsis: string | null;
            videoUrl: string | null;
            videoUrl2: string | null;
            videoUrl3: string | null;
            videoUrl4: string | null;
            videoUrl5: string | null;
            hikariPlayerEpisodeId: string | null;
            badgeLancamento: boolean;
            badgeNovo: boolean;
            badgeFinal: boolean;
            published: boolean | null;
          }>(`
            SELECT
              "id", "animeId", "seasonNumber", "number",
              "title", "thumbnail", "duration", "synopsis",
              "videoUrl", "videoUrl2", "videoUrl3", "videoUrl4", "videoUrl5",
              "hikari_player_episode_id" AS "hikariPlayerEpisodeId",
              COALESCE("badge_lancamento", false) AS "badgeLancamento",
              COALESCE("badge_novo", false) AS "badgeNovo",
              COALESCE("badge_final", false) AS "badgeFinal",
              "published"
            FROM "catalog_episode"
            ORDER BY "animeId" ASC, "seasonNumber" ASC, "number" ASC;
          `);

          // Agrupamento hierárquico
          const episodesBySeason = new Map<string, typeof episodes>();
          for (const ep of episodes) {
            const key = `${ep.animeId}_${ep.seasonNumber}`;
            const list = episodesBySeason.get(key) || [];
            list.push(ep);
            episodesBySeason.set(key, list);
          }

          const seasonsByAnime = new Map<string, any[]>();
          for (const s of seasons) {
            const epList = episodesBySeason.get(`${s.animeId}_${s.number}`) || [];
            const list = seasonsByAnime.get(s.animeId) || [];
            list.push({
              number: s.number,
              title: s.title,
              position: s.position,
              episodes: epList.map((e) => ({
                id: e.id,
                number: e.number,
                title: e.title,
                thumbnail: e.thumbnail,
                duration: e.duration,
                synopsis: e.synopsis,
                videoUrl: sanitizePlayableVideoUrl(e.videoUrl),
                videoUrl2: sanitizePlayableVideoUrl(e.videoUrl2),
                videoUrl3: sanitizePlayableVideoUrl(e.videoUrl3),
                videoUrl4: sanitizePlayableVideoUrl(e.videoUrl4),
                videoUrl5: sanitizePlayableVideoUrl(e.videoUrl5),
                hikariPlayerEpisodeId: e.hikariPlayerEpisodeId ?? null,
                recentBadges: {
                  lancamento: Boolean(e.badgeLancamento),
                  novo: Boolean(e.badgeNovo),
                  final: Boolean(e.badgeFinal),
                },
                published: Boolean(e.published),
              })),
            });
            seasonsByAnime.set(s.animeId, list);
          }

          const catalogTree = animes.map((a) => {
            const aSeasons = seasonsByAnime.get(a.id) || [];
            return {
              id: a.id,
              titleRomaji: a.title,
              titleEnglish: a.titleEnglish,
              titleNative: a.titleNative,
              cover: a.cover,
              banner: a.banner,
              synopsis: a.synopsis,
              score: a.score,
              genres: a.genres || [],
              format: a.format,
              status: a.status,
              episodesCount: a.episodesCount,
              season: a.season,
              year: a.year,
              trailerId: a.trailerId,
              hidden: Boolean(a.hidden),
              seasons: aSeasons,
            };
          });

          if (type === "catalog") {
            const payload = {
              version: "2.0",
              type: "catalog",
              exportedAt: new Date().toISOString(),
              adminId,
              counts: {
                animes: catalogTree.length,
                seasons: seasons.length,
                episodes: episodes.length,
              },
              animes: catalogTree,
            };

            return new Response(JSON.stringify(payload, null, 2), {
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": `attachment; filename="hikari-catalog-backup-${now}.json"`,
              },
            });
          }

          // 3. Exportação Unificada Completa (Catálogo + Configurações)
          const allSettings = await loadAllSettingsFromDb();

          const fullPayload = {
            version: "2.0",
            type: "full_backup",
            exportedAt: new Date().toISOString(),
            adminId,
            counts: {
              animes: catalogTree.length,
              seasons: seasons.length,
              episodes: episodes.length,
              settingsKeys: Object.keys(allSettings).length,
            },
            catalog: catalogTree,
            settings: allSettings,
          };

          return new Response(JSON.stringify(fullPayload, null, 2), {
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Content-Disposition": `attachment; filename="hikari-full-backup-${now}.json"`,
            },
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: err.status });
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[api/admin/backup] Erro na exportação:", err);
          return Response.json({ error: "Erro interno durante a exportação." }, { status: 500 });
        }
      },

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

          const bodyObj = rawBody as Record<string, unknown>;
          const action = bodyObj?.action;

          // 1. Validação Prévia / Dry-Run
          if (action === "preview") {
            const rawContent = bodyObj?.content;
            if (!rawContent || typeof rawContent !== "object") {
              return Response.json(
                { error: "Nenhum conteúdo JSON válido recebido para validação." },
                { status: 400 },
              );
            }

            const parsed = backupPackageSchema.safeParse(rawContent);
            if (!parsed.success) {
              return Response.json(
                {
                  valid: false,
                  error: parsed.error.issues[0]?.message || "Estrutura do arquivo inválida.",
                  details: parsed.error.issues,
                },
                { status: 400 },
              );
            }

            const data = parsed.data;
            const animesList = data.catalog || data.animes || [];
            let totalSeasons = 0;
            let totalEpisodes = 0;

            for (const a of animesList) {
              totalSeasons += a.seasons?.length || 0;
              for (const s of a.seasons || []) {
                totalEpisodes += s.episodes?.length || 0;
              }
            }

            const settingsCount = data.settings ? Object.keys(data.settings).length : 0;

            return Response.json({
              valid: true,
              counts: {
                animes: animesList.length,
                seasons: totalSeasons,
                episodes: totalEpisodes,
                settings: settingsCount,
              },
              version: data.version || "1.0",
              exportedAt: data.exportedAt || null,
            });
          }

          // 2. Execução da Importação com Confirmação Obrigatória
          if (action === "import") {
            const confirmed = bodyObj?.confirmed === true;
            if (!confirmed) {
              return Response.json(
                { error: "A confirmação explícita é obrigatória para executar a importação." },
                { status: 400 },
              );
            }

            const rawContent = bodyObj?.content;
            const parsed = backupPackageSchema.safeParse(rawContent);
            if (!parsed.success) {
              return Response.json(
                { error: "Dados inválidos para importação." },
                { status: 400 },
              );
            }

            const data = parsed.data;
            const animesList = data.catalog || data.animes || [];
            const settingsMap = data.settings;

            let importedAnimes = 0;
            let importedSeasons = 0;
            let importedEpisodes = 0;
            let importedSettings = 0;
            const importedEpisodeSources: Array<{
              episodeId: string;
              slots: Array<{ url: string | null; priority: number }>;
            }> = [];
            const affectedAnimeIds = new Set<string>();

            // Transação dedicada e segura para o catálogo
            if (animesList.length > 0) {
              await withTransaction(async (tx) => {
                for (const anime of animesList) {
                  const animeTitle =
                    anime.titleRomaji?.trim() ||
                    anime.titleEnglish?.trim() ||
                    anime.titleNative?.trim() ||
                    anime.id;

                  const cleanCover =
                    anime.cover?.trim() && !anime.cover.startsWith("blob:")
                      ? anime.cover.trim()
                      : null;
                  const cleanBanner =
                    anime.banner?.trim() && !anime.banner.startsWith("blob:")
                      ? anime.banner.trim()
                      : null;

                  const isDubbed = Boolean(
                    inferIsDubbedFromTitles({
                      title: animeTitle,
                      titleRomaji: anime.titleRomaji,
                      titleEnglish: anime.titleEnglish,
                      titleNative: anime.titleNative,
                    }),
                  );
                  const matchingTombstones = await findMatchingTombstoneAliases(tx, {
                    id: anime.id,
                    title: animeTitle,
                    titleRomaji: anime.titleRomaji,
                    titleEnglish: anime.titleEnglish,
                    titleNative: anime.titleNative,
                    format: anime.format,
                    year: anime.year,
                    isDubbed,
                  });
                  const legacyOrphans = await discoverMatchingOrphanIdsFromUserTables(tx, {
                    canonicalId: anime.id,
                    title: animeTitle,
                    titleRomaji: anime.titleRomaji,
                    titleEnglish: anime.titleEnglish,
                    titleNative: anime.titleNative,
                    format: anime.format,
                    year: anime.year,
                    isDubbed,
                  });
                  let mergedHistory: EpisodeHistoryEntry[] = [];
                  for (const t of matchingTombstones) {
                    mergedHistory = mergeEpisodeHistory(
                      mergedHistory,
                      parseEpisodeHistoryArray(t.episode_history),
                    );
                  }
                  const normTitle = normalizeIdentityTitle(animeTitle);

                  await tx.query(
                    `INSERT INTO "catalog_anime" (
                       "id", "title", "titleEnglish", "titleNative",
                       "cover", "banner", "synopsis",
                       "format", "status", "episodesCount", "season",
                       "year", "genres", "trailerId",
                       "hidden", "score", "title_norm", "archived_at", "episode_history",
                       "createdAt", "updatedAt"
                     )
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NULL, $18::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                     ON CONFLICT ("id") DO UPDATE
                     SET
                       "title" = COALESCE(EXCLUDED."title", "catalog_anime"."title"),
                       "titleEnglish" = COALESCE(EXCLUDED."titleEnglish", "catalog_anime"."titleEnglish"),
                       "titleNative" = COALESCE(EXCLUDED."titleNative", "catalog_anime"."titleNative"),
                       "cover" = COALESCE(NULLIF("catalog_anime"."cover", ''), NULLIF(EXCLUDED."cover", '')),
                       "banner" = COALESCE(NULLIF("catalog_anime"."banner", ''), NULLIF(EXCLUDED."banner", '')),
                       "synopsis" = COALESCE(EXCLUDED."synopsis", "catalog_anime"."synopsis"),
                       "format" = COALESCE(EXCLUDED."format", "catalog_anime"."format"),
                       "status" = COALESCE(EXCLUDED."status", "catalog_anime"."status"),
                       "episodesCount" = COALESCE(EXCLUDED."episodesCount", "catalog_anime"."episodesCount"),
                       "season" = COALESCE(EXCLUDED."season", "catalog_anime"."season"),
                       "year" = COALESCE(EXCLUDED."year", "catalog_anime"."year"),
                       "genres" = CASE WHEN cardinality(EXCLUDED."genres") > 0 THEN EXCLUDED."genres" ELSE "catalog_anime"."genres" END,
                       "trailerId" = COALESCE(EXCLUDED."trailerId", "catalog_anime"."trailerId"),
                       "hidden" = EXCLUDED."hidden",
                       "score" = EXCLUDED."score",
                       "title_norm" = COALESCE(NULLIF(EXCLUDED."title_norm", ''), "catalog_anime"."title_norm"),
                       "archived_at" = NULL,
                       "updatedAt" = CURRENT_TIMESTAMP;`,
                    [
                      anime.id,
                      animeTitle,
                      anime.titleEnglish?.trim() || null,
                      anime.titleNative?.trim() || null,
                      cleanCover,
                      cleanBanner,
                      anime.synopsis?.trim() || null,
                      anime.format?.trim() || "TV",
                      anime.status?.trim() || "FINISHED",
                      anime.episodesCount ?? null,
                      anime.season?.trim() || null,
                      anime.year ?? null,
                      anime.genres || [],
                      anime.trailerId?.trim() || null,
                      anime.hidden ?? false,
                      anime.score ?? null,
                      normTitle || null,
                      JSON.stringify(mergedHistory),
                    ],
                  );
                  await tx.query(
                    `DELETE FROM "catalog_anime_id_alias" WHERE "old_id" = $1;`,
                    [anime.id],
                  );
                  const oldIds = Array.from(
                    new Set([
                      ...matchingTombstones.map((t) => t.old_id),
                      ...legacyOrphans,
                      ...(await getAllAliasIdsForCanonical(tx, anime.id)),
                    ]),
                  ).filter((x) => x !== anime.id);

                  for (const oldId of oldIds) {
                    await tx.query(
                      `INSERT INTO "catalog_anime_id_alias" (
                         "old_id", "current_id", "title_norm", "format", "year",
                         "is_dubbed", "episode_history", "archived_at", "updated_at"
                       )
                       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NULL, CURRENT_TIMESTAMP)
                       ON CONFLICT ("old_id") DO UPDATE
                       SET "current_id" = EXCLUDED."current_id",
                           "archived_at" = NULL,
                           "updated_at" = CURRENT_TIMESTAMP;`,
                      [
                        oldId,
                        anime.id,
                        normTitle || null,
                        anime.format ?? null,
                        anime.year ?? null,
                        isDubbed,
                        JSON.stringify(mergedHistory),
                      ],
                    );
                    affectedAnimeIds.add(oldId);
                  }
                  if (oldIds.length > 0) {
                    await reconcileAnimeIdentityReferences(tx, {
                      canonicalId: anime.id,
                      oldIds,
                      episodeHistory: mergedHistory,
                    });
                  }

                  affectedAnimeIds.add(anime.id);
                  importedAnimes++;

                  for (const season of anime.seasons || []) {
                    const sTitle = season.title?.trim() || `Temporada ${season.number}`;
                    const sPos = season.position ?? (season.number - 1);

                    await tx.query(
                      `INSERT INTO "catalog_season" ("animeId", "number", "title", "position", "createdAt")
                       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                       ON CONFLICT ("animeId", "number") DO UPDATE
                       SET "title" = COALESCE(EXCLUDED."title", "catalog_season"."title"),
                           "position" = EXCLUDED."position";`,
                      [anime.id, season.number, sTitle, sPos],
                    );
                    importedSeasons++;

                    for (const ep of season.episodes || []) {
                      const hasHikariPlayerField = ep.hikariPlayerEpisodeId !== undefined;
                      const hikariPlayerValidation = validateHikariPlayerEpisodeId(
                        ep.hikariPlayerEpisodeId,
                      );
                      if (hasHikariPlayerField && !hikariPlayerValidation.valid) {
                        throw new Error(
                          `Episódio ${ep.number} (${anime.id}): ${hikariPlayerValidation.error}`,
                        );
                      }
                      const v1 = sanitizePlayableVideoUrl(ep.videoUrl);
                      const v2 = sanitizePlayableVideoUrl(ep.videoUrl2);
                      const v3 = sanitizePlayableVideoUrl(ep.videoUrl3);
                      const v4 = sanitizePlayableVideoUrl(ep.videoUrl4);
                      const v5 = sanitizePlayableVideoUrl(ep.videoUrl5);
                      const hasPlayableSource = Boolean(v1 || v2 || v3 || v4 || v5);
                      const published = ep.published === true && hasPlayableSource;
                      const epTitle = ep.title?.trim() || `Episódio ${ep.number}`;
                      const badgesPatch = resolveEpisodeBadgesPatch({
                        recentBadges: ep.recentBadges,
                      });

                      await tx.query(
                        `INSERT INTO "catalog_episode" (
                           "id", "animeId", "seasonNumber", "number",
                           "title", "thumbnail", "duration", "synopsis",
                           "videoUrl", "videoUrl2", "videoUrl3", "videoUrl4", "videoUrl5",
                           "hikari_player_episode_id",
                           "badge_lancamento", "badge_novo", "badge_final",
                           "published", "publishedAt", "createdAt", "updatedAt"
                         )
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $15, $17, $18, $19, $14,
                                 CASE WHEN $14 = true THEN CURRENT_TIMESTAMP ELSE NULL END,
                                 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                         ON CONFLICT ("id") DO UPDATE
                         SET
                           "seasonNumber" = EXCLUDED."seasonNumber",
                           "number" = EXCLUDED."number",
                           "title" = COALESCE(EXCLUDED."title", "catalog_episode"."title"),
                           "thumbnail" = COALESCE(EXCLUDED."thumbnail", "catalog_episode"."thumbnail"),
                           "duration" = COALESCE(EXCLUDED."duration", "catalog_episode"."duration"),
                           "synopsis" = COALESCE(EXCLUDED."synopsis", "catalog_episode"."synopsis"),
                           "videoUrl" = EXCLUDED."videoUrl",
                           "videoUrl2" = EXCLUDED."videoUrl2",
                           "videoUrl3" = EXCLUDED."videoUrl3",
                           "videoUrl4" = EXCLUDED."videoUrl4",
                           "videoUrl5" = EXCLUDED."videoUrl5",
                           "hikari_player_episode_id" = CASE
                             WHEN $16 = true THEN EXCLUDED."hikari_player_episode_id"
                             ELSE "catalog_episode"."hikari_player_episode_id"
                           END,
                           "badge_lancamento" = CASE
                             WHEN $20 = true THEN EXCLUDED."badge_lancamento"
                             ELSE "catalog_episode"."badge_lancamento"
                           END,
                           "badge_novo" = CASE
                             WHEN $21 = true THEN EXCLUDED."badge_novo"
                             ELSE "catalog_episode"."badge_novo"
                           END,
                           "badge_final" = CASE
                             WHEN $22 = true THEN EXCLUDED."badge_final"
                             ELSE "catalog_episode"."badge_final"
                           END,
                           "published" = EXCLUDED."published",
                           "updatedAt" = CURRENT_TIMESTAMP;`,
                        [
                          ep.id,
                          anime.id,
                          season.number,
                          ep.number,
                          epTitle,
                          ep.thumbnail?.trim() || null,
                          ep.duration?.trim() || null,
                          ep.synopsis?.trim() || null,
                          v1,
                          v2,
                          v3,
                          v4,
                          v5,
                          published,
                          hasHikariPlayerField ? hikariPlayerValidation.value : null,
                          hasHikariPlayerField,
                          badgesPatch.badgeLancamento,
                          badgesPatch.badgeNovo,
                          badgesPatch.badgeFinal,
                          badgesPatch.hasLancamentoField,
                          badgesPatch.hasNovoField,
                          badgesPatch.hasFinalField,
                        ],
                      );
                      const candidateSlots = [
                        { url: v1, priority: 0 },
                        { url: v2, priority: 1 },
                        { url: v3, priority: 2 },
                        { url: v4, priority: 3 },
                        { url: v5, priority: 4 },
                      ];
                      if (candidateSlots.some((slot) => Boolean(slot.url && parseAnitube22PlayerUrl(slot.url)))) {
                        importedEpisodeSources.push({
                          episodeId: ep.id,
                          slots: candidateSlots,
                        });
                      }
                      await reconcileEpisodeIdentityReferences(tx, {
                        animeId: anime.id,
                        episodeId: ep.id,
                        seasonNumber: season.number,
                        number: ep.number,
                      });
                      importedEpisodes++;
                    }
                  }
                }
              });
            }

            if (importedEpisodeSources.length > 0) {
              await runWithConcurrency(
                importedEpisodeSources.map((item) => () =>
                  syncCatalogEpisodeSlotsToSources(item.episodeId, item.slots, {
                    replaceAnitube22: true,
                    skipProbe: true,
                  }),
                ),
                SOURCE_SYNC_CONCURRENCY,
              );
            }

            // Importação de Configurações se houver
            if (settingsMap && typeof settingsMap === "object") {
              await saveSettingsToDb(settingsMap as any);
              importedSettings = Object.keys(settingsMap).length;
            }

            // Invalidação geral de caches
            await invalidateCatalogEpisodesCacheAsync(...Array.from(affectedAnimeIds));
            invalidateHomePublicEpisodesCache();
            await invalidateServerCatalogCachesAsync(undefined, {
              extraIds: Array.from(affectedAnimeIds),
            });
            invalidatePublicSettingsCache();

            return Response.json({
              ok: true,
              adminId,
              message: "Importação concluída com sucesso no Neon PostgreSQL!",
              imported: {
                animes: importedAnimes,
                seasons: importedSeasons,
                episodes: importedEpisodes,
                settings: importedSettings,
              },
            });
          }

          return Response.json({ error: "Ação não suportada." }, { status: 400 });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: err.status });
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("[api/admin/backup] Erro de importação:", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Erro interno durante a importação." },
            { status: 500 },
          );
        }
      },
    },
  },
});
