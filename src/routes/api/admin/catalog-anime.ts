import { createFileRoute } from "@tanstack/react-router";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import { getSql, withTransaction } from "@/lib/db";
import { invalidateCatalogEpisodesCacheAsync } from "@/lib/catalog-episodes";
import { invalidateHomePublicEpisodesCache } from "@/lib/home-episodes";
import {
  animeAdminPostSchema,
  executeAdminArchiveCatalogAnime,
  executeAdminUpsertCatalogAnime,
  sanitizeAdminCatalogImageUrl,
} from "@/lib/catalog-admin-ops.server";
import {
  findCanonicalCatalogAnime,
  mergeEpisodeHistory,
  parseEpisodeHistoryArray,
} from "@/lib/anime-identity";

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

          try {
            sanitizeAdminCatalogImageUrl(data.cover);
            sanitizeAdminCatalogImageUrl(data.banner);
          } catch (imgErr) {
            return Response.json(
              { error: imgErr instanceof Error ? imgErr.message : "URL de imagem inválida." },
              { status: 400 },
            );
          }

          const result = await executeAdminUpsertCatalogAnime(data);

          return Response.json({
            ok: true,
            animeId: result.animeId,
            reusedOriginalId: result.reusedOriginalId,
            matchedBy: result.matchedBy,
            aliases: result.aliases,
            cover: result.cover,
            banner: result.banner,
            updatedAt: result.updatedAt,
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
              const seasonEpRows = await tx.query<{
                id: string;
                seasonNumber: number | null;
                number: number;
              }>(
                `SELECT "id", "seasonNumber", "number"
                 FROM "catalog_episode"
                 WHERE "animeId" = $1 AND "seasonNumber" = $2;`,
                [resolvedAnimeId, seasonNumber],
              );

              if (seasonEpRows.length > 0) {
                const animeRows = await tx.query<{ episode_history: unknown }>(
                  `SELECT "episode_history" FROM "catalog_anime" WHERE "id" = $1 LIMIT 1;`,
                  [resolvedAnimeId],
                );
                const mergedSeasonHist = mergeEpisodeHistory(
                  parseEpisodeHistoryArray(animeRows[0]?.episode_history),
                  seasonEpRows.map((ep) => ({
                    episodeId: ep.id,
                    seasonNumber: Number(ep.seasonNumber ?? seasonNumber),
                    number: Number(ep.number),
                  })),
                );
                await tx.query(
                  `UPDATE "catalog_anime"
                   SET "episode_history" = $2::jsonb,
                       "updatedAt" = CURRENT_TIMESTAMP
                   WHERE "id" = $1;`,
                  [resolvedAnimeId, JSON.stringify(mergedSeasonHist)],
                );
              }

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
          const archiveResult = await executeAdminArchiveCatalogAnime(animeId);

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
