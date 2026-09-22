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

  const [visibleBackdrop, setVisibleBackdrop] = useState(
    anime.cover || anime.banner || "",
  );

  const [isLandscape, setIsLandscape] = useState(false);

  const [imageRatio, setImageRatio] = useState<number | null>(
    null,
  );

  const current = animes[index] ?? anime;
  const title = displayTitle(current);

  const inList = useHikariStore((s) =>
    s.myList.includes(current.id),
  );

  const toggleList = useHikariStore((s) => s.toggleList);

  /*
   * MOBILE:
   * mantém a capa vertical como prioridade.
   *
   * DESKTOP:
   * usa o banner horizontal quando o anime possuir um banner.
   */
  const mobileBackdrop =
    current.cover || current.banner || "";

  const desktopBackdrop =
    current.banner || current.cover || "";

  function loadBackdrop(
    url: string,
    onLoaded?: () => void,
  ) {
    if (!url) {
      setImageRatio(null);
      setIsLandscape(false);
      onLoaded?.();
      return;
    }

    const image = new Image();

    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;

      if (width > 0 && height > 0) {
        setIsLandscape(width > height);
        setImageRatio(width / height);
      }

      onLoaded?.();
    };

    image.src = url;
  }

  useEffect(() => {
    loadBackdrop(visibleBackdrop);
  }, [visibleBackdrop]);

  useEffect(() => {
    if (animes.length < 2) return;

    const timer = window.setInterval(() => {
      const nextIndex = (index + 1) % animes.length;
      const nextAnime = animes[nextIndex];

      const nextBackdrop =
        nextAnime?.cover ||
        nextAnime?.banner ||
        "";

      if (!nextBackdrop) {
        setIndex(nextIndex);
        return;
      }

      const image = new Image();

      image.onload = () => {
        const width = image.naturalWidth;
        const height = image.naturalHeight;

        if (width > 0 && height > 0) {
          setIsLandscape(width > height);
          setImageRatio(width / height);
        }

        setVisibleBackdrop(nextBackdrop);
        setIndex(nextIndex);
      };

      image.src = nextBackdrop;
    }, 8000);

    return () => window.clearInterval(timer);
  }, [animes, index]);

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
      {/* IMAGEM PRINCIPAL */}
      {visibleBackdrop ? (
        <div
          className="
            relative
            w-full
            overflow-hidden
            bg-bg
            h-[14rem]
            sm:h-[21rem]
            md:h-[21rem]
          "
          style={
            !isLandscape && imageRatio
              ? undefined
              : undefined
          }
        >
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
              md:hidden
            "
          />

          {/* =================================================
              DESKTOP
              Usa o banner horizontal
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
              md:block
            "
          />

          {/* TRANSIÇÃO SUAVE */}
          <div
            className="
              pointer-events-none
              absolute
              inset-x-0
              bottom-0
              h-1/2
              bg-linear-to-t
              from-bg
              via-bg/40
              to-transparent
            "
          />

          {/* ESCURECIMENTO LATERAL NO DESKTOP */}
          <div
            className="
              pointer-events-none
              absolute
              inset-0
              hidden
              md:block
              bg-linear-to-r
              from-bg/80
              via-bg/20
              to-transparent
            "
          />
        </div>
      ) : (
        <div
          className="
            h-[14rem]
            bg-bg
            sm:h-[21rem]
            md:h-[21rem]
          "
        />
      )}

      {/* CONTEÚDO */}
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
          md:-mt-32
          md:px-10
          md:pb-10
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
            md:text-xs
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
            md:text-5xl
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
              md:max-w-2xl
              md:text-base
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
                onClick={() => {
                  if (i === index) return;

                  const nextBackdrop =
                    item.cover ||
                    item.banner ||
                    "";

                  if (!nextBackdrop) {
                    setIndex(i);
                    return;
                  }

                  const image = new Image();

                  image.onload = () => {
                    const width = image.naturalWidth;
                    const height = image.naturalHeight;

                    if (width > 0 && height > 0) {
                      setIsLandscape(width > height);
                      setImageRatio(width / height);
                    }

                    setVisibleBackdrop(nextBackdrop);
                    setIndex(i);
                  };

                  image.src = nextBackdrop;
                }}
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
