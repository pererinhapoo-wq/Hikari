import {
  normalizeAnimeRecentBadges,
  type AnimeRecentBadges,
  type Episode,
  type LocalAnime,
} from "@/lib/types";
import { inferIsDubbedFromTitles, rowIsDubbed } from "@/lib/anime-identity";
import { getBearerToken } from "@/lib/auth/client";
import { readOutbox, type OutboxOperation } from "@/lib/episode-writer";
import {
  readTombstoneRecords,
  isEpisodeTombstoned,
  type TombstoneRecord,
} from "@/lib/catalog-storage";
import type { PublicEpisodeRow, PublicEpisodesResult } from "@/lib/catalog-episodes";
import {
  buildAnitube22PlayerUrlFromParts,
  isLegacyAnitube22Ref,
  parseAnitube22PlayerUrl,
  stripTimeQueryParam,
} from "@/lib/anitube22";
import { parseEpisodePublicationTimestamp } from "@/lib/relative-published-time";
import {
  buildHikariPlayerEpisodeUrl,
  normalizeHikariPlayerEpisodeId,
} from "@/lib/hikari-player";

export type PublishedEpisodeBadge = "LANÇAMENTO" | "NOVO" | "FINAL" | null;

export type PublishedEpisode = {
  animeId: string;
  animeTitle: string;
  animeAltTitles?: string[];
  animeCover: string;
  animeBanner?: string;
  seasonId: string;
  seasonNumber: number;
  seasonTitle: string;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  thumbnail?: string;
  duration?: string;
  videoUrl?: string;
  hikariPlayerEpisodeId?: string;
  publishedAt: number;
  published?: boolean;
  publishedTimestamp?: number | null;
  badge?: PublishedEpisodeBadge;
  recentBadges?: AnimeRecentBadges;
  audio?: string;
  audioVersion?: string;
};

export function resolvePrimaryBadgeFromRecentBadges(
  badges?: Partial<AnimeRecentBadges> | null,
): PublishedEpisodeBadge {
  if (!badges) return null;
  if (badges.final) return "FINAL";
  if (badges.lancamento) return "LANÇAMENTO";
  if (badges.novo) return "NOVO";
  return null;
}

const EXPLICIT_SUB_AUDIO_REGEX =
  /(?:^|[^a-z0-9])(sub|subbed|legendado|legendada|leg|original|jp|jpn|japanese|japon[eê]s|audio\s*original|áudio\s*original)(?:$|[^a-z0-9])/i;
const EXPLICIT_DUB_AUDIO_REGEX =
  /(?:^|[^a-z0-9])(dub|dubbed|dublado|dublada|dublagem|pt-br\s*dub|dub\s*pt-br|pt-br|portugu[eê]s)(?:$|[^a-z0-9])/i;
const EPISODE_SUB_TEXT_REGEX =
  /(?:^|[^a-z0-9])(leg|legendado|legendada|sub|subbed|english\s*sub|pt-br\s*leg|áudio\s*original|audio\s*original|japon[eê]s)(?:$|[^a-z0-9])/i;
const EPISODE_DUB_TEXT_REGEX =
  /(?:^|[^a-z0-9])(dub|dubbed|dublado|dublada|dublagem|pt-br\s*dub|dub\s*pt-br|áudio\s*pt-br|audio\s*pt-br)(?:$|[^a-z0-9])/i;

/**
 * Classifica se o episódio efetivamente exibido é dublado sem confundir
 * animes dublados com episódios legendados (ou vice-versa).
 * Prioridade: campos explícitos de áudio -> título do episódio -> título da temporada -> títulos do anime.
 */
export function isPublishedEpisodeDubbed(
  episode: Pick<
    PublishedEpisode,
    "episodeTitle" | "seasonTitle" | "animeTitle" | "animeAltTitles" | "audio" | "audioVersion"
  >,
): boolean {
  const audioText = [episode.audio, episode.audioVersion]
    .filter((v): v is string => typeof v === "string" && Boolean(v.trim()))
    .join(" ");

  if (audioText) {
    if (EXPLICIT_SUB_AUDIO_REGEX.test(audioText)) return false;
    if (EXPLICIT_DUB_AUDIO_REGEX.test(audioText)) return true;
  }

  const epTitle = episode.episodeTitle?.trim() || "";
  if (epTitle) {
    if (EPISODE_SUB_TEXT_REGEX.test(epTitle)) return false;
    if (EPISODE_DUB_TEXT_REGEX.test(epTitle)) return true;
  }

  const seasonTitle = episode.seasonTitle?.trim() || "";
  if (seasonTitle) {
    if (EPISODE_SUB_TEXT_REGEX.test(seasonTitle)) return false;
    if (EPISODE_DUB_TEXT_REGEX.test(seasonTitle)) return true;
  }

  const animeTitlesText = [
    episode.animeTitle,
    ...(episode.animeAltTitles || []),
  ]
    .filter((v): v is string => typeof v === "string" && Boolean(v.trim()))
    .join(" ");

  if (animeTitlesText) {
    if (EPISODE_SUB_TEXT_REGEX.test(animeTitlesText)) return false;
    if (EPISODE_DUB_TEXT_REGEX.test(animeTitlesText)) return true;
  }

  return false;
}

function escapeSqlSingleQuotedLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Gera a expressão SQL PostgreSQL equivalente a `isPublishedEpisodeDubbed`
 * (sem campos de áudio em memória), para identificar se uma linha de episódio
 * publicada é dublada diretamente nas consultas em lote do catálogo.
 */
export function buildEpisodeDubbedSqlCondition(
  episodeAlias = "e",
  seasonAlias = "s",
  animeAlias = "a",
): string {
  const subPattern = escapeSqlSingleQuotedLiteral(EPISODE_SUB_TEXT_REGEX.source);
  const dubPattern = escapeSqlSingleQuotedLiteral(EPISODE_DUB_TEXT_REGEX.source);
  const animeTitlesExpr = `CONCAT_WS(' ', ${animeAlias}."title", ${animeAlias}."titleRomaji", ${animeAlias}."titleEnglish", ${animeAlias}."titleNative")`;

  return `(
    CASE
      WHEN COALESCE(${episodeAlias}."title", '') ~* '${subPattern}' THEN false
      WHEN COALESCE(${episodeAlias}."title", '') ~* '${dubPattern}' THEN true
      WHEN COALESCE(${seasonAlias}."title", '') ~* '${subPattern}' THEN false
      WHEN COALESCE(${seasonAlias}."title", '') ~* '${dubPattern}' THEN true
      WHEN ${animeTitlesExpr} ~* '${subPattern}' THEN false
      WHEN ${animeTitlesExpr} ~* '${dubPattern}' THEN true
      ELSE false
    END
  )`;
}

/**
 * Determina se um anime deve exibir o selo DUB nos cards do catálogo:
 * - Anime com pelo menos um episódio identificado como dublado: exibir DUB.
 * - Anime sem episódios dublados: NÃO exibir o selo.
 * - Anime sem episódios: NÃO exibir o selo.
 * - A identificação reflete os dados reais, sem depender apenas de título
 *   quando houver episódios cadastrados.
 */
export function isAnimeDubbed(
  anime?: {
    id?: string;
    titles?: { romaji?: string | null; english?: string | null; native?: string | null };
    titleRomaji?: string | null;
    titleEnglish?: string | null;
    titleNative?: string | null;
    title?: string | null;
    hasEpisode?: boolean;
    isDubbed?: boolean;
    is_dubbed?: boolean;
    seasons?: Array<{
      id?: string;
      number?: number;
      title?: string;
      episodes?: Array<{
        id?: string;
        number?: number;
        title?: string;
        published?: boolean;
        audio?: string;
        audioVersion?: string;
        videoUrl?: string;
        videoUrl2?: string;
        videoUrl3?: string;
        videoUrl4?: string;
        videoUrl5?: string;
        hikariPlayerEpisodeId?: string | null;
      }>;
    }> | null;
  } | null,
): boolean {
  if (!anime) return false;

  const seasons = anime.seasons;
  if (Array.isArray(seasons) && seasons.length > 0) {
    let hasPublished = false;

    const canonicalTitle =
      anime.titleEnglish?.trim() ||
      anime.titleRomaji?.trim() ||
      anime.titleNative?.trim() ||
      anime.title?.trim() ||
      anime.titles?.english?.trim() ||
      anime.titles?.romaji?.trim() ||
      anime.titles?.native?.trim() ||
      "Anime";

    const altTitles = [
      canonicalTitle,
      anime.titleRomaji,
      anime.titleEnglish,
      anime.titleNative,
      anime.title,
      anime.titles?.romaji,
      anime.titles?.english,
      anime.titles?.native,
    ].filter((t): t is string => typeof t === "string" && Boolean(t.trim()));

    for (const season of seasons) {
      if (!Array.isArray(season?.episodes)) continue;
      for (const ep of season.episodes) {
        if (!ep || ep.published !== true) continue;
        hasPublished = true;
        if (
          isPublishedEpisodeDubbed({
            episodeTitle: ep.title || "",
            seasonTitle: season.title || "",
            animeTitle: canonicalTitle,
            animeAltTitles: altTitles,
            audio: ep.audio,
            audioVersion: ep.audioVersion,
          })
        ) {
          return true;
        }
      }
    }

    // Se temos temporadas carregadas e NÃO tem nenhum episódio publicado:
    // Regra: Anime sem episódios: NÃO exibir o selo
    if (!hasPublished && anime.hasEpisode !== true) {
      return false;
    }

    // Se tem episódios publicados mas nenhum foi identificado como dublado:
    // Regra: Anime sem episódios dublados: NÃO exibir o selo
    if (hasPublished) {
      return false;
    }
  }

  // Se não temos temporadas/episódios carregados diretamente:
  // Regra fundamental: se o anime não tem episódios publicados confirmados, nunca exibe DUB!
  if (anime.hasEpisode !== true) {
    return false;
  }

  if (typeof anime.isDubbed === "boolean") {
    return anime.isDubbed;
  }
  if (typeof anime.is_dubbed === "boolean") {
    return anime.is_dubbed;
  }

  return Boolean(
    inferIsDubbedFromTitles({
      title: anime.title,
      titleRomaji: anime.titleRomaji || anime.titles?.romaji,
      titleEnglish: anime.titleEnglish || anime.titles?.english,
      titleNative: anime.titleNative || anime.titles?.native,
    }) ||
      rowIsDubbed({
        title: anime.title,
        titleRomaji: anime.titleRomaji || anime.titles?.romaji,
        titleEnglish: anime.titleEnglish || anime.titles?.english,
        titleNative: anime.titleNative || anime.titles?.native,
      }),
  );
}

