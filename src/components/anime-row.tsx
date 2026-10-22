import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  Star,
  Trophy,
  Calendar,
} from "lucide-react";
import { useRef } from "react";

import {
  AnimeCard,
  AnimeCardSkeleton,
} from "@/components/anime-card";
import type { SlimAnime } from "@/lib/types";

export function AnimeRow({
  title,
  eyebrow,
  tag,
  iconType,
  href,
  items,
  loading,
  showRank = false,
}: {
  title: string;
  eyebrow?: string;
  tag?: string;
  iconType?: "flame" | "calendar" | "sparkles" | "trophy" | "star";
  href?: string;
  items: SlimAnime[];
  loading?: boolean;
  showRank?: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  if (!loading && items.length === 0) return null;

  const scroll = (direction: "left" | "right") => {
    if (!railRef.current) return;
    const distance = railRef.current.clientWidth * 0.75;
    railRef.current.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  const renderIcon = () => {
    switch (iconType) {
      case "flame":
        return <Flame className="size-3.5 text-amber-400" />;
      case "calendar":
        return <Calendar className="size-3.5 text-purple-400" />;
      case "trophy":
        return <Trophy className="size-3.5 text-amber-300" />;
      case "star":
        return <Star className="size-3.5 text-purple-300 fill-purple-400/30" />;
      case "sparkles":
      default:
        return <Sparkles className="size-3.5 text-purple-400" />;
    }
  };

  return (
    <section className="space-y-3.5 sm:space-y-4 [content-visibility:auto] [contain-intrinsic-size:auto_260px]">
      {/* Cabeçalho da Seção Renovado e Elegante */}
      <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          {/* Eyebrow / Tag Temática */}
          {eyebrow && (
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold tracking-widest text-purple-400 uppercase">
              <span className="flex items-center justify-center size-4 rounded-full bg-purple-950/90 border border-purple-500/30">
                {renderIcon()}
              </span>
              <span>{eyebrow}</span>
              {tag && (
                <>
                  <span className="size-1 rounded-full bg-purple-500/40" />
                  <span className="text-zinc-400 font-medium normal-case tracking-normal">
                    {tag}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Título com Tipografia Cinzel Elegante */}
          <div className="flex items-center gap-2.5">
            {!eyebrow && (
              <span className="inline-block size-2 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]" />
            )}
            <h2 className="font-section text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white drop-shadow-sm">
              {title}
            </h2>
            <span className="hidden sm:inline-flex rounded-full bg-purple-950/50 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300/80">
              {items.length} títulos
            </span>
          </div>
        </div>

        {/* Controles: Setas de rolagem para desktop + Botão Ver Tudo */}
        <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0">
          {/* Controles de Navegação por trilho no Desktop */}
          <div className="hidden md:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Rolar para a esquerda"
              className="
                flex
                size-8
                items-center
                justify-center
                rounded-lg
                bg-white/5
                border
                border-white/10
                text-zinc-300
                transition-all
                hover:bg-purple-950/60
                hover:border-purple-500/40
                hover:text-white
                active:scale-95
              "
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Rolar para a direita"
              className="
                flex
                size-8
                items-center
                justify-center
                rounded-lg
                bg-white/5
                border
                border-white/10
                text-zinc-300
                transition-all
                hover:bg-purple-950/60
                hover:border-purple-500/40
                hover:text-white
                active:scale-95
              "
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {href && (
            <Link
              to={href}
              className="
                group
                inline-flex
                h-8
                items-center
                gap-1.5
                rounded-lg
                bg-purple-950/40
                border
                border-purple-500/25
                px-3
                py-1
                text-[11px]
                sm:text-xs
                font-semibold
                tracking-wider
                text-purple-300
                transition-all
                duration-200
                hover:bg-purple-900/50
                hover:border-purple-400/50
                hover:text-white
                hover:shadow-[0_0_12px_rgba(168,85,247,0.25)]
              "
            >
              <span>Ver tudo</span>
              <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Trilho de Cards */}
      <div
        ref={railRef}
        className="rail -mx-4 scroll-smooth gap-2.5 px-4 py-2 sm:-mx-6 sm:gap-3.5 sm:px-6 md:gap-4"
      >
        {loading
          ? Array.from({ length: 8 }, (_, i) => (
              <AnimeCardSkeleton key={i} />
            ))
          : items.map((anime, index) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                rank={showRank ? index + 1 : undefined}
              />
            ))}
      </div>
    </section>
  );
}
