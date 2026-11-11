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