/**
 * Resolve o melhor nome legível para um anime, evitando "Sem título" ou valores vazios.
 */
function resolveAnimeCanonicalTitle(anime: LocalAnime): string {
  const english = anime.titleEnglish?.trim();
  const romaji = anime.titleRomaji?.trim();
  const native = anime.titleNative?.trim();
  const rawTitle = (anime as unknown as { title?: string }).title?.trim();
  const titles = (anime as unknown as { titles?: { english?: string; romaji?: string; native?: string } }).titles;

  return (
    english ||
    romaji ||
    native ||
    rawTitle ||
    titles?.english?.trim() ||
    titles?.romaji?.trim() ||
    titles?.native?.trim() ||
    "Anime"
  );
}

/**
 * Coleta todas as variações conhecidas do nome do anime (Romaji, Inglês, Nativo, etc.).
 */
export function resolveAnimeAltTitles(anime: LocalAnime, canonicalTitle: string): string[] {
  return Array.from(
    new Set(
      [
        canonicalTitle,
        anime.titleRomaji,
        anime.titleEnglish,
        anime.titleNative,
        (anime as unknown as { title?: string }).title,
        (anime as unknown as { titles?: { romaji?: string; english?: string; native?: string } }).titles?.romaji,
        (anime as unknown as { titles?: { romaji?: string; english?: string; native?: string } }).titles?.english,
        (anime as unknown as { titles?: { romaji?: string; english?: string; native?: string } }).titles?.native,
      ]
        .filter((t): t is string => typeof t === "string" && Boolean(t.trim()))
        .map((t) => t.trim()),
    ),
  );
}

const BLOCKED_STREAMING_HOSTS = [
  "crunchyroll.com",
  "funimation.com",
  "vrv.co",
  "netflix.com",
  "hidive.com",
  "hulu.com",
  "tubitv.com",
  "bilibili.tv",
  "iq.com",
  "iqiyi.com",
  "disneyplus.com",
  "primevideo.com",
  "amazon.com",
  "viz.com",
  "adultswim.com",
  "retrocrush.tv",
  "starplus.com",
  "max.com",
  "hbomax.com",
  "dailymotion.com",
  "anilist.co",
  "myanimelist.net",
  "kitsu.io",
  "youtu.be",
  "youtube.com",
  "youtube-nocookie.com",
  "vimeo.com",
] as const;

function matchesHostDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * Identifica se uma URL pertence ao YouTube (trailer, referência ou embed),
 * usada para impedir que trailers do YouTube sejam tratados como fonte de episódio
 * sem afetar a extração independente de miniaturas do YouTube.
 */
export function isYouTubeMediaUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    return (
      matchesHostDomain(host, "youtube.com") ||
      matchesHostDomain(host, "youtu.be") ||
      matchesHostDomain(host, "youtube-nocookie.com")
    );
  } catch {
    return /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(trimmed);
  }
}

/**
 * Verifica se uma URL é um arquivo ou stream de mídia reproduzível no Hikari,
 * descartando páginas web externas de catálogo de terceiros (Crunchyroll, Funimation, YouTube, etc.).
 */
export function isHikariPlayableUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "#") return false;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return false;
  }

  if (isLegacyAnitube22Ref(trimmed)) {
    return false;
  }

  if (lower.includes("playerricas.php")) {
    return parseAnitube22PlayerUrl(trimmed) !== null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  if (!host) return false;

  if (BLOCKED_STREAMING_HOSTS.some((domain) => matchesHostDomain(host, domain))) {
    return false;
  }

  return true;
}

const MUX_PLAYBACK_ID_REGEX = /^[a-zA-Z0-9_-]{20,50}$/;

/**
 * Normaliza URLs de stream suportadas pelo player nativo/HLS (Mux, Bunny MediaDelivery)
 * mantendo URLs diretas inalteradas. Nunca substitui por trailer.
 */
export function resolvePlayableStreamUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.includes("player.mux.com/")) {
    const muxMatch = trimmed.match(/player\.mux\.com\/([a-zA-Z0-9_-]+)/);
    if (muxMatch?.[1]) {
      return `https://stream.mux.com/${muxMatch[1]}.m3u8`;
    }
  }
  if (
    MUX_PLAYBACK_ID_REGEX.test(trimmed) &&
    !trimmed.includes("/") &&
    !trimmed.includes(".")
  ) {
    return `https://stream.mux.com/${trimmed}.m3u8`;
  }

  if (trimmed.includes("player.mediadelivery.net/embed/")) {
    const bunnyMatch = trimmed.match(
      /mediadelivery\.net\/embed\/(\d+)\/([0-9a-f-]{36})/i,
    );
    if (bunnyMatch) {
      const [, libraryId, videoId] = bunnyMatch;
      return `https://vz-${libraryId}.b-cdn.net/${videoId}/playlist.m3u8`;
    }
  }

  if (isLegacyAnitube22Ref(trimmed)) {
    return null;
  }

  if (trimmed.toLowerCase().includes("playerricas.php")) {
    const parsedAnitube = parseAnitube22PlayerUrl(trimmed);
    return parsedAnitube ? buildAnitube22PlayerUrlFromParts(parsedAnitube) : null;
  }

  return trimmed;
}

/**
 * Verifica se uma URL cadastrada no episódio é reproduzível no player do Hikari (/watch/$id/$ep).
 * Aceita URLs HTTP/HTTPS válidas (compatíveis com `isHikariPlayableUrl`), Mux, Bunny, `blob:` e
 * caminhos internos relativos seguros (`/api/...`), rejeitando rigorosamente YouTube e sites externos.
 */
export function isWatchPlayableMediaUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "#") return false;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return false;
  }

  if (isYouTubeMediaUrl(trimmed)) {
    return false;
  }

  if (
    lower.includes("player.mux.com/") ||
    (MUX_PLAYBACK_ID_REGEX.test(trimmed) &&
      !trimmed.includes("/") &&
      !trimmed.includes("."))
  ) {
    return true;
  }

  if (lower.includes("player.mediadelivery.net/embed/")) {
    return true;
  }

  if (lower.startsWith("blob:")) {
    return true;
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return true;
  }

  return isHikariPlayableUrl(trimmed);
}

export type EpisodePlayerSourceEntry = {
  id: "player-1" | "player-2" | "player-3" | "player-4" | "player-5";
  url: string;
  name: string;
};

/**
 * Resolve exclusivamente as fontes de vídeo reais cadastradas nos slots Player 1 a Player 5
 * do episódio selecionado, preservando a ordem e os identificadores dos servidores.
 */
export function resolveEpisodePlayerSources(
  episode?: {
    videoUrl?: string | null;
    videoUrl2?: string | null;
    videoUrl3?: string | null;
    videoUrl4?: string | null;
    videoUrl5?: string | null;
  } | null,
): EpisodePlayerSourceEntry[] {
  if (!episode) return [];

  const list: EpisodePlayerSourceEntry[] = [];
  const candidates = [
    { id: "player-1" as const, raw: episode.videoUrl, defaultName: "Player 1" },
    { id: "player-2" as const, raw: episode.videoUrl2, defaultName: "Player 2" },
    { id: "player-3" as const, raw: episode.videoUrl3, defaultName: "Player 3" },
    { id: "player-4" as const, raw: episode.videoUrl4, defaultName: "Player 4" },
    { id: "player-5" as const, raw: episode.videoUrl5, defaultName: "Player 5" },
  ];

  for (const candidate of candidates) {
    if (!candidate.raw || !isWatchPlayableMediaUrl(candidate.raw)) {
      continue;
    }
    const resolved = resolvePlayableStreamUrl(candidate.raw);
    if (resolved) {
      list.push({
        id: candidate.id,
        url: resolved,
        name: candidate.defaultName,
      });
    }
  }

  return list;
}

/**
 * Seleciona exclusivamente o episódio correspondente ao parâmetro da rota (`ep` ou `targetEpNum`),
 * priorizando ocorrências com fonte reproduzível em caso de múltiplas temporadas e nunca substituindo
 * por outro episódio (`episodes[0]`) quando o episódio solicitado não existir.
 */
export function selectEpisodeForWatch(
  episodes: Episode[],
  epParam: string | undefined,
  targetEpNum: number,
): Episode | null {
  if (!Array.isArray(episodes) || episodes.length === 0) {
    return null;
  }

  const hasWatchSource = (e: Episode): boolean =>
    resolveEpisodePlayerSources(e).length > 0 ||
    buildHikariPlayerEpisodeUrl(e.hikariPlayerEpisodeId) !== null;

  const byId = epParam
    ? episodes.filter((e) => e.id === epParam || String(e.id) === String(epParam))
    : [];
  if (byId.length > 0) {
    return byId.find(hasWatchSource) ?? byId[0];
  }

  const byNumber = episodes.filter(
    (e) => e.number === targetEpNum || String(e.number) === String(targetEpNum),
  );
  if (byNumber.length > 0) {
    return byNumber.find(hasWatchSource) ?? byNumber[0];
  }

  return null;
}

/**
 * Sanitiza e valida estritamente se uma URL é HTTP/HTTPS bem formada e aceita como fonte
 * reproduzível persistível pelo Hikari.
 */
export function sanitizePlayableVideoUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "#") return null;

  if (isLegacyAnitube22Ref(trimmed)) {
    return null;
  }

  if (trimmed.toLowerCase().includes("playerricas.php")) {
    if (!parseAnitube22PlayerUrl(trimmed)) {
      return null;
    }
    return stripTimeQueryParam(trimmed);
  }

  if (!isHikariPlayableUrl(trimmed)) {
    return null;
  }

  return stripTimeQueryParam(trimmed);
}

/**
 * Valida estritamente se uma URL é HTTP/HTTPS bem formada e aceita como fonte
 * reproduzível persistível pelo Hikari (alinhada à validação de `sanitizeVideoUrl` no servidor).
 */
