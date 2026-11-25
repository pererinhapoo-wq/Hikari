import type { SlimAnime } from "@/lib/types";

const MAX_HERO_FALLBACK_ITEMS = 8;

function hasDistinctHeroBanner(anime: SlimAnime): boolean {
  const banner = anime.banner?.trim();
  const cover = anime.cover?.trim();
  return Boolean(banner && cover && banner !== cover);
}

/**
 * Seleciona candidatos de fallback para o Hero quando o pool dinâmico do servidor
 * está indisponível ou vazio, evitando colapsar para um único anime quando há outros
 * candidatos válidos no catálogo da Home.
 */
export function pickHeroItems(
  trending: SlimAnime[],
  popular: SlimAnime[],
  fallbackCatalog: SlimAnime[] = [],
): SlimAnime[] {
  const seen = new Set<string>();
  const catalog: SlimAnime[] = [];

  for (const item of [...trending, ...popular, ...fallbackCatalog]) {
    if (!item || !item.id || seen.has(item.id)) continue;
    const hasVisual = Boolean(item.banner?.trim() || item.cover?.trim());
    if (!hasVisual) continue;
    seen.add(item.id);
    catalog.push(item);
  }

  if (catalog.length === 0) {
    return [];
  }

  const withEpisode = catalog.filter((item) => item.hasEpisode === true);
  const withEpisodeDistinct = withEpisode.filter(hasDistinctHeroBanner);
  const withEpisodeCoverOnly = withEpisode.filter((item) => !hasDistinctHeroBanner(item));
  const orderedWithEpisode = [...withEpisodeDistinct, ...withEpisodeCoverOnly];

  if (orderedWithEpisode.length >= 2) {
    return orderedWithEpisode.slice(0, MAX_HERO_FALLBACK_ITEMS);
  }

  const withoutEpisode = catalog.filter((item) => item.hasEpisode !== true);
  const withoutEpisodeToday = withoutEpisode.filter((item) => Boolean(item.todayEpisode));
  const withoutEpisodeTodayDistinct = withoutEpisodeToday.filter(hasDistinctHeroBanner);
  const withoutEpisodeTodayCoverOnly = withoutEpisodeToday.filter(
    (item) => !hasDistinctHeroBanner(item),
  );
  const withoutEpisodeOther = withoutEpisode.filter((item) => !item.todayEpisode);
  const withoutEpisodeOtherDistinct = withoutEpisodeOther.filter(hasDistinctHeroBanner);
  const withoutEpisodeOtherCoverOnly = withoutEpisodeOther.filter(
    (item) => !hasDistinctHeroBanner(item),
  );

  return [
    ...orderedWithEpisode,
    ...withoutEpisodeTodayDistinct,
    ...withoutEpisodeTodayCoverOnly,
    ...withoutEpisodeOtherDistinct,
    ...withoutEpisodeOtherCoverOnly,
  ].slice(0, MAX_HERO_FALLBACK_ITEMS);
}
