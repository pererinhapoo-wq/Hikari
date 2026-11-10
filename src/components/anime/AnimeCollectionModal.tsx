import { useState, useEffect } from "react";
import {
  Check,
  Film,
  Minus,
  Plus,
  Star,
  Trash2,
  X,
  Loader2,
  Bookmark,
} from "lucide-react";
import type { TrackingStatus } from "@/types/profile-tracking";
import { useScrollLock } from "@/lib/scroll-lock";

export const TRACKING_STATUS_CONFIG: Record<
  TrackingStatus,
  {
    label: string;
    dotColor: string;
    badgeBg: string;
    textColor: string;
    borderColor: string;
    activeBg: string;
    activeRing: string;
  }
> = {
  watching: {
    label: "Assistindo",
    dotColor: "bg-emerald-400",
    badgeBg: "bg-emerald-500/15",
    textColor: "text-emerald-300",
    borderColor: "border-emerald-500/50",
    activeBg: "bg-emerald-500/20 border-emerald-400/80 text-emerald-200",
    activeRing: "ring-emerald-500/30",
  },
  completed: {
    label: "Concluídos",
    dotColor: "bg-violet-400",
    badgeBg: "bg-violet-500/15",
    textColor: "text-violet-300",
    borderColor: "border-violet-500/50",
    activeBg: "bg-violet-500/20 border-violet-400/80 text-violet-200",
    activeRing: "ring-violet-500/30",
  },
  on_hold: {
    label: "Em espera",
    dotColor: "bg-amber-400",
    badgeBg: "bg-amber-500/15",
    textColor: "text-amber-300",
    borderColor: "border-amber-500/50",
    activeBg: "bg-amber-500/20 border-amber-400/80 text-amber-200",
    activeRing: "ring-amber-500/30",
  },
  dropped: {
    label: "Abandonados",
    dotColor: "bg-rose-400",
    badgeBg: "bg-rose-500/15",
    textColor: "text-rose-300",
    borderColor: "border-rose-500/50",
    activeBg: "bg-rose-500/20 border-rose-400/80 text-rose-200",
    activeRing: "ring-rose-500/30",
  },
  planning: {
    label: "Planejados",
    dotColor: "bg-cyan-400",
    badgeBg: "bg-cyan-500/15",
    textColor: "text-cyan-300",
    borderColor: "border-cyan-500/50",
    activeBg: "bg-cyan-500/20 border-cyan-400/80 text-cyan-200",
    activeRing: "ring-cyan-500/30",
  },
};

export const ALL_TRACKING_STATUSES: TrackingStatus[] = [
  "watching",
  "completed",
  "on_hold",
  "dropped",
  "planning",
];

const SCORE_LABELS: Record<number, string> = {
  1: "Péssimo",
  2: "Terrível",
  3: "Muito Ruim",
  4: "Ruim",
  5: "Mediano",
  6: "Razoável",
  7: "Bom",
  8: "Muito Bom",
  9: "Excelente",
  10: "Obra-Prima",
};

export interface AnimeCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  anime: {
    id: string;
    title?: string;
    cover?: string | null;
    banner?: string | null;
    format?: string | null;
    year?: number | null;
    episodesCount?: number | null;
    status?: string | null;
    score?: number | null;
  };
  initialStatus: TrackingStatus | null;
  initialEpisodesWatched: number;
  initialScore: number | null;
  loading?: boolean;
  onSave: (data: {
    status: TrackingStatus;
    episodesWatched: number;
    score: number | null;
  }) => Promise<void> | void;
  onRemove?: () => Promise<void> | void;
}

