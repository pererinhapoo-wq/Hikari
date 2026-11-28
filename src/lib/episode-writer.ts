import { z } from "zod";
import {
  isValidImageUrl,
  normalizeAnimeRecentBadges,
  normalizeEpisodeAudio,
  type AnimeRecentBadges,
  type Episode,
  type EpisodeAudio,
  type LocalAnime,
} from "@/lib/types";
import { getBearerToken } from "@/lib/auth/client";
import { addTombstone, clearTombstone } from "@/lib/catalog-storage";
import { invalidateCatalogEpisodesCache } from "@/lib/catalog-episodes";
import {
  normalizeHikariPlayerEpisodeId,
  validateHikariPlayerEpisodeId,
} from "@/lib/hikari-player";
import { isHikariPlayerIdThumbnailCandidate } from "@/lib/hikari-player-thumbnail";
import { stripCatalogImageVersion } from "@/lib/image-utils";
import { buildAdminCatalogAnimeSavePayload } from "@/lib/overlay";
import {
  hasEpisodePlayableSource,
  isPersistablePlayableVideoUrl,
  sanitizeEpisodeThumbnailUrl,
} from "@/lib/published-episodes";
import { ensureCatalogLoaded, useHikariStore } from "@/lib/store";
import {
  generateUniqueEpisodeId,
  isDubbedAnimeRecord,
  isExternalEpisodeId,
} from "@/lib/episode-id";
import { toast } from "sonner";

export const OUTBOX_STORAGE_KEY = "hikari-episode-outbox-v1";
const MAX_OUTBOX_SIZE = 40;

function buildAdminRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = typeof window !== "undefined" ? getBearerToken() : null;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export interface EpisodePayload {
  id: string;
  animeId: string;
  seasonNumber: number;
  number: number;
  title?: string | null;
  thumbnail?: string | null;
  duration?: string | null;
  synopsis?: string | null;
  videoUrl?: string | null;
  videoUrl2?: string | null;
  videoUrl3?: string | null;
  videoUrl4?: string | null;
  videoUrl5?: string | null;
  hikariPlayerEpisodeId?: string | null;
  audio?: EpisodeAudio | null;
  openingStartSeconds?: number | null;
  openingEndSeconds?: number | null;
  recentBadges?: Partial<AnimeRecentBadges> | null;
  published?: boolean;
  replaceSources?: boolean;
  replaceThumbnail?: boolean;
  animeTitle?: string | null;
  externalEpisodeId?: string | null;
}

export const episodePostSchema = z
  .object({
    id: z.string().trim().min(1, "id é obrigatório").max(128, "id muito longo"),
    animeId: z.string().trim().min(1, "animeId é obrigatório").max(128, "animeId muito longo"),
    seasonNumber: z.number().int().min(1, "seasonNumber deve ser >= 1").default(1),
    number: z.number().int().min(0, "number deve ser >= 0"),
    title: z.string().max(255).optional().nullable(),
    thumbnail: z.string().max(4096).optional().nullable(),
    duration: z.string().max(64).optional().nullable(),
    synopsis: z.string().max(10000).optional().nullable(),
    videoUrl: z.string().max(2048).optional().nullable(),
    videoUrl2: z.string().max(2048).optional().nullable(),
    videoUrl3: z.string().max(2048).optional().nullable(),
    videoUrl4: z.string().max(2048).optional().nullable(),
    videoUrl5: z.string().max(2048).optional().nullable(),
    hikariPlayerEpisodeId: z.string().max(255).optional().nullable(),
    externalEpisodeId: z.string().max(128).optional().nullable(),
    audio: z
      .preprocess((val) => {
        if (val === undefined) return undefined;
        if (val === null) return null;
        if (typeof val === "string" && val.trim() === "") return null;
        return normalizeEpisodeAudio(val) ?? val;
      }, z.enum(["sub", "dub"]).nullable())
      .optional(),
    openingStartSeconds: z
      .number()
      .int()
      .min(0, "Início da opening não pode ser negativo")
      .optional()
      .nullable(),
    openingEndSeconds: z
      .number()
      .int()
      .min(0, "Fim da opening não pode ser negativo")
      .optional()
      .nullable(),
    recentBadges: z
      .object({
        lancamento: z.boolean().optional(),
        novo: z.boolean().optional(),
        final: z.boolean().optional(),
      })
      .optional()
      .nullable(),
    published: z.boolean().default(false),
    replaceSources: z.boolean().optional().default(false),
    replaceThumbnail: z.boolean().optional().default(false),
    animeTitle: z.string().max(255).optional().nullable(),
    sources: z
      .array(
        z.object({
          provider: z.string().trim().max(64).optional(),
          externalId: z.string().trim().min(1).max(2048),
          lang: z.enum(["sub", "dub"], {
            message: "Selecione o idioma da fonte (legendado ou dublado).",
          }),
          quality: z.string().trim().max(32).optional().nullable(),
          priority: z.number().int().min(0).max(1000).optional().default(0),
        }),
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.openingStartSeconds != null && data.openingEndSeconds != null) {
        return data.openingEndSeconds > data.openingStartSeconds;
      }
      return true;
    },
    {
      message: "O fim da opening deve ser maior que o início.",
      path: ["openingEndSeconds"],
    },
  );

export function resolveOpeningTimestampsPatch(
  incoming: {
    openingStartSeconds?: number | null;
    openingEndSeconds?: number | null;
  },
  existing?: {
    openingStartSeconds?: number | null;
    openingEndSeconds?: number | null;
  } | null,
):
  | {
      valid: true;
      hasOpeningStartField: boolean;
      hasOpeningEndField: boolean;
      openingStartSeconds: number | null;
      openingEndSeconds: number | null;
    }
  | {
      valid: false;
      error: string;
    } {
  const hasOpeningStartField = incoming.openingStartSeconds !== undefined;
  const hasOpeningEndField = incoming.openingEndSeconds !== undefined;
  const openingStartSeconds = hasOpeningStartField
    ? (incoming.openingStartSeconds ?? null)
    : (existing?.openingStartSeconds ?? null);
  const openingEndSeconds = hasOpeningEndField
    ? (incoming.openingEndSeconds ?? null)
    : (existing?.openingEndSeconds ?? null);

  if (
    (openingStartSeconds !== null && openingStartSeconds < 0) ||
    (openingEndSeconds !== null && openingEndSeconds < 0)
  ) {
    return {
      valid: false,
      error: "Os tempos da opening não podem ser negativos.",
    };
  }

  if (
    openingStartSeconds !== null &&
    openingEndSeconds !== null &&
    openingEndSeconds <= openingStartSeconds
  ) {
    return {
      valid: false,
      error: "O fim da opening deve ser maior que o início.",
    };
  }

  return {
    valid: true,
    hasOpeningStartField,
    hasOpeningEndField,
    openingStartSeconds,
    openingEndSeconds,
  };
}

export function resolveEpisodeBadgesPatch(
  incoming?: {
    recentBadges?: Partial<AnimeRecentBadges> | null;
  } | null,
  existing?: {
    badgeLancamento?: boolean | null;
    badgeNovo?: boolean | null;
    badgeFinal?: boolean | null;
  } | null,
): {
  hasLancamentoField: boolean;
  hasNovoField: boolean;
  hasFinalField: boolean;
  badgeLancamento: boolean;
  badgeNovo: boolean;
  badgeFinal: boolean;
  recentBadges: AnimeRecentBadges;
} {
  const raw = incoming?.recentBadges;
  const hasObject = raw !== undefined && raw !== null && typeof raw === "object";
  const hasLancamentoField = hasObject && typeof raw.lancamento === "boolean";
  const hasNovoField = hasObject && typeof raw.novo === "boolean";
  const hasFinalField = hasObject && typeof raw.final === "boolean";

  const badgeLancamento = hasLancamentoField
    ? Boolean(raw.lancamento)
    : Boolean(existing?.badgeLancamento);
  const badgeNovo = hasNovoField
    ? Boolean(raw.novo)
    : Boolean(existing?.badgeNovo);
  const badgeFinal = hasFinalField
    ? Boolean(raw.final)
    : Boolean(existing?.badgeFinal);

  return {
    hasLancamentoField,
    hasNovoField,
    hasFinalField,
    badgeLancamento,
    badgeNovo,
    badgeFinal,
    recentBadges: {
      lancamento: badgeLancamento,
      novo: badgeNovo,
      final: badgeFinal,
    },
  };
}

export function resolveEpisodeAudioPatch(
  incoming?: {
    audio?: unknown;
  } | null,
  existing?: {
    audio?: string | null;
  } | null,
): {
  hasAudioField: boolean;
  audio: EpisodeAudio | null;
} {
  const hasAudioField =
    incoming !== undefined && incoming !== null && incoming.audio !== undefined;
  const audio = hasAudioField
    ? normalizeEpisodeAudio(incoming.audio)
    : normalizeEpisodeAudio(existing?.audio);
  return {
    hasAudioField,
    audio,
  };
}

export interface OutboxOperation {
  id: string;
  type: "upsert" | "delete";
  episodeId: string;
  animeId: string;
  seasonNumber: number;
  episodeNumber?: number;
  payload?: EpisodePayload;
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
  lastError?: string;
  status?: "pending" | "conflict";
}

export interface OutboxOperationInput {
  type: "upsert" | "delete";
  episodeId: string;
  animeId: string;
  seasonNumber: number;
  episodeNumber?: number;
  payload?: EpisodePayload;
}

export type EpisodeSyncErrorCategory =
  | "auth"
  | "validation"
  | "conflict"
  | "rate_limit"
  | "server"
  | "network"
  | "unknown";

export class EpisodeSyncHttpError extends Error {
  readonly status: number;
  readonly category: EpisodeSyncErrorCategory;
  readonly details?: unknown;
  readonly code?: string;

  constructor(
    message: string,
    options: {
      status: number;
      category: EpisodeSyncErrorCategory;
      details?: unknown;
      code?: string;
    },
  ) {
    super(message);
    this.name = "EpisodeSyncHttpError";
    this.status = options.status;
    this.category = options.category;
    this.details = options.details;
    this.code = options.code;
  }
}

