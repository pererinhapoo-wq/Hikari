import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import {
  AnimeCard,
  AnimeCardSkeleton,
} from "@/components/anime-card";
import type { SlimAnime } from "@/lib/types";

export function AnimeRow({
  title,
  href,
  items,
  loading,
}: {
  title: string;
  href?: string;
  items: SlimAnime[];
  loading?: boolean;
}) {
  if (!loading && items.length === 0) return null;

  return (
    <section className="space-y-3.5 [content-visibility:auto] [contain-intrinsic-size:auto_250px]">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]" />
          <h2 className="font-display text-lg font-bold tracking-tight text-white sm:text-xl md:text-2xl">
            {title}
          </h2>
        </div>

        {href && (
          <Link
            to={href}
            className="
              group
              inline-flex
              min-h-8
              shrink-0
              items-center
              gap-1
              rounded-lg
              px-2
              py-1
              text-[11px]
              font-semibold
              tracking-wider
              text-purple-400
              uppercase
              transition-colors
              hover:text-purple-300
              hover:bg-purple-500/10
              sm:text-xs
            "
          >
            <span>Ver tudo</span>
            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      <div className="rail -mx-4 gap-2.5 px-4 py-1.5 sm:-mx-6 sm:gap-3.5 sm:px-6 md:gap-4">
        {loading
          ? Array.from({ length: 8 }, (_, i) => (
              <AnimeCardSkeleton key={i} />
            ))
          : items.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
      </div>
    </section>
  );
}
