import { memo, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  BookmarkCheck,
} from "lucide-react";

import {
  displayTitle,
  type SlimAnime,
} from "@/lib/types";
import { getResponsiveCoverAttrs } from "@/lib/image-utils";

import { cn } from "@/lib/utils";
import { useHikariStore } from "@/lib/store";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const AnimeCard = memo(function AnimeCard({
  anime,
  size = "md",
  rank: _rank,
  showBookmark = true,
  loadImage = true,
  showGenre = true,
  priority = false,
}: {
  anime: SlimAnime;
  size?: "sm" | "md" | "lg";
  rank?: number;
  showBookmark?: boolean;
  loadImage?: boolean;
  showGenre?: boolean;
  priority?: boolean;
}) {
  const [failedOptimizedFor, setFailedOptimizedFor] = useState<string | null>(
    null,
  );

  const { user } = useCurrentUserState();
  const canBookmark = showBookmark && Boolean(user);

  const inList =
    useHikariStore((s) =>
      canBookmark ? s.isInList(anime.id, user?.id) : false,
    );

  const toggleList =
    useHikariStore(
      (s) => s.toggleList,
    );

  const title =
    displayTitle(anime);

  // Selos de áudio confiáveis (DUB em verde, LEG em vermelho) apenas se houver metadados verificáveis
  const audioInfo = useMemo(() => {
    const texts: string[] = [
      anime.titles?.english,
      anime.titles?.romaji,
      anime.titles?.native,
      (anime as unknown as { audio?: string }).audio || "",
      (anime as unknown as { audioVersion?: string }).audioVersion || "",
    ].filter(Boolean);

    const combined = texts.join(" ").toLowerCase();
    const dubRegex = /\b(dub|dublado|dublada|dublagem|pt-br\s*dub|dub\s*pt-br)\b/i;
    const legRegex = /\b(leg|legendado|legendada|legendas|pt-br\s*leg|leg\s*pt-br|sub|subbed)\b/i;

    return {
      isDub: dubRegex.test(combined),
      isLeg: legRegex.test(combined),
    };
  }, [anime.titles]);

  const width =
    size === "sm"
      ? "w-24 sm:w-28"
      : size === "lg"
        ? "w-full sm:w-full"
        : "w-[6.6rem] sm:w-[7.85rem] md:w-[8.85rem] lg:w-[9.35rem]";

  const coverVariant =
    size === "sm" ? "card-sm" : size === "lg" ? "card-lg" : "card-md";
  const coverAttrs = getResponsiveCoverAttrs(anime.cover, coverVariant);
  const useOriginalFallback = failedOptimizedFor === anime.cover;

  return (
    <article
      className={cn(
        "group relative shrink-0",
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
          [contain:layout_paint_style]
          motion-safe:transition-[border-color,box-shadow,transform,opacity]
          motion-safe:duration-150
          ease-[var(--ease-out)]
          [@media(hover:hover)]:hover:border-purple-400/50
          [@media(hover:hover)]:hover:shadow-[0_8px_20px_-4px_rgba(168,85,247,0.28)]
          [@media(hover:hover)]:motion-safe:active:scale-[0.98]
          [@media(hover:hover)]:motion-safe:active:opacity-85
          active:border-purple-400/40
          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-purple-400/50
          -webkit-tap-highlight-color-transparent
          motion-reduce:transition-none
          motion-reduce:transform-none
        "
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-[#0d0c16]">
          {anime.cover ? (
            loadImage ? (
              <img
                src={useOriginalFallback ? anime.cover : coverAttrs.src}
                srcSet={useOriginalFallback ? undefined : coverAttrs.srcSet}
                sizes={useOriginalFallback ? undefined : coverAttrs.sizes}
                alt=""
                width={230}
                height={345}
                onError={() => {
                  if (!useOriginalFallback && coverAttrs.fallbackSrc) {
                    setFailedOptimizedFor(anime.cover);
                  }
                }}
                className="
                  size-full
                  object-cover
                  motion-safe:transition-transform
                  motion-safe:duration-500
                  ease-[var(--ease-out)]
                  [@media(hover:hover)]:group-hover:scale-[1.025]
                  [@media(hover:hover)]:group-active:scale-[1.015]
                "
                loading={priority ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={priority ? "high" : "auto"}
              />
            ) : (
              <div className="size-full bg-[#0d0c16]" />
            )
          ) : (
            <div className="flex size-full items-center justify-center px-2 text-center font-display text-base text-subtle">
              {title.slice(0, 1)}
            </div>
          )}

          {/* Sombra sutil interna com gradiente escuro */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#100e1b] via-transparent to-black/25 opacity-40 transition-opacity duration-300 [@media(hover:hover)]:group-hover:opacity-60 [@media(hover:hover)]:group-active:opacity-60" />

          {/* Selos de áudio discretos sobre a miniatura (DUB em verde, LEG em vermelho) */}
          {(audioInfo.isDub || audioInfo.isLeg) && (
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 z-10 select-none pointer-events-none">
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
        </div>

        {/* Bloco de informações com alinhamento uniforme e espaçamento compacto */}
        <div className="flex flex-col px-2 pt-1.5 pb-2 sm:px-2.5 sm:pt-2 sm:pb-2.5">
          {/* Área de título com altura mínima uniforme para garantir leitura sem cortes */}
          <div className="min-h-[28px] sm:min-h-[32px] flex flex-col justify-start">
            <h3
              title={title}
              className="
                text-[10.5px]
                sm:text-xs
                font-semibold
                leading-[14px]
                sm:leading-[16px]
                tracking-tight
                text-zinc-200
                line-clamp-2
                break-words
                transition-colors
                [@media(hover:hover)]:group-hover:text-purple-300
                group-active:text-purple-300
              "
            >
              {title}
            </h3>
          </div>

          {/* Linha de informações: em Episódios de Hoje exibe o episódio; nas demais linhas exibe ano e tipo sem categorias/gêneros */}
          <div className="mt-px sm:mt-0.5 flex items-center gap-1 text-[9.5px] sm:text-[10px] font-medium text-zinc-400 truncate">
            {anime.todayEpisode?.number ? (
              <span className="font-semibold text-purple-400 truncate">
                Episódio {anime.todayEpisode.number}
              </span>
            ) : (
              <>
                {anime.year && <span className="shrink-0">{anime.year}</span>}
                {anime.year && Boolean(anime.format || (showGenre && anime.genres?.[0])) && (
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
                            : showGenre && anime.genres?.[0]
                              ? anime.genres[0]
                              : ""}
                </span>
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
            inList
              ? "Remover da Minha Lista"
              : "Adicionar à Minha Lista"
          }
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!user) return;
            toggleList(anime, user.id);
          }}
          className={cn(
            "absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-md bg-black/88 border border-white/10 text-white transition-[color,background-color,border-color,opacity] duration-200 [@media(hover:hover)]:hover:border-purple-500/60 [@media(hover:hover)]:hover:bg-purple-950/85 [@media(hover:hover)]:hover:text-purple-300 shadow-md",
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
        <div className="min-h-[28px] sm:min-h-[32px] flex flex-col justify-center gap-1">
          <div className="h-3 w-4/5 animate-pulse rounded bg-elevated/80" />
          <div className="h-2.5 w-3/5 animate-pulse rounded bg-elevated/80" />
        </div>

        <div className="mt-px sm:mt-0.5 h-2.5 w-1/2 animate-pulse rounded bg-elevated/50" />
      </div>
    </div>
  );
}