export function isPersistablePlayableVideoUrl(url?: string | null): boolean {
  return sanitizePlayableVideoUrl(url) !== null;
}

/**
 * Verifica se o episódio possui ao menos uma fonte de reprodução válida e persistível
 * entre Player 1 a Player 5 ou um ID válido do Hikari Player.
 */
export function hasEpisodePlayableSource(ep: {
  videoUrl?: string | null;
  videoUrl2?: string | null;
  videoUrl3?: string | null;
  videoUrl4?: string | null;
  videoUrl5?: string | null;
  hikariPlayerEpisodeId?: string | null;
}): boolean {
  return (
    [
      ep.videoUrl,
      ep.videoUrl2,
      ep.videoUrl3,
      ep.videoUrl4,
      ep.videoUrl5,
    ].some(isPersistablePlayableVideoUrl) ||
    buildHikariPlayerEpisodeUrl(ep.hikariPlayerEpisodeId) !== null
  );
}

export interface VideoThumbnailCandidate {
  id: string;
  previewUrl: string;
  remoteUrl?: string;
  blob?: Blob;
  source: "cloudinary" | "youtube" | "video-frame";
  label: string;
  timeSeconds?: number;
}

/**
 * Deriva uma miniatura gerada automaticamente pelo Cloudinary quando o vídeo está hospedado lá.
 */
export function getCloudinaryThumbnail(url?: string | null, offsetSeconds = 15): string | null {
  if (!url || typeof url !== "string") return null;
  if (!url.includes("cloudinary.com") || !url.includes("/upload/")) return null;
  try {
    return url
      .replace(/\/upload\/(?:so_[^,]+,?)?/, `/upload/so_${offsetSeconds},w_640,c_scale/`)
      .replace(/\.[a-zA-Z0-9]+(\?.*)?$/i, ".jpg$1");
  } catch {
    return null;
  }
}

/**
 * Deriva múltiplas miniaturas em instantes distintos quando o vídeo está hospedado no Cloudinary.
 */
export function getCloudinaryThumbnailCandidates(url?: string | null): VideoThumbnailCandidate[] {
  if (!url || typeof url !== "string") return [];
  const offsets = [
    { sec: 5, label: "00:05" },
    { sec: 15, label: "00:15" },
    { sec: 35, label: "00:35" },
    { sec: 60, label: "01:00" },
    { sec: 90, label: "01:30" },
  ];
  const seen = new Set<string>();
  const results: VideoThumbnailCandidate[] = [];

  for (const item of offsets) {
    const thumb = getCloudinaryThumbnail(url, item.sec);
    if (thumb && !seen.has(thumb)) {
      seen.add(thumb);
      results.push({
        id: `cloudinary-${item.sec}`,
        previewUrl: thumb,
        remoteUrl: thumb,
        source: "cloudinary",
        label: item.label,
        timeSeconds: item.sec,
      });
    }
  }

  return results;
}

/**
 * Deriva uma miniatura oficial do YouTube quando o vídeo é um stream do YouTube.
 */
export function getYouTubeThumbnail(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match && match[1]) {
    return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return null;
}

/**
 * Deriva múltiplas miniaturas reais do YouTube para escolha manual.
 */
export function getYouTubeThumbnailCandidates(url?: string | null): VideoThumbnailCandidate[] {
  if (!url || typeof url !== "string") return [];
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (!match?.[1]) return [];
  const videoId = match[1];

  const variants = [
    { file: "hqdefault.jpg", label: "Capa" },
    { file: "1.jpg", label: "Cena 1" },
    { file: "2.jpg", label: "Cena 2" },
    { file: "3.jpg", label: "Cena 3" },
    { file: "mqdefault.jpg", label: "Média" },
  ];

  return variants.map((v) => {
    const thumbUrl = `https://img.youtube.com/vi/${videoId}/${v.file}`;
    return {
      id: `youtube-${v.file}`,
      previewUrl: thumbUrl,
      remoteUrl: thumbUrl,
      source: "youtube",
      label: v.label,
    };
  });
}

const SAFE_DATA_IMAGE_THUMB_REGEX =
  /^data:image\/(?:png|jpeg|jpg|webp|gif|avif);base64,[a-z0-9+/=]+$/i;

/**
 * Sanitiza e valida uma URL de thumbnail de episódio informada manualmente ou capturada.
 * Permite HTTP/HTTPS, caminhos relativos internos (`/`) e data URLs seguras de imagem raster.
 * Rejeita esquemas perigosos ou temporários (`javascript:`, `vbscript:`, `blob:`, `data:text/html`, SVG).
 */
export function sanitizeEpisodeThumbnailUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "#") return null;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("blob:")
  ) {
    return null;
  }

  if (lower.startsWith("data:")) {
    if (trimmed.length <= 4096 && SAFE_DATA_IMAGE_THUMB_REGEX.test(trimmed)) {
      return trimmed;
    }
    return null;
  }

  if (trimmed.startsWith("//")) {
    try {
      const parsed = new URL(`https:${trimmed}`);
      if (parsed.protocol === "https:") {
        return parsed.toString();
      }
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return trimmed;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Resolve a imagem do episódio seguindo a prioridade do Hikari:
 * 1. Imagem definida manualmente / salva no registro do episódio (`Episode.thumbnail`).
 * 2. Imagem obtida automaticamente a partir da fonte de vídeo (Cloudinary / YouTube).
 * 3. `undefined` quando nenhuma estiver disponível (permitindo o fallback padrão do Hikari).
 */
export function resolveEpisodeThumbnailUrl(ep?: {
  thumbnail?: string | null;
  videoUrl?: string | null;
  videoUrl2?: string | null;
  videoUrl3?: string | null;
  videoUrl4?: string | null;
  videoUrl5?: string | null;
} | null): string | undefined {
  if (!ep) return undefined;

  const manualOrExisting = sanitizeEpisodeThumbnailUrl(ep.thumbnail);
  if (manualOrExisting) {
    return manualOrExisting;
  }

  const videoCandidates = [
    ep.videoUrl,
    ep.videoUrl2,
    ep.videoUrl3,
    ep.videoUrl4,
    ep.videoUrl5,
  ];

  for (const candidate of videoCandidates) {
    if (!candidate || typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const cloudinaryThumb = getCloudinaryThumbnail(trimmed);
    if (cloudinaryThumb) return cloudinaryThumb;
    const youtubeThumb = getYouTubeThumbnail(trimmed);
    if (youtubeThumb) return youtubeThumb;
  }

  return undefined;
}

/**
 * Determina se um episódio foi efetivamente publicado e cadastrado no sistema
 * de publicação do Hikari pelo administrador.
 */
export function isEpisodePublished(ep: {
  id?: string;
  number?: number;
  videoUrl?: string;
  videoUrl2?: string;
  videoUrl3?: string;
  videoUrl4?: string;
  videoUrl5?: string;
  hikariPlayerEpisodeId?: string | null;
  published?: boolean;
}): boolean {
  if (!ep || !ep.id || typeof ep.number !== "number") {
    return false;
  }

  // Exige aprovação explícita de publicação pelo administrador (nunca auto-publica)
  if (ep.published !== true) {
    return false;
  }

  const sources = [
    ep.videoUrl,
    ep.videoUrl2,
    ep.videoUrl3,
    ep.videoUrl4,
    ep.videoUrl5,
  ];

  // Deve haver pelo menos uma fonte de vídeo real (Player 1-5) ou ID válido do Hikari Player
  const hasPlayableVideo =
    sources.some(isHikariPlayableUrl) ||
    buildHikariPlayerEpisodeUrl(ep.hikariPlayerEpisodeId) !== null;

  if (!hasPlayableVideo) {
    return false;
  }

  return true;
}

/**
 * Verifica se um anime tem status confirmado de concluído / encerrado.
 */
export function isAnimeConfirmedFinished(anime: LocalAnime): boolean {
  if (!anime.status) return false;
  const s = anime.status.trim().toUpperCase();
  return s === "FINISHED" || s === "ENCERRADO" || s === "CONCLUÍDO" || s === "CONCLUIDO";
}

/**
 * Determina se determinado episódio é com certeza o encerramento oficial da série.
 * 
 * Regra:
 * Destacar o último episódio somente quando houver confirmação de que o anime foi concluído.
 * Ter o último episódio cadastrado, por si só, não significa que a série terminou.
 */
export function isConfirmedFinalEpisode(
  anime: LocalAnime,
  seasonNumber: number,
  episodeNumber: number,
  episodeTitle?: string,
): boolean {
  if (!isAnimeConfirmedFinished(anime)) {
    return false;
  }

  const seasons = anime.seasons || [];
  if (seasons.length === 0) return false;

  const maxSeasonNumber = Math.max(...seasons.map((s) => s.number));
  if (seasonNumber < maxSeasonNumber) {
    return false;
  }

  // Se tiver a contagem total de episódios cadastrada de forma verificável
  if (typeof anime.episodesCount === "number" && anime.episodesCount > 0) {
    return episodeNumber >= anime.episodesCount;
  }

  // Se a contagem total não estiver cadastrada, só confirmamos se o próprio título
  // indicar expressamente o encerramento (ex.: "Fim", "O Fim", "Final", "The End")
  if (episodeTitle) {
    const titleClean = episodeTitle.trim().toLowerCase();
    const indicatesFinal = /\b(fim|final|o fim|the end|conclusão|conclusao|último episódio|ultimo episodio)\b/i.test(titleClean);
    if (indicatesFinal) {
      return true;
    }
  }

  return false;
}

/**
 * Retorna os episódios selecionados para a seção "Novos Episódios".
 * 
 * Regras implementadas:
 * 1. LANÇAMENTO: reservado para animes novos. O anime aparece nessa categoria apenas
 *    uma vez, associado ao episódio 1, sem repetir o status nos episódios seguintes.
 * 2. Novos episódios: para animes em lançamento semanal, destacar os episódios realmente
 *    recentes, sem listar todos os episódios antigos quando vários forem cadastrados de uma vez.
 * 3. FINAL: destacar o último episódio somente quando houver confirmação de que o anime foi concluído.
 *    Ter o último episódio cadastrado, por si só, não significa que a série terminou.
 * 4. Cadastro em massa: se forem cadastrados 300 episódios de um anime de uma vez, não exibir
 *    os 300 na seção "Novos Episódios". Mostrar o episódio 1 como "LANÇAMENTO" e o episódio 300
 *    como "FINAL" somente se esse for realmente o encerramento da série, omitindo os intermediários.
 * 5. Disponibilidade: todos os episódios continuam acessíveis normalmente na página do anime.
 */
export function getRecentEpisodesSection(animes: LocalAnime[]): PublishedEpisode[] {
  const result: PublishedEpisode[] = [];

  for (const anime of animes) {
    if (anime.hidden) continue;

    const animeTitle = resolveAnimeCanonicalTitle(anime);
    const altTitles = resolveAnimeAltTitles(anime, animeTitle);
    const baseTime = anime.updatedAt || anime.createdAt || 0;
    const createTime = anime.createdAt || baseTime;

    // Coleta todos os episódios publicados e válidos deste anime (deduplicados por slot)
    const publishedList: {
      season: LocalAnime["seasons"][number];
      ep: LocalAnime["seasons"][number]["episodes"][number];
      seasonNumber: number;
      episodeNumber: number;
      validVideo?: string;
      validHikariId?: string;
      resolvedThumb?: string;
    }[] = [];
    const seenSlots = new Set<string>();

    for (const season of anime.seasons || []) {
      for (const ep of season.episodes || []) {
        if (!isEpisodePublished(ep)) continue;

        const validVideo = [
          ep.videoUrl,
          ep.videoUrl2,
          ep.videoUrl3,
          ep.videoUrl4,
          ep.videoUrl5,
        ].find(isHikariPlayableUrl);
        const validHikariId = normalizeHikariPlayerEpisodeId(
          ep.hikariPlayerEpisodeId,
        );
        const hasValidHikariSource =
          buildHikariPlayerEpisodeUrl(validHikariId) !== null;

        if (!validVideo && !hasValidHikariSource) continue;

        const sNum = season.number || 1;
        const slotKey = `${sNum}:${ep.number}`;
        if (seenSlots.has(slotKey)) continue;
        seenSlots.add(slotKey);

        const resolvedThumb = resolveEpisodeThumbnailUrl(ep);

        publishedList.push({
          season,
          ep,
          seasonNumber: sNum,
          episodeNumber: ep.number,
          validVideo,
          validHikariId:
            hasValidHikariSource && validHikariId ? validHikariId : undefined,
          resolvedThumb,
        });
      }
    }

    if (publishedList.length === 0) continue;

    // Ordena pela numeração real (seasonNumber, episodeNumber), nunca pela ordem de inserção
    publishedList.sort(
      (a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber,
    );

    const buildItem = (
      item: (typeof publishedList)[number],
      publishedAt: number,
    ): PublishedEpisode => {
      const epWithPublishedAt = item.ep as Episode & {
        publishedAt?: string | number | null;
      };
      const epBadges = normalizeAnimeRecentBadges(item.ep.recentBadges);
      const epPrimaryBadge = resolvePrimaryBadgeFromRecentBadges(epBadges);
      return {
        animeId: anime.id,
        animeTitle,
        animeAltTitles: altTitles,
        animeCover: anime.cover,
        animeBanner: anime.banner || anime.cover,
        seasonId: item.season.id,
        seasonNumber: item.seasonNumber,
        seasonTitle: item.season.title || `Temporada ${item.seasonNumber}`,
        episodeId: item.ep.id,
        episodeNumber: item.episodeNumber,
        episodeTitle: item.ep.title || `Episódio ${item.episodeNumber}`,
        thumbnail: item.resolvedThumb,
        duration: item.ep.duration?.trim() || undefined,
        videoUrl: item.validVideo,
        ...(item.validHikariId
          ? { hikariPlayerEpisodeId: item.validHikariId }
          : {}),
        publishedAt,
        published: item.ep.published === true,
        publishedTimestamp: parseEpisodePublicationTimestamp(
          epWithPublishedAt.publishedAt,
        ),
        badge: epPrimaryBadge,
        recentBadges: epBadges,
        ...(item.ep.audio ? { audio: item.ep.audio } : {}),
        ...(item.ep.audioVersion ? { audioVersion: item.ep.audioVersion } : {}),
      };
    };

    if (publishedList.length >= 50) {
      // Regra obrigatória (>= 50 episódios publicados): apenas Episódio 1 e Episódio final publicado
      const firstEpItem =
        publishedList.find((item) => item.seasonNumber === 1 && item.episodeNumber === 1) ??
        publishedList.find((item) => item.episodeNumber === 1) ??
        publishedList[0];
      const latestEpItem = publishedList[publishedList.length - 1];

      result.push(
        buildItem(
          firstEpItem,
          createTime + firstEpItem.seasonNumber * 1000 + firstEpItem.episodeNumber,
        ),
      );

      if (
        latestEpItem &&
        latestEpItem.ep.id !== firstEpItem.ep.id &&
        !(
          latestEpItem.seasonNumber === firstEpItem.seasonNumber &&
          latestEpItem.episodeNumber === firstEpItem.episodeNumber
        )
      ) {
        result.push(
          buildItem(
            latestEpItem,
            baseTime + latestEpItem.seasonNumber * 1000 + latestEpItem.episodeNumber,
          ),
        );
      }
      continue;
    }

    // < 50 episódios publicados: mantém o comportamento atual sem auto-ativar selos
    const firstEpItem = publishedList.find(
      (item) => item.seasonNumber === 1 && item.episodeNumber === 1,
    );
    const latestEpItem = publishedList[publishedList.length - 1];

    if (publishedList.length === 1 && firstEpItem) {
      result.push(buildItem(firstEpItem, createTime + 1000 + 1));
      continue;
    }

    if (firstEpItem) {
      result.push(buildItem(firstEpItem, createTime + 1000 + 1));
    }

    if (
      latestEpItem &&
      (!firstEpItem || latestEpItem.ep.id !== firstEpItem.ep.id)
    ) {
      result.push(
        buildItem(
          latestEpItem,
          baseTime + latestEpItem.seasonNumber * 1000 + latestEpItem.episodeNumber,
        ),
      );
    }
  }

  // Ordena do mais recente para o mais antigo
  return result.sort((a, b) => b.publishedAt - a.publishedAt);
}

/**
 * Extrai todos os episódios efetivamente publicados no Hikari pelo administrador,
 * ordenados do mais recente para o mais antigo.
 * Não inclui episódios do catálogo do AniList/MAL que não foram publicados no Hikari.
 */
export function getAllPublishedEpisodes(animes: LocalAnime[]): PublishedEpisode[] {
  const list: PublishedEpisode[] = [];

  for (const anime of animes) {
    if (anime.hidden) continue;

    const animeTitle = resolveAnimeCanonicalTitle(anime);
    const altTitles = resolveAnimeAltTitles(anime, animeTitle);
    const baseTime = anime.updatedAt || anime.createdAt || 0;

    for (const season of anime.seasons || []) {
      for (const ep of season.episodes || []) {
        // Exibe apenas episódios genuinamente publicados e configurados pelo administrador
        if (!isEpisodePublished(ep)) {
          continue;
        }

        // Obtém o primeiro player válido configurado
        const validVideo = [
          ep.videoUrl,
          ep.videoUrl2,
          ep.videoUrl3,
          ep.videoUrl4,
          ep.videoUrl5,
        ].find(isHikariPlayableUrl);
        const validHikariId = normalizeHikariPlayerEpisodeId(
          ep.hikariPlayerEpisodeId,
        );
        const hasValidHikariSource =
          buildHikariPlayerEpisodeUrl(validHikariId) !== null;

        // O peso de ordenação prioriza a atualização do anime + temporada + número
        const epTime = baseTime + season.number * 1000 + ep.number;
        const resolvedThumb = resolveEpisodeThumbnailUrl(ep);
        const epWithPublishedAt = ep as Episode & {
          publishedAt?: string | number | null;
        };
        const epBadges = normalizeAnimeRecentBadges(ep.recentBadges);
        const epPrimaryBadge = resolvePrimaryBadgeFromRecentBadges(epBadges);

        list.push({
          animeId: anime.id,
          animeTitle,
          animeAltTitles: altTitles,
          animeCover: anime.cover,
          animeBanner: anime.banner || anime.cover,
          seasonId: season.id,
          seasonNumber: season.number,
          seasonTitle: season.title || `Temporada ${season.number}`,
          episodeId: ep.id,
          episodeNumber: ep.number,
          episodeTitle: ep.title || `Episódio ${ep.number}`,
          thumbnail: resolvedThumb,
          duration: ep.duration ? ep.duration.trim() : undefined,
          videoUrl: validVideo || undefined,
          ...(hasValidHikariSource && validHikariId
            ? { hikariPlayerEpisodeId: validHikariId }
            : {}),
          publishedAt: epTime,
          published: ep.published === true,
          publishedTimestamp: parseEpisodePublicationTimestamp(
            epWithPublishedAt.publishedAt,
          ),
          badge: epPrimaryBadge,
          recentBadges: epBadges,
          ...(ep.audio ? { audio: ep.audio } : {}),
          ...(ep.audioVersion ? { audioVersion: ep.audioVersion } : {}),
        });
      }
    }
  }

  // Ordena do mais recente para o mais antigo
  return list.sort((a, b) => b.publishedAt - a.publishedAt);
}

/**
 * Resolve a lista completa de episódios publicados unindo os dados do PostgreSQL
 * com o fallback do catálogo local, aplicando rigorosamente as proteções da Etapa 3 e 4:
 * 1. O PostgreSQL é a fonte preferencial para episódios confirmados no servidor.
 * 2. Exclusões pendentes no Outbox são estritamente respeitadas (o episódio é ocultado).
 * 3. Tombstones órfãos sem exclusão ativa no Outbox NÃO ocultam episódios confirmados no banco.
 * 4. Episódios adicionais no catálogo local ainda não persistidos no banco são preservados.
 * 5. Não duplica episódios que existam em ambas as fontes para o mesmo slot (animeId, seasonNumber, episodeNumber).
 * 6. Preserva os IDs canônicos, 5 fontes de vídeo, miniaturas, duração e metadados.
 * 7. Nunca exibe rascunhos (published = false ou sem player válido).
 * 8. Quando o banco falhar ou estiver vazio, utiliza o catálogo local de forma segura e não destrutiva.
 */
export function resolvePublicEpisodes(
  serverResult?: PublicEpisodesResult | null,
  localAnimes?: LocalAnime[],
  options?: { outbox?: OutboxOperation[]; tombstones?: TombstoneRecord[] },
): PublishedEpisode[] {
  const safeLocals = Array.isArray(localAnimes) ? localAnimes : [];

  const outboxOps =
    options?.outbox !== undefined
      ? options.outbox
      : typeof window !== "undefined"
        ? readOutbox()
        : [];

  const tombstones =
    options?.tombstones !== undefined
      ? options.tombstones
      : typeof window !== "undefined"
        ? readTombstoneRecords()
        : [];

  const hasRemoteEpisodes = Boolean(
    serverResult &&
      (serverResult.status === "success" ||
        (!("status" in serverResult) && Array.isArray((serverResult as any).episodes))) &&
      Array.isArray(serverResult.episodes) &&
      serverResult.episodes.length > 0,
  );

  // Se o servidor retornou erro, ou está vazio sem episódios remotos, utiliza o fallback local seguro
  if (!hasRemoteEpisodes || !serverResult) {
    return getAllPublishedEpisodes(safeLocals).filter((ep) => {
      // Respeita exclusões pendentes na Outbox
      const isPendingDelete = outboxOps.some(
        (op) =>
          op.type === "delete" &&
          (op.episodeId === ep.episodeId ||
            (op.animeId === ep.animeId &&
              op.seasonNumber === ep.seasonNumber &&
              op.episodeNumber === ep.episodeNumber)),
      );
      if (isPendingDelete) return false;

      // Respeita tombstones válidos daquele anime
      const applicableTombstones = tombstones.filter(
        (t) => t.animeId === ep.animeId,
      );
      if (
        isEpisodeTombstoned(
          applicableTombstones,
          ep.animeId,
          ep.episodeId,
          ep.seasonNumber,
          ep.episodeNumber,
        )
      ) {
        return false;
      }

      return true;
    });
  }

  const remoteRows = serverResult.episodes;
  const result: PublishedEpisode[] = [];
  const processedSlots = new Set<string>();
  const processedIds = new Set<string>();

  // 1. Processa os episódios confirmados do PostgreSQL (fonte canônica)
  for (const row of remoteRows) {
    if (row.published !== true) continue; // Nunca exibe rascunho ou episódio sem aprovação explícita

    const sNum = row.seasonNumber || 1;
    const epNum = row.number;
    const slotKey = `${row.animeId}:${sNum}:${epNum}`;

    // Verifica se há exclusão intencional pendente no Outbox local
    const isPendingDelete = outboxOps.some(
      (op) =>
        op.type === "delete" &&
        (op.episodeId === row.id ||
          (op.animeId === row.animeId &&
            op.seasonNumber === sNum &&
            op.episodeNumber === epNum)),
    );
    if (isPendingDelete) {
      processedSlots.add(slotKey);
      processedIds.add(row.id);
      continue;
    }

    // Identifica primeira fonte de reprodução válida
    const validVideo = [
      row.videoUrl,
      row.videoUrl2,
      row.videoUrl3,
      row.videoUrl4,
      row.videoUrl5,
    ].find(isHikariPlayableUrl);
    const validHikariId = normalizeHikariPlayerEpisodeId(
      row.hikariPlayerEpisodeId,
    );
    const hasValidHikariSource =
      buildHikariPlayerEpisodeUrl(validHikariId) !== null;

    if (!validVideo && !hasValidHikariSource) continue; // Descarta se não houver stream reproduzível nem ID válido do Hikari Player

    const localAnime = safeLocals.find(
      (a) =>
        a.id === row.animeId ||
        a.serverCatalogId === row.animeId ||
        (a.anilistId !== undefined && String(a.anilistId) === row.animeId),
    );

    // Resolve títulos canônicos e variações alternativas
    const animeTitle =
      (localAnime ? resolveAnimeCanonicalTitle(localAnime) : null) ||
      row.animeTitle?.trim() ||
      row.animeTitleEnglish?.trim() ||
      row.animeTitleRomaji?.trim() ||
      "Anime";

    const altTitles = localAnime
      ? resolveAnimeAltTitles(localAnime, animeTitle)
      : Array.from(
          new Set(
            [
              animeTitle,
              row.animeTitleRomaji,
              row.animeTitleEnglish,
              row.animeTitleNative,
            ].filter((t): t is string => typeof t === "string" && Boolean(t.trim())),
          ),
        );

    // Verifica se há edição pendente no Outbox para este episódio
    const pendingUpsert = outboxOps.find(
      (op) =>
        op.type === "upsert" &&
        (op.episodeId === row.id ||
          (op.animeId === row.animeId &&
            op.seasonNumber === sNum &&
            op.episodeNumber === epNum)),
    );

    const episodeTitle =
      (pendingUpsert?.payload?.title as string)?.trim() ||
      row.title?.trim() ||
      `Episódio ${epNum}`;

    const animeCover =
      row.animeCover?.trim() || localAnime?.cover?.trim() || "";
    const animeBanner =
      row.animeBanner?.trim() || localAnime?.banner?.trim() || animeCover;

    const cloudinaryThumb = validVideo ? getCloudinaryThumbnail(validVideo) : null;
    const youtubeThumb = validVideo ? getYouTubeThumbnail(validVideo) : null;
    const pendingThumb = pendingUpsert?.payload?.thumbnail;
    const hasPendingThumbOverride =
      pendingUpsert?.payload !== undefined &&
      (pendingUpsert.payload.replaceThumbnail === true
        ? pendingThumb !== undefined
        : Boolean(typeof pendingThumb === "string" && pendingThumb.trim()));
    const manualThumb = hasPendingThumbOverride
      ? sanitizeEpisodeThumbnailUrl(pendingThumb as string | null)
      : sanitizeEpisodeThumbnailUrl(row.thumbnail);
    const resolvedThumb =
      manualThumb ||
      cloudinaryThumb ||
      youtubeThumb ||
      undefined;

    const duration =
      (pendingUpsert?.payload?.duration as string)?.trim() ||
      row.duration?.trim() ||
      undefined;

    const localSeason = localAnime?.seasons?.find((s) => s.number === sNum);
    const localEp = localSeason?.episodes?.find((e) => e.number === epNum);
    const seasonTitle =
      row.seasonTitle?.trim() ||
      localSeason?.title ||
      `Temporada ${sNum}`;

    const realPublishedMs = parseEpisodePublicationTimestamp(row.publishedAt);
    const rawCreatedMs = parseEpisodePublicationTimestamp(row.createdAt);
    const publishedAt =
      realPublishedMs !== null
        ? realPublishedMs
        : rawCreatedMs !== null
          ? rawCreatedMs
          : Date.now();

    const serverEpBadges = normalizeAnimeRecentBadges({
      lancamento: row.badgeLancamento,
      novo: row.badgeNovo,
      final: row.badgeFinal,
    });
    const pendingBadgePatch = pendingUpsert?.payload?.recentBadges;
    const resolvedBadges =
      pendingBadgePatch === null
        ? normalizeAnimeRecentBadges(undefined)
        : pendingBadgePatch && typeof pendingBadgePatch === "object"
          ? normalizeAnimeRecentBadges({
              lancamento:
                typeof pendingBadgePatch.lancamento === "boolean"
                  ? pendingBadgePatch.lancamento
                  : serverEpBadges.lancamento,
              novo:
                typeof pendingBadgePatch.novo === "boolean"
                  ? pendingBadgePatch.novo
                  : serverEpBadges.novo,
              final:
                typeof pendingBadgePatch.final === "boolean"
                  ? pendingBadgePatch.final
                  : serverEpBadges.final,
            })
          : serverEpBadges;

    result.push({
      animeId: row.animeId,
      animeTitle,
      animeAltTitles: altTitles,
      animeCover,
      animeBanner,
      seasonId: `s-${row.animeId}-${sNum}`,
      seasonNumber: sNum,
      seasonTitle,
      episodeId: row.id,
      episodeNumber: epNum,
      episodeTitle,
      thumbnail: resolvedThumb,
      duration,
      videoUrl: validVideo ?? undefined,
      ...(hasValidHikariSource && validHikariId
        ? { hikariPlayerEpisodeId: validHikariId }
        : {}),
      publishedAt,
      published: row.published === true,
      publishedTimestamp: realPublishedMs,
      badge: resolvePrimaryBadgeFromRecentBadges(resolvedBadges),
      recentBadges: resolvedBadges,
      ...(localEp?.audio ? { audio: localEp.audio } : {}),
      ...(localEp?.audioVersion ? { audioVersion: localEp.audioVersion } : {}),
    });

    processedSlots.add(slotKey);
    processedIds.add(row.id);
  }

  // 2. Processa episódios locais adicionais que ainda não existem no PostgreSQL (offline / rascunhos publicados)
  for (const anime of safeLocals) {
    if (anime.hidden) continue;

    const animeTitle = resolveAnimeCanonicalTitle(anime);
    const altTitles = resolveAnimeAltTitles(anime, animeTitle);
    const baseTime = anime.updatedAt || anime.createdAt || 0;
    const applicableTombstones = tombstones.filter((t) => t.animeId === anime.id);

    for (const season of anime.seasons || []) {
      for (const ep of season.episodes || []) {
        if (!isEpisodePublished(ep)) continue;

        const slotKey = `${anime.id}:${season.number}:${ep.number}`;
        const serverAliasSlotKey = anime.serverCatalogId
          ? `${anime.serverCatalogId}:${season.number}:${ep.number}`
          : null;
        const anilistAliasSlotKey =
          anime.anilistId !== undefined
            ? `${anime.anilistId}:${season.number}:${ep.number}`
            : null;

        // Se já foi processado a partir do PostgreSQL (por id, serverCatalogId ou anilistId), não duplica
        if (
          processedSlots.has(slotKey) ||
          (serverAliasSlotKey && processedSlots.has(serverAliasSlotKey)) ||
          (anilistAliasSlotKey && processedSlots.has(anilistAliasSlotKey)) ||
          processedIds.has(ep.id)
        ) {
          continue;
        }

        // Verifica exclusão pendente no Outbox
        const isPendingDelete = outboxOps.some(
          (op) =>
            op.type === "delete" &&
            (op.episodeId === ep.id ||
              (op.animeId === anime.id &&
                op.seasonNumber === season.number &&
                op.episodeNumber === ep.number)),
        );
        if (isPendingDelete) continue;

        // Verifica tombstone
        if (
          isEpisodeTombstoned(
            applicableTombstones,
            anime.id,
            ep.id,
            season.number,
            ep.number,
          )
        ) {
          continue;
        }

        const validVideo = [
          ep.videoUrl,
          ep.videoUrl2,
          ep.videoUrl3,
          ep.videoUrl4,
          ep.videoUrl5,
        ].find(isHikariPlayableUrl);
        const validHikariId = normalizeHikariPlayerEpisodeId(
          ep.hikariPlayerEpisodeId,
        );
        const hasValidHikariSource =
          buildHikariPlayerEpisodeUrl(validHikariId) !== null;

        if (!validVideo && !hasValidHikariSource) continue;

        const resolvedThumb = resolveEpisodeThumbnailUrl(ep);

        const epTime = baseTime + season.number * 1000 + ep.number;
        const epWithPublishedAt = ep as Episode & {
          publishedAt?: string | number | null;
        };
        const epBadges = normalizeAnimeRecentBadges(ep.recentBadges);
        const epPrimaryBadge = resolvePrimaryBadgeFromRecentBadges(epBadges);

        result.push({
          animeId: anime.id,
          animeTitle,
          animeAltTitles: altTitles,
          animeCover: anime.cover,
          animeBanner: anime.banner || anime.cover,
          seasonId: season.id,
          seasonNumber: season.number,
          seasonTitle: season.title || `Temporada ${season.number}`,
          episodeId: ep.id,
          episodeNumber: ep.number,
          episodeTitle: ep.title || `Episódio ${ep.number}`,
          thumbnail: resolvedThumb,
          duration: ep.duration?.trim() || undefined,
          videoUrl: validVideo,
          ...(hasValidHikariSource && validHikariId
            ? { hikariPlayerEpisodeId: validHikariId }
            : {}),
          publishedAt: epTime,
          published: ep.published === true,
          publishedTimestamp: parseEpisodePublicationTimestamp(
            epWithPublishedAt.publishedAt,
          ),
          badge: epPrimaryBadge,
          recentBadges: epBadges,
          ...(ep.audio ? { audio: ep.audio } : {}),
          ...(ep.audioVersion ? { audioVersion: ep.audioVersion } : {}),
        });

        processedSlots.add(slotKey);
        processedIds.add(ep.id);
      }
    }
  }

  // 3. Ordena do mais recente para o mais antigo (sem auto-inferir LANÇAMENTO/NOVO/FINAL)
  return result.sort((a, b) => b.publishedAt - a.publishedAt);
}

function resolveCanonicalRecentAnimeGroupKey(
  ep: Pick<PublishedEpisode, "animeId" | "animeTitle">,
  localAnimes: LocalAnime[],
  remoteRows: PublicEpisodeRow[],
): string {
  const isDubbedTitle = (text?: string | null) =>
    Boolean(text && /\b(dub|dublado|dublada)\b/i.test(text));
  const epIsDubbed = isDubbedTitle(ep.animeTitle);

  const directLocal = localAnimes.find(
    (a) => a.id === ep.animeId || a.serverCatalogId === ep.animeId,
  );
  if (directLocal) {
    return directLocal.serverCatalogId || directLocal.id;
  }

  const anilistLocal = localAnimes.find((a) => {
    if (a.anilistId === undefined || String(a.anilistId) !== ep.animeId) {
      return false;
    }
    const localTitle = `${a.titleRomaji} ${a.titleEnglish} ${a.titleNative}`;
    return isDubbedTitle(localTitle) === epIsDubbed;
  });
  if (anilistLocal) {
    return anilistLocal.serverCatalogId || anilistLocal.id;
  }

  const matchingRemote = remoteRows.find((r) => r.animeId === ep.animeId);
  if (matchingRemote?.animeAnilistId) {
    const canonicalRemote = remoteRows.find(
      (r) =>
        r.animeAnilistId === matchingRemote.animeAnilistId &&
        !/^\d+$/.test(r.animeId) &&
        isDubbedTitle(r.animeTitle) === epIsDubbed,
    );
    if (canonicalRemote) {
      return canonicalRemote.animeId;
    }
    return `anilist:${matchingRemote.animeAnilistId}:${epIsDubbed ? "dub" : "sub"}`;
  }

  return ep.animeId;
}

/**
 * Retorna os episódios selecionados para a seção "Episódios Recentes":
 * - Animes com < 50 episódios publicados: mantém o comportamento atual.
 * - Animes com >= 50 episódios publicados: exibe apenas 2 registros (Episódio 1 e Episódio final publicado),
 *   identificados pela numeração real (seasonNumber, episodeNumber), omitindo intermediários.
 * - Selos manuais (LANÇAMENTO, NOVO, FINAL) nunca são inferidos automaticamente.
 */
export function resolvePublicRecentEpisodes(
  serverResult?: PublicEpisodesResult | null,
  localAnimes?: LocalAnime[],
  options?: { outbox?: OutboxOperation[]; tombstones?: TombstoneRecord[] },
): PublishedEpisode[] {
  const safeLocals = Array.isArray(localAnimes) ? localAnimes : [];
  const remoteRows = Array.isArray(serverResult?.episodes)
    ? serverResult.episodes
    : [];

  const all = resolvePublicEpisodes(serverResult, safeLocals, options);
  if (all.length === 0) return [];

  const epsByAnime = new Map<string, PublishedEpisode[]>();
  for (const ep of all) {
    const groupKey = resolveCanonicalRecentAnimeGroupKey(
      ep,
      safeLocals,
      remoteRows,
    );
    const list = epsByAnime.get(groupKey) ?? [];
    list.push(ep);
    epsByAnime.set(groupKey, list);
  }

  const selected: PublishedEpisode[] = [];

  for (const [, animeEps] of Array.from(epsByAnime.entries())) {
    // Deduplica por slot real (seasonNumber, episodeNumber) mantendo a entrada prioritária
    const dedupedBySlot = new Map<string, PublishedEpisode>();
    for (const ep of animeEps) {
      const sNum = ep.seasonNumber || 1;
      const slotKey = `${sNum}:${ep.episodeNumber}`;
      if (!dedupedBySlot.has(slotKey)) {
        dedupedBySlot.set(slotKey, ep);
      }
    }

    const uniqueEps = Array.from(dedupedBySlot.values()).sort(
      (a, b) =>
        (a.seasonNumber || 1) - (b.seasonNumber || 1) ||
        a.episodeNumber - b.episodeNumber,
    );

    if (uniqueEps.length === 0) continue;

    if (uniqueEps.length >= 50) {
      // Regra obrigatória (>= 50 episódios publicados): apenas Episódio 1 e Episódio final publicado
      const firstEp =
        uniqueEps.find((e) => e.seasonNumber === 1 && e.episodeNumber === 1) ??
        uniqueEps.find((e) => e.episodeNumber === 1) ??
        uniqueEps[0];
      const finalEp = uniqueEps[uniqueEps.length - 1];

      selected.push(firstEp);

      if (
        finalEp &&
        finalEp.episodeId !== firstEp.episodeId &&
        !(
          (finalEp.seasonNumber || 1) === (firstEp.seasonNumber || 1) &&
          finalEp.episodeNumber === firstEp.episodeNumber
        )
      ) {
        selected.push(finalEp);
      }
      continue;
    }

    // Animes com < 50 episódios publicados: mantém o comportamento atual
    selected.push(...uniqueEps);
  }

  // Ordena do mais recente para o mais antigo e limita aos 18 da vitrine
  return selected.sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 18);
}

/**
 * Remove repetições redundantes entre número e título do episódio
 * (ex.: "Episódio 25 – Episode 25" -> "Episódio 25",
 * ou "Attack on Titan - Episode 25 - The Wall" -> "Episódio 25 — The Wall",
 * ou "Kimetsu no Yaiba - Episode 26 - New Mission" -> "Episódio 26 — New Mission")
 */
export function cleanEpisodeDisplay(
  episodeNumber: number,
  rawTitle?: string,
  animeTitleOrTitles?: string | string[],
): string {
  if (!rawTitle) {
    return `Episódio ${episodeNumber}`;
  }

  let title = rawTitle.trim();

  // 1. Coleta todas as variações conhecidas dos nomes do anime
  const names = new Set<string>();
  const inputTitles = Array.isArray(animeTitleOrTitles)
    ? animeTitleOrTitles
    : animeTitleOrTitles
      ? [animeTitleOrTitles]
      : [];

  for (const a of inputTitles) {
    if (!a || typeof a !== "string") continue;
    const clean = a.trim();
    if (clean) {
      names.add(clean);
      if (clean.includes(":")) names.add(clean.split(":")[0].trim());
      if (clean.includes(" - ")) names.add(clean.split(" - ")[0].trim());
      if (clean.includes(" (")) names.add(clean.split(" (")[0].trim());
      if (clean.includes(" [")) names.add(clean.split(" [")[0].trim());
    }
  }

  // Remove o nome do anime se estiver no início ou final do título do episódio
  for (const name of Array.from(names).sort((a, b) => b.length - a.length)) {
    if (!name || name.length < 2) continue;
    if (title.toLowerCase() === name.toLowerCase()) {
      return `Episódio ${episodeNumber}`;
    }
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    title = title.replace(new RegExp(`^${escaped}\\s*[-–—:·]*\\s*`, "i"), "").trim();
    title = title.replace(new RegExp(`\\s*[-–—:·]*\\s*${escaped}$`, "i"), "").trim();
    title = title.replace(new RegExp(`[\\(\\[]${escaped}[\\)\\]]`, "i"), "").trim();
  }

  // 2. Remove pontuações e prefixos de Temporada / Season: ex. "Season 1", "Temporada 1", "S1", "T1"
  title = title.replace(/^[-–—:/|.,·()[\]{}\s]+/, "").trim();
  title = title.replace(/^(?:season|temporada|s|t)\s*\d+\s*[-–—:·xX/|\s]*/i, "").trim();

  // 3. Loop para remover tokens repetidos de episódio no início:
  // "Episode 25", "Episódio 25", "Ep 25", "EP. 25", "E25", "Capítulo 25", "#25", "(Episode 25)", ou "25 -", "01."
  const epTokenRegex = new RegExp(
    `^(?:[([{\\s]*(?:epis[oó]dio|episode|ep\\.?|cap[ií]tulo|e)\\s*0*${episodeNumber}[)}\\]\\s]*|[([{\\s]*#\\s*0*${episodeNumber}[)}\\]\\s]*|[([{\\s]*0*${episodeNumber}[)}\\]\\s]*)\\s*[-–—:·xX/|\\s.]*`,
    "i",
  );
  let prev = "";
  while (title && prev !== title && epTokenRegex.test(title)) {
    prev = title;
    title = title.replace(epTokenRegex, "").trim();
  }

  // Remove tokens genéricos residuais como "Episódio 1 - Episódio 1" ou "Ep. 01"
  const genericEpTokenRegex = /^(?:[([{\s]*(?:epis[oó]dio|episode|ep\.?|cap[ií]tulo)\s*\d*[)}\]\s]*)\s*[-–—:·xX/|\s.]*/i;
  prev = "";
  while (title && prev !== title && genericEpTokenRegex.test(title)) {
    prev = title;
    title = title.replace(genericEpTokenRegex, "").trim();
  }

  // 4. Remove duplicações residuais no final da string (ex.: "- Episode 25", "(Episode 25)")
  title = title.replace(/[-–—:·]\s*(?:epis[oó]dio|episode|ep\.?)\s*0*\d*$/i, "").trim();
  title = title.replace(/^[-–—:/|.,·\s"'\\]+/, "").replace(/[-–—:/|.,·\s"'\\]+$/, "").trim();

  // 5. Se o título resultante for vazio, for apenas o número ou palavras de episódio
  if (
    !title ||
    title === String(episodeNumber) ||
    title === `0${episodeNumber}` ||
    /^[([{\s]*0*\d+[)}\]\s]*$/.test(title) ||
    new RegExp(`^[([{\\s]*(?:epis[oó]dio|episode|ep\\.?|cap[ií]tulo|e)\\s*0*${episodeNumber}[)}\\]\\s]*$`, "i").test(title) ||
    new RegExp(`^[([{\\s]*(?:epis[oó]dio|episode|ep\\.?|cap[ií]tulo|e)[)}\\]\\s]*$`, "i").test(title)
  ) {
    return `Episódio ${episodeNumber}`;
  }

  // 6. Retorna o número e o título correto e único do episódio sem repetições
  return `Episódio ${episodeNumber} — ${title}`;
}


function formatTimestampLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function isHlsStreamUrl(url: string): boolean {
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://hikari.local");
    return (
      parsed.pathname.toLowerCase().endsWith(".m3u8") ||
      parsed.search.toLowerCase().includes(".m3u8")
    );
  } catch {
    return /\.m3u8(\?|$)/i.test(url);
  }
}

async function probeImageCandidateUrl(
  url: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; width: number; height: number }> {
  if (typeof window === "undefined") {
    return { ok: true, width: 640, height: 360 };
  }
  if (signal?.aborted) {
    return { ok: false, width: 0, height: 0 };
  }

  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;

    const finish = (ok: boolean, width = 0, height = 0) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      img.onload = null;
      img.onerror = null;
      resolve({ ok, width, height });
    };

    const onAbort = () => finish(false);
    const timer = window.setTimeout(() => finish(false), 7000);

    signal?.addEventListener("abort", onAbort, { once: true });
    img.onload = () => {
      // YouTube retorna placeholder 120x90 quando não há miniatura para aquele slot
      const valid = img.naturalWidth > 120 && img.naturalHeight > 90;
      finish(valid, img.naturalWidth, img.naturalHeight);
    };
    img.onerror = () => finish(false);
    img.src = url;
  });
}

function computeFrameSignature(
  video: HTMLVideoElement,
  sampleCanvas: HTMLCanvasElement,
): { signature: Uint8Array; isBlank: boolean } {
  const sw = 16;
  const sh = 9;
  sampleCanvas.width = sw;
  sampleCanvas.height = sh;
  const sCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!sCtx) {
    return { signature: new Uint8Array(sw * sh), isBlank: false };
  }
  sCtx.drawImage(video, 0, 0, sw, sh);
  const data = sCtx.getImageData(0, 0, sw, sh).data;
  const signature = new Uint8Array(sw * sh);
  let sum = 0;
  for (let i = 0; i < sw * sh; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    signature[i] = lum;
    sum += lum;
  }
  const mean = sum / signature.length;
  let varianceSum = 0;
  for (let i = 0; i < signature.length; i++) {
    const diff = signature[i] - mean;
    varianceSum += diff * diff;
  }
  const stdDev = Math.sqrt(varianceSum / signature.length);
  const isBlank = (mean < 12 && stdDev < 6) || stdDev < 3.5;
  return { signature, isBlank };
}

