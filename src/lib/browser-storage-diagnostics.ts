export type StorageSectionStatus =
  | "available"
  | "unavailable"
  | "blocked"
  | "partial"
  | "error";

export interface LocalStorageItemInfo {
  key: string;
  bytes: number;
  formattedSize: string;
  category: string;
}

export interface UserStateSubStructureInfo {
  name: string;
  bytes: number;
  formattedSize: string;
}

export interface SessionStorageItemInfo {
  key: string;
  bytes: number;
  formattedSize: string;
}

export interface CookieAuditInfo {
  name: string;
  bytes: number;
  formattedSize: string;
}

export interface ObjectStoreDetail {
  name: string;
  count: number;
  indexes: string[];
}

export interface IndexedDbDetail {
  name: string;
  version: number;
  stores: ObjectStoreDetail[];
  status: string;
}

export interface CacheInfo {
  name: string;
  requestCount: number;
  estimatedBytes: number;
  formattedSize: string;
  hasIncompleteSizes: boolean;
}

export interface ServiceWorkerInfo {
  scope: string;
  state: string;
  isHikari: boolean;
}

export interface StorageEstimateInfo {
  usage: number;
  quota: number;
  percentage: string;
  usageDetails?: Record<string, number>;
}

export interface BrowserStorageAuditReport {
  isBrowserEnvironment: boolean;
  measuredAt: string;
  localStorage: {
    status: StorageSectionStatus;
    available: boolean;
    reason?: string;
    totalBytes: number;
    keyCount: number;
    items: LocalStorageItemInfo[];
    subStructures: UserStateSubStructureInfo[];
  };
  sessionStorage: {
    status: StorageSectionStatus;
    available: boolean;
    reason?: string;
    totalBytes: number;
    keyCount: number;
    items: SessionStorageItemInfo[];
  };
  cookies: {
    status: StorageSectionStatus;
    available: boolean;
    reason?: string;
    totalBytes: number;
    count: number;
    items: CookieAuditInfo[];
  };
  indexedDb: {
    status: StorageSectionStatus;
    available: boolean;
    reason?: string;
    databaseCount: number;
    totalStoresCount: number;
    databases: IndexedDbDetail[];
  };
  cacheStorage: {
    status: StorageSectionStatus;
    available: boolean;
    reason?: string;
    cacheCount: number;
    items: CacheInfo[];
  };
  serviceWorkers: {
    status: StorageSectionStatus;
    available: boolean;
    reason?: string;
    registrationCount: number;
    items: ServiceWorkerInfo[];
  };
  estimate: {
    status: StorageSectionStatus;
    available: boolean;
    reason?: string;
    data: StorageEstimateInfo | null;
  };
  limitations: string[];
}

const INDEXED_DB_OPEN_TIMEOUT_MS = 2500;

export function formatStorageBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
    return "--";
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function safeUtf8ByteLength(text: string): number {
  if (!text) return 0;
  try {
    if (typeof Blob !== "undefined") {
      return new Blob([text]).size;
    }
  } catch {
    // fallback abaixo
  }
  return text.length;
}

function classifyLocalStorageKey(key: string): string {
  if (key === "hikari-user-state-v1") return "Estado Principal";
  if (key === "hikari-catalog-fallback-v1") return "Catálogo Fallback";
  if (key === "hikari_anime_user_cache_v1") return "Cache de Usuário por Anime";
  if (key === "hikari-episode-outbox-v1") return "Outbox Offline";
  if (key === "hikari-deleted-episodes-v1") return "Tombstones";
  if (key === "hikari-catalog-v1") return "Catálogo Legado";
  if (
    key.startsWith("progress") ||
    key.startsWith("ep-progress") ||
    /^(?:hikari|nova)[-_:]?(?:watch[-_:]?|ep(?:isode)?[-_:]?)?progress(?:[-_:]|$)/i.test(
      key,
    )
  ) {
    return "Progresso Granular";
  }
  if (
    key.startsWith("hikari-") ||
    key.startsWith("hikari_") ||
    key.startsWith("nova_player_")
  ) {
    return "Preferências & Cache Hikari";
  }
  return "Outros";
}

function isSecurityOrBlockedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: unknown }).name;
  return name === "SecurityError" || name === "NotAllowedError";
}

function createNonBrowserAuditReport(): BrowserStorageAuditReport {
  return {
    isBrowserEnvironment: false,
    measuredAt: "",
    localStorage: {
      status: "unavailable",
      available: false,
      reason: "Execução fora do navegador (SSR).",
      totalBytes: 0,
      keyCount: 0,
      items: [],
      subStructures: [],
    },
    sessionStorage: {
      status: "unavailable",
      available: false,
      reason: "Execução fora do navegador (SSR).",
      totalBytes: 0,
      keyCount: 0,
      items: [],
    },
    cookies: {
      status: "unavailable",
      available: false,
      reason: "Execução fora do navegador (SSR).",
      totalBytes: 0,
      count: 0,
      items: [],
    },
    indexedDb: {
      status: "unavailable",
      available: false,
      reason: "Execução fora do navegador (SSR).",
      databaseCount: 0,
      totalStoresCount: 0,
      databases: [],
    },
    cacheStorage: {
      status: "unavailable",
      available: false,
      reason: "Execução fora do navegador (SSR).",
      cacheCount: 0,
      items: [],
    },
    serviceWorkers: {
      status: "unavailable",
      available: false,
      reason: "Execução fora do navegador (SSR).",
      registrationCount: 0,
      items: [],
    },
    estimate: {
      status: "unavailable",
      available: false,
      reason: "Execução fora do navegador (SSR).",
      data: null,
    },
    limitations: ["Inspeção disponível apenas após montagem no navegador."],
  };
}

function inspectLocalStorage(): BrowserStorageAuditReport["localStorage"] {
  try {
    if (!("localStorage" in window) || !window.localStorage) {
      return {
        status: "unavailable",
        available: false,
        reason: "API localStorage não exposta neste navegador.",
        totalBytes: 0,
        keyCount: 0,
        items: [],
        subStructures: [],
      };
    }

    const storage = window.localStorage;
    const totalKeys = storage.length;
    const items: LocalStorageItemInfo[] = [];
    let cumulativeBytes = 0;

    for (let i = 0; i < totalKeys; i += 1) {
      const key = storage.key(i);
      if (!key) continue;
      const val = storage.getItem(key);
      const bytes = val ? safeUtf8ByteLength(val) : 0;
      cumulativeBytes += bytes;
      items.push({
        key,
        bytes,
        formattedSize: formatStorageBytes(bytes),
        category: classifyLocalStorageKey(key),
      });
    }

    items.sort((a, b) => b.bytes - a.bytes);

    // Composição somente-tamanho das subchaves de hikari-user-state-v1 (nunca expõe valores)
    const subStructures: UserStateSubStructureInfo[] = [];
    try {
      const userStateRaw = storage.getItem("hikari-user-state-v1");
      if (userStateRaw) {
        const parsed = JSON.parse(userStateRaw) as Record<string, unknown> | null;
        const stateObj =
          parsed && typeof parsed === "object" && parsed.state && typeof parsed.state === "object"
            ? (parsed.state as Record<string, unknown>)
            : parsed;

        if (stateObj && typeof stateObj === "object") {
          const targetKeys = [
            "snapshots",
            "watchedEpisodes",
            "myList",
            "continueWatching",
            "userSnapshots",
            "userWatchedEpisodes",
            "userLists",
            "userContinueWatching",
            "userFavorites",
            "anonymousWatchedEpisodes",
            "anonymousContinueWatching",
          ];

          for (const targetKey of targetKeys) {
            const val = stateObj[targetKey];
            if (val !== undefined) {
              const serialized = JSON.stringify(val);
              const subBytes = safeUtf8ByteLength(serialized);
              subStructures.push({
                name: targetKey,
                bytes: subBytes,
                formattedSize: formatStorageBytes(subBytes),
              });
            }
          }
          subStructures.sort((a, b) => b.bytes - a.bytes);
        }
      }
    } catch {
      // JSON inválido ou inacessível em hikari-user-state-v1 não invalida a lista de chaves
    }

    return {
      status: "available",
      available: true,
      totalBytes: cumulativeBytes,
      keyCount: items.length,
      items,
      subStructures,
    };
  } catch (err) {
    return {
      status: isSecurityOrBlockedError(err) ? "blocked" : "error",
      available: false,
      reason: isSecurityOrBlockedError(err)
        ? "Acesso ao localStorage bloqueado por política de privacidade ou iframe."
        : "Falha ao inspecionar localStorage.",
      totalBytes: 0,
      keyCount: 0,
      items: [],
      subStructures: [],
    };
  }
}

