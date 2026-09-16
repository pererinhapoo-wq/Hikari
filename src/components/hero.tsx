import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { displayTitle, type SlimAnime } from "@/lib/types";
import { genreLabel, scoreLabel } from "@/lib/labels";
import { useHikariStore } from "@/lib/store";

export function Hero({ anime, animes = [anime] }: { anime: SlimAnime; animes?: SlimAnime[] }) {
  const [index, setIndex] = useState(0);
  const current = animes[index] ?? anime;
  const title = displayTitle(anime);
  const inList = useHikariStore((s) => s.myList.includes(current.id));
  const toggleList = useHikariStore((s) => s.toggleList);
  const backdrop = current.banner || current.cover;

  useEffect(() => {
    if (animes.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % animes.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [animes.length]);

  return (
    <section className="relative -mx-4 h-[8rem] overflow-hidden sm:-mx-6 sm:h-[22rem] lg:h-[27rem]">
      {backdrop && (
        <img
          key={current.id}
          src={backdrop}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/70 to-bg/20" />
      <div className="absolute inset-0 bg-linear-to-r from-bg/90 via-bg/40 to-transparent" />
      <div className="relative z-10 flex h-full flex-col justify-end px-4 pb-3 sm:px-6 sm:pb-6">
        <p className="text-[9px] font-medium tracking-[0.22em] text-muted uppercase">Em destaque</p>
        <h1 className="mt-0.5 max-w-2xl line-clamp-2 font-display text-base leading-tight tracking-tight text-fg sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {current.titles.native && current.titles.native !== title && (
          <p className="mt-1 hidden font-display text-sm text-muted sm:block">{current.titles.native}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {current.score != null && (
            <span className="text-sm font-medium tabular-nums text-score">
              {scoreLabel(current.score)}
            </span>
          )}
          {current.year && <span className="text-sm text-muted">{current.year}</span>}
          {current.genres.slice(0, 3).map((g) => (
            <Badge key={g}>{genreLabel(g)}</Badge>
          ))}
        </div>
        {current.synopsis && (
          <p className="mt-1 max-w-xl line-clamp-1 text-[11px] leading-snug text-muted sm:mt-4 sm:line-clamp-3 sm:text-sm">
            {anime.synopsis}
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-1 sm:mt-4">
          <Button asChild size="sm">
            <Link to="/watch/$id" params={{ id: current.id }}>
              <Play className="size-4" />
              Assistir
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toggleList(current)}
          >
            {inList ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
            {inList ? "Na lista" : "Minha Lista"}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/anime/$id" params={{ id: current.id }}>
              Detalhes
            </Link>
          </Button>
        </div>
        {animes.length > 1 && (
          <div className="mt-1.5 flex items-center gap-1.5" aria-label="Destaques">
            {animes.map((item, i) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Mostrar destaque ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-fg" : "w-1.5 bg-fg/40"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
