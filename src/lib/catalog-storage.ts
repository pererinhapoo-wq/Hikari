import type { LocalAnime } from "@/lib/types";

const DB_NAME = "hikari";
const STORE_NAME = "catalog";
const CATALOG_KEY = "animes";
const FALLBACK_KEY = "hikari-catalog-fallback-v1";
const DEBOUNCE_MS = 800;

let dbInstance: IDBDatabase | null = null;
let dbFailedPermanently = false;

function isIndexedDBAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (dbFailedPermanently) return false;
  return typeof window.indexedDB !== "undefined";
}

function openCatalogDB(): Promise<IDBDatabase | null> {
  if (!isIndexedDBAvailable()) return Promise.resolve(null);
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        try {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        } catch (err) {
          console.warn("[Hikari] Erro ao criar object store no IndexedDB:", err);
        }
      };

      request.onsuccess = () => {
        dbInstance = request.result;
        dbInstance.onversionchange = () => {
          try {
            dbInstance?.close();
          } catch (err) {
            void err;
          }
          dbInstance = null;
        };
        dbInstance.onclose = () => {
          dbInstance = null;
        };
        resolve(dbInstance);
      };

      request.onerror = (err) => {
        console.warn("[Hikari] Falha ao abrir IndexedDB, usando fallback:", err);
        dbFailedPermanently = true;
        resolve(null);
      };

      request.onblocked = () => {
        console.warn("[Hikari] Abertura do IndexedDB bloqueada por outra aba.");
        resolve(null);
      };
    } catch (err) {
      console.warn("[Hikari] Exceção ao abrir IndexedDB:", err);
      dbFailedPermanently = true;
      resolve(null);
    }
  });
}

function readFallback(): LocalAnime[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as LocalAnime[];
    }
  } catch (err) {
    console.warn("[Hikari] Erro ao ler fallback do catálogo:", err);
  }
  return null;
}

function writeFallback(animes: LocalAnime[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(animes));
  } catch (err) {
    console.warn(
      "[Hikari] Falha de quota ao salvar fallback do catálogo no localStorage. Mantendo em memória.",
      err,
    );
  }
}

function clearFallback(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(FALLBACK_KEY);
  } catch (err) {
    void err;
  }
}

/**
 * Carrega a lista completa de animes persistida.
 * Tenta IndexedDB primeiro; se indisponível ou vazio, busca no fallback.
 */
export async function loadAnimes(): Promise<LocalAnime[]> {
  if (typeof window === "undefined") return [];

  // 1. Tentar ler do IndexedDB
  try {
    const db = await openCatalogDB();
    if (db) {
      const animes = await new Promise<LocalAnime[] | null>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const getReq = store.get(CATALOG_KEY);

          getReq.onsuccess = () => {
            const val = getReq.result;
            if (Array.isArray(val) && val.length > 0) {
              resolve(val as LocalAnime[]);
            } else {
              resolve(null);
            }
          };

          getReq.onerror = () => {
            resolve(null);
          };
        } catch {
          resolve(null);
        }
      });

      if (animes && animes.length > 0) {
        return animes;
      }
    }
  } catch (err) {
    console.warn("[Hikari] Erro ao ler catálogo do IndexedDB:", err);
  }

  // 2. Tentar recuperar do fallback caso IndexedDB não tenha ou tenha falhado
  const fallbackData = readFallback();
  if (fallbackData && fallbackData.length > 0) {
    return fallbackData;
  }

  return [];
}

let pendingAnimes: LocalAnime[] | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isSaving = false;
let nextSaveRequested = false;

/**
 * Agenda a gravação do catálogo com debounce de 800ms.
 * Evita gravações concorrentes e garante que a versão mais recente seja salva.
 */
export function scheduleSave(animes: LocalAnime[]): void {
  pendingAnimes = animes;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void flushAnimes();
  }, DEBOUNCE_MS);
}

/**
 * Grava imediatamente quaisquer animes pendentes no IndexedDB (ou fallback em caso de falha).
 */
