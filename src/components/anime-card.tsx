import { memo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  BookmarkCheck,
} from "lucide-react";

import { HikariImage } from "@/components/ui/hikari-image";
import {
  displayTitle,
  type SlimAnime,
} from "@/lib/types";
import { getResponsiveCoverAttrs } from "@/lib/image-utils";
import { FORMAT_PT, GENRE_PT } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useHikariStore } from "@/lib/store";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const AnimeCard = memo(function AnimeCard({
  anime,
  size = "md",
  rank: _rank,
  showBookmark = true,
  loadImage = true,
  showGenre: _showGenre = true,
  priority = false,
  showScoreBadge: _showScoreBadge = false,
}: {
  anime: SlimAnime;
  size?: "sm" | "md" | "lg";
  rank?: number;
  showBookmark?: boolean;
  loadImage?: boolean;
  showGenre?: boolean;
  priority?: boolean;
  showScoreBadge?: boolean;
}) {
  const { user } = useCurrentUserState();
  const canBookmark = showBookmark && Boolean(user);

  const inList = useHikariStore((s) =>
    canBookmark ? s.isInList(anime.id, user?.id) : false,
  );

  const toggleList = useHikariStore((s) => s.toggleList);

  const title = displayTitle(anime);

  const width =
    size === "sm"
      ? "w-24 sm:w-28"
      : size === "lg"
        ? "w-full"
        : "w-[6.6rem] sm:w-[7.85rem] md:w-[8.85rem] lg:w-[9.35rem]";

  const coverVariant =
    size === "sm" ? "card-sm" : size === "lg" ? "card-lg" : "card-md";
  const coverAttrs = getResponsiveCoverAttrs(anime.cover, coverVariant);

  const primaryGenre = anime.genres?.[0]
    ? GENRE_PT[anime.genres[0]] || anime.genres[0]
    : anime.format
      ? FORMAT_PT[anime.format] || anime.format
      : "";
  const yearText = anime.year ? String(anime.year) : "";

  return (
    <article className={cn("group relative flex flex-col min-w-0 shrink-0", width)}>
      <Link
        to="/anime/$id"
        params={{ id: anime.id }}
        preload="intent"
        className="
          block
          outline-none
          focus-visible:ring-2
          focus-visible:ring-purple-400
          transition-all
          duration-150
          ease-out
          active:scale-[0.96]
          active:brightness-110
          [@media(hover:hover)]:hover:brightness-105
          motion-reduce:transition-none
          motion-reduce:transform-none
          -webkit-tap-highlight-color-transparent
        "
      >
        {/* Pôster vertical retangular com cantos retos (sem cantos arredondados) */}
        <div className="
          relative
          aspect-[2/3]
          w-full
          overflow-hidden
          rounded-none
          bg-[#0d0c16]
          border
          border-white/10
          shadow-sm
          transition-all
          duration-200
          ease-out
          group-hover:border-purple-500/50
          group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]
          group-active:border-purple-400
          group-active:shadow-[0_0_25px_rgba(168,85,247,0.45)]
        ">
          <HikariImage
            src={anime.cover ? coverAttrs.src : null}
            srcSet={anime.cover ? coverAttrs.srcSet : undefined}
            sizes={anime.cover ? coverAttrs.sizes : undefined}
            fallbackSrc={coverAttrs.fallbackSrc ? anime.cover : undefined}
            deferred={Boolean(anime.cover && !loadImage)}
            alt=""
            width={230}
            height={345}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            fallbackClassName="bg-[#0d0c16]"
            className="
              size-full
              object-cover
              group-hover:scale-[1.03]
              group-active:scale-[1.01]
              motion-reduce:transform-none
            "
          />
        </div>

        {/* Informações estritamente FORA do pôster */}
        <div className="mt-2 flex flex-col px-0.5">
          {/* Título abaixo do pôster */}
          <h3
            title={title}
            className="truncate text-xs sm:text-sm font-medium text-zinc-100 transition-colors group-hover:text-purple-300 group-active:text-purple-200"
          >
            {title}
          </h3>

          {/* Gênero e ano abaixo do título, em tamanho menor (sem notas nem estrelas) */}
          <div className="mt-0.5 text-[10.5px] sm:text-xs text-zinc-400 truncate">
            {anime.todayEpisode?.number ? (
              <span className="font-semibold text-purple-400">
                Episódio {anime.todayEpisode.number}
              </span>
            ) : (
              <>
                {primaryGenre}
                {primaryGenre && yearText ? " · " : ""}
                {yearText}
              </>
            )}
          </div>
        </div>
      </Link>

      {/* Botão Minha Lista compacto (exclusivo para usuários autenticados) */}
      {canBookmark && (
        <button
          type="button"
          aria-label={
            inList ? "Remover da Minha Lista" : "Adicionar à Minha Lista"
          }
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!user) return;
            toggleList(anime, user.id);
          }}
          className={cn(
            "absolute top-1.5 right-1.5 z-10 flex size-6.5 items-center justify-center rounded-none bg-black/80 border border-white/10 text-white transition-all duration-200 [@media(hover:hover)]:hover:border-purple-500/60 [@media(hover:hover)]:hover:bg-purple-950/85 [@media(hover:hover)]:hover:text-purple-300 shadow-md",
            inList
              ? "opacity-100 text-purple-400 border-purple-500/40"
              : "opacity-0 group-hover:opacity-100 focus:opacity-100",
          )}
        >
          {inList ? (
            <BookmarkCheck className="size-3.5 text-purple-400" />
          ) : (
            <Bookmark className="size-3.5" />
          )}
        </button>
      )}
    </article>
  );
});

export function AnimeCardSkeleton({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const width =
    size === "sm"
      ? "w-24 sm:w-28"
      : size === "lg"
        ? "w-full"
        : "w-[6.6rem] sm:w-[7.85rem] md:w-[8.85rem] lg:w-[9.35rem]";

  return (
    <div className={cn("shrink-0", width)}>
      <div className="aspect-[2/3] w-full rounded-none bg-[#141224] animate-pulse border border-white/5" />
      <div className="mt-2 h-3.5 w-3/4 rounded-none bg-white/5 animate-pulse" />
      <div className="mt-1 h-2.5 w-1/2 rounded-none bg-white/5 animate-pulse" />
    </div>
  );
}
