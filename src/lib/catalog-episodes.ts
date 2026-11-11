import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import type { Episode, Season } from "@/lib/types";
import { readTombstones } from "@/lib/catalog-storage";

export const getCatalogEpisodesSchema = z.object({
  animeId: z.string().min(1, "animeId é obrigatório"),
});

export type GetCatalogEpisodesInput = z.infer<typeof getCatalogEpisodesSchema>;

export interface CatalogEpisodeItem {
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
  createdAt?: string;
  updatedAt?: string;
}

export interface CatalogSeasonItem {
  animeId: string;
  number: number;
  title: string | null;
  position: number;
  createdAt?: string;
}

export interface CatalogEpisodesResult {
  animeId: string;
  seasons: CatalogSeasonItem[];
  episodes: CatalogEpisodeItem[];
}

// Cache em memória com staleTime de aproximadamente 2 minutos
const STALE_TIME_MS = 2 * 60 * 1000;

interface CacheEntry {
  timestamp: number;
  data: CatalogEpisodesResult;
}

const clientCatalogEpisodesCache = new Map<string, CacheEntry>();
const clientInFlightPromises = new Map<string, Promise<CatalogEpisodesResult>>();

/**
 * Invalida o cache em memória de episódios para um anime específico (ou todo o cache).
 */
export function invalidateCatalogEpisodesCache(animeId?: string): void {
  if (animeId) {
    clientCatalogEpisodesCache.delete(animeId);
    clientInFlightPromises.delete(animeId);
  } else {
    clientCatalogEpisodesCache.clear();
    clientInFlightPromises.clear();
  }
}

/**
 * Alimenta o cache de episódios (útil para pré-carregamento no loader).
 */
export function primeCatalogEpisodesCache(
  animeId: string,
  data: CatalogEpisodesResult,
): void {
  if (!animeId) return;
  clientCatalogEpisodesCache.set(animeId, {
    timestamp: Date.now(),
    data,
  });
}

/**
 * Consulta server-side segura de episódios publicados e temporadas de um anime.
 */
export async function executeGetCatalogEpisodes(
  animeId: string,
): Promise<CatalogEpisodesResult> {
  const cleanId = animeId?.trim();
  if (!cleanId) {
    return { animeId: "", seasons: [], episodes: [] };
  }

  try {
    const sql = await getSql();

    // 1. Episódios publicados, ordenados por temporada e número
    const episodeRows = await sql.query<CatalogEpisodeItem>(
      `SELECT
         "id",
         "animeId",
         "seasonNumber",
         "number",
         "title",
         "thumbnail",
         "duration",
         "synopsis",
         "videoUrl",
         "videoUrl2",
         "videoUrl3",
         "videoUrl4",
         "videoUrl5",
         "published",
         "publishedAt",
         "createdAt",
         "updatedAt"
       FROM "catalog_episode"
       WHERE "animeId" = $1 AND "published" = true
       ORDER BY "seasonNumber" ASC, "number" ASC;`,
      [cleanId],
    );

    // 2. Metadados de temporadas, ordenados por posição e número
    const seasonRows = await sql.query<CatalogSeasonItem>(
      `SELECT
         "animeId",
         "number",
         "title",
         "position",
         "createdAt"
       FROM "catalog_season"
       WHERE "animeId" = $1
       ORDER BY "position" ASC, "number" ASC;`,
      [cleanId],
    );

    return {
      animeId: cleanId,
      seasons: seasonRows,
      episodes: episodeRows,
    };
  } catch (err) {
    console.warn("[Hikari] Falha segura ao consultar catalog_episode:", err);
    return {
      animeId: cleanId,
      seasons: [],
      episodes: [],
    };
  }
}

/**
 * Server Function GET para consultar episódios publicados de um anime no PostgreSQL.
 */
export const getCatalogEpisodes = createServerFn({
  method: "GET",
})
  .validator(getCatalogEpisodesSchema)
  .handler(async ({ data }): Promise<CatalogEpisodesResult> => {
    return executeGetCatalogEpisodes(data.animeId);
  });

/**
 * Constrói temporadas resolvidas a partir dos dados remotos e do fallback local.
 */
