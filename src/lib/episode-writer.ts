import type { Episode } from "@/lib/types";
import { getBearerToken } from "@/lib/auth/client";
import { addTombstone, clearTombstone } from "@/lib/catalog-storage";
import { hasEpisodePlayableSource } from "@/lib/published-episodes";
import { useHikariStore } from "@/lib/store";

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
  published?: boolean;
  replaceSources?: boolean;
  animeTitle?: string | null;
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

export interface PersistEpisodeResult {
  confirmed: boolean;
  queued: boolean;
  canonicalId?: string;
  published?: boolean;
  publishedAt?: string | null;
  status: "synced" | "pending" | "conflict";
  error?: string;
}

let isFlushing = false;

function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
}

/**
 * Lê todas as operações pendentes salvas no localStorage.
 */
export function readOutbox(): OutboxOperation[] {
  if (!isLocalStorageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as OutboxOperation[];
    }
  } catch (err) {
    console.warn("[episode-writer] Falha ao ler outbox:", err);
  }
  return [];
}

/**
 * Persiste a lista de operações no localStorage sem descartar silenciosamente itens.
 */
export function writeOutbox(ops: OutboxOperation[]): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(ops));
  } catch (err) {
    console.warn("[episode-writer] Falha ao salvar outbox:", err);
  }
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

/**
 * Executa o reenvio sequencial de todas as operações pendentes no Outbox.
 * Protegido contra execuções concorrentes e loops infinitos em erros de conflito.
 */
