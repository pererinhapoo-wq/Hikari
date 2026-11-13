import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import type { Episode, Season } from "@/lib/types";
import {
  readTombstones,
  readTombstoneRecords,
  isEpisodeTombstoned,
  type TombstoneRecord,
} from "@/lib/catalog-storage";
import { readOutbox, type OutboxOperation } from "@/lib/episode-writer";

export const getCatalogEpisodesSchema = z.object({
  animeId: z.string().min(1, "animeId é obrigatório"),
  includeUnpublished: z.boolean().optional(),
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
 * Consulta server-side segura de episódios (publicados ou todos no caso administrativo)
 * e metadados de temporadas de um anime.
 */
export async function executeGetCatalogEpisodes(
  animeId: string,
  options?: { includeUnpublished?: boolean },
): Promise<CatalogEpisodesResult> {
  const cleanId = animeId?.trim();
  if (!cleanId) {
    return { animeId: "", seasons: [], episodes: [] };
  }

  try {
    const sql = await getSql();

    const whereClause = options?.includeUnpublished
      ? `WHERE "animeId" = $1`
      : `WHERE "animeId" = $1 AND "published" = true`;

    // 1. Episódios, ordenados por temporada e número
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
       ${whereClause}
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
 * Server Function GET para consultar episódios publicados de um anime no PostgreSQL (acesso público).
 */
export const getCatalogEpisodes = createServerFn({
  method: "GET",
})
  .validator(getCatalogEpisodesSchema)
  .handler(async ({ data }): Promise<CatalogEpisodesResult> => {
    return executeGetCatalogEpisodes(data.animeId, {
      includeUnpublished: data.includeUnpublished,
    });
  });

/**
 * Server Function GET para recuperar todos os episódios (inclusive rascunhos)
 * no painel administrativo a partir do PostgreSQL.
 */
export const getAdminCatalogEpisodes = createServerFn({
  method: "GET",
})
  .validator(getCatalogEpisodesSchema)
  .handler(async ({ data }): Promise<CatalogEpisodesResult> => {
    return executeGetCatalogEpisodes(data.animeId, {
      includeUnpublished: true,
    });
  });

export interface PublicEpisodeRow {
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
  createdAt: string;
  updatedAt: string;
  animeTitle: string | null;
  animeTitleRomaji: string | null;
  animeTitleEnglish: string | null;
  animeTitleNative: string | null;
  animeCover: string | null;
  animeBanner: string | null;
  animeStatus: string | null;
  animeEpisodesCount: number | null;
  animeCreatedAt: string | null;
  animeUpdatedAt: string | null;
  seasonTitle: string | null;
}

export type PublicEpisodesFetchStatus = "success" | "empty" | "error";

export interface PublicEpisodesResult {
  status: PublicEpisodesFetchStatus;
  episodes: PublicEpisodeRow[];
  total: number;
  error?: string;
}

/**
 * Consulta server-side direta dos episódios publicados no PostgreSQL para exibição pública
 * na Home e na página /episodes.
 * 
 * Regras da Etapa 4:
 * 1. Recupera apenas episódios marcados com published = true.
 * 2. Exclui rascunhos.
 * 3. Une metadados de anime e temporada canônicos.
 * 4. Ordena temporalmente de forma decrescente (mais recentes primeiro).
 * 5. Não executa escritas, mutações ou exclusões no banco de dados (leitura pura).
 * 6. Em caso de falha de conexão, retorna status = "error" com erro detalhado.
 */
export async function executeGetPublicCatalogEpisodes(options?: {
  limit?: number;
  offset?: number;
}): Promise<PublicEpisodesResult> {
  try {
    const sql = await getSql();
    const limit =
      typeof options?.limit === "number" && options.limit > 0
        ? options.limit
        : 2000;
    const offset =
      typeof options?.offset === "number" && options.offset >= 0
        ? options.offset
        : 0;

    const rows = await sql.query<PublicEpisodeRow>(
      `SELECT
         e."id",
         e."animeId",
         e."seasonNumber",
         e."number",
         e."title",
         e."thumbnail",
         e."duration",
         e."synopsis",
         e."videoUrl",
         e."videoUrl2",
         e."videoUrl3",
         e."videoUrl4",
         e."videoUrl5",
         e."published",
         e."publishedAt",
         e."createdAt",
         e."updatedAt",
         COALESCE(NULLIF(a."title", ''), a."titleRomaji", a."titleEnglish", 'Anime') AS "animeTitle",
         a."titleRomaji" AS "animeTitleRomaji",
         a."titleEnglish" AS "animeTitleEnglish",
         a."titleNative" AS "animeTitleNative",
         a."cover" AS "animeCover",
         a."banner" AS "animeBanner",
         a."status" AS "animeStatus",
         a."episodesCount" AS "animeEpisodesCount",
         a."createdAt" AS "animeCreatedAt",
         a."updatedAt" AS "animeUpdatedAt",
         s."title" AS "seasonTitle"
       FROM "catalog_episode" e
       LEFT JOIN "catalog_anime" a ON a."id" = e."animeId"
       LEFT JOIN "catalog_season" s ON s."animeId" = e."animeId" AND s."number" = e."seasonNumber"
       WHERE e."published" = true
       ORDER BY e."publishedAt" DESC NULLS LAST, e."createdAt" DESC, e."seasonNumber" DESC, e."number" DESC
       LIMIT $1 OFFSET $2;`,
      [limit, offset],
    );

    const episodes = Array.isArray(rows) ? rows : [];

    return {
      status: episodes.length > 0 ? "success" : "empty",
      episodes,
      total: episodes.length,
    };
  } catch (err: any) {
    console.warn("[Hikari] Falha segura ao consultar episódios públicos do PostgreSQL:", err);
    return {
      status: "error",
      episodes: [],
      total: 0,
      error: err?.message || String(err),
    };
  }
}

export const getPublicCatalogEpisodesSchema = z
  .object({
    limit: z.number().optional(),
    offset: z.number().optional(),
  })
  .optional();

/**
 * Server Function GET para consulta pública de episódios publicados no PostgreSQL
 * acessível tanto no SSR quanto via RPC no cliente.
 */
export const getPublicCatalogEpisodes = createServerFn({
  method: "GET",
})
  .validator((d?: { limit?: number; offset?: number }) => d ?? {})
  .handler(async ({ data }): Promise<PublicEpisodesResult> => {
    return executeGetPublicCatalogEpisodes(data);
  });

/**
 * Constrói temporadas resolvidas a partir dos dados remotos e do fallback local.
 */
/**
 * Constrói temporadas resolvidas a partir dos dados remotos do PostgreSQL e do catálogo local.
 *
 * Implementação segura da Etapa 3 (HIKARI):
 * 1. Não descarta episódios locais apenas porque uma temporada possui outros episódios no servidor (Resolve Problema A).
 * 2. Reconhece slots por (animeId, seasonNumber, episodeNumber).
 * 3. Preserva episódios locais ausentes no PostgreSQL (ex: novos episódios criados offline ou em rascunho).
 * 4. Preserva episódios locais em estado "pending" ou "conflict".
 * 5. Utiliza dados canônicos do PostgreSQL para episódios confirmados no servidor quando não houver pendências locais.
 * 6. Evita duplicação quando o mesmo registro aparecer em ambas as fontes.
 * 7. Não oculta episódios confirmados no PostgreSQL por tombstones legados/antigos, a não ser que haja
 *    uma operação de exclusão ativa e intencional no Outbox (Resolve Problema B).
 * 8. Aplica isolamento estrito de tombstones por anime (um tombstone do anime X nunca oculta do anime Y).
 * 9. Idempotente e determinístico: múltiplas execuções com as mesmas entradas produzem idêntico resultado.
 */
export function buildResolvedSeasons(
  animeId: string,
  remoteData: CatalogEpisodesResult,
  safeLocalSeasons: Season[],
  options?: { outbox?: OutboxOperation[]; tombstones?: TombstoneRecord[] },
): Season[] {
  const cleanId = animeId?.trim() || "";

  // 1. Ler operações do Outbox para este anime (respeita estado pending/conflict/delete)
  const animeOutbox =
    options?.outbox !== undefined
      ? options.outbox.filter((o) => o.animeId === cleanId)
      : typeof window !== "undefined"
        ? readOutbox().filter((o) => o.animeId === cleanId)
        : [];

  // 2. Ler registros estruturados de tombstones
  const allTombstones =
    options?.tombstones !== undefined
      ? options.tombstones
      : typeof window !== "undefined"
        ? readTombstoneRecords()
        : [];

  // Filtra tombstones aplicáveis a este anime (isolamento estrito: ignora tombstones de outro anime ou sem anime)
  const applicableTombstones = allTombstones.filter(
    (t) => t.animeId === cleanId,
  );

  // Regra de Tombstone para Episódios Confirmados no PostgreSQL:
  // Um episódio confirmado no servidor só é ocultado se houver uma exclusão ATIVA na Outbox local.
  // Tombstones antigos ou órfãos sem exclusão ativa no Outbox NÃO ocultam registros do banco.
  const isRemoteEpisodeDeleted = (rep: CatalogEpisodeItem): boolean => {
    return animeOutbox.some(
      (op) =>
        op.type === "delete" &&
        (op.episodeId === rep.id ||
          (op.seasonNumber === (rep.seasonNumber || 1) &&
            op.episodeNumber === rep.number)),
    );
  };

  // Regra de Tombstone para Episódios Exclusivamente Locais:
  const isLocalEpisodeDeleted = (lep: Episode, sNum: number): boolean => {
    // Se o usuário adicionou um novo upsert local, não filtra (republicação/recriação)
    const hasActiveUpsert = animeOutbox.some(
      (op) =>
        op.type === "upsert" &&
        (op.episodeId === lep.id ||
          (op.seasonNumber === sNum && op.episodeNumber === lep.number)),
    );
    if (hasActiveUpsert) return false;

    // Se houver exclusão pendente na Outbox
    const hasActiveDelete = animeOutbox.some(
      (op) =>
        op.type === "delete" &&
        (op.episodeId === lep.id ||
          (op.seasonNumber === sNum && op.episodeNumber === lep.number)),
    );
    if (hasActiveDelete) return true;

    // Se houver tombstone correspondente a este anime
    return isEpisodeTombstoned(applicableTombstones, cleanId, lep.id, sNum, lep.number);
  };

  const safeLocal = Array.isArray(safeLocalSeasons)
    ? safeLocalSeasons.map((s) => ({
        ...s,
        episodes: Array.isArray(s.episodes) ? [...s.episodes] : [],
      }))
    : [];

  const remoteEpisodes = Array.isArray(remoteData?.episodes)
    ? remoteData.episodes
    : [];
  const remoteSeasons = Array.isArray(remoteData?.seasons)
    ? remoteData.seasons
    : [];

  // Mapear metadados remotos de temporadas por número
  const seasonMetaMap = new Map<number, CatalogSeasonItem>();
  for (const s of remoteSeasons) {
    seasonMetaMap.set(s.number, s);
  }

  // Mapear temporadas locais por número
  const localSeasonByNumber = new Map<number, Season>();
  for (const ls of safeLocal) {
    localSeasonByNumber.set(ls.number, ls);
  }

  // Agrupar episódios remotos por temporada (aplicando verificação de exclusão ativa)
  const remoteEpsBySeason = new Map<number, CatalogEpisodeItem[]>();
  for (const ep of remoteEpisodes) {
    if (isRemoteEpisodeDeleted(ep)) continue;
    const sNum = ep.seasonNumber || 1;
    const list = remoteEpsBySeason.get(sNum) ?? [];
    list.push(ep);
    remoteEpsBySeason.set(sNum, list);
  }

  // Identificar todas as temporadas existentes (locais + remotas)
  const allSeasonNumbers = new Set<number>();
  for (const ls of safeLocal) {
    allSeasonNumbers.add(ls.number);
  }
  for (const s of remoteSeasons) {
    allSeasonNumbers.add(s.number);
  }
  for (const ep of remoteEpisodes) {
    allSeasonNumbers.add(ep.seasonNumber || 1);
  }

  if (allSeasonNumbers.size === 0) {
    return safeLocal;
  }

  const resolvedSeasons: Season[] = [];

  for (const sNum of Array.from(allSeasonNumbers)) {
    const localSeason = localSeasonByNumber.get(sNum);
    const remoteEpsForSeason = remoteEpsBySeason.get(sNum) ?? [];
    const seasonMeta = seasonMetaMap.get(sNum);

    // Episódios locais filtrando tombstones válidos deste anime
    const localEps = (localSeason?.episodes ?? []).filter(
      (lep) => !isLocalEpisodeDeleted(lep, sNum),
    );

    // Mapas de busca remota por número e por ID
    const remoteByNumber = new Map<number, CatalogEpisodeItem>();
    const remoteById = new Map<string, CatalogEpisodeItem>();
    for (const rep of remoteEpsForSeason) {
      remoteByNumber.set(rep.number, rep);
      remoteById.set(rep.id, rep);
    }

    // Mapas de busca local por número e por ID
    const localByNumber = new Map<number, Episode>();
    const localById = new Map<string, Episode>();
    for (const lep of localEps) {
      localByNumber.set(lep.number, lep);
      localById.set(lep.id, lep);
    }

    // Identificar todos os números de episódios nesta temporada (remotos + locais)
    const allEpisodeNumbers = new Set<number>();
    for (const rep of remoteEpsForSeason) {
      allEpisodeNumbers.add(rep.number);
    }
    for (const lep of localEps) {
      allEpisodeNumbers.add(lep.number);
    }

    const sortedEpNumbers = Array.from(allEpisodeNumbers).sort((a, b) => a - b);
    const resolvedEpisodes: Episode[] = [];

    for (const epNum of sortedEpNumbers) {
      const rep = remoteByNumber.get(epNum);
      const lep = localByNumber.get(epNum);

      if (rep && lep) {
        // Colisão de slot: o episódio existe tanto local quanto remotamente
        const op = animeOutbox.find(
          (o) =>
            o.episodeId === lep.id ||
            (o.seasonNumber === sNum && o.episodeNumber === epNum),
        );

        if (op?.status === "conflict") {
          // Preserva a versão local com status de conflito para resolução
          resolvedEpisodes.push(lep);
        } else if (op?.status === "pending" || (op && op.type === "upsert")) {
          // Preserva a versão local pendente (trabalho não salvo pelo usuário)
          resolvedEpisodes.push(lep);
        } else {
          // Confirmado / sincronizado: utiliza dados canônicos do PostgreSQL com fallback local
          resolvedEpisodes.push({
            id: rep.id,
            number: rep.number,
            title: rep.title?.trim() || lep.title?.trim() || `Episódio ${rep.number}`,
            thumbnail: rep.thumbnail?.trim() || lep.thumbnail?.trim() || undefined,
            duration: rep.duration?.trim() || lep.duration?.trim() || undefined,
            synopsis: rep.synopsis?.trim() || lep.synopsis?.trim() || undefined,
            videoUrl: rep.videoUrl?.trim() || lep.videoUrl?.trim() || undefined,
            videoUrl2: rep.videoUrl2?.trim() || lep.videoUrl2?.trim() || undefined,
            videoUrl3: rep.videoUrl3?.trim() || lep.videoUrl3?.trim() || undefined,
            videoUrl4: rep.videoUrl4?.trim() || lep.videoUrl4?.trim() || undefined,
            videoUrl5: rep.videoUrl5?.trim() || lep.videoUrl5?.trim() || undefined,
            aired:
              lep.aired ||
              (rep.publishedAt ? new Date(rep.publishedAt).toLocaleDateString("pt-BR") : undefined),
            published: rep.published ?? lep.published ?? true,
          });
        }
      } else if (rep && !lep) {
        // Existe apenas no PostgreSQL (reconstruído a partir do servidor)
        const localByIdMatch = localById.get(rep.id);
        resolvedEpisodes.push({
          id: rep.id,
          number: rep.number,
          title: rep.title?.trim() || localByIdMatch?.title?.trim() || `Episódio ${rep.number}`,
          thumbnail: rep.thumbnail?.trim() || localByIdMatch?.thumbnail?.trim() || undefined,
          duration: rep.duration?.trim() || localByIdMatch?.duration?.trim() || undefined,
          synopsis: rep.synopsis?.trim() || localByIdMatch?.synopsis?.trim() || undefined,
          videoUrl: rep.videoUrl?.trim() || localByIdMatch?.videoUrl?.trim() || undefined,
          videoUrl2: rep.videoUrl2?.trim() || localByIdMatch?.videoUrl2?.trim() || undefined,
          videoUrl3: rep.videoUrl3?.trim() || localByIdMatch?.videoUrl3?.trim() || undefined,
          videoUrl4: rep.videoUrl4?.trim() || localByIdMatch?.videoUrl4?.trim() || undefined,
          videoUrl5: rep.videoUrl5?.trim() || localByIdMatch?.videoUrl5?.trim() || undefined,
          aired:
            localByIdMatch?.aired ||
            (rep.publishedAt ? new Date(rep.publishedAt).toLocaleDateString("pt-BR") : undefined),
          published: rep.published ?? true,
        });
      } else if (!rep && lep) {
        // Se este ID já foi mapeado por um episódio remoto em outro slot da mesma temporada
        // e não há alteração pendente/conflito no outbox, não duplica
        if (remoteById.has(lep.id)) {
          const op = animeOutbox.find(
            (o) =>
              o.episodeId === lep.id ||
              (o.seasonNumber === sNum && o.episodeNumber === epNum),
          );
          if (!op) {
            continue;
          }
        }
        // Existe apenas localmente (PRESERVADO — resolve o Problema A!)
        resolvedEpisodes.push(lep);
      }
    }

    // Ordenar episódios numericamente
    resolvedEpisodes.sort((a, b) => a.number - b.number);

    const seasonTitle =
      (localSeason?.title && localSeason.title !== `Temporada ${sNum}`
        ? localSeason.title
        : seasonMeta?.title?.trim()) ||
      localSeason?.title?.trim() ||
      `Temporada ${sNum}`;

    const seasonId = localSeason?.id || `s-${cleanId}-${sNum}`;

    resolvedSeasons.push({
      id: seasonId,
      number: sNum,
      title: seasonTitle,
      episodes: resolvedEpisodes,
    });
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

/**
 * Converte um item de episódio canônico do PostgreSQL para a interface Episode do Hikari.
 * Preserva estritamente todos os campos: ID canônico, número, título, sinopse, thumbnail,
 * duração, estado de publicação (inclusive rascunho sem vídeo) e as 5 fontes de reprodução.
 */
export function catalogItemToEpisode(item: CatalogEpisodeItem): Episode {
  return {
    id: item.id,
    number: item.number,
    title: item.title?.trim() || `Episódio ${item.number}`,
    thumbnail: item.thumbnail?.trim() || undefined,
    duration: item.duration?.trim() || undefined,
    synopsis: item.synopsis?.trim() || undefined,
    videoUrl: item.videoUrl?.trim() || undefined,
    videoUrl2: item.videoUrl2?.trim() || undefined,
    videoUrl3: item.videoUrl3?.trim() || undefined,
    videoUrl4: item.videoUrl4?.trim() || undefined,
    videoUrl5: item.videoUrl5?.trim() || undefined,
    published: item.published ?? false,
    aired: item.publishedAt
      ? new Date(item.publishedAt).toLocaleDateString("pt-BR")
      : undefined,
  };
}

export interface MergeAdminEpisodesInput {
  animeId: string;
  localSeasons?: Season[] | null;
  serverResult: CatalogEpisodesResult;
  outboxOps?: OutboxOperation[];
}

export interface MergeAdminEpisodesResult {
  seasons: Season[];
  totalServerEpisodes: number;
  recoveredCount: number;
  preservedPendingCount: number;
  preservedConflictCount: number;
  localOnlyCount: number;
}

/**
 * Mescla de forma segura e não destrutiva as temporadas e episódios recuperados do PostgreSQL
 * com o estado do painel administrativo.
 *
 * Regras da Etapa 2:
 * 1. O PostgreSQL é a fonte canônica para os episódios confirmados no servidor.
 * 2. Preserva episódios com estado "pending" ou "conflict" no Outbox.
 * 3. Não descarta episódios locais apenas porque ainda não existem no PostgreSQL.
 * 4. Não trata episódios ausentes na resposta do servidor como exclusões.
 * 5. Em colisão de slot (mesma temporada e número):
 *    - Se o local estiver confirmado ("synced"), atualiza com os dados do PostgreSQL.
 *    - Se o local estiver com alterações "pending", preserva a versão local pendente para que o administrador não perca trabalho.
 *    - Se o local estiver em "conflict", preserva os dados locais e o aviso de conflito para resolução explícita.
 * 6. Preserva todos os campos canônicos: ID, número, temporada, título, sinopse, thumbnail, duração,
 *    estado de publicação, data e todas as 5 fontes de reprodução (videoUrl a videoUrl5).
 * 7. Reconstrói temporadas a partir de catalog_season e catalog_episode quando o IndexedDB estiver vazio.
 * 8. Não executa mutações, exclusões ou chamadas de gravação na base de dados (opera puramente em memória).
 */
export function mergeAdminEpisodesWithServer(
  input: MergeAdminEpisodesInput,
): MergeAdminEpisodesResult {
  const { animeId, localSeasons, serverResult, outboxOps = [] } = input;

  const animeOutbox = outboxOps.filter((o) => o.animeId === animeId);
  const serverEpisodes = serverResult?.episodes || [];
  const serverSeasonsMeta = serverResult?.seasons || [];

  let recoveredCount = 0;
  let preservedPendingCount = 0;
  let preservedConflictCount = 0;
  let localOnlyCount = 0;

  const safeLocalSeasons = Array.isArray(localSeasons)
    ? localSeasons.map((s) => ({
        ...s,
        episodes: Array.isArray(s.episodes) ? [...s.episodes] : [],
      }))
    : [];

  // Mapear metadados de temporadas remotas por número
  const serverSeasonMetaMap = new Map<number, CatalogSeasonItem>();
  for (const s of serverSeasonsMeta) {
    serverSeasonMetaMap.set(s.number, s);
  }

  // Identificar todas as temporadas relevantes (locais + remotas)
  const seasonNumbersSet = new Set<number>();
  for (const s of safeLocalSeasons) {
    seasonNumbersSet.add(s.number);
  }
  for (const ep of serverEpisodes) {
    seasonNumbersSet.add(ep.seasonNumber || 1);
  }
  for (const sm of serverSeasonsMeta) {
    seasonNumbersSet.add(sm.number);
  }

  // Se nenhuma temporada existir, fornece pelo menos a Temporada 1
  if (seasonNumbersSet.size === 0) {
    seasonNumbersSet.add(1);
  }

  const mergedSeasons: Season[] = [];

  for (const sNum of Array.from(seasonNumbersSet)) {
    const localSeason = safeLocalSeasons.find((s) => s.number === sNum);
    const serverEpsForSeason = serverEpisodes.filter(
      (e) => (e.seasonNumber || 1) === sNum,
    );
    const seasonMeta = serverSeasonMetaMap.get(sNum);

    const localEpisodes = localSeason?.episodes || [];

    // Mapas para busca rápida por número e por ID
    const serverByNumber = new Map<number, CatalogEpisodeItem>();
    for (const sep of serverEpsForSeason) {
      serverByNumber.set(sep.number, sep);
    }

    const allNumbers = new Set<number>();
    for (const lep of localEpisodes) {
      allNumbers.add(lep.number);
    }
    for (const sep of serverEpsForSeason) {
      allNumbers.add(sep.number);
    }

    const sortedNumbers = Array.from(allNumbers).sort((a, b) => a - b);
    const mergedEpisodes: Episode[] = [];

    for (const epNum of sortedNumbers) {
      const lep = localEpisodes.find((e) => e.number === epNum);
      const sep = serverByNumber.get(epNum);

      if (lep && sep) {
        // Colisão de slot: existe tanto local quanto no PostgreSQL
        const outboxOp = animeOutbox.find(
          (o) =>
            o.episodeId === lep.id ||
            (o.seasonNumber === sNum && o.episodeNumber === epNum),
        );

        if (outboxOp?.status === "conflict") {
          // Mantém versão local com erro de conflito
          mergedEpisodes.push(lep);
          preservedConflictCount++;
        } else if (outboxOp?.status === "pending" || outboxOp) {
          // Mantém versão local com alteração pendente
          mergedEpisodes.push(lep);
          preservedPendingCount++;
        } else {
          // Confirmado / sincronizado: atualiza com os dados canônicos do PostgreSQL
          mergedEpisodes.push(catalogItemToEpisode(sep));
          recoveredCount++;
        }
      } else if (lep && !sep) {
        // Episódio existe apenas localmente (ex: rascunho offline ou pendente de criação)
        const outboxOp = animeOutbox.find(
          (o) =>
            o.episodeId === lep.id ||
            (o.seasonNumber === sNum && o.episodeNumber === epNum),
        );
        if (outboxOp?.status === "conflict") {
          preservedConflictCount++;
        } else if (outboxOp?.status === "pending" || outboxOp) {
          preservedPendingCount++;
        } else {
          localOnlyCount++;
        }
        mergedEpisodes.push(lep);
      } else if (!lep && sep) {
        // Episódio existe no PostgreSQL mas não existia no local (ex: outro dispositivo / IndexedDB vazio)
        mergedEpisodes.push(catalogItemToEpisode(sep));
        recoveredCount++;
      }
    }

    // Ordenar episódios numericamente
    mergedEpisodes.sort((a, b) => a.number - b.number);

    // Determinar título da temporada respeitando metadados salvos
    const seasonTitle =
      (localSeason?.title && localSeason.title !== `Temporada ${sNum}`
        ? localSeason.title
        : seasonMeta?.title?.trim()) ||
      localSeason?.title?.trim() ||
      `Temporada ${sNum}`;

    const seasonId = localSeason?.id || `s-${animeId}-${sNum}`;

    mergedSeasons.push({
      id: seasonId,
      number: sNum,
      title: seasonTitle,
      episodes: mergedEpisodes,
    });
  }

  // Ordenar temporadas por position (se cadastrada) ou por number
  mergedSeasons.sort((a, b) => {
    const posA = serverSeasonMetaMap.get(a.number)?.position ?? a.number;
    const posB = serverSeasonMetaMap.get(b.number)?.position ?? b.number;
    if (posA !== posB) return posA - posB;
    return a.number - b.number;
  });

  return {
    seasons: mergedSeasons,
    totalServerEpisodes: serverEpisodes.length,
    recoveredCount,
    preservedPendingCount,
    preservedConflictCount,
    localOnlyCount,
  };
}
