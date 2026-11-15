import {
  animeToLocal,
  isRemoteDefaultCdn,
  localToAnime,
  normalizeImageUrl,
  type Anime,
  type Episode,
  type LocalAnime,
  type SlimAnime,
  type Season,
} from "@/lib/types";
import { overlaySlim, type OverlaySlimOptions } from "@/lib/store";
import { normalizeAnimeSeason, type OfficialAnimeSeason } from "@/lib/utils";
import {
  hasEpisodePlayableSource,
  isEpisodePublished,
  isHikariPlayableUrl,
  sanitizeEpisodeThumbnailUrl,
} from "@/lib/published-episodes";

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

function filterPublishedSeasons(seasons: Season[]): Season[] {
  return (seasons || [])
    .map((s) => ({
      ...s,
      episodes: (s.episodes || []).filter(isEpisodePublished),
    }))
    .filter((s) => s.episodes.length > 0);
}

/**
 * Mescla temporadas locais com as temporadas remotas de forma não destrutiva,
 * garantindo que salvar/publicar 1 episódio nunca apague os outros episódios nem suas thumbnails.
 */
export function mergeSeasonsWithRemote(
  localSeasons: Season[],
  remoteSeasons?: Season[],
): Season[] {
  const safeLocal = Array.isArray(localSeasons) ? localSeasons : [];
  const safeRemote = Array.isArray(remoteSeasons) ? remoteSeasons : [];

  if (safeRemote.length === 0) {
    const publishedSeasons = filterPublishedSeasons(safeLocal);
    return publishedSeasons.length
      ? publishedSeasons
      : safeLocal;
  }

  const localBySeasonNum = new Map<number, Season>();
  for (const s of safeLocal) {
    localBySeasonNum.set(s.number, s);
  }

  const remoteBySeasonNum = new Map<number, Season>();
  for (const s of safeRemote) {
    remoteBySeasonNum.set(s.number, s);
  }

  const allSeasonNumbers = Array.from(
    new Set([
      ...safeLocal.map((s) => s.number),
      ...safeRemote.map((s) => s.number),
    ]),
  ).sort((a, b) => a - b);

  const merged: Season[] = [];

  for (const sNum of allSeasonNumbers) {
    const ls = localBySeasonNum.get(sNum);
    const rs = remoteBySeasonNum.get(sNum);
    const localEps = ls?.episodes ?? [];
    const remoteEps = rs?.episodes ?? [];

    const localByEpNum = new Map<number, Episode>();
    for (const ep of localEps) {
      localByEpNum.set(ep.number, ep);
    }

    const remoteByEpNum = new Map<number, Episode>();
    for (const ep of remoteEps) {
      remoteByEpNum.set(ep.number, ep);
    }

    const allEpNumbers = Array.from(
      new Set([
        ...localEps.map((e) => e.number),
        ...remoteEps.map((e) => e.number),
      ]),
    ).sort((a, b) => a - b);

    const mergedEpisodes: Episode[] = [];
    for (const epNum of allEpNumbers) {
      const lep = localByEpNum.get(epNum);
      const rep = remoteByEpNum.get(epNum);

      if (lep && rep) {
        const cleanLocalThumb = sanitizeEpisodeThumbnailUrl(lep.thumbnail);
        const cleanRemoteThumb = sanitizeEpisodeThumbnailUrl(rep.thumbnail);
        // Se o episódio local já está publicado, respeita sua thumbnail (incluindo limpeza explícita).
        // Se ainda não foi publicado/configurado, preserva a thumbnail remota caso a local esteja vazia.
        const resolvedThumb =
          cleanLocalThumb ??
          (lep.published === true ? undefined : cleanRemoteThumb ?? undefined);

        mergedEpisodes.push({
          ...rep,
          ...lep,
          thumbnail: resolvedThumb,
          title: lep.title?.trim() || rep.title?.trim() || `Episódio ${epNum}`,
          duration: lep.duration?.trim() || rep.duration?.trim() || undefined,
          synopsis: lep.synopsis?.trim() || rep.synopsis?.trim() || undefined,
          aired: lep.aired || rep.aired,
        });
      } else if (lep) {
        mergedEpisodes.push(lep);
      } else if (rep) {
        mergedEpisodes.push(rep);
      }
    }

    const seasonId = ls?.id || rs?.id || `s-${sNum}`;
    const seasonTitle =
      (ls?.title && ls.title !== `Temporada ${sNum}` ? ls.title : rs?.title) ||
      ls?.title ||
      `Temporada ${sNum}`;

    if (mergedEpisodes.length > 0 || safeRemote.length === 0) {
      merged.push({
        id: seasonId,
        number: sNum,
        title: seasonTitle,
        episodes: mergedEpisodes,
      });
    }
  }

  return merged;
}

