import {
  normalizeHikariPlayerEpisodeId,
  validateHikariPlayerEpisodeId,
} from "./hikari-player";
import { sanitizeEpisodeThumbnailUrl } from "./published-episodes";

export type EpisodeThumbnailOrigin = "empty" | "hikari-player" | "manual";

export type HikariPlayerThumbLookupStatus =
  | "idle"
  | "loading"
  | "imported"
  | "no_image"
  | "not_found"
  | "error";

export interface HikariPlayerThumbStatusEntry {
  status: HikariPlayerThumbLookupStatus;
  episodeIdRequested: string;
  message: string;
  preservedManual?: boolean;
}

export const HIKARI_PLAYER_CLIENT_TIMEOUT_MS = 5000;

export const HIKARI_PLAYER_THUMB_MESSAGES = {
  loading: "Buscando imagem no Hikari Player...",
  imported: "Imagem importada do Hikari Player.",
  importedManualPreserved:
    "Imagem encontrada no Hikari Player, mas a thumbnail manual atual foi mantida.",
  no_image: "Este episódio ainda não possui imagem no Player.",
  not_found: "Episódio não encontrado no Hikari Player.",
  error:
    "Não foi possível buscar a imagem. Você pode continuar o cadastro normalmente.",
} as const;

export function resolveInitialThumbnailOrigin(
  thumbnail?: string | null,
): EpisodeThumbnailOrigin {
  return thumbnail && thumbnail.trim().length > 0 ? "manual" : "empty";
}

/**
 * Determina se uma thumbnail retornada pelo Hikari Player pode preencher
 * automaticamente o campo de imagem do episódio.
 *
 * Regras de proteção contra sobrescrita:
 * - Se a thumbnail estiver vazia -> permite preenchimento automático.
 * - Se a thumbnail atual tiver origem `"hikari-player"` -> permite atualizar ao trocar o ID.
 * - Se a thumbnail tiver origem `"manual"` (ou existir sem origem automática explícita) -> nunca sobrescreve.
 */
export function canAutoApplyHikariPlayerThumbnail(
  currentThumbnail: string | null | undefined,
  origin: EpisodeThumbnailOrigin | undefined,
): boolean {
  const hasThumbnail = Boolean(currentThumbnail && currentThumbnail.trim().length > 0);
  if (!hasThumbnail) {
    return true;
  }
  return origin === "hikari-player";
}