function inspectSessionStorage(): BrowserStorageAuditReport["sessionStorage"] {
  try {
    if (!("sessionStorage" in window) || !window.sessionStorage) {
      return {
        status: "unavailable",
        available: false,
        reason: "API sessionStorage não exposta neste navegador.",
        totalBytes: 0,
        keyCount: 0,
        items: [],
      };
    }

    const storage = window.sessionStorage;
    const items: SessionStorageItemInfo[] = [];
    let cumulativeBytes = 0;

    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key) continue;
      const val = storage.getItem(key);
      const bytes = val ? safeUtf8ByteLength(val) : 0;
      cumulativeBytes += bytes;
      items.push({
        key,
        bytes,
        formattedSize: formatStorageBytes(bytes),
      });
    }

    items.sort((a, b) => b.bytes - a.bytes);

    return {
      status: "available",
      available: true,
      totalBytes: cumulativeBytes,
      keyCount: items.length,
      items,
    };
  } catch (err) {
    return {
      status: isSecurityOrBlockedError(err) ? "blocked" : "error",
      available: false,
      reason: isSecurityOrBlockedError(err)
        ? "Acesso ao sessionStorage bloqueado por política de privacidade ou iframe."
        : "Falha ao inspecionar sessionStorage.",
      totalBytes: 0,
      keyCount: 0,
      items: [],
    };
  }
}

function inspectCookiesMetadata(): BrowserStorageAuditReport["cookies"] {
  try {
    if (typeof document === "undefined") {
      return {
        status: "unavailable",
        available: false,
        reason: "Objeto document indisponível.",
        totalBytes: 0,
        count: 0,
        items: [],
      };
    }

    const cookieStr = document.cookie || "";
    const cookieArr = cookieStr ? cookieStr.split(";") : [];
    const items: CookieAuditInfo[] = [];
    let totalBytes = 0;

    for (const entry of cookieArr) {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf("=");
      // Extrai exclusivamente o nome do cookie — nunca expõe ou armazena o valor
      const name = eqIdx !== -1 ? trimmed.substring(0, eqIdx).trim() : trimmed;
      if (!name) continue;
      const bytes = safeUtf8ByteLength(trimmed);
      totalBytes += bytes;
      items.push({
        name,
        bytes,
        formattedSize: formatStorageBytes(bytes),
      });
    }

    items.sort((a, b) => b.bytes - a.bytes);

    return {
      status: "available",
      available: true,
      totalBytes,
      count: items.length,
      items,
    };
  } catch (err) {
    return {
      status: isSecurityOrBlockedError(err) ? "blocked" : "error",
      available: false,
      reason: isSecurityOrBlockedError(err)
        ? "Leitura de document.cookie bloqueada neste contexto."
        : "Falha ao inspecionar metadados de cookies.",
      totalBytes: 0,
      count: 0,
      items: [],
    };
  }
}

