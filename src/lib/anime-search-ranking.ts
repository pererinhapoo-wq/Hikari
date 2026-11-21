import type { SlimAnime } from "@/lib/types";

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + cost,
      );

      diagonal = above;
    }
  }

  return previous[b.length];
}

export const CURATED_ALIASES: Record<string, string[]> = {
  bnha: ["boku no hero academia", "my hero academia"],
  op: ["one piece"],
  onepiece: ["one piece"],
  onepice: ["one piece"],
  snk: ["shingeki no kyojin", "attack on titan"],
  aot: ["shingeki no kyojin", "attack on titan"],
  jjk: ["jujutsu kaisen"],
  kimetsu: ["kimetsu no yaiba", "demon slayer"],
  narto: ["naruto"],
};

function getNormalizedTitles(anime: SlimAnime): string[] {
  return [
    anime.titles?.romaji,
    anime.titles?.english,
    anime.titles?.native,
  ]
    .filter((t): t is string => Boolean(t && t.trim()))
    .map(normalizeSearchText)
    .filter(Boolean);
}

export function searchScore(anime: SlimAnime, query: string): number {
  const q = normalizeSearchText(query);
  if (!q) return 0;

  const titles = getNormalizedTitles(anime);
  if (titles.length === 0) return 0;

  const compactQuery = q.replace(/\s/g, "");
  const queryWords = q.split(" ").filter(Boolean);
  const aliasTargets = CURATED_ALIASES[compactQuery] || [];
  let score = 0;

  for (const title of titles) {
    const compactTitle = title.replace(/\s/g, "");
    const titleWords = title.split(" ").filter(Boolean);

    if (aliasTargets.length > 0) {
      if (aliasTargets.some((target) => title === target)) {
        score = Math.max(score, 9500);
      } else if (aliasTargets.some((target) => title.startsWith(target))) {
        score = Math.max(score, 9000);
      } else if (
        aliasTargets.some(
          (target) => title.includes(target) || target.includes(title),
        )
      ) {
        score = Math.max(score, 8600);
      }
    }

    if (title === q || compactTitle === compactQuery) {
      score = Math.max(score, 10000);
      continue;
    }

    if (titleWords[0] === q) {
      score = Math.max(score, 8500);
    }

    if (title.startsWith(q) || compactTitle.startsWith(compactQuery)) {
      score = Math.max(score, 8000);
    }

    if (titleWords.some((word) => word === q)) {
      score = Math.max(score, 6500);
    }

    if (titleWords.some((word) => word.startsWith(q))) {
      score = Math.max(score, 6000);
    }

    if (queryWords.length > 1) {
      const allWordPrefixes = queryWords.every((qw) =>
        titleWords.some((tw) => tw.startsWith(qw)),
      );
      if (allWordPrefixes) {
        score = Math.max(score, 5400);
      } else {
        const allWordsMatch = queryWords.every((qw) =>
          titleWords.some((tw) => tw.startsWith(qw) || tw.includes(qw)),
        );
        if (allWordsMatch) {
          score = Math.max(score, 5000);
        }
      }
    }

    if (title.includes(q) || compactTitle.includes(compactQuery)) {
      score = Math.max(score, 3500);
    }

    if (compactQuery.length >= 3) {
      const closeWord = titleWords.some((titleWord) => {
        if (Math.abs(titleWord.length - compactQuery.length) > 3) {
          return false;
        }
        const sample = titleWord.slice(0, compactQuery.length);
        const distance = searchDistance(compactQuery, sample);
        return distance <= (compactQuery.length >= 6 ? 2 : 1);
      });

      if (closeWord) {
        score = Math.max(score, 2000);
      }
    }
  }

  return score;
}

function getShortestTitleLength(anime: SlimAnime): number {
  const titles = getNormalizedTitles(anime);
  if (titles.length === 0) return 9999;
  return Math.min(...titles.map((t) => t.length));
}

function normalizeComparableScore(score: number | null | undefined): number {
  if (typeof score !== "number" || !Number.isFinite(score) || score <= 0) {
    return -1;
  }
  return score <= 10 ? score * 10 : score;
}

export const HOME_MIN_TITLES_WITH_EPISODES = 12;

export function sortByHasEpisodeFirst<T extends { hasEpisode?: boolean }>(
  items: T[],
): T[] {
  if (!Array.isArray(items) || items.length <= 1) {
    return items;
  }
  const withEpisode: T[] = [];
  const withoutEpisode: T[] = [];
  for (const item of items) {
    if (item.hasEpisode === true) {
      withEpisode.push(item);
    } else {
      withoutEpisode.push(item);
    }
  }
  return [...withEpisode, ...withoutEpisode];
}

