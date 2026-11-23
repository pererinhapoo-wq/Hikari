import {
  animeToLocal,
  isKitsuImageUrl,
  isRemoteDefaultCdn,
  localToAnime,
  normalizeAnimeRecentBadges,
  normalizeImageUrl,
  type Anime,
  type AnimeRecentBadges,
  type Episode,
  type LocalAnime,
  type ResolvedMobileBannerInfo,
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
import { normalizeHikariPlayerEpisodeId } from "@/lib/hikari-player";

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
          videoUrl: lep.videoUrl,
          videoUrl2: lep.videoUrl2,
          videoUrl3: lep.videoUrl3,
          videoUrl4: lep.videoUrl4,
          videoUrl5: lep.videoUrl5,
          hikariPlayerEpisodeId:
            normalizeHikariPlayerEpisodeId(lep.hikariPlayerEpisodeId) ??
            normalizeHikariPlayerEpisodeId(rep.hikariPlayerEpisodeId) ??
            undefined,
          ...(lep.openingStartSeconds !== undefined || rep.openingStartSeconds !== undefined
            ? {
                openingStartSeconds:
                  lep.openingStartSeconds !== undefined
                    ? lep.openingStartSeconds
                    : rep.openingStartSeconds,
              }
            : {}),
          ...(lep.openingEndSeconds !== undefined || rep.openingEndSeconds !== undefined
            ? {
                openingEndSeconds:
                  lep.openingEndSeconds !== undefined
                    ? lep.openingEndSeconds
                    : rep.openingEndSeconds,
              }
            : {}),
          ...(lep.recentBadges !== undefined || rep.recentBadges !== undefined
            ? {
                recentBadges: normalizeAnimeRecentBadges(
                  lep.recentBadges !== undefined ? lep.recentBadges : rep.recentBadges,
                ),
              }
            : {}),
        });
      } else if (lep) {
        mergedEpisodes.push(lep);
      } else if (rep) {
        mergedEpisodes.push({
          ...rep,
          videoUrl: isHikariPlayableUrl(rep.videoUrl) ? rep.videoUrl?.trim() : undefined,
          videoUrl2: isHikariPlayableUrl(rep.videoUrl2) ? rep.videoUrl2?.trim() : undefined,
          videoUrl3: isHikariPlayableUrl(rep.videoUrl3) ? rep.videoUrl3?.trim() : undefined,
          videoUrl4: isHikariPlayableUrl(rep.videoUrl4) ? rep.videoUrl4?.trim() : undefined,
          videoUrl5: isHikariPlayableUrl(rep.videoUrl5) ? rep.videoUrl5?.trim() : undefined,
        });
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

export function sanitizeRemoteEpisodeForAdmin(rep: Episode): Episode {
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
    hikariPlayerEpisodeId:
      normalizeHikariPlayerEpisodeId(rep.hikariPlayerEpisodeId) ?? undefined,
    ...(rep.openingStartSeconds !== undefined
      ? { openingStartSeconds: rep.openingStartSeconds }
      : {}),
    ...(rep.openingEndSeconds !== undefined
      ? { openingEndSeconds: rep.openingEndSeconds }
      : {}),
    ...(rep.recentBadges !== undefined
      ? { recentBadges: normalizeAnimeRecentBadges(rep.recentBadges) }
      : {}),
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
          hikariPlayerEpisodeId:
            normalizeHikariPlayerEpisodeId(lep.hikariPlayerEpisodeId) ??
            normalizeHikariPlayerEpisodeId(rep.hikariPlayerEpisodeId) ??
            undefined,
          ...(lep.openingStartSeconds !== undefined || rep.openingStartSeconds !== undefined
            ? {
                openingStartSeconds:
                  lep.openingStartSeconds !== undefined
                    ? lep.openingStartSeconds
                    : rep.openingStartSeconds,
              }
            : {}),
          ...(lep.openingEndSeconds !== undefined || rep.openingEndSeconds !== undefined
            ? {
                openingEndSeconds:
                  lep.openingEndSeconds !== undefined
                    ? lep.openingEndSeconds
                    : rep.openingEndSeconds,
              }
            : {}),
          ...(lep.recentBadges !== undefined || rep.recentBadges !== undefined
            ? {
                recentBadges: normalizeAnimeRecentBadges(
                  lep.recentBadges !== undefined ? lep.recentBadges : rep.recentBadges,
                ),
              }
            : {}),
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

  // Preservar imagens válidas do Kitsu diante de URLs padrão de outras CDNs (ex.: AniList/MAL),
  // evitando que o fallback do AniList ou um registro de episódio sem mídia customizada
  // substitua arte Kitsu já armazenada no cliente.
  if (
    isKitsuImageUrl(cleanLocal) &&
    isRemoteDefaultCdn(cleanRemote) &&
    !isKitsuImageUrl(cleanRemote)
  ) {
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
      : !isRemoteDefaultCdn(cleanLocal) || isKitsuImageUrl(cleanLocal);

  return !hasUnsyncedLocalEdit;
}

export interface AdminDisplayMedia {
  cover: string;
  desktopBanner: string;
  mobileBanner: ResolvedMobileBannerInfo | null;
  hasCustomDesktopBanner: boolean;
}

/**
 * Resolve as imagens efetivamente exibidas pelo Hikari para um anime no editor do Admin,
 * separando capa, banner desktop e banner mobile/temporada (resolvedMobileBanner)
 * sem converter uma imagem sazonal/mobile em banner permanente no formulário.
 */
export function resolveAdminDisplayMedia(
  form: Pick<LocalAnime, "cover" | "banner">,
  remote: Pick<Anime, "cover" | "banner" | "resolvedMobileBanner"> | null | undefined,
  clientMobileBanner?: ResolvedMobileBannerInfo | null,
): AdminDisplayMedia {
  const cleanFormCover = form.cover?.trim() || "";
  const cleanFormBanner = form.banner?.trim() || "";
  const cleanRemoteCover = remote?.cover?.trim() || "";
  const cleanRemoteBanner = remote?.banner?.trim() || "";

  const cover = cleanFormCover || cleanRemoteCover;
  const desktopBanner = cleanFormBanner || cleanRemoteBanner;

  const differsFromRemoteBanner = Boolean(
    cleanFormBanner &&
      (!remote ||
        !cleanRemoteBanner ||
        normalizeImageUrl(cleanFormBanner) !== normalizeImageUrl(cleanRemoteBanner)),
  );

  const serverMarkedAdminBanner = Boolean(
    cleanFormBanner &&
      remote?.resolvedMobileBanner?.source === "admin" &&
      normalizeImageUrl(cleanFormBanner) === normalizeImageUrl(cleanRemoteBanner),
  );

  const hasCustomDesktopBanner = differsFromRemoteBanner || serverMarkedAdminBanner;

  let mobileBanner: ResolvedMobileBannerInfo | null = null;
  if (hasCustomDesktopBanner) {
    mobileBanner = {
      url: desktopBanner,
      isAlternative: false,
      source: "admin",
      initialObjectPosition: "50% 24%",
    };
  } else {
    const candidate =
      (clientMobileBanner?.url ? clientMobileBanner : null) ??
      (remote?.resolvedMobileBanner?.url ? remote.resolvedMobileBanner : null);

    if (candidate && candidate.url && candidate.source !== "none") {
      mobileBanner = candidate;
    } else if (desktopBanner) {
      mobileBanner = {
        url: desktopBanner,
        isAlternative: false,
        source: "season-default",
        initialObjectPosition: "50% 24%",
      };
    }
  }

  return {
    cover,
    desktopBanner,
    mobileBanner,
    hasCustomDesktopBanner,
  };
}

export interface CatalogAnimeSavePayload {
  id: string;
  titleRomaji: string;
  titleEnglish: string;
  titleNative: string;
  cover?: string;
  banner?: string;
  coverExplicitlyEdited: boolean;
  bannerExplicitlyEdited: boolean;
  synopsis: string;
  score: number | null;
  genres: string[];
  format: string;
  status: string;
  episodesCount: number | null;
  season: string | null;
  year: number | null;
  trailerId: string | null;
  hidden: boolean;
  anilistId?: number;
  malId?: number;
  kitsuId?: number;
  recentBadges?: AnimeRecentBadges;
  badgesExplicitlyEdited: boolean;
  seasons: Array<{ id: string; number: number; title: string }>;
}

/**
 * Monta o payload de metadados enviado a `/api/admin/catalog-anime`, omitindo
 * estritamente `cover`, `banner` e `recentBadges` quando não houve alteração manual explícita pelo admin.
 */
export function buildAdminCatalogAnimeSavePayload(
  effectiveAnime: LocalAnime,
  dirtyMedia: { cover: boolean; banner: boolean },
  dirtyBadges = false,
): CatalogAnimeSavePayload {
  const shouldSendCover = Boolean(dirtyMedia.cover);
  const shouldSendBanner = Boolean(dirtyMedia.banner);
  const shouldSendBadges = Boolean(dirtyBadges);

  return {
    id: effectiveAnime.id,
    titleRomaji: effectiveAnime.titleRomaji,
    titleEnglish: effectiveAnime.titleEnglish,
    titleNative: effectiveAnime.titleNative,
    ...(shouldSendCover ? { cover: effectiveAnime.cover } : {}),
    ...(shouldSendBanner ? { banner: effectiveAnime.banner } : {}),
    coverExplicitlyEdited: shouldSendCover,
    bannerExplicitlyEdited: shouldSendBanner,
    synopsis: effectiveAnime.synopsis,
    score: effectiveAnime.score,
    genres: effectiveAnime.genres,
    format: effectiveAnime.format,
    status: effectiveAnime.status,
    episodesCount: effectiveAnime.episodesCount,
    season: effectiveAnime.season,
    year: effectiveAnime.year,
    trailerId: effectiveAnime.trailerId,
    hidden: effectiveAnime.hidden,
    anilistId: effectiveAnime.anilistId,
    malId: effectiveAnime.malId,
    kitsuId: effectiveAnime.kitsuId,
    ...(shouldSendBadges
      ? { recentBadges: normalizeAnimeRecentBadges(effectiveAnime.recentBadges) }
      : {}),
    badgesExplicitlyEdited: shouldSendBadges,
    seasons: effectiveAnime.seasons.map((s) => ({
      id: s.id,
      number: s.number,
      title: s.title,
    })),
  };
}

export function resolveSavedRecentBadgesFromServer(
  localBadges: AnimeRecentBadges | undefined,
  serverBadges: Partial<AnimeRecentBadges> | null | undefined,
  wasExplicitlySent: boolean,
): AnimeRecentBadges | undefined {
  if (wasExplicitlySent) {
    return serverBadges
      ? normalizeAnimeRecentBadges(serverBadges)
      : localBadges
        ? normalizeAnimeRecentBadges(localBadges)
        : undefined;
  }
  if (serverBadges) {
    return normalizeAnimeRecentBadges(serverBadges);
  }
  return localBadges ? normalizeAnimeRecentBadges(localBadges) : undefined;
}

export function resolveSavedMediaFromServer(
  localUrl: string,
  serverUrl: string | null | undefined,
  wasExplicitlySent: boolean,
): string {
  const cleanServer = typeof serverUrl === "string" ? serverUrl.trim() : "";
  if (wasExplicitlySent) {
    return cleanServer || localUrl;
  }
  if (!cleanServer) {
    return localUrl;
  }
  if (
    isKitsuImageUrl(localUrl) &&
    isRemoteDefaultCdn(cleanServer) &&
    !isKitsuImageUrl(cleanServer)
  ) {
    return localUrl;
  }
  return cleanServer;
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
      serverCatalogId: remote.serverCatalogId || base.serverCatalogId,
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
    serverCatalogId: remote.serverCatalogId || storedMatch.serverCatalogId || undefined,
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
  const malIdFromRoute = id.startsWith("mal-") ? Number(id.slice(4)) : NaN;
  const kitsuIdFromRoute = id.startsWith("kitsu-") ? Number(id.slice(6)) : NaN;
  const isLocalRequestedId = id.startsWith("local-");
  const isDubbedTitle = (a: LocalAnime) =>
    /\b(dub|dublado|dublada)\b/i.test(`${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`);

  // 1. Direct exact match by local ID takes priority (e.g. /anime/local-xxx)
  let byId = locals.find((a) => a.id === id);

  // 2. If id is external (numeric, mal-*, kitsu-*), search matching local record preferring the original/subbed version
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
  if (!byId && Number.isFinite(malIdFromRoute) && malIdFromRoute > 0) {
    byId =
      locals.find((a) => a.malId === malIdFromRoute && !isDubbedTitle(a)) ||
      locals.find((a) => a.malId === malIdFromRoute);
  }
  if (!byId && Number.isFinite(kitsuIdFromRoute) && kitsuIdFromRoute > 0) {
    byId =
      locals.find((a) => a.kitsuId === kitsuIdFromRoute && !isDubbedTitle(a)) ||
      locals.find((a) => a.kitsuId === kitsuIdFromRoute);
  }

  if (byId) {
    const local = localToAnime(byId);
    const resolvedSeasons = mergeSeasonsWithRemote(local.seasons, remote?.seasons);

    if (!remote) {
      return {
        ...local,
        serverCatalogId: byId.serverCatalogId || undefined,
        seasons: resolvedSeasons,
        studios: local.studios ?? [],
        characters: local.characters ?? [],
        staff: local.staff ?? [],
      };
    }

    const preserveExternalId = !isLocalRequestedId && !remote.id.startsWith("local-");
    const resolvedId = preserveExternalId ? remote.id : local.id;
    const resolvedServerCatalogId =
      remote.serverCatalogId ||
      byId.serverCatalogId ||
      (byId.id !== resolvedId ? byId.id : undefined);

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

    const preferRemoteKitsuCover =
      isKitsuImageUrl(remote.cover) &&
      isRemoteDefaultCdn(local.cover) &&
      !isKitsuImageUrl(local.cover);
    const preferRemoteKitsuBanner =
      isKitsuImageUrl(remote.banner) &&
      isRemoteDefaultCdn(local.banner) &&
      !isKitsuImageUrl(local.banner);

    return {
      ...remote,
      ...local,
      id: resolvedId,
      serverCatalogId: resolvedServerCatalogId,
      titles: local.titles,
      cover: preferRemoteKitsuCover ? remote.cover : local.cover || remote.cover,
      banner: preferRemoteKitsuBanner ? remote.banner : local.banner || remote.banner,
      synopsis: local.synopsis || remote.synopsis,
      seasons: resolvedSeasons,
      trailerId: local.trailerId || remote.trailerId,
      genres: local.genres.length ? local.genres : remote.genres,
      recommendations: remote.recommendations,
      streamingEpisodes: remote.streamingEpisodes,
      studios: mergedStudios,
      characters: mergedCharacters,
      staff: mergedStaff,
      hasEpisode: Boolean(remote.hasEpisode || local.hasEpisode),
      source: "local",
    };
  }

  if (!remote) return null;

  const byAni = remote.anilistId
    ? locals.find((a) => a.anilistId === remote.anilistId && !isDubbedTitle(a)) ||
      locals.find((a) => a.anilistId === remote.anilistId)
    : remote.malId
      ? locals.find((a) => a.malId === remote.malId && !isDubbedTitle(a)) ||
        locals.find((a) => a.malId === remote.malId)
      : remote.kitsuId
        ? locals.find((a) => a.kitsuId === remote.kitsuId && !isDubbedTitle(a)) ||
          locals.find((a) => a.kitsuId === remote.kitsuId)
        : undefined;

  if (byAni) {
    const local = localToAnime(byAni);
    const resolvedSeasons = mergeSeasonsWithRemote(local.seasons, remote.seasons);
    const preserveExternalId = !isLocalRequestedId && !remote.id.startsWith("local-");
    const resolvedId = preserveExternalId ? remote.id : local.id;
    const resolvedServerCatalogId =
      remote.serverCatalogId ||
      byAni.serverCatalogId ||
      (byAni.id !== resolvedId ? byAni.id : undefined);

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

    const preferRemoteKitsuCover =
      isKitsuImageUrl(remote.cover) &&
      isRemoteDefaultCdn(local.cover) &&
      !isKitsuImageUrl(local.cover);
    const preferRemoteKitsuBanner =
      isKitsuImageUrl(remote.banner) &&
      isRemoteDefaultCdn(local.banner) &&
      !isKitsuImageUrl(local.banner);

    return {
      ...remote,
      ...local,
      id: resolvedId,
      serverCatalogId: resolvedServerCatalogId,
      cover: preferRemoteKitsuCover ? remote.cover : local.cover || remote.cover,
      banner: preferRemoteKitsuBanner ? remote.banner : local.banner || remote.banner,
      seasons: resolvedSeasons,
      trailerId: local.trailerId || remote.trailerId,
      recommendations: remote.recommendations,
      streamingEpisodes: remote.streamingEpisodes,
      studios: mergedStudios,
      characters: mergedCharacters,
      staff: mergedStaff,
      hasEpisode: Boolean(remote.hasEpisode || local.hasEpisode),
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
