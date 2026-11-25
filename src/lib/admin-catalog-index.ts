import { displayTitle, type LocalAnime } from "@/lib/types";
import { hasEpisodePlayableSource } from "@/lib/published-episodes";

export type CatalogSortOption =
  | "updated-desc"
  | "updated-asc"
  | "title-asc"
  | "title-desc"
  | "episodes-desc"
  | "episodes-asc"
  | "year-desc"
  | "year-asc";

export type CatalogVisibilityFilter = "all" | "visible" | "hidden";
export type CatalogVersionFilter = "all" | "dubbed" | "subbed" | "anilist";

export interface PrecomputedAnimeMeta {
  title: string;
  searchText: string;
  isDub: boolean;
  seasonsCount: number;
  episodesCount: number;
  publishedEpisodesCount: number;
  sortTimestamp: number;
  formatLower: string;
  statusLower: string;
  year: number;
}

export interface AdminCatalogStats {
  totalAnimes: number;
  totalSeasons: number;
  totalEpisodes: number;
  totalPublishedEpisodes: number;
  visibleAnimes: number;
  hiddenAnimes: number;
  anilistLinkedAnimes: number;
  dubbedAnimes: number;
}

export interface AdminCatalogIndex {
  byId: Map<string, LocalAnime>;
  anilistIdSet: Set<number>;
  metaById: Map<string, PrecomputedAnimeMeta>;
  stats: AdminCatalogStats;
  availableFormats: string[];
  availableStatuses: string[];
  topRecentAnimes: LocalAnime[];
}

const DUB_TITLE_REGEX = /\b(dub|dublado|dublada)\b/i;

/**
 * Pré-computa contagens, metadados de busca, flags de dublagem, formatos/status únicos
 * e os 6 animes mais recentes em uma única passagem O(N + E), evitando `.reduce()`,
 * `.sort()` completo e regex repetidas durante filtragem, ordenação e renderização.
 */
export function buildAdminCatalogIndex(animes: LocalAnime[]): AdminCatalogIndex {
  const byId = new Map<string, LocalAnime>();
  const anilistIdSet = new Set<number>();
  const metaById = new Map<string, PrecomputedAnimeMeta>();
  const formatSet = new Set<string>();
  const statusSet = new Set<string>();

  let totalSeasons = 0;
  let totalEpisodes = 0;
  let totalPublishedEpisodes = 0;
  let visibleAnimes = 0;
  let hiddenAnimes = 0;
  let anilistLinkedAnimes = 0;
  let dubbedAnimes = 0;

  // Mantém top 6 por sortTimestamp sem ordenar o array inteiro
  const topRecent: Array<{ anime: LocalAnime; ts: number }> = [];

  for (const a of animes) {
    byId.set(a.id, a);

    if (a.hidden) hiddenAnimes++;
    else visibleAnimes++;

    if (a.anilistId) {
      anilistLinkedAnimes++;
      anilistIdSet.add(a.anilistId);
    }

    const combinedTitles = `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`;
    const isDub = DUB_TITLE_REGEX.test(combinedTitles);
    if (isDub) dubbedAnimes++;

    const formatTrimmed = a.format?.trim();
    if (formatTrimmed) formatSet.add(formatTrimmed);

    const statusTrimmed = a.status?.trim();
    if (statusTrimmed) statusSet.add(statusTrimmed);

    const seasons = a.seasons || [];
    const seasonsCount = seasons.length;
    totalSeasons += seasonsCount;

    let animeEpisodesCount = 0;
    let animePublishedEpisodesCount = 0;

    for (const s of seasons) {
      const episodes = s.episodes || [];
      animeEpisodesCount += episodes.length;

      for (const ep of episodes) {
        if (ep.published === true && hasEpisodePlayableSource(ep)) {
          animePublishedEpisodesCount++;
        }
      }
    }

    totalEpisodes += animeEpisodesCount;
    totalPublishedEpisodes += animePublishedEpisodesCount;

    const sortTimestamp = a.updatedAt || a.createdAt || 0;
    if ((a.updatedAt && a.updatedAt > 0) || (a.createdAt && a.createdAt > 0)) {
      if (topRecent.length < 6 || sortTimestamp > topRecent[topRecent.length - 1].ts) {
        let insertIdx = topRecent.length;
        for (let i = 0; i < topRecent.length; i++) {
          if (sortTimestamp > topRecent[i].ts) {
            insertIdx = i;
            break;
          }
        }
        topRecent.splice(insertIdx, 0, { anime: a, ts: sortTimestamp });
        if (topRecent.length > 6) {
          topRecent.pop();
        }
      }
    }

    metaById.set(a.id, {
      title: displayTitle(a),
      searchText: `${combinedTitles} ${a.id}`.toLowerCase(),
      isDub,
      seasonsCount,
      episodesCount: animeEpisodesCount,
      publishedEpisodesCount: animePublishedEpisodesCount,
      sortTimestamp,
      formatLower: a.format?.toLowerCase() ?? "",
      statusLower: a.status?.toLowerCase() ?? "",
      year: a.year || 0,
    });
  }

  return {
    byId,
    anilistIdSet,
    metaById,
    stats: {
      totalAnimes: animes.length,
      totalSeasons,
      totalEpisodes,
      totalPublishedEpisodes,
      visibleAnimes,
      hiddenAnimes,
      anilistLinkedAnimes,
      dubbedAnimes,
    },
    availableFormats: Array.from(formatSet).sort(),
    availableStatuses: Array.from(statusSet).sort(),
    topRecentAnimes: topRecent.map((item) => item.anime),
  };
}

