import { localToAnime, type Anime, type LocalAnime, type SlimAnime, type Season } from "@/lib/types";
import { overlaySlim, type OverlaySlimOptions } from "@/lib/store";
import { normalizeAnimeSeason, type OfficialAnimeSeason } from "@/lib/utils";

export function overlayList(
  remote: SlimAnime[],
  locals: LocalAnime[],
  options?: OverlaySlimOptions<SlimAnime>,
): SlimAnime[] {
  return overlaySlim(remote, locals, (l) => localToAnime(l), options);
}

export function doesLocalAnimeMatchSeason(
  local: LocalAnime,
  targetSeason: OfficialAnimeSeason,
  targetYear: number,
  options?: { allowRemoteLinked?: boolean },
): boolean {
  const isRemoteLinked = Boolean(local.anilistId || local.malId || local.kitsuId);
  if (isRemoteLinked && !options?.allowRemoteLinked) {
    return false;
  }

  const normalizedSeason = normalizeAnimeSeason(local.season);
  if (!normalizedSeason || normalizedSeason !== targetSeason) {
    return false;
  }

  if (
    typeof local.year !== "number" ||
    !Number.isInteger(local.year) ||
    local.year !== targetYear
  ) {
    return false;
  }

  return true;
}

export function overlaySeasonList(
  remote: SlimAnime[],
  locals: LocalAnime[],
  targetSeason: OfficialAnimeSeason,
  targetYear: number,
): SlimAnime[] {
  return overlaySlim(remote, locals, (l) => localToAnime(l), {
    includeExtras: (local) =>
      doesLocalAnimeMatchSeason(local, targetSeason, targetYear, {
        allowRemoteLinked: remote.length === 0,
      }),
    mapMatched: (mappedItem, remoteItem) => ({
      ...mappedItem,
      season: mappedItem.season || remoteItem.season,
      year: mappedItem.year ?? remoteItem.year,
    }),
  });
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
  const numericId = Number(id);
  const isDubbedTitle = (a: LocalAnime) =>
    /\b(dub|dublado|dublada)\b/i.test(`${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`);

  // 1. Direct exact match by local ID takes priority (e.g. /anime/local-xxx)
  let byId = locals.find((a) => a.id === id);

  // 2. If id is numeric and not exact match, search by AniList/MAL ID preferring the original/subbed version
  if (!byId && !isNaN(numericId) && numericId > 0) {
    byId =
      locals.find(
        (a) =>
          (a.anilistId === numericId || a.malId === numericId) &&
          !isDubbedTitle(a),
      ) ||
      locals.find(
        (a) => a.anilistId === numericId || a.malId === numericId,
      );
  }
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
        studios: local.studios ?? [],
        characters: local.characters ?? [],
        staff: local.staff ?? [],
      };
    }

    const mergedCharacters =
      local.characters && local.characters.length > 0
        ? local.characters
        : (remote.characters ?? []);

    const mergedStaff =
      local.staff && local.staff.length > 0
        ? local.staff
        : (remote.staff ?? []);

    const mergedStudios =
      local.studios && local.studios.length > 0
        ? local.studios
        : (remote.studios ?? []);

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
      studios: mergedStudios,
      characters: mergedCharacters,
      staff: mergedStaff,
      source: "local",
    };
  }

  if (!remote) return null;

  const byAni = remote.anilistId
    ? locals.find((a) => a.anilistId === remote.anilistId && !isDubbedTitle(a)) ||
      locals.find((a) => a.anilistId === remote.anilistId)
    : undefined;

  if (byAni) {
    const local = localToAnime(byAni);
    const publishedSeasons = filterPublishedSeasons(local.seasons);
    const resolvedSeasons = publishedSeasons.length
      ? publishedSeasons
      : local.seasons.length
        ? local.seasons
        : (remote.seasons ?? []);

    const mergedCharacters =
      local.characters && local.characters.length > 0
        ? local.characters
        : (remote.characters ?? []);

    const mergedStaff =
      local.staff && local.staff.length > 0
        ? local.staff
        : (remote.staff ?? []);

    const mergedStudios =
      local.studios && local.studios.length > 0
        ? local.studios
        : (remote.studios ?? []);

    return {
      ...remote,
      ...local,
      id: remote.id,
      cover: local.cover || remote.cover,
      banner: local.banner || remote.banner,
      seasons: resolvedSeasons,
      trailerId: local.trailerId || remote.trailerId,
      recommendations: remote.recommendations,
      streamingEpisodes: remote.streamingEpisodes,
      studios: mergedStudios,
      characters: mergedCharacters,
      staff: mergedStaff,
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
