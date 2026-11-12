import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  Bookmark,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Clock,
  Film,
  Heart,
  ListPlus,
  Play,
  Star,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserActivityItem } from "@/lib/profile.functions";
import type {
  TrackingStatus,
  WatchedEpisodeItem,
} from "@/types/profile-tracking";

interface ProfileHistorySpaceProps {
  items: (UserActivityItem | WatchedEpisodeItem)[];
  total: number;
  page?: number;
  totalPages?: number;
  onPageChange?: (newPage: number) => void;
  loading?: boolean;
  isOwner?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

/**
 * Identifica o status real de acompanhamento a partir do metadata ou da descrição registrada.
 */
function resolveTrackingStatus(entry: UserActivityItem): TrackingStatus {
  const rawStatus = (entry.metadata?.status as string | undefined)?.toLowerCase().trim();
  if (
    rawStatus === "watching" ||
    rawStatus === "completed" ||
    rawStatus === "on_hold" ||
    rawStatus === "dropped" ||
    rawStatus === "planning"
  ) {
    return rawStatus;
  }
  if (rawStatus === "onhold" || rawStatus === "hold") return "on_hold";
  if (rawStatus === "drop") return "dropped";
  if (rawStatus === "plan") return "planning";
  if (rawStatus === "watch") return "watching";
  if (rawStatus === "complete") return "completed";

  const desc = (entry.description || "").toLowerCase();
  if (desc.includes("começou a assistir") || desc.includes("assistindo")) return "watching";
  if (desc.includes("concluído") || desc.includes("assistido")) return "completed";
  if (desc.includes("em espera")) return "on_hold";
  if (desc.includes("abandonado") || desc.includes("abandonou")) return "dropped";
  if (desc.includes("interesse") || desc.includes("planejado") || desc.includes("planeja")) return "planning";

  return "watching";
}

/**
 * Mapeamento visual canônico para etiquetas de status:
 * - Watching → Assistindo (Emerald)
 * - Completed → Assistido (Violet)
 * - On Hold → Em espera (Amber)
 * - Dropped → Abandonado (Rose)
 * - Planning → Planejado (Sky)
 */
const TRACKING_STATUS_CONFIG: Record<
  TrackingStatus,
  {
    label: string;
    icon: typeof Play;
    className: string;
    iconClassName?: string;
  }
> = {
  watching: {
    label: "Assistindo",
    icon: Play,
    className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25",
    iconClassName: "size-2.5 fill-current",
  },
  completed: {
    label: "Completo",
    icon: CheckCircle2,
    className: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/25",
    iconClassName: "size-3",
  },
  on_hold: {
    label: "Em espera",
    icon: Clock,
    className: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25",
    iconClassName: "size-3",
  },
  dropped: {
    label: "Abandonado",
    icon: XCircle,
    className: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25",
    iconClassName: "size-3",
  },
  planning: {
    label: "Planejado",
    icon: Bookmark,
    className: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/25",
    iconClassName: "size-3 fill-current",
  },
};

/**
 * Remove textos redundantes que apenas repetem o que já está expresso na etiqueta do item.
 */
function getMeaningfulDescription(
  entry: UserActivityItem,
  _isEpisode: boolean,
  isFavorite: boolean,
  _isTracking: boolean,
): string | null {
  if (isFavorite) {
    return null;
  }

  if (entry.description) {
    const raw = entry.description.trim().toLowerCase();
    if (
      raw === "adicionou aos favoritos" ||
      raw === "adicionou anime aos favoritos" ||
      raw === "adicionou personagem aos favoritos" ||
      raw === "adicionou estúdio aos favoritos" ||
      raw === "adicionou produtora aos favoritos" ||
      raw === "adicionou pessoa aos favoritos"
    ) {
      return null;
    }
    return entry.description;
  }

  return null;
}

export function ProfileHistorySpace({
  items,
  total,
  page,
  totalPages,
  onPageChange,
  loading = false,
  isOwner = true,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: ProfileHistorySpaceProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onLoadMore || !hasMore || loadingMore || loading) return;

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "350px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, loadingMore, loading]);
  const formatRelativeDate = (isoString: string): string => {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "Agora mesmo";
    if (diffMin < 60) return `Há ${diffMin} ${diffMin === 1 ? "minuto" : "minutos"}`;
    if (diffHour < 24) return `Há ${diffHour} ${diffHour === 1 ? "hora" : "horas"}`;
    if (diffDay === 1) {
      const timeStr = d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `Ontem às ${timeStr}`;
    }
    if (diffDay < 30) return `Há ${diffDay} ${diffDay === 1 ? "dia" : "dias"}`;

    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatFullDate = (isoString: string): string => {
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

  // Normaliza itens que podem ser UserActivityItem ou WatchedEpisodeItem antigo
  const normalizedItems: UserActivityItem[] = items.map((raw) => {
    if ("type" in raw) {
      return raw as UserActivityItem;
    }
    const ep = raw as WatchedEpisodeItem;
    return {
      id: `watched:${ep.animeId}:${ep.episodeId}:${ep.watchedAt}`,
      type: "watched_episode",
      createdAt: ep.watchedAt,
      description: `Assistiu ao episódio ${ep.episodeNumber}`,
      resourceId: ep.animeId,
      resourceTitle: ep.animeTitle || "Anime",
      resourceCover: ep.animeCover,
      resourceType: "anime",
      metadata: {
        episodeId: ep.episodeId,
        episodeNumber: ep.episodeNumber,
        origin: ep.origin,
      },
    };
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção de Atividades */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Activity className="size-5 text-violet-400" />
            <span>Feed de Atividades</span>
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-zinc-400">
            {isOwner
              ? "Registro cronológico das suas interações, episódios assistidos e atualizações no Hikari."
              : "Registro cronológico das atividades recentes deste usuário no Hikari."}
          </p>
        </div>

        {total > 0 && (
          <span className="self-start sm:self-auto rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-zinc-300 tabular-nums">
            {total} {total === 1 ? "atividade" : "atividades"}
          </span>
        )}
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
      ) : normalizedItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-8 text-center">
          <Activity className="mx-auto size-8 text-zinc-600 mb-2" />
          <p className="text-sm font-medium text-zinc-300">
            Nenhuma atividade registrada ainda
          </p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            {isOwner
              ? "Ao interagir com animes, assistir a episódios ou salvar favoritos, seu histórico aparecerá aqui."
              : "Este usuário ainda não possui atividades públicas registradas."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {normalizedItems.map((entry) => {
            const isEpisode = entry.type === "watched_episode";
            const isFavorite = entry.type === "favorite_added";
            const isTracking =
              entry.type === "tracking_added" ||
              entry.type === "tracking_updated";
            const isList =
              entry.type === "list_created" ||
              entry.type === "list_item_added";

            const rawEpNum =
              typeof entry.metadata?.episodeNumber === "number"
                ? entry.metadata.episodeNumber
                : typeof entry.metadata?.episodesWatched === "number"
                  ? entry.metadata.episodesWatched
                  : null;
            const epNum = rawEpNum !== null && rawEpNum > 0 ? rawEpNum : 0;

            const rawScore = entry.metadata?.score;
            const scoreNum =
              typeof rawScore === "number"
                ? rawScore
                : typeof rawScore === "string"
                  ? parseFloat(rawScore)
                  : null;

            const trackingStatus = isTracking || entry.metadata?.status ? resolveTrackingStatus(entry) : null;
            const meaningfulDescription = getMeaningfulDescription(
              entry,
              isEpisode,
              isFavorite,
              isTracking,
            );

            return (
              <article
                key={entry.id}
                className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c0b14]/90 p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-colors duration-200 [@media(hover:hover)_and_(pointer:fine)]:hover:border-violet-500/35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#12101e]"
              >
                {/* Lado Esquerdo: Ícone/Capa + Descrição e Tempo Relativo */}
                <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
                  {/* Thumbnail / Ícone */}
                  <div className="relative size-14 sm:size-16 shrink-0 overflow-hidden rounded-xl bg-[#161424]">
                    {entry.resourceCover ? (
                      <img
                        src={entry.resourceCover}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover transition-transform duration-300 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 motion-reduce:transform-none"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-zinc-500 bg-white/[0.03]">
                        {isFavorite ? (
                          <Heart className="size-6 text-rose-400" />
                        ) : isList ? (
                          <ListPlus className="size-6 text-amber-400" />
                        ) : isTracking ? (
                          trackingStatus === "watching" ? (
                            <Play className="size-6 text-emerald-400" />
                          ) : trackingStatus === "completed" ? (
                            <CheckCircle2 className="size-6 text-violet-400" />
                          ) : trackingStatus === "on_hold" ? (
                            <Clock className="size-6 text-amber-400" />
                          ) : trackingStatus === "dropped" ? (
                            <XCircle className="size-6 text-rose-400" />
                          ) : (
                            <Bookmark className="size-6 text-sky-400" />
                          )
                        ) : (
                          <Film className="size-6" />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {entry.resourceType === "anime" ? (
                        <Link
                          to="/anime/$id"
                          params={{ id: entry.resourceId }}
                          className="truncate font-semibold text-sm sm:text-base text-zinc-100 transition-colors duration-150 [@media(hover:hover)_and_(pointer:fine)]:hover:text-violet-300"
                          title={entry.resourceTitle}
                        >
                          {entry.resourceTitle}
                        </Link>
                      ) : (
                        <span
                          className="truncate font-semibold text-sm sm:text-base text-zinc-100"
                          title={entry.resourceTitle}
                        >
                          {entry.resourceTitle}
                        </span>
                      )}

                      {/* Badges de Categoria: Status Real com Cores Canônicas Preservadas */}
                      {trackingStatus && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                            TRACKING_STATUS_CONFIG[trackingStatus].className,
                          )}
                        >
                          {(() => {
                            const StatusIcon = TRACKING_STATUS_CONFIG[trackingStatus].icon;
                            return (
                              <StatusIcon
                                className={TRACKING_STATUS_CONFIG[trackingStatus].iconClassName}
                              />
                            );
                          })()}
                          <span>{TRACKING_STATUS_CONFIG[trackingStatus].label}</span>
                        </span>
                      )}

                      {epNum > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/20 px-2 py-0.5 text-[11px] font-bold text-violet-300 ring-1 ring-violet-500/30">
                          Episódio {epNum}
                        </span>
                      )}

                      {typeof scoreNum === "number" && scoreNum > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/25">
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                          <span>Nota {Number(scoreNum).toFixed(scoreNum % 1 === 0 ? 0 : 1)}/10</span>
                        </span>
                      )}

                      {isFavorite && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-500/25">
                          <Heart className="size-3 fill-rose-500/80" />
                          <span>Favorito</span>
                        </span>
                      )}

                      {isList && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/25">
                          <ListPlus className="size-3" />
                          <span>Lista</span>
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      {meaningfulDescription && (
                        <>
                          <span className="font-medium text-zinc-300">
                            {meaningfulDescription}
                          </span>
                          <span className="text-zinc-600">•</span>
                        </>
                      )}

                      <span
                        className="flex items-center gap-1 text-zinc-400 hover:text-zinc-300 cursor-default"
                        title={formatFullDate(entry.createdAt)}
                      >
                        <Calendar className="size-3 text-zinc-500" />
                        <span>{formatRelativeDate(entry.createdAt)}</span>
                      </span>

                      {isEpisode && entry.metadata?.origin === "playback" && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <CheckCircle className="size-3" />
                            <span>Player Oficial</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ação contextual funcional — sem ícone decorativo Sparkles */}
                {epNum > 0 && (
                  <Link
                    to="/watch/$id/$ep"
                    params={{
                      id: entry.resourceId,
                      ep: `ep-${epNum}`,
                    }}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-200 transition-all group-hover:border-violet-500/40 group-hover:bg-violet-600 group-hover:text-white"
                  >
                    <Play className="size-3.5 fill-current" />
                    <span className="hidden sm:inline">Assistir</span>
                  </Link>
                )}
              </article>
            );
          })}

          {/* Paginação Infinita via IntersectionObserver */}
          {loadingMore && (
            <div className="flex items-center justify-center py-4 text-zinc-400 text-xs gap-2">
              <div className="size-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
              <span>Carregando mais atividades...</span>
            </div>
          )}

          {hasMore && !loading && (
            <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />
          )}

          {!hasMore && !loading && normalizedItems.length > 0 && (
            <p className="text-center py-4 text-xs text-zinc-500">
              Você chegou ao fim das atividades
            </p>
          )}

          {/* Fallback de Paginação caso onLoadMore não seja provido */}
          {!onLoadMore && totalPages && totalPages > 1 && onPageChange && page && (
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
                  <span>Anterior</span>
                </button>

                <button
                  type="button"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-all hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span>Próxima</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
