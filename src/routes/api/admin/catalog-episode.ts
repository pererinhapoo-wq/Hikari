import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertSameSiteRequest, CrossSiteRequestError } from "@/lib/auth/isolation.server";
import { requireAdminUser, AdminGuardError } from "@/lib/auth/admin-guard";
import {
  sanitizeEpisodeThumbnailUrl,
  sanitizePlayableVideoUrl,
} from "@/lib/published-episodes";
import { getSql } from "@/lib/db";
import { invalidateCatalogEpisodesCacheAsync } from "@/lib/catalog-episodes";
import { invalidateHomePublicEpisodesCacheAsync } from "@/lib/home-episodes";
import { invalidateServerCatalogCachesAsync } from "@/lib/api";
import { validateHikariPlayerEpisodeId } from "@/lib/hikari-player";
import { fetchHikariPlayerEpisodePoster } from "@/lib/hikari-player-api.server";
import {
  deleteEpisodeSourcesForEpisode,
  SourceValidationError,
  syncCatalogEpisodeSlotsToSources,
  upsertEpisodeSource,
} from "@/lib/sources";
import {
  ANITUBE22_INVALID_URL_ERROR,
  isLegacyAnitube22Ref,
  parseAnitube22PlayerUrl,
} from "@/lib/anitube22";
import {
  episodePostSchema,
  resolveEpisodeAudioPatch,
  resolveEpisodeBadgesPatch,
  resolveOpeningTimestampsPatch,
} from "@/lib/episode-writer";
import {
  normalizeAnimeRecentBadges,
  normalizeEpisodeAudio,
  type AnimeRecentBadges,
  type EpisodeAudio,
} from "@/lib/types";
import {
  findCanonicalCatalogAnime,
  getAllAliasIdsForCanonical,
  reconcileEpisodeIdentityReferences,
  rowIsDubbed,
} from "@/lib/anime-identity";
import { dispatchEpisodePublishedNotifications } from "@/lib/notifications.functions";

const episodeDeleteSchema = z.object({
  id: z.string().trim().min(1, "id é obrigatório"),
  animeId: z.string().trim().optional().nullable(),
});

function sanitizeVideoUrl(url?: string | null): string | null {
  return sanitizePlayableVideoUrl(url);
}

