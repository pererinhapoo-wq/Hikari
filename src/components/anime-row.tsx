import { Link, useRouter } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  Star,
  Trophy,
  Calendar,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  startTransition,
  type RefObject,
} from "react";

import {
  AnimeCard,
  AnimeCardSkeleton,
} from "@/components/anime-card";
import type { SlimAnime } from "@/lib/types";

function getInitialRailLimit(): number {
  if (typeof window === "undefined") return 3;
  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(min-width: 768px)").matches ? 4 : 3;
  }
  return window.innerWidth >= 768 ? 4 : 3;
}

export function useHorizontalRailImageLimit(
  railRef: RefObject<HTMLDivElement | null>,
  totalCount: number,
  itemStridePx?: number,
  initialCount?: number,
  resetKey?: string,
) {
  const [limit, setLimit] = useState(() =>
    Math.min(totalCount, initialCount ?? getInitialRailLimit()),
  );
  const prevResetKeyRef = useRef(resetKey);

  // Cache para o passo (largura do card + gap) e largura visível do container
  // Elimina Layout Thrashing (offsetWidth, getComputedStyle, querySelector) durante os frames de rolagem
  const cachedStrideRef = useRef<number | null>(
    itemStridePx && itemStridePx > 0 ? itemStridePx : null,
  );
  const cachedClientWidthRef = useRef<number>(0);

  if (prevResetKeyRef.current !== resetKey) {
    prevResetKeyRef.current = resetKey;
    cachedStrideRef.current =
      itemStridePx && itemStridePx > 0 ? itemStridePx : null;
    cachedClientWidthRef.current = 0;
    setLimit(Math.min(totalCount, initialCount ?? getInitialRailLimit()));
  }

  // Medição segura das dimensões reais do layout fora do evento de rolagem
  const measureLayout = useCallback(() => {
    const el = railRef.current;
    const isDesktop =
      typeof window !== "undefined" &&
      (window.matchMedia
        ? window.matchMedia("(min-width: 768px)").matches
        : window.innerWidth >= 768);

    if (el) {
      cachedClientWidthRef.current = el.clientWidth;
    }

    if (itemStridePx && itemStridePx > 0) {
      cachedStrideRef.current = itemStridePx;
      return itemStridePx;
    }

    if (!el) {
      const fallback = isDesktop ? 158 : 116;
      cachedStrideRef.current = fallback;
      return fallback;
    }

    const firstCard = el.querySelector("article");
    const cardWidth =
      firstCard && firstCard.offsetWidth > 0
        ? firstCard.offsetWidth
        : isDesktop
          ? 142
          : 106;

    let computedGap = 0;
    if (typeof window !== "undefined") {
      try {
        computedGap =
          parseFloat(window.getComputedStyle(el).gap) || (isDesktop ? 16 : 10);
      } catch {
        computedGap = isDesktop ? 16 : 10;
      }
    } else {
      computedGap = 12;
    }

    const stride = cardWidth + computedGap;
    const safeStride = stride > 0 ? stride : isDesktop ? 158 : 116;
    cachedStrideRef.current = safeStride;
    return safeStride;
  }, [railRef, itemStridePx]);

  // Mantém a medição sincronizada com mudanças de tamanho da tela/container sem executar no scroll
  useEffect(() => {
    if (typeof window === "undefined") return;

    const el = railRef.current;
    if (!el) return;

    measureLayout();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        measureLayout();
      });
      resizeObserver.observe(el);
    }

    const handleWindowResize = () => {
      measureLayout();
    };

    window.addEventListener("resize", handleWindowResize, { passive: true });

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [railRef, measureLayout, totalCount]);

  // Ajusta responsivamente se montado no cliente em desktop
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia
      ? window.matchMedia("(min-width: 768px)").matches
      : window.innerWidth >= 768;
    const target = initialCount ?? (isDesktop ? 4 : 3);
    setLimit((prev) => Math.max(prev, Math.min(totalCount, target)));

    const mql = window.matchMedia ? window.matchMedia("(min-width: 768px)") : null;
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const newTarget = initialCount ?? (e.matches ? 4 : 3);
      setLimit((prev) => Math.max(prev, Math.min(totalCount, newTarget)));
    };
    mql?.addEventListener?.("change", handleMediaChange);
    return () => mql?.removeEventListener?.("change", handleMediaChange);
  }, [totalCount, initialCount]);

  const advance = useCallback(
    (extraPx = 0) => {
      const el = railRef.current;
      const isDesktop =
        typeof window !== "undefined" &&
        (window.matchMedia
          ? window.matchMedia("(min-width: 768px)").matches
          : window.innerWidth >= 768);
      const groupSize = isDesktop ? 4 : 3;
      const defaultInitial = isDesktop ? 4 : 3;
      const baseInitial = initialCount ?? defaultInitial;

      if (!el) {
        startTransition(() => {
          setLimit((prev) => Math.min(totalCount, prev + groupSize));
        });
        return;
      }

      // Se não houve deslocamento e não foi solicitado avanço extra, mantém o limite inicial
      if (el.scrollLeft <= 0 && extraPx <= 0) {
        startTransition(() => {
          setLimit((prev) => Math.max(prev, Math.min(totalCount, baseInitial)));
        });
        return;
      }

      // Utiliza o stride em cache, sem acionar consultas ao DOM ou recalcular estilos
      let stride =
        itemStridePx && itemStridePx > 0
          ? itemStridePx
          : cachedStrideRef.current;

      if (!stride || stride <= 0) {
        stride = measureLayout();
      }

      const clientWidth =
        cachedClientWidthRef.current > 0
          ? cachedClientWidthRef.current
          : el.clientWidth;

      // Posição visível à direita considerando a rolagem atual e avanço pretendido
      const effectiveScroll = Math.max(0, el.scrollLeft + extraPx);
      const visibleEnd = effectiveScroll + clientWidth;
      const visibleCount = Math.ceil(visibleEnd / stride);

      // Garante os cards da área visível mais o próximo grupo de imagens
      const needed = Math.min(totalCount, visibleCount + (groupSize - 1));

      startTransition(() => {
        setLimit((prev) => (needed > prev ? needed : prev));
      });
    },
    [railRef, totalCount, itemStridePx, initialCount, measureLayout],
  );

  useEffect(() => {
    if (limit >= totalCount) return;
    const el = railRef.current;
    if (!el) return;

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        advance(0);
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [railRef, limit, totalCount, advance]);

  return { limit, advance };
}

