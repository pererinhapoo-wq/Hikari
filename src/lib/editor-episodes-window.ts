import type { OutboxOperation } from "@/lib/episode-writer";
import { hasEpisodePlayableSource } from "@/lib/published-episodes";
import type { Episode, Season } from "@/lib/types";

export const EPISODES_PER_PAGE = 25;
export const INITIAL_COLLAPSE_EPISODE_THRESHOLD = 25;

export interface OutboxIndex {
  byEpisodeId: Map<string, OutboxOperation>;
  bySlotKey: Map<string, OutboxOperation>;
}

export function buildOutboxSlotKey(
  seasonNumber: number,
  episodeNumber: number,
): string {
  return `${seasonNumber}:${episodeNumber}`;
}

/**
 * Indexa operações pendentes/conflitantes do Outbox para consulta O(1) por
 * episodeId (incluindo ID canônico no payload) ou por slot (temporada + número).
 */
export function buildOutboxIndex(
  outboxOps: OutboxOperation[],
  animeId: string,
): OutboxIndex {
  const byEpisodeId = new Map<string, OutboxOperation>();
  const bySlotKey = new Map<string, OutboxOperation>();

  if (!animeId || outboxOps.length === 0) {
    return { byEpisodeId, bySlotKey };
  }

  for (const op of outboxOps) {
    if (op.animeId !== animeId) continue;
    if (op.episodeId) {
      byEpisodeId.set(op.episodeId, op);
    }
    const payloadId = op.payload?.id;
    if (payloadId && payloadId !== op.episodeId && !byEpisodeId.has(payloadId)) {
      byEpisodeId.set(payloadId, op);
    }
    const epNum = op.episodeNumber ?? op.payload?.number;
    if (
      op.type === "upsert" &&
      typeof op.seasonNumber === "number" &&
      typeof epNum === "number"
    ) {
      const slotKey = buildOutboxSlotKey(op.seasonNumber, epNum);
      if (!bySlotKey.has(slotKey)) {
        bySlotKey.set(slotKey, op);
      }
    }
  }

  return { byEpisodeId, bySlotKey };
}

export function getOutboxOpForEpisode(
  index: OutboxIndex,
  episodeId: string,
  seasonNumber?: number,
  episodeNumber?: number,
): OutboxOperation | undefined {
  const byId = index.byEpisodeId.get(episodeId);
  if (byId) return byId;
  if (
    typeof seasonNumber === "number" &&
    typeof episodeNumber === "number" &&
    Number.isFinite(episodeNumber)
  ) {
    return index.bySlotKey.get(buildOutboxSlotKey(seasonNumber, episodeNumber));
  }
  return undefined;
}

