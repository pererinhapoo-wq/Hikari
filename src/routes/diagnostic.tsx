import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  collectBrowserStorageAudit,
  formatStorageBytes,
  type CacheInfo,
  type CookieAuditInfo,
  type IndexedDbDetail,
  type LocalStorageItemInfo,
  type ServiceWorkerInfo,
  type SessionStorageItemInfo,
  type StorageEstimateInfo,
  type UserStateSubStructureInfo,
} from "@/lib/browser-storage-diagnostics";

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

type LegacyCacheInfo = {
  name: string;
  requestCount: number;
  estimatedBytes: number;
  kb: string;
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
  const [indexedDbDetails, setIndexedDbDetails] = useState<IndexedDbDetail[]>([]);
  const [idbAvailable, setIdbAvailable] = useState(false);

  // Cache Storage state
  const [cachesList, setCachesList] = useState<LegacyCacheInfo[]>([]);
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
    idb: true,
    caches: false,
    sw: false,
    estimate: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const runAudit = useCallback(async () => {
    if (typeof window === "undefined") return;

    const report = await collectBrowserStorageAudit();

    if (report.localStorage.available) {
      setLocalStorageItems(
        report.localStorage.items.map((item: LocalStorageItemInfo) => ({
          key: item.key,
          bytes: item.bytes,
          kb: formatStorageBytes(item.bytes),
          category: item.category,
        })),
      );
      setLocalStorageTotal(report.localStorage.totalBytes);
      setSubStructures(
        report.localStorage.subStructures.map((sub: UserStateSubStructureInfo) => ({
          name: sub.name,
          bytes: sub.bytes,
          kb: formatStorageBytes(sub.bytes),
        })),
      );
    }

    if (report.sessionStorage.available) {
      setSessionStorageItems(
        report.sessionStorage.items.map((item: SessionStorageItemInfo) => ({
          key: item.key,
          bytes: item.bytes,
          kb: formatStorageBytes(item.bytes),
        })),
      );
      setSessionStorageTotal(report.sessionStorage.totalBytes);
    }

    if (report.cookies.available) {
      setCookies(
        report.cookies.items.map((c: CookieAuditInfo) => ({
          name: c.name,
          bytes: c.bytes,
          kb: formatStorageBytes(c.bytes),
        })),
      );
      setCookiesTotal(report.cookies.totalBytes);
    }

    setIdbAvailable(report.indexedDb.available);
    setIndexedDbDetails(report.indexedDb.databases);

    setCachesAvailable(report.cacheStorage.available);
    setCachesList(
      report.cacheStorage.items.map((ch: CacheInfo) => ({
        name: ch.name,
        requestCount: ch.requestCount,
        estimatedBytes: ch.estimatedBytes,
        kb: ch.formattedSize,
      })),
    );

    setSwAvailable(report.serviceWorkers.available);
    setSwList(report.serviceWorkers.items);

    setEstimateAvailable(report.estimate.available);
    setEstimate(report.estimate.data);

    setLastMeasuredAt(report.measuredAt || new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    setIsClient(true);
    void runAudit();
  }, [runAudit]);

  if (!isClient) {
    return null;
  }

  const totalDbStoresCount = indexedDbDetails.reduce((acc, db) => acc + (db.stores?.length || 0), 0);

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
              <span className="font-semibold">{idbAvailable ? `${indexedDbDetails.length} banco(s), ${totalDbStoresCount} store(s)` : "Indisponível"}</span>
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

      {/* 5. Detalhamento do IndexedDB */}
      <div className="border border-white/10 rounded-xl bg-elevated/40 overflow-hidden">
        <button
          onClick={() => toggleSection("idb")}
          className="w-full px-4 py-3 flex justify-between items-center text-left font-bold text-sm bg-elevated/80 cursor-pointer"
        >
          <span>Detalhamento do IndexedDB ({idbAvailable ? `${indexedDbDetails.length} banco(s)` : "Indisponível"})</span>
          <span className="text-xs text-purple-400">{expandedSections.idb ? "▲" : "▼"}</span>
        </button>
        {expandedSections.idb && (
          <div className="p-4 space-y-3 text-xs border-t border-white/10">
            {!idbAvailable ? (
              <p className="text-muted py-2 text-center">API IndexedDB não suportada neste ambiente.</p>
            ) : indexedDbDetails.length === 0 ? (
              <p className="text-muted py-2 text-center">Nenhum banco IndexedDB encontrado.</p>
            ) : (
              indexedDbDetails.map((db) => (
                <div key={db.name} className="bg-elevated/60 p-3 rounded-lg border border-white/5 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-purple-300 break-all">{db.name}</span>
                    <span className="text-[10px] bg-purple-950/60 text-purple-300 px-2 py-0.5 rounded border border-purple-800/40 shrink-0">v{db.version}</span>
                  </div>
                  <div className="text-[11px] text-muted">Status: {db.status}</div>
                  {db.stores && db.stores.length > 0 && (
                    <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                      <span className="font-semibold text-[11px] text-zinc-300 uppercase tracking-wider">Object Stores ({db.stores.length}):</span>
                      {db.stores.map((store) => (
                        <div key={store.name} className="bg-black/30 p-2 rounded border border-white/5 space-y-0.5">
                          <div className="flex justify-between">
                            <span className="font-mono font-semibold text-emerald-300">{store.name}</span>
                            <span className="font-semibold text-amber-300">{store.count} registros</span>
                          </div>
                          {store.indexes.length > 0 && (
                            <div className="text-[10px] text-muted">Índices: {store.indexes.join(", ")}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
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

      {/* 8. Estimativa Geral (Origin Storage) */}
      <div className="border border-white/10 rounded-xl bg-elevated/40 overflow-hidden">
        <button
          onClick={() => toggleSection("estimate")}
          className="w-full px-4 py-3 flex justify-between items-center text-left font-bold text-sm bg-elevated/80 cursor-pointer"
        >
          <span>Estimativa Geral (Origin Storage)</span>
          <span className="text-xs text-purple-400">{expandedSections.estimate ? "▲" : "▼"}</span>
        </button>
        {expandedSections.estimate && (
          <div className="p-4 space-y-3 text-xs border-t border-white/10">
            {!estimateAvailable || !estimate ? (
              <p className="text-muted py-2 text-center">API navigator.storage.estimate não suportada.</p>
            ) : (
              <div className="space-y-3">
                <div className="bg-elevated/60 p-3 rounded-lg border border-white/5 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted">Uso Atual da Origem:</span>
                    <span className="font-bold text-amber-400">{formatBytes(estimate.usage)} ({estimate.usage} bytes)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Quota Máxima Disponível:</span>
                    <span className="font-semibold">{formatBytes(estimate.quota)} ({estimate.quota} bytes)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Percentual Utilizado:</span>
                    <span className="font-semibold">{estimate.percentage}</span>
                  </div>
                </div>

                {estimate.usageDetails && Object.keys(estimate.usageDetails).length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-white/5">
                    <span className="font-semibold text-[11px] text-zinc-300 uppercase tracking-wider">Detalhamento por Categoria (usageDetails):</span>
                    {Object.entries(estimate.usageDetails).map(([cat, val]) => (
                      <div key={cat} className="bg-elevated/60 px-3 py-2 rounded-lg border border-white/5 flex justify-between items-center">
                        <span className="font-mono text-zinc-300 capitalize">{cat}</span>
                        <span className="font-semibold">{formatBytes(val as number)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[10px] text-muted italic pt-1">
                  Nota: Esta estimativa é fornecida pelo navegador e agrupa todos os dados da origem. Não deve ser somada diretamente aos itens individuais do LocalStorage ou IndexedDB.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
