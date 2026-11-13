import { memo, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Film } from "lucide-react";
import { HikariImage } from "@/components/ui/hikari-image";
import { anilistImage } from "@/lib/image-utils";
import type { PublishedEpisode } from "@/lib/published-episodes";
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
  // Selo DUB em verde exclusivamente quando houver indicação verificável de versão dublada
  const isDub = useMemo(() => {
    const texts: string[] = [
      episode.episodeTitle,
      episode.seasonTitle,
      episode.animeTitle,
      ...(episode.animeAltTitles || []),
      (episode as unknown as { audio?: string }).audio || "",
      (episode as unknown as { audioVersion?: string }).audioVersion || "",
    ].filter(Boolean);

    const combined = texts.join(" ").toLowerCase();
    const dubRegex =
      /(?:^|[^a-z0-9])(dub|dublado|dublada|dublagem|pt-br\s*dub|dub\s*pt-br)(?:$|[^a-z0-9])/i;

    return dubRegex.test(combined);
  }, [episode]);

  const hasValidThumbnail = Boolean(episode.thumbnail?.trim());

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
          {hasValidThumbnail ? (
            <HikariImage
              src={anilistImage(episode.thumbnail, 320)}
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
          ) : (
            <div className="flex size-full items-center justify-center bg-[#131022] text-purple-400/40">
              <Film className="size-8" />
            </div>
          )}

          {/* Sombra interna com gradiente escuro */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent opacity-60" />

          {/* Selo verde DUB apenas quando o episódio for dublado */}
          {isDub && (
            <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex items-center z-10 select-none pointer-events-none">
              <span className="inline-flex items-center justify-center h-4 sm:h-[18px] px-1.5 rounded bg-emerald-600/95 border border-emerald-400/40 text-[8px] sm:text-[9px] font-bold tracking-wider text-white shadow-sm leading-none uppercase">
                DUB
              </span>
            </div>
          )}
        </div>

        {/* Nome do Anime em azul e Episódio em cinza */}
        <div className="mt-1.5 sm:mt-2 px-0.5">
          <h4
            title={episode.animeTitle}
            className="text-xs sm:text-[13px] md:text-sm font-semibold text-sky-400 transition-colors motion-reduce:transition-none [@media(hover:hover)]:group-hover:text-sky-300 group-active:text-sky-200 truncate"
          >
            {episode.animeTitle}
          </h4>

          <p className="mt-0.5 text-[11px] sm:text-xs font-medium text-zinc-400 truncate">
            Episódio {episode.episodeNumber}
          </p>
        </div>
      </Link>
    </article>
  );
});