export function filterSeasonEpisodes(
  episodes: Episode[],
  query: string,
): Episode[] {
  const trimmed = query.trim();
  if (!trimmed) return episodes;

  const normalized = trimmed.toLowerCase();
  const explicitNumMatch = trimmed.match(/^#?\s*(\d+)$/);
  if (explicitNumMatch) {
    const target = explicitNumMatch[1];
    const exactNum = Number(target);
    const exactMatches: Episode[] = [];
    const partialMatches: Episode[] = [];
    for (const ep of episodes) {
      if (ep.number === exactNum) {
        exactMatches.push(ep);
      } else if (
        String(ep.number).includes(target) ||
        (ep.title ?? "").toLowerCase().includes(normalized)
      ) {
        partialMatches.push(ep);
      }
    }
    return exactMatches.length > 0
      ? [...exactMatches, ...partialMatches]
      : partialMatches;
  }

  return episodes.filter(
    (ep) =>
      String(ep.number).includes(normalized) ||
      (ep.title ?? "").toLowerCase().includes(normalized),
  );
}

export interface PaginatedEpisodesResult {
  items: Episode[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startItem: number;
  endItem: number;
}

export function paginateEpisodes(
  episodes: Episode[],
  requestedPage: number,
  pageSize = EPISODES_PER_PAGE,
): PaginatedEpisodesResult {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalItems = episodes.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = Math.min(
    totalPages,
    Math.max(1, Math.floor(requestedPage) || 1),
  );

  if (totalItems === 0) {
    return {
      items: [],
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      startItem: 0,
      endItem: 0,
    };
  }

  const startIndex = (currentPage - 1) * safePageSize;
  const endIndex = Math.min(totalItems, startIndex + safePageSize);

  return {
    items: episodes.slice(startIndex, endIndex),
    currentPage,
    totalPages,
    totalItems,
    startItem: startIndex + 1,
    endItem: endIndex,
  };
}

export function getCompactPageNumbers(
  currentPage: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    pages.push("ellipsis");
  }
  for (let p = windowStart; p <= windowEnd; p += 1) {
    pages.push(p);
  }
  if (windowEnd < totalPages - 1) {
    pages.push("ellipsis");
  }
  pages.push(totalPages);

  return pages;
}

/**
 * Em animes multi-temporada com volume expressivo de episódios, inicia apenas
 * a primeira temporada expandida e as demais recolhidas para reduzir o custo
 * inicial de montagem sem ocultar a navegação.
 */
export function buildInitialCollapsedSeasons(
  seasons: Season[],
  episodeThreshold = INITIAL_COLLAPSE_EPISODE_THRESHOLD,
): Record<string, boolean> {
  if (seasons.length <= 1) {
    return {};
  }

  let totalEpisodes = 0;
  for (const s of seasons) {
    totalEpisodes += s.episodes.length;
  }

  if (totalEpisodes <= episodeThreshold) {
    return {};
  }

  const collapsed: Record<string, boolean> = {};
  for (let i = 1; i < seasons.length; i += 1) {
    collapsed[seasons[i].id] = true;
  }
  return collapsed;
}

export interface BulkPublishSeasonEpisodesResult {
  seasons: Season[];
  changedEpisodeIds: string[];
  eligibleCount: number;
  alreadyPublishedCount: number;
  emptyOrInvalidCount: number;
  changed: boolean;
}

/**
 * Altera de forma imutável o status de todos os episódios preenchidos e com fonte/ID
 * válido da temporada informada para `published: true`.
 * - Não modifica episódios vazios ou sem fonte/ID válido.
 * - Não modifica episódios de outras temporadas.
 * - Mantém todos os demais campos dos episódios exatamente iguais.
 */
export function publishFilledEpisodesInSeason(
  seasons: Season[],
  targetSeasonId: string,
): BulkPublishSeasonEpisodesResult {
  const targetSeasonIdx = seasons.findIndex((s) => s.id === targetSeasonId);
  if (targetSeasonIdx === -1) {
    return {
      seasons,
      changedEpisodeIds: [],
      eligibleCount: 0,
      alreadyPublishedCount: 0,
      emptyOrInvalidCount: 0,
      changed: false,
    };
  }

  const targetSeason = seasons[targetSeasonIdx];
  const changedEpisodeIds: string[] = [];
  let eligibleCount = 0;
  let alreadyPublishedCount = 0;
  let emptyOrInvalidCount = 0;

  const nextEpisodes = targetSeason.episodes.map((ep) => {
    if (!hasEpisodePlayableSource(ep)) {
      emptyOrInvalidCount += 1;
      return ep;
    }

    eligibleCount += 1;
    if (ep.published === true) {
      alreadyPublishedCount += 1;
      return ep;
    }

    changedEpisodeIds.push(ep.id);
    return {
      ...ep,
      published: true,
    };
  });

  if (changedEpisodeIds.length === 0) {
    return {
      seasons,
      changedEpisodeIds: [],
      eligibleCount,
      alreadyPublishedCount,
      emptyOrInvalidCount,
      changed: false,
    };
  }

  const nextSeasons = seasons.slice();
  nextSeasons[targetSeasonIdx] = {
    ...targetSeason,
    episodes: nextEpisodes,
  };

  return {
    seasons: nextSeasons,
    changedEpisodeIds,
    eligibleCount,
    alreadyPublishedCount,
    emptyOrInvalidCount,
    changed: true,
  };
}
