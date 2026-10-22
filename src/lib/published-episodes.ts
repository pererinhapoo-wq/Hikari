import type { LocalAnime } from "@/lib/types";
import { displayTitle } from "@/lib/types";

export type PublishedEpisode = {
  animeId: string;
  animeTitle: string;
  animeCover: string;
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
 * Extrai todos os episódios cadastrados e publicados nos animes locais,
 * ordenados do mais recente para o mais antigo.
 */
export function getAllPublishedEpisodes(animes: LocalAnime[]): PublishedEpisode[] {
  const list: PublishedEpisode[] = [];

  for (const anime of animes) {
    if (anime.hidden) continue;

    const animeTitle = displayTitle({
      titles: {
        romaji: anime.titleRomaji,
        english: anime.titleEnglish,
        native: anime.titleNative,
      },
    });

    const baseTime = anime.updatedAt || anime.createdAt || 0;

    for (const season of anime.seasons || []) {
      for (const ep of season.episodes || []) {
        // Um episódio é considerado publicado se possui ID e número definidos
        // O peso de ordenação prioriza a atualização do anime + temporada + número
        const epTime = baseTime + (season.number * 1000) + ep.number;

        list.push({
          animeId: anime.id,
          animeTitle,
          animeCover: anime.cover,
          seasonId: season.id,
          seasonNumber: season.number,
          seasonTitle: season.title || `Temporada ${season.number}`,
          episodeId: ep.id,
          episodeNumber: ep.number,
          episodeTitle: ep.title || `Episódio ${ep.number}`,
          thumbnail: ep.thumbnail ? ep.thumbnail.trim() : undefined,
          duration: ep.duration ? ep.duration.trim() : undefined,
          videoUrl: ep.videoUrl || ep.videoUrl2 || ep.videoUrl3 || ep.videoUrl4 || ep.videoUrl5,
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
 * ou "Attack on Titan - Episode 25 - The Wall" -> "Episódio 25 — The Wall")
 */
export function cleanEpisodeDisplay(
  episodeNumber: number,
  rawTitle?: string,
  animeTitle?: string,
): string {
  if (!rawTitle) {
    return `Episódio ${episodeNumber}`;
  }

  let title = rawTitle.trim();

  // 1. Se o título for idêntico ao nome do anime ou contiver o nome do anime no início/fim, remove
  if (animeTitle) {
    const cleanAnime = animeTitle.trim();
    if (title.toLowerCase() === cleanAnime.toLowerCase()) {
      return `Episódio ${episodeNumber}`;
    }
    const escaped = cleanAnime.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    title = title.replace(new RegExp(`^${escaped}\\s*[-–—:]*\\s*`, "i"), "").trim();
    title = title.replace(new RegExp(`\\s*[-–—:]*\\s*${escaped}$`, "i"), "").trim();
  }

  // 2. Loop para remover tokens repetidos de episódio no início da string
  // Captura: "Episódio 25", "Episode 25", "Ep. 25", "Capítulo 25", "#25", ou "25 -"
  const epTokenRegex = /^(?:(?:epis[oó]dio|episode|ep\.?|cap[ií]tulo)\s*\d+|#\s*\d+|\b\d+\b)\s*[-–—:]*\s*/i;
  let prev = "";
  while (title && prev !== title && epTokenRegex.test(title)) {
    prev = title;
    title = title.replace(epTokenRegex, "").trim();
  }

  // 3. Remove traços, dois-pontos ou pontuações órfãs no início ou fim
  title = title.replace(/^[-–—:/|\s]+/, "").replace(/[-–—:/|\s]+$/, "").trim();

  // 4. Se o título resultante for vazio, ou se for apenas o número do episódio ou palavras como "Episode"/"Episódio"
  if (
    !title ||
    title === String(episodeNumber) ||
    new RegExp(`^(?:epis[oó]dio|episode|ep\\.?|cap[ií]tulo)\\s*${episodeNumber}$`, "i").test(title) ||
    new RegExp(`^(?:epis[oó]dio|episode|ep\\.?|cap[ií]tulo)$`, "i").test(title)
  ) {
    return `Episódio ${episodeNumber}`;
  }

  // 5. Retorna o número e o título único sem duplicidades
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
