import {
  Check,
  Film,
  Minus,
  Plus,
  Star,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  TrackingStatus,
  UserAnimeTrackingItem,
} from "@/types/profile-tracking";

interface ProfileAnimeEditModalProps {
  isOpen: boolean;
  item: UserAnimeTrackingItem | null;
  onClose: () => void;
  onSave: (data: {
    animeId: string;
    status: TrackingStatus;
    score: number | null;
    episodesWatched: number;
  }) => Promise<void>;
}

const STATUS_OPTIONS: {
  value: TrackingStatus;
  label: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  activeRing: string;
}[] = [
  {
    value: "watching",
    label: "Assistindo",
    badgeBg: "bg-emerald-500/15",
    badgeBorder: "border-emerald-500/30",
    badgeText: "text-emerald-300",
    activeRing: "ring-emerald-500/60 bg-emerald-500/20 text-emerald-200 border-emerald-500/50",
  },
  {
    value: "completed",
    label: "Concluído",
    badgeBg: "bg-violet-500/15",
    badgeBorder: "border-violet-500/30",
    badgeText: "text-violet-300",
    activeRing: "ring-violet-500/60 bg-violet-500/20 text-violet-200 border-violet-500/50",
  },
  {
    value: "on_hold",
    label: "Em espera",
    badgeBg: "bg-amber-500/15",
    badgeBorder: "border-amber-500/30",
    badgeText: "text-amber-300",
    activeRing: "ring-amber-500/60 bg-amber-500/20 text-amber-200 border-amber-500/50",
  },
  {
    value: "dropped",
    label: "Abandonado",
    badgeBg: "bg-rose-500/15",
    badgeBorder: "border-rose-500/30",
    badgeText: "text-rose-300",
    activeRing: "ring-rose-500/60 bg-rose-500/20 text-rose-200 border-rose-500/50",
  },
  {
    value: "planning",
    label: "Planejado",
    badgeBg: "bg-sky-500/15",
    badgeBorder: "border-sky-500/30",
    badgeText: "text-sky-300",
    activeRing: "ring-sky-500/60 bg-sky-500/20 text-sky-200 border-sky-500/50",
  },
];

const SCORE_LABELS: Record<number, string> = {
  10: "10 — Obra-prima",
  9: "9 — Excelente",
  8: "8 — Muito bom",
  7: "7 — Bom",
  6: "6 — Razoável",
  5: "5 — Médio",
  4: "4 — Ruim",
  3: "3 — Muito ruim",
  2: "2 — Péssimo",
  1: "1 — Horrível",
};

