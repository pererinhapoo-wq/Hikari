import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import { getSql } from "@/lib/db";
import { invalidateCatalogEpisodesCache } from "@/lib/catalog-episodes";
import { invalidateServerCatalogCaches } from "@/lib/api";
import { stripCatalogImageVersion } from "@/lib/image-utils";

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

          // Validação e sanitização estrita de imagens
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

          const existingRows = await sql.query<{
            id: string;
            title: string;
            titleRomaji: string | null;
            titleEnglish: string | null;
            titleNative: string | null;
            anilistId: number | null;
            malId: number | null;
            kitsuId: number | null;
          }>(
            `SELECT "id", "title", "titleRomaji", "titleEnglish", "titleNative", "anilistId", "malId", "kitsuId"
             FROM "catalog_anime"
             WHERE "id" = $1
                OR ($2::int IS NOT NULL AND "anilistId" = $2)
                OR ($3::int IS NOT NULL AND "malId" = $3)
                OR ($4::int IS NOT NULL AND "kitsuId" = $4);`,
            [data.id, data.anilistId ?? null, data.malId ?? null, data.kitsuId ?? null],
          );

          const isDubbedText = (t: string) => /\b(dub|dublado|dublada)\b/i.test(t);
          const incomingIsDubbed = isDubbedText(
            `${canonicalTitle} ${data.titleRomaji ?? ""} ${data.titleEnglish ?? ""} ${data.titleNative ?? ""}`,
          );

          const exactMatch = existingRows.find((r) => r.id === data.id);
          const externalMatch =
            existingRows.find(
              (r) =>
                r.id !== data.id &&
                !isDubbedText(
                  `${r.title} ${r.titleRomaji ?? ""} ${r.titleEnglish ?? ""} ${r.titleNative ?? ""}`,
                ),
            ) ?? existingRows.find((r) => r.id !== data.id);

          let targetId = data.id;
          if (!exactMatch && externalMatch && !incomingIsDubbed) {
            targetId = externalMatch.id;
          }

          let resolvedAnilistId = data.anilistId ?? null;
          let resolvedMalId = data.malId ?? null;
          let resolvedKitsuId = data.kitsuId ?? null;

          for (const r of existingRows) {
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

          const coverProvided = data.cover !== undefined;
          const bannerProvided = data.banner !== undefined;

          // 4. Execução para garantir consistência entre anime e temporadas
          const result = await sql.query<{
            id: string;
            cover: string | null;
            banner: string | null;
            anilistId: number | null;
            malId: number | null;
            kitsuId: number | null;
            updatedAt: string | Date;
          }>(
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
               "updatedAt" = CURRENT_TIMESTAMP
             RETURNING "id", "cover", "banner", "anilistId", "malId", "kitsuId", "updatedAt";`,
            [
              targetId,
              canonicalTitle,
              resolvedAnilistId,
              resolvedMalId,
              resolvedKitsuId,
              data.titleRomaji?.trim() ?? null,
              data.titleEnglish?.trim() ?? null,
              data.titleNative?.trim() ?? null,
              cleanCover,
              cleanBanner,
              data.synopsis?.trim() ?? null,
              data.format?.trim() ?? null,
              data.status?.trim() ?? null,
              data.episodesCount ?? null,
              data.year ?? null,
              data.season?.trim() ?? null,
              genresArray,
              data.trailerId?.trim() ?? null,
              coverProvided,
              bannerProvided,
            ],
          );

          const savedRow = result[0];
          const canonicalSavedId = savedRow?.id || targetId;

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
                [canonicalSavedId, seasonNum, seasonTitle, seasonPos],
              );
            }
          }

          invalidateCatalogEpisodesCache(canonicalSavedId);
          if (data.id !== canonicalSavedId) {
            invalidateCatalogEpisodesCache(data.id);
          }
          invalidateServerCatalogCaches(canonicalSavedId, {
            anilistId: savedRow?.anilistId ?? data.anilistId,
            malId: savedRow?.malId ?? data.malId,
            kitsuId: savedRow?.kitsuId ?? data.kitsuId,
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
            return Response.json({ error: "Identificador 'id' do anime é obrigatório." }, { status: 400 });
          }

          const sql = await getSql();

          if (seasonNumber !== null) {
            // Exclusão pontual de temporada específica
            const sRes = await sql.query<{ number: number }>(
              `DELETE FROM "catalog_season"
               WHERE "animeId" = $1 AND "number" = $2
               RETURNING "number";`,
              [animeId, seasonNumber],
            );

            const epRes = await sql.query<{ id: string }>(
              `DELETE FROM "catalog_episode"
               WHERE "animeId" = $1 AND "seasonNumber" = $2
               RETURNING "id";`,
              [animeId, seasonNumber],
            );

            invalidateCatalogEpisodesCache(animeId);

            return Response.json({
              ok: true,
              animeId,
              seasonNumber,
              found: sRes.length > 0,
              deletedEpisodesCount: epRes.length,
              adminId,
            });
          }

          // Exclusão em cascata (catalog_season e catalog_episode possuem ON DELETE CASCADE)
          const result = await sql.query<{
            id: string;
            anilistId: number | null;
            malId: number | null;
            kitsuId: number | null;
          }>(
            `DELETE FROM "catalog_anime"
             WHERE "id" = $1
             RETURNING "id", "anilistId", "malId", "kitsuId";`,
            [animeId],
          );

          invalidateCatalogEpisodesCache(animeId);
          invalidateServerCatalogCaches(animeId, result[0]);

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
