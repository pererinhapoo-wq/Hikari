import type { LocalAnime } from "@/lib/types";
import { getBearerToken } from "@/lib/auth/client";
import { readOutbox, type OutboxOperation } from "@/lib/episode-writer";
import {
  readTombstoneRecords,
  isEpisodeTombstoned,
  type TombstoneRecord,
} from "@/lib/catalog-storage";
import type { PublicEpisodesResult } from "@/lib/catalog-episodes";

export type PublishedEpisodeBadge = "LANÇAMENTO" | "FINAL" | null;

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
  publishedAt: number;
  badge?: PublishedEpisodeBadge;
};

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

/**
 * Verifica se uma URL é um arquivo ou stream de mídia reproduzível no Hikari,
 * descartando páginas web externas de catálogo de terceiros (Crunchyroll, Funimation, etc.).
 */
export function isHikariPlayableUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "#" || trimmed.startsWith("javascript:")) return false;

  const lower = trimmed.toLowerCase();

  // Páginas web externas de catálogo e serviços de streaming que não fornecem arquivos diretos
  if (
    lower.includes("crunchyroll.com") ||
    lower.includes("funimation.com") ||
    lower.includes("vrv.co") ||
    lower.includes("netflix.com") ||
    lower.includes("hidive.com") ||
    lower.includes("hulu.com") ||
    lower.includes("tubitv.com") ||
    lower.includes("bilibili.tv") ||
    lower.includes("iq.com") ||
    lower.includes("iqiyi.com") ||
    lower.includes("disneyplus.com") ||
    lower.includes("primevideo.com") ||
    lower.includes("amazon.com") ||
    lower.includes("viz.com") ||
    lower.includes("adultswim.com") ||
    lower.includes("retrocrush.tv") ||
    lower.includes("starplus.com") ||
    lower.includes("max.com") ||
    lower.includes("hbomax.com") ||
    lower.includes("youtube.com/watch") ||
    lower.includes("youtu.be/") ||
    lower.includes("vimeo.com/") ||
    lower.includes("dailymotion.com") ||
    lower.includes("anilist.co") ||
    lower.includes("myanimelist.net") ||
    lower.includes("kitsu.io")
  ) {
    return false;
  }

  return true;
}

/**
 * Valida estritamente se uma URL é HTTP/HTTPS bem formada e aceita como fonte
 * reproduzível persistível pelo Hikari (alinhada à validação de `sanitizeVideoUrl` no servidor).
 */
export function isPersistablePlayableVideoUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "#") return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    if (!parsed.hostname) {
      return false;
    }
  } catch {
    return false;
  }

  return isHikariPlayableUrl(trimmed);
}

/**
 * Verifica se o episódio possui ao menos uma fonte de reprodução válida e persistível
 * entre Player 1 e Player 5.
 */
export function hasEpisodePlayableSource(ep: {
  videoUrl?: string | null;
  videoUrl2?: string | null;
  videoUrl3?: string | null;
  videoUrl4?: string | null;
  videoUrl5?: string | null;
}): boolean {
  return [
    ep.videoUrl,
    ep.videoUrl2,
    ep.videoUrl3,
    ep.videoUrl4,
    ep.videoUrl5,
  ].some(isPersistablePlayableVideoUrl);
}

/**
 * Deriva uma miniatura gerada automaticamente pelo Cloudinary quando o vídeo está hospedado lá.
 */
