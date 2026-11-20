import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { requireAdminUser } from "@/lib/auth/admin-guard";
import { fetchAniSkipTimestamps, fetchAniSkipRelationRules, formatSecondsToTime } from "@/lib/aniskip";

const requestSchema = z.object({
  malId: z.number().int().positive("MAL ID deve ser um número positivo"),
  episodeNumbers: z.array(z.number().int().positive()).min(1, "Informe ao menos um número de episódio"),
});

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

          const { malId, episodeNumbers } = parsed.data;

          const relationRules = await fetchAniSkipRelationRules(malId);

          const results: Record<
            number,
            {
              found: boolean;
              startSeconds: number | null;
              endSeconds: number | null;
              startTime: string;
              endTime: string;
            }
          > = {};

          for (const epNum of episodeNumbers) {
            const skipData = await fetchAniSkipTimestamps(malId, epNum);
            results[epNum] = {
              found: skipData.found,
              startSeconds: skipData.openingStartSeconds,
              endSeconds: skipData.openingEndSeconds,
              startTime: formatSecondsToTime(skipData.openingStartSeconds),
              endTime: formatSecondsToTime(skipData.openingEndSeconds),
            };
          }

          return Response.json({
            malId,
            relationRulesFound: relationRules.found,
            suggestions: results,
          });
        } catch (err) {
          const status = (err as { status?: number })?.status || 500;
          const msg = err instanceof Error ? err.message : "Erro interno ao buscar sugestões de opening.";
          return Response.json({ error: msg }, { status: status === 401 || status === 403 ? status : 500 });
        }
      },
    },
  },
});
