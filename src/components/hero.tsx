import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Play } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayTitle, type SlimAnime } from "@/lib/types";
import { genreLabel, scoreLabel } from "@/lib/labels";
import { useHikariStore } from "@/lib/store";

export function Hero({
  anime,
  animes = [anime],
}: {
  anime: SlimAnime;
  animes?: SlimAnime[];
}) {
  const [index, setIndex] = useState(0);

  const current = animes[index] ?? anime;
  const title = displayTitle(current);

  const inList = useHikariStore((s) =>
    s.myList.includes(current.id),
  );

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
    <section
      className="
        relative
        -mx-4
        h-[23rem]
        overflow-hidden
        sm:-mx-6
        sm:h-[31rem]
        lg:h-[34rem]
      "
    >
      {/* IMAGEM PRINCIPAL */}
      {backdrop && (
        <div className="absolute inset-x-0 top-0 overflow-hidden">
          <img
            key={current.id}
            src={backdrop}
            alt=""
            aria-hidden="true"
            className="
              block
              h-auto
              w-full
              object-contain
              object-top
            "
          />
        </div>
      )}

      {!backdrop && (
        <div className="absolute inset-0 bg-bg" />
      )}

      {/* DEGRADÊ SUAVE SOBRE A PARTE INFERIOR */}
      <div
        className="
          absolute inset-x-0 bottom-0
          h-[65%]
          bg-linear-to-t
          from-bg
          via-bg/75
          to-transparent
        "
      />

      {/* DEGRADÊ LATERAL SUAVE */}
      <div
        className="
          absolute inset-0
          bg-linear-to-r
          from-bg/25
          via-transparent
          to-transparent
        "
      />

      {/* CONTEÚDO */}
      <div
        className="
          relative z-10
          flex h-full flex-col justify-end
          px-4 pb-3
          sm:px-6 sm:pb-7
        "
      >
        <p
          className="
            text-[8px]
            font-medium
            tracking-[0.2em]
            text-muted
            uppercase
            sm:text-[9px]
          "
        >
          Em destaque
        </p>

        <h1
          className="
            mt-0.5
            max-w-2xl
            line-clamp-2
            font-display
            text-[1.65rem]
            leading-tight
            tracking-tight
            text-fg
            sm:text-4xl
            lg:text-5xl
          "
        >
          {title}
        </h1>

        {current.titles.native &&
          current.titles.native !== title && (
            <p className="mt-0.5 hidden font-display text-sm text-muted sm:block">
              {current.titles.native}
            </p>
          )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {current.score != null && (
            <span className="text-xs font-medium tabular-nums text-score sm:text-sm">
              {scoreLabel(current.score)}
            </span>
          )}

          {current.year && (
            <span className="text-xs text-muted sm:text-sm">
              {current.year}
            </span>
          )}

          {current.genres.slice(0, 2).map((genre) => (
            <Badge
              key={genre}
              className="text-[9px] sm:text-xs"
            >
              {genreLabel(genre)}
            </Badge>
          ))}
        </div>

        {current.synopsis && (
          <p
            className="
              mt-1.5
              max-w-xl
              line-clamp-2
              text-[10px]
              leading-snug
              text-muted
              sm:mt-4
              sm:line-clamp-3
              sm:text-sm
            "
          >
            {current.synopsis}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
          <Button asChild size="sm">
            <Link
              to="/watch/$id"
              params={{ id: current.id }}
            >
              <Play className="size-3.5 sm:size-4" />
              Assistir
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toggleList(current)}
          >
            {inList ? (
              <BookmarkCheck className="size-3.5 sm:size-4" />
            ) : (
              <Bookmark className="size-3.5 sm:size-4" />
            )}

            <span className="hidden sm:inline">
              {inList ? "Na lista" : "Minha Lista"}
            </span>
          </Button>

          <Button
            asChild
            variant="ghost"
            size="sm"
          >
            <Link
              to="/anime/$id"
              params={{ id: current.id }}
            >
              Detalhes
            </Link>
          </Button>
        </div>

        {animes.length > 1 && (
          <div
            className="
              mt-2.5
              flex
              items-center
              gap-1.5
              sm:mt-3
            "
            aria-label="Destaques"
          >
            {animes.map((item, i) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Mostrar destaque ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`
                  h-1.5
                  rounded-full
                  transition-all
                  ${
                    i === index
                      ? "w-5 bg-fg"
                      : "w-1.5 bg-fg/40"
                  }
                `}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
        }
