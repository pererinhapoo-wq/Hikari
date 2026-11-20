import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { requireAdminUser } from "@/lib/auth/admin-guard";
import {
  fetchOpeningSuggestionsCascade,
  type OpeningEpisodeQuery,
  type OpeningSuggestion,
} from "@/lib/opening-providers";

const episodeItemSchema = z.object({
  seasonNumber: z.number().int().min(1).max(1000).default(1),
  episodeNumber: z.number().int().positive("Número do episódio deve ser positivo"),
  episodeLengthSeconds: z.number().int().min(0).max(86400).optional().nullable(),
});

const requestSchema = z
  .object({
    malId: z.number().int().positive("MAL ID deve ser um número positivo").optional().nullable(),
    anilistId: z.number().int().positive("AniList ID deve ser um número positivo").optional().nullable(),
    kitsuId: z.number().int().positive("Kitsu ID deve ser um número positivo").optional().nullable(),
    seasonNumber: z.number().int().min(1).max(1000).optional(),
    episodeNumbers: z.array(z.number().int().positive()).max(200).optional(),
    episodes: z.array(episodeItemSchema).max(200).optional(),
    previousSeasonMaxEpisodes: z.record(z.string(), z.number().int().min(0)).optional(),
  })
  .refine(
    (data) => Boolean(data.malId || data.anilistId || data.kitsuId),
    "Informe ao menos um identificador válido do anime (MAL ID, AniList ID ou Kitsu ID).",
  )
  .refine(
    (data) =>
      (Array.isArray(data.episodes) && data.episodes.length > 0) ||
      (Array.isArray(data.episodeNumbers) && data.episodeNumbers.length > 0),
    "Informe ao menos um número de episódio.",
  );

export const Route = createFileRoute("/api/admin/opening-suggestions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          assertSameSiteRequest();
          await requireAdminUser(request);

          let rawBody: unknown;
          try {
            rawBody = await request.json();
          } catch {
            return Response.json({ error: "JSON inválido." }, { status: 400 });
          }

          const parsed = requestSchema.safeParse(rawBody);
          if (!parsed.success) {
            const firstError = parsed.error.issues[0]?.message || "Dados inválidos.";
            return Response.json({ error: firstError }, { status: 400 });
          }

          const {
            malId,
            anilistId,
            kitsuId,
            seasonNumber,
            episodeNumbers,
            episodes,
            previousSeasonMaxEpisodes,
          } = parsed.data;

          const episodeQueries: OpeningEpisodeQuery[] =
            episodes && episodes.length > 0
              ? episodes.map((ep) => ({
                  seasonNumber: ep.seasonNumber,
                  episodeNumber: ep.episodeNumber,
                  episodeLengthSeconds: ep.episodeLengthSeconds ?? 0,
                }))
              : (episodeNumbers ?? []).map((epNum) => ({
                  seasonNumber: seasonNumber ?? 1,
                  episodeNumber: epNum,
                  episodeLengthSeconds: 0,
                }));

          const prevMaxMap: Record<number, number> = {};
          if (previousSeasonMaxEpisodes) {
            for (const [k, v] of Object.entries(previousSeasonMaxEpisodes)) {
              const numKey = Number(k);
              if (Number.isInteger(numKey) && numKey > 0) {
                prevMaxMap[numKey] = v;
              }
            }
          }

          const cascadeResult = await fetchOpeningSuggestionsCascade(
            {
              malId: malId ?? null,
              anilistId: anilistId ?? null,
              kitsuId: kitsuId ?? null,
            },
            episodeQueries,
            {
              previousSeasonMaxEpisodes: prevMaxMap,
            },
          );

          const suggestionsByNumber: Record<number, OpeningSuggestion> = {};
          const suggestionsByKey: Record<string, OpeningSuggestion> = {};

          for (const item of cascadeResult.suggestions) {
            const key = `${item.seasonNumber}:${item.episodeNumber}`;
            suggestionsByKey[key] = item;
            if (!(item.episodeNumber in suggestionsByNumber)) {
              suggestionsByNumber[item.episodeNumber] = item;
            }
          }

          return Response.json({
            malId: cascadeResult.resolvedIds.malId,
            anilistId: cascadeResult.resolvedIds.anilistId,
            resolvedIds: {
              tvdbId: cascadeResult.resolvedIds.tvdbId,
              tmdbId: cascadeResult.resolvedIds.tmdbId,
              imdbId: cascadeResult.resolvedIds.imdbId,
              source: cascadeResult.resolvedIds.source,
            },
            relationRulesFound: cascadeResult.relationRulesFound,
            suggestions: suggestionsByNumber,
            suggestionsByKey,
          });
        } catch (err) {
          const status = (err as { status?: number })?.status || 500;
          const msg =
            err instanceof Error
              ? err.message
              : "Erro interno ao buscar sugestões de opening.";
          return Response.json(
            { error: msg },
            { status: status === 401 || status === 403 ? status : 500 },
          );
        }
      },
    },
  },
});