export function filterAndSortAdminCatalog(
  animes: LocalAnime[],
  metaById: Map<string, PrecomputedAnimeMeta>,
  params: {
    q: string;
    visibilityFilter: CatalogVisibilityFilter;
    formatFilter: string;
    statusFilter: string;
    versionFilter: CatalogVersionFilter;
    sortBy: CatalogSortOption;
  },
): LocalAnime[] {
  const query = params.q.trim().toLowerCase();
  const formatLowerFilter =
    params.formatFilter !== "all" ? params.formatFilter.toLowerCase() : "";
  const statusLowerFilter =
    params.statusFilter !== "all" ? params.statusFilter.toLowerCase() : "";

  const filtered = animes.filter((a) => {
    const meta = metaById.get(a.id);

    if (query) {
      const searchText =
        meta?.searchText ??
        `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative} ${a.id}`.toLowerCase();
      if (!searchText.includes(query)) return false;
    }

    if (params.visibilityFilter === "visible" && a.hidden) return false;
    if (params.visibilityFilter === "hidden" && !a.hidden) return false;

    if (formatLowerFilter && (meta?.formatLower ?? a.format?.toLowerCase() ?? "") !== formatLowerFilter) {
      return false;
    }

    if (statusLowerFilter && (meta?.statusLower ?? a.status?.toLowerCase() ?? "") !== statusLowerFilter) {
      return false;
    }

    if (params.versionFilter === "dubbed") {
      if (!(meta?.isDub ?? false)) return false;
    } else if (params.versionFilter === "subbed") {
      if (meta?.isDub ?? false) return false;
    } else if (params.versionFilter === "anilist") {
      if (!a.anilistId) return false;
    }

    return true;
  });

  return filtered.sort((a, b) => {
    const metaA = metaById.get(a.id);
    const metaB = metaById.get(b.id);

    switch (params.sortBy) {
      case "title-asc":
        return (metaA?.title ?? displayTitle(a)).localeCompare(
          metaB?.title ?? displayTitle(b),
        );
      case "title-desc":
        return (metaB?.title ?? displayTitle(b)).localeCompare(
          metaA?.title ?? displayTitle(a),
        );
      case "episodes-desc":
        return (metaB?.episodesCount ?? 0) - (metaA?.episodesCount ?? 0);
      case "episodes-asc":
        return (metaA?.episodesCount ?? 0) - (metaB?.episodesCount ?? 0);
      case "year-desc":
        return (metaB?.year ?? b.year ?? 0) - (metaA?.year ?? a.year ?? 0);
      case "year-asc":
        return (metaA?.year ?? a.year ?? 0) - (metaB?.year ?? b.year ?? 0);
      case "updated-asc":
        return (metaA?.sortTimestamp ?? 0) - (metaB?.sortTimestamp ?? 0);
      case "updated-desc":
      default:
        return (metaB?.sortTimestamp ?? 0) - (metaA?.sortTimestamp ?? 0);
    }
  });
}