export function getCloudinaryThumbnail(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  if (!url.includes("cloudinary.com") || !url.includes("/upload/")) return null;
  try {
    return url
      .replace(/\/upload\/(?:so_[^,]+,?)?/, "/upload/so_15,w_640,c_scale/")
      .replace(/\.[a-zA-Z0-9]+$/i, ".jpg");
  } catch {
    return null;
  }
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
  published?: boolean;
}): boolean {
  if (!ep || !ep.id || typeof ep.number !== "number") {
    return false;
  }

  // Se explicitamente marcado como não publicado
  if (ep.published === false) {
    return false;
  }

  const sources = [
    ep.videoUrl,
    ep.videoUrl2,
    ep.videoUrl3,
    ep.videoUrl4,
    ep.videoUrl5,
  ];

  // Deve haver pelo menos uma fonte de vídeo real configurada pelo administrador
  const hasPlayableVideo = sources.some(isHikariPlayableUrl);

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

    // Coleta todos os episódios publicados deste anime
    const publishedList: {
      season: LocalAnime["seasons"][number];
      ep: LocalAnime["seasons"][number]["episodes"][number];
      seasonNumber: number;
      episodeNumber: number;
      validVideo: string;
      resolvedThumb?: string;
    }[] = [];

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

        if (!validVideo) continue;

        const cloudinaryThumb = getCloudinaryThumbnail(validVideo);
        const youtubeThumb = getYouTubeThumbnail(validVideo);
        const resolvedThumb = ep.thumbnail?.trim() || cloudinaryThumb || youtubeThumb || undefined;

        publishedList.push({
          season,
          ep,
          seasonNumber: season.number,
          episodeNumber: ep.number,
          validVideo,
          resolvedThumb,
        });
      }
    }

    if (publishedList.length === 0) continue;

    // Ordena do primeiro ao último cronológico
    publishedList.sort(
      (a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber,
    );

    // 1. Identifica o Episódio 1 do anime (Temporada 1, Episódio 1)
    const firstEpItem = publishedList.find(
      (item) => item.seasonNumber === 1 && item.episodeNumber === 1,
    );

    // 2. Identifica o último episódio publicado deste anime
    const latestEpItem = publishedList[publishedList.length - 1];

    // Se só tem 1 episódio publicado no total e for o Episódio 1:
    if (publishedList.length === 1 && firstEpItem) {
      result.push({
        animeId: anime.id,
        animeTitle,
        animeAltTitles: altTitles,
        animeCover: anime.cover,
        animeBanner: anime.banner || anime.cover,
        seasonId: firstEpItem.season.id,
        seasonNumber: firstEpItem.seasonNumber,
        seasonTitle: firstEpItem.season.title || `Temporada ${firstEpItem.seasonNumber}`,
        episodeId: firstEpItem.ep.id,
        episodeNumber: firstEpItem.episodeNumber,
        episodeTitle: firstEpItem.ep.title || `Episódio ${firstEpItem.episodeNumber}`,
        thumbnail: firstEpItem.resolvedThumb,
        duration: firstEpItem.ep.duration?.trim() || undefined,
        videoUrl: firstEpItem.validVideo,
        publishedAt: createTime + 1000 + 1,
        badge: "LANÇAMENTO",
      });
      continue;
    }

    // Se houver múltiplos episódios:
    // Regra 1: O anime deve aparecer em "LANÇAMENTO" apenas uma vez, associado ao episódio 1
    if (firstEpItem) {
      result.push({
        animeId: anime.id,
        animeTitle,
        animeAltTitles: altTitles,
        animeCover: anime.cover,
        animeBanner: anime.banner || anime.cover,
        seasonId: firstEpItem.season.id,
        seasonNumber: firstEpItem.seasonNumber,
        seasonTitle: firstEpItem.season.title || `Temporada ${firstEpItem.seasonNumber}`,
        episodeId: firstEpItem.ep.id,
        episodeNumber: firstEpItem.episodeNumber,
        episodeTitle: firstEpItem.ep.title || `Episódio ${firstEpItem.episodeNumber}`,
        thumbnail: firstEpItem.resolvedThumb,
        duration: firstEpItem.ep.duration?.trim() || undefined,
        videoUrl: firstEpItem.validVideo,
        publishedAt: createTime + 1000 + 1,
        badge: "LANÇAMENTO",
      });
    }

    // Regras 2, 3 e 4: Adiciona o último episódio publicado (se for diferente do Episódio 1)
    if (
      latestEpItem &&
      (!firstEpItem || latestEpItem.ep.id !== firstEpItem.ep.id)
    ) {
      const isFinal = isConfirmedFinalEpisode(
        anime,
        latestEpItem.seasonNumber,
        latestEpItem.episodeNumber,
        latestEpItem.ep.title,
      );

      result.push({
        animeId: anime.id,
        animeTitle,
        animeAltTitles: altTitles,
        animeCover: anime.cover,
        animeBanner: anime.banner || anime.cover,
        seasonId: latestEpItem.season.id,
        seasonNumber: latestEpItem.seasonNumber,
        seasonTitle: latestEpItem.season.title || `Temporada ${latestEpItem.seasonNumber}`,
        episodeId: latestEpItem.ep.id,
        episodeNumber: latestEpItem.episodeNumber,
        episodeTitle: latestEpItem.ep.title || `Episódio ${latestEpItem.episodeNumber}`,
        thumbnail: latestEpItem.resolvedThumb,
        duration: latestEpItem.ep.duration?.trim() || undefined,
        videoUrl: latestEpItem.validVideo,
        publishedAt: baseTime + latestEpItem.seasonNumber * 1000 + latestEpItem.episodeNumber,
        badge: isFinal ? "FINAL" : null,
      });
    }

    // Note: os episódios intermediários (do episódio 2 ao N-1) NÃO são incluídos na seção,
    // garantindo que cadastros em massa de dezenas ou centenas de episódios não monopolizem a vitrine.
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

    // Coleta episódios publicados para checar encerramento e primeiro episódio
    const publishedList: {
      seasonNumber: number;
      episodeNumber: number;
      epId: string;
      title?: string;
    }[] = [];

    for (const season of anime.seasons || []) {
      for (const ep of season.episodes || []) {
        if (!isEpisodePublished(ep)) continue;
        publishedList.push({
          seasonNumber: season.number,
          episodeNumber: ep.number,
          epId: ep.id,
          title: ep.title,
        });
      }
    }

    publishedList.sort(
      (a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber,
    );

    const firstEpId = publishedList.find(
      (p) => p.seasonNumber === 1 && p.episodeNumber === 1,
    )?.epId;

    const latestEp = publishedList[publishedList.length - 1];

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

        // O peso de ordenação prioriza a atualização do anime + temporada + número
        const epTime = baseTime + (season.number * 1000) + ep.number;

        const cloudinaryThumb = validVideo ? getCloudinaryThumbnail(validVideo) : null;
        const youtubeThumb = validVideo ? getYouTubeThumbnail(validVideo) : null;
        const resolvedThumb = ep.thumbnail?.trim() || cloudinaryThumb || youtubeThumb || undefined;

        let badge: PublishedEpisodeBadge = null;
        if (ep.id === firstEpId) {
          badge = "LANÇAMENTO";
        } else if (
          latestEp &&
          ep.id === latestEp.epId &&
          isConfirmedFinalEpisode(anime, latestEp.seasonNumber, latestEp.episodeNumber, latestEp.title)
        ) {
          badge = "FINAL";
        }

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
          videoUrl: validVideo || ep.videoUrl,
          publishedAt: epTime,
          badge,
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

  const hasRemoteEpisodes =
    serverResult &&
    serverResult.status === "success" &&
    Array.isArray(serverResult.episodes) &&
    serverResult.episodes.length > 0;

  // Se o servidor retornou erro, ou está vazio sem episódios remotos, utiliza o fallback local seguro
  if (!hasRemoteEpisodes) {
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
    if (row.published === false) continue; // Nunca exibe rascunho

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

    if (!validVideo) continue; // Descarta se não houver stream reproduzível

    const localAnime = safeLocals.find((a) => a.id === row.animeId);

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

    const cloudinaryThumb = getCloudinaryThumbnail(validVideo);
    const youtubeThumb = getYouTubeThumbnail(validVideo);
    const resolvedThumb =
      (pendingUpsert?.payload?.thumbnail as string)?.trim() ||
      row.thumbnail?.trim() ||
      cloudinaryThumb ||
      youtubeThumb ||
      undefined;

    const duration =
      (pendingUpsert?.payload?.duration as string)?.trim() ||
      row.duration?.trim() ||
      undefined;

    const seasonTitle =
      row.seasonTitle?.trim() ||
      localAnime?.seasons?.find((s) => s.number === sNum)?.title ||
      `Temporada ${sNum}`;

    const rawPublishedMs = row.publishedAt ? new Date(row.publishedAt).getTime() : NaN;
    const rawCreatedMs = row.createdAt ? new Date(row.createdAt).getTime() : NaN;
    const publishedAt = Number.isFinite(rawPublishedMs)
      ? rawPublishedMs
      : Number.isFinite(rawCreatedMs)
        ? rawCreatedMs
        : Date.now();

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
      videoUrl: validVideo,
      publishedAt,
      badge: null,
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

        // Se já foi processado a partir do PostgreSQL, não duplica
        if (processedSlots.has(slotKey) || processedIds.has(ep.id)) {
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

        if (!validVideo) continue;

        const cloudinaryThumb = getCloudinaryThumbnail(validVideo);
        const youtubeThumb = getYouTubeThumbnail(validVideo);
        const resolvedThumb =
          ep.thumbnail?.trim() || cloudinaryThumb || youtubeThumb || undefined;

        const epTime = baseTime + season.number * 1000 + ep.number;

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
          publishedAt: epTime,
          badge: null,
        });

        processedSlots.add(slotKey);
        processedIds.add(ep.id);
      }
    }
  }

  // 3. Atribui badges (LANÇAMENTO para S1 E1; FINAL para encerramento confirmado) por anime
  const epsByAnime = new Map<string, PublishedEpisode[]>();
  for (const ep of result) {
    const list = epsByAnime.get(ep.animeId) ?? [];
    list.push(ep);
    epsByAnime.set(ep.animeId, list);
  }

  for (const [animeId, animeEps] of Array.from(epsByAnime.entries())) {
    animeEps.sort(
      (a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber,
    );

    const firstEp = animeEps.find(
      (e) => e.seasonNumber === 1 && e.episodeNumber === 1,
    );
    if (firstEp) {
      firstEp.badge = "LANÇAMENTO";
    }

    const latestEp = animeEps[animeEps.length - 1];
    const localAnime = safeLocals.find((a) => a.id === animeId);
    const remoteRow = remoteRows.find((r) => r.animeId === animeId);

    const isFinished =
      (localAnime && isAnimeConfirmedFinished(localAnime)) ||
      (remoteRow?.animeStatus &&
        ["FINISHED", "ENCERRADO", "CONCLUÍDO", "CONCLUIDO"].includes(
          remoteRow.animeStatus.trim().toUpperCase(),
        ));

    if (latestEp && isFinished && (!firstEp || latestEp.episodeId !== firstEp.episodeId)) {
      const episodesCount =
        localAnime?.episodesCount ?? remoteRow?.animeEpisodesCount ?? null;

      let isFinal = false;
      if (typeof episodesCount === "number" && episodesCount > 0) {
        isFinal = latestEp.episodeNumber >= episodesCount;
      } else if (latestEp.episodeTitle) {
        isFinal = /\b(fim|final|o fim|the end|conclusão|conclusao|último episódio|ultimo episodio)\b/i.test(
          latestEp.episodeTitle,
        );
      }

      if (isFinal) {
        latestEp.badge = "FINAL";
      }
    }
  }

  // 4. Ordena do mais recente para o mais antigo
  return result.sort((a, b) => b.publishedAt - a.publishedAt);
}

