import { BarChart3 } from "lucide-react";
import type {
  TrackingStatus,
  UserAnimeTrackingItem,
} from "@/types/profile-tracking";

interface ProfileAnimeStatsProps {
  items: UserAnimeTrackingItem[];
  onUpdateItem?: (updatedItem: UserAnimeTrackingItem) => void;
}

export function ProfileAnimeStats({ items }: ProfileAnimeStatsProps) {
  // Contagens mapeadas por status oficial:
  // "watching" → Assistindo
  // "completed" → Concluídos
  // "on_hold" → Em espera
  // "dropped" → Abandonados
  // "planning" → Planejados
  const watchingCount = items.filter((i) => i.status === "watching").length;
  const completedCount = items.filter((i) => i.status === "completed").length;
  const onHoldCount = items.filter((i) => i.status === "on_hold").length;
  const droppedCount = items.filter((i) => i.status === "dropped").length;
  const planningCount = items.filter((i) => i.status === "planning").length;

  const totalEntries = items.length;

  // Episódios assistidos acumulados reais
  const episodesWatched = items.reduce(
    (acc, curr) => acc + (curr.episodesWatched || 0),
    0,
  );

  // Mean Score: calculada exclusivamente sobre entradas com nota válida (> 0)
  const scoredItems = items.filter(
    (i) => typeof i.score === "number" && i.score > 0,
  );
  const meanScore =
    scoredItems.length > 0
      ? (
          scoredItems.reduce((acc, curr) => acc + (curr.score || 0), 0) /
          scoredItems.length
        ).toFixed(1)
      : null;

  // Percentuais de distribuição para a barra horizontal
  const pctWatching = totalEntries > 0 ? (watchingCount / totalEntries) * 100 : 0;
  const pctCompleted = totalEntries > 0 ? (completedCount / totalEntries) * 100 : 0;
  const pctOnHold = totalEntries > 0 ? (onHoldCount / totalEntries) * 100 : 0;
  const pctDropped = totalEntries > 0 ? (droppedCount / totalEntries) * 100 : 0;
  const pctPlanning = totalEntries > 0 ? (planningCount / totalEntries) * 100 : 0;

  const statusIndicators: Array<{
    status: TrackingStatus;
    label: string;
    count: number;
    dotColor: string;
  }> = [
    {
      status: "watching",
      label: "Assistindo",
      count: watchingCount,
      dotColor: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
    },
    {
      status: "completed",
      label: "Concluídos",
      count: completedCount,
      dotColor: "bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]",
    },
    {
      status: "on_hold",
      label: "Em espera",
      count: onHoldCount,
      dotColor: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
    },
    {
      status: "dropped",
      label: "Abandonados",
      count: droppedCount,
      dotColor: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
    },
    {
      status: "planning",
      label: "Planejados",
      count: planningCount,
      dotColor: "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]",
    },
  ];

  return (
    <section
      aria-label="Anime Stats do Usuário"
      className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#100e1f] via-[#0b0915] to-[#07060c] p-5 sm:p-7 shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
    >
      {/* Luz ambiente de fundo violeta sutil */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-violet-600/10 blur-[100px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-20 size-72 rounded-full bg-purple-900/15 blur-[90px]"
        aria-hidden="true"
      />

      {/* 1. Título Anime Stats */}
      <div className="relative mb-4 flex items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
            <BarChart3 className="size-4" />
          </div>
          <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white">
            Anime Stats
          </h2>
        </div>
      </div>

      {/* 2. Linha compacta: Days Watched à esquerda e Mean Score à direita */}
      <div className="relative mb-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs sm:text-sm">
        {/* Days Watched */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-zinc-400 font-medium">Days Watched:</span>
          <span className="font-semibold text-zinc-300">Indisponível</span>
        </div>

        {/* Mean Score */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-zinc-400 font-medium">Mean Score:</span>
          {meanScore ? (
            <span className="font-semibold text-white tabular-nums">
              {meanScore}
            </span>
          ) : (
            <span className="font-semibold text-zinc-400">—</span>
          )}
        </div>
      </div>

      {/* 3. Barra horizontal de distribuição proporcional por status */}
      <div className="relative mb-5 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] sm:text-xs">
          <span className="font-medium text-zinc-400">
            Distribuição por Status
          </span>
          <span className="text-zinc-500 tabular-nums">
            {totalEntries > 0 ? "100%" : "0 entradas"}
          </span>
        </div>

        {/* Trilho horizontal da barra */}
        <div className="flex h-3 sm:h-3.5 w-full overflow-hidden rounded-full bg-white/[0.05] p-0.5 ring-1 ring-white/[0.08]">
          {totalEntries > 0 ? (
            <>
              {pctWatching > 0 && (
                <a
                  href="/account?status=watching"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ width: `${pctWatching}%` }}
                  className="h-full bg-emerald-500 transition-all duration-300 first:rounded-l-full last:rounded-r-full cursor-pointer hover:opacity-85"
                  title={`Assistindo: ${watchingCount} (${pctWatching.toFixed(0)}%) — abrir em nova guia`}
                  aria-label={`Abrir Assistindo (${watchingCount}) em nova guia`}
                />
              )}
              {pctCompleted > 0 && (
                <a
                  href="/account?status=completed"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ width: `${pctCompleted}%` }}
                  className="h-full bg-violet-500 transition-all duration-300 first:rounded-l-full last:rounded-r-full cursor-pointer hover:opacity-85"
                  title={`Concluídos: ${completedCount} (${pctCompleted.toFixed(0)}%) — abrir em nova guia`}
                  aria-label={`Abrir Concluídos (${completedCount}) em nova guia`}
                />
              )}
              {pctOnHold > 0 && (
                <a
                  href="/account?status=on_hold"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ width: `${pctOnHold}%` }}
                  className="h-full bg-amber-500 transition-all duration-300 first:rounded-l-full last:rounded-r-full cursor-pointer hover:opacity-85"
                  title={`Em espera: ${onHoldCount} (${pctOnHold.toFixed(0)}%) — abrir em nova guia`}
                  aria-label={`Abrir Em espera (${onHoldCount}) em nova guia`}
                />
              )}
              {pctDropped > 0 && (
                <a
                  href="/account?status=dropped"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ width: `${pctDropped}%` }}
                  className="h-full bg-rose-500 transition-all duration-300 first:rounded-l-full last:rounded-r-full cursor-pointer hover:opacity-85"
                  title={`Abandonados: ${droppedCount} (${pctDropped.toFixed(0)}%) — abrir em nova guia`}
                  aria-label={`Abrir Abandonados (${droppedCount}) em nova guia`}
                />
              )}
              {pctPlanning > 0 && (
                <a
                  href="/account?status=planning"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ width: `${pctPlanning}%` }}
                  className="h-full bg-cyan-500 transition-all duration-300 first:rounded-l-full last:rounded-r-full cursor-pointer hover:opacity-85"
                  title={`Planejados: ${planningCount} (${pctPlanning.toFixed(0)}%) — abrir em nova guia`}
                  aria-label={`Abrir Planejados (${planningCount}) em nova guia`}
                />
              )}
            </>
          ) : (
            <div
              className="h-full w-full rounded-full bg-white/[0.04]"
              title="Sem dados de acompanhamento no momento"
            />
          )}
        </div>
      </div>

      {/* 4. Abaixo da barra, organização estrita em duas colunas */}
      <div className="relative grid grid-cols-1 min-[420px]:grid-cols-2 gap-4 sm:gap-8 border-t border-white/[0.06] pt-4">
        {/* Coluna Esquerda: Assistindo, Concluídos, Em espera, Abandonados e Planejados (Clicáveis, abrem em nova guia) */}
        <div className="space-y-1.5">
          {statusIndicators.map(({ status, label, count, dotColor }) => {
            return (
              <a
                key={status}
                href={`/account?status=${status}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-full flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-xl transition-all duration-200 cursor-pointer hover:bg-white/[0.05] text-zinc-300 hover:text-white"
                aria-label={`Abrir ${label}: ${count} animes em nova guia`}
                title={`Abrir lista de ${label} em nova guia`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`size-2 rounded-full shrink-0 ${dotColor}`}
                  />
                  <span className="truncate">
                    {label}
                  </span>
                </div>
                <span className="font-semibold tabular-nums shrink-0 text-zinc-200">
                  {count}
                </span>
              </a>
            );
          })}
        </div>

        {/* Coluna Direita: Total de entradas, Reassistidos e Episódios assistidos */}
        <div className="space-y-1.5">
          {/* Total de entradas */}
          <div className="flex items-center justify-between gap-2 text-xs py-1.5 px-2.5">
            <span className="text-zinc-300">Total de entradas</span>
            <span className="font-bold text-white tabular-nums">
              {totalEntries}
            </span>
          </div>

          {/* Reassistidos */}
          <div className="flex items-center justify-between gap-2 text-xs py-1.5 px-2.5">
            <span className="text-zinc-300">Reassistidos</span>
            <span className="font-medium text-zinc-400">Indisponível</span>
          </div>

          {/* Episódios assistidos */}
          <div className="flex items-center justify-between gap-2 text-xs py-1.5 px-2.5">
            <span className="text-zinc-300">Episódios assistidos</span>
            <span className="font-bold text-violet-300 tabular-nums">
              {episodesWatched}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

