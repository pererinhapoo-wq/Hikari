import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import { sanitizePlayableVideoUrl } from "@/lib/published-episodes";
import { getSql } from "@/lib/db";
import { invalidateCatalogEpisodesCache } from "@/lib/catalog-episodes";

function sanitizeVideoUrl(url?: string | null): string | null {
  return sanitizePlayableVideoUrl(url);
}

const episodeImportSchema = z.object({
  id: z.string().trim().min(1, "id do episódio é obrigatório").max(128),
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
  published: z.boolean().optional(),
});

const seasonImportSchema = z.object({
  id: z.string().optional().nullable(),
  number: z.number().int().min(1),
  title: z.string().max(255).optional().nullable(),
  position: z.number().int().min(0).optional().nullable(),
  episodes: z.array(episodeImportSchema).default([]),
});

const animeImportSchema = z.object({
  id: z.string().trim().min(1, "id do anime é obrigatório").max(128),
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
  seasons: z.array(seasonImportSchema).default([]),
});

const batchImportPayloadSchema = z.object({
  animes: z
    .array(animeImportSchema)
    .min(1, "O lote deve conter pelo menos 1 anime.")
    .max(100, "Limite máximo de 100 animes por requisição excedido."),
});

export const Route = createFileRoute("/api/admin/catalog-import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Validação Same-Site e verificação de privilégio de administrador
          assertSameSiteRequest();
          const adminId = await requireAdminUser(request);

          // 2. Parse e validação do payload com Zod
          let rawBody: unknown;
          try {
            rawBody = await request.json();
          } catch {
            return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
          }

          const parsed = batchImportPayloadSchema.safeParse(rawBody);
          if (!parsed.success) {
            const firstMsg = parsed.error.issues[0]?.message || "Dados de lote inválidos.";
            return Response.json(
              { ok: false, error: firstMsg, details: parsed.error.issues },
              { status: 400 },
            );
          }

          const animes = parsed.data.animes;
          const sql = await getSql();

          let animeProcessedCount = 0;
          let seasonProcessedCount = 0;
          let episodeProcessedCount = 0;
          const errors: string[] = [];
          const affectedAnimeIds = new Set<string>();

          // 3. Execução transacional para integridade completa do lote
          await sql.query("BEGIN;");

          try {
            for (const anime of animes) {
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

              // 3.1 Upsert do anime em catalog_anime
              await sql.query(
                `INSERT INTO "catalog_anime" (
                   "id", "title", "titleEnglish", "titleNative",
                   "cover", "banner", "synopsis",
                   "format", "status", "episodesCount", "season",
                   "year", "genres", "trailerId",
                   "createdAt", "updatedAt"
                 )
                 VALUES (
                   $1, $2, $3, $4,
                   $5, $6, $7,
                   $8, $9, $10, $11,
                   $12, $13, $14,
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                 )
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
                   "genres" = CASE
                     WHEN cardinality(EXCLUDED."genres") > 0 THEN EXCLUDED."genres"
                     ELSE "catalog_anime"."genres"
                   END,
                   "trailerId" = COALESCE(EXCLUDED."trailerId", "catalog_anime"."trailerId"),
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
                ],
              );
              animeProcessedCount++;
              affectedAnimeIds.add(anime.id);

              // 3.2 Upsert de cada temporada em catalog_season
              for (const season of anime.seasons) {
                const sTitle = season.title?.trim() || `Temporada ${season.number}`;
                const sPos =
                  season.position !== undefined && season.position !== null
                    ? season.position
                    : season.number - 1;
                await sql.query(
                  `INSERT INTO "catalog_season" ("animeId", "number", "title", "position", "createdAt")
                   VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                   ON CONFLICT ("animeId", "number") DO UPDATE
                   SET
                     "title" = COALESCE(EXCLUDED."title", "catalog_season"."title"),
                     "position" = EXCLUDED."position";`,
                  [anime.id, season.number, sTitle, sPos],
                );
                seasonProcessedCount++;

                // 3.3 Upsert e verificação de conflitos de cada episódio
                for (const ep of season.episodes) {
                  const v1 = sanitizeVideoUrl(ep.videoUrl);
                  const v2 = sanitizeVideoUrl(ep.videoUrl2);
                  const v3 = sanitizeVideoUrl(ep.videoUrl3);
                  const v4 = sanitizeVideoUrl(ep.videoUrl4);
                  const v5 = sanitizeVideoUrl(ep.videoUrl5);
                  const hasPlayableSource = Boolean(v1 || v2 || v3 || v4 || v5);

                  // Validação das duas regras de unicidade dos episódios
                  // Regra 1: ID não pode pertencer a outro anime
                  const existingById = await sql.query<{ id: string; animeId: string }>(
                    `SELECT "id", "animeId" FROM "catalog_episode" WHERE "id" = $1 LIMIT 1;`,
                    [ep.id],
                  );

                  if (existingById.length > 0 && existingById[0].animeId !== anime.id) {
                    throw new Error(
                      `Conflito: episódio "${ep.id}" já pertence a outro anime (${existingById[0].animeId}).`,
                    );
                  }

                  // Regra 2: O slot (animeId, seasonNumber, number) não pode estar ocupado por outro ID
                  const existingBySlot = await sql.query<{ id: string }>(
                    `SELECT "id" FROM "catalog_episode"
                     WHERE "animeId" = $1 AND "seasonNumber" = $2 AND "number" = $3 AND "id" != $4 LIMIT 1;`,
                    [anime.id, season.number, ep.number, ep.id],
                  );

                  if (existingBySlot.length > 0) {
                    throw new Error(
                      `Conflito: episódio número ${ep.number} da temporada ${season.number} do anime "${anime.id}" já existe com outro ID ("${existingBySlot[0].id}").`,
                    );
                  }

                  const published = ep.published === true && hasPlayableSource;
                  const epTitle = ep.title?.trim() || `Episódio ${ep.number}`;

                  await sql.query(
                    `INSERT INTO "catalog_episode" (
                       "id", "animeId", "seasonNumber", "number",
                       "title", "thumbnail", "duration", "synopsis",
                       "videoUrl", "videoUrl2", "videoUrl3", "videoUrl4", "videoUrl5",
                       "published", "publishedAt", "createdAt", "updatedAt"
                     )
                     VALUES (
                       $1, $2, $3, $4,
                       $5, $6, $7, $8,
                       $9, $10, $11, $12, $13,
                       $14,
                       CASE WHEN $14 = true THEN CURRENT_TIMESTAMP ELSE NULL END,
                       CURRENT_TIMESTAMP,
                       CURRENT_TIMESTAMP
                     )
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
                       "published" = EXCLUDED."published",
                       "publishedAt" = CASE
                         WHEN EXCLUDED."published" = true AND "catalog_episode"."publishedAt" IS NULL THEN CURRENT_TIMESTAMP
                         WHEN EXCLUDED."published" = false THEN NULL
                         ELSE "catalog_episode"."publishedAt"
                       END,
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
                    ],
                  );
                  episodeProcessedCount++;
                }
              }
            }

            await sql.query("COMMIT;");
          } catch (txErr) {
            await sql.query("ROLLBACK;");
            const msg = txErr instanceof Error ? txErr.message : "Erro na transação de importação.";
            return Response.json(
              {
                ok: false,
                animeCount: 0,
                seasonCount: 0,
                episodeCount: 0,
                error: msg,
                errors: [msg],
              },
              { status: 409 },
            );
          }

          // Invalida cache de episódios dos animes afetados
          for (const aId of affectedAnimeIds) {
            invalidateCatalogEpisodesCache(aId);
          }

          return Response.json({
            ok: true,
            animeCount: animeProcessedCount,
            seasonCount: seasonProcessedCount,
            episodeCount: episodeProcessedCount,
            errors,
            adminId,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json(
              { ok: false, error: "Origem cruzada não permitida." },
              { status: err.status },
            );
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ ok: false, error: err.message }, { status: err.status });
          }

          console.error("[catalog-import] Erro interno durante importação por lote:", err);
          return Response.json(
            {
              ok: false,
              error: err instanceof Error ? err.message : "Erro interno do servidor.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