export function classifyHttpStatus(status: number): EpisodeSyncErrorCategory {
  if (status === 401 || status === 403) return "auth";
  if (status === 400 || status === 422) return "validation";
  if (status === 404 || status === 409) return "conflict";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  if (status === 0) return "network";
  return "unknown";
}

function getDefaultHttpErrorMessage(status: number, fallback: string): string {
  if (status === 401 || status === 403) {
    return `Sessão expirada ou sem permissão de administrador (HTTP ${status}). Faça login novamente.`;
  }
  if (status === 400 || status === 422) {
    return `Dados rejeitados pelo servidor (HTTP ${status}).`;
  }
  if (status === 404 || status === 409) {
    return `Conflito de dados no servidor (HTTP ${status}).`;
  }
  if (status === 429) {
    return "Muitas requisições ao servidor (429). Aguarde instantes para nova tentativa.";
  }
  if (status >= 500) {
    return `Erro interno no servidor (HTTP ${status}). Alterações preservadas na fila local.`;
  }
  return fallback;
}

async function parseHttpErrorResponse(
  res: Response,
  fallbackMessage: string,
): Promise<EpisodeSyncHttpError> {
  const category = classifyHttpStatus(res.status);
  let message = "";
  let details: unknown = undefined;
  let code: string | undefined = undefined;

  try {
    const json = (await res.json()) as {
      error?: unknown;
      message?: unknown;
      details?: unknown;
      code?: unknown;
    } | null;
    if (json && typeof json === "object") {
      if (typeof json.error === "string" && json.error.trim()) {
        message = json.error.trim();
      } else if (typeof json.message === "string" && json.message.trim()) {
        message = json.message.trim();
      }
      details = json.details;
      if (typeof json.code === "string" && json.code.trim()) {
        code = json.code.trim();
      }
      if (
        Array.isArray(json.details) &&
        json.details.length > 0 &&
        typeof json.details[0]?.message === "string" &&
        json.details[0].message.trim() &&
        !message.includes(json.details[0].message.trim())
      ) {
        const issueMsg = json.details[0].message.trim();
        message = message ? `${message} (${issueMsg})` : issueMsg;
      }
    }
  } catch {
    // fallback silencioso se a resposta não for JSON válido
  }

  if (!message) {
    message = getDefaultHttpErrorMessage(res.status, fallbackMessage);
  }

  return new EpisodeSyncHttpError(message, {
    status: res.status,
    category,
    details,
    code,
  });
}

function classifySyncError(
  err: unknown,
  fallbackMessage: string,
): EpisodeSyncHttpError {
  if (err instanceof EpisodeSyncHttpError) {
    return err;
  }
  const msg =
    err instanceof Error && err.message.trim()
      ? err.message.trim()
      : fallbackMessage;
  return new EpisodeSyncHttpError(msg, {
    status: 0,
    category: "network",
  });
}

export interface PersistEpisodeResult {
  confirmed: boolean;
  queued: boolean;
  canonicalId?: string;
  thumbnail?: string | null;
  published?: boolean;
  publishedAt?: string | null;
  hikariPlayerEpisodeId?: string | null;
  audio?: EpisodeAudio | null;
  openingStartSeconds?: number | null;
  openingEndSeconds?: number | null;
  recentBadges?: AnimeRecentBadges;
  status: "synced" | "pending" | "conflict";
  error?: string;
  errorStatus?: number;
  errorCategory?: EpisodeSyncErrorCategory;
}

export const OUTBOX_POLL_INTERVAL_MS = 8000;

let isFlushing = false;

const confirmedParentConsolidations = new Map<string, string>();
const inFlightParentConsolidations = new Map<string, Promise<string>>();

export function markAnimeParentConfirmed(
  animeId: string,
  canonicalId: string = animeId,
): void {
  const cleanInput = animeId?.trim();
  const cleanCanonical = canonicalId?.trim() || cleanInput;
  if (!cleanInput) return;
  confirmedParentConsolidations.set(cleanInput, cleanCanonical);
  if (cleanCanonical && cleanCanonical !== cleanInput) {
    confirmedParentConsolidations.set(cleanCanonical, cleanCanonical);
  }
}

export function clearAnimeParentConsolidationCache(animeId?: string): void {
  if (!animeId) {
    confirmedParentConsolidations.clear();
    return;
  }
  const clean = animeId.trim();
  confirmedParentConsolidations.delete(clean);
  for (const [key, val] of Array.from(confirmedParentConsolidations.entries())) {
    if (val === clean) {
      confirmedParentConsolidations.delete(key);
    }
  }
}

export function isConfirmedServerAnime(
  anime?: Partial<LocalAnime> | null,
): boolean {
  if (!anime?.id) return false;
  const cleanId = anime.id.trim();
  if (!cleanId) return false;

  if (confirmedParentConsolidations.has(cleanId)) {
    return true;
  }

  if (!cleanId.startsWith("local-")) {
    return true;
  }

  const serverCatalogId =
    typeof anime.serverCatalogId === "string" ? anime.serverCatalogId.trim() : "";

  if (serverCatalogId && serverCatalogId === cleanId) {
    return true;
  }

  if (
    typeof anime.syncedAt === "number" &&
    Number.isFinite(anime.syncedAt) &&
    anime.syncedAt > 0 &&
    anime.syncedAt >= (anime.createdAt || 0) &&
    (!serverCatalogId || serverCatalogId === cleanId)
  ) {
    return true;
  }

  return false;
}

type OutboxSubscriber = (ops: OutboxOperation[]) => void;

const outboxSubscribers = new Set<OutboxSubscriber>();
let sharedOutboxTimer: any = null;
let sharedOutboxListenersAttached = false;
let lastNotifiedOutboxRaw: string | null = null;
let lastNotifiedOutboxOps: OutboxOperation[] | null = null;

function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function parseOutboxRaw(raw: string | null): OutboxOperation[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as OutboxOperation[];
    }
  } catch (err) {
    console.warn("[episode-writer] Falha ao ler outbox:", err);
  }
  return [];
}

function emitOutboxUpdate(ops: OutboxOperation[], serialized?: string): void {
  const snapshot = ops.slice();
  lastNotifiedOutboxRaw = serialized ?? JSON.stringify(snapshot);
  lastNotifiedOutboxOps = snapshot;

  for (const listener of Array.from(outboxSubscribers)) {
    try {
      listener(snapshot);
    } catch (err) {
      console.warn("[episode-writer] Erro em assinante do outbox:", err);
    }
  }
}

export function refreshOutboxFromStorage(forceNotify = false): OutboxOperation[] {
  if (!isLocalStorageAvailable()) return [];
  const raw = window.localStorage.getItem(OUTBOX_STORAGE_KEY);
  const normalizedRaw = raw ?? "[]";

  if (
    !forceNotify &&
    lastNotifiedOutboxRaw !== null &&
    normalizedRaw === lastNotifiedOutboxRaw &&
    lastNotifiedOutboxOps !== null
  ) {
    return lastNotifiedOutboxOps;
  }

  const ops = parseOutboxRaw(raw);
  emitOutboxUpdate(ops, normalizedRaw);
  return ops;
}

function handleSharedOnlineEvent(): void {
  refreshOutboxFromStorage();
}

function handleSharedStorageEvent(event: StorageEvent): void {
  if (event.key !== null && event.key !== OUTBOX_STORAGE_KEY) return;
  refreshOutboxFromStorage();
}

function handleSharedVisibilityChange(): void {
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    refreshOutboxFromStorage();
  }
}

function attachSharedOutboxMonitor(): void {
  if (typeof window === "undefined") return;

  if (!sharedOutboxListenersAttached) {
    window.addEventListener("online", handleSharedOnlineEvent);
    window.addEventListener("storage", handleSharedStorageEvent);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleSharedVisibilityChange);
    }
    sharedOutboxListenersAttached = true;
  }

  if (sharedOutboxTimer === null) {
    sharedOutboxTimer = window.setInterval(() => {
      refreshOutboxFromStorage();
    }, OUTBOX_POLL_INTERVAL_MS);
  }
}

function detachSharedOutboxMonitor(): void {
  if (typeof window !== "undefined") {
    if (sharedOutboxTimer !== null) {
      window.clearInterval(sharedOutboxTimer);
      sharedOutboxTimer = null;
    }
    if (sharedOutboxListenersAttached) {
      window.removeEventListener("online", handleSharedOnlineEvent);
      window.removeEventListener("storage", handleSharedStorageEvent);
      if (typeof document !== "undefined") {
        document.removeEventListener(
          "visibilitychange",
          handleSharedVisibilityChange,
        );
      }
      sharedOutboxListenersAttached = false;
    }
  }
  lastNotifiedOutboxRaw = null;
  lastNotifiedOutboxOps = null;
}

/**
 * Inscreve um componente no monitor compartilhado do Outbox com contagem de referências:
 * mantém no máximo 1 timer periódico e listeners globais únicos enquanto houver
 * pelo menos 1 assinante ativo, liberando tudo ao desmontar o último.
 */
export function subscribeOutbox(
  listener: OutboxSubscriber,
  options?: { emitInitial?: boolean },
): () => void {
  outboxSubscribers.add(listener);
  attachSharedOutboxMonitor();

  if (options?.emitInitial !== false) {
    const current = readOutbox();
    try {
      listener(current);
    } catch (err) {
      console.warn("[episode-writer] Erro na entrega inicial do outbox:", err);
    }
  }

  return () => {
    outboxSubscribers.delete(listener);
    if (outboxSubscribers.size === 0) {
      detachSharedOutboxMonitor();
    }
  };
}

export function getOutboxMonitorState(): {
  subscriberCount: number;
  hasActiveTimer: boolean;
  listenersAttached: boolean;
} {
  return {
    subscriberCount: outboxSubscribers.size,
    hasActiveTimer: sharedOutboxTimer !== null,
    listenersAttached: sharedOutboxListenersAttached,
  };
}

/**
 * Lê todas as operações pendentes salvas no localStorage.
 */
