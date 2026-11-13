import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import { isHikariPlayableUrl } from "@/lib/published-episodes";
import { getSql } from "@/lib/db";
import { invalidateCatalogEpisodesCache } from "@/lib/catalog-episodes";

const episodePostSchema = z.object({
  id: z.string().trim().min(1, "id é obrigatório").max(128, "id muito longo"),
  animeId: z.string().trim().min(1, "animeId é obrigatório").max(128, "animeId muito longo"),
  seasonNumber: z.number().int().min(1, "seasonNumber deve ser >= 1").default(1),
  number: z.number().int().min(0, "number deve ser >= 0"),
  title: z.string().max(255).optional().nullable(),
  thumbnail: z.string().max(2048).optional().nullable(),
  duration: z.string().max(64).optional().nullable(),
  synopsis: z.string().max(10000).optional().nullable(),
  videoUrl: z.string().max(2048).optional().nullable(),
  videoUrl2: z.string().max(2048).optional().nullable(),
  videoUrl3: z.string().max(2048).optional().nullable(),
  videoUrl4: z.string().max(2048).optional().nullable(),
  videoUrl5: z.string().max(2048).optional().nullable(),
  published: z.boolean().default(false),
  animeTitle: z.string().max(255).optional().nullable(),
});

const episodeDeleteSchema = z.object({
  id: z.string().trim().min(1, "id é obrigatório"),
  animeId: z.string().trim().optional().nullable(),
});

function sanitizeVideoUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "#") return null;

  // Permitir apenas URLs HTTP/HTTPS bem formadas com hostname válido
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    if (!parsed.hostname) {
      return null;
    }
  } catch {
    return null;
  }

  // Descartar páginas de catálogo ou de streaming não reproduzíveis diretamente
  if (!isHikariPlayableUrl(trimmed)) {
    return null;
  }

  return trimmed;
}

