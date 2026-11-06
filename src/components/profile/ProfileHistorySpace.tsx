import { Link } from "@tanstack/react-router";
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Film,
  Play,
} from "lucide-react";
import type { WatchedEpisodeItem } from "@/types/profile-tracking";

interface ProfileHistorySpaceProps {
  items: WatchedEpisodeItem[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  loading?: boolean;
}

export function ProfileHistorySpace({
  items,
  total,
  page,
  totalPages,
  onPageChange,
  loading = false,
}: ProfileHistorySpaceProps) {
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";

    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção de Histórico */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Clock className="size-5 text-violet-400" />
            <span>Histórico de Episódios Assistidos</span>
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-zinc-400">
            Registro cronológico das suas reproduções e episódios concluídos.
          </p>
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-zinc-300 tabular-nums">
          {total} {total === 1 ? "episódio" : "episódios"}
        </span>
      </div>

      {/* Conteúdo: Skeleton, Vazio ou Lista em Timeline */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className="h-20 animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 sm:p-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 shadow-inner">
            <Clock className="size-7" />
          </div>

          <h3 className="mt-4 font-display text-base sm:text-lg font-bold text-white">
            Nenhum episódio no histórico ainda
          </h3>

          <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Ao assistir seus animes favoritos pelo player do Hikari ou marcar episódios como assistidos, eles aparecerão aqui automaticamente.
          </p>

          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all hover:bg-violet-500 active:scale-95"
          >
            <Play className="size-4 fill-white" />
            <span>Começar a Assistir</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((entry) => {
            const epNum = entry.episodeNumber;

            return (
              <article
                key={`${entry.animeId}-${entry.episodeId}-${entry.watchedAt}`}
                className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c0b14]/90 p-3 sm:p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-200 hover:border-violet-500/35 hover:bg-[#12101e]"
              >
                {/* Lado Esquerdo: Capa do Anime + Título e Episódio */}
                <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
                  <div className="relative size-14 sm:size-16 shrink-0 overflow-hidden rounded-xl bg-[#161424]">
                    {entry.animeCover ? (
                      <img
                        src={entry.animeCover}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-zinc-600">
                        <Film className="size-6" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/anime/$id"
                        params={{ id: entry.animeId }}
                        className="truncate font-semibold text-sm sm:text-base text-zinc-100 transition-colors hover:text-violet-300"
                        title={entry.animeTitle}
                      >
                        {entry.animeTitle}
                      </Link>

                      <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/20 px-2 py-0.5 text-[11px] font-bold text-violet-300 ring-1 ring-violet-500/30">
                        Episódio {entry.episodeNumber}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3 text-zinc-500" />
                        <span>{formatDate(entry.watchedAt)}</span>
                      </span>

                      <span className="text-zinc-600">•</span>

                      {entry.origin === "playback" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400/90 font-medium">
                          <CheckCircle className="size-3" />
                          <span>Player Oficial</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                          <span>Marcado manualmente</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ação: Botão Assistir Novamente */}
                <Link
                  to="/watch/$id/$ep"
                  params={{
                    id: entry.animeId,
                    ep: `ep-${epNum}`,
                  }}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-200 transition-all group-hover:border-violet-500/40 group-hover:bg-violet-600 group-hover:text-white"
                >
                  <Play className="size-3.5 fill-current" />
                  <span className="hidden sm:inline">Assistir</span>
                </Link>
              </article>
            );
          })}

          {/* Paginação do Histórico */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
              <span className="text-xs text-zinc-400">
                Página <strong className="text-white">{page}</strong> de{" "}
                <strong className="text-white">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-all hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft className="size-4" />
                  <span>Anterior</span>
                </button>

                <button
                  type="button"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-all hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span>Próxima</span>
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