function buildResolvedSeasons(
  animeId: string,
  remoteData: CatalogEpisodesResult,
  safeLocalSeasons: Season[],
): Season[] {
  if (!remoteData || !Array.isArray(remoteData.episodes) || remoteData.episodes.length === 0) {
    return safeLocalSeasons;
  }

  const tombstones =
    typeof window !== "undefined" ? new Set(readTombstones()) : new Set<string>();

  // Mapa de temporadas locais por número (filtrando episódios excluídos por tombstone)
  const localSeasonByNumber = new Map<number, Season>();
  for (const ls of safeLocalSeasons) {
    localSeasonByNumber.set(ls.number, {
      ...ls,
      episodes: (ls.episodes || []).filter((ep) => !tombstones.has(ep.id)),
    });
  }

  // Mapa de metadados remotos de temporadas por número
  const seasonMetaMap = new Map<number, CatalogSeasonItem>();
  for (const s of remoteData.seasons || []) {
    seasonMetaMap.set(s.number, s);
  }

  // Agrupar episódios remotos por temporada (filtrando episódios excluídos por tombstone)
  const episodesBySeason = new Map<number, CatalogEpisodeItem[]>();
  for (const ep of remoteData.episodes) {
    if (tombstones.has(ep.id)) continue;
    const sNum = ep.seasonNumber || 1;
    const list = episodesBySeason.get(sNum) ?? [];
    list.push(ep);
    episodesBySeason.set(sNum, list);
  }

  const resolvedSeasons: Season[] = [];
  const processedSeasonNumbers = new Set<number>();

  // Processa todas as temporadas com episódios publicados no banco
  for (const [seasonNum, remoteEps] of Array.from(episodesBySeason.entries())) {
    processedSeasonNumbers.add(seasonNum);
    const localSeason = localSeasonByNumber.get(seasonNum);
    const seasonMeta = seasonMetaMap.get(seasonNum);

    // Mapa de episódios locais por número e ID para fallback de metadados
    const localEpByNumber = new Map<number, Episode>();
    const localEpById = new Map<string, Episode>();
    for (const lep of localSeason?.episodes ?? []) {
      localEpByNumber.set(lep.number, lep);
      localEpById.set(lep.id, lep);
    }

    // Constrói episódios canônicos do banco com fallback em metadados locais
    const resolvedEpisodes: Episode[] = remoteEps.map((rep) => {
      const localEp = localEpById.get(rep.id) ?? localEpByNumber.get(rep.number);

      return {
        id: rep.id,
        number: rep.number,
        title: rep.title?.trim() || localEp?.title?.trim() || `Episódio ${rep.number}`,
        thumbnail: rep.thumbnail?.trim() || localEp?.thumbnail?.trim() || undefined,
        duration: rep.duration?.trim() || localEp?.duration?.trim() || undefined,
        synopsis: rep.synopsis?.trim() || localEp?.synopsis?.trim() || undefined,
        videoUrl: rep.videoUrl?.trim() || localEp?.videoUrl?.trim() || undefined,
        videoUrl2: rep.videoUrl2?.trim() || localEp?.videoUrl2?.trim() || undefined,
        videoUrl3: rep.videoUrl3?.trim() || localEp?.videoUrl3?.trim() || undefined,
        videoUrl4: rep.videoUrl4?.trim() || localEp?.videoUrl4?.trim() || undefined,
        videoUrl5: rep.videoUrl5?.trim() || localEp?.videoUrl5?.trim() || undefined,
        aired:
          localEp?.aired ||
          (rep.publishedAt ? new Date(rep.publishedAt).toLocaleDateString("pt-BR") : undefined),
        published: rep.published ?? true,
      };
    });

    // Ordenar episódios por número crescente
    resolvedEpisodes.sort((a, b) => a.number - b.number);

    const seasonTitle =
      seasonMeta?.title?.trim() ||
      localSeason?.title?.trim() ||
      `Temporada ${seasonNum}`;

    const seasonId = localSeason?.id || `s-${animeId}-${seasonNum}`;

    resolvedSeasons.push({
      id: seasonId,
      number: seasonNum,
      title: seasonTitle,
      episodes: resolvedEpisodes,
    });
  }

  // Preserva temporadas locais que não possuem registros no banco
  for (const [seasonNum, localSeason] of Array.from(localSeasonByNumber.entries())) {
    if (!processedSeasonNumbers.has(seasonNum)) {
      const seasonMeta = seasonMetaMap.get(seasonNum);
      resolvedSeasons.push({
        ...localSeason,
        title: seasonMeta?.title?.trim() || localSeason.title || `Temporada ${seasonNum}`,
      });
    }
  }

  // Ordenar temporadas pela posição (se cadastrada) ou pelo número
  resolvedSeasons.sort((a, b) => {
    const posA = seasonMetaMap.get(a.number)?.position ?? a.number;
    const posB = seasonMetaMap.get(b.number)?.position ?? b.number;
    if (posA !== posB) return posA - posB;
    return a.number - b.number;
  });

  return resolvedSeasons;
}

