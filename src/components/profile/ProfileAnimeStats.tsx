import { Link } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  TrackingStatus,
  UserAnimeTrackingItem,
} from "@/types/profile-tracking";

interface ProfileAnimeStatsProps {
  items: UserAnimeTrackingItem[];
  onUpdateItem?: (updatedItem: UserAnimeTrackingItem) => void;
  profileNick?: string;
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface AnimatedStatValueProps {
  value: number;
  decimals?: number;
  suffix?: string;
  exactText?: string;
  durationMs?: number;
}

/**
 * Contador numérico progressivo com requestAnimationFrame e atualização direta via ref,
 * evitando re-renderizações do React durante a animação e respeitando prefers-reduced-motion.
 */
const AnimatedStatValue = React.memo(function AnimatedStatValue({
  value,
  decimals = 0,
  suffix = "",
  exactText,
  durationMs = 560,
}: AnimatedStatValueProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevValueRef = useRef<number | null>(null);
  const currentDisplayRef = useRef<number>(0);

  const finalDisplay =
    exactText ??
    `${decimals > 0 ? value.toFixed(decimals) : String(Math.round(value))}${suffix}`;

  useIsomorphicLayoutEffect(() => {
    const node = spanRef.current;
    if (!node) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    if (prefersReducedMotion || typeof window === "undefined") {
      prevValueRef.current = value;
      currentDisplayRef.current = value;
      node.textContent = finalDisplay;
      return;
    }

    const startValue = prevValueRef.current === null ? 0 : prevValueRef.current;
    if (startValue === value) {
      prevValueRef.current = value;
      currentDisplayRef.current = value;
      node.textContent = finalDisplay;
      return;
    }

    const formatNumber = (num: number) =>
      `${decimals > 0 ? num.toFixed(decimals) : String(Math.round(num))}${suffix}`;

    let rafId = 0;
    const startTime = performance.now();

    node.textContent = formatNumber(startValue);
    currentDisplayRef.current = startValue;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // easeOutCubic para desaceleração suave ao atingir o valor real
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (value - startValue) * eased;
      currentDisplayRef.current = current;

      if (progress < 1) {
        node.textContent = formatNumber(current);
        rafId = window.requestAnimationFrame(step);
      } else {
        prevValueRef.current = value;
        currentDisplayRef.current = value;
        node.textContent = finalDisplay;
      }
    };

    rafId = window.requestAnimationFrame(step);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      prevValueRef.current = currentDisplayRef.current;
    };
  }, [value, decimals, suffix, finalDisplay, durationMs]);

  return <span ref={spanRef}>{finalDisplay}</span>;
});

