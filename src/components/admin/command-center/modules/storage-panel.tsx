import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cookie,
  Database,
  HardDrive,
  Info,
  Layers,
  RefreshCw,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import {
  formatStorageBytes,
  type BrowserStorageAuditReport,
  type StorageSectionStatus,
} from "@/lib/browser-storage-diagnostics";

interface StoragePanelProps {
  audit: BrowserStorageAuditReport | null;
  isLoading: boolean;
  onRefresh: () => void;
}

const SECTION_STATUS_STYLES: Record<
  StorageSectionStatus | "pending",
  { label: string; badgeClass: string; dotClass: string }
> = {
  available: {
    label: "DISPONÍVEL",
    badgeClass: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30",
    dotClass: "bg-[#10B981]",
  },
  partial: {
    label: "PARCIAL",
    badgeClass: "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
    dotClass: "bg-[#F59E0B]",
  },
  blocked: {
    label: "BLOQUEADO",
    badgeClass: "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
    dotClass: "bg-[#F59E0B]",
  },
  unavailable: {
    label: "INDISPONÍVEL",
    badgeClass: "bg-[#94A3B8]/15 text-[#94A3B8] border-[#94A3B8]/30",
    dotClass: "bg-[#94A3B8]",
  },
  error: {
    label: "ERRO",
    badgeClass: "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30",
    dotClass: "bg-[#EF4444]",
  },
  pending: {
    label: "AGUARDANDO",
    badgeClass: "bg-[#181B22] text-[#6B7280] border-[#262B36]",
    dotClass: "bg-[#6B7280]",
  },
};