export async function flushAnimes(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (!pendingAnimes) return;

  if (isSaving) {
    nextSaveRequested = true;
    return;
  }

  isSaving = true;
  const toSave = pendingAnimes;

  try {
    const db = await openCatalogDB();
    let savedToIDB = false;

    if (db) {
      savedToIDB = await new Promise<boolean>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          store.put(toSave, CATALOG_KEY);

          tx.oncomplete = () => {
            resolve(true);
          };

          tx.onerror = () => {
            resolve(false);
          };

          tx.onabort = () => {
            resolve(false);
          };
        } catch {
          resolve(false);
        }
      });
    }

    if (savedToIDB) {
      clearFallback();
    } else {
      writeFallback(toSave);
    }
  } catch (err) {
    console.warn("[Hikari] Erro durante gravação do catálogo:", err);
    writeFallback(toSave);
  } finally {
    isSaving = false;
    if (nextSaveRequested) {
      nextSaveRequested = false;
      void flushAnimes();
    }
  }
}

// Flush ao descarregar a página
if (typeof window !== "undefined") {
  const onUnload = () => {
    if (pendingAnimes) {
      void flushAnimes();
      if (dbFailedPermanently || !window.indexedDB) {
        writeFallback(pendingAnimes);
      }
    }
  };

  window.addEventListener("beforeunload", onUnload);
  window.addEventListener("pagehide", onUnload);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      onUnload();
    }
  });
}

// ==========================================
// HIKARI — Tombstones de Episódios Excluídos
// ==========================================
export const TOMBSTONE_KEY = "hikari-deleted-episodes-v1";
const MAX_TOMBSTONES = 500;

export interface TombstoneRecord {
  id: string;
  animeId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  deletedAt?: number;
}

/**
 * Lê a lista de registros estruturados de episódios excluídos (tombstones).
 * Compatível tanto com o formato legado (array de strings) quanto com o formato
 * estruturado com escopo de anime e slot da Etapa 3.
 * Seguro para SSR (retorna array vazio quando executado no servidor).
 */
export function readTombstoneRecords(): TombstoneRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TOMBSTONE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const records: TombstoneRecord[] = [];
      for (const item of parsed) {
        if (typeof item === "string" && item.trim()) {
          records.push({ id: item.trim() });
        } else if (
          item &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          item.id.trim()
        ) {
          records.push({
            id: item.id.trim(),
            animeId: typeof item.animeId === "string" ? item.animeId.trim() : undefined,
            seasonNumber: typeof item.seasonNumber === "number" ? item.seasonNumber : undefined,
            episodeNumber: typeof item.episodeNumber === "number" ? item.episodeNumber : undefined,
            deletedAt: typeof item.deletedAt === "number" ? item.deletedAt : undefined,
          });
        }
      }
      return records;
    }
  } catch (err) {
    console.warn("[catalog-storage] Erro ao ler tombstones do localStorage:", err);
  }
  return [];
}

/**
 * Lê a lista de IDs de episódios excluídos (tombstones) em formato simples para compatibilidade.
 */
export function readTombstones(): string[] {
  return readTombstoneRecords().map((t) => t.id);
}

/**
 * Registra um episódio excluído com contexto de anime e slot para evitar que reapareça
 * indevidamente em fallbacks locais, sem vazar para outros animes.
 */
export function addTombstone(
  episodeId: string,
  context?: { animeId?: string; seasonNumber?: number; episodeNumber?: number },
): void {
  if (typeof window === "undefined" || !episodeId || typeof episodeId !== "string") return;
  const cleanId = episodeId.trim();
  if (!cleanId) return;

  try {
    const current = readTombstoneRecords();
    const cleanAnimeId = context?.animeId?.trim();

    // Evita duplicar se já existir para o mesmo id ou mesmo slot do mesmo anime
    const exists = current.some((t) => {
      if (t.id === cleanId && (!cleanAnimeId || !t.animeId || t.animeId === cleanAnimeId)) {
        return true;
      }
      if (
        cleanAnimeId &&
        t.animeId === cleanAnimeId &&
        context?.seasonNumber !== undefined &&
        t.seasonNumber === context.seasonNumber &&
        context?.episodeNumber !== undefined &&
        t.episodeNumber === context.episodeNumber
      ) {
        return true;
      }
      return false;
    });

    if (exists) return;

    const newRecord: TombstoneRecord = {
      id: cleanId,
      animeId: cleanAnimeId,
      seasonNumber: context?.seasonNumber,
      episodeNumber: context?.episodeNumber,
      deletedAt: Date.now(),
    };

    const next = [...current, newRecord];
    const clamped = next.slice(Math.max(0, next.length - MAX_TOMBSTONES));
    window.localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(clamped));
  } catch (err) {
    console.warn("[catalog-storage] Erro ao gravar tombstone:", err);
  }
}

