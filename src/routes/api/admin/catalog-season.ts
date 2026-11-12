import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import { getSql } from "@/lib/db";
import { invalidateCatalogEpisodesCache } from "@/lib/catalog-episodes";

const seasonDeleteSchema = z.object({
  animeId: z.string().trim().min(1, "animeId é obrigatório").max(128),
  seasonNumber: z.number().int().min(1, "seasonNumber deve ser >= 1"),
});

const seasonPostSchema = z.object({
  animeId: z.string().trim().min(1, "animeId é obrigatório").max(128),
  seasonNumber: z.number().int().min(1, "seasonNumber deve ser >= 1"),
  title: z.string().max(255).optional().nullable(),
  position: z.number().int().min(0).optional().nullable(),
});

export const Route = createFileRoute("/api/admin/catalog-season")({
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

          const parsed = seasonPostSchema.safeParse(rawBody);
          if (!parsed.success) {
            const firstError = parsed.error.issues[0]?.message || "Dados inválidos.";
            return Response.json({ error: firstError, details: parsed.error.issues }, { status: 400 });
          }

          const { animeId, seasonNumber, title, position } = parsed.data;
          const sql = await getSql();

          const seasonTitle = title?.trim() || `Temporada ${seasonNumber}`;
          const seasonPos = position ?? seasonNumber - 1;

          await sql.query(
            `INSERT INTO "catalog_season" ("animeId", "number", "title", "position", "createdAt")
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             ON CONFLICT ("animeId", "number") DO UPDATE
             SET
               "title" = COALESCE(EXCLUDED."title", "catalog_season"."title"),
               "position" = EXCLUDED."position";`,
            [animeId, seasonNumber, seasonTitle, seasonPos],
          );

          invalidateCatalogEpisodesCache(animeId);

          return Response.json({
            ok: true,
            animeId,
            seasonNumber,
            adminId,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: err.status });
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }

          console.error("[api/admin/catalog-season] Erro ao salvar temporada:", err);
          return Response.json(
            { error: "Erro interno ao salvar temporada.", details: String(err) },
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
          const qAnimeId = url.searchParams.get("animeId");
          const qSeasonNumber = url.searchParams.get("seasonNumber");

          if (qAnimeId && qSeasonNumber) {
            animeId = qAnimeId.trim();
            const parsedNum = parseInt(qSeasonNumber, 10);
            if (!isNaN(parsedNum)) seasonNumber = parsedNum;
          } else {
            try {
              const body = await request.json();
              const parsed = seasonDeleteSchema.safeParse(body);
              if (parsed.success) {
                animeId = parsed.data.animeId;
                seasonNumber = parsed.data.seasonNumber;
              }
            } catch {
              // Body vazio ou não JSON
            }
          }

          if (!animeId || seasonNumber === null || seasonNumber < 1) {
            return Response.json(
              { error: "Identificadores 'animeId' e 'seasonNumber' válidos são obrigatórios." },
              { status: 400 },
            );
          }

          const sql = await getSql();

          // 1. Deletar a linha correspondente em catalog_season
          const seasonResult = await sql.query<{ number: number }>(
            `DELETE FROM "catalog_season"
             WHERE "animeId" = $1 AND "number" = $2
             RETURNING "number";`,
            [animeId, seasonNumber],
          );

          // 2. Deletar os episódios vinculados a esta temporada em catalog_episode
          const episodeResult = await sql.query<{ id: string }>(
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
            found: seasonResult.length > 0,
            deletedEpisodesCount: episodeResult.length,
            adminId,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: err.status });
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }

          console.error("[api/admin/catalog-season] Erro ao excluir temporada:", err);
          return Response.json(
            { error: "Erro interno ao excluir temporada.", details: String(err) },
            { status: 500 },
          );
        }
      },
    },
  },
});
