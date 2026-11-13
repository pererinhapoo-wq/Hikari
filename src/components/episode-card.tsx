import { memo, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { HikariImage } from "@/components/ui/hikari-image";
import { anilistImage } from "@/lib/image-utils";
import { cleanEpisodeDisplay, type PublishedEpisode } from "@/lib/published-episodes";
import { cn } from "@/lib/utils";

export const EpisodeCard = memo(function EpisodeCard({
  episode,
  priority = false,
  defer,
  first = false,
}: {
  episode: PublishedEpisode;
  priority?: boolean;
  defer?: boolean;
  first?: boolean;
}) {
  const formattedSubtitle = useMemo(() => {
    return cleanEpisodeDisplay(
      episode.episodeNumber,
      episode.episodeTitle,
      episode.animeAltTitles && episode.animeAltTitles.length > 0
        ? episode.animeAltTitles
        : episode.animeTitle,
    );
  }, [
    episode.episodeNumber,
    episode.episodeTitle,
    episode.animeAltTitles,
    episode.animeTitle,
  ]);

  // Selos de áudio confiáveis (DUB em verde, LEG em vermelho) apenas quando houver dados verificáveis
  const audioInfo = useMemo(() => {
    const texts: string[] = [
      episode.episodeTitle,
      episode.seasonTitle,
      episode.animeTitle,
      ...(episode.animeAltTitles || []),
      (episode as unknown as { audio?: string }).audio || "",
      (episode as unknown as { audioVersion?: string }).audioVersion || "",
    ].filter(Boolean);

    const combined = texts.join(" ").toLowerCase();

    // Detecção segura sem presumir idiomas ou criar falsos positivos
    const dubRegex = /\b(dub|dublado|dublada|dublagem|pt-br\s*dub|dub\s*pt-br)\b/i;
    const legRegex = /\b(leg|legendado|legendada|legendas|pt-br\s*leg|leg\s*pt-br|sub|subbed)\b/i;

    return {
      isDub: dubRegex.test(combined),
      isLeg: legRegex.test(combined),
    };
  }, [
    episode,
  ]);

  return (
    <article className="group relative w-full episode-card-cv">
      <Link
        to="/watch/$id/$ep"
        params={{ id: episode.animeId, ep: `ep-${episode.episodeNumber || 1}` }}
        preload="intent"
        resetScroll={true}
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
          <HikariImage
            src={episode.thumbnail ? anilistImage(episode.thumbnail, 320) : episode.thumbnail}
            alt={episode.animeTitle}
            width={320}
            height={180}
            priority={false}
            loading={first || priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority="low"
            defer={!first && !priority && (defer ?? true)}
            fallbackClassName="bg-[#0f0d1a]"
            className="size-full object-cover"
          />

          {/* Sombra interna com gradiente escuro */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60" />

          {/* Selos de áudio discretos sobre a miniatura (DUB em verde, LEG em vermelho) */}
          {(audioInfo.isDub || audioInfo.isLeg) && (
            <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex items-center gap-1 z-10 select-none pointer-events-none">
              {audioInfo.isDub && (
                <span className="inline-flex items-center justify-center h-4 sm:h-[18px] px-1 sm:px-1.5 rounded bg-emerald-600/90 border border-emerald-400/30 text-[7.5px] sm:text-[9px] font-bold tracking-wider text-white shadow-sm leading-none">
                  DUB
                </span>
              )}
              {audioInfo.isLeg && (
                <span className="inline-flex items-center justify-center h-4 sm:h-[18px] px-1 sm:px-1.5 rounded bg-red-600/90 border border-red-400/30 text-[7.5px] sm:text-[9px] font-bold tracking-wider text-white shadow-sm leading-none">
                  LEG
                </span>
              )}
            </div>
          )}

          {/* Selo de status do episódio (LANÇAMENTO em roxo/índigo, FINAL em vermelho/rose) */}
          {episode.badge && (
            <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex items-center z-10 select-none pointer-events-none">
              <span
                className={cn(
                  "inline-flex items-center justify-center h-4 sm:h-[18px] px-1.5 rounded text-[7.5px] sm:text-[9px] font-bold tracking-wider text-white shadow-sm leading-none uppercase",
                  episode.badge === "LANÇAMENTO" &&
                    "bg-purple-600/95 border border-purple-400/40 text-white shadow-[0_2px_8px_rgba(168,85,247,0.5)]",
                  episode.badge === "FINAL" &&
                    "bg-rose-600/95 border border-rose-400/40 text-white shadow-[0_2px_8px_rgba(225,29,72,0.5)]",
                )}
              >
                {episode.badge}
              </span>
            </div>
          )}

          {/* Duração se disponível */}
          {episode.duration ? (
            <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 rounded bg-black/90 border border-white/10 px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[9.5px] font-medium text-zinc-300">
              {episode.duration}
            </div>
          ) : null}
        </div>

        {/* Informações de Texto: Título do Anime e Número do Episódio em linha separada */}
        <div className="mt-1.5 sm:mt-2.5 px-0.5">
          {/* Título do Anime abaixo da miniatura */}
          <h4
            title={episode.animeTitle}
            className="text-xs sm:text-[13px] md:text-sm font-semibold text-zinc-200 transition-colors motion-reduce:transition-none [@media(hover:hover)]:group-hover:text-purple-300 group-active:text-purple-200 truncate"
          >
            {episode.animeTitle}
          </h4>

          {/* Número do episódio e badge de status em linha separada, abaixo do título */}
          <div className="mt-0.5 flex items-center gap-1.5 truncate">
            <p
              title={formattedSubtitle}
              className="text-[11px] sm:text-xs font-medium text-purple-400/90 truncate"
            >
              Episódio {episode.episodeNumber}
            </p>
            {episode.badge && (
              <span
                className={cn(
                  "inline-flex items-center px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-bold tracking-wider uppercase leading-tight shrink-0",
                  episode.badge === "LANÇAMENTO" &&
                    "bg-purple-500/20 text-purple-300 border border-purple-500/30",
                  episode.badge === "FINAL" &&
                    "bg-rose-500/20 text-rose-300 border border-rose-500/30",
                )}
              >
                {episode.badge}
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
});
