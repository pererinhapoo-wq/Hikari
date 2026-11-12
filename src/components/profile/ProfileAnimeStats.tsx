import { Link } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import React, { useMemo } from "react";
import type {
  TrackingStatus,
  UserAnimeTrackingItem,
} from "@/types/profile-tracking";

interface ProfileAnimeStatsProps {
  items: UserAnimeTrackingItem[];
  onUpdateItem?: (updatedItem: UserAnimeTrackingItem) => void;
  profileNick?: string;
}

export const ProfileAnimeStats = React.memo(function ProfileAnimeStats({
  items,
  profileNick,
}: ProfileAnimeStatsProps) {
  // Cálculo em passe único O(N) em memória com useMemo para listas grandes
  const stats = useMemo(() => {
    let watching = 0;
    let completed = 0;
    let onHold = 0;
    let dropped = 0;
    let planning = 0;
    let episodesSum = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    const len = items.length;
    for (let i = 0; i < len; i++) {
      const item = items[i];
      switch (item.status) {
        case "watching":
          watching++;
          break;
        case "completed":
          completed++;
          break;
        case "on_hold":
          onHold++;
          break;
        case "dropped":
          dropped++;
          break;
        case "planning":
          planning++;
          break;
      }

      if (item.episodesWatched) {
        episodesSum += item.episodesWatched;
      }

      if (typeof item.score === "number" && item.score > 0) {
        scoreSum += item.score;
        scoreCount++;
      }
    }

    const mean = scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : null;
    const pctWatching = len > 0 ? (watching / len) * 100 : 0;
    const pctCompleted = len > 0 ? (completed / len) * 100 : 0;
    const pctOnHold = len > 0 ? (onHold / len) * 100 : 0;
    const pctDropped = len > 0 ? (dropped / len) * 100 : 0;
    const pctPlanning = len > 0 ? (planning / len) * 100 : 0;

    return {
      watchingCount: watching,
      completedCount: completed,
      onHoldCount: onHold,
      droppedCount: dropped,
      planningCount: planning,
      totalEntries: len,
      episodesWatched: episodesSum,
      meanScore: mean,
      pctWatching,
      pctCompleted,
      pctOnHold,
      pctDropped,
      pctPlanning,
    };
  }, [items]);

  const {
    watchingCount,
    completedCount,
    onHoldCount,
    droppedCount,
    planningCount,
    totalEntries,
    episodesWatched,
    meanScore,
    pctWatching,
    pctCompleted,
    pctOnHold,
    pctDropped,
    pctPlanning,
  } = stats;

  const statusIndicators: Array<{
    status: TrackingStatus;
    label: string;
    count: number;
    dotColor: string;
  }> = useMemo(
    () => [
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
    ],
    [watchingCount, completedCount, onHoldCount, droppedCount, planningCount],
  );

  return (
    <section
      aria-label="Anime Stats do Usuário"
      className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#100e1f] via-[#0b0915] to-[#07060c] p-5 sm:p-7 shadow-[0_16px_50px_rgba(0,0,0,0.6)]"
    >
      {/* Luz ambiente de fundo violeta sutil (otimizada com gradientes radiais em vez de filtros gaussianos) */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.10)_0%,rgba(139,92,246,0.05)_45%,transparent_70%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-20 size-72 rounded-full bg-[radial-gradient(circle,rgba(88,28,135,0.15)_0%,rgba(88,28,135,0.07)_45%,transparent_70%)]"
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
                <Link
                  to={profileNick ? "/profile/$nick" : "/account"}
                  params={profileNick ? { nick: profileNick } : undefined}
                  search={{ status: "watching" }}
                  style={{ width: `${pctWatching}%` }}
                  className="h-full bg-emerald-500 transition-all duration-300 first:rounded-l-full last:rounded-r-full cursor-pointer hover:opacity-85"
                  title={`Assistindo: ${watchingCount} (${pctWatching.toFixed(0)}%)`}
                  aria-label={`Ver animes Assistindo (${watchingCount})`}
                />
              )}
              {pctCompleted > 0 && (
                <Link
                  to={profileNick ? "/profile/$nick" : "/account"}
                  params={profileNick ? { nick: profileNick } : undefined}
                  search={{ status: "completed" }}
                  style={{ width: `${pctCompleted}%` }}
                  className="h-full bg-violet-500 transition-all duration-300 first:rounded-l-full last:rounded-r-full cursor-pointer hover:opacity-85"
                  title={`Concluídos: ${completedCount} (${pctCompleted.toFixed(0)}%)`}
                  aria-label={`Ver animes Concluídos (${completedCount})`}
                />
              )}
              {pctOnHold > 0 && (
                <Link
                  to={profileNick ? "/profile/$nick" : "/account"}
                  params={profileNick ? { nick: profileNick } : undefined}
                  search={{ status: "on_hold" }}
                  style={{ width: `${pctOnHold}%` }}
                  className="h-full bg-amber-500 transition-all duration-300 first:rounded-l-full last:rounded-r-full cursor-pointer hover:opacity-85"
                  title={`Em espera: ${onHoldCount} (${pctOnHold.toFixed(0)}%)`}
                  aria-label={`Ver animes Em espera (${onHoldCount})`}
                />
              )}
              {pctDropped > 0 && (
                <Link
                  to={profileNick ? "/profile/$nick" : "/account"}
                  params={profileNick ? { nick: profileNick } : undefined}
                  search={{ status: "dropped" }}
                  style={{ width: `${pctDropped}%` }}
                  className="h-full bg-rose-500 transition-all duration-300 first:rounded-l-full last:rounded-r-full cursor-pointer hover:opacity-85"
                  title={`Abandonados: ${droppedCount} (${pctDropped.toFixed(0)}%)`}
                  aria-label={`Ver animes Abandonados (${droppedCount})`}
                />
              )}
              {pctPlanning > 0 && (
                <Link
                  to={profileNick ? "/profile/$nick" : "/account"}
                  params={profileNick ? { nick: profileNick } : undefined}
                  search={{ status: "planning" }}
                  style={{ width: `${pctPlanning}%` }}
                  className="h-full bg-cyan-500 transition-all duration-300 first:rounded-l-full last:rounded-r-full cursor-pointer hover:opacity-85"
                  title={`Planejados: ${planningCount} (${pctPlanning.toFixed(0)}%)`}
                  aria-label={`Ver animes Planejados (${planningCount})`}
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
        {/* Coluna Esquerda: Assistindo, Concluídos, Em espera, Abandonados e Planejados (Clicáveis, navegam na mesma guia) */}
        <div className="space-y-1.5">
          {statusIndicators.map(({ status, label, count, dotColor }) => {
            return (
              <Link
                key={status}
                to={profileNick ? "/profile/$nick" : "/account"}
                params={profileNick ? { nick: profileNick } : undefined}
                search={{ status }}
                className="group w-full flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-xl transition-all duration-200 cursor-pointer hover:bg-white/[0.05] text-zinc-300 hover:text-white"
                aria-label={`Ver ${label}: ${count} animes`}
                title={`Ver lista de ${label}`}
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
              </Link>
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
});