export async function flushOutbox(options?: {
  forceConflicts?: boolean;
}): Promise<{
  processed: number;
  remaining: number;
  error?: string;
}> {
  if (typeof window === "undefined") {
    return { processed: 0, remaining: 0 };
  }

  if (isFlushing) {
    return { processed: 0, remaining: readOutbox().length };
  }

  const ops = readOutbox();
  if (ops.length === 0) {
    return { processed: 0, remaining: 0 };
  }

  isFlushing = true;
  let processedCount = 0;
  const remainingOps = [...ops];

  try {
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];

      // Erros permanentes/conflitos não devem entrar em ciclo infinito de tentativas automáticas
      if (op.status === "conflict" && !options?.forceConflicts) {
        continue;
      }

      let res: Response | null = null;
      let networkFailed = false;

      try {
        if (op.type === "upsert" && op.payload) {
          res = await fetch("/api/admin/catalog-episode", {
            method: "POST",
            headers: buildAdminRequestHeaders(),
            credentials: "include",
            body: JSON.stringify(op.payload),
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
        networkFailed = true;
        op.lastError = err instanceof Error ? err.message : String(err);
      }

      // 1. Sucesso na operação (2xx)
      if (res && res.ok) {
        processedCount++;

        // Reconcilia ID canônico caso o servidor tenha retornado um ID preexistente diferente
        try {
          const json = await res.json();
          const canonicalId = json?.episodeId || json?.canonicalId;
          if (canonicalId && canonicalId !== op.episodeId) {
            reconcileLocalEpisode(op.animeId, op.seasonNumber, op.episodeId, canonicalId);
          }
        } catch {
          // ignore
        }

        // Remove da lista de pendências
        const idx = remainingOps.findIndex((o) => o.id === op.id);
        if (idx !== -1) {
          remainingOps.splice(idx, 1);
          writeOutbox(remainingOps);
        }
        continue;
      }

      // 2. Erros de autorização (401 ou 403): interrompe o flush imediatamente
      if (res && (res.status === 401 || res.status === 403)) {
        console.warn("[episode-writer] Flush interrompido: autenticação necessária ou sem permissão.");
        writeOutbox(remainingOps);
        return {
          processed: processedCount,
          remaining: remainingOps.length,
          error: "Sessão expirada ou não autorizada. Faça login com conta de administrador.",
        };
      }

      // 3. Limite de requisições (429): aguarda próxima tentativa
      if (res && res.status === 429) {
        console.warn("[episode-writer] Rate limit atingido (429). Retentando mais tarde.");
        writeOutbox(remainingOps);
        return {
          processed: processedCount,
          remaining: remainingOps.length,
          error: "Muitas requisições. Sincronização continuará em instantes.",
        };
      }

      // 4. Erros de validação ou conflito (400, 404, 409): preserva na fila como conflict
      if (res && (res.status === 400 || res.status === 404 || res.status === 409)) {
        op.attempts = (op.attempts || 0) + 1;
        op.status = "conflict";
        let errMsg = `HTTP ${res.status}`;
        try {
          const json = await res.json();
          if (json?.error) errMsg = json.error;
        } catch {
          // ignore
        }
        op.lastError = errMsg;
        op.lastAttemptAt = Date.now();

        // Preserva a operação em conflito na fila para inspeção/correção sem bloqueio
        writeOutbox(remainingOps);
        continue;
      }

      // 5. Falha de rede ou erro do servidor (5xx): mantém na fila e pausa o lote
      if (networkFailed || (res && res.status >= 500)) {
        op.attempts = (op.attempts || 0) + 1;
        op.status = "pending";
        op.lastAttemptAt = Date.now();
        writeOutbox(remainingOps);
        console.warn("[episode-writer] Servidor ou rede indisponível. Operações mantidas no Outbox.");
        return {
          processed: processedCount,
          remaining: remainingOps.length,
          error: "Servidor ou conexão indisponível. Alterações mantidas na fila local.",
        };
      }
    }
  } finally {
    isFlushing = false;
  }

  return {
    processed: processedCount,
    remaining: remainingOps.length,
  };
}

/**
 * Tenta persistir a criação ou edição de um episódio no servidor.
 * Se falhar por rede/servidor ou validação, preserva o episódio no Outbox sem descartar.
 * Reconcilia o ID canônico se retornado pelo PostgreSQL.
 */
export async function persistEpisode(
  animeId: string,
  seasonNumber: number,
  episode: Episode,
  animeTitle?: string,
): Promise<PersistEpisodeResult> {
  // Limpa tombstone do episódio na republicação ou salvamento
  clearTombstone(episode.id, {
    animeId,
    seasonNumber,
    episodeNumber: episode.number,
  });

  const hasPlayableSource = hasEpisodePlayableSource(episode);

  // Não publicar automaticamente episódios sem aprovação explícita do administrador.
  // Se o administrador marcou como publicado mas não há fonte válida, bloqueia antes do envio.
  if (episode.published === true && !hasPlayableSource) {
    return {
      confirmed: false,
      queued: false,
      status: "conflict",
      error:
        "Um episódio só pode ser publicado quando possuir pelo menos uma fonte válida de reprodução.",
    };
  }

  const isPublished = episode.published === true && hasPlayableSource;

  const payload: EpisodePayload = {
    id: episode.id,
    animeId,
    seasonNumber,
    number: episode.number,
    title: episode.title,
    thumbnail: episode.thumbnail || null,
    duration: episode.duration || null,
    synopsis: episode.synopsis || null,
    videoUrl: episode.videoUrl || null,
    videoUrl2: episode.videoUrl2 || null,
    videoUrl3: episode.videoUrl3 || null,
    videoUrl4: episode.videoUrl4 || null,
    videoUrl5: episode.videoUrl5 || null,
    published: isPublished,
    replaceSources: true,
    animeTitle: animeTitle || null,
  };

  try {
    const res = await fetch("/api/admin/catalog-episode", {
      method: "POST",
      headers: buildAdminRequestHeaders(),
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      let canonicalId = episode.id;
      let serverPublished: boolean = isPublished;
      let serverPublishedAt: string | null = null;
      try {
        const j = await res.json();
        if (j?.episodeId || j?.canonicalId) {
          canonicalId = j.episodeId || j.canonicalId;
        }
        if (typeof j?.published === "boolean") {
          serverPublished = j.published;
        }
        if (j?.publishedAt !== undefined) {
          serverPublishedAt = j.publishedAt;
        }
      } catch {
        // ignore
      }

      // Reconcilia o ID se for diferente do ID local
      if (canonicalId !== episode.id) {
        reconcileLocalEpisode(animeId, seasonNumber, episode.id, canonicalId);
      }

      // Limpa qualquer pendência deste episódio no Outbox
      const currentOps = readOutbox();
      const filtered = currentOps.filter(
        (o) =>
          !(
            o.animeId === animeId &&
            (o.episodeId === episode.id || o.episodeId === canonicalId)
          ),
      );
      writeOutbox(filtered);

      return {
        confirmed: true,
        queued: false,
        canonicalId,
        published: serverPublished,
        publishedAt: serverPublishedAt,
        status: "synced",
      };
    }

    if (res.status === 401 || res.status === 403) {
      let errMsg = "Acesso negado: privilégios de administrador necessários.";
      try {
        const j = await res.json();
        if (j?.error) errMsg = j.error;
      } catch {
        // ignore
      }
      return {
        confirmed: false,
        queued: false,
        status: "conflict",
        error: errMsg,
      };
    }

    // Se for 400 ou 409 (validação/conflito): PRESERVA no Outbox com status "conflict"
    if (res.status === 400 || res.status === 409) {
      let errMsg = "Erro de validação ao salvar episódio.";
      try {
        const j = await res.json();
        if (j?.error) errMsg = j.error;
      } catch {
        // ignore
      }

      const op = enqueue({
        type: "upsert",
        episodeId: episode.id,
        animeId,
        seasonNumber,
        episodeNumber: episode.number,
        payload,
      });

      if (op) {
        op.status = "conflict";
        op.lastError = errMsg;
        op.attempts = 1;
        op.lastAttemptAt = Date.now();
        writeOutbox(readOutbox().map((o) => (o.id === op.id ? op : o)));
      }

      return {
        confirmed: false,
        queued: Boolean(op),
        status: "conflict",
        error: errMsg,
      };
    }

    // Erros 5xx ou outros do servidor: enfileira no Outbox como "pending"
    const op = enqueue({
      type: "upsert",
      episodeId: episode.id,
      animeId,
      seasonNumber,
      episodeNumber: episode.number,
      payload,
    });

    if (!op) {
      return {
        confirmed: false,
        queued: false,
        status: "conflict",
        error:
          "Fila de sincronização cheia (40 operações). Conecte-se para sincronizar antes de adicionar novas alterações.",
      };
    }

    return {
      confirmed: false,
      queued: true,
      status: "pending",
      error: "Servidor temporariamente indisponível. Alteração mantida na fila de sincronização.",
    };
  } catch {
    // Falha de rede: enfileira no Outbox como "pending"
    const op = enqueue({
      type: "upsert",
      episodeId: episode.id,
      animeId,
      seasonNumber,
      episodeNumber: episode.number,
      payload,
    });

    if (!op) {
      return {
        confirmed: false,
        queued: false,
        status: "conflict",
        error:
          "Fila de sincronização cheia (40 operações). Conecte-se para sincronizar antes de adicionar novas alterações.",
      };
    }

    return {
      confirmed: false,
      queued: true,
      status: "pending",
      error: "Conexão de rede indisponível. Episódio preservado na fila local para envio automático.",
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