function SectionStatusBadge({
  status,
}: {
  status: StorageSectionStatus | "pending";
}) {
  const style = SECTION_STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${style.badgeClass}`}
    >
      <span className={`size-1.5 rounded-full ${style.dotClass}`} />
      <span>{style.label}</span>
    </span>
  );
}

export function StoragePanel({
  audit,
  isLoading,
  onRefresh,
}: StoragePanelProps) {
  const estimateData = audit?.estimate.data ?? null;
  const usageDetailsEntries = estimateData?.usageDetails
    ? Object.entries(estimateData.usageDetails)
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho do módulo */}
      <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="size-9 shrink-0 rounded-lg bg-[#06B6D4]/15 border border-[#06B6D4]/30 flex items-center justify-center text-[#06B6D4]">
            <HardDrive className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-white font-sans tracking-tight">
                Armazenamento do Navegador
              </h2>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold bg-[#181B22] text-[#06B6D4] border border-[#06B6D4]/30">
                CLIENT-ONLY
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] font-sans leading-relaxed">
              Inspeção somente leitura exclusiva do dispositivo e navegador atuais do administrador. Não representa dados de outros visitantes nem executa limpezas, gravações ou consultas ao servidor.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <span className="px-2.5 py-2 rounded-lg bg-[#181B22] border border-[#262B36] text-[11px] font-mono text-[#9CA3AF]">
            Verificado: {audit?.measuredAt || "--:--:--"}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="min-h-[38px] flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#181B22] hover:bg-[#212630] active:bg-[#262B36] disabled:opacity-60 disabled:cursor-not-allowed border border-[#262B36] text-xs font-sans font-medium text-white transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`size-3.5 text-[#06B6D4] ${isLoading ? "animate-spin" : ""}`}
            />
            <span>{isLoading ? "Verificando..." : "Reexecutar Verificações"}</span>
          </button>
        </div>
      </div>

      {/* Resumo de utilização */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 space-y-1.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF] truncate">
              Uso da Origem
            </span>
            <SectionStatusBadge status={audit?.estimate.status ?? "pending"} />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-white truncate">
            {estimateData ? formatStorageBytes(estimateData.usage) : "--"}
          </div>
          <p className="text-[11px] text-[#9CA3AF] font-sans leading-snug break-words">
            {estimateData
              ? `${estimateData.percentage} de ${formatStorageBytes(estimateData.quota)}`
              : audit?.estimate.reason ?? "Aguardando navigator.storage.estimate()"}
          </p>
        </div>

        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 space-y-1.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF] truncate">
              LocalStorage
            </span>
            <SectionStatusBadge status={audit?.localStorage.status ?? "pending"} />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-white truncate">
            {audit?.localStorage.available
              ? formatStorageBytes(audit.localStorage.totalBytes)
              : "--"}
          </div>
          <p className="text-[11px] text-[#9CA3AF] font-sans leading-snug">
            {audit?.localStorage.available
              ? `${audit.localStorage.keyCount} chave(s) medidas (valores UTF-8)`
              : audit?.localStorage.reason ?? "Aguardando inspeção"}
          </p>
        </div>

        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 space-y-1.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF] truncate">
              IndexedDB
            </span>
            <SectionStatusBadge status={audit?.indexedDb.status ?? "pending"} />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-white truncate">
            {audit?.indexedDb.available
              ? `${audit.indexedDb.databaseCount} banco(s)`
              : "--"}
          </div>
          <p className="text-[11px] text-[#9CA3AF] font-sans leading-snug">
            {audit?.indexedDb.available
              ? `${audit.indexedDb.totalStoresCount} object store(s)`
              : audit?.indexedDb.reason ?? "Aguardando inspeção"}
          </p>
        </div>

        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 space-y-1.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF] truncate">
              Cache &amp; SW
            </span>
            <SectionStatusBadge status={audit?.cacheStorage.status ?? "pending"} />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-white truncate">
            {audit
              ? `${audit.cacheStorage.available ? audit.cacheStorage.cacheCount : "--"} / ${audit.serviceWorkers.available ? audit.serviceWorkers.registrationCount : "--"}`
              : "--"}
          </div>
          <p className="text-[11px] text-[#9CA3AF] font-sans leading-snug">
            {audit
              ? `${audit.cacheStorage.available ? `${audit.cacheStorage.cacheCount} cache(s)` : "Cache indisponível"} • ${audit.serviceWorkers.available ? `${audit.serviceWorkers.registrationCount} SW(s)` : "SW indisponível"}`
              : "Aguardando inspeção"}
          </p>
        </div>
      </section>

      {/* Detalhamento por origem (usageDetails) & Limitações */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="size-4 text-[#8B5CF6] shrink-0" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB] truncate">
                Detalhamento por Origem (usageDetails)
              </h3>
            </div>
            <SectionStatusBadge status={audit?.estimate.status ?? "pending"} />
          </div>

          {estimateData ? (
            <div className="space-y-2.5">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5">
                  <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                    Uso
                  </span>
                  <span className="text-xs font-mono font-bold text-white break-all">
                    {formatStorageBytes(estimateData.usage)}
                  </span>
                </div>
                <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5">
                  <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                    Quota
                  </span>
                  <span className="text-xs font-mono font-bold text-white break-all">
                    {formatStorageBytes(estimateData.quota)}
                  </span>
                </div>
                <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-2.5">
                  <span className="text-[10px] font-mono uppercase text-[#6B7280] block">
                    Percentual
                  </span>
                  <span className="text-xs font-mono font-bold text-[#06B6D4]">
                    {estimateData.percentage}
                  </span>
                </div>
              </div>

              {usageDetailsEntries.length > 0 ? (
                <div className="space-y-1.5">
                  {usageDetailsEntries.map(([category, bytes]) => (
                    <div
                      key={category}
                      className="rounded-lg border border-[#262B36] bg-[#181B22] px-3 py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-mono text-[#E5E7EB] break-all">
                        {category}
                      </span>
                      <span className="font-mono font-semibold text-[#06B6D4] shrink-0">
                        {formatStorageBytes(bytes)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-[#262B36] bg-[#181B22] px-3 py-2.5 text-xs text-[#9CA3AF] font-sans">
                  O navegador retornou uso/quota totais, mas não expôs a decomposição <code className="font-mono text-[#E5E7EB]">usageDetails</code>.
                </div>
              )}

              <p className="text-[11px] text-[#6B7280] font-sans leading-relaxed">
                A estimativa de origem do navegador agrupa caches internos, metadados e múltiplos subsistemas; não deve ser interpretada como a soma exata das chaves de <code className="font-mono text-[#9CA3AF]">localStorage</code> e <code className="font-mono text-[#9CA3AF]">IndexedDB</code>.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 text-xs text-[#9CA3AF] font-sans">
              {audit?.estimate.reason ?? "Aguardando consulta ao navegador."}
            </div>
          )}
        </div>

        {/* Estado de acesso e limitações */}
        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-[#06B6D4] shrink-0" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Estado de Acesso e Limitações
            </h3>
          </div>

          <div className="space-y-2">
            {(audit?.limitations ?? [
              "Aguardando execução das inspeções locais no navegador.",
            ]).map((note, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-[#262B36] bg-[#181B22] px-3 py-2.5 flex items-start gap-2.5"
              >
                {audit ? (
                  <AlertTriangle className="size-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="size-3.5 text-[#6B7280] shrink-0 mt-0.5" />
                )}
                <p className="text-xs text-[#9CA3AF] font-sans leading-relaxed break-words">
                  {note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LocalStorage + Composição de hikari-user-state-v1 */}
      <section className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <HardDrive className="size-4 text-[#06B6D4] shrink-0" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              localStorage ({audit?.localStorage.available ? formatStorageBytes(audit.localStorage.totalBytes) : "--"})
            </h3>
          </div>
          <SectionStatusBadge status={audit?.localStorage.status ?? "pending"} />
        </div>

        {!audit ? (
          <p className="text-xs text-[#9CA3AF] font-sans">Aguardando leitura no navegador.</p>
        ) : !audit.localStorage.available ? (
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 text-xs text-[#9CA3AF] font-sans">
            {audit.localStorage.reason}
          </div>
        ) : audit.localStorage.items.length === 0 ? (
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 text-xs text-[#9CA3AF] font-sans">
            Nenhuma chave encontrada no localStorage desta origem.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {audit.localStorage.items.map((item) => (
              <div
                key={item.key}
                className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 space-y-1.5 min-w-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-white break-all min-w-0">
                    {item.key}
                  </span>
                  <span className="font-mono text-xs font-bold text-[#06B6D4] shrink-0">
                    {item.formattedSize}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[#9CA3AF]">
                  <span className="px-1.5 py-0.5 rounded bg-[#111318] border border-[#262B36]">
                    {item.category}
                  </span>
                  <span>{item.bytes} bytes</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {audit?.localStorage.subStructures &&
          audit.localStorage.subStructures.length > 0 && (
            <div className="pt-3 border-t border-[#262B36] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#9CA3AF]">
                  Composição de hikari-user-state-v1 (somente tamanhos)
                </h4>
                <span className="text-[10px] font-mono text-[#6B7280]">
                  Valores omitidos por privacidade
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {audit.localStorage.subStructures.map((sub) => (
                  <div
                    key={sub.name}
                    className="rounded-lg border border-[#262B36] bg-[#181B22] px-3 py-2 flex items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <span className="font-mono text-[#E5E7EB] break-all">
                      {sub.name}
                    </span>
                    <span className="font-mono font-semibold text-[#8B5CF6] shrink-0">
                      {sub.formattedSize}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
      </section>

      {/* SessionStorage & Cookies */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              sessionStorage ({audit?.sessionStorage.available ? formatStorageBytes(audit.sessionStorage.totalBytes) : "--"})
            </h3>
            <SectionStatusBadge status={audit?.sessionStorage.status ?? "pending"} />
          </div>

          {!audit ? (
            <p className="text-xs text-[#9CA3AF] font-sans">Aguardando leitura.</p>
          ) : !audit.sessionStorage.available ? (
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 text-xs text-[#9CA3AF] font-sans">
              {audit.sessionStorage.reason}
            </div>
          ) : audit.sessionStorage.items.length === 0 ? (
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 text-xs text-[#9CA3AF] font-sans">
              Nenhuma chave armazenada no sessionStorage.
            </div>
          ) : (
            <div className="space-y-2">
              {audit.sessionStorage.items.map((item) => (
                <div
                  key={item.key}
                  className="rounded-lg border border-[#262B36] bg-[#181B22] px-3 py-2 flex items-center justify-between gap-2 text-xs min-w-0"
                >
                  <span className="font-mono text-white break-all min-w-0">
                    {item.key}
                  </span>
                  <span className="font-mono font-semibold text-[#06B6D4] shrink-0">
                    {item.formattedSize}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Cookie className="size-4 text-[#F59E0B] shrink-0" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB] truncate">
                Cookies Acessíveis via JS ({audit?.cookies.available ? formatStorageBytes(audit.cookies.totalBytes) : "--"})
              </h3>
            </div>
            <SectionStatusBadge status={audit?.cookies.status ?? "pending"} />
          </div>

          <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
            Exibe somente nomes e tamanhos em bytes. Valores nunca são exibidos, e cookies <code className="font-mono text-[#E5E7EB]">HttpOnly</code> (como tokens de sessão) permanecem ocultos pelo navegador.
          </p>

          {!audit ? (
            <p className="text-xs text-[#9CA3AF] font-sans">Aguardando leitura.</p>
          ) : !audit.cookies.available ? (
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 text-xs text-[#9CA3AF] font-sans">
              {audit.cookies.reason}
            </div>
          ) : audit.cookies.items.length === 0 ? (
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 text-xs text-[#9CA3AF] font-sans">
              Nenhum cookie acessível via JavaScript nesta origem.
            </div>
          ) : (
            <div className="space-y-2">
              {audit.cookies.items.map((c) => (
                <div
                  key={c.name}
                  className="rounded-lg border border-[#262B36] bg-[#181B22] px-3 py-2 flex items-center justify-between gap-2 text-xs min-w-0"
                >
                  <span className="font-mono text-white break-all min-w-0">
                    {c.name}
                  </span>
                  <span className="font-mono font-semibold text-[#F59E0B] shrink-0">
                    {c.formattedSize}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* IndexedDB */}
      <section className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Database className="size-4 text-[#8B5CF6] shrink-0" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              IndexedDB ({audit?.indexedDb.available ? `${audit.indexedDb.databaseCount} banco(s)` : "--"})
            </h3>
          </div>
          <SectionStatusBadge status={audit?.indexedDb.status ?? "pending"} />
        </div>

        {!audit ? (
          <p className="text-xs text-[#9CA3AF] font-sans">Aguardando leitura.</p>
        ) : !audit.indexedDb.available ? (
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 text-xs text-[#9CA3AF] font-sans">
            {audit.indexedDb.reason}
          </div>
        ) : audit.indexedDb.databases.length === 0 ? (
          <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 text-xs text-[#9CA3AF] font-sans">
            Nenhum banco IndexedDB encontrado para esta origem.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {audit.indexedDb.databases.map((db) => (
              <div
                key={db.name}
                className="rounded-lg border border-[#262B36] bg-[#181B22] p-3.5 space-y-2.5 min-w-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-white break-all min-w-0">
                    {db.name}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[10px] font-mono text-[#8B5CF6] shrink-0">
                    v{db.version}
                  </span>
                </div>
                <div className="text-[11px] font-sans text-[#9CA3AF]">
                  Status: <span className="text-[#E5E7EB]">{db.status}</span>
                </div>

                {db.stores.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-[#262B36]">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF] block">
                      Object Stores ({db.stores.length})
                    </span>
                    {db.stores.map((store) => (
                      <div
                        key={store.name}
                        className="rounded border border-[#262B36] bg-[#111318] p-2 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono font-semibold text-[#10B981] break-all">
                            {store.name}
                          </span>
                          <span className="font-mono text-[#F59E0B] shrink-0">
                            {store.count} registro(s)
                          </span>
                        </div>
                        {store.indexes.length > 0 && (
                          <div className="text-[10px] font-mono text-[#6B7280] break-words">
                            Índices: {store.indexes.join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Cache Storage & Service Workers */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB]">
              Cache Storage ({audit?.cacheStorage.available ? `${audit.cacheStorage.cacheCount} cache(s)` : "--"})
            </h3>
            <SectionStatusBadge status={audit?.cacheStorage.status ?? "pending"} />
          </div>

          {!audit ? (
            <p className="text-xs text-[#9CA3AF] font-sans">Aguardando leitura.</p>
          ) : !audit.cacheStorage.available ? (
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 text-xs text-[#9CA3AF] font-sans">
              {audit.cacheStorage.reason}
            </div>
          ) : audit.cacheStorage.items.length === 0 ? (
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 text-xs text-[#9CA3AF] font-sans">
              Nenhum cache armazenado nesta origem.
            </div>
          ) : (
            <div className="space-y-2">
              {audit.cacheStorage.items.map((cache) => (
                <div
                  key={cache.name}
                  className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 space-y-1 min-w-0"
                >
                  <div className="flex items-start justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-white break-all min-w-0">
                      {cache.name}
                    </span>
                    <span className="font-mono font-semibold text-[#06B6D4] shrink-0">
                      {cache.formattedSize}
                    </span>
                  </div>
                  <div className="text-[11px] font-sans text-[#9CA3AF]">
                    Requisições armazenadas: {cache.requestCount}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#262B36] bg-[#111318] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Workflow className="size-4 text-[#10B981] shrink-0" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#E5E7EB] truncate">
                Service Workers ({audit?.serviceWorkers.available ? `${audit.serviceWorkers.registrationCount} registro(s)` : "--"})
              </h3>
            </div>
            <SectionStatusBadge status={audit?.serviceWorkers.status ?? "pending"} />
          </div>

          {!audit ? (
            <p className="text-xs text-[#9CA3AF] font-sans">Aguardando leitura.</p>
          ) : !audit.serviceWorkers.available ? (
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 text-xs text-[#9CA3AF] font-sans">
              {audit.serviceWorkers.reason}
            </div>
          ) : audit.serviceWorkers.items.length === 0 ? (
            <div className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 text-xs text-[#9CA3AF] font-sans">
              Nenhum Service Worker registrado nesta origem.
            </div>
          ) : (
            <div className="space-y-2">
              {audit.serviceWorkers.items.map((sw, idx) => (
                <div
                  key={`${sw.scope}-${idx}`}
                  className="rounded-lg border border-[#262B36] bg-[#181B22] p-3 space-y-1.5 min-w-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-[#10B981]/15 border border-[#10B981]/30 text-[10px] font-mono text-[#10B981] uppercase">
                      {sw.state}
                    </span>
                    <span className="text-[10px] font-mono text-[#9CA3AF]">
                      {sw.isHikari ? "Origem Hikari" : "Outro escopo"}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-[#E5E7EB] break-all">
                    Escopo: {sw.scope}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Nota final de privacidade */}
      <div className="rounded-xl border border-[#262B36] bg-[#111318] px-4 py-3 flex items-start gap-2.5">
        <ShieldAlert className="size-4 text-[#6B7280] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#9CA3AF] font-sans leading-relaxed">
          Esta ferramenta opera exclusivamente em modo de leitura no navegador do administrador. Nenhuma chave, cache ou registro foi alterado, limpo ou enviado para o servidor.
        </p>
      </div>
    </div>
  );
}
