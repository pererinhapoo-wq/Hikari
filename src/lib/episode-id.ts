import type { Episode, EpisodeAudio, Season } from "@/lib/types";

const EXTERNAL_EPISODE_ID_PATTERNS: RegExp[] = [
  /^kitsu-ep-/i,
  /^ep-(?:kitsu|anilist|mal)-/i,
  /^ep-\d+(?:-\d+)+$/i,
  /^\d+$/,
];

const DUB_MARKER_RE =
  /\b(?:dublado|dublada|dubbed|dub|dual\s*audio|audio\s*dual)\b/i;

export function createInternalEpisodeId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `e-${crypto.randomUUID()}`;
  }
  return `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Identifica IDs externos/compartilhados de catálogo (ex.: "kitsu-ep-50792-1",
 * fallbacks "ep-<animeId>-<num>" ou IDs numéricos puros) que NÃO devem ser
 * reutilizados como chave primária interna na duplicação para Dublado.
 */
export function isExternalEpisodeId(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  if (!trimmed) return false;
  return EXTERNAL_EPISODE_ID_PATTERNS.some((re) => re.test(trimmed));
}

export function isDubbedAnimeRecord(
  anime?: {
    id?: string | null;
    title?: string | null;
    titleRomaji?: string | null;
    titleEnglish?: string | null;
    titleNative?: string | null;
    duplicateOfId?: string | null;
    duplicate_of_id?: string | null;
  } | null,
): boolean {
  if (!anime) return false;
  const dupOf =
    typeof anime.duplicateOfId === "string"
      ? anime.duplicateOfId.trim()
      : typeof anime.duplicate_of_id === "string"
        ? anime.duplicate_of_id.trim()
        : "";
  if (dupOf && dupOf !== (anime.id?.trim() || "")) {
    return true;
  }
  return [
    anime.title,
    anime.titleRomaji,
    anime.titleEnglish,
    anime.titleNative,
  ].some((t) => typeof t === "string" && DUB_MARKER_RE.test(t));
}

export function generateUniqueEpisodeId(
  usedIds?: Iterable<string>,
  forbiddenIds?: Iterable<string>,
): string {
  const blocked = new Set<string>();
  if (usedIds) {
    for (const id of usedIds) {
      if (id) blocked.add(id);
    }
  }
  if (forbiddenIds) {
    for (const id of forbiddenIds) {
      if (id) blocked.add(id);
    }
  }

  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = createInternalEpisodeId();
    if (!blocked.has(candidate) && !isExternalEpisodeId(candidate)) {
      return candidate;
    }
  }
  return `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Clona temporadas e episódios para um novo cadastro Dublado independente,
 * gerando sempre um novo identificador interno exclusivo (`e-<uuid>`) por episódio,
 * preservando eventual `externalEpisodeId` em campo separado sem reutilizar IDs do Legendado.
 */
export function cloneSeasonsForDubbedAnime(
  seasons: Season[],
  options?: {
    forbiddenIds?: Iterable<string>;
    targetAnimeId?: string | null;
    sourceAnimeAnilistId?: number | null;
  },
): Season[] {
  const usedIds = new Set<string>();
  const forbidden = new Set<string>();

  if (options?.forbiddenIds) {
    for (const id of options.forbiddenIds) {
      if (id) forbidden.add(id);
    }
  }
  if (options?.targetAnimeId) {
    forbidden.add(options.targetAnimeId);
  }
  if (options?.sourceAnimeAnilistId) {
    forbidden.add(String(options.sourceAnimeAnilistId));
  }

  for (const s of seasons ?? []) {
    for (const ep of s?.episodes ?? []) {
      if (ep?.id) forbidden.add(ep.id);
    }
  }

  return (seasons ?? []).map((s) => ({
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `s-${crypto.randomUUID()}`
        : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    number: s.number,
    title: s.title,
    episodes: (s.episodes ?? []).map((e): Episode => {
      const nextId = generateUniqueEpisodeId(usedIds, forbidden);
      usedIds.add(nextId);

      const preservedExternalId =
        typeof e.externalEpisodeId === "string" && e.externalEpisodeId.trim()
          ? e.externalEpisodeId.trim()
          : isExternalEpisodeId(e.id)
            ? e.id.trim()
            : undefined;

      return {
        id: nextId,
        ...(preservedExternalId
          ? { externalEpisodeId: preservedExternalId }
          : {}),
        number: e.number,
        title: e.title,
        duration: e.duration,
        thumbnail: e.thumbnail,
        synopsis: e.synopsis,
        audio: "dub" as EpisodeAudio,
        videoUrl: "",
        videoUrl2: "",
        videoUrl3: "",
        videoUrl4: "",
        videoUrl5: "",
        hikariPlayerEpisodeId: undefined,
        recentBadges: { lancamento: false, novo: false, final: false },
        published: false,
      };
    }),
  }));
}