export function countDistinctTitlesWithEpisode(
  lists: ReadonlyArray<ReadonlyArray<{ id: string; hasEpisode?: boolean }>>,
): number {
  const seen = new Set<string>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item && item.hasEpisode === true && !seen.has(item.id)) {
        seen.add(item.id);
      }
    }
  }
  return seen.size;
}

export function selectHomeSectionItems<T extends { hasEpisode?: boolean }>(
  items: T[],
  totalHomeWithEpisodes?: number,
): T[] {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }
  const withEpisode = items.filter((item) => item.hasEpisode === true);
  const effectiveWithEpCount =
    typeof totalHomeWithEpisodes === "number"
      ? totalHomeWithEpisodes
      : withEpisode.length;

  if (
    effectiveWithEpCount >= HOME_MIN_TITLES_WITH_EPISODES ||
    withEpisode.length >= HOME_MIN_TITLES_WITH_EPISODES
  ) {
    return withEpisode;
  }

  const withoutEpisode = items.filter((item) => item.hasEpisode !== true);
  const needed = HOME_MIN_TITLES_WITH_EPISODES - withEpisode.length;
  return [...withEpisode, ...withoutEpisode.slice(0, needed)];
}

export function rankSearchResults(
  items: SlimAnime[],
  query?: string,
): SlimAnime[] {
  if (!query?.trim()) {
    return sortByHasEpisodeFirst(items);
  }

  const normalizedQuery = query.trim();

  return sortByHasEpisodeFirst(
    [...items]
      .map((anime, index) => ({
        anime,
        relevance: searchScore(anime, normalizedQuery),
        popularity:
          typeof anime.popularity === "number" && Number.isFinite(anime.popularity)
            ? anime.popularity
            : -1,
        rating: normalizeComparableScore(anime.score),
        minTitleLen: getShortestTitleLength(anime),
        index,
      }))
      .sort(
        (a, b) =>
          b.relevance - a.relevance ||
          b.popularity - a.popularity ||
          b.rating - a.rating ||
          a.minTitleLen - b.minTitleLen ||
          a.index - b.index,
      )
      .map((item) => item.anime),
  );
}

export function sortSearchResultsByOption(
  items: SlimAnime[],
  sort?: string,
): SlimAnime[] {
  if (sort === "POPULARITY_DESC") {
    return sortByHasEpisodeFirst(
      [...items].sort(
        (a, b) => (b.popularity ?? -1) - (a.popularity ?? -1),
      ),
    );
  }
  if (sort === "SCORE_DESC") {
    return sortByHasEpisodeFirst(
      [...items].sort(
        (a, b) =>
          normalizeComparableScore(b.score) - normalizeComparableScore(a.score),
      ),
    );
  }
  if (sort === "START_DATE_DESC") {
    return sortByHasEpisodeFirst(
      [...items].sort((a, b) => (b.year ?? -1) - (a.year ?? -1)),
    );
  }
  if (sort === "TITLE_ROMAJI") {
    return sortByHasEpisodeFirst(
      [...items].sort((a, b) =>
        (a.titles.romaji || a.titles.english).localeCompare(
          b.titles.romaji || b.titles.english,
        ),
      ),
    );
  }
  return sortByHasEpisodeFirst(items);
}

export function getCanonicalAnimeSearchKeys(anime: SlimAnime): string[] {
  const keys: string[] = [];
  if (anime.anilistId) keys.push(`ani-${anime.anilistId}`);
  if (anime.malId) keys.push(`mal-${anime.malId}`);
  if (anime.kitsuId) keys.push(`kitsu-${anime.kitsuId}`);
  if (anime.id) keys.push(`id-${anime.id}`);
  return keys;
}

/**
 * Combina resultados remotos (já com overlay de metadados) e eventuais acertos locais
 * sem duplicar e sem dar prioridade artificial a títulos editados manualmente.
 */
export function mergeLocalAndRemoteSearchResults(
  remote: SlimAnime[],
  localHits: SlimAnime[],
  query?: string,
  sort?: string,
): SlimAnime[] {
  const seenKeys = new Set<string>();
  const combined: SlimAnime[] = [];

  // Processa primeiro os resultados remotos (que já carregam popularity/score/overlay)
  // para garantir que hits locais equivalentes não substituam métricas de popularidade
  // nem sejam promovidos artificialmente à frente dos resultados do catálogo.
  for (const anime of [...remote, ...localHits]) {
    const keys = getCanonicalAnimeSearchKeys(anime);
    if (keys.some((k) => seenKeys.has(k))) {
      continue;
    }
    for (const k of keys) {
      seenKeys.add(k);
    }
    combined.push(anime);
  }

  if (!sort || sort === "SEARCH_MATCH") {
    return query?.trim()
      ? rankSearchResults(combined, query)
      : sortByHasEpisodeFirst(combined);
  }

  return sortSearchResultsByOption(combined, sort);
}