function inspectSingleIndexedDb(dbName: string, dbVersion: number): Promise<IndexedDbDetail> {
  return new Promise((resolve) => {
    const detail: IndexedDbDetail = {
      name: dbName,
      version: dbVersion,
      stores: [],
      status: "Lido com sucesso",
    };

    let settled = false;
    let openedDb: IDBDatabase | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = (overrideStatus?: string) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (overrideStatus) {
        detail.status = overrideStatus;
      }
      if (openedDb) {
        try {
          openedDb.close();
        } catch {
          // ignore
        }
        openedDb = null;
      }
      resolve(detail);
    };

    timeoutId = setTimeout(() => {
      finish("Tempo limite excedido ao inspecionar banco");
    }, INDEXED_DB_OPEN_TIMEOUT_MS);

    try {
      const openReq = window.indexedDB.open(dbName);

      openReq.onblocked = () => {
        finish("Abertura bloqueada por outra aba ou conexão");
      };

      openReq.onerror = () => {
        finish("Erro ao abrir banco");
      };

      openReq.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (settled) {
          try {
            db.close();
          } catch {
            // ignore
          }
          return;
        }

        openedDb = db;
        const storeNames = Array.from(db.objectStoreNames);

        if (storeNames.length === 0) {
          finish("Lido com sucesso");
          return;
        }

        const storePromises = storeNames.map(
          (storeName) =>
            new Promise<ObjectStoreDetail>((storeResolve) => {
              const storeDetail: ObjectStoreDetail = {
                name: storeName,
                count: 0,
                indexes: [],
              };
              let storeSettled = false;
              const resolveStore = () => {
                if (storeSettled) return;
                storeSettled = true;
                storeResolve(storeDetail);
              };

              try {
                const tx = db.transaction(storeName, "readonly");
                const store = tx.objectStore(storeName);
                storeDetail.indexes = Array.from(store.indexNames);

                const countReq = store.count();
                countReq.onsuccess = () => {
                  storeDetail.count = countReq.result ?? 0;
                  resolveStore();
                };
                countReq.onerror = () => {
                  resolveStore();
                };
                tx.onerror = () => {
                  resolveStore();
                };
                tx.onabort = () => {
                  resolveStore();
                };
              } catch {
                resolveStore();
              }
            }),
        );

        void Promise.all(storePromises).then((stores) => {
          detail.stores = stores;
          finish("Lido com sucesso");
        });
      };
    } catch {
      finish("Erro na transação");
    }
  });
}

async function inspectIndexedDb(): Promise<BrowserStorageAuditReport["indexedDb"]> {
  try {
    if (!("indexedDB" in window) || !window.indexedDB) {
      return {
        status: "unavailable",
        available: false,
        reason: "API IndexedDB não suportada neste navegador.",
        databaseCount: 0,
        totalStoresCount: 0,
        databases: [],
      };
    }

    const idb = window.indexedDB as IDBFactory & {
      databases?: () => Promise<Array<{ name?: string; version?: number }>>;
    };

    if (typeof idb.databases !== "function") {
      return {
        status: "partial",
        available: true,
        reason:
          "IndexedDB disponível, mas indexedDB.databases() não é suportado por este navegador para listagem automática.",
        databaseCount: 0,
        totalStoresCount: 0,
        databases: [
          {
            name: "IndexedDB disponível (listagem automática de bancos não suportada pelo navegador)",
            version: 0,
            stores: [],
            status: "Suporte parcial",
          },
        ],
      };
    }

    const dbs = await idb.databases();
    const validMeta = dbs.filter((d): d is { name: string; version?: number } =>
      Boolean(d.name),
    );

    const dbDetails: IndexedDbDetail[] = [];
    for (const dbMeta of validMeta) {
      const detail = await inspectSingleIndexedDb(
        dbMeta.name,
        dbMeta.version ?? 1,
      );
      dbDetails.push(detail);
    }

    const totalStoresCount = dbDetails.reduce(
      (acc, db) => acc + (db.stores?.length ?? 0),
      0,
    );

    return {
      status: "available",
      available: true,
      databaseCount: dbDetails.length,
      totalStoresCount,
      databases: dbDetails,
    };
  } catch (err) {
    return {
      status: isSecurityOrBlockedError(err) ? "blocked" : "error",
      available: false,
      reason: isSecurityOrBlockedError(err)
        ? "Acesso ao IndexedDB bloqueado por política de privacidade."
        : "Falha ao consultar bancos IndexedDB.",
      databaseCount: 0,
      totalStoresCount: 0,
      databases: [],
    };
  }
}

