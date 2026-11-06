import { BarChart3, Clock, Star, Tv } from "lucide-react";
import type { UserAnimeTrackingItem } from "@/types/profile-tracking";

interface ProfileAnimeStatsProps {
  items: UserAnimeTrackingItem[];
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
      <div className="relative mb-5 flex items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
            <BarChart3 className="size-4" />
          </div>
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white">
              Anime Stats
            </h2>
            <p className="text-xs text-zinc-400">
              Estatísticas consolidadas do catálogo pessoal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
          <Tv className="size-3.5 text-violet-400" />
          <span className="font-semibold text-white tabular-nums">
            {totalEntries}
          </span>
          <span>{totalEntries === 1 ? "anime" : "animes"}</span>
        </div>
      </div>

      {/* 2. Days Watched e Mean Score na mesma linha */}
      <div className="relative mb-5 grid grid-cols-2 gap-3 sm:gap-4">
        {/* Days Watched */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5 sm:p-4 transition-colors hover:border-violet-500/20 hover:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-medium uppercase tracking-wider text-zinc-400">
              Days Watched
            </span>
            <div className="flex size-6 sm:size-7 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-400">
              <Clock className="size-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="font-display text-lg sm:text-2xl md:text-3xl font-bold tracking-tight text-zinc-300">
              Indisponível
            </span>
          </div>
          <p className="mt-1 text-[10px] sm:text-[11px] text-zinc-500 truncate">
            Requer duração catalogada
          </p>
        </div>

        {/* Mean Score */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5 sm:p-4 transition-colors hover:border-violet-500/20 hover:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-medium uppercase tracking-wider text-zinc-400">
              Mean Score
            </span>
            <div className="flex size-6 sm:size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Star className="size-3.5 fill-amber-400/40" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            {meanScore ? (
              <>
                <span className="font-display text-lg sm:text-2xl md:text-3xl font-bold tracking-tight text-white tabular-nums">
                  {meanScore}
                </span>
                <span className="text-[10px] sm:text-xs text-zinc-400">/ 10</span>
              </>
            ) : (
              <span className="font-display text-lg sm:text-2xl md:text-3xl font-bold tracking-tight text-zinc-400">
                —
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] sm:text-[11px] text-zinc-500 truncate">
            {scoredItems.length > 0
              ? `${scoredItems.length} ${scoredItems.length === 1 ? "nota atribuída" : "notas atribuídas"}`
              : "Sem notas atribuídas"}
          </p>
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
                <div
                  style={{ width: `${pctWatching}%` }}
                  className="h-full bg-emerald-500 transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                  title={`Assistindo: ${watchingCount} (${pctWatching.toFixed(0)}%)`}
                />
              )}
              {pctCompleted > 0 && (
                <div
                  style={{ width: `${pctCompleted}%` }}
                  className="h-full bg-violet-500 transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                  title={`Concluídos: ${completedCount} (${pctCompleted.toFixed(0)}%)`}
                />
              )}
              {pctOnHold > 0 && (
                <div
                  style={{ width: `${pctOnHold}%` }}
                  className="h-full bg-amber-500 transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                  title={`Em espera: ${onHoldCount} (${pctOnHold.toFixed(0)}%)`}
                />
              )}
              {pctDropped > 0 && (
                <div
                  style={{ width: `${pctDropped}%` }}
                  className="h-full bg-rose-500 transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                  title={`Abandonados: ${droppedCount} (${pctDropped.toFixed(0)}%)`}
                />
              )}
              {pctPlanning > 0 && (
                <div
                  style={{ width: `${pctPlanning}%` }}
                  className="h-full bg-cyan-500 transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                  title={`Planejados: ${planningCount} (${pctPlanning.toFixed(0)}%)`}
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
        {/* Coluna Esquerda: Assistindo, Concluídos, Em espera, Abandonados e Planejados */}
        <div className="space-y-2.5">
          {/* Assistindo */}
          <div className="flex items-center justify-between gap-2 text-xs py-0.5">
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
              <span>Assistindo</span>
            </div>
            <span className="font-semibold text-white tabular-nums">
              {watchingCount}
            </span>
          </div>

          {/* Concluídos */}
          <div className="flex items-center justify-between gap-2 text-xs py-0.5">
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="size-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)] shrink-0" />
              <span>Concluídos</span>
            </div>
            <span className="font-semibold text-white tabular-nums">
              {completedCount}
            </span>
          </div>

          {/* Em espera */}
          <div className="flex items-center justify-between gap-2 text-xs py-0.5">
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="size-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] shrink-0" />
              <span>Em espera</span>
            </div>
            <span className="font-semibold text-white tabular-nums">
              {onHoldCount}
            </span>
          </div>

          {/* Abandonados */}
          <div className="flex items-center justify-between gap-2 text-xs py-0.5">
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="size-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] shrink-0" />
              <span>Abandonados</span>
            </div>
            <span className="font-semibold text-white tabular-nums">
              {droppedCount}
            </span>
          </div>

          {/* Planejados */}
          <div className="flex items-center justify-between gap-2 text-xs py-0.5">
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="size-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)] shrink-0" />
              <span>Planejados</span>
            </div>
            <span className="font-semibold text-white tabular-nums">
              {planningCount}
            </span>
          </div>
        </div>

        {/* Coluna Direita: Total de entradas, Reassistidos e Episódios assistidos */}
        <div className="space-y-2.5">
          {/* Total de entradas */}
          <div className="flex items-center justify-between gap-2 text-xs py-0.5">
            <span className="text-zinc-300">Total de entradas</span>
            <span className="font-bold text-white tabular-nums">
              {totalEntries}
            </span>
          </div>

          {/* Reassistidos */}
          <div className="flex items-center justify-between gap-2 text-xs py-0.5">
            <span className="text-zinc-300">Reassistidos</span>
            <span className="font-medium text-zinc-400">
              Indisponível
            </span>
          </div>

          {/* Episódios assistidos */}
          <div className="flex items-center justify-between gap-2 text-xs py-0.5">
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
