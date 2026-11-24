import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { measureLocalStorageSizes } from "@/lib/store";

export const Route = createFileRoute("/diagnostic")({
  component: DiagnosticPage,
});

type StorageItemInfo = {
  key: string;
  bytes: number;
  kb: string;
  category: string;
};

type SubStructureInfo = {
  name: string;
  bytes: number;
  kb: string;
};

type SessionItemInfo = {
  key: string;
  bytes: number;
  kb: string;
};

type CookieInfo = {
  name: string;
  bytes: number;
  kb: string;
};

type IndexedDbInfo = {
  name: string;
  stores?: string[];
  status?: string;
};

type CacheInfo = {
  name: string;
  requestCount: number;
  estimatedBytes: number;
  kb: string;
};

type ServiceWorkerInfo = {
  scope: string;
  state: string;
  isHikari: boolean;
};

type StorageEstimateInfo = {
  usage: number;
  quota: number;
  percentage: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function DiagnosticPage() {
  const [isClient, setIsClient] = useState(false);
  const [lastMeasuredAt, setLastMeasuredAt] = useState<string>("");

  // LocalStorage state
  const [localStorageItems, setLocalStorageItems] = useState<StorageItemInfo[]>([]);
  const [localStorageTotal, setLocalStorageTotal] = useState(0);
  const [subStructures, setSubStructures] = useState<SubStructureInfo[]>([]);

  // SessionStorage state
  const [sessionStorageItems, setSessionStorageItems] = useState<SessionItemInfo[]>([]);
  const [sessionStorageTotal, setSessionStorageTotal] = useState(0);

  // Cookies state
  const [cookies, setCookies] = useState<CookieInfo[]>([]);
  const [cookiesTotal, setCookiesTotal] = useState(0);

  // IndexedDB state
  const [indexedDbs, setIndexedDbs] = useState<IndexedDbInfo[]>([]);
  const [idbAvailable, setIdbAvailable] = useState(false);

  // Cache Storage state
  const [cachesList, setCachesList] = useState<CacheInfo[]>([]);
  const [cachesAvailable, setCachesAvailable] = useState(false);

  // Service Workers state
  const [swList, setSwList] = useState<ServiceWorkerInfo[]>([]);
  const [swAvailable, setSwAvailable] = useState(false);

  // Storage Estimate state
  const [estimate, setEstimate] = useState<StorageEstimateInfo | null>(null);
  const [estimateAvailable, setEstimateAvailable] = useState(false);

  // Section expansions
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true,
    local: true,
    session: false,
    cookies: false,
    idb: false,
    caches: false,
    sw: false,
    estimate: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const runAudit = useCallback(async () => {
    if (typeof window === "undefined") return;

    // 1. LocalStorage
    try {
      const rawSizes = measureLocalStorageSizes();
      const mapped: StorageItemInfo[] = [];
      let cumulative = 0;

      for (const [key, bytes] of Object.entries(rawSizes)) {
        cumulative += bytes;
        let category = "Outros";
        if (key === "hikari-user-state-v1") category = "Estado Principal";
        else if (key === "hikari-catalog-fallback-v1") category = "Catálogo Fallback";
        else if (key === "hikari_anime_user_cache_v1") category = "Cache de Usuário por Anime";
        else if (key === "hikari-episode-outbox-v1") category = "Outbox Offline";
        else if (key === "hikari-deleted-episodes-v1") category = "Tombstones";
        else if (key === "hikari-catalog-v1") category = "Catálogo Legado";
        else if (key.startsWith("progress") || key.startsWith("ep-progress")) category = "Progresso Granular";

        mapped.push({
          key,
          bytes,
          kb: formatBytes(bytes),
          category,
        });
      }
      mapped.sort((a, b) => b.bytes - a.bytes);
      setLocalStorageItems(mapped);
      setLocalStorageTotal(cumulative);

      // Composição de hikari-user-state-v1
      const subs: SubStructureInfo[] = [];
      const userStateRaw = window.localStorage.getItem("hikari-user-state-v1");
      if (userStateRaw) {
        const parsed = JSON.parse(userStateRaw);
        const stateObj = parsed?.state ?? parsed;
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
        ];

        for (const targetKey of targetKeys) {
          const val = stateObj[targetKey];
          if (val !== undefined) {
            const jsonVal = JSON.stringify(val);
            const subBytes = new Blob([jsonVal]).size;
            subs.push({
              name: targetKey,
              bytes: subBytes,
              kb: formatBytes(subBytes),
            });
          }
        }
        subs.sort((a, b) => b.bytes - a.bytes);
      }
      setSubStructures(subs);
    } catch {
      // ignore
    }

    // 2. SessionStorage
    try {
      if (window.sessionStorage) {
        const sItems: SessionItemInfo[] = [];
        let sTotal = 0;
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            const val = window.sessionStorage.getItem(key);
            const bytes = val ? new Blob([val]).size : 0;
            sTotal += bytes;
            sItems.push({
              key,
              bytes,
              kb: formatBytes(bytes),
            });
          }
        }
        sItems.sort((a, b) => b.bytes - a.bytes);
        setSessionStorageItems(sItems);
        setSessionStorageTotal(sTotal);
      }
    } catch {
      // ignore
    }

    // 3. Cookies
    try {
      const cookieStr = document.cookie || "";
      const cookieArr = cookieStr ? cookieStr.split(";") : [];
      const parsedCookies: CookieInfo[] = [];
      let cTotal = 0;

      for (const c of cookieArr) {
        const trimmed = c.trim();
        if (!trimmed) continue;
        const eqIdx = trimmed.indexOf("=");
        const name = eqIdx !== -1 ? trimmed.substring(0, eqIdx).trim() : trimmed;
        const bytes = new Blob([trimmed]).size;
        cTotal += bytes;
        parsedCookies.push({
          name,
          bytes,
          kb: formatBytes(bytes),
        });
      }
      parsedCookies.sort((a, b) => b.bytes - a.bytes);
      setCookies(parsedCookies);
      setCookiesTotal(cTotal);
    } catch {
      // ignore
    }

    // 4. IndexedDB
    try {
      const idb = window.indexedDB as IDBFactory & { databases?: () => Promise<Array<{ name?: string; version?: number }>> };
      if (idb && typeof idb.databases === "function") {
        setIdbAvailable(true);
        const dbs = await idb.databases();
        const dbInfos: IndexedDbInfo[] = [];
        for (const db of dbs) {
          if (db.name) {
            dbInfos.push({
              name: db.name,
              status: "Disponível",
            });
          }
        }
        setIndexedDbs(dbInfos);
      } else if (typeof indexedDB !== "undefined") {
        setIdbAvailable(true);
        setIndexedDbs([{ name: "IndexedDB disponível (listagem de bancos não suportada pelo navegador)", status: "Suporte parcial" }]);
      }
    } catch {
      setIdbAvailable(false);
    }

    // 5. Cache Storage
    try {
      if (typeof window !== "undefined" && "caches" in window) {
        setCachesAvailable(true);
        const cacheNames = await window.caches.keys();
        const cacheInfos: CacheInfo[] = [];

        for (const name of cacheNames) {
          const cache = await window.caches.open(name);
          const requests = await cache.keys();
          let estBytes = 0;

          for (const req of requests) {
            try {
              const match = await cache.match(req);
              if (match && match.headers) {
                const len = match.headers.get("content-length");
                if (len) {
                  const parsedLen = parseInt(len, 10);
                  if (!Number.isNaN(parsedLen)) {
                    estBytes += parsedLen;
                  }
                }
              }
            } catch {
              // ignore individual match failures
            }
          }

          cacheInfos.push({
            name,
            requestCount: requests.length,
            estimatedBytes: estBytes,
            kb: estBytes > 0 ? formatBytes(estBytes) : "Não disponível (sem Content-Length)",
          });
        }
        setCachesList(cacheInfos);
      }
    } catch {
      setCachesAvailable(false);
    }

    // 6. Service Workers
    try {
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        setSwAvailable(true);
        const regs = await navigator.serviceWorker.getRegistrations();
        const swInfos: ServiceWorkerInfo[] = [];
        for (const reg of regs) {
          const scope = reg.scope || "Desconhecido";
          const active = reg.active?.state || reg.waiting?.state || reg.installing?.state || "inativo";
          swInfos.push({
            scope,
            state: active,
            isHikari: scope.includes(window.location.origin),
          });
        }
        setSwList(swInfos);
      }
    } catch {
      setSwAvailable(false);
    }

    // 7. Storage Estimate
    try {
      if (typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.estimate === "function") {
        setEstimateAvailable(true);
        const est = await navigator.storage.estimate();
        const usage = est.usage ?? 0;
        const quota = est.quota ?? 0;
        const pct = quota > 0 ? ((usage / quota) * 100).toFixed(2) + "%" : "N/A";
        setEstimate({
          usage,
          quota,
          percentage: pct,
        });
      }
    } catch {
      setEstimateAvailable(false);
    }

    setLastMeasuredAt(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    setIsClient(true);
    void runAudit();
  }, [runAudit]);

  if (!isClient) {
    return null;
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-5 text-fg pb-20">
      <header className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">Painel de Auditoria de Armazenamento</h1>
        <p className="text-xs text-muted">Inspeção Completa (Somente Leitura - Cliente)</p>
      </header>

      {/* Global Actions */}
      <div className="bg-elevated p-4 rounded-xl border border-white/10 space-y-2">
        <div className="flex justify-between items-center text-xs text-muted">
          <span>Última atualização:</span>
          <span className="font-semibold text-fg">{lastMeasuredAt || "Agora mesmo"}</span>
        </div>
        <button
          onClick={() => void runAudit()}
          className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
        >
          Atualizar Diagnóstico
        </button>
      </div>

      {/* 1. Resumo Geral */}
      <div className="border border-white/10 rounded-xl bg-elevated/40 overflow-hidden">
        <button
          onClick={() => toggleSection("summary")}
          className="w-full px-4 py-3 flex justify-between items-center text-left font-bold text-sm bg-elevated/80 cursor-pointer"
        >
          <span>Resumo Geral do Armazenamento</span>
          <span className="text-xs text-purple-400">{expandedSections.summary ? "▲" : "▼"}</span>
        </button>
        {expandedSections.summary && (
          <div className="p-4 space-y-2.5 text-xs border-t border-white/10">
            <div className="flex justify-between">
              <span className="text-muted">LocalStorage (Hikari):</span>
              <span className="font-semibold">{formatBytes(localStorageTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">SessionStorage:</span>
              <span className="font-semibold">{formatBytes(sessionStorageTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Cookies Acessíveis (JS):</span>
              <span className="font-semibold">{formatBytes(cookiesTotal)} ({cookies.length} encontrados)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">IndexedDB:</span>
              <span className="font-semibold">{idbAvailable ? `${indexedDbs.length} banco(s)` : "Indisponível"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Cache Storage:</span>
              <span className="font-semibold">{cachesAvailable ? `${cachesList.length} cache(s)` : "Indisponível"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Service Workers:</span>
              <span className="font-semibold">{swAvailable ? `${swList.length} registro(s)` : "Indisponível"}</span>
            </div>
            {estimateAvailable && estimate && (
              <div className="flex justify-between pt-2 border-t border-white/5">
                <span className="text-muted font-bold">Uso Total da Origem (Browser):</span>
                <span className="font-bold text-amber-400">{formatBytes(estimate.usage)} / {formatBytes(estimate.quota)} ({estimate.percentage})</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. LocalStorage */}
      <div className="border border-white/10 rounded-xl bg-elevated/40 overflow-hidden">
        <button
          onClick={() => toggleSection("local")}
          className="w-full px-4 py-3 flex justify-between items-center text-left font-bold text-sm bg-elevated/80 cursor-pointer"
        >
          <span>LocalStorage ({formatBytes(localStorageTotal)})</span>
          <span className="text-xs text-purple-400">{expandedSections.local ? "▲" : "▼"}</span>
        </button>
        {expandedSections.local && (
          <div className="p-4 space-y-4 text-xs border-t border-white/10">
            <div className="space-y-2">
              <h3 className="font-semibold text-muted uppercase tracking-wider text-[11px]">Chaves Encontradas ({localStorageItems.length})</h3>
              {localStorageItems.length === 0 ? (
                <p className="text-muted py-2 text-center">Nenhuma chave encontrada.</p>
              ) : (
                localStorageItems.map((item) => (
                  <div key={item.key} className="bg-elevated/60 p-2.5 rounded-lg border border-white/5 space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-semibold text-purple-300 break-all">{item.key}</span>
                      <span className="font-bold shrink-0 ml-2">{item.kb}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted">
                      <span>Categoria: {item.category}</span>
                      <span>{item.bytes} bytes</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {subStructures.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <h3 className="font-semibold text-muted uppercase tracking-wider text-[11px]">Composição de hikari-user-state-v1</h3>
                <div className="space-y-1">
                  {subStructures.map((sub) => (
                    <div key={sub.name} className="bg-elevated/60 px-2.5 py-1.5 rounded-lg border border-white/5 flex justify-between items-center">
                      <span className="font-mono text-zinc-300">{sub.name}</span>
                      <span className="font-semibold">{sub.kb}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. SessionStorage */}
      <div className="border border-white/10 rounded-xl bg-elevated/40 overflow-hidden">
        <button
          onClick={() => toggleSection("session")}
          className="w-full px-4 py-3 flex justify-between items-center text-left font-bold text-sm bg-elevated/80 cursor-pointer"
        >
          <span>SessionStorage ({formatBytes(sessionStorageTotal)})</span>
          <span className="text-xs text-purple-400">{expandedSections.session ? "▲" : "▼"}</span>
        </button>
        {expandedSections.session && (
          <div className="p-4 space-y-2 text-xs border-t border-white/10">
            {sessionStorageItems.length === 0 ? (
              <p className="text-muted py-2 text-center">Nenhuma chave no SessionStorage.</p>
            ) : (
              sessionStorageItems.map((item) => (
                <div key={item.key} className="bg-elevated/60 p-2.5 rounded-lg border border-white/5 flex justify-between items-center">
                  <span className="font-mono text-purple-300 break-all">{item.key}</span>
                  <span className="font-bold shrink-0 ml-2">{item.kb}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 4. Cookies */}
      <div className="border border-white/10 rounded-xl bg-elevated/40 overflow-hidden">
        <button
          onClick={() => toggleSection("cookies")}
          className="w-full px-4 py-3 flex justify-between items-center text-left font-bold text-sm bg-elevated/80 cursor-pointer"
        >
          <span>Cookies Acessíveis ({formatBytes(cookiesTotal)})</span>
          <span className="text-xs text-purple-400">{expandedSections.cookies ? "▲" : "▼"}</span>
        </button>
        {expandedSections.cookies && (
          <div className="p-4 space-y-3 text-xs border-t border-white/10">
            <p className="text-[11px] text-muted italic">
              Nota: Cookies com flag <code>HttpOnly</code> (como tokens de sessão do Better Auth) não podem ser inspecionados via JavaScript por motivos de segurança e não aparecem nesta lista.
            </p>
            {cookies.length === 0 ? (
              <p className="text-muted py-2 text-center">Nenhum cookie acessível via JavaScript.</p>
            ) : (
              cookies.map((c) => (
                <div key={c.name} className="bg-elevated/60 p-2.5 rounded-lg border border-white/5 flex justify-between items-center">
                  <span className="font-mono text-purple-300">{c.name}</span>
                  <span className="font-bold">{c.kb}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 5. IndexedDB */}
      <div className="border border-white/10 rounded-xl bg-elevated/40 overflow-hidden">
        <button
          onClick={() => toggleSection("idb")}
          className="w-full px-4 py-3 flex justify-between items-center text-left font-bold text-sm bg-elevated/80 cursor-pointer"
        >
          <span>IndexedDB ({idbAvailable ? `${indexedDbs.length} banco(s)` : "Indisponível"})</span>
          <span className="text-xs text-purple-400">{expandedSections.idb ? "▲" : "▼"}</span>
        </button>
        {expandedSections.idb && (
          <div className="p-4 space-y-2 text-xs border-t border-white/10">
            {!idbAvailable ? (
              <p className="text-muted py-2 text-center">API IndexedDB não suportada neste ambiente.</p>
            ) : indexedDbs.length === 0 ? (
              <p className="text-muted py-2 text-center">Nenhum banco IndexedDB encontrado.</p>
            ) : (
              indexedDbs.map((db) => (
                <div key={db.name} className="bg-elevated/60 p-2.5 rounded-lg border border-white/5 flex justify-between items-center">
                  <span className="font-mono text-purple-300">{db.name}</span>
                  <span className="text-muted">{db.status || "Ativo"}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 6. Cache Storage */}
      <div className="border border-white/10 rounded-xl bg-elevated/40 overflow-hidden">
        <button
          onClick={() => toggleSection("caches")}
          className="w-full px-4 py-3 flex justify-between items-center text-left font-bold text-sm bg-elevated/80 cursor-pointer"
        >
          <span>Cache Storage ({cachesAvailable ? `${cachesList.length} cache(s)` : "Indisponível"})</span>
          <span className="text-xs text-purple-400">{expandedSections.caches ? "▲" : "▼"}</span>
        </button>
        {expandedSections.caches && (
          <div className="p-4 space-y-2 text-xs border-t border-white/10">
            {!cachesAvailable ? (
              <p className="text-muted py-2 text-center">Cache Storage não suportado neste ambiente.</p>
            ) : cachesList.length === 0 ? (
              <p className="text-muted py-2 text-center">Nenhum cache encontrado.</p>
            ) : (
              cachesList.map((ch) => (
                <div key={ch.name} className="bg-elevated/60 p-2.5 rounded-lg border border-white/5 space-y-1">
                  <div className="flex justify-between">
                    <span className="font-mono font-semibold text-purple-300">{ch.name}</span>
                    <span className="font-bold">{ch.kb}</span>
                  </div>
                  <div className="text-[10px] text-muted">Requisições armazenadas: {ch.requestCount}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 7. Service Workers */}
      <div className="border border-white/10 rounded-xl bg-elevated/40 overflow-hidden">
        <button
          onClick={() => toggleSection("sw")}
          className="w-full px-4 py-3 flex justify-between items-center text-left font-bold text-sm bg-elevated/80 cursor-pointer"
        >
          <span>Service Workers ({swAvailable ? `${swList.length} registro(s)` : "Indisponível"})</span>
          <span className="text-xs text-purple-400">{expandedSections.sw ? "▲" : "▼"}</span>
        </button>
        {expandedSections.sw && (
          <div className="p-4 space-y-2 text-xs border-t border-white/10">
            {!swAvailable ? (
              <p className="text-muted py-2 text-center">Service Workers não suportados neste ambiente.</p>
            ) : swList.length === 0 ? (
              <p className="text-muted py-2 text-center">Nenhum Service Worker registrado.</p>
            ) : (
              swList.map((sw, idx) => (
                <div key={idx} className="bg-elevated/60 p-2.5 rounded-lg border border-white/5 space-y-1">
                  <div className="flex justify-between">
                    <span className="font-mono text-purple-300">Escopo: {sw.scope}</span>
                    <span className="font-semibold text-emerald-400">{sw.state}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 8. Storage Estimate */}
      <div className="border border-white/10 rounded-xl bg-elevated/40 overflow-hidden">
        <button
          onClick={() => toggleSection("estimate")}
          className="w-full px-4 py-3 flex justify-between items-center text-left font-bold text-sm bg-elevated/80 cursor-pointer"
        >
          <span>Estimativa Geral (Origin Storage)</span>
          <span className="text-xs text-purple-400">{expandedSections.estimate ? "▲" : "▼"}</span>
        </button>
        {expandedSections.estimate && (
          <div className="p-4 space-y-2 text-xs border-t border-white/10">
            {!estimateAvailable || !estimate ? (
              <p className="text-muted py-2 text-center">API navigator.storage.estimate não suportada.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted">Uso Atual da Origem:</span>
                  <span className="font-bold text-amber-400">{formatBytes(estimate.usage)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Quota Máxima Disponível:</span>
                  <span className="font-semibold">{formatBytes(estimate.quota)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Percentual Utilizado:</span>
                  <span className="font-semibold">{estimate.percentage}</span>
                </div>
                <p className="text-[10px] text-muted italic pt-1">
                  Nota: Esta estimativa é fornecida pelo navegador e agrupa todos os dados da origem (LocalStorage, IndexedDB, Cache Storage, etc.). Não deve ser somada diretamente aos itens individuais.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
