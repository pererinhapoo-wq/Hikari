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

  useEffect(() => {
    if (animes.length < 2) return;

    const timer = window.setInterval(() => {
      const nextIndex = (index + 1) % animes.length;
      const nextAnime = animes[nextIndex];

      const nextBackdrop =
        nextAnime?.cover ||
        nextAnime?.banner ||
        "";

      setVisibleBackdrop(nextBackdrop);
      setIndex(nextIndex);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [animes, index]);

  return (
    <section
      className="
        relative
        -mx-4
        overflow-hidden
        border-b
        border-purple-500/20
        bg-gradient-to-b
        from-[#141026]
        via-[#0d0b18]
        to-[#08070d]
        shadow-[0_12px_36px_rgba(0,0,0,0.8)]
        sm:-mx-6
        sm:border-b-0
        md:mx-0
        md:rounded-3xl
        md:border
        md:border-purple-500/20
        md:bg-gradient-to-r
        md:from-[#110d24]
        md:via-[#0c0a18]
        md:to-[#08070d]
        md:shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_40px_rgba(168,85,247,0.12)]
        md:h-[480px]
        lg:h-[520px]
        md:flex
        md:items-center
      "
    >
      {/* =========================================================
          MOBILE: BANNER COM ARTE CENTRALIZADA E FUNDO ESCURO UNIFORME
          - Sem duplicar nem desfocar a capa do anime
          - Fundo escuro uniforme com degradês laterais discretos
          - Imagem original nítida e proporções 100% preservadas
          ========================================================= */}
      {visibleBackdrop ? (
        <div
          className="
            relative
            w-full
            h-56
            sm:h-72
            overflow-hidden
            bg-[#0d0b18]
            md:hidden
          "
        >
          {/* Brilho ambiente sutil no topo */}
          <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-purple-500/15 blur-3xl z-10" />

          {/* Degradês escuros discretos nas laterais */}
          <div
            className="
              pointer-events-none
              absolute
              inset-y-0
              left-0
              w-12
              sm:w-20
              bg-gradient-to-r
              from-[#0d0b18]
              via-[#0d0b18]/80
              to-transparent
              z-20
            "
          />
          <div
            className="
              pointer-events-none
              absolute
              inset-y-0
              right-0
              w-12
              sm:w-20
              bg-gradient-to-l
              from-[#0d0b18]
              via-[#0d0b18]/80
              to-transparent
              z-20
            "
          />

          {/* Imagem do anime original, centralizada, nítida e com proporções 100% preservadas */}
          <img
            key={`mb-fg-${current.id}`}
            src={mobileBackdrop}
            alt={title}
            loading="eager"
            decoding="async"
            className="
              relative
              z-10
              size-full
              object-contain
              object-center
              py-2.5
              px-2
              drop-shadow-[0_12px_24px_rgba(0,0,0,0.7)]
            "
          />

          {/* Gradiente de transição para o texto abaixo */}
          <div
            className="
              pointer-events-none
              absolute
              inset-x-0
              bottom-0
              h-24
              bg-gradient-to-t
              from-[#0d0b18]
              via-[#0d0b18]/80
              to-transparent
              z-20
            "
          />
        </div>
      ) : (
        <div
          className="
            h-56
            bg-[#0d0b18]
            sm:h-72
            md:hidden
          "
        />
      )}

      {/* =========================================================
          DESKTOP: BANNER COM ARTE À DIREITA E FUSÃO SUAVE
          ========================================================= */}
      {visibleBackdrop && (
        <div
          className="
            hidden
            md:block
            absolute
            inset-0
            pointer-events-none
            overflow-hidden
          "
        >
          {/* Luz ambiente roxa cinematográfica no desktop */}
          <div className="absolute top-1/4 right-1/4 size-80 rounded-full bg-purple-600/20 blur-[100px]" />
          <div className="absolute -bottom-10 right-10 size-72 rounded-full bg-purple-900/25 blur-[90px]" />

          {/* Arte do anime posicionada à direita */}
          <div className="absolute inset-y-0 right-0 w-[64%] lg:w-[58%]">
            <img
              key={`d-${current.id}`}
              src={desktopBackdrop}
              alt=""
              aria-hidden="true"
              loading="eager"
              decoding="async"
              className="
                size-full
                object-cover
                object-center
                md:object-right-top
                transition-all
                duration-700
              "
            />
          </div>

          {/* Gradiente da Esquerda para a Direita (legibilidade das informações) */}
          <div
            className="
              absolute
              inset-0
              bg-gradient-to-r
              from-[#110d24]
              via-[#110d24]/90
              via-30%
              md:via-[#0c0a18]/75
              to-transparent
            "
          />

          {/* Gradientes Inferior e Superior */}
          <div
            className="
              absolute
              inset-x-0
              bottom-0
              h-32
              bg-gradient-to-t
              from-[#08070d]
              to-transparent
            "
          />

          <div
            className="
              absolute
              inset-x-0
              top-0
              h-20
              bg-gradient-to-b
              from-[#110d24]/80
              to-transparent
            "
          />
        </div>
      )}

      {/* =========================================================
          INFORMAÇÕES DO ANIME
          (No mobile: fluxo com espaçamento harmônico abaixo do banner.
           No desktop: sobreposto elegantemente à esquerda)
          ========================================================= */}
      <div
        className="
          relative
          z-20
          px-4
          pt-2
          pb-5
          sm:px-6
          sm:pb-7
          md:max-w-xl
          lg:max-w-2xl
          md:px-10
          lg:px-12
          md:py-10
        "
      >
        {/* Eyebrow em formato de chip sutil com ponto pulsante */}
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-purple-950/70 border border-purple-500/30 text-purple-300 text-[10px] sm:text-xs font-semibold tracking-wider uppercase mb-2 w-fit shadow-[0_0_12px_rgba(168,85,247,0.15)]">
          <span className="size-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_#c084fc]" />
          <span>Em Destaque</span>
        </div>

        {/* Título Principal */}
        <h1
          className="
            font-display
            text-2xl
            leading-tight
            tracking-tight
            text-white
            drop-shadow-md
            sm:text-4xl
            md:text-5xl
            font-bold
            line-clamp-2
          "
        >
          {title}
        </h1>

        {/* Título nativo */}
        {current.titles.native &&
          current.titles.native !== title && (
            <p className="mt-0.5 text-xs text-purple-300/60 drop-shadow sm:text-sm" style={{ fontFamily: '"Noto Sans JP", "Noto Serif JP", sans-serif' }}>
              {current.titles.native}
            </p>
          )}

        {/* Metadados: Nota, Ano, Gêneros */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:mt-3 sm:gap-2">
          {current.score != null && (
            <span
              className="
                inline-flex
                items-center
                gap-1
                rounded-md
                bg-purple-950/80
                border
                border-purple-500/35
                px-2
                py-0.5
                text-xs
                font-bold
                tabular-nums
                text-purple-200
                shadow-[0_0_10px_rgba(168,85,247,0.15)]
              "
            >
              ★ {scoreLabel(current.score)}
            </span>
          )}

          {current.year && (
            <span
              className="
                inline-flex
                items-center
                rounded-md
                bg-white/5
                border
                border-white/10
                px-2
                py-0.5
                text-xs
                font-medium
                text-zinc-300
              "
            >
              {current.year}
            </span>
          )}

          {current.genres.slice(0, 3).map((genre) => (
            <span
              key={genre}
              className="
                inline-flex
                items-center
                rounded-md
                bg-white/5
                border
                border-purple-500/20
                px-2
                py-0.5
                text-[10px]
                sm:text-xs
                font-medium
                text-zinc-300
                transition-colors
                hover:border-purple-500/50
              "
            >
              {genreLabel(genre)}
            </span>
          ))}
        </div>

        {/* Sinopse */}
        {current.synopsis && (
          <p
            className="
              mt-2.5
              max-w-xl
              line-clamp-2
              sm:line-clamp-3
              text-xs
              sm:text-sm
              leading-relaxed
              text-zinc-300/85
              drop-shadow
            "
          >
            {current.synopsis}
          </p>
        )}

        {/* Botões de Ação */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5 sm:mt-5 sm:gap-3">
          <Button
            asChild
            size="sm"
            className="
              h-9
              sm:h-10
              px-4
              sm:px-5
              rounded-xl
              bg-white
              text-zinc-950
              font-semibold
              hover:bg-purple-100
              hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]
              transition-colors
              duration-150
              transform-none
              hover:scale-100
              active:scale-100
            "
          >
            <Link
              to="/watch/$id"
              params={{ id: current.id }}
              preload="intent"
            >
              <Play className="size-3.5 sm:size-4 fill-current" />
              Assistir
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toggleList(current)}
            className="
              h-9
              sm:h-10
              px-3.5
              sm:px-4
              rounded-xl
              bg-zinc-900/80
              border-purple-500/30
              hover:border-purple-500/60
              hover:bg-zinc-800
              hover:shadow-[0_0_14px_rgba(168,85,247,0.2)]
              text-white
              transition-all
              hover:scale-[1.02]
              active:scale-[0.98]
            "
          >
            {inList ? (
              <BookmarkCheck className="size-3.5 sm:size-4 text-purple-400" />
            ) : (
              <Bookmark className="size-3.5 sm:size-4" />
            )}

            <span>
              {inList ? "Na lista" : "Minha Lista"}
            </span>
          </Button>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="
              h-9
              sm:h-10
              px-3.5
              sm:px-4
              rounded-xl
              text-zinc-300
              hover:text-white
              hover:bg-white/5
              transition-all
            "
          >
            <Link
              to="/anime/$id"
              params={{ id: current.id }}
            >
              Detalhes
            </Link>
          </Button>
        </div>

        {/* Indicadores de slides */}
        {animes.length > 1 && (
          <div
            className="
              mt-4
              flex
              items-center
              gap-2
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
                    item.banner ||
                    item.cover ||
                    "";
                  setVisibleBackdrop(nextBackdrop);
                  setIndex(i);
                }}
                className={`
                  h-1.5
                  rounded-full
                  transition-all
                  duration-300
                  ${
                    i === index
                      ? "w-6 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.85)]"
                      : "w-1.5 bg-zinc-700 hover:bg-zinc-500"
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
