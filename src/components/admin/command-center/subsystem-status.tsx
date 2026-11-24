import React from "react";
import { Server, Database, PlaySquare, Globe } from "lucide-react";
import type {
  CommandCenterDiagnosticsReport,
  DiagnosticStatus,
} from "@/lib/admin-diagnostics.functions";

interface SubsystemStatusProps {
  diagnostics: CommandCenterDiagnosticsReport | null;
  isLoading: boolean;
}

interface SubsystemRow {
  id: string;
  name: string;
  subtitle: string;
  detail: string | null;
  status: DiagnosticStatus;
  latencyMs: number | null;
  icon: React.ReactNode;
}

const STATUS_STYLE: Record<
  DiagnosticStatus,
  { dot: string; text: string }
> = {
  SAUDÁVEL: { dot: "bg-[#10B981]", text: "text-[#10B981]" },
  ATENÇÃO: { dot: "bg-[#F59E0B]", text: "text-[#F59E0B]" },
  CRÍTICO: { dot: "bg-[#EF4444]", text: "text-[#EF4444]" },
  INDISPONÍVEL: { dot: "bg-[#94A3B8]", text: "text-[#94A3B8]" },
  "NÃO VERIFICADO": { dot: "bg-[#6B7280]", text: "text-[#6B7280]" },
};

export function SubsystemStatus({ diagnostics, isLoading }: SubsystemStatusProps) {
  const dbRow: SubsystemRow = diagnostics
    ? {
        id: "database",
        name:
          diagnostics.database.backend === "neon"
            ? "Neon PostgreSQL"
            : "PostgreSQL (PGlite Local)",
        subtitle:
          diagnostics.database.backend === "neon"
            ? "Banco de Dados Relacional • Neon"
            : "Fallback Local (Preview • não é Neon)",
        detail: diagnostics.database.detail,
        status: diagnostics.database.status,
        latencyMs: diagnostics.database.latencyMs,
        icon: <Database className="size-4 text-[#8B5CF6]" />,
      }
    : {
        id: "database",
        name: "Neon PostgreSQL",
        subtitle: isLoading
          ? "Executando consulta SELECT 1..."
          : "Banco de Dados Relacional",
        detail: null,
        status: "NÃO VERIFICADO",
        latencyMs: null,
        icon: <Database className="size-4 text-[#8B5CF6]" />,
      };

  const redisRow: SubsystemRow = diagnostics
    ? {
        id: "redis",
        name: "Upstash Redis",
        subtitle: diagnostics.redis.configured
          ? "Cache Distribuído • Configurado"
          : "Cache Distribuído • Não configurado",
        detail: diagnostics.redis.detail,
        status: diagnostics.redis.status,
        latencyMs: diagnostics.redis.latencyMs,
        icon: <Server className="size-4 text-[#06B6D4]" />,
      }
    : {
        id: "redis",
        name: "Upstash Redis",
        subtitle: isLoading
          ? "Executando comando PING..."
          : "Cache Distribuído",
        detail: null,
        status: "NÃO VERIFICADO",
        latencyMs: null,
        icon: <Server className="size-4 text-[#06B6D4]" />,
      };

  const rows: SubsystemRow[] = [
    dbRow,
    redisRow,
    {
      id: "player",
      name: "Hikari Player",
      subtitle: "Streaming & HLS Engine",
      detail: null,
      status: "NÃO VERIFICADO",
      latencyMs: null,
      icon: <PlaySquare className="size-4 text-[#10B981]" />,
    },
    {
      id: "external",
      name: "APIs externas",
      subtitle: "AniList & Metadados",
      detail: null,
      status: "NÃO VERIFICADO",
      latencyMs: null,
      icon: <Globe className="size-4 text-[#F59E0B]" />,
    },
  ];

  const activeProbesCount = diagnostics ? diagnostics.activeProbesCount : 0;
  const totalSubsystemsCount = diagnostics ? diagnostics.totalSubsystemsCount : 4;

  return (
    <div className="rounded-xl border border-[#262B36] bg-[#111318] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#9CA3AF]">
          Estado dos Subsistemas
        </h3>
        <span className="text-[10px] font-mono text-[#9CA3AF]">
          {activeProbesCount} / {totalSubsystemsCount} Sondas Ativas
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map((sub) => {
          const style = STATUS_STYLE[sub.status];
          return (
            <div
              key={sub.id}
              className="flex flex-col justify-between gap-2 p-3.5 rounded-lg bg-[#181B22] border border-[#262B36]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-8 shrink-0 rounded-lg bg-[#111318] border border-[#262B36] flex items-center justify-center">
                    {sub.icon}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white font-sans block truncate">
                      {sub.name}
                    </span>
                    <span className="text-[10px] text-[#6B7280] font-sans block truncate">
                      {sub.subtitle}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {sub.latencyMs !== null && (
                    <span className="px-1.5 py-0.5 rounded bg-[#111318] border border-[#262B36] text-[10px] font-mono text-[#E5E7EB]">
                      {sub.latencyMs} ms
                    </span>
                  )}
                  <span className={`size-2 rounded-full ${style.dot}`} />
                  <span
                    className={`text-[10px] font-mono font-medium ${style.text}`}
                  >
                    {sub.status}
                  </span>
                </div>
              </div>

              {sub.detail && (
                <p className="text-[11px] text-[#9CA3AF] font-sans leading-snug border-t border-[#262B36]/60 pt-2">
                  {sub.detail}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

