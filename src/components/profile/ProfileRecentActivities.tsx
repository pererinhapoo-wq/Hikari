import { Link } from "@tanstack/react-router";
import {
  Activity,
  Bookmark,
  Calendar,
  CheckCircle2,
  Clock,
  Film,
  Heart,
  MessageSquare,
  Play,
  XCircle,
} from "lucide-react";
import type { MyProfileComment, UserActivityItem } from "@/lib/profile.functions";
import { cn } from "@/lib/utils";
import type { TrackingStatus } from "@/types/profile-tracking";

interface ProfileRecentActivitiesProps {
  activityItems?: UserActivityItem[];
  comments?: MyProfileComment[];
  loading?: boolean;
}

/**
 * Mapeamento visual canônico para etiquetas de status de animes (cores correspondentes):
 * - watching: Assistindo (Emerald)
 * - completed: Assistido (Violet)
 * - on_hold: Em espera (Amber)
 * - dropped: Abandonado (Rose)
 * - planning: Planejado (Sky)
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
    label: "Assistido",
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

function formatRelativeDate(isoString: string): string {
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
}

function formatFullDate(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type UnifiedActivityItem =
  | {
      kind: "anime_activity";
      id: string;
      date: string;
      activity: UserActivityItem;
    }
  | {
      kind: "comment";
      id: string;
      date: string;
      comment: MyProfileComment;
    };

export function ProfileRecentActivities({
  activityItems = [],
  comments = [],
  loading = false,
}: ProfileRecentActivitiesProps) {
  // 1. Atividades de Animes: até 5 registros mais recentes relacionados a animes
  const recentAnimeActivities = activityItems
    .filter(
      (item) =>
        item.resourceType === "anime" ||
        item.type === "watched_episode" ||
        item.type === "tracking_added" ||
        item.type === "tracking_updated" ||
        (item.type === "favorite_added" && item.resourceType === "anime"),
    )
    .slice(0, 5);

  // 2. Comentários: até 3 comentários mais recentes
  const recentComments = comments.slice(0, 3);

  // 3. Ordenação Conjunta: unir ambas as categorias e ordenar por data decrescente
  const unifiedItems: UnifiedActivityItem[] = [
    ...recentAnimeActivities.map((act) => ({
      kind: "anime_activity" as const,
      id: `act-${act.id}`,
      date: act.createdAt,
      activity: act,
    })),
    ...recentComments.map((comm) => ({
      kind: "comment" as const,
      id: `comm-${comm.id}`,
      date: comm.createdAt,
      comment: comm,
    })),
  ];

  unifiedItems.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <section
      aria-label="Atividades recentes"
      className="space-y-4 pt-2 sm:pt-4 border-t border-white/[0.06]"
    >
      {/* Cabeçalho da Seção Independente */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <span className="h-5 w-1 rounded-full bg-violet-500" />
          <Activity className="size-4 text-violet-400" />
          <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
            Atividades recentes
          </h3>
        </div>

        {unifiedItems.length > 0 && (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs font-semibold text-zinc-300 tabular-nums">
            {unifiedItems.length} {unifiedItems.length === 1 ? "registro" : "registros"}
          </span>
        )}
      </div>

      {/* Conteúdo: Skeleton de carregamento, estado vazio ou lista ordenada */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-20 animate-pulse rounded-2xl bg-white/[0.04] border border-white/[0.04]"
            />
          ))}
        </div>
      ) : unifiedItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-6 text-center">
          <Activity className="mx-auto size-7 text-zinc-600 mb-2" />
          <p className="text-xs sm:text-sm font-medium text-zinc-300">
            Nenhuma atividade recente registrada ainda
          </p>
          <p className="text-[11px] sm:text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Ao acompanhar animes, assistir a episódios ou publicar comentários na comunidade, suas atividades aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {unifiedItems.map((item) => {
            if (item.kind === "comment") {
              const comm = item.comment;
              const epNum =
                comm.episodeId.match(/ep-(?:\d+-)?(\d+)$/i)?.[1] ||
                comm.episodeId.match(/(\d+)$/)?.[1] ||
                "1";
              const hasAnimeInfo = Boolean(
                comm.animeTitle && comm.animeTitle !== "Anime indisponível",
              );
              const animeTitle = comm.animeTitle || "Anime";

              return (
                <article
                  key={item.id}
                  className="group relative flex items-center justify-between gap-3.5 sm:gap-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c0b14]/90 p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-200 hover:border-violet-500/35 hover:bg-[#12101e]"
                >
                  <div className="flex items-start gap-3.5 sm:gap-4 min-w-0 flex-1">
                    {/* Capa / Ícone */}
                    <div className="relative size-12 sm:size-14 shrink-0 overflow-hidden rounded-xl bg-[#161424] mt-0.5">
                      {comm.animeCover ? (
                        <img
                          src={comm.animeCover}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-zinc-500 bg-white/[0.03]">
                          <MessageSquare className="size-5 text-purple-400" />
                        </div>
                      )}
                    </div>

                    {/* Informações: Anime, Episódio, Trecho do Comentário e Data */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {hasAnimeInfo ? (
                          <Link
                            to="/anime/$id"
                            params={{ id: comm.animeId }}
                            className="truncate font-semibold text-sm sm:text-base text-zinc-100 transition-colors hover:text-violet-300"
                            title={animeTitle}
                          >
                            {animeTitle}
                          </Link>
                        ) : (
                          <span
                            className="truncate font-semibold text-sm sm:text-base text-zinc-100"
                            title={animeTitle}
                          >
                            {animeTitle}
                          </span>
                        )}

                        {/* Badge de Episódio */}
                        <Link
                          to="/watch/$id/$ep"
                          params={{
                            id: comm.animeId,
                            ep: `ep-${epNum}`,
                          }}
                          search={{
                            comment: comm.id,
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-violet-500/20 px-2 py-0.5 text-[11px] font-bold text-violet-300 ring-1 ring-violet-500/30 hover:bg-violet-500/30 transition-colors"
                        >
                          Episódio {epNum}
                        </Link>

                        {/* Badge de Categoria: Comentário */}
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/15 px-2 py-0.5 text-[11px] font-semibold text-purple-300 ring-1 ring-purple-500/25">
                          <MessageSquare className="size-3" />
                          <span>Comentário</span>
                        </span>

                        {comm.isSpoiler && (
                          <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/25">
                            Spoiler
                          </span>
                        )}
                      </div>

                      {/* Trecho do comentário */}
                      <p className="mt-1 text-xs text-zinc-300/90 line-clamp-2 italic leading-relaxed text-wrap break-words">
                        &ldquo;{comm.content}&rdquo;
                      </p>

                      {/* Data relativa */}
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-zinc-400">
                        <span
                          className="flex items-center gap-1 text-zinc-400 cursor-default"
                          title={formatFullDate(comm.createdAt)}
                        >
                          <Calendar className="size-3 text-zinc-500" />
                          <span>{formatRelativeDate(comm.createdAt)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ação: Link para o episódio com foco no comentário (sem botão Ver Detalhes) */}
                  <Link
                    to="/watch/$id/$ep"
                    params={{
                      id: comm.animeId,
                      ep: `ep-${epNum}`,
                    }}
                    search={{
                      comment: comm.id,
                    }}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-zinc-200 transition-all hover:border-violet-500/40 hover:bg-violet-600 hover:text-white"
                    title="Ver comentário no player do episódio"
                  >
                    <MessageSquare className="size-3.5" />
                    <span className="hidden sm:inline">No episódio</span>
                  </Link>
                </article>
              );
            }

            // Atividade de Anime (Acompanhamento, Episódio assistido ou Favorito de anime)
            const act = item.activity;
            const isEpisode = act.type === "watched_episode";
            const isFavorite = act.type === "favorite_added";
            const isTracking =
              act.type === "tracking_added" || act.type === "tracking_updated";

            const epNum =
              act.metadata?.episodeNumber !== undefined
                ? act.metadata.episodeNumber
                : isEpisode
                  ? 1
                  : null;

            const trackingStatus = isTracking ? resolveTrackingStatus(act) : null;

            return (
              <article
                key={item.id}
                className="group relative flex items-center justify-between gap-3.5 sm:gap-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c0b14]/90 p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-200 hover:border-violet-500/35 hover:bg-[#12101e]"
              >
                <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
                  {/* Capa / Ícone */}
                  <div className="relative size-12 sm:size-14 shrink-0 overflow-hidden rounded-xl bg-[#161424]">
                    {act.resourceCover ? (
                      <img
                        src={act.resourceCover}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-zinc-500 bg-white/[0.03]">
                        {isFavorite ? (
                          <Heart className="size-5 text-rose-400" />
                        ) : isTracking && trackingStatus ? (
                          trackingStatus === "watching" ? (
                            <Play className="size-5 text-emerald-400" />
                          ) : trackingStatus === "completed" ? (
                            <CheckCircle2 className="size-5 text-violet-400" />
                          ) : trackingStatus === "on_hold" ? (
                            <Clock className="size-5 text-amber-400" />
                          ) : trackingStatus === "dropped" ? (
                            <XCircle className="size-5 text-rose-400" />
                          ) : (
                            <Bookmark className="size-5 text-sky-400" />
                          )
                        ) : (
                          <Film className="size-5" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Informações: Anime, Status Canônico, Episódio e Data */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <Link
                        to="/anime/$id"
                        params={{ id: act.resourceId }}
                        className="truncate font-semibold text-sm sm:text-base text-zinc-100 transition-colors hover:text-violet-300"
                        title={act.resourceTitle}
                      >
                        {act.resourceTitle}
                      </Link>

                      {/* Status Canônico com Cores Preservadas */}
                      {isTracking && trackingStatus && (
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

                      {isEpisode && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-300 ring-1 ring-violet-500/25">
                          <CheckCircle2 className="size-3" />
                          <span>Assistido</span>
                        </span>
                      )}

                      {isFavorite && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-500/25">
                          <Heart className="size-3 fill-rose-500/80" />
                          <span>Favorito</span>
                        </span>
                      )}

                      {/* Episódio quando disponível no registro real */}
                      {typeof epNum === "number" && epNum > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/20 px-2 py-0.5 text-[11px] font-bold text-violet-300 ring-1 ring-violet-500/30">
                          Episódio {epNum}
                        </span>
                      )}
                    </div>

                    {/* Metadados: Data (sem textos duplicados de descrição) */}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      {typeof act.metadata?.score === "number" && act.metadata.score > 0 && (
                        <>
                          <span className="font-semibold text-amber-300 text-[11px]">
                            ★ {act.metadata.score}/10
                          </span>
                          <span className="text-zinc-600">•</span>
                        </>
                      )}

                      <span
                        className="flex items-center gap-1 text-zinc-400 text-[11px] cursor-default"
                        title={formatFullDate(act.createdAt)}
                      >
                        <Calendar className="size-3 text-zinc-500" />
                        <span>{formatRelativeDate(act.createdAt)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ação: Botão Assistir exclusivo para episódios (sem botão Ver Detalhes) */}
                {isEpisode && epNum && (
                  <Link
                    to="/watch/$id/$ep"
                    params={{
                      id: act.resourceId,
                      ep: `ep-${epNum}`,
                    }}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-zinc-200 transition-all hover:border-violet-500/40 hover:bg-violet-600 hover:text-white"
                  >
                    <Play className="size-3.5 fill-current" />
                    <span className="hidden sm:inline">Assistir</span>
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
