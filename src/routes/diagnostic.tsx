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

function DiagnosticPage() {
  const [items, setItems] = useState<StorageItemInfo[]>([]);
  const [subStructures, setSubStructures] = useState<SubStructureInfo[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [lastMeasuredAt, setLastMeasuredAt] = useState<string>("");
  const [isClient, setIsClient] = useState(false);

  const runMeasurement = useCallback(() => {
    if (typeof window === "undefined" || !window.localStorage) return;

    const rawSizes = measureLocalStorageSizes();
    const mapped: StorageItemInfo[] = [];
    let cumulative = 0;

    for (const [key, bytes] of Object.entries(rawSizes)) {
      if (
        key.startsWith("hikari") ||
        key.startsWith("progress") ||
        key.startsWith("ep-progress") ||
        key.includes("hikari")
      ) {
        cumulative += bytes;
        let category = "Outros Hikari";
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
          kb: (bytes / 1024).toFixed(2) + " KB",
          category,
        });
      }
    }

    mapped.sort((a, b) => b.bytes - a.bytes);
    setItems(mapped);
    setTotalBytes(cumulative);

    const subs: SubStructureInfo[] = [];
    try {
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
              kb: (subBytes / 1024).toFixed(2) + " KB",
            });
          }
        }
        subs.sort((a, b) => b.bytes - a.bytes);
      }
    } catch {
      // ignore parse errors
    }
    setSubStructures(subs);
    setLastMeasuredAt(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    setIsClient(true);
    runMeasurement();
  }, [runMeasurement]);

  if (!isClient) {
    return null;
  }

  const expectedKeys = [
    "hikari-user-state-v1",
    "hikari-catalog-fallback-v1",
    "hikari_anime_user_cache_v1",
    "hikari-episode-outbox-v1",
    "hikari-deleted-episodes-v1",
    "hikari-catalog-v1",
  ];

  const foundKeysSet = new Set(items.map((i) => i.key));

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6 text-fg">
      <header className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">Diagnóstico de Armazenamento</h1>
        <p className="text-xs text-muted">Ferramenta temporária de leitura (Somente Cliente)</p>
      </header>

      <div className="bg-elevated p-4 rounded-xl border border-white/10 space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted">Total Ocupado:</span>
          <span className="font-bold text-amber-400">{(totalBytes / 1024).toFixed(2)} KB ({totalBytes} bytes)</span>
        </div>
        <div className="flex justify-between items-center text-xs text-muted">
          <span>Última medição:</span>
          <span>{lastMeasuredAt || "Agora mesmo"}</span>
        </div>
        <button
          onClick={runMeasurement}
          className="w-full mt-2 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
        >
          Atualizar Medição
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Chaves Encontradas ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-xs text-muted py-4 text-center">Nenhuma chave do Hikari encontrada no localStorage.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.key} className="bg-elevated/60 p-3 rounded-lg border border-white/5 space-y-1 text-xs">
                <div className="flex justify-between items-start">
                  <span className="font-mono font-semibold text-purple-300 break-all">{item.key}</span>
                  <span className="font-bold shrink-0 ml-2">{item.kb}</span>
                </div>
                <div className="flex justify-between text-[11px] text-muted">
                  <span>Categoria: {item.category}</span>
                  <span>{item.bytes} bytes</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {subStructures.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Composição de hikari-user-state-v1</h2>
          <div className="space-y-1.5">
            {subStructures.map((sub) => (
              <div key={sub.name} className="bg-elevated/60 px-3 py-2 rounded-lg border border-white/5 flex justify-between items-center text-xs">
                <span className="font-mono text-zinc-300">{sub.name}</span>
                <span className="font-semibold">{sub.kb}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted">Status de Chaves Esperadas</h2>
        <div className="space-y-1 text-xs">
          {expectedKeys.map((k) => {
            const exists = foundKeysSet.has(k);
            return (
              <div key={k} className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="font-mono text-zinc-400">{k}</span>
                <span className={exists ? "text-emerald-400 font-semibold" : "text-muted"}>
                  {exists ? "Presente" : "Não encontrada (Ausente)"}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
