import type { LocalAnime } from "@/lib/types";

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
 * 
 * Regras essenciais:
 * 1. O episódio deve ter ID e número válidos.
 * 2. Se `published === false`, é considerado rascunho/despublicado.
 * 3. O episódio DEVE ter ao menos um player de vídeo configurado (Player 1, 2, 3, 4 ou 5)
 *    com URL válida, descartando placeholders vazios do catálogo e links de terceiros.
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
 * Extrai todos os episódios efetivamente publicados no Hikari pelo administrador,
 * ordenados do mais recente para o mais antigo.
 * Não inclui episódios do catálogo do AniList/MAL que não foram publicados no Hikari.
 */
export function getAllPublishedEpisodes(animes: LocalAnime[]): PublishedEpisode[] {
  const list: PublishedEpisode[] = [];

  for (const anime of animes) {
    if (anime.hidden) continue;

    const animeTitle = resolveAnimeCanonicalTitle(anime);

    // Coleta todas as variações conhecidas do nome do anime (Romaji, Inglês, Nativo, etc.)
    const altTitles = Array.from(
      new Set(
        [
          animeTitle,
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

        // O peso de ordenação prioriza a atualização do anime + temporada + número
        const epTime = baseTime + (season.number * 1000) + ep.number;

        const cloudinaryThumb = validVideo ? getCloudinaryThumbnail(validVideo) : null;
        const youtubeThumb = validVideo ? getYouTubeThumbnail(validVideo) : null;
        const resolvedThumb = ep.thumbnail?.trim() || cloudinaryThumb || youtubeThumb || undefined;

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
        });
      }
    }
  }

  // Ordena do mais recente para o mais antigo
  return list.sort((a, b) => b.publishedAt - a.publishedAt);
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
 * Captura um quadro (frame) representativo de um vídeo via HTML5 Video e Canvas.
 * - Evita os primeiros segundos para não pegar telas pretas de abertura (mira em ~15% ou 15s).
 * - Se a origem bloquear leitura por CORS, a Promise é rejeitada de forma tratável.
 */
export async function captureVideoFrame(
  videoUrl: string,
  timePercent: number = 0.15,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!videoUrl || typeof window === "undefined") {
      return reject(new Error("URL inválida ou ambiente sem DOM"));
    }

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeAttribute("src");
      video.load();
      video.remove();
    };

    const timeoutId: number = window.setTimeout(() => {
      cleanup();
      reject(new Error("Tempo limite excedido ao capturar frame"));
    }, 12000);

    video.onloadedmetadata = () => {
      const duration = video.duration;
      // Posiciona em ~15% da duração ou 12 segundos para evitar telas pretas iniciais
      const targetTime =
        duration && isFinite(duration) && duration > 5
          ? Math.min(Math.max(duration * timePercent, 8), 45)
          : 2;
      video.currentTime = targetTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const width = 480;
        const aspect = (video.videoHeight && video.videoWidth) ? video.videoHeight / video.videoWidth : 9 / 16;
        const height = Math.round(width * aspect);
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          return reject(new Error("Não foi possível inicializar contexto do Canvas"));
        }

        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Erro ao carregar o vídeo para captura do frame"));
    };

    video.src = videoUrl;
  });
}