export const ProfileAnimeStats = React.memo(function ProfileAnimeStats({
  items,
  profileNick,
}: ProfileAnimeStatsProps) {
  const [hoveredStatus, setHoveredStatus] = useState<TrackingStatus | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<TrackingStatus | null>(null);

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

  const barSegments = [
    {
      status: "watching" as const,
      label: "Assistindo",
      count: watchingCount,
      pct: pctWatching,
      colorClass: "bg-emerald-500",
    },
    {
      status: "completed" as const,
      label: "Concluídos",
      count: completedCount,
      pct: pctCompleted,
      colorClass: "bg-violet-500",
    },
    {
      status: "on_hold" as const,
      label: "Em espera",
      count: onHoldCount,
      pct: pctOnHold,
      colorClass: "bg-amber-500",
    },
    {
      status: "dropped" as const,
      label: "Abandonados",
      count: droppedCount,
      pct: pctDropped,
      colorClass: "bg-rose-500",
    },
    {
      status: "planning" as const,
      label: "Planejados",
      count: planningCount,
      pct: pctPlanning,
      colorClass: "bg-cyan-500",
    },
  ];

  const activeHighlightStatus = selectedStatus ?? hoveredStatus;

  return (
    <section
      aria-label="Anime Stats do Usuário"
      className="group/stats anime-stats-enter relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#100e1f] via-[#0b0915] to-[#07060c] p-5 sm:p-7 shadow-[0_16px_50px_rgba(0,0,0,0.6)] transition-[border-color,box-shadow] duration-300 ease-out hover:border-white/[0.13]"
    >
      {/* Luz ambiente de fundo violeta sutil (otimizada com gradientes radiais em vez de filtros gaussianos) */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.10)_0%,rgba(139,92,246,0.05)_45%,transparent_70%)] transition-opacity duration-500 group-hover/stats:opacity-100 opacity-85"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-20 size-72 rounded-full bg-[radial-gradient(circle,rgba(88,28,135,0.15)_0%,rgba(88,28,135,0.07)_45%,transparent_70%)] transition-opacity duration-500 group-hover/stats:opacity-100 opacity-85"
        aria-hidden="true"
      />

      {/* 1. Título Anime Stats */}
      <div
        style={{ "--stats-delay": "30ms" } as React.CSSProperties}
        className="anime-stats-item-enter relative mb-4 flex items-center justify-between gap-3 border-b border-white/[0.06] pb-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-transform duration-300 ease-out group-hover/stats:scale-105">
            <BarChart3 className="size-4" />
          </div>
          <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white">
            Anime Stats
          </h2>
        </div>
      </div>

      {/* 2. Linha compacta: Days Watched à esquerda e Mean Score à direita */}
      <div
        style={{ "--stats-delay": "70ms" } as React.CSSProperties}
        className="anime-stats-item-enter relative mb-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs sm:text-sm"
      >
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
              <AnimatedStatValue
                value={Number(meanScore)}
                decimals={1}
                exactText={meanScore}
                durationMs={560}
              />
            </span>
          ) : (
            <span className="font-semibold text-zinc-400">—</span>
          )}
        </div>
      </div>

      {/* 3. Barra horizontal de distribuição proporcional por status */}
      <div
        style={{ "--stats-delay": "105ms" } as React.CSSProperties}
        className="anime-stats-item-enter relative mb-5 space-y-1.5"
      >
        <div className="flex items-center justify-between text-[11px] sm:text-xs">
          <span className="font-medium text-zinc-400">
            Distribuição por Status
          </span>
          <span className="text-zinc-500 tabular-nums">
            {totalEntries > 0 ? (
              <AnimatedStatValue
                value={100}
                suffix="%"
                exactText="100%"
                durationMs={600}
              />
            ) : (
              "0 entradas"
            )}
          </span>
        </div>

        {/* Trilho horizontal da barra */}
        <div className="flex h-3 sm:h-3.5 w-full overflow-hidden rounded-full bg-white/[0.05] p-0.5 ring-1 ring-white/[0.08]">
          {totalEntries > 0 ? (
            <div className="flex h-full w-full anime-stats-bar-reveal">
              {barSegments.map(
                ({ status, label, count, pct, colorClass }) =>
                  pct > 0 && (
                    <Link
                      key={status}
                      to={profileNick ? "/profile/$nick" : "/account"}
                      params={profileNick ? { nick: profileNick } : undefined}
                      search={{ status }}
                      onClick={() => setSelectedStatus(status)}
                      onPointerEnter={(e) => {
                        if (e.pointerType === "mouse") setHoveredStatus(status);
                      }}
                      onPointerLeave={(e) => {
                        if (e.pointerType === "mouse") {
                          setHoveredStatus((prev) => (prev === status ? null : prev));
                        }
                      }}
                      style={{ width: `${pct}%` }}
                      className={`h-full ${colorClass} transition-[width,opacity,filter,transform] duration-300 ease-out first:rounded-l-full last:rounded-r-full cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/60 active:brightness-95 ${
                        activeHighlightStatus && activeHighlightStatus !== status
                          ? "opacity-45"
                          : activeHighlightStatus === status
                            ? "brightness-115 opacity-100"
                            : "hover:opacity-85"
                      }`}
                      title={`${label}: ${count} (${pct.toFixed(0)}%)`}
                      aria-label={`Ver animes ${label} (${count})`}
                    />
                  ),
              )}
            </div>
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
          {statusIndicators.map(({ status, label, count, dotColor }, index) => {
            const isHighlighted = activeHighlightStatus === status;
            const isSelected = selectedStatus === status;

            return (
              <Link
                key={status}
                to={profileNick ? "/profile/$nick" : "/account"}
                params={profileNick ? { nick: profileNick } : undefined}
                search={{ status }}
                onClick={() => setSelectedStatus(status)}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setHoveredStatus(status);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === "mouse") {
                    setHoveredStatus((prev) => (prev === status ? null : prev));
                  }
                }}
                style={{ "--stats-delay": `${140 + index * 40}ms` } as React.CSSProperties}
                className={`anime-stats-item-enter group w-full flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-xl border transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400/70 active:scale-[0.985] ${
                  isSelected
                    ? "bg-white/[0.09] border-white/[0.14] text-white shadow-[0_2px_12px_rgba(139,92,246,0.14)]"
                    : isHighlighted
                      ? "bg-white/[0.06] border-white/[0.08] text-white"
                      : "border-transparent hover:bg-white/[0.05] hover:border-white/[0.06] text-zinc-300 hover:text-white"
                }`}
                aria-label={`Ver ${label}: ${count} animes`}
                title={`Ver lista de ${label}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`size-2 rounded-full shrink-0 transition-transform duration-200 ease-out ${
                      isHighlighted ? "scale-125" : "group-hover:scale-125"
                    } ${dotColor}`}
                  />
                  <span className="truncate transition-transform duration-200 ease-out group-hover:translate-x-0.5">
                    {label}
                  </span>
                </div>
                <span className="font-semibold tabular-nums shrink-0 text-zinc-200 transition-colors duration-200 group-hover:text-white">
                  <AnimatedStatValue value={count} durationMs={520} />
                </span>
              </Link>
            );
          })}
        </div>

        {/* Coluna Direita: Total de entradas, Reassistidos e Episódios assistidos */}
        <div className="space-y-1.5">
          {/* Total de entradas */}
          <div
            style={{ "--stats-delay": "175ms" } as React.CSSProperties}
            className="anime-stats-item-enter flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-xl border border-transparent transition-[background-color,border-color] duration-200 ease-out hover:bg-white/[0.03] hover:border-white/[0.05]"
          >
            <span className="text-zinc-300">Total de entradas</span>
            <span className="font-bold text-white tabular-nums">
              <AnimatedStatValue value={totalEntries} durationMs={560} />
            </span>
          </div>

          {/* Reassistidos */}
          <div
            style={{ "--stats-delay": "225ms" } as React.CSSProperties}
            className="anime-stats-item-enter flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-xl border border-transparent transition-[background-color,border-color] duration-200 ease-out hover:bg-white/[0.03] hover:border-white/[0.05]"
          >
            <span className="text-zinc-300">Reassistidos</span>
            <span className="font-medium text-zinc-400">Indisponível</span>
          </div>

          {/* Episódios assistidos */}
          <div
            style={{ "--stats-delay": "275ms" } as React.CSSProperties}
            className="anime-stats-item-enter flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-xl border border-transparent transition-[background-color,border-color] duration-200 ease-out hover:bg-white/[0.03] hover:border-white/[0.05]"
          >
            <span className="text-zinc-300">Episódios assistidos</span>
            <span className="font-bold text-violet-300 tabular-nums">
              <AnimatedStatValue value={episodesWatched} durationMs={620} />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
});


