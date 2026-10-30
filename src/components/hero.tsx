import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Info, Play } from "lucide-react";

import { displayTitle, type SlimAnime } from "@/lib/types";
import { genreLabel, scoreLabel, seasonLabel, statusLabel } from "@/lib/labels";
import { getAnimeLogo } from "@/lib/anime-logos";

interface HeroSlideProps {
  anime: SlimAnime;
  priority?: boolean;
}

function HeroSlide({ anime, priority = false }: HeroSlideProps) {
  const originalTitle =
    anime.titles?.romaji?.trim() ||
    anime.titles?.native?.trim() ||
    anime.titles?.english?.trim() ||
    displayTitle(anime);

  const logoConfig = getAnimeLogo(anime);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [anime.id]);

  const mobileBackdrop = anime.cover || anime.banner || "";
  const desktopBackdrop = anime.banner || anime.cover || "";

  const scoreValue = anime.score != null ? scoreLabel(anime.score) : null;
  const seasonValue =
    anime.format === "MOVIE"
      ? "Filme"
      : anime.season
        ? seasonLabel(anime.season, anime.year)
        : anime.year
          ? `Temporada ${anime.year}`
          : "T1";

  const episodesValue =
    anime.episodesCount != null
      ? `${anime.episodesCount} ${anime.episodesCount === 1 ? "Episódio" : "Episódios"}`
      : anime.format === "MOVIE"
        ? "Filme único"
        : "Em lançamento";

  const statusText = statusLabel(anime.status);
  const isAiring =
    anime.status === "RELEASING" ||
    anime.status?.toLowerCase() === "airing" ||
    anime.status?.toLowerCase() === "currently_airing" ||
    Boolean(statusText?.toLowerCase().includes("exibi")) ||
    Boolean(statusText?.toLowerCase().includes("lança"));

  return (
    <div className="relative size-full min-w-full shrink-0 flex flex-col justify-end select-none overflow-hidden min-h-[560px] sm:min-h-[620px] md:min-h-[560px] lg:min-h-[600px]">
      {/* CAMADA DE IMAGEM AMPLA EM BACKGROUND (CORES E LUZ NATURAIS) */}
      <div className="absolute inset-0 size-full pointer-events-none overflow-hidden select-none">
        {/* MOBILE: Imagem ampla ocupando a tela com enquadramento focado nos personagens e cores originais */}
        <div className="relative size-full md:hidden">
          <img
            src={mobileBackdrop}
            alt={originalTitle}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            className="size-full object-cover object-top"
          />
        </div>

        {/* DESKTOP: Banner horizontal em alta definição */}
        <div className="hidden md:block relative size-full">
          <img
            src={desktopBackdrop}
            alt={originalTitle}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            className="size-full object-cover object-center"
          />
        </div>

        {/* GRADIENTE INFERIOR NEUTRO: Limitado estritamente à região dos textos */}
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

      {/* CONTEÚDO CENTRALIZADO E ELEGANTE */}
      <div
        className="
          relative
          z-20
          w-full
          max-w-2xl
          mx-auto
          px-4
          pt-28
          pb-8
          sm:px-6
          sm:pb-10
          flex
          flex-col
          items-center
          text-center
          space-y-3
          sm:space-y-3.5
        "
      >
        {/* Título Principal: Logotipo Oficial ou Fallback Tipográfico */}
        <div className="w-full max-w-xl flex flex-col items-center justify-center min-h-[50px] sm:min-h-[64px] md:min-h-[76px]">
          {logoConfig && !logoFailed ? (
            <div className="flex items-center justify-center w-full px-2">
              <h1 className="sr-only">{originalTitle}</h1>
              <img
                src={logoConfig.src}
                alt={logoConfig.alt || originalTitle}
                title={originalTitle}
                loading={priority ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={priority ? "high" : "auto"}
                onError={() => setLogoFailed(true)}
                className={`
                  w-auto
                  object-contain
                  select-none
                  pointer-events-none
                  drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]
                  filter
                  transition-all
                  duration-200
                  ${logoConfig.sizeClasses}
                `}
              />
            </div>
          ) : (
            <h1
              title={originalTitle}
              className="
                font-display
                text-xl
                sm:text-2xl
                md:text-3xl
                lg:text-4xl
                font-bold
                tracking-tight
                text-white
                leading-snug
                drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]
                line-clamp-2
              "
            >
              {originalTitle}
            </h1>
          )}
        </div>

        {/* Linha Equilibrada: Nota ★ · Temporada · Quantidade de Episódios */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-[13px] font-medium text-zinc-300 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
          {scoreValue && (
            <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
              <span className="text-amber-400 text-xs sm:text-[13px]">★</span>
              <span className="tabular-nums">{scoreValue}</span>
            </span>
          )}

          {scoreValue && (seasonValue || episodesValue) && (
            <span className="size-1 rounded-full bg-white/25 shrink-0" aria-hidden="true" />
          )}

          {seasonValue && (
            <span className="text-zinc-200">{seasonValue}</span>
          )}

          {seasonValue && episodesValue && (
            <span className="size-1 rounded-full bg-white/25 shrink-0" aria-hidden="true" />
          )}

          {episodesValue && (
            <span className="text-zinc-300/90">{episodesValue}</span>
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
                rounded-md
                border
                border-white/10
                bg-black/40
                px-2.5
                py-0.5
                text-[10px]
                sm:text-[11px]
                font-semibold
                tracking-wider
                uppercase
                text-zinc-200
                backdrop-blur-md
                shadow-xs
              "
            >
              {isAiring && (
                <span
                  className="relative flex size-2 items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] motion-safe:animate-pulse motion-reduce:animate-none" />
                </span>
              )}
              <span>{statusText}</span>
            </span>
          </div>
        )}

        {/* Gêneros */}
        {anime.genres.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5 max-w-lg">
            {anime.genres.slice(0, 4).map((genre) => (
              <span
                key={genre}
                className="
                  rounded-md
                  border
                  border-white/10
                  bg-black/35
                  px-2
                  py-0.5
                  text-[10px]
                  sm:text-[11px]
                  font-medium
                  uppercase
                  tracking-wide
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

        {/* Controles de Ação */}
        <div className="mt-2 flex items-center justify-center gap-2.5 sm:gap-3 w-auto pt-1">
          {/* Botão Assistir */}
          <Link
            to="/watch/$id"
            params={{ id: anime.id }}
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

          {/* Controle Detalhes */}
          <Link
            to="/anime/$id"
            params={{ id: anime.id }}
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
      </div>
    </div>
  );
}

export function Hero({
  anime,
  animes = [anime],
}: {
  anime: SlimAnime;
  animes?: SlimAnime[];
}) {
  const items = (animes.length > 0 ? animes : [anime]).slice(0, 8);
  const total = items.length;

  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [transitionState, setTransitionState] = useState<
    "idle" | "to-next" | "to-prev" | "cancelling"
  >("idle");

  const containerRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const pointerState = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    startTime: number;
    isLockedHorizontal: boolean;
    isLockedVertical: boolean;
    hasMoved: boolean;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    isLockedHorizontal: false,
    isLockedVertical: false,
    hasMoved: false,
  });

  const timerRef = useRef<number | null>(null);

  // Pré-carregamento das imagens em background para transições instantâneas
  useEffect(() => {
    if (typeof window === "undefined" || items.length === 0) return;
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;

    items.forEach((item) => {
      const primaryUrl = isDesktop
        ? item.banner || item.cover
        : item.cover || item.banner;
      const secondaryUrl = isDesktop
        ? item.cover || item.banner
        : item.banner || item.cover;

      if (primaryUrl) {
        const img = new Image();
        img.decoding = "async";
        img.src = primaryUrl;
      }
      if (secondaryUrl && secondaryUrl !== primaryUrl) {
        const img = new Image();
        img.decoding = "async";
        img.src = secondaryUrl;
      }
    });
  }, [items]);

  const triggerTransition = useCallback(
    (target: "to-next" | "to-prev" | "cancelling") => {
      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReduced) {
        if (target === "to-next") {
          setIndex((prev) => (prev + 1) % total);
        } else if (target === "to-prev") {
          setIndex((prev) => (prev - 1 + total) % total);
        }
        setTransitionState("idle");
        setDragOffset(0);
        setIsDragging(false);
        if (trackRef.current) {
          trackRef.current.style.transition = "none";
          trackRef.current.style.transform = "translate3d(-100%, 0, 0)";
        }
        return;
      }

      setIsDragging(false);
      setTransitionState(target);
    },
    [total]
  );

  // Reinicia o temporizador automático de 8 segundos
  const resetAutoTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (total < 2) return;

    timerRef.current = window.setInterval(() => {
      if (!pointerState.current.active) {
        triggerTransition("to-next");
      }
    }, 8000);
  }, [total, triggerTransition]);

  // Efeito do temporizador automático: reinicia sempre que o índice muda
  useEffect(() => {
    resetAutoTimer();
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [resetAutoTimer, index]);

  // Timeout de segurança para garantir a resolução da transição mesmo com abas inativas
  useEffect(() => {
    if (transitionState === "idle") return;

    const timeoutMs = transitionState === "cancelling" ? 550 : 1050;
    const safetyTimer = window.setTimeout(() => {
      if (transitionState === "to-next") {
        setIndex((prev) => (prev + 1) % total);
      } else if (transitionState === "to-prev") {
        setIndex((prev) => (prev - 1 + total) % total);
      }
      setTransitionState("idle");
      setDragOffset(0);
      setIsDragging(false);
      if (trackRef.current) {
        trackRef.current.style.transition = "none";
        trackRef.current.style.transform = "translate3d(-100%, 0, 0)";
      }
    }, timeoutMs);

    return () => window.clearTimeout(safetyTimer);
  }, [transitionState, total]);

  // Manipulação de eventos de ponteiro para arrastar com os dedos ou mouse
  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (total < 2 || e.button !== 0 || transitionState !== "idle") return;

    pointerState.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      isLockedHorizontal: false,
      isLockedVertical: false,
      hasMoved: false,
    };

    resetAutoTimer();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const state = pointerState.current;
    if (!state.active || state.pointerId !== e.pointerId || state.isLockedVertical) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    if (!state.isLockedHorizontal) {
      if (Math.hypot(dx, dy) > 7) {
        if (Math.abs(dy) > Math.abs(dx)) {
          state.isLockedVertical = true;
          return;
        }
        state.isLockedHorizontal = true;
        state.hasMoved = true;
        setIsDragging(true);

        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
    }

    if (state.isLockedHorizontal) {
      setDragOffset(dx);
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLElement>) => {
    const state = pointerState.current;
    if (!state.active || state.pointerId !== e.pointerId) return;

    state.active = false;
    state.pointerId = null;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    if (state.isLockedHorizontal) {
      const containerWidth = containerRef.current?.offsetWidth || 390;
      const threshold = Math.max(45, containerWidth * 0.15);
      const elapsed = Date.now() - state.startTime;
      const isQuickSwipe = elapsed < 280 && Math.abs(dragOffset) > 25;

      if (dragOffset < -threshold || (isQuickSwipe && dragOffset < 0)) {
        triggerTransition("to-next");
      } else if (dragOffset > threshold || (isQuickSwipe && dragOffset > 0)) {
        triggerTransition("to-prev");
      } else {
        triggerTransition("cancelling");
      }
    } else {
      setIsDragging(false);
      setDragOffset(0);
    }

    resetAutoTimer();
  };

  // Previne clique inadvertido em links ou botões após arrastar
  const handleClickCapture = (e: React.MouseEvent) => {
    if (pointerState.current.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      pointerState.current.hasMoved = false;
    }
  };

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== trackRef.current || e.propertyName !== "transform") return;

    if (transitionState === "to-next") {
      setIndex((prev) => (prev + 1) % total);
    } else if (transitionState === "to-prev") {
      setIndex((prev) => (prev - 1 + total) % total);
    }

    if (trackRef.current) {
      trackRef.current.style.transition = "none";
      trackRef.current.style.transform = "translate3d(-100%, 0, 0)";
    }

    setTransitionState("idle");
    setDragOffset(0);
    setIsDragging(false);
  };

  // Cálculo da posição da esteira (track)
  const getTrackTransform = () => {
    if (isDragging) {
      return `translate3d(calc(-100% + ${dragOffset}px), 0, 0)`;
    }
    if (transitionState === "to-next") {
      return "translate3d(-200%, 0, 0)";
    }
    if (transitionState === "to-prev") {
      return "translate3d(0%, 0, 0)";
    }
    if (transitionState === "cancelling") {
      return "translate3d(-100%, 0, 0)";
    }
    return "translate3d(-100%, 0, 0)";
  };

  // Duração fluida de 900ms com curva natural de desaceleração (easeOutQuart)
  const getTrackTransition = () => {
    if (isDragging) {
      return "none";
    }
    if (transitionState === "to-next" || transitionState === "to-prev") {
      return "transform 900ms cubic-bezier(0.25, 1, 0.5, 1)";
    }
    if (transitionState === "cancelling") {
      return "transform 450ms cubic-bezier(0.25, 1, 0.5, 1)";
    }
    return "none";
  };

  if (total <= 1) {
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
        <HeroSlide anime={items[0]} priority />
      </section>
    );
  }

  const prevIndex = (index - 1 + total) % total;
  const nextIndex = (index + 1) % total;

  return (
    <section
      aria-label="Destaque principal"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onClickCapture={handleClickCapture}
      style={{ touchAction: "pan-y" }}
      className={`
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
        select-none
        touch-pan-y
        ${isDragging ? "cursor-grabbing" : "cursor-grab"}
      `}
    >
      <div
        ref={trackRef}
        className="flex size-full will-change-transform"
        style={{
          transform: getTrackTransform(),
          transition: getTrackTransition(),
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        <HeroSlide key={`prev-${items[prevIndex].id}`} anime={items[prevIndex]} />
        <HeroSlide key={`curr-${items[index].id}`} anime={items[index]} priority />
        <HeroSlide key={`next-${items[nextIndex].id}`} anime={items[nextIndex]} />
      </div>
    </section>
  );
}