export function readOutbox(): OutboxOperation[] {
  if (!isLocalStorageAvailable()) return [];
  const raw = window.localStorage.getItem(OUTBOX_STORAGE_KEY);
  return parseOutboxRaw(raw);
}

/**
 * Persiste a lista de operações no localStorage sem descartar silenciosamente itens
 * e notifica imediatamente todos os assinantes na mesma aba.
 */
export function writeOutbox(ops: OutboxOperation[]): void {
  if (!isLocalStorageAvailable()) return;
  try {
    const serialized = JSON.stringify(ops);
    window.localStorage.setItem(OUTBOX_STORAGE_KEY, serialized);
    emitOutboxUpdate(ops, serialized);
  } catch (err) {
    console.warn("[episode-writer] Falha ao salvar outbox:", err);
  }
}

function mutateOutbox(
  updater: (ops: OutboxOperation[]) => OutboxOperation[],
): OutboxOperation[] {
  const current = readOutbox();
  const next = updater(current);
  writeOutbox(next);
  return next;
}

/**
 * Verifica se existem operações pendentes de sincronização.
 */
export function hasPendingWrites(): boolean {
  return readOutbox().length > 0;
}

/**
 * Reconcilia o identificador do episódio no estado local (Zustand/IndexedDB)
 * e nas operações pendentes relacionadas no Outbox quando o servidor retorna
 * um ID canônico preexistente no PostgreSQL.
 */
export function reconcileLocalEpisode(
  animeId: string,
  seasonNumber: number,
  oldId: string,
  canonicalId: string,
): void {
  if (!oldId || !canonicalId || oldId === canonicalId) return;

  // 1. Atualizar referências locais no Outbox
  const ops = readOutbox();
  let opsChanged = false;
  const updatedOps = ops.map((op) => {
    if (op.animeId === animeId && op.episodeId === oldId) {
      opsChanged = true;
      return {
        ...op,
        episodeId: canonicalId,
        payload: op.payload
          ? {
              ...op.payload,
              id: canonicalId,
            }
          : undefined,
      };
    }
    return op;
  });

  if (opsChanged) {
    writeOutbox(updatedOps);
  }

  // 2. Atualizar store Zustand em memória e IndexedDB
  if (typeof window !== "undefined") {
    try {
      useHikariStore.setState((s) => {
        const animeIdx = s.animes.findIndex((a) => a.id === animeId);
        if (animeIdx === -1) return s;

        const anime = s.animes[animeIdx];
        let epFound = false;

        const updatedSeasons = anime.seasons.map((season) => {
          if (season.number !== seasonNumber) return season;
          return {
            ...season,
            episodes: season.episodes.map((ep) => {
              if (ep.id === oldId) {
                epFound = true;
                return { ...ep, id: canonicalId };
              }
              return ep;
            }),
          };
        });

        if (!epFound) return s;

        const nextAnimes = [...s.animes];
        nextAnimes[animeIdx] = {
          ...anime,
          seasons: updatedSeasons,
        };

        return { animes: nextAnimes };
      });
    } catch (err) {
      console.warn("[episode-writer] Falha ao reconciliar ID no store Zustand:", err);
    }
  }
}

/**
 * Enfileira uma operação no Outbox com coalescência inteligente por episódio e slot.
 * Se a fila atingir o limite de 40 operações, não descarta silenciosamente as anteriores:
 * retorna null para indicar que a capacidade máxima foi atingida e preserva os registros.
 */
export function enqueue(input: OutboxOperationInput): OutboxOperation | null {
  const currentOps = readOutbox();

  // Coalescência: busca operação pendente existente para o mesmo episódio ou mesmo slot
  const existingIdx = currentOps.findIndex(
    (op) =>
      op.animeId === input.animeId &&
      (op.episodeId === input.episodeId ||
        (input.episodeNumber !== undefined &&
          op.seasonNumber === input.seasonNumber &&
          op.episodeNumber === input.episodeNumber)),
  );

  // Se a fila estiver cheia e for uma nova operação independente, não descarta as pendências
  if (existingIdx === -1 && currentOps.length >= MAX_OUTBOX_SIZE) {
    console.warn(
      "[episode-writer] Fila do Outbox atingiu a capacidade máxima (40 operações). Conecte-se para sincronizar.",
    );
    if (typeof window !== "undefined") {
      toast.warning("Fila de sincronização cheia (40 operações). Alterações locais preservadas; conecte-se para sincronizar.", {
        id: "outbox-full-warning",
      });
    }
    return null;
  }

  const now = Date.now();
  let operation: OutboxOperation;

  if (existingIdx !== -1) {
    const existing = currentOps[existingIdx];

    // Se existia upsert e agora é delete: substitui por delete
    if (existing.type === "upsert" && input.type === "delete") {
      operation = {
        ...existing,
        type: "delete",
        payload: undefined,
        createdAt: now,
        attempts: 0,
        status: "pending",
        lastError: undefined,
      };
      currentOps[existingIdx] = operation;
    }
    // Se existia upsert e agora é novo upsert: atualiza payload mantendo integridade
    else if (existing.type === "upsert" && input.type === "upsert") {
      operation = {
        ...existing,
        episodeId: input.episodeId,
        payload: input.payload,
        createdAt: now,
        attempts: 0,
        status: "pending",
        lastError: undefined,
      };
      currentOps[existingIdx] = operation;
    }
    // Se era delete e agora é upsert: preserva ordem e substitui por upsert atualizado
    else {
      operation = {
        ...existing,
        type: input.type,
        episodeId: input.episodeId,
        payload: input.payload,
        createdAt: now,
        attempts: 0,
        status: "pending",
        lastError: undefined,
      };
      currentOps[existingIdx] = operation;
    }
  } else {
    // Nova operação
    operation = {
      id: `outbox-${now}-${Math.random().toString(36).slice(2, 8)}`,
      type: input.type,
      episodeId: input.episodeId,
      animeId: input.animeId,
      seasonNumber: input.seasonNumber,
      episodeNumber: input.episodeNumber,
      payload: input.payload,
      createdAt: now,
      attempts: 0,
      status: "pending",
    };
    currentOps.push(operation);
  }

  writeOutbox(currentOps);
  return operation;
}

function normalizeIntInRange(
  val: unknown,
  min: number,
  max: number,
  options?: { round?: boolean },
): number | null {
  if (typeof val !== "number" || !Number.isFinite(val)) return null;
  const num = options?.round ? Math.round(val) : Math.trunc(val);
  if (num < min || num > max) return null;
  return num;
}

function normalizePositiveInt(val: unknown): number | undefined {
  if (typeof val !== "number" || !Number.isSafeInteger(val) || val <= 0) {
    return undefined;
  }
  return val;
}

function sanitizeConsolidationMediaUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = stripCatalogImageVersion(url).trim();
  if (!trimmed) return "";
  if (!isValidImageUrl(trimmed)) return "";
  if (trimmed.length > 2048) return "";
  return trimmed;
}

/**
 * Monta o payload de consolidação do anime usando o mesmo mecanismo de montagem do Admin
 * (`buildAdminCatalogAnimeSavePayload`), sanitizando imagens inválidas (`blob:` / `data:` > 2048)
 * e garantindo que campos numéricos respeitem estritamente o schema do servidor.
 */
export function buildConsolidatedAnimePayload(targetAnime: LocalAnime) {
  const safeCover = sanitizeConsolidationMediaUrl(targetAnime.cover);
  const safeBanner = sanitizeConsolidationMediaUrl(targetAnime.banner);
  const safeGenres = Array.isArray(targetAnime.genres)
    ? targetAnime.genres
        .map((g) => (typeof g === "string" ? g.trim().slice(0, 64) : ""))
        .filter(Boolean)
    : [];
  const safeSeasons = Array.isArray(targetAnime.seasons)
    ? targetAnime.seasons
        .filter(
          (s) =>
            s &&
            typeof s.number === "number" &&
            Number.isFinite(s.number) &&
            Math.trunc(s.number) >= 1,
        )
        .map((s) => ({
          ...s,
          id: s.id || `s-${targetAnime.id}-${Math.trunc(s.number)}`,
          number: Math.trunc(s.number),
          title:
            typeof s.title === "string" && s.title.trim()
              ? s.title.trim().slice(0, 255)
              : `Temporada ${Math.trunc(s.number)}`,
          episodes: Array.isArray(s.episodes) ? s.episodes : [],
        }))
    : [];

  const sanitizedAnime: LocalAnime = {
    ...targetAnime,
    cover: safeCover,
    banner: safeBanner,
    score: normalizeIntInRange(targetAnime.score, 0, 100, { round: true }),
    episodesCount: normalizeIntInRange(targetAnime.episodesCount, 0, 100000),
    year: normalizeIntInRange(targetAnime.year, 1900, 2100),
    anilistId: normalizePositiveInt(targetAnime.anilistId),
    malId: normalizePositiveInt(targetAnime.malId),
    kitsuId: normalizePositiveInt(targetAnime.kitsuId),
    genres: safeGenres,
    seasons: safeSeasons,
  };

  return buildAdminCatalogAnimeSavePayload(
    sanitizedAnime,
    {
      cover: Boolean(safeCover),
      banner: Boolean(safeBanner),
    },
    false,
  );
}