async function inspectCacheStorage(): Promise<BrowserStorageAuditReport["cacheStorage"]> {
  try {
    if (!("caches" in window) || !window.caches) {
      const blockedByContext = !window.isSecureContext;
      return {
        status: blockedByContext ? "blocked" : "unavailable",
        available: false,
        reason: blockedByContext
          ? "Cache Storage requer contexto seguro (HTTPS) para acesso."
          : "API Cache Storage não disponível neste navegador.",
        cacheCount: 0,
        items: [],
      };
    }

    // Lista exclusivamente caches já existentes sem nunca abrir nomes novos ou executar put/add/delete
    const cacheNames = await window.caches.keys();
    const items: CacheInfo[] = [];

    for (const name of cacheNames) {
      try {
        const cache = await window.caches.open(name);
        const requests = await cache.keys();
        let estimatedBytes = 0;
        let hasIncompleteSizes = false;

        for (const req of requests) {
          try {
            const match = await cache.match(req);
            const len = match?.headers?.get("content-length");
            if (len) {
              const parsedLen = Number.parseInt(len, 10);
              if (!Number.isNaN(parsedLen) && parsedLen >= 0) {
                estimatedBytes += parsedLen;
              } else {
                hasIncompleteSizes = true;
              }
            } else {
              hasIncompleteSizes = true;
            }
          } catch {
            hasIncompleteSizes = true;
          }
        }

        const formattedSize =
          estimatedBytes > 0
            ? hasIncompleteSizes
              ? `~${formatStorageBytes(estimatedBytes)} (parcial)`
              : formatStorageBytes(estimatedBytes)
            : requests.length > 0
              ? "Não disponível (sem Content-Length)"
              : "0 B";

        items.push({
          name,
          requestCount: requests.length,
          estimatedBytes,
          formattedSize,
          hasIncompleteSizes,
        });
      } catch {
        items.push({
          name,
          requestCount: 0,
          estimatedBytes: 0,
          formattedSize: "Leitura indisponível",
          hasIncompleteSizes: true,
        });
      }
    }

    const anyIncomplete = items.some((c) => c.hasIncompleteSizes && c.requestCount > 0);

    return {
      status: anyIncomplete ? "partial" : "available",
      available: true,
      reason: anyIncomplete
        ? "Algumas entradas em cache não possuem cabeçalho Content-Length (ou são opacas); os bytes exibidos são estimativa parcial."
        : undefined,
      cacheCount: items.length,
      items,
    };
  } catch (err) {
    return {
      status: isSecurityOrBlockedError(err) ? "blocked" : "error",
      available: false,
      reason: isSecurityOrBlockedError(err)
        ? "Acesso ao Cache Storage bloqueado por política de privacidade."
        : "Falha ao inspecionar Cache Storage.",
      cacheCount: 0,
      items: [],
    };
  }
}

async function inspectServiceWorkers(): Promise<
  BrowserStorageAuditReport["serviceWorkers"]
