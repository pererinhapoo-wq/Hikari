import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import {
  ANITUBE22_PROVIDER,
  normalizeSourceLang,
  partitionEpisodeSourcesByLang,
} from "@/lib/anitube22";
import {
  checkAndRecordEpisodeSource,
  deleteEpisodeSourceById,
  listEpisodeSources,
  probeAnitube22PlayerUrl,
  recordEpisodeSourceIndexResult,
  SourceValidationError,
  upsertEpisodeSource,
} from "@/lib/sources";
import { getSql } from "@/lib/db";
import { invalidateCatalogEpisodesCacheAsync } from "@/lib/catalog-episodes";
import { invalidateHomePublicEpisodesCacheAsync } from "@/lib/home-episodes";
import { invalidateServerCatalogCachesAsync } from "@/lib/api";
import { findCanonicalCatalogAnime, getAllAliasIdsForCanonical } from "@/lib/anime-identity";

async function invalidateCachesForEpisodeSource(
  episodeId?: string | null,
  explicitAnimeId?: string | null,
): Promise<void> {
  try {
    const sql = await getSql();
    let resolvedAnimeId = explicitAnimeId?.trim() || "";
    if (!resolvedAnimeId && episodeId?.trim()) {
      const epRows = await sql.query<{ animeId: string }>(
        `SELECT "animeId" FROM "catalog_episode" WHERE "id" = $1 LIMIT 1;`,
        [episodeId.trim()],
      );
      resolvedAnimeId = epRows[0]?.animeId?.trim() || "";
    }

    if (resolvedAnimeId) {
      const lookup = await findCanonicalCatalogAnime(sql, { id: resolvedAnimeId });
      const matched = lookup.row;
      const canonicalId = lookup.canonicalId || resolvedAnimeId;
      const aliases = await getAllAliasIdsForCanonical(sql, canonicalId);
      const allIds = Array.from(
        new Set([
          resolvedAnimeId,
          canonicalId,
          matched?.id,
          ...aliases,
          matched?.anilistId ? String(matched.anilistId) : undefined,
          matched?.malId ? `mal-${matched.malId}` : undefined,
          matched?.kitsuId ? `kitsu-${matched.kitsuId}` : undefined,
        ].filter((v): v is string => Boolean(v))),
      );

      await invalidateCatalogEpisodesCacheAsync(...allIds);
      await invalidateHomePublicEpisodesCacheAsync();
      await invalidateServerCatalogCachesAsync(canonicalId, {
        anilistId: matched?.anilistId,
        malId: matched?.malId,
        kitsuId: matched?.kitsuId,
        extraIds: allIds,
      });
      return;
    }

    await invalidateHomePublicEpisodesCacheAsync();
  } catch (err) {
    console.warn("[api/episode-sources] Falha ao invalidar cache após alteração de fonte:", err);
  }
}

const checkSchema = z
  .object({
    action: z.literal("check"),
    sourceId: z.string().trim().min(1).optional(),
    playerUrl: z.string().trim().min(1).max(2048).optional(),
    clientOffline: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.sourceId || data.playerUrl), {
    message: "sourceId ou playerUrl é obrigatório.",
  });

const reportSchema = z.object({
  action: z.literal("report"),
  sourceId: z.string().trim().min(1),
  httpStatus: z.number().int().min(100).max(599).optional().nullable(),
  clientNetworkError: z.boolean().optional(),
});

const upsertSchema = z.object({
  action: z.literal("upsert"),
  episodeId: z.string().trim().min(1).max(128),
  animeId: z.string().trim().max(128).optional().nullable(),
  provider: z.string().trim().max(64).optional().default(ANITUBE22_PROVIDER),
  externalId: z.string().trim().min(1).max(2048),
  lang: z.enum(["sub", "dub"], {
    message: "Selecione o idioma da fonte (legendado ou dublado).",
  }),
  quality: z.string().trim().max(32).optional().nullable(),
  priority: z.number().int().min(0).max(1000).optional().default(0),
});

const deleteSchema = z.object({
  action: z.literal("delete"),
  sourceId: z.string().trim().min(1),
  animeId: z.string().trim().max(128).optional().nullable(),
});