/**
 * Retorna os episódios selecionados para a vitrine da Home ("Novos Episódios"),
 * respeitando as 5 regras de negócio para vitrines:
 * 1. LANÇAMENTO para o Episódio 1 (apenas uma vez por anime).
 * 2. Destaca o episódio mais recente publicado de cada anime.
 * 3. Selo FINAL somente quando o anime estiver confirmado como concluído.
 * 4. Evita que cadastros em massa de dezenas/centenas de episódios monopolizem a Home,
 *    omitindo episódios intermediários na Home (todos continuam disponíveis em /episodes).
 * 5. Limita a 18 episódios no total para manter a performance da vitrine.
 */
export function resolvePublicRecentEpisodes(
  serverResult?: PublicEpisodesResult | null,
  localAnimes?: LocalAnime[],
  options?: { outbox?: OutboxOperation[]; tombstones?: TombstoneRecord[] },
): PublishedEpisode[] {
  const all = resolvePublicEpisodes(serverResult, localAnimes, options);
  if (all.length === 0) return [];

  const epsByAnime = new Map<string, PublishedEpisode[]>();
  for (const ep of all) {
    const list = epsByAnime.get(ep.animeId) ?? [];
    list.push(ep);
    epsByAnime.set(ep.animeId, list);
  }

  const selected: PublishedEpisode[] = [];

  for (const [, animeEps] of Array.from(epsByAnime.entries())) {
    // Ordena do menor ao maior slot para identificar primeiro e último
    animeEps.sort(
      (a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber,
    );

    const firstEp = animeEps.find(
      (e) => e.seasonNumber === 1 && e.episodeNumber === 1,
    );
    const latestEp = animeEps[animeEps.length - 1];

    if (animeEps.length === 1 && firstEp) {
      selected.push(firstEp);
      continue;
    }

    if (firstEp) {
      selected.push(firstEp);
    }

    if (latestEp && (!firstEp || latestEp.episodeId !== firstEp.episodeId)) {
      selected.push(latestEp);
    }
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
    title = title.replace(new RegExp(`^${escaped}\\s*[-–—:]*\\s*`, "i"), "").trim();
    title = title.replace(new RegExp(`\\s*[-–—:]*\\s*${escaped}$`, "i"), "").trim();
    title = title.replace(new RegExp(`[\\(\\[]${escaped}[\\)\\]]`, "i"), "").trim();
  }

  // 2. Remove pontuações e prefixos de Temporada / Season: ex. "Season 1", "Temporada 1", "S1", "T1"
  title = title.replace(/^[-–—:/|.,()[\]{}\s]+/, "").trim();
  title = title.replace(/^(?:season|temporada|s|t)\s*\d+\s*[-–—:xX/|\s]*/i, "").trim();

  // 3. Loop para remover tokens repetidos de episódio no início:
  // "Episode 25", "Episódio 25", "Ep 25", "EP. 25", "E25", "Capítulo 25", "#25", "(Episode 25)", ou "25 -", "01."
  const epTokenRegex = new RegExp(
    `^(?:[([{\\s]*(?:epis[oó]dio|episode|ep\\.?|cap[ií]tulo|e)\\s*0*${episodeNumber}[)}\\]\\s]*|[([{\\s]*#\\s*0*${episodeNumber}[)}\\]\\s]*|[([{\\s]*0*${episodeNumber}[)}\\]\\s]*)\\s*[-–—:xX/|\\s.]*`,
    "i",
  );
  let prev = "";
  while (title && prev !== title && epTokenRegex.test(title)) {
    prev = title;
    title = title.replace(epTokenRegex, "").trim();
  }

  // Remove tokens genéricos residuais como "Episódio 1 - Episódio 1" ou "Ep. 01"
  const genericEpTokenRegex = /^(?:[([{\s]*(?:epis[oó]dio|episode|ep\.?|cap[ií]tulo)\s*\d*[)}\]\s]*)\s*[-–—:xX/|\s.]*/i;
  prev = "";
  while (title && prev !== title && genericEpTokenRegex.test(title)) {
    prev = title;
    title = title.replace(genericEpTokenRegex, "").trim();
  }

  // 4. Remove duplicações residuais no final da string (ex.: "- Episode 25", "(Episode 25)")
  title = title.replace(/[-–—:]\s*(?:epis[oó]dio|episode|ep\.?)\s*0*\d*$/i, "").trim();
  title = title.replace(/^[-–—:/|.,\s"'\\]+/, "").replace(/[-–—:/|.,\s"'\\]+$/, "").trim();

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