function isDuplicateSignature(candidate: Uint8Array, existing: Uint8Array[]): boolean {
  for (const prev of existing) {
    let totalDiff = 0;
    for (let i = 0; i < candidate.length; i++) {
      totalDiff += Math.abs(candidate[i] - prev[i]);
    }
    const meanAbsDiff = totalDiff / candidate.length;
    if (meanAbsDiff < 6.5) {
      return true;
    }
  }
  return false;
}

function buildSampleTimestamps(duration: number): number[] {
  if (!duration || !Number.isFinite(duration) || duration <= 0) {
    return [2, 8, 18, 35];
  }
  if (duration < 6) {
    return [0.25, 0.5, 0.75]
      .map((p) => Number((duration * p).toFixed(2)))
      .filter((t, i, arr) => t > 0 && t < duration && arr.indexOf(t) === i);
  }
  const minT = Math.min(4, duration * 0.08);
  const maxT = Math.max(minT + 1, duration - Math.min(4, duration * 0.06));
  const fractions = duration >= 90
    ? [0.08, 0.2, 0.36, 0.52, 0.68, 0.84]
    : [0.1, 0.25, 0.44, 0.64, 0.82];
  const seen = new Set<number>();
  const times: number[] = [];
  for (const f of fractions) {
    const t = Math.round(Math.min(Math.max(duration * f, minT), maxT) * 10) / 10;
    if (!seen.has(t)) {
      seen.add(t);
      times.push(t);
    }
  }
  return times;
}

