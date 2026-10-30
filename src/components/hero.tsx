import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Info, Play } from "lucide-react";

import { displayTitle, type SlimAnime } from "@/lib/types";
import { genreLabel, scoreLabel, seasonLabel, statusLabel } from "@/lib/labels";

export function Hero({
  anime,
  animes = [anime],
}: {
  anime: SlimAnime;
  animes?: SlimAnime[];
}) {
  const [index, setIndex] = useState(0);

  const current = animes[index] ?? anime;

  // Título no idioma original (romaji prioritário, sem traduzir ou substituir)
  const originalTitle =
    current.titles?.romaji?.trim() ||
    current.titles?.native?.trim() ||
    current.titles?.english?.trim() ||
    displayTitle(current);

  /*
   * Resolução de imagens de fundo:
   * No mobile, prioriza capa vertical em alta resolução com enquadramento superior natural.
   * No desktop, prioriza banner horizontal amplo.
   */
  const mobileBackdrop = current.cover || current.banner || "";
  const desktopBackdrop = current.banner || current.cover || "";

  // Imagens do slide anterior para transição suave sem flicker
  const [prevMobileBackdrop, setPrevMobileBackdrop] = useState<string>("");
  const [prevDesktopBackdrop, setPrevDesktopBackdrop] = useState<string>("");

  const preloadedUrls = useRef<Set<string>>(new Set());
  const [isMobileLoaded, setIsMobileLoaded] = useState<boolean>(true);
  const [isDesktopLoaded, setIsDesktopLoaded] = useState<boolean>(true);

  const prevIdRef = useRef<string | number>(current.id);
  const prevMobileRef = useRef<string>(mobileBackdrop);
  const prevDesktopRef = useRef<string>(desktopBackdrop);

  const nextIndex = animes.length > 1 ? (index + 1) % animes.length : -1;
  const nextAnime = nextIndex >= 0 ? animes[nextIndex] : null;

  const nextMobileBackdrop = nextAnime
    ? nextAnime.cover || nextAnime.banner || ""
    : "";
  const nextDesktopBackdrop = nextAnime
    ? nextAnime.banner || nextAnime.cover || ""
    : "";

  useEffect(() => {
    if (prevIdRef.current !== current.id) {
      setPrevMobileBackdrop(prevMobileRef.current);
      setPrevDesktopBackdrop(prevDesktopRef.current);

      const mobileReady = preloadedUrls.current.has(mobileBackdrop);
      const desktopReady = preloadedUrls.current.has(desktopBackdrop);

      setIsMobileLoaded(mobileReady);
      setIsDesktopLoaded(desktopReady);

      prevIdRef.current = current.id;
      prevMobileRef.current = mobileBackdrop;
      prevDesktopRef.current = desktopBackdrop;
    }
  }, [current.id, mobileBackdrop, desktopBackdrop]);

  // Pré-carregamento do próximo slide em background
  useEffect(() => {
    if (typeof window === "undefined" || animes.length < 2 || !nextAnime) return;

    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    const primaryUrl = isDesktop ? nextDesktopBackdrop : nextMobileBackdrop;

    const urlsToPreload = new Set<string>();
    if (primaryUrl) urlsToPreload.add(primaryUrl);
    if (nextMobileBackdrop) urlsToPreload.add(nextMobileBackdrop);
    if (nextDesktopBackdrop) urlsToPreload.add(nextDesktopBackdrop);

    if (urlsToPreload.size === 0) return;

    const activePreloaders: HTMLImageElement[] = [];

    urlsToPreload.forEach((url) => {
      if (preloadedUrls.current.has(url)) return;

      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        preloadedUrls.current.add(url);
      };
      img.onerror = () => {
        preloadedUrls.current.add(url);
      };
      img.src = url;
      activePreloaders.push(img);
    });

    return () => {
      activePreloaders.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
      activePreloaders.length = 0;
    };
  }, [index, animes.length, nextDesktopBackdrop, nextMobileBackdrop, nextAnime]);

  // Rotação automática dos slides (8 segundos)
  useEffect(() => {
    if (animes.length < 2) return;

    const timer = window.setInterval(() => {
      const nextIdx = (index + 1) % animes.length;
      setIndex(nextIdx);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [animes.length, index]);

  // Dados reais formatados para o anime atual
  const scoreValue = current.score != null ? scoreLabel(current.score) : null;

  const seasonValue =
    current.format === "MOVIE"
      ? "Filme"
      : current.season
        ? seasonLabel(current.season, current.year)
        : current.year
          ? `Temporada ${current.year}`
          : "T1";

  const episodesValue =
    current.episodesCount != null
      ? `${current.episodesCount} ${current.episodesCount === 1 ? "Episódio" : "Episódios"}`
      : current.format === "MOVIE"
        ? "Filme único"
        : "Em lançamento";

  const statusText = statusLabel(current.status);

  return (
    <section
      aria-label="Destaque principal"
      className="
        relative
        -mx-4
        overflow-hidden
        bg-black
        border-b
        border-white/5
        shadow-[0_12px_40px_rgba(0,0,0,0.85)]
        sm:-mx-6
        md:mx-0
        md:rounded-3xl
        md:border
        md:border-white/10
        md:shadow-[0_20px_50px_rgba(0,0,0,0.7)]
        min-h-[560px]
        sm:min-h-[620px]
        md:min-h-[560px]
        lg:min-h-[600px]
        flex
        flex-col
        justify-end
      "
    >
      {/* =========================================================
          CAMADA DE IMAGEM AMPLA EM BACKGROUND (CORES E LUZ NATURAIS)
          ========================================================= */}
      <div className="absolute inset-0 size-full pointer-events-none overflow-hidden select-none">
        {/* MOBILE: Imagem ampla ocupando a tela com enquadramento focado nos personagens e cores originais */}
        <div className="relative size-full md:hidden">
          {prevMobileBackdrop &&
            prevMobileBackdrop !== mobileBackdrop &&
            !isMobileLoaded && (
              <img
                src={prevMobileBackdrop}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 size-full object-cover object-top"
              />
            )}
          <img
            key={`m-hero-${current.id}`}
            src={mobileBackdrop}
            alt={originalTitle}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onLoad={() => setIsMobileLoaded(true)}
            onError={() => setIsMobileLoaded(true)}
            className={`
              size-full
              object-cover
              object-top
              transition-opacity
              duration-500
              ${isMobileLoaded ? "opacity-100" : "opacity-0"}
            `}
          />
        </div>

        {/* DESKTOP: Banner horizontal em alta definição */}
        <div className="hidden md:block relative size-full">
          {prevDesktopBackdrop &&
            prevDesktopBackdrop !== desktopBackdrop &&
            !isDesktopLoaded && (
              <img
                src={prevDesktopBackdrop}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 size-full object-cover object-center"
              />
            )}
          <img
            key={`d-hero-${current.id}`}
            src={desktopBackdrop}
            alt={originalTitle}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onLoad={() => setIsDesktopLoaded(true)}
            onError={() => setIsDesktopLoaded(true)}
            className={`
              size-full
              object-cover
              object-center
              transition-opacity
              duration-500
              ${isDesktopLoaded ? "opacity-100" : "opacity-0"}
            `}
          />
        </div>

        {/* GRADIENTE INFERIOR NEUTRO: Limitado estritamente à região dos textos (preto e transparente), sem coloração ou névoa sobre a imagem */}
        <div
          className="
            absolute
            inset-x-0
            bottom-0
            h-[38%]
            sm:h-[35%]
            md:h-[32%]
            bg-gradient-to-t
            from-black
            via-black/50
            via-40%
            to-transparent
          "
        />
      </div>

      {/* =========================================================
          CONTEÚDO CENTRALIZADO E ELEGANTE
          ========================================================= */}
      <div
        className="
          relative
          z-20
          w-full
          max-w-2xl
          mx-auto
          px-4
          pt-28
          pb-6
          sm:px-6
          sm:pb-8
          flex
          flex-col
          items-center
          text-center
          space-y-3
          sm:space-y-3.5
        "
      >
        {/* Título Principal no Idioma Original (sem subtítulo em japonês) */}
        <div className="w-full max-w-xl">
          <h1
            title={originalTitle}
            className="
              font-display
              text-2xl
              sm:text-3xl
              md:text-4xl
              lg:text-5xl
              font-bold
              tracking-tight
              text-white
              leading-tight
              drop-shadow-[0_3px_12px_rgba(0,0,0,0.95)]
              line-clamp-2
            "
          >
            {originalTitle}
          </h1>
        </div>

        {/* Linha Equilibrada: Nota ★ · Temporada · Quantidade de Episódios */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-zinc-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
          {scoreValue && (
            <span className="inline-flex items-center gap-1 text-amber-300">
              <span className="text-amber-400">★</span>
              <span className="tabular-nums font-bold">{scoreValue}</span>
            </span>
          )}

          {scoreValue && (seasonValue || episodesValue) && (
            <span className="size-1 rounded-full bg-zinc-400/60" aria-hidden="true" />
          )}

          {seasonValue && (
            <span className="text-zinc-200">{seasonValue}</span>
          )}

          {seasonValue && episodesValue && (
            <span className="size-1 rounded-full bg-zinc-400/60" aria-hidden="true" />
          )}

          {episodesValue && (
            <span className="text-zinc-300 font-medium">{episodesValue}</span>
          )}
        </div>

        {/* Status da Transmissão */}
        {statusText && (
          <div className="flex items-center justify-center pt-0.5">
            <span
              className="
                inline-flex
                items-center
                gap-1.5
                rounded-lg
                border
                border-emerald-500/35
                bg-emerald-950/50
                px-2.5
                py-1
                text-[10.5px]
                sm:text-xs
                font-bold
                tracking-wider
                uppercase
                text-emerald-300
                shadow-sm
                backdrop-blur-md
              "
            >
              <Check className="size-3 text-emerald-400 stroke-[2.5] shrink-0" />
              <span>{statusText}</span>
            </span>
          </div>
        )}

        {/* Gêneros */}
        {current.genres.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5 max-w-lg">
            {current.genres.slice(0, 4).map((genre) => (
              <span
                key={genre}
                className="
                  rounded-lg
                  border
                  border-white/10
                  bg-black/50
                  px-2.5
                  py-0.5
                  text-[10px]
                  sm:text-[11px]
                  font-semibold
                  uppercase
                  tracking-wider
                  text-zinc-300
                  backdrop-blur-md
                  shadow-xs
                "
              >
                {genreLabel(genre)}
              </span>
            ))}
          </div>
        )}

        {/* Controles de Ação: Botão Assistir compacto com fundo claro & Controle Detalhes discreto sem fundo sólido */}
        <div className="mt-2 flex items-center justify-center gap-2.5 sm:gap-3 w-auto pt-1">
          {/* Botão Assistir (compacto, fundo claro, texto escuro, cantos suaves e ícone discreto) */}
          <Link
            to="/watch/$id"
            params={{ id: current.id }}
            preload="intent"
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              h-9
              sm:h-9.5
              px-4
              sm:px-5
              rounded-lg
              sm:rounded-xl
              bg-white
              hover:bg-zinc-200
              active:bg-zinc-300
              text-zinc-950
              font-semibold
              text-xs
              sm:text-sm
              tracking-wide
              shadow-sm
              transition-all
              duration-150
              cursor-pointer
              active:scale-[0.98]
              select-none
            "
          >
            <Play className="size-3.5 fill-zinc-950 text-zinc-950 shrink-0" />
            <span>Assistir</span>
          </Link>

          {/* Controle Detalhes (sem fundo sólido, texto claro, ícone discreto e pequena seta à direita) */}
          <Link
            to="/anime/$id"
            params={{ id: current.id }}
            className="
              group
              inline-flex
              items-center
              justify-center
              gap-1.5
              h-9
              sm:h-9.5
              px-3
              sm:px-3.5
              rounded-lg
              sm:rounded-xl
              bg-transparent
              hover:bg-white/10
              active:bg-white/15
              text-zinc-200
              hover:text-white
              font-medium
              text-xs
              sm:text-sm
              transition-all
              duration-150
              cursor-pointer
              active:scale-[0.98]
              select-none
            "
          >
            <Info className="size-3.5 text-zinc-400 group-hover:text-zinc-200 shrink-0" />
            <span>Detalhes</span>
            <ChevronRight className="size-3.5 text-zinc-400 group-hover:text-white group-hover:translate-x-0.5 transition-transform shrink-0" />
          </Link>
        </div>

        {/* Indicadores de Slides com Navegação Funcional */}
        {animes.length > 1 && (
          <div
            className="mt-3 flex items-center justify-center gap-2 pt-1 pb-0.5"
            aria-label="Indicadores de destaques"
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
                  duration-300
                  cursor-pointer
                  ${
                    i === index
                      ? "w-7 bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.9)]"
                      : "w-1.5 bg-zinc-700/80 hover:bg-zinc-500"
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