export const Route = createFileRoute("/api/admin/catalog-episode")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Validar same-site
          assertSameSiteRequest();

          // 2. Validar administrador e obter adminId
          const adminId = await requireAdminUser(request);

          // 3. Validar payload com Zod
          let rawBody: unknown;
          try {
            rawBody = await request.json();
          } catch {
            return Response.json({ error: "JSON inválido." }, { status: 400 });
          }

          const parsed = episodePostSchema.safeParse(rawBody);
          if (!parsed.success) {
            const firstError = parsed.error.issues[0]?.message || "Dados inválidos.";
            return Response.json({ error: firstError, details: parsed.error.issues }, { status: 400 });
          }

          const data = parsed.data;
          const sql = await getSql();

          // 4. Buscar registros existentes por ID e por Slot (animeId, seasonNumber, number)
          const existingByIdRows = await sql.query<{
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
            published: boolean;
            publishedAt: string | null;
          }>(
            `SELECT "id", "animeId", "seasonNumber", "number", "title", "thumbnail",
                    "duration", "synopsis", "videoUrl", "videoUrl2", "videoUrl3",
                    "videoUrl4", "videoUrl5", "published", "publishedAt"
             FROM "catalog_episode"
             WHERE "id" = $1 LIMIT 1;`,
            [data.id],
          );
          const existingById = existingByIdRows[0] || null;

          const existingBySlotRows = await sql.query<{
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
            published: boolean;
            publishedAt: string | null;
          }>(
            `SELECT "id", "animeId", "seasonNumber", "number", "title", "thumbnail",
                    "duration", "synopsis", "videoUrl", "videoUrl2", "videoUrl3",
                    "videoUrl4", "videoUrl5", "published", "publishedAt"
             FROM "catalog_episode"
             WHERE "animeId" = $1 AND "seasonNumber" = $2 AND "number" = $3 LIMIT 1;`,
            [data.animeId, data.seasonNumber, data.number],
          );
          const existingBySlot = existingBySlotRows[0] || null;

          // 5. Conflito de integridade: se o ID recebido já existe, ele NÃO pode pertencer a outro slot
          if (
            existingById &&
            (existingById.animeId !== data.animeId ||
              existingById.seasonNumber !== data.seasonNumber ||
              existingById.number !== data.number)
          ) {
            return Response.json(
              {
                error: `Conflito de integridade: o identificador "${data.id}" já está associado a outro episódio (${existingById.animeId} - Temporada ${existingById.seasonNumber}, Ep. ${existingById.number}) e não pode ser reaproveitado em outro slot.`,
                code: "ID_BOUND_TO_OTHER_SLOT",
                existingSlot: {
                  animeId: existingById.animeId,
                  seasonNumber: existingById.seasonNumber,
                  number: existingById.number,
                },
              },
              { status: 409 },
            );
          }

          // 6. Resolução canônica de ID:
          // Se o slot já existe no banco (mesmo com outro ID enviado pelo cliente), preserva o ID canônico existente.
          let canonicalId = data.id;
          let existingRow = existingById;
          if (existingBySlot) {
            canonicalId = existingBySlot.id;
            existingRow = existingBySlot;
          } else if (existingById) {
            canonicalId = existingById.id;
            existingRow = existingById;
          }

          // 7. Preservação integral de campos e fontes de vídeo (não sobrescrever fontes com vazias/null)
          function resolveSource(
            incoming: string | null | undefined,
            existing: string | null | undefined,
          ): string | null {
            if (incoming !== undefined && incoming !== null) {
              const trimmed = incoming.trim();
              if (trimmed) {
                return sanitizeVideoUrl(trimmed);
              }
            }
            return existing || null;
          }

          const v1 = resolveSource(data.videoUrl, existingRow?.videoUrl);
          const v2 = resolveSource(data.videoUrl2, existingRow?.videoUrl2);
          const v3 = resolveSource(data.videoUrl3, existingRow?.videoUrl3);
          const v4 = resolveSource(data.videoUrl4, existingRow?.videoUrl4);
          const v5 = resolveSource(data.videoUrl5, existingRow?.videoUrl5);

          const hasPlayableSource = Boolean(v1 || v2 || v3 || v4 || v5);

          // Validação de publicação: publicado exige pelo menos 1 fonte de reprodução válida
          if (data.published === true && !hasPlayableSource) {
            return Response.json(
              {
                error:
                  "Um episódio só pode ser publicado quando possuir pelo menos uma fonte válida de reprodução.",
              },
              { status: 400 },
            );
          }

          const published = Boolean(data.published && hasPlayableSource);

          // Preserva metadados existentes se formulário enviou valores vazios
          const title =
            (data.title && data.title.trim()) ||
            existingRow?.title ||
            `Episódio ${data.number}`;
          const thumbnail =
            (data.thumbnail && data.thumbnail.trim()) ||
            existingRow?.thumbnail ||
            null;
          const duration =
            (data.duration && data.duration.trim()) ||
            existingRow?.duration ||
            null;
          const synopsis =
            (data.synopsis && data.synopsis.trim()) ||
            existingRow?.synopsis ||
            null;

          // 8. Garantir que o anime e a temporada existam no catálogo
          const fallbackAnimeTitle = data.animeTitle?.trim() || data.animeId;
          await sql.query(
            `INSERT INTO "catalog_anime" ("id", "title", "createdAt", "updatedAt")
             VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT ("id") DO NOTHING;`,
            [data.animeId, fallbackAnimeTitle],
          );

          const seasonTitle = `Temporada ${data.seasonNumber}`;
          await sql.query(
            `INSERT INTO "catalog_season" ("animeId", "number", "title", "position", "createdAt")
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             ON CONFLICT ("animeId", "number") DO NOTHING;`,
            [data.animeId, data.seasonNumber, seasonTitle, data.seasonNumber - 1],
          );

          // 9. Gravação segura contra concorrência usando constraint UNIQUE (animeId, seasonNumber, number)
          const wasAlreadyPublished = existingRow?.published === true;
          const isFirstTimePublished = published && !wasAlreadyPublished;

          const upsertResult = await sql.query<{
            id: string;
            published: boolean;
            publishedAt: string | null;
          }>(
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
             ON CONFLICT ("animeId", "seasonNumber", "number") DO UPDATE
             SET
               "title" = EXCLUDED."title",
               "thumbnail" = COALESCE(NULLIF(EXCLUDED."thumbnail", ''), "catalog_episode"."thumbnail"),
               "duration" = COALESCE(NULLIF(EXCLUDED."duration", ''), "catalog_episode"."duration"),
               "synopsis" = COALESCE(NULLIF(EXCLUDED."synopsis", ''), "catalog_episode"."synopsis"),
               "videoUrl" = COALESCE(NULLIF(EXCLUDED."videoUrl", ''), "catalog_episode"."videoUrl"),
               "videoUrl2" = COALESCE(NULLIF(EXCLUDED."videoUrl2", ''), "catalog_episode"."videoUrl2"),
               "videoUrl3" = COALESCE(NULLIF(EXCLUDED."videoUrl3", ''), "catalog_episode"."videoUrl3"),
               "videoUrl4" = COALESCE(NULLIF(EXCLUDED."videoUrl4", ''), "catalog_episode"."videoUrl4"),
               "videoUrl5" = COALESCE(NULLIF(EXCLUDED."videoUrl5", ''), "catalog_episode"."videoUrl5"),
               "published" = EXCLUDED."published",
               "publishedAt" = CASE
                 WHEN EXCLUDED."published" = true AND "catalog_episode"."publishedAt" IS NULL THEN CURRENT_TIMESTAMP
                 WHEN EXCLUDED."published" = false THEN NULL
                 ELSE "catalog_episode"."publishedAt"
               END,
               "updatedAt" = CURRENT_TIMESTAMP
             RETURNING "id", "published", "publishedAt";`,
            [
              canonicalId,
              data.animeId,
              data.seasonNumber,
              data.number,
              title,
              thumbnail,
              duration,
              synopsis,
              v1,
              v2,
              v3,
              v4,
              v5,
              published,
            ],
          );

          const savedRow = upsertResult[0];
          const effectiveId = savedRow ? savedRow.id : canonicalId;
          const finalPublished = savedRow ? savedRow.published : published;
          const finalPublishedAt = savedRow ? savedRow.publishedAt : null;

          // 9. Notificações para seguidores do anime quando o episódio for publicado pela primeira vez
          if (isFirstTimePublished) {
            try {
              // Busca os usuários únicos que acompanham o anime, excluindo o administrador que publicou
              const followers = await sql.query<{ userId: string }>(
                `SELECT DISTINCT u."userId"
                 FROM (
                   SELECT "userId" FROM "user_favorite"
                   WHERE "animeId" = $1 AND "targetType" = 'anime'
                   UNION
                   SELECT l."userId"
                   FROM "user_custom_list_item" i
                   JOIN "user_custom_list" l ON l."id" = i."listId"
                   WHERE i."animeId" = $1
                   UNION
                   SELECT "userId" FROM "user_watched_episode"
                   WHERE "animeId" = $1
                 ) u
                 WHERE u."userId" != $2
                 LIMIT 2000;`,
                [data.animeId, adminId],
              );

              if (followers.length > 0) {
                const animeName = data.animeTitle?.trim() || fallbackAnimeTitle || "Anime";
                const epName = data.title?.trim() || `Episódio ${data.number}`;
                const notifMessage = `Novo episódio disponível: ${animeName} - ${epName}`;

                // Inserção em lotes de 100 para escalabilidade segura
                const batchSize = 100;
                for (let i = 0; i < followers.length; i += batchSize) {
                  const chunk = followers.slice(i, i + batchSize);
                  const values: unknown[] = [];
                  const valueRows: string[] = [];

                  chunk.forEach((f, idx) => {
                    const offset = idx * 8;
                    const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                    const dedupKey = `episode:${f.userId}:${data.id}`;
                    valueRows.push(
                      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, false, CURRENT_TIMESTAMP)`,
                    );
                    values.push(
                      notifId,
                      f.userId,
                      adminId,
                      "episode",
                      notifMessage,
                      data.animeId,
                      data.id,
                      dedupKey,
                    );
                  });

                  await sql.query(
                    `INSERT INTO "notification" (
                       "id", "userId", "actorId", "type", "message",
                       "animeId", "episodeId", "dedupKey", "read", "createdAt"
                     )
                     VALUES ${valueRows.join(", ")}
                     ON CONFLICT ("dedupKey") DO NOTHING;`,
                    values,
                  );
                }
              }
            } catch (notifErr) {
              console.warn(
                "[catalog-episode] Falha não impeditiva no disparo de notificações:",
                notifErr,
              );
            }
          }

          // Invalida cache em memória do anime para refletir as alterações
          invalidateCatalogEpisodesCache(data.animeId);

          return Response.json({
            ok: true,
            published: finalPublished,
            publishedAt: finalPublishedAt,
            episodeId: effectiveId,
            canonicalId: effectiveId,
            reconciled: effectiveId !== data.id,
            previousId: data.id,
            adminId,
            notifiedFollowers: isFirstTimePublished,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: err.status });
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }

          console.error("[api/admin/catalog-episode] Erro ao salvar episódio:", err);
          return Response.json(
            { error: "Erro interno ao salvar episódio.", details: String(err) },
            { status: 500 },
          );
        }
      },

      DELETE: async ({ request }) => {
        try {
          // 1. Validar same-site
          assertSameSiteRequest();

          // 2. Validar administrador e obter adminId
          const adminId = await requireAdminUser(request);

          // 3. Obter ID do episódio a ser excluído
          let episodeId = "";
          let animeId: string | undefined;

          const url = new URL(request.url);
          const qId = url.searchParams.get("id");
          const qAnimeId = url.searchParams.get("animeId");

          if (qId) {
            episodeId = qId.trim();
            if (qAnimeId) animeId = qAnimeId.trim();
          } else {
            try {
              const body = await request.json();
              const parsed = episodeDeleteSchema.safeParse(body);
              if (parsed.success) {
                episodeId = parsed.data.id;
                animeId = parsed.data.animeId || undefined;
              }
            } catch {
              // Body vazio ou não JSON
            }
          }

          if (!episodeId) {
            return Response.json({ error: "Identificador 'id' do episódio é obrigatório." }, { status: 400 });
          }

          const sql = await getSql();

          const result = await sql.query<{ id: string; animeId: string }>(
            `DELETE FROM "catalog_episode"
             WHERE "id" = $1
             RETURNING "id", "animeId";`,
            [episodeId],
          );

          const deleted = result[0];
          const targetAnimeId = animeId || deleted?.animeId;
          if (targetAnimeId) {
            invalidateCatalogEpisodesCache(targetAnimeId);
          }

          return Response.json({
            ok: true,
            deletedId: episodeId,
            found: Boolean(deleted),
            adminId,
          });
        } catch (err) {
          if (err instanceof CrossSiteRequestError) {
            return Response.json({ error: "Origem cruzada não permitida." }, { status: err.status });
          }
          if (err instanceof AdminGuardError) {
            return Response.json({ error: err.message }, { status: err.status });
          }

          console.error("[api/admin/catalog-episode] Erro ao excluir episódio:", err);
          return Response.json(
            { error: "Erro interno ao excluir episódio.", details: String(err) },
            { status: 500 },
          );
        }
      },
    },
  },
});
