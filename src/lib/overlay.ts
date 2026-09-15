import { localToAnime, type Anime, type LocalAnime, type SlimAnime } from "@/lib/types";
import { overlaySlim } from "@/lib/store";

export function overlayList(remote: SlimAnime[], locals: LocalAnime[]): SlimAnime[] {
  return overlaySlim(remote, locals, (l) => localToAnime(l));
}

export function mergeDetail(remote: Anime | null, id: string, locals: LocalAnime[]): Anime | null {
  const byId = locals.find((a) => a.id === id);
  if (byId) {
    const local = localToAnime(byId);
    if (!remote) return local;
    return {
      ...remote,
      ...local,
      titles: local.titles,
      cover: local.cover || remote.cover,
      banner: local.banner || remote.banner,
      synopsis: local.synopsis || remote.synopsis,
      seasons: local.seasons.length ? local.seasons : remote.seasons,
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
    return {
      ...remote,
      ...local,
      id: remote.id,
      seasons: local.seasons.length ? local.seasons : remote.seasons,
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
