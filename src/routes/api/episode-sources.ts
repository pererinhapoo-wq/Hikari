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
import { invalidateCatalogEpisodesCache } from "@/lib/catalog-episodes";

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
            if (payload.animeId) {
              invalidateCatalogEpisodesCache(payload.animeId);
            }
            return Response.json({ ok: true, source });
          }

          if (payload.action === "delete") {
            const deleted = await deleteEpisodeSourceById(payload.sourceId);
            if (payload.animeId) {
              invalidateCatalogEpisodesCache(payload.animeId);
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
