import { Link } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck } from "lucide-react";

import { displayTitle, type SlimAnime } from "@/lib/types";
import { scoreLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useHikariStore } from "@/lib/store";

export function AnimeCard({
  anime,
  size = "md",
}: {
  anime: SlimAnime;
  size?: "sm" | "md" | "lg";
}) {
  const inList = useHikariStore((s) => s.myList.includes(anime.id));
  const toggleList = useHikariStore((s) => s.toggleList);
  const title = displayTitle(anime);

  const width =
    size === "sm"
      ? "w-28 sm:w-28 md:w-40 lg:w-44"
      : size === "lg"
        ? "w-36 sm:w-40 md:w-48 lg:w-52"
        : "w-32 sm:w-34 md:w-44 lg:w-48";

  return (
    <article className={cn("group relative shrink-0", width)}>
      <Link
        to="/anime/$id"
        params={{ id: anime.id }}
        className="
          block
          overflow-hidden
          rounded-xl
          bg-elevated
          shadow-[var(--shadow-border)]
          transition-[transform,box-shadow]
          duration-200
          ease-[var(--ease-out)]
          hover:-translate-y-0.5
          hover:shadow-[var(--shadow-border-hover)]
        "
      >
        <div className="relative aspect-2/3 overflow-hidden bg-surface">
          {anime.cover ? (
            <img
              src={anime.cover}
              alt=""
              className="
                size-full
                object-cover
                transition-transform
                duration-500
                ease-[var(--ease-out)]
                group-hover:scale-[1.03]
              "
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center px-2 text-center font-display text-lg text-subtle">
              {title.slice(0, 1)}
            </div>
          )}

          {anime.score != null && (
            <span
              className="
                absolute
                top-1.5
                left-1.5
                rounded-md
                bg-bg/80
                px-1.5
                py-0.5
                text-[10px]
                font-medium
                tabular-nums
                text-score
                backdrop-blur-sm
              "
            >
              {scoreLabel(anime.score)}
            </span>
          )}
        </div>

        <div className="px-2 py-2">
          <h3 className="line-clamp-2 text-xs leading-snug text-fg sm:text-sm">
            {title}
          </h3>

          <p className="mt-0.5 truncate text-[10px] text-subtle sm:text-[11px]">
            {anime.year ?? ""}
            {anime.year && anime.format ? " · " : ""}
            {anime.format === "TV"
              ? "Série"
              : anime.format === "MOVIE"
                ? "Filme"
                : ""}
          </p>
        </div>
      </Link>

      <button
        type="button"
        aria-label={
          inList
            ? "Remover da Minha Lista"
            : "Adicionar à Minha Lista"
        }
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleList(anime);
        }}
        className="
          absolute
          top-1.5
          right-1.5
          flex
          size-8
          items-center
          justify-center
          rounded-md
          bg-bg/70
          text-fg
          opacity-100
          backdrop-blur-sm
          transition-opacity
          sm:opacity-0
          sm:group-hover:opacity-100
        "
      >
        {inList ? (
          <BookmarkCheck className="size-4" />
        ) : (
          <Bookmark className="size-4" />
        )}
      </button>
    </article>
  );
}

export function AnimeCardSkeleton({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const width =
    size === "sm"
      ? "w-28 sm:w-28 md:w-40 lg:w-44"
      : size === "lg"
        ? "w-36 sm:w-40 md:w-48 lg:w-52"
        : "w-32 sm:w-34 md:w-44 lg:w-48";

  return (
    <div className={cn(width, "shrink-0")}>
      <div className="aspect-2/3 animate-pulse rounded-xl bg-elevated" />

      <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-elevated" />

      <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded bg-elevated" />
    </div>
  );
}