async function seekAndCaptureMultipleFrames(
  sourceUrl: string,
  options?: {
    isHls?: boolean;
    maxCandidates?: number;
    signal?: AbortSignal;
  },
): Promise<VideoThumbnailCandidate[]> {
  const maxCandidates = options?.maxCandidates ?? 6;
  const signal = options?.signal;
  if (signal?.aborted) {
    throw new DOMException("Operação cancelada", "AbortError");
  }

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;

  let hlsInstance: { destroy: () => void } | null = null;
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (hlsInstance) {
      try {
        hlsInstance.destroy();
      } catch {
        // ignore
      }
      hlsInstance = null;
    }
    video.onloadedmetadata = null;
    video.onseeked = null;
    video.onerror = null;
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
  };

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("Tempo limite ao carregar metadados do vídeo."));
      }, 15000);

      const onAbort = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(new DOMException("Operação cancelada", "AbortError"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });

      const finishReady = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        resolve();
      };

      const finishErr = (msg: string) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        reject(new Error(msg));
      };

      video.onloadedmetadata = () => finishReady();
      video.onerror = () =>
        finishErr("Erro de conexão, formato ou política de CORS ao carregar o vídeo.");

      if (
        options?.isHls &&
        !video.canPlayType("application/vnd.apple.mpegurl")
      ) {
        void import("hls.js")
          .then(({ default: Hls }) => {
            if (cleaned || signal?.aborted) return;
            if (!Hls.isSupported()) {
              finishErr("Stream HLS (.m3u8) não suportado neste navegador.");
              return;
            }
            const hls = new Hls({
              enableWorker: false,
              xhrSetup: (xhr) => {
                xhr.withCredentials = sourceUrl.startsWith("/");
              },
            });
            hlsInstance = hls;
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal) {
                finishErr("Erro ao carregar fluxo HLS (.m3u8) para captura de quadros.");
              }
            });
            hls.loadSource(sourceUrl);
            hls.attachMedia(video);
          })
          .catch(() => {
            finishErr("Falha ao inicializar decodificador HLS (.m3u8).");
          });
      } else {
        video.src = sourceUrl;
      }
    });

    const timestamps = buildSampleTimestamps(video.duration);
    const canvas = document.createElement("canvas");
    const sampleCanvas = document.createElement("canvas");
    const width = 640;
    const aspect =
      video.videoHeight && video.videoWidth
        ? video.videoHeight / video.videoWidth
        : 9 / 16;
    const height = Math.max(180, Math.round(width * aspect));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Não foi possível inicializar o contexto 2D do Canvas.");
    }

    const candidates: VideoThumbnailCandidate[] = [];
    const fallbackBlobs: Array<{ time: number; blob: Blob }> = [];
    const signatures: Uint8Array[] = [];

    for (const targetTime of timestamps) {
      if (signal?.aborted) break;
      if (candidates.length >= maxCandidates) break;

      const seekOk = await new Promise<boolean>((resolve) => {
        let done = false;
        const seekTimer = window.setTimeout(() => {
          if (done) return;
          done = true;
          resolve(false);
        }, 6000);

        const onSeeked = () => {
          if (done) return;
          done = true;
          window.clearTimeout(seekTimer);
          resolve(true);
        };

        const onError = () => {
          if (done) return;
          done = true;
          window.clearTimeout(seekTimer);
          resolve(false);
        };

        video.addEventListener("seeked", onSeeked, { once: true });
        video.addEventListener("error", onError, { once: true });
        try {
          video.currentTime = targetTime;
        } catch {
          if (!done) {
            done = true;
            window.clearTimeout(seekTimer);
            resolve(false);
          }
        }
      });

      if (!seekOk || signal?.aborted) continue;

      // Garante que o frame esteja decodificado
      if (video.readyState < 2) {
        await new Promise((r) => window.setTimeout(r, 120));
      }

      const frameMeta = computeFrameSignature(video, sampleCanvas);

      ctx.drawImage(video, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85),
      );
      if (!blob) continue;

      if (frameMeta.isBlank) {
        fallbackBlobs.push({ time: targetTime, blob });
        continue;
      }

      if (isDuplicateSignature(frameMeta.signature, signatures)) {
        continue;
      }

      signatures.push(frameMeta.signature);
      const previewUrl = URL.createObjectURL(blob);
      candidates.push({
        id: `frame-${Math.round(targetTime * 10)}-${candidates.length}`,
        previewUrl,
        blob,
        source: "video-frame",
        label: formatTimestampLabel(targetTime),
        timeSeconds: targetTime,
      });
    }

    if (candidates.length === 0 && fallbackBlobs.length > 0) {
      const first = fallbackBlobs[0];
      candidates.push({
        id: `frame-fallback-${Math.round(first.time * 10)}`,
        previewUrl: URL.createObjectURL(first.blob),
        blob: first.blob,
        source: "video-frame",
        label: formatTimestampLabel(first.time),
        timeSeconds: first.time,
      });
    }

    return candidates;
  } finally {
    cleanup();
  }
}