function sanitizeRemoteEpisodeForAdmin(rep: Episode): Episode {
  const v1 = isHikariPlayableUrl(rep.videoUrl) ? rep.videoUrl?.trim() : undefined;
  const v2 = isHikariPlayableUrl(rep.videoUrl2) ? rep.videoUrl2?.trim() : undefined;
  const v3 = isHikariPlayableUrl(rep.videoUrl3) ? rep.videoUrl3?.trim() : undefined;
  const v4 = isHikariPlayableUrl(rep.videoUrl4) ? rep.videoUrl4?.trim() : undefined;
  const v5 = isHikariPlayableUrl(rep.videoUrl5) ? rep.videoUrl5?.trim() : undefined;
  const hasPlayable = Boolean(v1 || v2 || v3 || v4 || v5);

  return {
    id: rep.id,
    number: rep.number,
    title: rep.title?.trim() || `Episódio ${rep.number}`,
    thumbnail: sanitizeEpisodeThumbnailUrl(rep.thumbnail) ?? undefined,
    duration: rep.duration?.trim() || undefined,
    synopsis: rep.synopsis?.trim() || undefined,
    aired: rep.aired,
    videoUrl: v1,
    videoUrl2: v2,
    videoUrl3: v3,
    videoUrl4: v4,
    videoUrl5: v5,
    published: Boolean(rep.published === true && hasPlayable),
  };
}

/**
 * Mescla temporadas locais com as temporadas remotas para exibição no Painel Administrativo,
 * preservando todos os episódios existentes e suas thumbnails sem auto-publicar episódios remotos.
 */
export function mergeSeasonsWithRemoteForAdmin(
  localSeasons: Season[],
  remoteSeasons?: Season[],
): Season[] {
  const safeLocal = Array.isArray(localSeasons) ? localSeasons : [];
  const safeRemote = Array.isArray(remoteSeasons) ? remoteSeasons : [];

  if (safeRemote.length === 0) {
    return safeLocal;
  }

  const localBySeasonNum = new Map<number, Season>();
  for (const s of safeLocal) {
    localBySeasonNum.set(s.number, s);
  }

  const remoteBySeasonNum = new Map<number, Season>();
  for (const s of safeRemote) {
    remoteBySeasonNum.set(s.number, s);
  }

  const allSeasonNumbers = Array.from(
    new Set([
      ...safeLocal.map((s) => s.number),
      ...safeRemote.map((s) => s.number),
    ]),
  ).sort((a, b) => a - b);

  const merged: Season[] = [];

  for (const sNum of allSeasonNumbers) {
    const ls = localBySeasonNum.get(sNum);
    const rs = remoteBySeasonNum.get(sNum);
    const localEps = ls?.episodes ?? [];
    const remoteEps = rs?.episodes ?? [];

    const localByEpNum = new Map<number, Episode>();
    for (const ep of localEps) {
      localByEpNum.set(ep.number, ep);
    }

    const remoteByEpNum = new Map<number, Episode>();
    for (const ep of remoteEps) {
      remoteByEpNum.set(ep.number, ep);
    }

    const allEpNumbers = Array.from(
      new Set([
        ...localEps.map((e) => e.number),
        ...remoteEps.map((e) => e.number),
      ]),
    ).sort((a, b) => a - b);

    const mergedEpisodes: Episode[] = [];
    for (const epNum of allEpNumbers) {
      const lep = localByEpNum.get(epNum);
      const rep = remoteByEpNum.get(epNum);

      if (lep && rep) {
        const cleanLocalThumb = sanitizeEpisodeThumbnailUrl(lep.thumbnail);
        const cleanRemoteThumb = sanitizeEpisodeThumbnailUrl(rep.thumbnail);
        const isUneditedStub =
          lep.published !== true && !hasEpisodePlayableSource(lep);

        mergedEpisodes.push({
          ...lep,
          thumbnail:
            cleanLocalThumb ??
            (isUneditedStub ? cleanRemoteThumb ?? undefined : undefined),
          title: lep.title?.trim() || rep.title?.trim() || `Episódio ${epNum}`,
          duration: lep.duration?.trim() || rep.duration?.trim() || undefined,
          synopsis: lep.synopsis?.trim() || rep.synopsis?.trim() || undefined,
          aired: lep.aired || rep.aired,
        });
      } else if (lep) {
        mergedEpisodes.push(lep);
      } else if (rep) {
        mergedEpisodes.push(sanitizeRemoteEpisodeForAdmin(rep));
      }
    }

    const seasonId = ls?.id || rs?.id || `s-${sNum}`;
    const seasonTitle =
      (ls?.title && ls.title !== `Temporada ${sNum}` ? ls.title : rs?.title) ||
      ls?.title ||
      `Temporada ${sNum}`;

    merged.push({
      id: seasonId,
      number: sNum,
      title: seasonTitle,
      episodes: mergedEpisodes,
    });
  }

  return merged;
}