export function ProfileAnimeEditModal({
  isOpen,
  item,
  onClose,
  onSave,
}: ProfileAnimeEditModalProps) {
  const [prevAnimeId, setPrevAnimeId] = useState(item?.animeId);
  const [status, setStatus] = useState<TrackingStatus>(item?.status || "watching");
  const [score, setScore] = useState<number | null>(item?.score ?? null);
  const [episodesWatched, setEpisodesWatched] = useState<number>(item?.episodesWatched ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincroniza durante a renderização se o animeId mudar (evita render intermediário com valor incorreto)
  if (item && item.animeId !== prevAnimeId) {
    setPrevAnimeId(item.animeId);
    setStatus(item.status);
    setScore(item.score ?? null);
    setEpisodesWatched(item.episodesWatched ?? 0);
    setError(null);
  }

  // Sincroniza estado quando o anime selecionado mudar ou sofrer atualização externa
  useEffect(() => {
    if (item) {
      setStatus(item.status);
      setScore(item.score ?? null);
      setEpisodesWatched(item.episodesWatched ?? 0);
      setError(null);
    }
  }, [item]);

  // Bloqueio de rolagem do fundo (background scroll lock)
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isOpen]);

  // Fechar no Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, saving, onClose]);

  if (!isOpen || !item) return null;

  const maxEps = item.episodesCount ?? item.animeSnapshot?.episodesCount ?? null;

  const handleStatusChange = (newStatus: TrackingStatus) => {
    setStatus(newStatus);
    // Ao alterar para Concluído, preenche automaticamente os episódios assistidos com o total real
    if (newStatus === "completed" && maxEps !== null && maxEps > 0) {
      setEpisodesWatched(maxEps);
    }
  };

  const handleEpisodesChange = (val: number) => {
    if (Number.isNaN(val)) return;
    let clamped = Math.max(0, val);
    if (maxEps !== null && maxEps > 0) {
      clamped = Math.min(clamped, maxEps);
    }
    setEpisodesWatched(clamped);
  };

  const handleIncrement = () => {
    if (maxEps !== null && maxEps > 0 && episodesWatched >= maxEps) return;
    setEpisodesWatched((prev) => prev + 1);
  };

  const handleDecrement = () => {
    if (episodesWatched <= 0) return;
    setEpisodesWatched((prev) => Math.max(0, prev - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Se marcou como Concluído e há total real conhecido, garante o total de episódios
    const resolvedEpisodes =
      status === "completed" && maxEps !== null && maxEps > 0
        ? maxEps
        : episodesWatched;

    // Validações
    if (resolvedEpisodes < 0) {
      setError("O número de episódios assistidos não pode ser negativo.");
      return;
    }

    if (maxEps !== null && maxEps > 0 && resolvedEpisodes > maxEps) {
      setError(`O número de episódios não pode ultrapassar o total conhecido (${maxEps}).`);
      return;
    }

    if (score !== null && (score < 0 || score > 10)) {
      setError("A avaliação deve ser entre 0 e 10.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        animeId: item.animeId,
        status,
        score,
        episodesWatched: resolvedEpisodes,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar acompanhamento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overscroll-contain animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-anime-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0d0918] shadow-[0_25px_70px_rgba(0,0,0,0.85)]">
        {/* Cabeçalho com dados resumidos do anime */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#140e24]/70 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative size-12 sm:size-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#161226]">
              {item.cover ? (
                <img
                  src={item.cover}
                  alt={item.title}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-zinc-600">
                  <Film className="size-5" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-violet-400">
                Gerenciar Coleção
              </span>
              <h2
                id="edit-anime-title"
                className="font-display text-sm sm:text-base font-bold text-white truncate leading-snug"
                title={item.title}
              >
                {item.title}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span>{item.format || "Anime"}</span>
                {item.year && <span>• {item.year}</span>}
                {maxEps ? <span>• {maxEps} eps totais</span> : null}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg sm:rounded-xl border border-white/10 p-1.5 text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white shrink-0 ml-2"
            title="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Mensagem de Erro se houver */}
        {error && (
          <div className="mx-4 mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {/* Formulário de Edição */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5">
          {/* 1. Status de Acompanhamento */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Status na Coleção
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleStatusChange(opt.value)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                      isSelected
                        ? opt.activeRing
                        : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    {isSelected && <Check className="size-3 shrink-0" />}
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Episódios Assistidos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="episodesWatchedInput" className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Episódios Assistidos
              </label>
              {maxEps !== null && maxEps > 0 && (
                <span className="text-xs text-zinc-400">
                  Total conhecido: <strong className="text-zinc-200">{maxEps} eps</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDecrement}
                disabled={episodesWatched <= 0}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:border-violet-500/40 hover:bg-violet-600/20 hover:text-white disabled:opacity-40 disabled:pointer-events-none"
                title="Diminuir 1 episódio"
              >
                <Minus className="size-4" />
              </button>

              <div className="relative flex-1">
                <input
                  id="episodesWatchedInput"
                  type="number"
                  min={0}
                  max={maxEps !== null && maxEps > 0 ? maxEps : undefined}
                  value={episodesWatched}
                  onChange={(e) => handleEpisodesChange(parseInt(e.target.value, 10))}
                  className="w-full rounded-xl border border-white/10 bg-[#161226] px-3 py-2 text-center text-sm font-semibold text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <button
                type="button"
                onClick={handleIncrement}
                disabled={maxEps !== null && maxEps > 0 && episodesWatched >= maxEps}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:border-violet-500/40 hover:bg-violet-600/20 hover:text-white disabled:opacity-40 disabled:pointer-events-none"
                title="Aumentar 1 episódio"
              >
                <Plus className="size-4" />
              </button>

              {maxEps !== null && maxEps > 0 && episodesWatched < maxEps && (
                <button
                  type="button"
                  onClick={() => setEpisodesWatched(maxEps)}
                  className="rounded-xl border border-violet-500/30 bg-violet-600/15 px-2.5 py-2 text-xs font-semibold text-violet-300 transition-colors hover:bg-violet-600/25"
                  title={`Definir como ${maxEps} episódios`}
                >
                  Todos
                </button>
              )}
            </div>
          </div>

          {/* 3. Avaliação / Nota Pessoal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="scoreSelect" className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                <span>Avaliação Pessoal</span>
              </label>

              {score !== null && (
                <button
                  type="button"
                  onClick={() => setScore(null)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors"
                >
                  <Trash2 className="size-3" />
                  <span>Remover nota</span>
                </button>
              )}
            </div>

            <div className="relative">
              <select
                id="scoreSelect"
                value={score !== null ? String(score) : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setScore(val === "" ? null : Number(val));
                }}
                className="w-full rounded-xl border border-white/10 bg-[#161226] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="">Sem avaliação (Não avaliado)</option>
                {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((s) => (
                  <option key={s} value={String(s)}>
                    {SCORE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Star Rating preview */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((starNum) => {
                  const isFilled = score !== null && score >= starNum;
                  return (
                    <button
                      key={starNum}
                      type="button"
                      onClick={() => setScore(starNum)}
                      className="p-0.5 text-zinc-600 hover:text-amber-400 transition-colors"
                      title={SCORE_LABELS[starNum]}
                    >
                      <Star
                        className={`size-3.5 sm:size-4 transition-transform hover:scale-125 ${
                          isFilled
                            ? "fill-amber-400 text-amber-400"
                            : "text-zinc-600"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {score !== null && (
                <span className="text-xs font-bold text-amber-300 tabular-nums">
                  ★ {score.toFixed(1)} / 10
                </span>
              )}
            </div>
          </div>

          {/* Rodapé de Ações */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all hover:bg-violet-500 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