function applyParentConsolidationToStoreAndOutbox(
  originalAnimeId: string,
  definitiveId: string,
): void {
  const syncedAt = Date.now();

  if (definitiveId !== originalAnimeId) {
    mutateOutbox((ops) => {
      let updated = false;
      const nextOps = ops.map((op) => {
        const matchesAnime =
          op.animeId === originalAnimeId || op.payload?.animeId === originalAnimeId;
        if (!matchesAnime) return op;
        updated = true;
        return {
          ...op,
          animeId: definitiveId,
          ...(op.payload
            ? {
                payload: {
                  ...op.payload,
                  animeId: definitiveId,
                },
              }
            : {}),
        };
      });
      return updated ? nextOps : ops;
    });
  }

  if (typeof window !== "undefined") {
    try {
      useHikariStore.setState((s) => {
        const origIdx = s.animes.findIndex((a) => a.id === originalAnimeId);
        if (origIdx === -1) return s;

        const origAnime = s.animes[origIdx];
        if (definitiveId === originalAnimeId) {
          const nextAnimes = [...s.animes];
          nextAnimes[origIdx] = {
            ...origAnime,
            serverCatalogId: definitiveId,
            syncedAt,
          };
          return { animes: nextAnimes };
        }

        const existingDefIdx = s.animes.findIndex((a) => a.id === definitiveId);
        if (existingDefIdx !== -1) {
          const nextAnimes = s.animes
            .map((a, idx) =>
              idx === existingDefIdx
                ? {
                    ...a,
                    serverCatalogId: definitiveId,
                    syncedAt,
                  }
                : a,
            )
            .filter((a) => a.id !== originalAnimeId);
          return { animes: nextAnimes };
        }

        const nextAnimes = [...s.animes];
        nextAnimes[origIdx] = {
          ...origAnime,
          id: definitiveId,
          serverCatalogId: definitiveId,
          syncedAt,
        };
        return { animes: nextAnimes };
      });
    } catch (err) {
      console.warn("[episode-writer] Falha ao atualizar store após consolidação:", err);
    }
  }

  if (definitiveId !== originalAnimeId) {
    invalidateCatalogEpisodesCache(originalAnimeId, definitiveId);
  }
}

/**
 * Consolida o anime pai (caso possua ID local "local-...") no servidor
 * antes de enviar os episódios associados, com proteção single-flight por ID,
 * reconhecimento de cadastros já confirmados (incluindo IDs "local-..." mantidos
 * legitimamente pelo backend) e atualização completa de `op.animeId` + `op.payload.animeId`.
 */