/**
 * Extrai múltiplas opções reais e distintas de thumbnail a partir de uma URL de vídeo
 * (Cloudinary, YouTube, MP4/WebM direto ou HLS .m3u8 com fallback via `/api/video-proxy`).
 * Nunca retorna imagens duplicadas ou fictícias e nunca altera o estado salvo sem escolha do admin.
 */
export async function extractVideoThumbnailCandidates(
  videoUrl: string,
  options?: {
    maxCandidates?: number;
    signal?: AbortSignal;
  },
): Promise<{ candidates: VideoThumbnailCandidate[]; warning?: string }> {
  if (!videoUrl || typeof window === "undefined") {
    return {
      candidates: [],
      warning: "Ambiente sem DOM ou URL inválida para extração de quadros.",
    };
  }

  const trimmed = videoUrl.trim();
  if (!trimmed) {
    return { candidates: [] };
  }

  // 1. Cloudinary: múltiplas miniaturas reais em instantes distintos
  const cloudinaryRaw = getCloudinaryThumbnailCandidates(trimmed);
  if (cloudinaryRaw.length > 0) {
    const probed = await Promise.all(
      cloudinaryRaw.map(async (item) => ({
        item,
        probe: await probeImageCandidateUrl(item.previewUrl, options?.signal),
      })),
    );
    if (options?.signal?.aborted) {
      return { candidates: [] };
    }
    const valid = probed.filter((entry) => entry.probe.ok).map((entry) => entry.item);
    return {
      candidates: valid,
      warning:
        valid.length === 0
          ? "Nenhuma miniatura do Cloudinary respondeu para este vídeo."
          : undefined,
    };
  }

  // 2. YouTube: múltiplas miniaturas reais disponíveis para o vídeo
  const youtubeRaw = getYouTubeThumbnailCandidates(trimmed);
  if (youtubeRaw.length > 0) {
    const probed = await Promise.all(
      youtubeRaw.map(async (item) => ({
        item,
        probe: await probeImageCandidateUrl(item.previewUrl, options?.signal),
      })),
    );
    if (options?.signal?.aborted) {
      return { candidates: [] };
    }
    const valid = probed.filter((entry) => entry.probe.ok).map((entry) => entry.item);
    return {
      candidates: valid,
      warning:
        valid.length === 0
          ? "Nenhuma miniatura do YouTube pôde ser carregada para este link."
          : undefined,
    };
  }

  if (isLegacyAnitube22Ref(trimmed) || parseAnitube22PlayerUrl(trimmed) !== null) {
    return { candidates: [] };
  }

  // 3. Vídeo direto (MP4/WebM/R2) ou HLS (.m3u8)
  const isHls = isHlsStreamUrl(trimmed);
  try {
    const directCandidates = await seekAndCaptureMultipleFrames(trimmed, {
      isHls,
      maxCandidates: options?.maxCandidates ?? 6,
      signal: options?.signal,
    });
    if (directCandidates.length > 0) {
      return { candidates: directCandidates };
    }
  } catch (directErr) {
    if (options?.signal?.aborted) {
      return { candidates: [] };
    }
    console.warn("[extractVideoThumbnailCandidates] Extração direta falhou, tentando via proxy interno:", directErr);
  }

  // Fallback via proxy interno autenticado (para CORS estrito)
  try {
    const proxyUrl = `/api/video-proxy?url=${encodeURIComponent(trimmed)}`;
    const proxyCandidates = await seekAndCaptureMultipleFrames(proxyUrl, {
      isHls,
      maxCandidates: options?.maxCandidates ?? 6,
      signal: options?.signal,
    });
    if (proxyCandidates.length > 0) {
      return { candidates: proxyCandidates };
    }
    return {
      candidates: [],
      warning:
        "Não foi possível extrair quadros deste vídeo. Você pode informar uma URL de imagem manualmente.",
    };
  } catch (proxyErr) {
    if (options?.signal?.aborted) {
      return { candidates: [] };
    }
    return {
      candidates: [],
      warning:
        proxyErr instanceof Error
          ? proxyErr.message
          : "Captura automática indisponível por CORS, conexão ou formato do vídeo.",
    };
  }
}

