import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import { getSql } from "@/lib/db";
import { invalidateCatalogEpisodesCache } from "@/lib/catalog-episodes";

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
  seasons: z.array(seasonItemSchema).optional().nullable(),
});

const animeAdminDeleteSchema = z.object({
  id: z.string().trim().min(1, "id é obrigatório"),
});

export const Route = createFileRoute("/api/admin/catalog-anime")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Validar same-site
          assertSameSiteRequest();

          // 2. Validar administrador
          const adminId = await requireAdminUser(request);

          // 3. Validar payload com Zod
          let rawBody: unknown;
          try {
            rawBody = await request.json();
          } catch {
            return Response.json({ error: "JSON inválido." }, { status: 400 });
          }

          const parsed = animeAdminPostSchema.safeParse(rawBody);
          if (!parsed.success) {
            const firstError = parsed.error.issues[0]?.message || "Dados inválidos.";
            return Response.json({ error: firstError, details: parsed.error.issues }, { status: 400 });
          }

          const data = parsed.data;
          const sql = await getSql();

          const canonicalTitle =
            data.title?.trim() ||
            data.titleRomaji?.trim() ||
            data.titleEnglish?.trim() ||
            data.titleNative?.trim() ||
            data.id;

          const genresArray = Array.isArray(data.genres)
            ? data.genres.map((g) => g.trim()).filter(Boolean)
            : null;

          // 4. Execução em transação para garantir consistência entre anime e temporadas
          const result = await sql.query<{ id: string }>(
            `INSERT INTO "catalog_anime" (
               "id", "title", "anilistId", "malId", "kitsuId",
               "titleRomaji", "titleEnglish", "titleNative",
               "cover", "banner", "synopsis", "format", "status",
               "episodesCount", "year", "season", "genres", "trailerId",
               "createdAt", "updatedAt"
             )
             VALUES (
               $1, $2, $3, $4, $5,
               $6, $7, $8,
               $9, $10, $11, $12, $13,
               $14, $15, $16,
               COALESCE($17::text[], '{}'::text[]),
               $18,
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
               "cover" = COALESCE(EXCLUDED."cover", "catalog_anime"."cover"),
               "banner" = COALESCE(EXCLUDED."banner", "catalog_anime"."banner"),
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
               "updatedAt" = CURRENT_TIMESTAMP
             RETURNING "id";`,
            [
              data.id,
              canonicalTitle,
              data.anilistId ?? null,
              data.malId ?? null,
              data.kitsuId ?? null,
              data.titleRomaji?.trim() ?? null,
              data.titleEnglish?.trim() ?? null,
              data.titleNative?.trim() ?? null,
              data.cover?.trim() ?? null,
              data.banner?.trim() ?? null,
              data.synopsis?.trim() ?? null,
              data.format?.trim() ?? null,
              data.status?.trim() ?? null,
              data.episodesCount ?? null,
              data.year ?? null,
              data.season?.trim() ?? null,
              genresArray,
              data.trailerId?.trim() ?? null,
            ],
          );

          // 5. Upsert das temporadas quando fornecidas no payload (sem apagar existentes)
          if (Array.isArray(data.seasons) && data.seasons.length > 0) {
            for (let i = 0; i < data.seasons.length; i++) {
              const s = data.seasons[i];
              const seasonNum = s.number;
              const seasonTitle = s.title?.trim() || `Temporada ${seasonNum}`;
              const seasonPos = s.position ?? i;

              await sql.query(
                `INSERT INTO "catalog_season" ("animeId", "number", "title", "position", "createdAt")
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                 ON CONFLICT ("animeId", "number") DO UPDATE
                 SET
                   "title" = COALESCE(EXCLUDED."title", "catalog_season"."title"),
                   "position" = EXCLUDED."position";`,
                [data.id, seasonNum, seasonTitle, seasonPos],
              );
            }
          }

          invalidateCatalogEpisodesCache(data.id);

          return Response.json({
            ok: true,
            animeId: result[0]?.id || data.id,
            adminId,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: err.status });
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
          // 1. Validar same-site
          assertSameSiteRequest();

          // 2. Validar administrador
          const adminId = await requireAdminUser(request);

          // 3. Obter ID do anime a ser excluído
          let animeId = "";
          const url = new URL(request.url);
          const qId = url.searchParams.get("id");

          if (qId) {
            animeId = qId.trim();
          } else {
            try {
              const body = await request.json();
              const parsed = animeAdminDeleteSchema.safeParse(body);
              if (parsed.success) {
                animeId = parsed.data.id;
              }
            } catch {
              // Body vazio ou não JSON
            }
          }

          if (!animeId) {
            return Response.json({ error: "Identificador 'id' do anime é obrigatório." }, { status: 400 });
          }

          const sql = await getSql();

          // Exclusão em cascata (catalog_season e catalog_episode possuem ON DELETE CASCADE)
          const result = await sql.query<{ id: string }>(
            `DELETE FROM "catalog_anime"
             WHERE "id" = $1
             RETURNING "id";`,
            [animeId],
          );

          invalidateCatalogEpisodesCache(animeId);

          return Response.json({
            ok: true,
            deletedId: animeId,
            found: result.length > 0,
            adminId,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: err.status });
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