> {
  try {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker) {
      const blockedByContext = !window.isSecureContext;
      return {
        status: blockedByContext ? "blocked" : "unavailable",
        available: false,
        reason: blockedByContext
          ? "Service Workers requerem contexto seguro (HTTPS)."
          : "API Service Worker não suportada neste navegador.",
        registrationCount: 0,
        items: [],
      };
    }

    const registrations = await navigator.serviceWorker.getRegistrations();
    const origin = window.location.origin;
    const items: ServiceWorkerInfo[] = registrations.map((reg) => {
      const scope = reg.scope || "Desconhecido";
      const state =
        reg.active?.state ||
        reg.waiting?.state ||
        reg.installing?.state ||
        "inativo";
      return {
        scope,
        state,
        isHikari: scope.includes(origin),
      };
    });

    return {
      status: "available",
      available: true,
      registrationCount: items.length,
      items,
    };
  } catch (err) {
    return {
      status: isSecurityOrBlockedError(err) ? "blocked" : "error",
      available: false,
      reason: isSecurityOrBlockedError(err)
        ? "Consulta de Service Workers bloqueada neste contexto."
        : "Falha ao consultar registros de Service Workers.",
      registrationCount: 0,
      items: [],
    };
  }
}

async function inspectStorageEstimate(): Promise<BrowserStorageAuditReport["estimate"]> {
  try {
    if (
      !("storage" in navigator) ||
      !navigator.storage ||
      typeof navigator.storage.estimate !== "function"
    ) {
      return {
        status: "unavailable",
        available: false,
        reason: "API navigator.storage.estimate() não suportada neste navegador.",
        data: null,
      };
    }

    const est = (await navigator.storage.estimate()) as StorageEstimate & {
      usageDetails?: Record<string, number>;
    };

    const usage =
      typeof est.usage === "number" && Number.isFinite(est.usage) ? est.usage : 0;
    const quota =
      typeof est.quota === "number" && Number.isFinite(est.quota) ? est.quota : 0;
    const percentage = quota > 0 ? `${((usage / quota) * 100).toFixed(2)}%` : "N/A";

    const usageDetails =
      est.usageDetails &&
      typeof est.usageDetails === "object" &&
      Object.keys(est.usageDetails).length > 0
        ? est.usageDetails
        : undefined;

    return {
      status: usageDetails ? "available" : "partial",
      available: true,
      reason: usageDetails
        ? undefined
        : "Este navegador fornece uso e cota totais, mas não expõe detalhamento por categoria (usageDetails).",
      data: {
        usage,
        quota,
        percentage,
        usageDetails,
      },
    };
  } catch (err) {
    return {
      status: isSecurityOrBlockedError(err) ? "blocked" : "error",
      available: false,
      reason: isSecurityOrBlockedError(err)
        ? "navigator.storage.estimate() bloqueado por restrições de privacidade."
        : "Falha ao consultar navigator.storage.estimate().",
      data: null,
    };
  }
}

export async function collectBrowserStorageAudit(): Promise<BrowserStorageAuditReport> {
  if (typeof window === "undefined") {
    return createNonBrowserAuditReport();
  }

  const localStorage = inspectLocalStorage();
  const sessionStorage = inspectSessionStorage();
  const cookies = inspectCookiesMetadata();

  const [indexedDb, cacheStorage, serviceWorkers, estimate] = await Promise.all([
    inspectIndexedDb(),
    inspectCacheStorage(),
    inspectServiceWorkers(),
    inspectStorageEstimate(),
  ]);

  const limitations: string[] = [];

  if (localStorage.reason) limitations.push(localStorage.reason);
  if (sessionStorage.reason) limitations.push(sessionStorage.reason);
  if (cookies.reason) limitations.push(cookies.reason);
  if (indexedDb.reason) limitations.push(indexedDb.reason);
  if (cacheStorage.reason) limitations.push(cacheStorage.reason);
  if (serviceWorkers.reason) limitations.push(serviceWorkers.reason);
  if (estimate.reason) limitations.push(estimate.reason);

  limitations.push(
    "Cookies com flag HttpOnly (como sessões do Better Auth) não são acessíveis via JavaScript e não aparecem na contagem.",
  );

  return {
    isBrowserEnvironment: true,
    measuredAt: new Date().toLocaleTimeString("pt-BR"),
    localStorage,
    sessionStorage,
    cookies,
    indexedDb,
    cacheStorage,
    serviceWorkers,
    estimate,
    limitations,
  };
}