export function shouldPreferRemoteMedia(
  localUrl: string | undefined,
  remoteUrl: string | undefined,
  storedMatch: Pick<LocalAnime, "updatedAt" | "syncedAt">,
  remoteCatalogUpdatedAt?: number,
): boolean {
  const cleanRemote = remoteUrl?.trim() || "";
  if (!cleanRemote) return false;
  const cleanLocal = localUrl?.trim() || "";
  if (!cleanLocal) return true;
  if (normalizeImageUrl(cleanLocal) === normalizeImageUrl(cleanRemote)) {
    return false;
  }

  const localUpdatedAt = storedMatch.updatedAt ?? 0;
  const localSyncedAt = storedMatch.syncedAt ?? 0;
  const remoteUpdatedAt = remoteCatalogUpdatedAt ?? 0;

  if (remoteUpdatedAt > 0 && remoteUpdatedAt >= localUpdatedAt) {
    return true;
  }

  const hasUnsyncedLocalEdit =
    localSyncedAt > 0
      ? localUpdatedAt > localSyncedAt
      : !isRemoteDefaultCdn(cleanLocal);

  return !hasUnsyncedLocalEdit;
}

/**
 * Reconcilia o registro local do Admin com os dados canônicos do site público (`remote`),
 * evitando divergência de capa/banner (ex.: Black Clover) e preservando todos os episódios
 * existentes no catálogo remoto (ex.: Bakemonogatari).
 */
export function resolveAdminAnimeWithRemote(
  storedMatch: LocalAnime | undefined,
  remote: Anime | null,
): LocalAnime | null {
  if (!remote) {
    return storedMatch ?? null;
  }

  if (!storedMatch) {
    const base = animeToLocal(remote);
    const mergedSeasons = mergeSeasonsWithRemoteForAdmin([], remote.seasons);
    return {
      ...base,
      id: remote.serverCatalogId || base.id,
      seasons: mergedSeasons.length > 0 ? mergedSeasons : base.seasons,
      updatedAt: remote.catalogUpdatedAt ?? base.updatedAt,
      syncedAt: remote.catalogUpdatedAt ?? undefined,
    };
  }

  const useRemoteCover = shouldPreferRemoteMedia(
    storedMatch.cover,
    remote.cover,
    storedMatch,
    remote.catalogUpdatedAt,
  );
  const useRemoteBanner = shouldPreferRemoteMedia(
    storedMatch.banner,
    remote.banner,
    storedMatch,
    remote.catalogUpdatedAt,
  );
  const remoteIsNewer = Boolean(
    remote.catalogUpdatedAt && remote.catalogUpdatedAt > (storedMatch.updatedAt ?? 0),
  );

  const mergedSeasons = mergeSeasonsWithRemoteForAdmin(
    storedMatch.seasons,
    remote.seasons,
  );

  return {
    ...storedMatch,
    anilistId: storedMatch.anilistId ?? remote.anilistId,
    malId: storedMatch.malId ?? remote.malId,
    kitsuId: storedMatch.kitsuId ?? remote.kitsuId,
    titleRomaji:
      (remoteIsNewer ? remote.titles.romaji : storedMatch.titleRomaji) ||
      remote.titles.romaji,
    titleEnglish:
      (remoteIsNewer ? remote.titles.english : storedMatch.titleEnglish) ||
      remote.titles.english,
    titleNative:
      (remoteIsNewer ? remote.titles.native : storedMatch.titleNative) ||
      remote.titles.native,
    cover: useRemoteCover ? remote.cover : storedMatch.cover,
    banner: useRemoteBanner ? remote.banner : storedMatch.banner,
    synopsis:
      (remoteIsNewer ? remote.synopsis : storedMatch.synopsis) || remote.synopsis,
    genres:
      remoteIsNewer && remote.genres?.length
        ? remote.genres
        : storedMatch.genres.length
          ? storedMatch.genres
          : remote.genres,
    format: (remoteIsNewer ? remote.format : storedMatch.format) || remote.format,
    status: (remoteIsNewer ? remote.status : storedMatch.status) || remote.status,
    episodesCount: storedMatch.episodesCount ?? remote.episodesCount,
    season: storedMatch.season ?? remote.season,
    year: storedMatch.year ?? remote.year,
    trailerId: storedMatch.trailerId ?? remote.trailerId,
    seasons: mergedSeasons.length > 0 ? mergedSeasons : storedMatch.seasons,
    updatedAt:
      remoteIsNewer && remote.catalogUpdatedAt
        ? remote.catalogUpdatedAt
        : storedMatch.updatedAt,
    syncedAt:
      remoteIsNewer && remote.catalogUpdatedAt
        ? remote.catalogUpdatedAt
        : storedMatch.syncedAt,
  };
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
    const resolvedSeasons = mergeSeasonsWithRemote(local.seasons, remote?.seasons);

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
    const resolvedSeasons = mergeSeasonsWithRemote(local.seasons, remote.seasons);

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
