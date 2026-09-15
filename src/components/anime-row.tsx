import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { AnimeCard, AnimeCardSkeleton } from "@/components/anime-card";
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
      <div className="flex items-end justify-between gap-3 px-1">
        <h2 className="font-display text-xl tracking-tight text-fg sm:text-2xl">{title}</h2>
        {href && (
          <Link
            to={href}
            className="inline-flex min-h-11 items-center gap-0.5 text-xs font-medium tracking-wide text-muted uppercase hover:text-fg"
          >
            Ver tudo
            <ChevronRight className="size-3.5" />
          </Link>
        )}
      </div>
      <div className="rail -mx-4 px-4 sm:-mx-6 sm:px-6">
        {loading
          ? Array.from({ length: 8 }, (_, i) => <AnimeCardSkeleton key={i} />)
          : items.map((a) => <AnimeCard key={a.id} anime={a} />)}
      </div>
    </section>
  );
}
