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
  rank,
  showBookmark = true,
}: {
  anime: SlimAnime;
  size?: "sm" | "md" | "lg";
  rank?: number;
  showBookmark?: boolean;
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
        : "w-[6.6rem] sm:w-[7.85rem] md:w-[8.85rem] lg:w-[9.35rem]";

  return (
    <article
      className={cn(
        "group relative shrink-0 transition-transform duration-300 ease-out [@media(hover:hover)]:hover:-translate-y-1.5",
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
          [@media(hover:hover)]:hover:border-purple-400/50
          [@media(hover:hover)]:hover:shadow-[0_12px_28px_-6px_rgba(168,85,247,0.35)]
        "
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-[#0d0c16]">
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
                [@media(hover:hover)]:group-hover:scale-[1.04]
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
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#100e1b] via-transparent to-black/25 opacity-40 transition-opacity duration-300 [@media(hover:hover)]:group-hover:opacity-60" />

          {/* Badge de Ranking para listas como Em Alta */}
          {rank != null && (
            <span
              className="
                absolute
                bottom-1.5
                left-1.5
                rounded-md
                bg-purple-950/90
                backdrop-blur-md
                border
                border-purple-500/40
                px-1.5
                py-0.5
                text-[9.5px]
                font-black
                tabular-nums
                text-purple-200
                shadow-md
              "
            >
              #{rank}
            </span>
          )}

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
                text-[9.5px]
                font-bold
                tabular-nums
                text-purple-200
                shadow-sm
                flex
                items-center
                gap-0.5
              "
            >
              <span className="text-amber-400">★</span> {scoreLabel(anime.score)}
            </span>
          )}
        </div>

        {/* Bloco de informações com alinhamento uniforme e espaçamento compacto */}
        <div className="flex flex-col px-2 pt-1.5 pb-2 sm:px-2.5 sm:pt-2 sm:pb-2.5">
          {/* Área com altura fixa precisa (26px mobile, 30px desktop) e centralização vertical */}
          <div className="h-[26px] sm:h-[30px] flex flex-col justify-center overflow-hidden">
            <h3
              title={title}
              className="
                text-[10.5px]
                sm:text-xs
                font-semibold
                leading-[13px]
                sm:leading-[15px]
                tracking-tight
                text-zinc-200
                line-clamp-2
                break-words
                [text-wrap:normal]
                transition-colors
                [@media(hover:hover)]:group-hover:text-purple-300
              "
            >
              {title}
            </h3>
          </div>

          {/* Ano e tipo imediatamente abaixo do título, com espaçamento sutilmente aproximado e alinhamento linear uniforme */}
          <div className="mt-px sm:mt-0.5 flex items-center gap-1 text-[9.5px] sm:text-[10px] font-medium text-zinc-400 truncate">
            {anime.year && <span className="shrink-0">{anime.year}</span>}
            {anime.year && (anime.format || anime.genres?.[0]) && (
              <span className="text-purple-400/80 font-bold select-none px-0.5">·</span>
            )}
            <span className="truncate">
              {anime.format === "TV"
                ? "Série"
                : anime.format === "MOVIE"
                  ? "Filme"
                  : anime.format === "OVA"
                    ? "OVA"
                    : anime.format === "ONA"
                      ? "ONA"
                      : anime.format === "SPECIAL"
                        ? "Especial"
                        : anime.genres?.[0]
                          ? anime.genres[0]
                          : ""}
            </span>
          </div>
        </div>
      </Link>

      {/* Botão Minha Lista compacto (preservado em outras páginas, ocultado se showBookmark for false) */}
      {showBookmark && (
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
        ? "w-full sm:w-full"
        : "w-[6.6rem] sm:w-[7.85rem] md:w-[8.85rem] lg:w-[9.35rem]";

  return (
    <div
      className={cn(
        width,
        "shrink-0",
      )}
    >
      <div className="aspect-[2/3] animate-pulse rounded-xl bg-elevated/70 border border-purple-500/10" />

      <div className="px-2 pt-1.5 pb-2 sm:px-2.5 sm:pt-2 sm:pb-2.5">
        <div className="h-[26px] sm:h-[30px] flex flex-col justify-center gap-1">
          <div className="h-3 w-4/5 animate-pulse rounded bg-elevated/80" />
          <div className="h-2.5 w-3/5 animate-pulse rounded bg-elevated/80" />
        </div>

        <div className="mt-px sm:mt-0.5 h-2.5 w-1/2 animate-pulse rounded bg-elevated/50" />
      </div>
    </div>
  );
}