/**
 * Obtém sincronamente temporadas resolvidas se já estiverem em cache (staleTime 2min).
 */
export function getCachedResolvedSeasons(
  animeId: string,
  localSeasons?: Season[],
): Season[] | null {
  if (!animeId) return null;
  const entry = clientCatalogEpisodesCache.get(animeId);
  if (!entry) return null;

  const isFresh = Date.now() - entry.timestamp < STALE_TIME_MS;
  if (!isFresh) return null;

  const safeLocalSeasons = Array.isArray(localSeasons)
    ? localSeasons.map((s) => ({
        ...s,
        episodes: Array.isArray(s.episodes) ? [...s.episodes] : [],
      }))
    : [];

  return buildResolvedSeasons(animeId, entry.data, safeLocalSeasons);
}

/**
 * Resolve temporadas e episódios combinando a fonte canônica do PostgreSQL com o fallback local.
 *
 * Comportamento:
 * 1. Consulta episódios publicados no banco (com cache in-memory de 2 minutos).
 * 2. Se a consulta falhar, devolve as temporadas locais sem alterações destrutivas.
 * 3. Se não houver registros publicados no banco, preserva as temporadas locais.
 * 4. Se houver registros publicados, usa o banco como fonte canônica para os episódios retornados.
 * 5. Aproveita metadados locais como fallback quando campos remotos estiverem vazios.
 * 6. Não inventa episódios.
 * 7. Não modifica os dados originais do IndexedDB.
 * 8. Preserva a ordem correta dos episódios e temporadas.
 */
export async function resolveEpisodes(
  animeId: string,
  localSeasons?: Season[],
): Promise<Season[]> {
  const tombstones =
    typeof window !== "undefined" ? new Set(readTombstones()) : new Set<string>();

  const safeLocalSeasons = Array.isArray(localSeasons)
    ? localSeasons.map((s) => ({
        ...s,
        episodes: Array.isArray(s.episodes)
          ? s.episodes.filter((ep) => !tombstones.has(ep.id))
          : [],
      }))
    : [];

  if (!animeId || typeof animeId !== "string" || !animeId.trim()) {
    return safeLocalSeasons;
  }

  const cleanId = animeId.trim();

  try {
    // 1. Verifica cache local válido (staleTime 2 minutos)
    const cachedEntry = clientCatalogEpisodesCache.get(cleanId);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < STALE_TIME_MS) {
      return buildResolvedSeasons(cleanId, cachedEntry.data, safeLocalSeasons);
    }

    // 2. Consulta remota ou deduplica com requisição em voo
    let fetchPromise = clientInFlightPromises.get(cleanId);
    if (!fetchPromise) {
      if (typeof window === "undefined") {
        fetchPromise = executeGetCatalogEpisodes(cleanId);
      } else {
        fetchPromise = getCatalogEpisodes({ data: { animeId: cleanId } });
      }
      clientInFlightPromises.set(cleanId, fetchPromise);
    }

    const remoteData = await fetchPromise;
    clientInFlightPromises.delete(cleanId);

    // Atualiza cache em memória
    clientCatalogEpisodesCache.set(cleanId, {
      timestamp: Date.now(),
      data: remoteData,
    });

    return buildResolvedSeasons(cleanId, remoteData, safeLocalSeasons);
  } catch (err) {
    clientInFlightPromises.delete(cleanId);
    console.warn("[Hikari] Erro ao resolver episódios, usando fallback local:", err);
    return safeLocalSeasons;
  }
}