export async function handlePostCatalogEpisode(
  { request }: { request: Request },
  deps?: { assertSameSite?: () => void },
): Promise<Response> {
  try {
    // 1. Validar same-site
    (deps?.assertSameSite ?? assertSameSiteRequest)();

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
          const hasHikariPlayerField = data.hikariPlayerEpisodeId !== undefined;
          const hikariPlayerValidation = validateHikariPlayerEpisodeId(
            data.hikariPlayerEpisodeId,
          );

          const sql = await getSql();

          // Reconciliação canônica do animeId (ativos + tabela de aliases) com isolamento estrito Sub vs Dub:
          const inferredEpisodeDubbed =
            data.audio === "dub"
              ? true
              : data.audio === "sub"
                ? false
                : undefined;

          const rawIdentityLookup = await findCanonicalCatalogAnime(sql, {
            id: data.animeId,
            title: data.animeTitle,
            ...(inferredEpisodeDubbed !== undefined
              ? { isDubbed: inferredEpisodeDubbed }
              : {}),
          });

          // Nunca redirecionar um cadastro independente local-* (ou episódio dublado)
          // para outro anime Legendado apenas por fallback de título/chave cruzada.
          const matchedIsSubbedForDubEpisode =
            data.audio === "dub" &&
            rawIdentityLookup.row !== null &&
            !rowIsDubbed(rawIdentityLookup.row) &&
            rawIdentityLookup.canonicalId !== data.animeId;

          const shouldRejectLocalTitleRedirect =
            (data.animeId.startsWith("local-") &&
              rawIdentityLookup.matchedBy === "title" &&
              rawIdentityLookup.canonicalId !== null &&
              rawIdentityLookup.canonicalId !== data.animeId) ||
            matchedIsSubbedForDubEpisode;

          const matchedAnime = shouldRejectLocalTitleRedirect
            ? null
            : rawIdentityLookup.row;
          const canonicalAnimeId =
            (!shouldRejectLocalTitleRedirect && rawIdentityLookup.canonicalId) ||
            data.animeId;
          const knownAliases = await getAllAliasIdsForCanonical(sql, canonicalAnimeId);
          const candidateAnimeIds = Array.from(
            new Set([data.animeId, canonicalAnimeId, ...knownAliases]),
          );
          const cacheAliasIds = [
            ...candidateAnimeIds,
            matchedAnime?.anilistId ? String(matchedAnime.anilistId) : undefined,
            matchedAnime?.malId ? `mal-${matchedAnime.malId}` : undefined,
            matchedAnime?.kitsuId ? `kitsu-${matchedAnime.kitsuId}` : undefined,
          ];

          // 4. Buscar registros existentes por ID e por Slot (animeId, seasonNumber, number) em paralelo
          type ExistingEpisodeLookupRow = {
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
            hikariPlayerEpisodeId: string | null;
            audio: string | null;
            openingStartSeconds: number | null;
            openingEndSeconds: number | null;
            badgeLancamento: boolean;
            badgeNovo: boolean;
            badgeFinal: boolean;
            published: boolean;
            publishedAt: string | null;
            authorId: string | null;
          };

          const [existingByIdRows, existingBySlotRows] = await Promise.all([
            sql.query<ExistingEpisodeLookupRow>(
              `SELECT "id", "animeId", "seasonNumber", "number", "title", "thumbnail",
                      "duration", "synopsis", "videoUrl", "videoUrl2", "videoUrl3",
                      "videoUrl4", "videoUrl5", "hikari_player_episode_id" AS "hikariPlayerEpisodeId",
                      "audio",
                      "opening_start_seconds" AS "openingStartSeconds",
                      "opening_end_seconds" AS "openingEndSeconds",
                      COALESCE("badge_lancamento", false) AS "badgeLancamento",
                      COALESCE("badge_novo", false) AS "badgeNovo",
                      COALESCE("badge_final", false) AS "badgeFinal",
                      "published", "publishedAt", "authorId"
               FROM "catalog_episode"
               WHERE "id" = $1 LIMIT 1;`,
              [data.id],
            ),
            sql.query<ExistingEpisodeLookupRow>(
              `SELECT "id", "animeId", "seasonNumber", "number", "title", "thumbnail",
                      "duration", "synopsis", "videoUrl", "videoUrl2", "videoUrl3",
                      "videoUrl4", "videoUrl5", "hikari_player_episode_id" AS "hikariPlayerEpisodeId",
                      "audio",
                      "opening_start_seconds" AS "openingStartSeconds",
                      "opening_end_seconds" AS "openingEndSeconds",
                      COALESCE("badge_lancamento", false) AS "badgeLancamento",
                      COALESCE("badge_novo", false) AS "badgeNovo",
                      COALESCE("badge_final", false) AS "badgeFinal",
                      "published", "publishedAt", "authorId"
               FROM "catalog_episode"
               WHERE "animeId" = ANY($1::text[]) AND "seasonNumber" = $2 AND "number" = $3 LIMIT 1;`,
              [candidateAnimeIds, data.seasonNumber, data.number],
            ),
          ]);
          const existingById = existingByIdRows[0] || null;
          const existingBySlot = existingBySlotRows[0] || null;

          // 5. Conflito de integridade: se o ID recebido já existe, ele NÃO pode pertencer a outro anime nem a outro slot
          const belongsToTargetAnime =
            Boolean(existingById) && candidateAnimeIds.includes(existingById!.animeId);
          if (
            existingById &&
            (!belongsToTargetAnime ||
              existingById.seasonNumber !== data.seasonNumber ||
              existingById.number !== data.number)
          ) {
            return Response.json(
              {
                error: `Conflito de integridade: o identificador "${data.id}" já está associado a outro episódio (${existingById.animeId} - Temporada ${existingById.seasonNumber}, Ep. ${existingById.number}) e não pode ser reaproveitado em outro anime ou slot.`,
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

          // 7. Resolução de fontes de vídeo:
          // - Rejeita explicitamente formato legado anitube22://, IDs numéricos puros ou URLs incompletas de playerricas.php.
          // - Quando replaceSources=true (enviado pelo editor completo), reflete exatamente as 5 fontes (permitindo limpar URLs removidas).
          // - Caso contrário (chamadas parciais), preserva fontes existentes quando vazias/null.
          function validateIncomingSlot(incoming: string | null | undefined): void {
            if (!incoming) return;
            const trimmed = incoming.trim();
            if (!trimmed) return;
            if (
              isLegacyAnitube22Ref(trimmed) ||
              /^\d{3,16}$/.test(trimmed) ||
              (trimmed.toLowerCase().includes("playerricas.php") && !parseAnitube22PlayerUrl(trimmed))
            ) {
              throw new SourceValidationError(ANITUBE22_INVALID_URL_ERROR, 400);
            }
          }

          validateIncomingSlot(data.videoUrl);
          validateIncomingSlot(data.videoUrl2);
          validateIncomingSlot(data.videoUrl3);
          validateIncomingSlot(data.videoUrl4);
          validateIncomingSlot(data.videoUrl5);

          function resolveSource(
            incoming: string | null | undefined,
            existing: string | null | undefined,
          ): string | null {
            if (data.replaceSources) {
              return sanitizeVideoUrl(incoming);
            }
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

          const hasValidUrlSource = Boolean(v1 || v2 || v3 || v4 || v5);

          if (
            hasHikariPlayerField &&
            !hikariPlayerValidation.valid &&
            !hasValidUrlSource
          ) {
            return Response.json(
              { error: hikariPlayerValidation.error || "ID do Hikari Player inválido." },
              { status: 400 },
            );
          }

          const hikariPlayerEpisodeId = hasHikariPlayerField
            ? hikariPlayerValidation.valid
              ? hikariPlayerValidation.value
              : null
            : existingRow?.hikariPlayerEpisodeId ?? null;

          const hasValidHikariId = Boolean(
            hikariPlayerEpisodeId &&
              validateHikariPlayerEpisodeId(hikariPlayerEpisodeId).valid,
          );
          const hasPlayableSource = hasValidUrlSource || hasValidHikariId;

          // Validação de publicação: publicado exige ao menos 1 URL válida (Player 1-5) ou ID válido do Hikari Player
          if (data.published === true && !hasPlayableSource) {
            return Response.json(
              {
                error:
                  "Um episódio só pode ser publicado quando possuir pelo menos uma fonte válida de reprodução (URL de vídeo de Player 1 a Player 5 ou ID válido do Hikari Player).",
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
          const shouldReplaceThumbnail = Boolean(data.replaceThumbnail);
          const cleanIncomingThumbnail = sanitizeEpisodeThumbnailUrl(data.thumbnail);
          let thumbnail = shouldReplaceThumbnail
            ? cleanIncomingThumbnail
            : cleanIncomingThumbnail ?? existingRow?.thumbnail ?? null;

          // Fallback fail-open no salvamento: se houver ID válido do Hikari Player
          // e nenhuma thumbnail definida/existente/limpa manualmente, tenta recuperar `poster_url`.
          if (
            !shouldReplaceThumbnail &&
            !thumbnail &&
            hasValidHikariId &&
            hikariPlayerEpisodeId
          ) {
            try {
              const playerLookup = await fetchHikariPlayerEpisodePoster(
                hikariPlayerEpisodeId,
              );
              if (playerLookup.ok && playerLookup.posterUrl) {
                thumbnail = playerLookup.posterUrl;
              }
            } catch {
              // fail-open: erro no Hikari Player nunca bloqueia o salvamento do episódio
            }
          }
          const duration =
            (data.duration && data.duration.trim()) ||
            existingRow?.duration ||
            null;
          const synopsis =
            (data.synopsis && data.synopsis.trim()) ||
            existingRow?.synopsis ||
            null;

          // 8. Garantir que o anime e a temporada existam no catálogo (reativando se estava arquivado)
          const fallbackAnimeTitle = data.animeTitle?.trim() || canonicalAnimeId;
          await sql.query(
            `INSERT INTO "catalog_anime" ("id", "title", "archived_at", "createdAt", "updatedAt")
             VALUES ($1, $2, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT ("id") DO UPDATE
             SET "archived_at" = NULL,
                 "hidden" = CASE
                   WHEN "catalog_anime"."archived_at" IS NOT NULL THEN false
                   ELSE "catalog_anime"."hidden"
                 END,
                 "updatedAt" = CURRENT_TIMESTAMP;`,
            [canonicalAnimeId, fallbackAnimeTitle],
          );

          const seasonTitle = `Temporada ${data.seasonNumber}`;
          await sql.query(
            `INSERT INTO "catalog_season" ("animeId", "number", "title", "position", "createdAt")
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             ON CONFLICT ("animeId", "number") DO NOTHING;`,
            [canonicalAnimeId, data.seasonNumber, seasonTitle, data.seasonNumber - 1],
          );

          // 9. Gravação segura contra concorrência usando constraint UNIQUE (animeId, seasonNumber, number)
          const wasAlreadyPublished = existingRow?.published === true;
          const isFirstTimePublished = published && !wasAlreadyPublished;

          const openingPatch = resolveOpeningTimestampsPatch(
            {
              openingStartSeconds: data.openingStartSeconds,
              openingEndSeconds: data.openingEndSeconds,
            },
            existingRow,
          );

          if (!openingPatch.valid) {
            return Response.json(
              {
                error: openingPatch.error,
              },
              { status: 400 },
            );
          }

          const {
            hasOpeningStartField,
            hasOpeningEndField,
            openingStartSeconds,
            openingEndSeconds,
          } = openingPatch;

          const badgesPatch = resolveEpisodeBadgesPatch(
            { recentBadges: data.recentBadges },
            existingRow,
          );
          const audioPatch = resolveEpisodeAudioPatch(
            { audio: data.audio },
            existingRow,
          );

          const upsertResult = await sql.query<{
            id: string;
            thumbnail: string | null;
            published: boolean;
            publishedAt: string | null;
            hikariPlayerEpisodeId: string | null;
            audio: string | null;
            openingStartSeconds: number | null;
            openingEndSeconds: number | null;
            badgeLancamento: boolean;
            badgeNovo: boolean;
            badgeFinal: boolean;
            authorId: string | null;
          }>(
            `INSERT INTO "catalog_episode" (
               "id", "animeId", "seasonNumber", "number",
               "title", "thumbnail", "duration", "synopsis",
               "videoUrl", "videoUrl2", "videoUrl3", "videoUrl4", "videoUrl5",
               "hikari_player_episode_id", "audio",
               "opening_start_seconds", "opening_end_seconds",
               "badge_lancamento", "badge_novo", "badge_final",
               "authorId",
               "published", "publishedAt", "createdAt", "updatedAt"
             )
             VALUES (
               $1, $2, $3, $4,
               $5, $6, $7, $8,
               $9, $10, $11, $12, $13,
               $17, $30,
               $19, $20,
               $23, $24, $25,
               $29,
               $14,
               CASE WHEN $14 = true THEN CURRENT_TIMESTAMP ELSE NULL END,
               CURRENT_TIMESTAMP,
               CURRENT_TIMESTAMP
             )
             ON CONFLICT ("animeId", "seasonNumber", "number") DO UPDATE
             SET
               "title" = EXCLUDED."title",
               "thumbnail" = CASE
                 WHEN $16 = true THEN EXCLUDED."thumbnail"
                 ELSE COALESCE(NULLIF(EXCLUDED."thumbnail", ''), "catalog_episode"."thumbnail")
               END,
               "duration" = COALESCE(NULLIF(EXCLUDED."duration", ''), "catalog_episode"."duration"),
               "synopsis" = COALESCE(NULLIF(EXCLUDED."synopsis", ''), "catalog_episode"."synopsis"),
               "videoUrl" = CASE
                 WHEN $15 = true THEN EXCLUDED."videoUrl"
                 ELSE COALESCE(NULLIF(EXCLUDED."videoUrl", ''), "catalog_episode"."videoUrl")
               END,
               "videoUrl2" = CASE
                 WHEN $15 = true THEN EXCLUDED."videoUrl2"
                 ELSE COALESCE(NULLIF(EXCLUDED."videoUrl2", ''), "catalog_episode"."videoUrl2")
               END,
               "videoUrl3" = CASE
                 WHEN $15 = true THEN EXCLUDED."videoUrl3"
                 ELSE COALESCE(NULLIF(EXCLUDED."videoUrl3", ''), "catalog_episode"."videoUrl3")
               END,
               "videoUrl4" = CASE
                 WHEN $15 = true THEN EXCLUDED."videoUrl4"
                 ELSE COALESCE(NULLIF(EXCLUDED."videoUrl4", ''), "catalog_episode"."videoUrl4")
               END,
               "videoUrl5" = CASE
                 WHEN $15 = true THEN EXCLUDED."videoUrl5"
                 ELSE COALESCE(NULLIF(EXCLUDED."videoUrl5", ''), "catalog_episode"."videoUrl5")
               END,
               "hikari_player_episode_id" = CASE
                 WHEN $18 = true THEN EXCLUDED."hikari_player_episode_id"
                 ELSE "catalog_episode"."hikari_player_episode_id"
               END,
               "audio" = CASE
                 WHEN $31 = true THEN EXCLUDED."audio"
                 ELSE "catalog_episode"."audio"
               END,
               "opening_start_seconds" = CASE
                 WHEN $21 = true THEN EXCLUDED."opening_start_seconds"
                 ELSE "catalog_episode"."opening_start_seconds"
               END,
               "opening_end_seconds" = CASE
                 WHEN $22 = true THEN EXCLUDED."opening_end_seconds"
                 ELSE "catalog_episode"."opening_end_seconds"
               END,
               "badge_lancamento" = CASE
                 WHEN $26 = true THEN EXCLUDED."badge_lancamento"
                 ELSE "catalog_episode"."badge_lancamento"
               END,
               "badge_novo" = CASE
                 WHEN $27 = true THEN EXCLUDED."badge_novo"
                 ELSE "catalog_episode"."badge_novo"
               END,
               "badge_final" = CASE
                 WHEN $28 = true THEN EXCLUDED."badge_final"
                 ELSE "catalog_episode"."badge_final"
               END,
               "authorId" = COALESCE("catalog_episode"."authorId", EXCLUDED."authorId"),
               "published" = EXCLUDED."published",
               "publishedAt" = CASE
                 WHEN EXCLUDED."published" = true AND "catalog_episode"."publishedAt" IS NULL THEN CURRENT_TIMESTAMP
                 WHEN EXCLUDED."published" = false THEN NULL
                 ELSE "catalog_episode"."publishedAt"
               END,
               "updatedAt" = CURRENT_TIMESTAMP
             RETURNING "id", "thumbnail", "published", "publishedAt", "hikari_player_episode_id" AS "hikariPlayerEpisodeId", "audio", "opening_start_seconds" AS "openingStartSeconds", "opening_end_seconds" AS "openingEndSeconds", "badge_lancamento" AS "badgeLancamento", "badge_novo" AS "badgeNovo", "badge_final" AS "badgeFinal", "authorId";`,
            [
              canonicalId,
              canonicalAnimeId,
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
              Boolean(data.replaceSources),
              shouldReplaceThumbnail,
              hikariPlayerEpisodeId,
              hasHikariPlayerField,
              openingStartSeconds,
              openingEndSeconds,
              hasOpeningStartField,
              hasOpeningEndField,
              badgesPatch.badgeLancamento,
              badgesPatch.badgeNovo,
              badgesPatch.badgeFinal,
              badgesPatch.hasLancamentoField,
              badgesPatch.hasNovoField,
              badgesPatch.hasFinalField,
              existingRow?.authorId ?? adminId,
              audioPatch.audio,
              audioPatch.hasAudioField,
            ],
          );

          const savedRow = upsertResult[0];
          const effectiveId = savedRow ? savedRow.id : canonicalId;
          const finalThumbnail = savedRow ? savedRow.thumbnail : thumbnail;
          const finalPublished = savedRow ? savedRow.published : published;
          const finalPublishedAt = savedRow ? savedRow.publishedAt : null;
          const finalHikariPlayerEpisodeId = savedRow
            ? savedRow.hikariPlayerEpisodeId
            : hikariPlayerEpisodeId;
          const finalAudio: EpisodeAudio | null = savedRow
            ? normalizeEpisodeAudio(savedRow.audio)
            : audioPatch.audio;
          const finalOpeningStartSeconds = savedRow
            ? savedRow.openingStartSeconds
            : openingStartSeconds;
          const finalOpeningEndSeconds = savedRow
            ? savedRow.openingEndSeconds
            : openingEndSeconds;
          const finalRecentBadges: AnimeRecentBadges = savedRow
            ? normalizeAnimeRecentBadges({
                lancamento: savedRow.badgeLancamento,
                novo: savedRow.badgeNovo,
                final: savedRow.badgeFinal,
              })
            : badgesPatch.recentBadges;

          // Sincroniza fontes duráveis em episode_sources sem nunca gravar `time=`
          // e sem executar probes HTTP externos bloqueantes durante o salvamento normal.
          await syncCatalogEpisodeSlotsToSources(
            effectiveId,
            [
              { url: v1, priority: 0 },
              { url: v2, priority: 1 },
              { url: v3, priority: 2 },
              { url: v4, priority: 3 },
              { url: v5, priority: 4 },
            ],
            {
              replaceAnitube22: Boolean(data.replaceSources),
              skipProbe: true,
              episodeAudio: finalAudio,
            },
          );
          if (Array.isArray(data.sources) && data.sources.length > 0) {
            for (const src of data.sources) {
              await upsertEpisodeSource(
                {
                  episodeId: effectiveId,
                  provider: src.provider,
                  externalId: src.externalId,
                  lang: src.lang,
                  quality: src.quality ?? null,
                  priority: src.priority ?? 0,
                },
                { skipProbe: true },
              );
            }
          }

          // Reconciliar referências históricas de episódio (ex.: watched/progress/comments apontando para episodeId antigo do mesmo slot)
          await reconcileEpisodeIdentityReferences(sql, {
            animeId: canonicalAnimeId,
            episodeId: effectiveId,
            seasonNumber: data.seasonNumber,
            number: data.number,
          });

          // 9. Notificações para seguidores do anime quando o episódio for publicado pela primeira vez
          if (isFirstTimePublished) {
            try {
              await dispatchEpisodePublishedNotifications(sql, {
                animeId: canonicalAnimeId,
                candidateAnimeIds,
                episodeId: effectiveId,
                animeTitle: data.animeTitle?.trim() || fallbackAnimeTitle || "Anime",
                episodeTitle: data.title?.trim() || `Episódio ${data.number}`,
                episodeNumber: data.number,
                episodeAuthorId: savedRow?.authorId ?? existingRow?.authorId ?? adminId,
                publisherId: adminId,
              });
            } catch (notifErr) {
              console.warn(
                "[catalog-episode] Falha não impeditiva no disparo de notificações:",
                notifErr,
              );
            }
          }

          // Invalida cache em memória e Redis do anime (todos os aliases), catálogo e Home
          await invalidateCatalogEpisodesCacheAsync(...cacheAliasIds);
          await invalidateHomePublicEpisodesCacheAsync();
          await invalidateServerCatalogCachesAsync(canonicalAnimeId, {
            anilistId: matchedAnime?.anilistId,
            malId: matchedAnime?.malId,
            kitsuId: matchedAnime?.kitsuId,
            extraIds: candidateAnimeIds,
          });

          return Response.json({
            ok: true,
            thumbnail: finalThumbnail,
            published: finalPublished,
            publishedAt: finalPublishedAt,
            hikariPlayerEpisodeId: finalHikariPlayerEpisodeId,
            audio: finalAudio,
            openingStartSeconds: finalOpeningStartSeconds,
            openingEndSeconds: finalOpeningEndSeconds,
            recentBadges: finalRecentBadges,
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
          if (err instanceof SourceValidationError) {
            return Response.json({ error: err.message }, { status: err.statusCode });
          }

          console.error("[api/admin/catalog-episode] Erro ao salvar episódio:", err);
          return Response.json(
            { error: "Erro interno ao salvar episódio.", details: String(err) },
            { status: 500 },
          );
        }
}

export const Route = createFileRoute("/api/admin/catalog-episode")({
  server: {
    handlers: {
      POST: ({ request }) => handlePostCatalogEpisode({ request }),

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

          const result = await sql.query<{
            id: string;
            animeId: string;
            seasonNumber: number | null;
            number: number;
          }>(
            `DELETE FROM "catalog_episode"
             WHERE "id" = $1
             RETURNING "id", "animeId", "seasonNumber", "number";`,
            [episodeId],
          );

          const deleted = result[0];
          if (deleted?.animeId) {
            try {
              const histEntry = JSON.stringify([
                {
                  episodeId: deleted.id,
                  seasonNumber: Number(deleted.seasonNumber ?? 1),
                  number: Number(deleted.number),
                },
              ]);
              await sql.query(
                `UPDATE "catalog_anime"
                 SET "episode_history" = COALESCE("episode_history", '[]'::jsonb) || $2::jsonb,
                     "updatedAt" = CURRENT_TIMESTAMP
                 WHERE "id" = $1;`,
                [deleted.animeId, histEntry],
              );
            } catch {
              // non-fatal episode history preservation
            }
          }
          await deleteEpisodeSourcesForEpisode(episodeId);
          const targetAnimeId = animeId || deleted?.animeId;
          let matchedDelAnime: Awaited<ReturnType<typeof findCanonicalCatalogAnime>>["row"] = null;
          let delCanonicalId: string | undefined;
          let delAliases: string[] = [];
          if (targetAnimeId) {
            const lookup = await findCanonicalCatalogAnime(sql, { id: targetAnimeId });
            matchedDelAnime = lookup.row;
            delCanonicalId = lookup.canonicalId ?? undefined;
            delAliases = lookup.canonicalId
              ? await getAllAliasIdsForCanonical(sql, lookup.canonicalId)
              : [];
            await invalidateCatalogEpisodesCacheAsync(
              targetAnimeId,
              deleted?.animeId,
              matchedDelAnime?.id,
              ...delAliases,
              matchedDelAnime?.anilistId ? String(matchedDelAnime.anilistId) : undefined,
              matchedDelAnime?.malId ? `mal-${matchedDelAnime.malId}` : undefined,
              matchedDelAnime?.kitsuId ? `kitsu-${matchedDelAnime.kitsuId}` : undefined,
            );
          }
          if (deleted) {
            await invalidateHomePublicEpisodesCacheAsync();
            await invalidateServerCatalogCachesAsync(delCanonicalId || targetAnimeId, {
              anilistId: matchedDelAnime?.anilistId,
              malId: matchedDelAnime?.malId,
              kitsuId: matchedDelAnime?.kitsuId,
              extraIds: [targetAnimeId, deleted.animeId, ...delAliases].filter(Boolean) as string[],
            });
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