export async function consolidateAnimeParent(animeId: string): Promise<string> {
  const cleanId = animeId?.trim();
  if (!cleanId || !cleanId.startsWith("local-") || typeof window === "undefined") {
    return cleanId || animeId;
  }

  const cachedCanonical = confirmedParentConsolidations.get(cleanId);
  if (cachedCanonical) {
    return cachedCanonical;
  }

  const existingFlight = inFlightParentConsolidations.get(cleanId);
  if (existingFlight) {
    return existingFlight;
  }

  const consolidationPromise = (async (): Promise<string> => {
    const preState = useHikariStore.getState();
    if (!preState.hydrated && preState.animes.length === 0) {
      await ensureCatalogLoaded();
    }

    const postHydrateCached = confirmedParentConsolidations.get(cleanId);
    if (postHydrateCached) {
      return postHydrateCached;
    }

    const localAnimes = useHikariStore.getState().animes || [];
    const targetAnime = localAnimes.find((a) => a.id === cleanId);
    if (!targetAnime) {
      return cleanId;
    }

    if (isConfirmedServerAnime(targetAnime)) {
      markAnimeParentConfirmed(cleanId, cleanId);
      return cleanId;
    }

    const payload = buildConsolidatedAnimePayload(targetAnime);

    const res = await fetch("/api/admin/catalog-anime", {
      method: "POST",
      headers: buildAdminRequestHeaders(),
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw await parseHttpErrorResponse(
        res,
        `Falha ao consolidar anime pai (${res.status})`,
      );
    }

    const data = (await res.json().catch(() => ({}))) as {
      animeId?: unknown;
      id?: unknown;
    } | null;
    const rawDefinitiveId =
      typeof data?.animeId === "string" && data.animeId.trim()
        ? data.animeId.trim()
        : typeof data?.id === "string" && data.id.trim()
          ? data.id.trim()
          : "";
    const definitiveId = rawDefinitiveId || cleanId;

    markAnimeParentConfirmed(cleanId, definitiveId);
    applyParentConsolidationToStoreAndOutbox(cleanId, definitiveId);

    return definitiveId;
  })();

  inFlightParentConsolidations.set(cleanId, consolidationPromise);
  try {
    return await consolidationPromise;
  } catch (err) {
    console.error("[episode-writer] Erro ao consolidar anime pai:", err);
    throw err;
  } finally {
    if (inFlightParentConsolidations.get(cleanId) === consolidationPromise) {
      inFlightParentConsolidations.delete(cleanId);
    }
  }
}

const COLLISION_ERROR_RE =
  /ID_BOUND_TO_OTHER_SLOT|já está associado a outro episódio|Conflito de integridade/i;

export interface RepairedOutboxEpisodeEntry {
  outboxId: string;
  animeId: string;
  seasonNumber: number;
  episodeNumber?: number;
  oldEpisodeId: string;
  newEpisodeId: string;
}

export interface RepairDubbedOutboxResult {
  repairedCount: number;
  repairedOps: RepairedOutboxEpisodeEntry[];
  reconciledStoreEpisodes: number;
}

/**
 * Repara de forma idempotente e não destrutiva registros pendentes de animes Dublados
 * no Outbox (`hikari-episode-outbox-v1`) e no store local (Zustand/IndexedDB) que
 * herdaram IDs externos/compartilhados (ex.: `kitsu-ep-50792-1`) ou colidem com o Legendado.
 *
 * - Nunca remove itens do Outbox.
 * - Nunca altera animes Legendados nem seus episódios.
 * - Preserva todos os links de vídeo, thumbnails, títulos, números e flags originais.
 * - Execuções repetidas são 100% no-op (`repairedCount === 0`) após a normalização.
 */
export function repairDubbedOutboxEpisodeIds(options?: {
  targetAnimeIds?: string[];
  collidingEpisodeIds?: Iterable<string>;
}): RepairDubbedOutboxResult {
  if (typeof window === "undefined") {
    return { repairedCount: 0, repairedOps: [], reconciledStoreEpisodes: 0 };
  }

  const currentOps = readOutbox();
  const localAnimes = useHikariStore.getState().animes || [];
  const animeById = new Map<string, LocalAnime>();
  for (const a of localAnimes) {
    if (a?.id) animeById.set(a.id, a);
  }

  const explicitTargets = options?.targetAnimeIds
    ? new Set(options.targetAnimeIds.map((id) => id.trim()).filter(Boolean))
    : null;

  const isTargetDubbedOp = (op: OutboxOperation): boolean => {
    const cleanAnimeId = op.animeId?.trim() || "";
    if (!cleanAnimeId) return false;
    if (explicitTargets) {
      return explicitTargets.has(cleanAnimeId);
    }
    const storeAnime = animeById.get(cleanAnimeId);
    if (storeAnime) {
      return isDubbedAnimeRecord(storeAnime);
    }
    if (cleanAnimeId === "local-a96d58dd-39a3-438d-af0f-4ee50b78ca1e") {
      return true;
    }
    return (
      cleanAnimeId.startsWith("local-") &&
      (op.payload?.audio === "dub" ||
        isDubbedAnimeRecord({
          id: cleanAnimeId,
          title: op.payload?.animeTitle,
        }))
    );
  };

  // Coleta IDs protegidos de episódios do Legendado e de outros cadastros não-alvo
  const forbiddenIds = new Set<string>();
  for (const a of localAnimes) {
    if (!a?.id) continue;
    const isTargetStoreAnime = explicitTargets
      ? explicitTargets.has(a.id)
      : isDubbedAnimeRecord(a);
    if (isTargetStoreAnime) continue;
    for (const s of a.seasons ?? []) {
      for (const ep of s?.episodes ?? []) {
        if (ep?.id?.trim()) forbiddenIds.add(ep.id.trim());
      }
    }
  }
  for (const op of currentOps) {
    if (isTargetDubbedOp(op)) continue;
    if (op.episodeId?.trim()) forbiddenIds.add(op.episodeId.trim());
    if (op.payload?.id?.trim()) forbiddenIds.add(op.payload.id.trim());
  }
  if (options?.collidingEpisodeIds) {
    for (const id of options.collidingEpisodeIds) {
      if (id?.trim()) forbiddenIds.add(id.trim());
    }
  }

  const seenDubbedIds = new Set<string>();
  const perPassSeenIds = new Set<string>();
  const repairedOps: RepairedOutboxEpisodeEntry[] = [];
  let outboxChanged = false;

  // Pré-registrar IDs válidos já existentes nos episódios dublados para evitar colisão ao gerar novos
  for (const op of currentOps) {
    if (!isTargetDubbedOp(op)) continue;
    const rawOpId = op.episodeId?.trim() || "";
    const storeAnime = animeById.get(op.animeId);
    const animeSelfBlocked = new Set<string>([op.animeId]);
    if (storeAnime?.anilistId) animeSelfBlocked.add(String(storeAnime.anilistId));
    if (storeAnime?.kitsuId) animeSelfBlocked.add(String(storeAnime.kitsuId));
    if (storeAnime?.malId) animeSelfBlocked.add(String(storeAnime.malId));
    if (
      rawOpId &&
      !isExternalEpisodeId(rawOpId) &&
      !forbiddenIds.has(rawOpId) &&
      !animeSelfBlocked.has(rawOpId) &&
      !COLLISION_ERROR_RE.test(op.lastError || "")
    ) {
      seenDubbedIds.add(rawOpId);
    }
  }

  // Também inclui IDs internos já válidos no Zustand dos animes dublados para não duplicar
  for (const a of localAnimes) {
    if (!a?.id || !isDubbedAnimeRecord(a)) continue;
    for (const s of a.seasons ?? []) {
      for (const ep of s?.episodes ?? []) {
        const eid = ep?.id?.trim() || "";
        if (eid && !isExternalEpisodeId(eid) && !forbiddenIds.has(eid)) {
          seenDubbedIds.add(eid);
        }
      }
    }
  }

  const nextOps = currentOps.map((op) => {
    if (!isTargetDubbedOp(op)) {
      return op;
    }

    const storeAnime = animeById.get(op.animeId);
    const animeSelfBlocked = new Set<string>([op.animeId]);
    if (storeAnime?.anilistId) animeSelfBlocked.add(String(storeAnime.anilistId));
    if (storeAnime?.kitsuId) animeSelfBlocked.add(String(storeAnime.kitsuId));
    if (storeAnime?.malId) animeSelfBlocked.add(String(storeAnime.malId));

    const rawOpId = op.episodeId?.trim() || "";
    const rawPayloadId = op.payload?.id?.trim() || "";
    const candidateId = rawOpId || rawPayloadId;
    const hasCollisionError = COLLISION_ERROR_RE.test(op.lastError || "");

    // Verificar se o candidateId já foi reivindicado por OUTRA operação do lote
    // (seenDubbedIds foi pré-populado com IDs válidos; aqui usamos perPassSeen para detectar duplicidade entre duas ops)
    const perPassConflict = perPassSeenIds.has(candidateId);

    const needsNewId =
      hasCollisionError ||
      perPassConflict ||
      !candidateId ||
      isExternalEpisodeId(candidateId) ||
      forbiddenIds.has(candidateId) ||
      animeSelfBlocked.has(candidateId);

    if (!needsNewId) {
      perPassSeenIds.add(candidateId);
      seenDubbedIds.add(candidateId);
      // Alinha payload.id caso apenas divergia de op.episodeId sem regenerar
      if (op.payload && rawPayloadId !== candidateId) {
        outboxChanged = true;
        return {
          ...op,
          episodeId: candidateId,
          payload: {
            ...op.payload,
            id: candidateId,
          },
        };
      }
      return op;
    }

    const blockedForThisOp = new Set<string>([
      ...forbiddenIds,
      ...seenDubbedIds,
      ...perPassSeenIds,
      ...animeSelfBlocked,
    ]);
    if (rawOpId) blockedForThisOp.add(rawOpId);
    if (rawPayloadId) blockedForThisOp.add(rawPayloadId);

    const newId = generateUniqueEpisodeId(seenDubbedIds, blockedForThisOp);
    seenDubbedIds.add(newId);
    perPassSeenIds.add(newId);
    outboxChanged = true;

    const preservedExternalId =
      op.payload?.externalEpisodeId?.trim() ||
      (isExternalEpisodeId(candidateId) ? candidateId : undefined);

    repairedOps.push({
      outboxId: op.id,
      animeId: op.animeId,
      seasonNumber: op.seasonNumber,
      episodeNumber: op.episodeNumber,
      oldEpisodeId: candidateId,
      newEpisodeId: newId,
    });

    const nextStatus =
      hasCollisionError && op.status === "conflict" ? "pending" : op.status;
    const nextLastError = hasCollisionError ? undefined : op.lastError;

    return {
      ...op,
      episodeId: newId,
      status: nextStatus,
      lastError: nextLastError,
      ...(op.payload
        ? {
            payload: {
              ...op.payload,
              id: newId,
              ...(preservedExternalId
                ? { externalEpisodeId: preservedExternalId }
                : {}),
            },
          }
        : {}),
    };
  });

  if (outboxChanged) {
    writeOutbox(nextOps);
  }

  // Reconcilia também episódios no store Zustand para que edições/saves futuros no Admin
  // não re-escrevam o ID antigo no Outbox via coalesce de slot.
  const outboxSlotMap = new Map<string, { id: string; externalEpisodeId?: string }>();
  for (const op of nextOps) {
    if (!isTargetDubbedOp(op)) continue;
    if (op.episodeNumber !== undefined) {
      outboxSlotMap.set(`${op.animeId}:${op.seasonNumber}:${op.episodeNumber}`, {
        id: op.episodeId,
        externalEpisodeId: op.payload?.externalEpisodeId?.trim() || undefined,
      });
    }
  }
  const repairByAnimeOldId = new Map<string, RepairedOutboxEpisodeEntry>();
  for (const r of repairedOps) {
    if (r.oldEpisodeId) {
      repairByAnimeOldId.set(`${r.animeId}:${r.oldEpisodeId}`, r);
    }
  }

  let reconciledStoreEpisodes = 0;
  try {
    useHikariStore.setState((s) => {
      let anyAnimeUpdated = false;
      const nextAnimes = s.animes.map((anime) => {
        const isTargetAnime = explicitTargets
          ? explicitTargets.has(anime.id)
          : isDubbedAnimeRecord(anime) ||
            anime.id === "local-a96d58dd-39a3-438d-af0f-4ee50b78ca1e";
        if (!isTargetAnime) return anime;

        let animeUpdated = false;
        const localSeen = new Set<string>();
        const nextSeasons = (anime.seasons ?? []).map((season) => {
          let seasonUpdated = false;
          const nextEpisodes = (season.episodes ?? []).map((ep) => {
            const rawEpId = ep.id?.trim() || "";
            const byOldId = rawEpId
              ? repairByAnimeOldId.get(`${anime.id}:${rawEpId}`)
              : undefined;
            const bySlot = outboxSlotMap.get(
              `${anime.id}:${season.number}:${ep.number}`,
            );

            if (byOldId && byOldId.newEpisodeId !== rawEpId) {
              animeUpdated = true;
              seasonUpdated = true;
              reconciledStoreEpisodes++;
              localSeen.add(byOldId.newEpisodeId);
              const preservedExt =
                ep.externalEpisodeId?.trim() ||
                (isExternalEpisodeId(rawEpId) ? rawEpId : undefined);
              return {
                ...ep,
                id: byOldId.newEpisodeId,
                ...(preservedExt ? { externalEpisodeId: preservedExt } : {}),
              };
            }

            if (
              bySlot &&
              bySlot.id !== rawEpId &&
              (isExternalEpisodeId(rawEpId) ||
                forbiddenIds.has(rawEpId) ||
                !rawEpId)
            ) {
              animeUpdated = true;
              seasonUpdated = true;
              reconciledStoreEpisodes++;
              localSeen.add(bySlot.id);
              const preservedExt =
                ep.externalEpisodeId?.trim() ||
                bySlot.externalEpisodeId ||
                (isExternalEpisodeId(rawEpId) ? rawEpId : undefined);
              return {
                ...ep,
                id: bySlot.id,
                ...(preservedExt ? { externalEpisodeId: preservedExt } : {}),
              };
            }

            const animeBlocked = new Set<string>([anime.id]);
            if (anime.anilistId) animeBlocked.add(String(anime.anilistId));
            if (anime.kitsuId) animeBlocked.add(String(anime.kitsuId));
            if (anime.malId) animeBlocked.add(String(anime.malId));

            const storeNeedsNewId =
              !rawEpId ||
              isExternalEpisodeId(rawEpId) ||
              forbiddenIds.has(rawEpId) ||
              animeBlocked.has(rawEpId) ||
              localSeen.has(rawEpId);

            if (!storeNeedsNewId) {
              localSeen.add(rawEpId);
              return ep;
            }

            const blocked = new Set<string>([
              ...forbiddenIds,
              ...seenDubbedIds,
              ...localSeen,
              ...animeBlocked,
            ]);
            if (rawEpId) blocked.add(rawEpId);
            const freshId = generateUniqueEpisodeId(seenDubbedIds, blocked);
            seenDubbedIds.add(freshId);
            localSeen.add(freshId);
            animeUpdated = true;
            seasonUpdated = true;
            reconciledStoreEpisodes++;
            const preservedExt =
              ep.externalEpisodeId?.trim() ||
              (isExternalEpisodeId(rawEpId) ? rawEpId : undefined);
            return {
              ...ep,
              id: freshId,
              ...(preservedExt ? { externalEpisodeId: preservedExt } : {}),
            };
          });
          return seasonUpdated ? { ...season, episodes: nextEpisodes } : season;
        });

        if (!animeUpdated) return anime;
        anyAnimeUpdated = true;
        return { ...anime, seasons: nextSeasons };
      });

      return anyAnimeUpdated ? { animes: nextAnimes } : s;
    });
  } catch (err) {
    console.warn("[episode-writer] Falha ao reconciliar episódios dublados no store:", err);
  }

  return {
    repairedCount: repairedOps.length,
    repairedOps,
    reconciledStoreEpisodes,
  };
}

/**
 * Executa o reenvio sequencial de todas as operações pendentes no Outbox.
 * Protegido contra execuções concorrentes, loops infinitos e envio de episódios
 * quando a consolidação do anime pai falhou.
 */
export async function flushOutbox(options?: {
  forceConflicts?: boolean;
}): Promise<{
  processed: number;
  remaining: number;
  error?: string;
  errorCategory?: EpisodeSyncErrorCategory;
}> {
  if (typeof window === "undefined") {
    return { processed: 0, remaining: 0 };
  }

  if (isFlushing) {
    return { processed: 0, remaining: readOutbox().length };
  }

  const initialOps = readOutbox();
  if (initialOps.length === 0) {
    return { processed: 0, remaining: 0 };
  }

  isFlushing = true;
  let processedCount = 0;

  try {
    const storeState = useHikariStore.getState();
    if (!storeState.hydrated && storeState.animes.length === 0) {
      await ensureCatalogLoaded();
    }

    // Repara antecipadamente quaisquer IDs externos/colidentes de animes Dublados antes de enviar ao servidor
    repairDubbedOutboxEpisodeIds();

    const eligibleAnimeIds = Array.from(
      new Set(
        readOutbox()
          .filter((o) => o.status !== "conflict" || Boolean(options?.forceConflicts))
          .map((o) => o.animeId),
      ),
    );

    const failedParents = new Map<string, EpisodeSyncHttpError>();

    for (const aId of eligibleAnimeIds) {
      if (!aId.startsWith("local-")) continue;

      try {
        await consolidateAnimeParent(aId);
      } catch (err) {
        const classified = classifySyncError(
          err,
          `Falha ao consolidar anime ${aId} no servidor.`,
        );
        failedParents.set(aId, classified);

        if (classified.category === "auth") {
          mutateOutbox((current) =>
            current.map((o) =>
              o.animeId === aId &&
              (o.status !== "conflict" || Boolean(options?.forceConflicts))
                ? {
                    ...o,
                    lastError: classified.message,
                    lastAttemptAt: Date.now(),
                  }
                : o,
            ),
          );
          return {
            processed: 0,
            remaining: readOutbox().length,
            error: classified.message,
            errorCategory: "auth",
          };
        }

        const isConflictOrValidation =
          classified.category === "validation" || classified.category === "conflict";

        mutateOutbox((current) =>
          current.map((o) =>
            o.animeId === aId &&
            (o.status !== "conflict" || Boolean(options?.forceConflicts))
              ? {
                  ...o,
                  attempts: (o.attempts || 0) + 1,
                  status: isConflictOrValidation ? "conflict" : "pending",
                  lastError: classified.message,
                  lastAttemptAt: Date.now(),
                }
              : o,
          ),
        );
        console.warn(
          `[episode-writer] Falha ao consolidar anime ${aId} durante flush (${classified.status}). Episódios preservados na fila.`,
        );
      }
    }

    const refreshedOps = readOutbox();
    let lastConflictError: EpisodeSyncHttpError | null = null;

    for (let i = 0; i < refreshedOps.length; i++) {
      const op = refreshedOps[i];

      // Erros permanentes/conflitos não devem entrar em ciclo infinito de tentativas automáticas
      if (op.status === "conflict" && !options?.forceConflicts) {
        continue;
      }

      // Nunca enviar episódios de um anime cuja consolidação falhou neste lote
      if (failedParents.has(op.animeId)) {
        continue;
      }

      let res: Response | null = null;
      let networkError: EpisodeSyncHttpError | null = null;

      try {
        if (op.type === "upsert" && op.payload) {
          const outboundPayload: EpisodePayload =
            op.payload.animeId === op.animeId && op.payload.id === op.episodeId
              ? op.payload
              : { ...op.payload, id: op.episodeId, animeId: op.animeId };
          res = await fetch("/api/admin/catalog-episode", {
            method: "POST",
            headers: buildAdminRequestHeaders(),
            credentials: "include",
            body: JSON.stringify(outboundPayload),
          });
        } else if (op.type === "delete") {
          res = await fetch("/api/admin/catalog-episode", {
            method: "DELETE",
            headers: buildAdminRequestHeaders(),
            credentials: "include",
            body: JSON.stringify({
              id: op.episodeId,
              animeId: op.animeId,
            }),
          });
        }
      } catch (err) {
        networkError = classifySyncError(
          err,
          "Servidor ou conexão indisponível. Alterações mantidas na fila local.",
        );
      }

      // 1. Sucesso na operação (2xx)
      if (res && res.ok) {
        processedCount++;

        let canonicalId = op.episodeId;
        try {
          const json = await res.json();
          const returnedId = json?.episodeId || json?.canonicalId;
          if (typeof returnedId === "string" && returnedId.trim() && returnedId !== op.episodeId) {
            canonicalId = returnedId.trim();
            reconcileLocalEpisode(op.animeId, op.seasonNumber, op.episodeId, canonicalId);
          }
        } catch {
          // ignore
        }

        // Remove da lista de pendências usando leitura/gravação atômica para não sobrescrever novas operações concorrentes
        mutateOutbox((current) =>
          current.filter(
            (o) =>
              o.id !== op.id &&
              !(
                o.animeId === op.animeId &&
                (o.episodeId === op.episodeId || o.episodeId === canonicalId) &&
                o.createdAt <= op.createdAt
              ),
          ),
        );

        invalidateCatalogEpisodesCache(op.animeId);
        continue;
      }

      // 2. Erros de autorização (401 ou 403): interrompe o flush imediatamente preservando a fila
      if (res && (res.status === 401 || res.status === 403)) {
        const authErr = await parseHttpErrorResponse(
          res,
          "Sessão expirada ou não autorizada. Faça login com conta de administrador.",
        );
        mutateOutbox((current) =>
          current.map((o) =>
            o.id === op.id
              ? { ...o, lastError: authErr.message, lastAttemptAt: Date.now() }
              : o,
          ),
        );
        console.warn("[episode-writer] Flush interrompido: autenticação necessária ou sem permissão.");
        return {
          processed: processedCount,
          remaining: readOutbox().length,
          error: authErr.message,
          errorCategory: "auth",
        };
      }

      // 3. Limite de requisições (429): preserva fila e pausa lote
      if (res && res.status === 429) {
        const rateErr = await parseHttpErrorResponse(
          res,
          "Muitas requisições. Sincronização continuará em instantes.",
        );
        mutateOutbox((current) =>
          current.map((o) =>
            o.id === op.id
              ? { ...o, lastError: rateErr.message, lastAttemptAt: Date.now() }
              : o,
          ),
        );
        console.warn("[episode-writer] Rate limit atingido (429). Retentando mais tarde.");
        return {
          processed: processedCount,
          remaining: readOutbox().length,
          error: rateErr.message,
          errorCategory: "rate_limit",
        };
      }

      // 4. Erros de validação ou conflito (400, 404, 409, 422): preserva na fila como conflict com o erro real
      if (
        res &&
        (res.status === 400 ||
          res.status === 404 ||
          res.status === 409 ||
          res.status === 422)
      ) {
        const conflictErr = await parseHttpErrorResponse(
          res,
          `HTTP ${res.status}`,
        );
        lastConflictError = conflictErr;
        mutateOutbox((current) =>
          current.map((o) =>
            o.id === op.id
              ? {
                  ...o,
                  attempts: (o.attempts || 0) + 1,
                  status: "conflict",
                  lastError: conflictErr.message,
                  lastAttemptAt: Date.now(),
                }
              : o,
          ),
        );
        continue;
      }

      // 5. Falha de rede ou erro do servidor (5xx / outros): mantém na fila e pausa o lote
      const transientErr = res
        ? await parseHttpErrorResponse(
            res,
            "Servidor ou conexão indisponível. Alterações mantidas na fila local.",
          )
        : networkError ??
          new EpisodeSyncHttpError(
            "Servidor ou conexão indisponível. Alterações mantidas na fila local.",
            { status: 0, category: "network" },
          );

      mutateOutbox((current) =>
        current.map((o) =>
          o.id === op.id
            ? {
                ...o,
                attempts: (o.attempts || 0) + 1,
                status: "pending",
                lastError: transientErr.message,
                lastAttemptAt: Date.now(),
              }
            : o,
        ),
      );
      console.warn(
        "[episode-writer] Servidor ou rede indisponível. Operações mantidas no Outbox.",
      );
      return {
        processed: processedCount,
        remaining: readOutbox().length,
        error: transientErr.message,
        errorCategory: transientErr.category,
      };
    }

    if (failedParents.size > 0) {
      const firstParentErr = Array.from(failedParents.values())[0];
      return {
        processed: processedCount,
        remaining: readOutbox().length,
        error: firstParentErr.message,
        errorCategory: firstParentErr.category,
      };
    }

    if (lastConflictError) {
      return {
        processed: processedCount,
        remaining: readOutbox().length,
        error: lastConflictError.message,
        errorCategory: lastConflictError.category,
      };
    }

    return {
      processed: processedCount,
      remaining: readOutbox().length,
    };
  } finally {
    isFlushing = false;
  }
}

/**
 * Tenta persistir a criação ou edição de um episódio no servidor.
 * Se falhar por rede/servidor ou validação, preserva o episódio no Outbox com todos os campos
 * e classifica o erro corretamente sem mascarar falhas de auth/validação/conflito como offline.
 */
export async function persistEpisode(
  animeId: string,
  seasonNumber: number,
  episode: Episode,
  animeTitle?: string,
  options?: { replaceThumbnail?: boolean },
): Promise<PersistEpisodeResult> {
  const hasValidUrlSource = [
    episode.videoUrl,
    episode.videoUrl2,
    episode.videoUrl3,
    episode.videoUrl4,
    episode.videoUrl5,
  ].some(isPersistablePlayableVideoUrl);
  const hikariPlayerValidation = validateHikariPlayerEpisodeId(
    episode.hikariPlayerEpisodeId,
  );
  const hasPlayableSource = hasEpisodePlayableSource(episode);

  // Não publicar automaticamente episódios sem aprovação explícita do administrador.
  // Se o administrador marcou como publicado mas não há fonte válida, bloqueia antes do envio.
  if (episode.published === true && !hasPlayableSource) {
    return {
      confirmed: false,
      queued: false,
      status: "conflict",
      errorCategory: "validation",
      error: !hikariPlayerValidation.valid
        ? hikariPlayerValidation.error ||
          "ID do episódio no Hikari Player inválido."
        : "Um episódio só pode ser publicado quando possuir pelo menos uma fonte válida de reprodução (URL de vídeo de Player 1 a Player 5 ou ID válido do Hikari Player).",
    };
  }

  const isPublished = episode.published === true && hasPlayableSource;
  const rawThumbnail = episode.thumbnail?.trim() || "";
  const isUnresolvedHikariId = isHikariPlayerIdThumbnailCandidate(rawThumbnail);
  const shouldReplaceThumbnail = isUnresolvedHikariId
    ? false
    : Boolean(options?.replaceThumbnail);

  // Garantir que episódios de cadastros Dublados/duplicados nunca carreguem IDs externos
  // (ex.: `kitsu-ep-50792-1`) ou IDs pertencentes ao anime Legendado, preservando estabilidade em retries.
  let effectiveEpisodeId = episode.id;
  let preservedExternalEpisodeId =
    typeof episode.externalEpisodeId === "string" && episode.externalEpisodeId.trim()
      ? episode.externalEpisodeId.trim()
      : undefined;

  if (typeof window !== "undefined") {
    repairDubbedOutboxEpisodeIds();
    const localAnimes = useHikariStore.getState().animes || [];
    const targetAnime = localAnimes.find((a) => a.id === animeId);
    const isDubbedTarget = Boolean(
      (targetAnime && isDubbedAnimeRecord(targetAnime)) ||
        animeId === "local-a96d58dd-39a3-438d-af0f-4ee50b78ca1e" ||
        (animeId.startsWith("local-") &&
          (episode.audio === "dub" ||
            isDubbedAnimeRecord({ id: animeId, title: animeTitle }))),
    );

    if (isDubbedTarget) {
      const subbedForbiddenIds = new Set<string>([animeId]);
      if (targetAnime?.anilistId) subbedForbiddenIds.add(String(targetAnime.anilistId));
      if (targetAnime?.kitsuId) subbedForbiddenIds.add(String(targetAnime.kitsuId));
      if (targetAnime?.malId) subbedForbiddenIds.add(String(targetAnime.malId));
      for (const a of localAnimes) {
        if (!a?.id || a.id === animeId || isDubbedAnimeRecord(a)) continue;
        for (const s of a.seasons ?? []) {
          for (const ep of s?.episodes ?? []) {
            if (ep?.id?.trim()) subbedForbiddenIds.add(ep.id.trim());
          }
        }
      }

      const currentOps = readOutbox();
      const existingSlotOp = currentOps.find(
        (o) =>
          o.animeId === animeId &&
          o.type === "upsert" &&
          o.seasonNumber === seasonNumber &&
          o.episodeNumber === episode.number,
      );

      const usedIds = new Set<string>();
      for (const s of targetAnime?.seasons ?? []) {
        for (const ep of s?.episodes ?? []) {
          if (
            ep?.id &&
            ep.id !== episode.id &&
            !isExternalEpisodeId(ep.id) &&
            !subbedForbiddenIds.has(ep.id)
          ) {
            usedIds.add(ep.id);
          }
        }
      }
      for (const o of currentOps) {
        if (
          o.animeId === animeId &&
          o.episodeId &&
          !isExternalEpisodeId(o.episodeId) &&
          !subbedForbiddenIds.has(o.episodeId)
        ) {
          usedIds.add(o.episodeId);
        }
      }

      const rawEpId = episode.id?.trim() || "";
      const needsRepair =
        !rawEpId ||
        isExternalEpisodeId(rawEpId) ||
        subbedForbiddenIds.has(rawEpId);

      if (needsRepair) {
        if (
          existingSlotOp?.episodeId &&
          !isExternalEpisodeId(existingSlotOp.episodeId) &&
          !subbedForbiddenIds.has(existingSlotOp.episodeId)
        ) {
          effectiveEpisodeId = existingSlotOp.episodeId;
        } else {
          effectiveEpisodeId = generateUniqueEpisodeId(usedIds, [
            ...subbedForbiddenIds,
            ...(rawEpId ? [rawEpId] : []),
          ]);
        }
        if (!preservedExternalEpisodeId && isExternalEpisodeId(rawEpId)) {
          preservedExternalEpisodeId = rawEpId;
        }
        if (rawEpId && effectiveEpisodeId !== rawEpId) {
          reconcileLocalEpisode(animeId, seasonNumber, rawEpId, effectiveEpisodeId);
        }
      }
    }
  }

  const basePayload: EpisodePayload = {
    id: effectiveEpisodeId,
    ...(preservedExternalEpisodeId
      ? { externalEpisodeId: preservedExternalEpisodeId }
      : {}),
    animeId,
    seasonNumber,
    number: episode.number,
    title: episode.title,
    thumbnail: isUnresolvedHikariId ? null : rawThumbnail || null,
    duration: episode.duration || null,
    synopsis: episode.synopsis || null,
    videoUrl: episode.videoUrl || null,
    videoUrl2: episode.videoUrl2 || null,
    videoUrl3: episode.videoUrl3 || null,
    videoUrl4: episode.videoUrl4 || null,
    videoUrl5: episode.videoUrl5 || null,
    hikariPlayerEpisodeId: hikariPlayerValidation.valid
      ? hikariPlayerValidation.value
      : hasValidUrlSource
        ? null
        : normalizeHikariPlayerEpisodeId(episode.hikariPlayerEpisodeId),
    ...(episode.audio !== undefined
      ? { audio: normalizeEpisodeAudio(episode.audio) }
      : {}),
    ...(episode.openingStartSeconds !== undefined
      ? { openingStartSeconds: episode.openingStartSeconds }
      : {}),
    ...(episode.openingEndSeconds !== undefined
      ? { openingEndSeconds: episode.openingEndSeconds }
      : {}),
    ...(episode.recentBadges !== undefined
      ? { recentBadges: normalizeAnimeRecentBadges(episode.recentBadges) }
      : {}),
    published: isPublished,
    replaceSources: true,
    replaceThumbnail: shouldReplaceThumbnail,
    animeTitle: animeTitle || null,
  };

  let effectiveAnimeId = animeId;
  try {
    effectiveAnimeId = await consolidateAnimeParent(animeId);
  } catch (err) {
    const classified = classifySyncError(
      err,
      "Falha ao consolidar cadastro do anime no servidor.",
    );

    if (classified.category === "auth") {
      mutateOutbox((ops) =>
        ops.map((o) =>
          o.animeId === animeId &&
          (o.episodeId === effectiveEpisodeId ||
            o.episodeId === episode.id ||
            (o.seasonNumber === seasonNumber && o.episodeNumber === episode.number))
            ? { ...o, lastError: classified.message, lastAttemptAt: Date.now() }
            : o,
        ),
      );
      return {
        confirmed: false,
        queued: false,
        canonicalId:
          effectiveEpisodeId !== episode.id ? effectiveEpisodeId : undefined,
        status: "conflict",
        errorStatus: classified.status,
        errorCategory: "auth",
        error: classified.message,
      };
    }

    const isConflictOrValidation =
      classified.category === "validation" || classified.category === "conflict";

    const op = enqueue({
      type: "upsert",
      episodeId: effectiveEpisodeId,
      animeId,
      seasonNumber,
      episodeNumber: episode.number,
      payload: basePayload,
    });

    if (!op) {
      return {
        confirmed: false,
        queued: false,
        canonicalId:
          effectiveEpisodeId !== episode.id ? effectiveEpisodeId : undefined,
        status: "conflict",
        errorStatus: classified.status,
        errorCategory: classified.category,
        error:
          "Fila de sincronização cheia (40 operações). Conecte-se para sincronizar antes de adicionar novas alterações.",
      };
    }

    mutateOutbox((ops) =>
      ops.map((o) =>
        o.id === op.id
          ? {
              ...o,
              status: isConflictOrValidation ? "conflict" : "pending",
              lastError: classified.message,
              attempts: Math.max(1, o.attempts || 0),
              lastAttemptAt: Date.now(),
            }
          : o,
      ),
    );

    return {
      confirmed: false,
      queued: true,
      canonicalId:
        effectiveEpisodeId !== episode.id ? effectiveEpisodeId : undefined,
      status: isConflictOrValidation ? "conflict" : "pending",
      errorStatus: classified.status,
      errorCategory: classified.category,
      error: classified.message,
    };
  }

  // Limpa tombstone do episódio na republicação ou salvamento (tanto ID original quanto canônico)
  clearTombstone(effectiveEpisodeId, {
    animeId: effectiveAnimeId,
    seasonNumber,
    episodeNumber: episode.number,
  });
  if (effectiveEpisodeId !== episode.id) {
    clearTombstone(episode.id, {
      animeId: effectiveAnimeId,
      seasonNumber,
      episodeNumber: episode.number,
    });
  }
  if (effectiveAnimeId !== animeId) {
    clearTombstone(effectiveEpisodeId, {
      animeId,
      seasonNumber,
      episodeNumber: episode.number,
    });
  }

  const payload: EpisodePayload =
    effectiveAnimeId === basePayload.animeId
      ? basePayload
      : { ...basePayload, animeId: effectiveAnimeId };

  try {
    const res = await fetch("/api/admin/catalog-episode", {
      method: "POST",
      headers: buildAdminRequestHeaders(),
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      let canonicalId = effectiveEpisodeId;
      let serverThumbnail: string | null | undefined = undefined;
      let serverPublished: boolean = isPublished;
      let serverPublishedAt: string | null = null;
      let serverHikariPlayerEpisodeId: string | null | undefined = undefined;
      let serverAudio: EpisodeAudio | null | undefined = undefined;
      let serverOpeningStartSeconds: number | null | undefined = undefined;
      let serverOpeningEndSeconds: number | null | undefined = undefined;
      let serverRecentBadges: AnimeRecentBadges | undefined = undefined;
      try {
        const j = await res.json();
        if (j?.episodeId || j?.canonicalId) {
          canonicalId = j.episodeId || j.canonicalId;
        }
        if (j?.thumbnail !== undefined) {
          serverThumbnail =
            j.thumbnail === null
              ? null
              : sanitizeEpisodeThumbnailUrl(String(j.thumbnail));
        }
        if (typeof j?.published === "boolean") {
          serverPublished = j.published;
        }
        if (j?.publishedAt !== undefined) {
          serverPublishedAt = j.publishedAt;
        }
        if (j?.hikariPlayerEpisodeId !== undefined) {
          serverHikariPlayerEpisodeId = normalizeHikariPlayerEpisodeId(
            j.hikariPlayerEpisodeId,
          );
        }
        if (j?.audio !== undefined) {
          serverAudio = normalizeEpisodeAudio(j.audio);
        }
        if (j?.openingStartSeconds !== undefined) {
          serverOpeningStartSeconds = j.openingStartSeconds;
        }
        if (j?.openingEndSeconds !== undefined) {
          serverOpeningEndSeconds = j.openingEndSeconds;
        }
        if (j?.recentBadges && typeof j.recentBadges === "object") {
          serverRecentBadges = normalizeAnimeRecentBadges(j.recentBadges);
        }
      } catch {
        // ignore
      }

      // Reconcilia o ID se for diferente do ID local (considerando ID original e efetivo)
      if (canonicalId !== effectiveEpisodeId) {
        reconcileLocalEpisode(effectiveAnimeId, seasonNumber, effectiveEpisodeId, canonicalId);
        if (effectiveAnimeId !== animeId) {
          reconcileLocalEpisode(animeId, seasonNumber, effectiveEpisodeId, canonicalId);
        }
      }
      if (canonicalId !== episode.id) {
        reconcileLocalEpisode(effectiveAnimeId, seasonNumber, episode.id, canonicalId);
        if (effectiveAnimeId !== animeId) {
          reconcileLocalEpisode(animeId, seasonNumber, episode.id, canonicalId);
        }
      }

      // Limpa qualquer pendência deste episódio no Outbox (pelo ID original ou canônico do anime e episódio)
      mutateOutbox((currentOps) =>
        currentOps.filter(
          (o) =>
            !(
              (o.animeId === animeId || o.animeId === effectiveAnimeId) &&
              (o.episodeId === episode.id ||
                o.episodeId === effectiveEpisodeId ||
                o.episodeId === canonicalId ||
                (o.seasonNumber === seasonNumber && o.episodeNumber === episode.number))
            ),
        ),
      );

      invalidateCatalogEpisodesCache(animeId, effectiveAnimeId);

      return {
        confirmed: true,
        queued: false,
        canonicalId,
        thumbnail: serverThumbnail,
        published: serverPublished,
        publishedAt: serverPublishedAt,
        hikariPlayerEpisodeId: serverHikariPlayerEpisodeId,
        audio: serverAudio,
        openingStartSeconds: serverOpeningStartSeconds,
        openingEndSeconds: serverOpeningEndSeconds,
        recentBadges: serverRecentBadges,
        status: "synced",
      };
    }

    if (res.status === 401 || res.status === 403) {
      const authErr = await parseHttpErrorResponse(
        res,
        "Acesso negado: sessão expirada ou privilégios de administrador necessários.",
      );
      mutateOutbox((ops) =>
        ops.map((o) =>
          (o.animeId === animeId || o.animeId === effectiveAnimeId) &&
          (o.episodeId === effectiveEpisodeId ||
            o.episodeId === episode.id ||
            (o.seasonNumber === seasonNumber && o.episodeNumber === episode.number))
            ? { ...o, lastError: authErr.message, lastAttemptAt: Date.now() }
            : o,
        ),
      );
      return {
        confirmed: false,
        queued: false,
        canonicalId:
          effectiveEpisodeId !== episode.id ? effectiveEpisodeId : undefined,
        status: "conflict",
        errorStatus: res.status,
        errorCategory: "auth",
        error: authErr.message,
      };
    }

    // Se for 400, 404, 409 ou 422 (validação/conflito): PRESERVA no Outbox com status "conflict" e o erro real
    if (
      res.status === 400 ||
      res.status === 404 ||
      res.status === 409 ||
      res.status === 422
    ) {
      const conflictErr = await parseHttpErrorResponse(
        res,
        "Erro de validação ao salvar episódio.",
      );

      if (effectiveAnimeId !== animeId) {
        mutateOutbox((ops) =>
          ops.filter(
            (o) =>
              !(
                o.animeId === animeId &&
                (o.episodeId === effectiveEpisodeId ||
                  o.episodeId === episode.id ||
                  (o.seasonNumber === seasonNumber && o.episodeNumber === episode.number))
              ),
          ),
        );
      }

      const op = enqueue({
        type: "upsert",
        episodeId: effectiveEpisodeId,
        animeId: effectiveAnimeId,
        seasonNumber,
        episodeNumber: episode.number,
        payload,
      });

      if (op) {
        mutateOutbox((ops) =>
          ops.map((o) =>
            o.id === op.id
              ? {
                  ...o,
                  status: "conflict",
                  lastError: conflictErr.message,
                  attempts: 1,
                  lastAttemptAt: Date.now(),
                }
              : o,
          ),
        );
      }

      return {
        confirmed: false,
        queued: Boolean(op),
        canonicalId:
          effectiveEpisodeId !== episode.id ? effectiveEpisodeId : undefined,
        status: "conflict",
        errorStatus: res.status,
        errorCategory: conflictErr.category,
        error: conflictErr.message,
      };
    }

    // Erros 429, 5xx ou outros do servidor: enfileira no Outbox como "pending" preservando payload e erro real
    const transientErr = await parseHttpErrorResponse(
      res,
      `Servidor temporariamente indisponível (${res.status}). Alteração mantida na fila de sincronização.`,
    );

    if (effectiveAnimeId !== animeId) {
      mutateOutbox((ops) =>
        ops.filter(
          (o) =>
            !(
              o.animeId === animeId &&
              (o.episodeId === effectiveEpisodeId ||
                o.episodeId === episode.id ||
                (o.seasonNumber === seasonNumber && o.episodeNumber === episode.number))
            ),
        ),
      );
    }

    const op = enqueue({
      type: "upsert",
      episodeId: effectiveEpisodeId,
      animeId: effectiveAnimeId,
      seasonNumber,
      episodeNumber: episode.number,
      payload,
    });

    if (!op) {
      return {
        confirmed: false,
        queued: false,
        canonicalId:
          effectiveEpisodeId !== episode.id ? effectiveEpisodeId : undefined,
        status: "conflict",
        errorStatus: res.status,
        errorCategory: transientErr.category,
        error:
          "Fila de sincronização cheia (40 operações). Conecte-se para sincronizar antes de adicionar novas alterações.",
      };
    }

    mutateOutbox((ops) =>
      ops.map((o) =>
        o.id === op.id
          ? {
              ...o,
              status: "pending",
              lastError: transientErr.message,
              attempts: 1,
              lastAttemptAt: Date.now(),
            }
          : o,
      ),
    );

    return {
      confirmed: false,
      queued: true,
      canonicalId:
        effectiveEpisodeId !== episode.id ? effectiveEpisodeId : undefined,
      status: "pending",
      errorStatus: res.status,
      errorCategory: transientErr.category,
      error: transientErr.message,
    };
  } catch (err) {
    // Falha de rede: enfileira no Outbox como "pending" preservando payload completo
    const netErr = classifySyncError(
      err,
      "Conexão de rede indisponível. Episódio preservado na fila local para envio automático.",
    );

    if (effectiveAnimeId !== animeId) {
      mutateOutbox((ops) =>
        ops.filter(
          (o) =>
            !(
              o.animeId === animeId &&
              (o.episodeId === effectiveEpisodeId ||
                o.episodeId === episode.id ||
                (o.seasonNumber === seasonNumber && o.episodeNumber === episode.number))
            ),
        ),
      );
    }

    const op = enqueue({
      type: "upsert",
      episodeId: effectiveEpisodeId,
      animeId: effectiveAnimeId,
      seasonNumber,
      episodeNumber: episode.number,
      payload,
    });

    if (!op) {
      return {
        confirmed: false,
        queued: false,
        canonicalId:
          effectiveEpisodeId !== episode.id ? effectiveEpisodeId : undefined,
        status: "conflict",
        errorStatus: 0,
        errorCategory: "network",
        error:
          "Fila de sincronização cheia (40 operações). Conecte-se para sincronizar antes de adicionar novas alterações.",
      };
    }

    mutateOutbox((ops) =>
      ops.map((o) =>
        o.id === op.id
          ? {
              ...o,
              status: "pending",
              lastError: netErr.message,
              attempts: 1,
              lastAttemptAt: Date.now(),
            }
          : o,
      ),
    );

    return {
      confirmed: false,
      queued: true,
      canonicalId:
        effectiveEpisodeId !== episode.id ? effectiveEpisodeId : undefined,
      status: "pending",
      errorStatus: 0,
      errorCategory: "network",
      error:
        "Conexão de rede indisponível. Episódio preservado na fila local para envio automático.",
    };
  }
}

/**
 * Tenta persistir a exclusão de um episódio no servidor.
 * Registra o tombstone imediatamente para proteger a experiência local e offline.
 * Se falhar por rede/servidor, enfileira automaticamente no Outbox.
 */
export async function persistEpisodeDelete(
  animeId: string,
  seasonNumber: number,
  episodeId: string,
  episodeNumber?: number,
): Promise<{ confirmed: boolean; queued: boolean; error?: string }> {
  // Registra tombstone imediatamente para proteger a experiência local e offline com escopo de anime e slot
  addTombstone(episodeId, { animeId, seasonNumber, episodeNumber });

  try {
    const res = await fetch("/api/admin/catalog-episode", {
      method: "DELETE",
      headers: buildAdminRequestHeaders(),
      credentials: "include",
      body: JSON.stringify({
        id: episodeId,
        animeId,
      }),
    });

    if (res.ok) {
      return { confirmed: true, queued: false };
    }

    if (res.status === 401 || res.status === 403) {
      let errMsg = "Acesso negado: privilégios de administrador necessários.";
      try {
        const j = await res.json();
        if (j?.error) errMsg = j.error;
      } catch {
        // ignore
      }
      return { confirmed: false, queued: false, error: errMsg };
    }

    // Erros 5xx ou 400/409: enfileira no Outbox
    const op = enqueue({
      type: "delete",
      episodeId,
      animeId,
      seasonNumber,
      episodeNumber,
    });

    if (!op) {
      return {
        confirmed: false,
        queued: false,
        error:
          "Fila de sincronização cheia (40 operações). Conecte-se para sincronizar antes de adicionar novas alterações.",
      };
    }

    return { confirmed: false, queued: true };
  } catch {
    // Falha de rede: enfileira no Outbox
    const op = enqueue({
      type: "delete",
      episodeId,
      animeId,
      seasonNumber,
    });

    if (!op) {
      return {
        confirmed: false,
        queued: false,
        error:
          "Fila de sincronização cheia (40 operações). Conecte-se para sincronizar antes de adicionar novas alterações.",
      };
    }

    return { confirmed: false, queued: true };
  }
}

/**
 * Consulta o status de um episódio na fila local do outbox:
 * - "conflict": falhou com erro de validação ou conflito (400, 404, 409).
 * - "pending": alteração aguardando envio na rede.
 * - "synced": sem operações pendentes no outbox para este episódio.
 */
export function getEpisodeOutboxStatus(
  animeId: string,
  episodeId: string,
): "synced" | "pending" | "conflict" {
  const ops = readOutbox();
  const op = ops.find((o) => o.episodeId === episodeId && o.animeId === animeId);
  if (!op) return "synced";
  return op.status === "conflict" ? "conflict" : "pending";
}

/**
 * Descarta uma operação específica do Outbox (usado para intervenção em conflitos permanentes).
 */
export function dismissOutboxOperation(operationId: string): void {
  const ops = readOutbox();
  const filtered = ops.filter((o) => o.id !== operationId);
  writeOutbox(filtered);
}

/**
 * Remove todas as operações pendentes do Outbox associadas a um anime específico.
 */
export function clearOutboxForAnime(animeId: string): void {
  if (!animeId) return;
  const ops = readOutbox();
  const filtered = ops.filter((o) => o.animeId !== animeId);
  if (filtered.length !== ops.length) {
    writeOutbox(filtered);
  }
}
