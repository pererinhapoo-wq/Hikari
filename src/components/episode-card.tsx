import { memo, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Film } from "lucide-react";
import { HikariImage } from "@/components/ui/hikari-image";
import { anilistImage } from "@/lib/image-utils";
import {
  isPublishedEpisodeDubbed,
  resolveEpisodeThumbnailUrl,
  type PublishedEpisode,
} from "@/lib/published-episodes";
import { cn } from "@/lib/utils";
import { triggerMonetagSmartLinkOnNavigationClick } from "@/lib/monetag-smartlink";
import { formatEpisodeRelativeTime } from "@/lib/relative-published-time";

export const EpisodeCard = memo(function EpisodeCard({
  episode,
  priority = false,
  defer,
  first = false,
  showRecentBadges = true,
  relativeTimeNowMs,
}: {
  episode: PublishedEpisode;
  priority?: boolean;
  defer?: boolean;
  first?: boolean;
  showRecentBadges?: boolean;
  relativeTimeNowMs?: number;
}) {
  // Selo DUB apenas quando o episódio efetivamente exibido for dublado
  const isDub = useMemo(() => isPublishedEpisodeDubbed(episode), [episode]);

  const showLancamento = Boolean(
    showRecentBadges &&
      (episode.recentBadges?.lancamento ||
        (!episode.recentBadges && episode.badge === "LANÇAMENTO")),
  );
  const showNovo = Boolean(
    showRecentBadges &&
      (episode.recentBadges?.novo ||
        (!episode.recentBadges && episode.badge === "NOVO")),
  );
  const showFinal = Boolean(
    showRecentBadges &&
      (episode.recentBadges?.final ||
        (!episode.recentBadges && episode.badge === "FINAL")),
  );

  const rawThumb = resolveEpisodeThumbnailUrl({
    thumbnail: episode.thumbnail,
    videoUrl: episode.videoUrl,
  });
  const optimizedThumb = rawThumb ? anilistImage(rawThumb, 320) : "";
  const hasValidThumbnail = Boolean(optimizedThumb);

  const relativePublishedLabel =
    relativeTimeNowMs !== undefined
      ? formatEpisodeRelativeTime(episode.publishedTimestamp, relativeTimeNowMs, {
          published: episode.published,
        })
      : null;

  return (
    <article className="group relative w-full episode-card-cv">
      <Link
        to="/watch/$id/$ep"
        params={{ id: episode.animeId, ep: `ep-${episode.episodeNumber || 1}` }}
        preload="intent"
        resetScroll={true}
        onClick={triggerMonetagSmartLinkOnNavigationClick}
        className={cn(
          "block group select-none touch-manipulation [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80 rounded-lg sm:rounded-xl",
          "motion-safe:transition-[transform,opacity] motion-safe:duration-150 motion-safe:active:scale-[0.98] motion-safe:active:opacity-85 motion-reduce:transition-none motion-reduce:transform-none",
        )}
      >
        {/* Contêiner da Imagem Horizontal (Proporção 16:9 de Vídeo) */}
        <div
          className={cn(
            "relative aspect-video w-full overflow-hidden rounded-lg sm:rounded-xl bg-[#0f0d1a] border border-purple-500/15 transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none",
            "[@media(hover:hover)]:group-hover:border-purple-400/50 [@media(hover:hover)]:group-hover:shadow-[0_8px_20px_-4px_rgba(168,85,247,0.25)]",
            "group-active:border-purple-400/80",
          )}
        >
          {hasValidThumbnail ? (
            <HikariImage
              src={optimizedThumb}
              fallbackSrc={
                rawThumb && optimizedThumb !== rawThumb ? rawThumb : undefined
              }
              alt={episode.animeTitle}
              width={320}
              height={180}
              priority={false}
              loading={first || priority ? "eager" : "lazy"}
              decoding="async"
              fetchPriority="low"
              defer={!first && !priority && (defer ?? true)}
              fallback={
                <div className="flex size-full items-center justify-center bg-[#131022] text-purple-400/40">
                  <Film className="size-8" />
                </div>
              }
              fallbackClassName="bg-[#0f0d1a]"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-[#131022] text-purple-400/40">
              <Film className="size-8" />
            </div>
          )}

          {/* Sombra interna com gradiente escuro */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent opacity-60" />

          {/* Selo verde DUB apenas quando o episódio exibido for dublado */}
          {isDub && (
            <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex items-center z-10 select-none pointer-events-none">
              <span
                data-badge="dub"
                className="inline-flex items-center justify-center h-4 sm:h-[18px] px-1.5 rounded bg-emerald-600/95 border border-emerald-300/50 text-[8px] sm:text-[9px] font-bold tracking-wider text-white shadow-sm leading-none uppercase"
              >
                DUB
              </span>
            </div>
          )}

          {/* Selos manuais superiores (NOVO: menor/âmbar; LANÇAMENTO: médio/violeta) */}
          {(showNovo || showLancamento) && (
            <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex flex-wrap items-center justify-end gap-1 max-w-[74%] z-10 select-none pointer-events-none">
              {showNovo && (
                <span
                  data-badge="novo"
                  className="inline-flex items-center justify-center h-[15px] sm:h-[17px] px-1.5 rounded bg-amber-400/95 border border-amber-200/75 text-[7.5px] sm:text-[8.5px] font-extrabold tracking-wider text-zinc-950 shadow-sm leading-none uppercase"
                >
                  NOVO
                </span>
              )}
              {showLancamento && (
                <span
                  data-badge="lancamento"
                  className="inline-flex items-center justify-center h-[18px] sm:h-[21px] px-2 sm:px-2.5 rounded bg-violet-600/95 border border-violet-300/60 text-[8.5px] sm:text-[9.5px] font-extrabold tracking-wider text-white shadow-md leading-none uppercase"
                >
                  LANÇAMENTO
                </span>
              )}
            </div>
          )}

          {/* Selo manual FINAL sobre a imagem (maior/vermelho carmesim) */}
          {showFinal && (
            <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 flex items-center z-10 select-none pointer-events-none">
              <span
                data-badge="final"
                className="inline-flex items-center justify-center h-[21px] sm:h-[24px] px-2.5 sm:px-3 rounded-md bg-rose-600/95 border border-rose-300/65 text-[9.5px] sm:text-[11px] font-black tracking-widest text-white shadow-[0_2px_10px_rgba(225,29,72,0.45)] leading-none uppercase"
              >
                FINAL
              </span>
            </div>
          )}
        </div>

        {/* Nome do Anime em azul (com selo FINAL quando ativo) e Episódio em cinza */}
        <div className="mt-1.5 sm:mt-2 px-0.5">
          <h4
            title={showFinal ? `${episode.animeTitle} · FINAL` : episode.animeTitle}
            className="flex items-center gap-1.5 min-w-0 text-xs sm:text-[13px] md:text-sm font-semibold text-sky-400 transition-colors motion-reduce:transition-none [@media(hover:hover)]:group-hover:text-sky-300 group-active:text-sky-200"
          >
            <span className="truncate">{episode.animeTitle}</span>
            {showFinal && (
              <span
                data-badge="title-final"
                className="shrink-0 inline-flex items-center justify-center h-4 px-1.5 rounded bg-rose-600/95 border border-rose-300/55 text-[8.5px] sm:text-[9.5px] font-black tracking-wider text-white leading-none uppercase"
              >
                FINAL
              </span>
            )}
          </h4>

          <div className="mt-0.5 flex items-baseline justify-between gap-2 min-w-0">
            <p className="text-[11px] sm:text-xs font-medium text-zinc-400 whitespace-nowrap shrink-0">
              Episódio {episode.episodeNumber}
            </p>
            {relativePublishedLabel && (
              <span
                data-testid="episode-relative-time"
                suppressHydrationWarning
                className="min-w-0 text-[10.5px] sm:text-[11px] font-normal text-zinc-400/80 truncate text-right"
              >
                {relativePublishedLabel}
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
});