const postSchema = z.discriminatedUnion("action", [
  checkSchema,
  reportSchema,
  upsertSchema,
  deleteSchema,
]);

export const Route = createFileRoute("/api/episode-sources")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const episodeId = (url.searchParams.get("episodeId") || "").trim();
          if (!episodeId) {
            return Response.json(
              { ok: false, error: "episodeId é obrigatório." },
              { status: 400 },
            );
          }

          const rawLang = url.searchParams.get("lang");
          const includeBroken = url.searchParams.get("includeBroken") === "1";
          const lang = rawLang ? normalizeSourceLang(rawLang) : undefined;

          const allSources = await listEpisodeSources(episodeId, {
            includeBroken,
            lang,
          });
          const { sub, dub } = partitionEpisodeSourcesByLang(allSources);

          return Response.json({
            ok: true,
            episodeId,
            sub,
            dub,
            sources: allSources,
          });
        } catch (err) {
          console.error("[api/episode-sources] Erro ao listar fontes:", err);
          return Response.json(
            { ok: false, error: "Erro ao consultar fontes do episódio." },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          let rawBody: unknown;
          try {
            rawBody = await request.json();
          } catch {
            return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
          }

          const parsed = postSchema.safeParse(rawBody);
          if (!parsed.success) {
            return Response.json(
              {
                ok: false,
                error: parsed.error.issues[0]?.message || "Requisição inválida.",
              },
              { status: 400 },
            );
          }

          const payload = parsed.data;

          if (payload.action === "check") {
            if (payload.sourceId) {
              const result = await checkAndRecordEpisodeSource(payload.sourceId, {
                clientOffline: payload.clientOffline,
              });
              return Response.json(result);
            }
            const result = await probeAnitube22PlayerUrl(payload.playerUrl || "", {
              clientOffline: payload.clientOffline,
            });
            return Response.json(result);
          }

          assertSameSiteRequest();

          if (payload.action === "report") {
            const result = await recordEpisodeSourceIndexResult({
              sourceId: payload.sourceId,
              httpStatus: payload.httpStatus,
              clientNetworkError: payload.clientNetworkError,
            });
            return Response.json({ ok: true, ...result });
          }

          await requireAdminUser(request);

            if (payload.action === "upsert") {
            const source = await upsertEpisodeSource({
              episodeId: payload.episodeId,
              provider: payload.provider,
              externalId: payload.externalId,
              lang: payload.lang,
              quality: payload.quality ?? null,
              priority: payload.priority,
            });
            if (!source) {
              return Response.json(
                { ok: false, error: "Identificador externo da fonte inválido." },
                { status: 400 },
              );
            }
            await invalidateCachesForEpisodeSource(payload.episodeId, payload.animeId);
            return Response.json({ ok: true, source });
          }

          if (payload.action === "delete") {
            let lookupEpisodeId: string | null = null;
            try {
              const sql = await getSql();
              const existing = await sql.query<{ episode_id: string }>(
                `SELECT "episode_id" FROM "episode_sources" WHERE "id" = $1 LIMIT 1;`,
                [payload.sourceId.trim()],
              );
              lookupEpisodeId = existing[0]?.episode_id ?? null;
            } catch {
              // ignore lookup failure
            }
            const deleted = await deleteEpisodeSourceById(payload.sourceId);
            if (deleted || payload.animeId || lookupEpisodeId) {
              await invalidateCachesForEpisodeSource(lookupEpisodeId, payload.animeId);
            }
            return Response.json({ ok: true, deleted });
          }

          return Response.json({ ok: false, error: "Ação não suportada." }, { status: 400 });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ ok: false, error: "Origem cruzada não permitida." }, { status: err.status });
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ ok: false, error: err.message }, { status: err.status });
          }
          if (err instanceof SourceValidationError) {
            return Response.json({ ok: false, error: err.message }, { status: err.statusCode });
          }
          console.error("[api/episode-sources] Erro:", err);
          return Response.json(
            { ok: false, error: "Erro interno ao gerenciar fontes do episódio." },
            { status: 500 },
          );
        }
      },
    },
  },
});