export function AnimeRow({
  title,
  eyebrow,
  tag,
  iconType,
  href,
  linkLabel = "Ver tudo",
  items,
  loading,
  showRank = false,
  showBookmark = true,
  resetScrollOnReturn = false,
  emptyTitle,
  emptyDescription,
  priorityCount = 0,
}: {
  title: string;
  eyebrow?: string;
  tag?: string;
  iconType?: "flame" | "calendar" | "sparkles" | "trophy" | "star";
  href?: string;
  linkLabel?: string;
  items: SlimAnime[];
  loading?: boolean;
  showRank?: boolean;
  showBookmark?: boolean;
  resetScrollOnReturn?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  priorityCount?: number;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { limit: visibleImgLimit, advance: advanceImgLimit } =
    useHorizontalRailImageLimit(
      railRef,
      items.length,
      undefined,
      undefined,
      title,
    );

  useEffect(() => {
    if (!resetScrollOnReturn) return;

    if (railRef.current) {
      railRef.current.scrollLeft = 0;
    }

    const unsubscribe = router.subscribe("onRendered", () => {
      requestAnimationFrame(() => {
        if (railRef.current) {
          railRef.current.scrollLeft = 0;
        }
      });
    });

    return unsubscribe;
  }, [resetScrollOnReturn, router]);

  const hasEmptyState = Boolean(emptyTitle || emptyDescription);

  if (!loading && items.length === 0 && !hasEmptyState) return null;

  const scroll = (direction: "left" | "right") => {
    if (!railRef.current) return;
    const distance = railRef.current.clientWidth * 0.75;
    if (direction === "right") {
      advanceImgLimit(distance);
    }
    railRef.current.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  const renderIcon = () => {
    switch (iconType) {
      case "flame":
        return <Flame className="size-3.5 text-amber-400" />;
      case "calendar":
        return <Calendar className="size-3.5 text-purple-400" />;
      case "trophy":
        return <Trophy className="size-3.5 text-amber-300" />;
      case "star":
        return <Star className="size-3.5 text-purple-300 fill-purple-400/30" />;
      case "sparkles":
      default:
        return <Sparkles className="size-3.5 text-purple-400" />;
    }
  };

  return (
    <section className="space-y-3.5 sm:space-y-4 [content-visibility:auto] [contain-intrinsic-size:auto_260px]">
      {/* Cabeçalho da Seção: Título e Botão Ver Tudo alinhados na mesma linha */}
      <div className={`flex ${eyebrow ? "items-end" : "items-center"} justify-between gap-3 px-0.5`}>
        <div className={`min-w-0 flex-1 ${eyebrow ? "space-y-1" : ""}`}>
          {/* Eyebrow / Tag Temática */}
          {eyebrow && (
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold tracking-widest text-purple-400 uppercase">
              <span className="flex items-center justify-center size-4 rounded-full bg-purple-950/90 border border-purple-500/30 shrink-0">
                {renderIcon()}
              </span>
              <span className="truncate">{eyebrow}</span>
              {tag && (
                <>
                  <span className="size-1 rounded-full bg-purple-500/40 shrink-0" />
                  <span className="text-zinc-400 font-medium normal-case tracking-normal truncate">
                    {tag}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Título com Tipografia Cinzel Elegante */}
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-section text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white drop-shadow-sm truncate">
              {title}
            </h2>
            {tag && !eyebrow && (
              <span className="hidden sm:inline-flex shrink-0 rounded-full bg-purple-950/50 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300/80">
                {tag}
              </span>
            )}
            {items.length > 0 && (
              <span className="hidden sm:inline-flex shrink-0 rounded-full bg-purple-950/50 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300/80">
                {items.length} {items.length === 1 ? "título" : "títulos"}
              </span>
            )}
          </div>
        </div>

        {/* Controles: Setas de rolagem no desktop e botão Ver Tudo discreto e elegante */}
        <div className={`flex shrink-0 items-center gap-2 ${eyebrow ? "mb-0.5" : ""}`}>
          {/* Controles de Navegação por trilho no Desktop */}
          {(loading || items.length > 0) && (
            <div className="hidden md:flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scroll("left")}
                aria-label="Rolar para a esquerda"
                className="flex size-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-zinc-300 transition-all hover:bg-purple-950/60 hover:border-purple-500/40 hover:text-white active:scale-95"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                aria-label="Rolar para a direita"
                className="flex size-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-zinc-300 transition-all hover:bg-purple-950/60 hover:border-purple-500/40 hover:text-white active:scale-95"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}

          {href && (
            <Link
              to={href}
              className="inline-flex items-center rounded-md bg-purple-950/30 border border-purple-500/20 px-2.5 py-1 text-xs font-medium text-purple-300 transition-all duration-200 hover:bg-purple-900/40 hover:border-purple-400/40 hover:text-white"
            >
              {linkLabel}
            </Link>
          )}
        </div>
      </div>

      {/* Trilho de Cards ou Estado Vazio */}
      {!loading && items.length === 0 ? (
        <div className="rounded-xl border border-purple-500/15 bg-[#100e1b]/80 px-4 py-7 sm:px-6 sm:py-9 text-center">
          {emptyTitle && (
            <p className="text-xs sm:text-sm font-semibold text-zinc-200">
              {emptyTitle}
            </p>
          )}
          {emptyDescription && (
            <p className="mx-auto mt-1 max-w-lg text-[11px] sm:text-xs leading-relaxed text-zinc-400">
              {emptyDescription}
            </p>
          )}
        </div>
      ) : (
        <div
          ref={railRef}
          className="rail -mx-4 px-4 sm:-mx-6 sm:px-6 gap-2.5 sm:gap-3.5 md:gap-4 py-2 overscroll-x-contain"
        >
          {loading
            ? Array.from({ length: 8 }, (_, i) => (
                <AnimeCardSkeleton key={i} />
              ))
            : items.map((anime, index) => {
                const isPriority = priorityCount > 0 && index < priorityCount;
                return (
                  <AnimeCard
                    key={anime.id}
                    anime={anime}
                    rank={showRank ? index + 1 : undefined}
                    showBookmark={showBookmark}
                    priority={isPriority}
                    defer={!isPriority}
                    loadImage={isPriority || index < visibleImgLimit}
                  />
                );
              })}
          {/* Espaçador invisível para limites suaves no fim da rolagem */}
          <div className="w-1 shrink-0 -ml-1 sm:w-2 sm:-ml-2 pointer-events-none" aria-hidden="true" />
        </div>
      )}
    </section>
  );
}
