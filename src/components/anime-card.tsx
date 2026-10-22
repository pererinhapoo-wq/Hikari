import { memo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  BookmarkCheck,
} from "lucide-react";

import {
  displayTitle,
  type SlimAnime,
} from "@/lib/types";

import { scoreLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useHikariStore } from "@/lib/store";

export const AnimeCard = memo(function AnimeCard({
  anime,
  size = "md",
}: {
  anime: SlimAnime;
  size?: "sm" | "md" | "lg";
}) {
  const inList =
    useHikariStore((s) =>
      s.myList.includes(anime.id),
    );

  const toggleList =
    useHikariStore(
      (s) => s.toggleList,
    );

  const title =
    displayTitle(anime);

  const width =
    size === "sm"
      ? "w-24 sm:w-28"
      : size === "lg"
        ? "w-full sm:w-full"
        : "w-[7.5rem] sm:w-[8.25rem] md:w-38 lg:w-40";

  return (
    <article
      className={cn(
        "group relative shrink-0 transition-transform duration-300 ease-out hover:-translate-y-1",
        width,
      )}
    >
      <Link
        to="/anime/$id"
        params={{
          id: anime.id,
        }}
        preload="intent"
        className="
          block
          overflow-hidden
          rounded-xl
          bg-[#100e1b]
          border
          border-purple-500/15
          transition-all
          duration-300
          ease-[var(--ease-out)]
          hover:border-purple-400/50
          hover:shadow-[0_10px_24px_-6px_rgba(168,85,247,0.35)]
        "
      >
        <div className="relative aspect-[3/4.4] sm:aspect-[2/3] overflow-hidden bg-[#0d0c16]">
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
                group-hover:scale-[1.04]
              "
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex size-full items-center justify-center px-2 text-center font-display text-base text-subtle">
              {title.slice(0, 1)}
            </div>
          )}

          {/* Sombra sutil interna com gradiente escuro */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#100e1b] via-transparent to-black/25 opacity-40 transition-opacity duration-300 group-hover:opacity-60" />

          {/* Badge de Nota compacto e elegante */}
          {anime.score != null && (
            <span
              className="
                absolute
                top-1.5
                left-1.5
                rounded-md
                bg-black/85
                backdrop-blur-md
                border
                border-purple-500/35
                px-1.5
                py-0.5
                text-[10px]
                font-bold
                tabular-nums
                text-purple-200
                shadow-sm
                flex
                items-center
                gap-0.5
              "
            >
              ★ {scoreLabel(anime.score)}
            </span>
          )}
        </div>

        {/* Nomes dos animes menores, elegantes e limitados a 2 linhas */}
        <div className="px-2 py-2 sm:px-2.5 sm:py-2.5">
          <h3 className="line-clamp-2 min-h-[2rem] text-[11px] font-medium leading-[1.3] text-zinc-200 transition-colors group-hover:text-purple-300 sm:text-xs">
            {title}
          </h3>

          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-500">
            {anime.year && <span>{anime.year}</span>}
            {anime.year && (anime.format || anime.genres?.[0]) && (
              <span className="size-1 rounded-full bg-zinc-700" />
            )}
            <span className="truncate">
              {anime.format === "TV"
                ? "Série"
                : anime.format === "MOVIE"
                  ? "Filme"
                  : anime.genres?.[0]
                    ? anime.genres[0]
                    : ""}
            </span>
          </div>
        </div>
      </Link>

      {/* Botão Minha Lista compacto */}
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
        className={cn(
          "absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-md bg-black/80 backdrop-blur-md border border-white/10 text-white transition-all duration-200 hover:border-purple-500/60 hover:bg-purple-950/80 hover:text-purple-300 shadow-md",
          inList
            ? "opacity-100 text-purple-400 border-purple-500/40"
            : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
        )}
      >
        {inList ? (
          <BookmarkCheck className="size-3.5 text-purple-400" />
        ) : (
          <Bookmark className="size-3.5" />
        )}
      </button>
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
        ? "w-full sm:w-full"
        : "w-[7.5rem] sm:w-[8.25rem] md:w-38 lg:w-40";

  return (
    <div
      className={cn(
        width,
        "shrink-0",
      )}
    >
      <div className="aspect-[3/4.4] sm:aspect-[2/3] animate-pulse rounded-xl bg-elevated/70 border border-purple-500/10" />

      <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-elevated/80" />

      <div className="mt-1 h-2.5 w-1/2 animate-pulse rounded bg-elevated/50" />
    </div>
  );
}