export interface HikariPlayerThumbnailLookupCallbacks {
  getCurrentEpisodeId: (episodeKey: string) => string | null;
  getCurrentThumbnailState: (episodeKey: string) => {
    thumbnail?: string | null;
    origin?: EpisodeThumbnailOrigin;
  };
  onStatusChange: (
    episodeKey: string,
    status: HikariPlayerThumbStatusEntry | undefined,
  ) => void;
  onApplyPoster: (
    episodeKey: string,
    posterUrl: string,
    requestedEpisodeId: string,
  ) => void;
  getAuthHeaders?: () => Record<string, string>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface EpisodeLookupSlot {
  seq: number;
  inFlightId: string | null;
  lastResolvedId: string | null;
  lastResolvedStatus: HikariPlayerThumbLookupStatus | null;
  controller: AbortController | null;
}

export interface HikariPlayerThumbnailManager {
  lookup: (
    episodeKey: string,
    rawHikariPlayerId: string | null | undefined,
    options?: { force?: boolean },
  ) => Promise<void>;
  cancel: (episodeKey: string, options?: { clearStatus?: boolean }) => void;
  dispose: () => void;
}

/**
 * Gerenciador de consultas automáticas de thumbnail no Hikari Player por episódio:
 * - Impede consultas duplicadas simultâneas para o mesmo ID.
 * - Cancela/descarta respostas antigas quando o ID muda rapidamente.
 * - Aplica timeout de ~5 segundos.
 * - Protege thumbnails manuais contra sobrescrita.
 */
export function createHikariPlayerThumbnailManager(
  callbacks: HikariPlayerThumbnailLookupCallbacks,
): HikariPlayerThumbnailManager {
  const slots = new Map<string, EpisodeLookupSlot>();
  let disposed = false;

  const getOrCreateSlot = (episodeKey: string): EpisodeLookupSlot => {
    let slot = slots.get(episodeKey);
    if (!slot) {
      slot = {
        seq: 0,
        inFlightId: null,
        lastResolvedId: null,
        lastResolvedStatus: null,
        controller: null,
      };
      slots.set(episodeKey, slot);
    }
    return slot;
  };

  const cancel = (
    episodeKey: string,
    options?: { clearStatus?: boolean },
  ): void => {
    const slot = slots.get(episodeKey);
    if (slot) {
      slot.seq += 1;
      slot.inFlightId = null;
      slot.lastResolvedId = null;
      slot.lastResolvedStatus = null;
      if (slot.controller) {
        slot.controller.abort();
        slot.controller = null;
      }
    }
    if (!disposed && options?.clearStatus) {
      callbacks.onStatusChange(episodeKey, undefined);
    }
  };

  const dispose = (): void => {
    disposed = true;
    for (const slot of slots.values()) {
      slot.seq += 1;
      slot.inFlightId = null;
      if (slot.controller) {
        slot.controller.abort();
        slot.controller = null;
      }
    }
    slots.clear();
  };

  const lookup = async (
    episodeKey: string,
    rawHikariPlayerId: string | null | undefined,
    options?: { force?: boolean },
  ): Promise<void> => {
    if (disposed) return;

    const validation = validateHikariPlayerEpisodeId(rawHikariPlayerId);
    if (!validation.valid || !validation.value) {
      cancel(episodeKey, { clearStatus: true });
      return;
    }

    const normalizedId = validation.value;
    const slot = getOrCreateSlot(episodeKey);

    // Evita consulta repetida enquanto uma requisição para o mesmo ID já está em andamento
    if (!options?.force && slot.inFlightId === normalizedId) {
      return;
    }

    // Evita reconsultar desnecessariamente em blur logo após já ter concluído para o mesmo ID
    if (
      !options?.force &&
      slot.inFlightId === null &&
      slot.lastResolvedId === normalizedId &&
      slot.lastResolvedStatus &&
      slot.lastResolvedStatus !== "error"
    ) {
      return;
    }

    // Cancela qualquer consulta anterior ainda em andamento para este episódio
    if (slot.controller) {
      slot.controller.abort();
      slot.controller = null;
    }

    slot.seq += 1;
    const requestSeq = slot.seq;
    slot.inFlightId = normalizedId;
    slot.lastResolvedId = null;
    slot.lastResolvedStatus = null;

    const controller = new AbortController();
    slot.controller = controller;

    callbacks.onStatusChange(episodeKey, {
      status: "loading",
      episodeIdRequested: normalizedId,
      message: HIKARI_PLAYER_THUMB_MESSAGES.loading,
    });

    const timeoutMs =
      typeof callbacks.timeoutMs === "number" &&
      Number.isFinite(callbacks.timeoutMs) &&
      callbacks.timeoutMs > 0
        ? callbacks.timeoutMs
        : HIKARI_PLAYER_CLIENT_TIMEOUT_MS;

    let timedOut = false;
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const isStillCurrent = (): boolean => {
      if (disposed) return false;
      const currentSlot = slots.get(episodeKey);
      if (!currentSlot || currentSlot.seq !== requestSeq) {
        return false;
      }
      const liveId = normalizeHikariPlayerEpisodeId(
        callbacks.getCurrentEpisodeId(episodeKey),
      );
      return liveId === normalizedId;
    };

    try {
      const fetchImpl = callbacks.fetchImpl ?? fetch;
      const headers: Record<string, string> = {
        Accept: "application/json",
        ...(callbacks.getAuthHeaders ? callbacks.getAuthHeaders() : {}),
      };

      const res = await fetchImpl(
        `/api/admin/hikari-player-episode/${encodeURIComponent(normalizedId)}`,
        {
          method: "GET",
          headers,
          credentials: "include",
          signal: controller.signal,
        },
      );

      if (!isStillCurrent()) {
        return;
      }

      if (res.status === 404) {
        slot.lastResolvedId = normalizedId;
        slot.lastResolvedStatus = "not_found";
        callbacks.onStatusChange(episodeKey, {
          status: "not_found",
          episodeIdRequested: normalizedId,
          message: HIKARI_PLAYER_THUMB_MESSAGES.not_found,
        });
        return;
      }

      if (
        res.status === 401 ||
        res.status === 403 ||
        res.status >= 500 ||
        !res.ok
      ) {
        slot.lastResolvedId = normalizedId;
        slot.lastResolvedStatus = "error";
        callbacks.onStatusChange(episodeKey, {
          status: "error",
          episodeIdRequested: normalizedId,
          message: HIKARI_PLAYER_THUMB_MESSAGES.error,
        });
        return;
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        if (!isStillCurrent()) return;
        slot.lastResolvedId = normalizedId;
        slot.lastResolvedStatus = "error";
        callbacks.onStatusChange(episodeKey, {
          status: "error",
          episodeIdRequested: normalizedId,
          message: HIKARI_PLAYER_THUMB_MESSAGES.error,
        });
        return;
      }

      if (!isStillCurrent()) {
        return;
      }

      const rawPosterUrl =
        data &&
        typeof data === "object" &&
        "poster_url" in data &&
        typeof (data as { poster_url?: unknown }).poster_url === "string"
          ? (data as { poster_url: string }).poster_url
          : null;
      const cleanPosterUrl = sanitizeEpisodeThumbnailUrl(rawPosterUrl);

      if (!cleanPosterUrl) {
        slot.lastResolvedId = normalizedId;
        slot.lastResolvedStatus = "no_image";
        callbacks.onStatusChange(episodeKey, {
          status: "no_image",
          episodeIdRequested: normalizedId,
          message: HIKARI_PLAYER_THUMB_MESSAGES.no_image,
        });
        return;
      }

      const currentThumb = callbacks.getCurrentThumbnailState(episodeKey);
      if (
        canAutoApplyHikariPlayerThumbnail(
          currentThumb.thumbnail,
          currentThumb.origin,
        )
      ) {
        callbacks.onApplyPoster(episodeKey, cleanPosterUrl, normalizedId);
        slot.lastResolvedId = normalizedId;
        slot.lastResolvedStatus = "imported";
        callbacks.onStatusChange(episodeKey, {
          status: "imported",
          episodeIdRequested: normalizedId,
          message: HIKARI_PLAYER_THUMB_MESSAGES.imported,
        });
      } else {
        slot.lastResolvedId = normalizedId;
        slot.lastResolvedStatus = "imported";
        callbacks.onStatusChange(episodeKey, {
          status: "imported",
          episodeIdRequested: normalizedId,
          preservedManual: true,
          message: HIKARI_PLAYER_THUMB_MESSAGES.importedManualPreserved,
        });
      }
    } catch {
      if (!isStillCurrent()) {
        return;
      }
      if (controller.signal.aborted && !timedOut) {
        return;
      }
      slot.lastResolvedId = normalizedId;
      slot.lastResolvedStatus = "error";
      callbacks.onStatusChange(episodeKey, {
        status: "error",
        episodeIdRequested: normalizedId,
        message: HIKARI_PLAYER_THUMB_MESSAGES.error,
      });
    } finally {
      clearTimeout(timeoutHandle);
      const currentSlot = slots.get(episodeKey);
      if (currentSlot && currentSlot.seq === requestSeq) {
        currentSlot.inFlightId = null;
        if (currentSlot.controller === controller) {
          currentSlot.controller = null;
        }
      }
    }
  };

  return {
    lookup,
    cancel,
    dispose,
  };
}