/**
 * Remove o tombstone de um episódio (usado na republicação ou recriação do slot).
 */
export function clearTombstone(
  episodeId: string,
  context?: { animeId?: string; seasonNumber?: number; episodeNumber?: number },
): void {
  if (typeof window === "undefined" || !episodeId || typeof episodeId !== "string") return;
  const cleanId = episodeId.trim();
  if (!cleanId) return;

  try {
    const current = readTombstoneRecords();
    const cleanAnimeId = context?.animeId?.trim();

    const next = current.filter((t) => {
      if (t.id === cleanId) {
        if (!cleanAnimeId || !t.animeId || t.animeId === cleanAnimeId) {
          return false;
        }
      }
      if (
        cleanAnimeId &&
        t.animeId === cleanAnimeId &&
        context?.seasonNumber !== undefined &&
        t.seasonNumber === context.seasonNumber &&
        context?.episodeNumber !== undefined &&
        t.episodeNumber === context.episodeNumber
      ) {
        return false;
      }
      return true;
    });

    if (next.length !== current.length) {
      window.localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(next));
    }
  } catch (err) {
    console.warn("[catalog-storage] Erro ao limpar tombstone:", err);
  }
}

/**
 * Avalia de forma segura se determinado episódio está marcado como excluído por tombstone.
 * Aplica estritamente o isolamento por anime: um tombstone do anime X NUNCA afeta o anime Y.
 * Se o tombstone não possui informações suficientes ou se o slot foi recriado com ID diferente,
 * preserva os dados por segurança.
 */
export function isEpisodeTombstoned(
  tombstones: TombstoneRecord[],
  animeId: string,
  episodeId: string,
  seasonNumber?: number,
  episodeNumber?: number,
): boolean {
  if (!tombstones || tombstones.length === 0 || !animeId) return false;
  const cleanAnime = animeId.trim();
  const cleanEpId = episodeId?.trim();

  for (const t of tombstones) {
    // 1. Validação de integridade do tombstone:
    // Deve possuir ao menos ID válido ou slot válido (temporada e episódio)
    const hasValidId =
      typeof t.id === "string" &&
      t.id.trim().length > 0 &&
      t.id !== "undefined" &&
      t.id !== "null";
    const hasValidSlot =
      typeof t.seasonNumber === "number" && typeof t.episodeNumber === "number";

    if (!hasValidId && !hasValidSlot) {
      // Tombstone sem informações suficientes -> preserva os dados por segurança
      continue;
    }

    // 2. Isolamento por Anime:
    // Se o tombstone especifica animeId e for diferente de cleanAnime, NUNCA se aplica
    if (t.animeId && t.animeId.trim() !== cleanAnime) {
      continue;
    }

    // Se o tombstone não possui animeId especificado, não temos garantia segura de a qual anime pertencia
    // -> preserva os dados por segurança (Cenário 12)
    if (!t.animeId) {
      continue;
    }

    // 3. Coincidência por slot exato (animeId, seasonNumber, episodeNumber)
    if (
      hasValidSlot &&
      seasonNumber !== undefined &&
      t.seasonNumber === seasonNumber &&
      episodeNumber !== undefined &&
      t.episodeNumber === episodeNumber
    ) {
      // Tombstone antigo/desatualizado não oculta novo episódio recriado ou com ID diferente no mesmo slot (Cenário 10)
      if (hasValidId && cleanEpId && t.id !== cleanEpId) {
        continue;
      }
      return true;
    }

    // 4. Coincidência por ID exato
    if (hasValidId && cleanEpId && t.id === cleanEpId) {
      return true;
    }
  }

  return false;
}


