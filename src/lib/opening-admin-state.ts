import type { LocalAnime } from "@/lib/types";
import type { OpeningLookupStatus, OpeningSourceId } from "@/lib/opening-providers";

export interface OpeningSuggestionEntry {
  seasonNumber: number;
  episodeNumber: number;
  found: boolean;
  startSeconds: number | null;
  endSeconds: number | null;
  startTime: string;
  endTime: string;
  source: OpeningSourceId | null;
  sourceLabel: string | null;
  confidence: number | null;
  submissionCount: number | null;
  status: OpeningLookupStatus;
  message?: string;
  remappedFrom?: {
    malId: number;
    episodeNumber: number;
    targetMalId: number;
    targetEpisodeNumber: number;
  };
}

export function getOpeningSuggestionKey(seasonNumber: number, episodeNumber: number): string {
  return `${Math.max(1, Math.trunc(seasonNumber))}:${Math.trunc(episodeNumber)}`;
}

/**
 * Converte duração exata ("MM:SS", "HH:MM:SS" ou segundos explícitos "1434s") para segundos.
 * Strings aproximadas em minutos inteiros ("24 min") retornam 0 para evitar falsos 404 na AniSkip.
 */
export function parseReliableEpisodeDurationSeconds(duration: string | null | undefined): number {
  if (!duration || typeof duration !== "string") return 0;
  const trimmed = duration.trim();
  if (!trimmed) return 0;

  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [m, s] = trimmed.split(":").map((n) => parseInt(n, 10));
    if (Number.isFinite(m) && Number.isFinite(s) && s >= 0 && s < 60) {
      return m * 60 + s;
    }
  }

  if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) {
    const [h, m, s] = trimmed.split(":").map((n) => parseInt(n, 10));
    if (Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(s) && m < 60 && s < 60) {
      return h * 3600 + m * 60 + s;
    }
  }

  const explicitSec = trimmed.match(/^(\d{2,5})\s*(?:s|seg|sec|segundos?)$/i);
  if (explicitSec) {
    const val = parseInt(explicitSec[1], 10);
    return Number.isFinite(val) && val > 0 ? val : 0;
  }

  return 0;
}

/**
 * Mescla sugestões carregadas no mapa da UI sem tocar nos timestamps do formulário nem em dirtyEpisodeIds.
 */
export function mergeLoadedOpeningSuggestions(
  prev: Record<string, OpeningSuggestionEntry>,
  incoming: Record<string, OpeningSuggestionEntry>,
): Record<string, OpeningSuggestionEntry> {
  return {
    ...prev,
    ...incoming,
  };
}

/**
 * Aplica explicitamente uma sugestão aprovada ao episódio alvo e garante o registro do episodeId
 * no conjunto `dirtyEpisodeIds` para persistência no servidor.
 */
export function applyOpeningSuggestionToAnime(
  anime: LocalAnime,
  dirtyEpisodeIds: Set<string>,
  seasonId: string,
  episodeId: string,
  startSeconds: number | null,
  endSeconds: number | null,
): LocalAnime {
  if (
    typeof startSeconds !== "number" ||
    !Number.isFinite(startSeconds) ||
    typeof endSeconds !== "number" ||
    !Number.isFinite(endSeconds) ||
    startSeconds < 0 ||
    endSeconds <= startSeconds
  ) {
    return anime;
  }

  const nextStart = Math.round(startSeconds);
  const nextEnd = Math.round(endSeconds);
  let matched = false;

  const nextSeasons = anime.seasons.map((season) => {
    if (season.id !== seasonId) return season;
    return {
      ...season,
      episodes: season.episodes.map((ep) => {
        if (ep.id !== episodeId) return ep;
        matched = true;
        return {
          ...ep,
          openingStartSeconds: nextStart,
          openingEndSeconds: nextEnd,
        };
      }),
    };
  });

  if (!matched) return anime;
  dirtyEpisodeIds.add(episodeId);
  return {
    ...anime,
    seasons: nextSeasons,
  };
}

/**
 * Descarta uma sugestão da interface sem alterar nenhum timestamp existente no episódio nem dirtyEpisodeIds.
 */
export function discardOpeningSuggestion(
  suggestions: Record<string, OpeningSuggestionEntry>,
  seasonNumber: number,
  episodeNumber: number,
): Record<string, OpeningSuggestionEntry> {
  const key = getOpeningSuggestionKey(seasonNumber, episodeNumber);
  const legacyKey = String(episodeNumber);
  if (!(key in suggestions) && !(legacyKey in suggestions)) {
    return suggestions;
  }
  const next = { ...suggestions };
  delete next[key];
  delete next[legacyKey];
  return next;
}
