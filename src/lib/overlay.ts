import { localToAnime, type Anime, type LocalAnime, type SlimAnime, type Season } from "@/lib/types";
import { overlaySlim } from "@/lib/store";

export function overlayList(remote: SlimAnime[], locals: LocalAnime[]): SlimAnime[] {
  return overlaySlim(remote, locals, (l) => localToAnime(l));
}

import { isEpisodePublished } from "@/lib/published-episodes";

function filterPublishedSeasons(seasons: Season[]): Season[] {
  return (seasons || [])
    .map((s) => ({
      ...s,
      episodes: (s.episodes || []).filter(isEpisodePublished),
    }))
    .filter((s) => s.episodes.length > 0);
}

export function mergeDetail(remote: Anime | null, id: string, locals: LocalAnime[]): Anime | null {
  const byId = locals.find((a) => a.id === id);
  if (byId) {
    const local = localToAnime(byId);
    const publishedSeasons = filterPublishedSeasons(local.seasons);
    const resolvedSeasons = publishedSeasons.length
      ? publishedSeasons
      : local.seasons.length
        ? local.seasons
        : (remote?.seasons ?? []);

    if (!remote) {
      return {
        ...local,
        seasons: resolvedSeasons,
      };
    }

    return {
      ...remote,
      ...local,
      titles: local.titles,
      cover: local.cover || remote.cover,
      banner: local.banner || remote.banner,
      synopsis: local.synopsis || remote.synopsis,
      seasons: resolvedSeasons,
      trailerId: local.trailerId || remote.trailerId,
      genres: local.genres.length ? local.genres : remote.genres,
      recommendations: remote.recommendations,
      streamingEpisodes: remote.streamingEpisodes,
      studios: remote.studios,
      source: "local",
    };
  }

  if (!remote) return null;

  const byAni = remote.anilistId
    ? locals.find((a) => a.anilistId === remote.anilistId)
    : undefined;

  if (byAni) {
    const local = localToAnime(byAni);
    const publishedSeasons = filterPublishedSeasons(local.seasons);
    const resolvedSeasons = publishedSeasons.length
      ? publishedSeasons
      : (remote.seasons ?? []);

    return {
      ...remote,
      ...local,
      id: remote.id,
      seasons: resolvedSeasons,
      trailerId: local.trailerId || remote.trailerId,
      recommendations: remote.recommendations,
      streamingEpisodes: remote.streamingEpisodes,
      studios: remote.studios,
    };
  }

  return remote;
}

export function findLocalCover(id: string, locals: LocalAnime[], list: SlimAnime[]): SlimAnime | undefined {
  return (
    list.find((a) => a.id === id) ||
    locals
      .filter((a) => !a.hidden)
      .map(localToAnime)
      .find((a) => a.id === id)
  );
}
