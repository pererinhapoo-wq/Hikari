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
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2
          className="
            font-display
            text-lg
            tracking-tight
            text-fg
            sm:text-2xl
          "
        >
          {title}
        </h2>

        {href && (
          <Link
            to={href}
            className="
              inline-flex
              min-h-9
              shrink-0
              items-center
              gap-0.5
              rounded-md
              px-1
              text-[10px]
              font-medium
              tracking-wide
              text-muted
              uppercase
              transition-colors
              hover:text-fg
              sm:text-xs
            "
          >
            Ver tudo
            <ChevronRight className="size-3.5" />
          </Link>
        )}
      </div>

      <div
        className="
          rail
          -mx-4
          px-4
          sm:-mx-6
          sm:px-6
        "
      >
        {loading
          ? Array.from({ length: 8 }, (_, i) => (
              <AnimeCardSkeleton key={i} />
            ))
          : items.map((anime) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
              />
            ))}
      </div>
    </section>
  );
}
