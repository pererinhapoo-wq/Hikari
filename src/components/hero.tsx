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

  const mobileBackdrop =
    current.cover || current.banner || "";

  const desktopBackdrop =
    current.banner || current.cover || "";

  useEffect(() => {
    if (animes.length < 2) return;

    const timer = window.setInterval(() => {
      setIndex((currentIndex) => {
        return (currentIndex + 1) % animes.length;
      });
    }, 8000);

    return () => window.clearInterval(timer);
  }, [animes.length]);

  return (
    <section
      className="
        relative
        -mx-4
        overflow-hidden
        bg-bg
        sm:-mx-6
      "
    >
      {/* =====================================================
          BANNER / IMAGEM PRINCIPAL
          ===================================================== */}

      <div
        className="
          relative
          w-full
          overflow-hidden
          bg-bg
          h-[14rem]
          sm:h-[21rem]
          lg:h-[30rem]
        "
      >
        <picture>
          {/* =================================================
              DESKTOP
              Usa exclusivamente o banner horizontal
              ================================================= */}
          <source
            media="(min-width: 1024px)"
            srcSet={desktopBackdrop}
          />

          {/* =================================================
              MOBILE
              Continua usando a capa vertical
              ================================================= */}
          <img
            src={mobileBackdrop}
            alt=""
            aria-hidden="true"
            className="
              absolute
              inset-0
              size-full
              object-contain
              object-center
              lg:hidden
            "
          />
        </picture>

        {/* =================================================
            IMAGEM DESKTOP
            ================================================= */}

        <img
          src={desktopBackdrop}
          alt=""
          aria-hidden="true"
          className="
            absolute
            inset-0
            hidden
            size-full
            object-cover
            object-center
            lg:block
          "
        />

        {/* Gradiente inferior */}
        <div
          className="
            pointer-events-none
            absolute
            inset-x-0
            bottom-0
            h-2/3
            bg-linear-to-t
            from-bg
            via-bg/45
            to-transparent
          "
        />

        {/* Gradiente lateral somente desktop */}
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            hidden
            lg:block
            bg-linear-to-r
            from-bg/85
            via-bg/35
            to-transparent
          "
        />
      </div>

      {/* =====================================================
          CONTEÚDO
          ===================================================== */}

      <div
        className="
          relative
          z-10
          px-4
          pb-3
          pt-1
          sm:px-6
          sm:pb-7
          sm:pt-2
          lg:-mt-48
          lg:px-10
          lg:pb-10
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
            lg:text-xs
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
              lg:max-w-2xl
              lg:text-base
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

        {/* =====================================================
            INDICADORES
            ===================================================== */}

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