/**
 * Captura um quadro (frame) representativo de um vídeo via HTML5 Video e Canvas,
 * retornando um Blob binário (JPEG).
 * - Se a requisição direta falhar por restrições de CORS no servidor remoto,
 *   tenta automaticamente via proxy interno `/api/video-proxy`.
 * - Posiciona em ~15% da duração ou 12-15 segundos para evitar telas pretas de aberturas.
 */
export async function captureVideoFrameBlob(
  videoUrl: string,
  timePercent: number = 0.15,
): Promise<Blob> {
  if (!videoUrl || typeof window === "undefined") {
    throw new Error("URL inválida ou ambiente sem DOM.");
  }

  // Tenta primeiro de forma direta; se falhar por CORS, tenta via proxy interno
  try {
    return await executeVideoFrameCapture(videoUrl, timePercent);
  } catch (directErr) {
    console.warn("[captureVideoFrame] Captura direta falhou, tentando via proxy interno:", directErr);
    const proxyUrl = `/api/video-proxy?url=${encodeURIComponent(videoUrl)}`;
    return await executeVideoFrameCapture(proxyUrl, timePercent);
  }
}

function executeVideoFrameCapture(
  url: string,
  timePercent: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    let isCleanedUp = false;
    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      window.clearTimeout(timeoutId);
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.remove();
    };

    const timeoutId: number = window.setTimeout(() => {
      cleanup();
      reject(new Error("Tempo limite excedido ao capturar o frame do vídeo (15s)."));
    }, 15000);

    video.onloadedmetadata = () => {
      const duration = video.duration;
      // Posiciona em ~15% da duração ou entre 8 e 40 segundos para evitar telas pretas/intros
      const targetTime =
        duration && isFinite(duration) && duration > 5
          ? Math.min(Math.max(duration * timePercent, 8), 40)
          : 2;
      video.currentTime = targetTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const width = 640;
        const aspect =
          video.videoHeight && video.videoWidth
            ? video.videoHeight / video.videoWidth
            : 9 / 16;
        const height = Math.round(width * aspect);
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          return reject(new Error("Não foi possível inicializar o contexto 2D do Canvas."));
        }

        ctx.drawImage(video, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Falha ao gerar arquivo de imagem a partir do canvas."));
            }
          },
          "image/jpeg",
          0.85,
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Erro de conexão ou política de CORS ao carregar o vídeo."));
    };

    video.src = url;
  });
}

/**
 * Envia um Blob de imagem para a rota de armazenamento persistente do servidor (/api/admin/upload-thumbnail).
 * Salva no Cloudflare R2 / S3 / Vercel Blob / Banco e retorna a URL permanente pública.
 */
export async function uploadThumbnailBlob(
  blob: Blob,
  filenamePrefix: string = "thumb",
): Promise<string> {
  const formData = new FormData();
  const safePrefix = filenamePrefix
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 30);
  const filename = `${safePrefix}-${Date.now()}.jpg`;
  formData.append("file", blob, filename);

  const token = getBearerToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch("/api/admin/upload-thumbnail", {
    method: "POST",
    credentials: "include",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: formData,
  });

  if (!res.ok) {
    let errMsg = `Falha no upload da miniatura (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) errMsg = data.error;
    } catch {
      // Ignora falha de parse do corpo de erro
    }
    throw new Error(errMsg);
  }

  const data = (await res.json()) as { url: string };
  if (!data.url) {
    throw new Error("O servidor não retornou a URL da miniatura.");
  }

  return data.url;
}

/**
 * Fluxo completo:
 * 1. Verifica se a URL já possui miniatura nativa (Cloudinary ou YouTube).
 * 2. Caso contrário, captura um quadro representativo do vídeo MP4 / R2 via Canvas.
 * 3. Envia a imagem para o armazenamento persistente (R2 / Banco), retornando apenas a URL final.
 */
export async function captureAndUploadThumbnail(
  videoUrl: string,
  options?: {
    episodeTitle?: string;
    timePercent?: number;
  },
): Promise<{ url: string }> {
  if (!videoUrl || typeof videoUrl !== "string") {
    throw new Error("URL de vídeo inválida.");
  }

  // 1. Otimização para serviços com miniaturas nativas por URL
  const cloudinaryThumb = getCloudinaryThumbnail(videoUrl);
  if (cloudinaryThumb) {
    return { url: cloudinaryThumb };
  }

  const youtubeThumb = getYouTubeThumbnail(videoUrl);
  if (youtubeThumb) {
    return { url: youtubeThumb };
  }

  // 2. Captura real de frame via HTML5 Canvas (com fallback de proxy para CORS)
  const blob = await captureVideoFrameBlob(videoUrl, options?.timePercent ?? 0.15);

  // 3. Upload e persistência permanente (sem Base64 no localStorage)
  const finalUrl = await uploadThumbnailBlob(
    blob,
    options?.episodeTitle || "episode-thumb",
  );

  return { url: finalUrl };
}

/**
 * Função legado para retrocompatibilidade.
 */
export async function captureVideoFrame(
  videoUrl: string,
  timePercent: number = 0.15,
): Promise<string> {
  const result = await captureAndUploadThumbnail(videoUrl, { timePercent });
  return result.url;
}