export function AnimeCollectionModal({
  isOpen,
  onClose,
  anime,
  initialStatus,
  initialEpisodesWatched,
  initialScore,
  loading = false,
  onSave,
  onRemove,
}: AnimeCollectionModalProps) {
  useScrollLock(isOpen);
  const [selectedStatus, setSelectedStatus] = useState<TrackingStatus>(
    initialStatus ?? "watching",
  );
  const [episodesWatched, setEpisodesWatched] = useState<number>(
    initialEpisodesWatched ?? 0,
  );
  const [score, setScore] = useState<number | null>(initialScore ?? null);
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Sincroniza estados quando o modal abre ou props mudam
  useEffect(() => {
    if (isOpen) {
      setSelectedStatus(initialStatus ?? "watching");
      setEpisodesWatched(initialEpisodesWatched ?? 0);
      setScore(initialScore ?? null);
      setHoveredScore(null);
      setSaving(false);
      setRemoving(false);
    }
  }, [isOpen, initialStatus, initialEpisodesWatched, initialScore]);

  // Fechar com a tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalEpisodes = anime.episodesCount && anime.episodesCount > 0 ? anime.episodesCount : null;

  const handleSelectStatus = (statusKey: TrackingStatus) => {
    setSelectedStatus(statusKey);
    // Se marcar como concluído e souber o total, preenche episódios
    if (statusKey === "completed" && totalEpisodes && episodesWatched < totalEpisodes) {
      setEpisodesWatched(totalEpisodes);
    }
  };

  const handleDecreaseEpisodes = () => {
    setEpisodesWatched((prev) => Math.max(0, prev - 1));
  };

  const handleIncreaseEpisodes = () => {
    setEpisodesWatched((prev) => {
      if (totalEpisodes) {
        return Math.min(totalEpisodes, prev + 1);
      }
      return prev + 1;
    });
  };

  const handleSetAllEpisodes = () => {
    if (totalEpisodes) {
      setEpisodesWatched(totalEpisodes);
      if (selectedStatus === "watching" || selectedStatus === "planning") {
        setSelectedStatus("completed");
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        status: selectedStatus,
        episodesWatched,
        score,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    setRemoving(true);
    try {
      await onRemove();
      onClose();
    } finally {
      setRemoving(false);
    }
  };

  const currentDisplayScore = hoveredScore !== null ? hoveredScore : score;
  const progressPercent = totalEpisodes
    ? Math.min(100, Math.round((episodesWatched / totalEpisodes) * 100))
    : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="collection-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      {/* Backdrop click detector */}
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Content */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl sm:rounded-3xl border border-white/[0.09] bg-[#0c0a17] shadow-[0_25px_65px_rgba(0,0,0,0.9),0_0_40px_rgba(139,92,246,0.18)] max-h-[92vh] flex flex-col">
        {/* Glow de fundo no topo */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-72 rounded-full bg-violet-600/15 blur-3xl" />

        {/* Header do Anime */}
        <div className="relative border-b border-white/[0.07] p-4 sm:p-5 bg-gradient-to-b from-white/[0.04] to-transparent shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="absolute top-4 right-4 z-10 flex size-8 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
          >
            <X className="size-4" />
          </button>

          <div className="flex items-start gap-3.5 pr-8">
            {/* Pôster com proporção 3:4 */}
            <div className="relative aspect-[3/4] w-14 sm:w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#151224] shadow-md">
              {anime.cover ? (
                <img
                  src={anime.cover}
                  alt={anime.title || "Capa do anime"}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-zinc-600">
                  <Film className="size-5" />
                </div>
              )}
            </div>

            {/* Informações do Anime */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-400 uppercase tracking-wider">
                  <Bookmark className="size-3" />
                  Minha Coleção
                </span>
              </div>
              <h3
                id="collection-modal-title"
                className="font-display text-sm sm:text-base font-bold text-white leading-snug line-clamp-2"
                title={anime.title}
              >
                {anime.title || "Anime"}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                {anime.format && <span>{anime.format}</span>}
                {anime.year && (
                  <>
                    <span>•</span>
                    <span>{anime.year}</span>
                  </>
                )}
                {totalEpisodes ? (
                  <>
                    <span>•</span>
                    <span>{totalEpisodes} eps</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Corpo com scroll suave */}
        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto min-h-0">
          {/* 1. SELEÇÃO DE STATUS */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Status na Coleção
              </label>
              <span className="text-xs font-medium text-zinc-400">
                {TRACKING_STATUS_CONFIG[selectedStatus].label}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_TRACKING_STATUSES.map((statusKey) => {
                const config = TRACKING_STATUS_CONFIG[statusKey];
                const isSelected = selectedStatus === statusKey;
                return (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => handleSelectStatus(statusKey)}
                    className={`group relative flex items-center justify-between rounded-xl border p-2.5 sm:p-3 text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? `${config.activeBg} shadow-md ring-1 ${config.activeRing}`
                        : "border-white/[0.06] bg-white/[0.02] text-zinc-300 hover:border-white/15 hover:bg-white/[0.05] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`size-2.5 rounded-full shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-110 ${config.dotColor}`}
                      />
                      <span className="truncate">{config.label}</span>
                    </div>
                    {isSelected && (
                      <Check className="size-3.5 shrink-0 text-white ml-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. PROGRESSO DE EPISÓDIOS */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Episódios Assistidos
              </label>
              <span className="text-xs font-mono font-medium text-zinc-300">
                {episodesWatched} / {totalEpisodes ?? "?"} episódios
              </span>
            </div>

            {/* Barra de Progresso Visual */}
            {totalEpisodes && (
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.06] border border-white/[0.05]">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    selectedStatus === "completed"
                      ? "bg-gradient-to-r from-violet-500 to-purple-400"
                      : "bg-gradient-to-r from-violet-600 to-indigo-500"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}

            {/* Controles de Episódio */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleDecreaseEpisodes}
                disabled={episodesWatched <= 0}
                aria-label="Diminuir episódio"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/10 hover:border-white/20 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
              >
                <Minus className="size-4" />
              </button>

              <div className="relative flex-1">
                <input
                  type="number"
                  min={0}
                  max={totalEpisodes ?? 9999}
                  value={episodesWatched}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (isNaN(val)) {
                      setEpisodesWatched(0);
                    } else if (totalEpisodes) {
                      setEpisodesWatched(Math.max(0, Math.min(totalEpisodes, val)));
                    } else {
                      setEpisodesWatched(Math.max(0, val));
                    }
                  }}
                  className="w-full text-center font-mono text-base font-bold text-white bg-white/[0.03] border border-white/10 rounded-xl py-2 px-3 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>

              <button
                type="button"
                onClick={handleIncreaseEpisodes}
                disabled={Boolean(totalEpisodes && episodesWatched >= totalEpisodes)}
                aria-label="Aumentar episódio"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/10 hover:border-white/20 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
              >
                <Plus className="size-4" />
              </button>

              {totalEpisodes && (
                <button
                  type="button"
                  onClick={handleSetAllEpisodes}
                  aria-label="Marcar todos os episódios como assistidos"
                  className={`h-10 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    episodesWatched === totalEpisodes
                      ? "border-violet-500/60 bg-violet-500/20 text-violet-300"
                      : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white"
                  }`}
                >
                  Todos
                </button>
              )}
            </div>
          </div>

          {/* 3. AVALIAÇÃO PESSOAL (0 a 10 Estrelas) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Sua Avaliação
              </label>
              <div className="flex items-center gap-2">
                {currentDisplayScore !== null ? (
                  <span className="text-xs font-bold text-amber-300 font-mono">
                    {currentDisplayScore}/10{" "}
                    <span className="font-normal text-zinc-400 ml-1">
                      ({SCORE_LABELS[currentDisplayScore] || "Avaliado"})
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-zinc-500">Sem avaliação</span>
                )}
                {score !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setScore(null);
                      setHoveredScore(null);
                    }}
                    className="text-[11px] text-zinc-400 hover:text-rose-300 transition-colors cursor-pointer underline ml-1"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Estrelas de 1 a 10 */}
            <div
              className="flex items-center justify-between gap-1 p-2 rounded-xl bg-white/[0.02] border border-white/[0.06]"
              onMouseLeave={() => setHoveredScore(null)}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((starValue) => {
                const isActive =
                  currentDisplayScore !== null && starValue <= currentDisplayScore;

                return (
                  <button
                    key={starValue}
                    type="button"
                    onMouseEnter={() => setHoveredScore(starValue)}
                    onClick={() => setScore(starValue)}
                    aria-label={`Nota ${starValue} de 10`}
                    className="group relative flex flex-1 items-center justify-center py-1 sm:py-1.5 focus:outline-none transition-transform active:scale-90 cursor-pointer"
                  >
                    <Star
                      className={`size-4 sm:size-5 transition-all duration-150 ${
                        isActive
                          ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)] scale-110"
                          : "text-zinc-600 group-hover:text-amber-300/80 group-hover:scale-105"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="border-t border-white/[0.07] p-3.5 sm:p-4 bg-gradient-to-t from-white/[0.02] to-transparent shrink-0 flex items-center justify-between gap-2">
          {initialStatus !== null && onRemove ? (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing || saving || loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-rose-300/80 hover:text-rose-200 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              {removing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              <span className="hidden min-[380px]:inline">Remover da Coleção</span>
              <span className="min-[380px]:hidden">Remover</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || removing || loading}
              className="px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || removing || loading}
              className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 active:scale-95 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.35)] transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin text-white" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar Alterações</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
