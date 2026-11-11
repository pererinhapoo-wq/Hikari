#!/usr/bin/env node

/**
 * Script de Importação Manual de Catálogo — HIKARI (Etapa B)
 *
 * Lê um arquivo JSON de backup (ex: "hikari-catalogo.json") e grava os animes,
 * temporadas e episódios nas tabelas relacionais do PostgreSQL:
 * - "catalog_anime"
 * - "catalog_season"
 * - "catalog_episode"
 *
 * Uso:
 *   node scripts/catalog-import.mjs <caminho-do-json> [--dedupe]
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("\n[catalog-import] ERRO: A variável de ambiente DATABASE_URL é obrigatória.");
  console.error("[catalog-import] Exemplo: DATABASE_URL=\"postgresql://...\" node scripts/catalog-import.mjs <caminho.json>\n");
  process.exit(1);
}

// Argumentos da linha de comando
const args = process.argv.slice(2);
const fileArg = args.find((a) => !a.startsWith("--"));
const dedupe = args.includes("--dedupe");

if (!fileArg) {
  console.error("\n[catalog-import] ERRO: Arquivo JSON de catálogo não informado.");
  console.error("Uso: node scripts/catalog-import.mjs <caminho-do-json> [--dedupe]");
  console.error("Exemplo: node scripts/catalog-import.mjs hikari-catalogo.json --dedupe\n");
  process.exit(1);
}

function displayTitle(a) {
  if (!a) return "Sem título";
  const english = a.titleEnglish?.trim() || a.titles?.english?.trim();
  const romaji = a.titleRomaji?.trim() || a.titles?.romaji?.trim();
  const rawTitle = typeof a.title === "string" ? a.title.trim() : undefined;
  const native = a.titleNative?.trim() || a.titles?.native?.trim();
  return english || romaji || rawTitle || native || "Sem título";
}

function isDubbed(a) {
  const text = `${a.titleRomaji || ""} ${a.titleEnglish || ""} ${a.titleNative || ""} ${a.title || ""}`;
  return /\b(dub|dublado|dublada)\b/i.test(text);
}

function hasValidVideoSource(ep) {
  return Boolean(
    (ep.videoUrl && typeof ep.videoUrl === "string" && ep.videoUrl.trim()) ||
    (ep.videoUrl2 && typeof ep.videoUrl2 === "string" && ep.videoUrl2.trim()) ||
    (ep.videoUrl3 && typeof ep.videoUrl3 === "string" && ep.videoUrl3.trim()) ||
    (ep.videoUrl4 && typeof ep.videoUrl4 === "string" && ep.videoUrl4.trim()) ||
    (ep.videoUrl5 && typeof ep.videoUrl5 === "string" && ep.videoUrl5.trim())
  );
}

async function main() {
  const fullPath = resolve(process.cwd(), fileArg);
  console.log(`[catalog-import] Lendo arquivo: ${fullPath}`);

  let fileContent;
  try {
    fileContent = await readFile(fullPath, "utf-8");
  } catch (err) {
    console.error(`[catalog-import] Falha ao abrir arquivo: ${err.message || err}`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(fileContent);
  } catch (err) {
    console.error(`[catalog-import] JSON inválido: ${err.message || err}`);
    process.exit(1);
  }

  // Suporte a formato de array direto, { animes: [] } ou Zustand persist { state: { animes: [] } }
  let rawAnimes = [];
  if (Array.isArray(parsed)) {
    rawAnimes = parsed;
  } else if (Array.isArray(parsed?.animes)) {
    rawAnimes = parsed.animes;
  } else if (Array.isArray(parsed?.state?.animes)) {
    rawAnimes = parsed.state.animes;
  } else {
    console.error("[catalog-import] Formato de catálogo não reconhecido (esperado array de animes).");
    process.exit(1);
  }

  console.log(`[catalog-import] Total de títulos encontrados no arquivo: ${rawAnimes.length}`);

  // Deduplicação segura quando solicitada via --dedupe
  let animesToProcess = rawAnimes;
  if (dedupe) {
    console.log("[catalog-import] Modo --dedupe ativado: identificando variantes que compartilham o mesmo AniList ID...");
    const anilistGroups = new Map();
    const withoutAnilist = [];

    for (const anime of rawAnimes) {
      const aniId = anime.anilistId ? Number(anime.anilistId) : null;
      if (aniId && Number.isFinite(aniId)) {
        const list = anilistGroups.get(aniId) ?? [];
        list.push(anime);
        anilistGroups.set(aniId, list);
      } else {
        withoutAnilist.push(anime);
      }
    }

    const deduplicated = [];
    let dedupeCount = 0;

    for (const [aniId, group] of anilistGroups.entries()) {
      if (group.length === 1) {
        deduplicated.push(group[0]);
      } else {
        // Múltiplos animes com o mesmo AniList ID (ex: versão legendada e dublada)
        dedupeCount += group.length - 1;
        // Prioriza a versão original / não dublada como base canônica
        group.sort((a, b) => {
          const aDub = isDubbed(a) ? 1 : 0;
          const bDub = isDubbed(b) ? 1 : 0;
          return aDub - bDub;
        });

        const canonical = { ...group[0] };
        const canonicalSeasons = Array.isArray(canonical.seasons) ? [...canonical.seasons] : [];

        // Mesclar episódios de variantes secundárias
        for (let i = 1; i < group.length; i++) {
          const variant = group[i];
          const isVariantDubbed = isDubbed(variant);

          for (const vSeason of variant.seasons || []) {
            const sNum = vSeason.number || 1;
            let targetSeason = canonicalSeasons.find((s) => s.number === sNum);
            if (!targetSeason) {
              targetSeason = {
                id: vSeason.id || `s-${canonical.id}-${sNum}`,
                number: sNum,
                title: vSeason.title || `Temporada ${sNum}`,
                episodes: [],
              };
              canonicalSeasons.push(targetSeason);
            }

            for (const vEp of vSeason.episodes || []) {
              if (!hasValidVideoSource(vEp)) continue;
              const epNum = vEp.number;
              const targetEp = targetSeason.episodes.find((e) => e.number === epNum);

              if (targetEp) {
                // Mescla URLs de vídeo quando o episódio já existe na versão canônica
                if (isVariantDubbed) {
                  // Se a variante for dublada, guarda na posição videoUrl2 se vazia
                  if (!targetEp.videoUrl2 && vEp.videoUrl) targetEp.videoUrl2 = vEp.videoUrl;
                } else {
                  if (!targetEp.videoUrl && vEp.videoUrl) targetEp.videoUrl = vEp.videoUrl;
                  if (!targetEp.videoUrl2 && vEp.videoUrl2) targetEp.videoUrl2 = vEp.videoUrl2;
                }
                if (!targetEp.videoUrl3 && vEp.videoUrl3) targetEp.videoUrl3 = vEp.videoUrl3;
                if (!targetEp.videoUrl4 && vEp.videoUrl4) targetEp.videoUrl4 = vEp.videoUrl4;
                if (!targetEp.videoUrl5 && vEp.videoUrl5) targetEp.videoUrl5 = vEp.videoUrl5;
              } else {
                targetSeason.episodes.push({ ...vEp });
              }
            }
          }
        }

        canonical.seasons = canonicalSeasons;
        deduplicated.push(canonical);
      }
    }

    animesToProcess = [...deduplicated, ...withoutAnilist];
    console.log(`[catalog-import] Deduplicação concluída: ${dedupeCount} variante(s) unificadas. Restam ${animesToProcess.length} títulos.`);
  }

  // Conexão com o banco
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 1,
  });

  const client = await pool.connect();

  let importedAnimes = 0;
  let importedSeasons = 0;
  let importedEpisodes = 0;
  let ignoredEpisodes = 0;

  try {
    await client.query("BEGIN");

    // Registro das chaves anilist já salvas nesta execução para evitar violação de constraint caso dedupe não esteja ativo
    const seenAnilistIds = new Set();

    for (const anime of animesToProcess) {
      if (!anime || !anime.id) {
        console.warn("[catalog-import] Registro de anime ignorado: ausência de identificador 'id'.");
        continue;
      }

      const id = String(anime.id).trim();
      const title = displayTitle(anime);
      let anilistId = anime.anilistId ? Number(anime.anilistId) : null;
      if (anilistId && (!Number.isFinite(anilistId) || anilistId <= 0)) anilistId = null;

      // Se não estiver em modo dedupe e este anilistId já apareceu, anula para evitar conflito na constraint única
      if (anilistId) {
        if (seenAnilistIds.has(anilistId)) {
          console.warn(`[catalog-import] Anime "${title}" (${id}) compartilha anilistId ${anilistId} com outro título. Anulando anilistId nesta linha para preservar o anime.`);
          anilistId = null;
        } else {
          seenAnilistIds.add(anilistId);
        }
      }

      const malId = anime.malId && Number.isFinite(Number(anime.malId)) ? Number(anime.malId) : null;
      const kitsuId = anime.kitsuId && Number.isFinite(Number(anime.kitsuId)) ? Number(anime.kitsuId) : null;
      const titleRomaji = anime.titleRomaji?.trim() || anime.titles?.romaji?.trim() || null;
      const titleEnglish = anime.titleEnglish?.trim() || anime.titles?.english?.trim() || null;
      const titleNative = anime.titleNative?.trim() || anime.titles?.native?.trim() || null;
      const cover = anime.cover?.trim() || null;
      const banner = anime.banner?.trim() || null;
      const synopsis = anime.synopsis?.trim() || null;
      const format = anime.format?.trim() || null;
      const status = anime.status?.trim() || null;
      const episodesCount = anime.episodesCount && Number.isFinite(Number(anime.episodesCount)) ? Number(anime.episodesCount) : null;
      const year = anime.year && Number.isFinite(Number(anime.year)) ? Number(anime.year) : null;
      const season = anime.season?.trim() || null;
      const trailerId = anime.trailerId?.trim() || null;
      const genres = Array.isArray(anime.genres) ? anime.genres.map((g) => String(g).trim()).filter(Boolean) : [];

      // 1. Inserir ou atualizar catalog_anime
      await client.query(
        `INSERT INTO "catalog_anime" (
           "id", "title", "anilistId", "malId", "kitsuId",
           "titleRomaji", "titleEnglish", "titleNative", "cover", "banner",
           "synopsis", "format", "status", "episodesCount", "year", "season",
           "genres", "trailerId", "createdAt", "updatedAt"
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT ("id") DO UPDATE
         SET
           "title" = EXCLUDED."title",
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
           "genres" = CASE WHEN array_length(EXCLUDED."genres", 1) > 0 THEN EXCLUDED."genres" ELSE "catalog_anime"."genres" END,
           "trailerId" = COALESCE(EXCLUDED."trailerId", "catalog_anime"."trailerId"),
           "updatedAt" = CURRENT_TIMESTAMP;`,
        [
          id, title, anilistId, malId, kitsuId,
          titleRomaji, titleEnglish, titleNative, cover, banner,
          synopsis, format, status, episodesCount, year, season,
          genres, trailerId,
        ],
      );

      importedAnimes++;

      // 2. Temporadas e Episódios
      const seasons = Array.isArray(anime.seasons) ? anime.seasons : [];
      let seasonIndex = 0;

      for (const s of seasons) {
        const seasonNumber = s.number ? Number(s.number) : seasonIndex + 1;
        const seasonTitle = s.title?.trim() || `Temporada ${seasonNumber}`;
        const position = seasonIndex;
        seasonIndex++;

        // Inserir ou atualizar catalog_season
        await client.query(
          `INSERT INTO "catalog_season" ("animeId", "number", "title", "position", "createdAt")
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT ("animeId", "number") DO UPDATE
           SET
             "title" = COALESCE(EXCLUDED."title", "catalog_season"."title"),
             "position" = EXCLUDED."position";`,
          [id, seasonNumber, seasonTitle, position],
        );

        importedSeasons++;

        const episodes = Array.isArray(s.episodes) ? s.episodes : [];
        for (const ep of episodes) {
          if (!hasValidVideoSource(ep)) {
            ignoredEpisodes++;
            continue;
          }

          const epNumber = Number(ep.number);
          if (!Number.isFinite(epNumber) || epNumber < 0) {
            ignoredEpisodes++;
            continue;
          }

          const epTitle = ep.title?.trim() || `Episódio ${epNumber}`;
          const epThumbnail = ep.thumbnail?.trim() || null;
          const epDuration = ep.duration?.trim() || null;
          const epSynopsis = ep.synopsis?.trim() || null;
          const videoUrl = ep.videoUrl?.trim() || null;
          const videoUrl2 = ep.videoUrl2?.trim() || null;
          const videoUrl3 = ep.videoUrl3?.trim() || null;
          const videoUrl4 = ep.videoUrl4?.trim() || null;
          const videoUrl5 = ep.videoUrl5?.trim() || null;
          const published = ep.published !== false;
          const publishedAt = ep.aired ? new Date(ep.aired).toISOString() : new Date().toISOString();

          // Resolução explícita de conflitos (id x (animeId, seasonNumber, number))
          // 1. Verifica se já existe episódio para este (animeId, seasonNumber, number)
          const existingBySlot = await client.query(
            `SELECT "id" FROM "catalog_episode"
             WHERE "animeId" = $1 AND "seasonNumber" = $2 AND "number" = $3 LIMIT 1;`,
            [id, seasonNumber, epNumber],
          );

          let episodeIdToUse;
          if (existingBySlot.rows.length > 0) {
            // Preserva o ID já cadastrado para este slot de episódio
            episodeIdToUse = existingBySlot.rows[0].id;
          } else {
            // Se o ID sugerido for válido e não colidir com outro anime, usa ele
            const candidateId = ep.id ? String(ep.id).trim() : `ep-${id}-s${seasonNumber}-${epNumber}`;
            const checkCollision = await client.query(
              `SELECT "id", "animeId" FROM "catalog_episode" WHERE "id" = $1 LIMIT 1;`,
              [candidateId],
            );
            if (checkCollision.rows.length === 0) {
              episodeIdToUse = candidateId;
            } else {
              // Já existe para outro anime/slot, usa um ID único composto
              episodeIdToUse = `ep-${id}-s${seasonNumber}-${epNumber}`;
            }
          }

          // Gravação idempotente
          await client.query(
            `INSERT INTO "catalog_episode" (
               "id", "animeId", "seasonNumber", "number",
               "title", "thumbnail", "duration", "synopsis",
               "videoUrl", "videoUrl2", "videoUrl3", "videoUrl4", "videoUrl5",
               "published", "publishedAt", "createdAt", "updatedAt"
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::timestamptz, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT ("animeId", "seasonNumber", "number") DO UPDATE
             SET
               "title" = COALESCE(EXCLUDED."title", "catalog_episode"."title"),
               "thumbnail" = COALESCE(EXCLUDED."thumbnail", "catalog_episode"."thumbnail"),
               "duration" = COALESCE(EXCLUDED."duration", "catalog_episode"."duration"),
               "synopsis" = COALESCE(EXCLUDED."synopsis", "catalog_episode"."synopsis"),
               "videoUrl" = COALESCE(EXCLUDED."videoUrl", "catalog_episode"."videoUrl"),
               "videoUrl2" = COALESCE(EXCLUDED."videoUrl2", "catalog_episode"."videoUrl2"),
               "videoUrl3" = COALESCE(EXCLUDED."videoUrl3", "catalog_episode"."videoUrl3"),
               "videoUrl4" = COALESCE(EXCLUDED."videoUrl4", "catalog_episode"."videoUrl4"),
               "videoUrl5" = COALESCE(EXCLUDED."videoUrl5", "catalog_episode"."videoUrl5"),
               "published" = EXCLUDED."published",
               "publishedAt" = COALESCE("catalog_episode"."publishedAt", EXCLUDED."publishedAt"),
               "updatedAt" = CURRENT_TIMESTAMP;`,
            [
              episodeIdToUse, id, seasonNumber, epNumber,
              epTitle, epThumbnail, epDuration, epSynopsis,
              videoUrl, videoUrl2, videoUrl3, videoUrl4, videoUrl5,
              published, publishedAt,
            ],
          );

          importedEpisodes++;
        }
      }
    }

    await client.query("COMMIT");
    console.log("\n=======================================================");
    console.log("[catalog-import] SUCESSO: Importação concluída na íntegra!");
    console.log(`[catalog-import] Animes processados:     ${importedAnimes}`);
    console.log(`[catalog-import] Temporadas processadas: ${importedSeasons}`);
    console.log(`[catalog-import] Episódios importados:   ${importedEpisodes}`);
    console.log(`[catalog-import] Episódios ignorados:    ${ignoredEpisodes} (sem fonte de vídeo válida)`);
    console.log("=======================================================\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n[catalog-import] ERRO CRÍTICO: Transação revertida com sucesso.");
    console.error(`[catalog-import] Motivo: ${err.message || err}`);
    if (err.detail) console.error(`[catalog-import] Detalhe: ${err.detail}`);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[catalog-import] Falha na execução:", err?.message || err);
  process.exit(1);
});
