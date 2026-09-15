import { Link } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { displayTitle, type SlimAnime } from "@/lib/types";
import { genreLabel, scoreLabel } from "@/lib/labels";
import { useHikariStore } from "@/lib/store";

export function Hero({ anime }: { anime: SlimAnime }) {
  const title = displayTitle(anime);
  const inList = useHikariStore((s) => s.myList.includes(anime.id));
  const toggleList = useHikariStore((s) => s.toggleList);
  const backdrop = anime.banner || anime.cover;

  return (
    <section className="relative -mx-4 min-h-[28rem] overflow-hidden sm:-mx-6 sm:min-h-[34rem] lg:min-h-[38rem]">
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/70 to-bg/20" />
      <div className="absolute inset-0 bg-linear-to-r from-bg/90 via-bg/40 to-transparent" />
      <div className="relative z-10 flex min-h-[28rem] flex-col justify-end px-4 pb-8 sm:min-h-[34rem] sm:px-6 sm:pb-10 lg:min-h-[38rem]">
        <p className="text-[11px] font-medium tracking-[0.28em] text-muted uppercase">Em destaque</p>
        <h1 className="mt-2 max-w-2xl font-display text-4xl leading-tight tracking-tight text-fg sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {anime.titles.native && anime.titles.native !== title && (
          <p className="mt-1 font-display text-sm text-muted">{anime.titles.native}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {anime.score != null && (
            <span className="text-sm font-medium tabular-nums text-score">
              {scoreLabel(anime.score)}
            </span>
          )}
          {anime.year && <span className="text-sm text-muted">{anime.year}</span>}
          {anime.genres.slice(0, 3).map((g) => (
            <Badge key={g}>{genreLabel(g)}</Badge>
          ))}
        </div>
        {anime.synopsis && (
          <p className="mt-4 max-w-xl line-clamp-3 text-sm leading-relaxed text-muted">
            {anime.synopsis}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link to="/watch/$id" params={{ id: anime.id }}>
              <Play className="size-4" />
              Assistir
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => toggleList(anime)}
          >
            {inList ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
            {inList ? "Na lista" : "Minha Lista"}
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link to="/anime/$id" params={{ id: anime.id }}>
              Detalhes
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
