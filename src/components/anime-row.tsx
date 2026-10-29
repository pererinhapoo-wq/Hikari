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
import { useEffect, useRef } from "react";

import {
  AnimeCard,
  AnimeCardSkeleton,
} from "@/components/anime-card";
import type { SlimAnime } from "@/lib/types";

export function AnimeRow({
  id,
  title,
  eyebrow,
  tag,
  iconType,
  href,
  items,
  loading,
  showRank = false,
  showBookmark = true,
  resetScrollOnReturn = false,
}: {
  id?: string;
  title: string;
  eyebrow?: string;
  tag?: string;
  iconType?: "flame" | "calendar" | "sparkles" | "trophy" | "star";
  href?: string;
  items: SlimAnime[];
  loading?: boolean;
  showRank?: boolean;
  showBookmark?: boolean;
  resetScrollOnReturn?: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const shouldReset = Boolean(
    resetScrollOnReturn ||
      title.toLowerCase().includes("selecionado") ||
      id?.toLowerCase().includes("selecionado"),
  );

  useEffect(() => {
    if (!shouldReset) return;

    const resetToStart = () => {
      const el = railRef.current;
      if (!el) return;
      const prevBehavior = el.style.scrollBehavior;
      el.style.scrollBehavior = "auto";
      el.scrollLeft = 0;
      requestAnimationFrame(() => {
        if (el) {
          el.style.scrollBehavior = prevBehavior;
        }
      });
    };

    const cleanSessionStorage = () => {
      try {
        const raw = sessionStorage.getItem("tsr-scroll-restoration-v1_3");
        if (raw) {
          const parsed = JSON.parse(raw);
          let changed = false;
          for (const key of Object.keys(parsed)) {
            if (parsed[key] && typeof parsed[key] === "object") {
              for (const subKey of Object.keys(parsed[key])) {
                if (subKey.includes("selecionados")) {
                  delete parsed[key][subKey];
                  changed = true;
                }
              }
            }
          }
          if (changed) {
            sessionStorage.setItem("tsr-scroll-restoration-v1_3", JSON.stringify(parsed));
          }
        }
      } catch {}
    };

    // 1. Reseta no mount ao retornar à página
    resetToStart();
    cleanSessionStorage();

    // 2. Garante após a conclusão de ciclos de layout/restauração do router
    const rafId = requestAnimationFrame(() => {
      resetToStart();
    });

    const timer = setTimeout(() => {
      resetToStart();
    }, 60);

    // 3. Ao navegar de volta usando o TanStack Router
    const unsubRendered = router.subscribe("onRendered", () => {
      resetToStart();
      requestAnimationFrame(resetToStart);
    });

    // 4. Ao navegar para fora, limpa do sessionStorage
    const unsubBeforeLoad = router.subscribe("onBeforeLoad", () => {
      cleanSessionStorage();
    });

    // 5. Histórico nativo do navegador (voltar / avançar)
    const onPopState = () => {
      resetToStart();
      requestAnimationFrame(resetToStart);
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", resetToStart);
    window.addEventListener("pagehide", cleanSessionStorage);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
      unsubRendered();
      unsubBeforeLoad();
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", resetToStart);
      window.removeEventListener("pagehide", cleanSessionStorage);
    };
  }, [shouldReset, router]);

  if (!loading && items.length === 0) return null;

  const scroll = (direction: "left" | "right") => {
    if (!railRef.current) return;
    const distance = railRef.current.clientWidth * 0.75;
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
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div className="min-w-0 flex-1 space-y-1">
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
            {!eyebrow && (
              <span className="inline-block size-2 shrink-0 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]" />
            )}
            <h2 className="font-section text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white drop-shadow-sm truncate">
              {title}
            </h2>
            <span className="hidden sm:inline-flex shrink-0 rounded-full bg-purple-950/50 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300/80">
              {items.length} títulos
            </span>
          </div>
        </div>

        {/* Controles: Setas de rolagem no desktop e botão Ver Tudo discreto e elegante */}
        <div className="flex shrink-0 items-center gap-2 mb-0.5">
          {/* Controles de Navegação por trilho no Desktop */}
          <div className="hidden md:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Rolar para a esquerda"
              className="
                flex
                size-8
                items-center
                justify-center
                rounded-lg
                bg-white/5
                border
                border-white/10
                text-zinc-300
                transition-all
                hover:bg-purple-950/60
                hover:border-purple-500/40
                hover:text-white
                active:scale-95
              "
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Rolar para a direita"
              className="
                flex
                size-8
                items-center
                justify-center
                rounded-lg
                bg-white/5
                border
                border-white/10
                text-zinc-300
                transition-all
                hover:bg-purple-950/60
                hover:border-purple-500/40
                hover:text-white
                active:scale-95
              "
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {href && (
            <Link
              to={href}
              className="
                inline-flex
                items-center
                rounded-md
                bg-purple-950/30
                border
                border-purple-500/20
                px-2.5
                py-1
                text-xs
                font-medium
                text-purple-300
                transition-all
                duration-200
                hover:bg-purple-900/40
                hover:border-purple-400/40
                hover:text-white
              "
            >
              Ver tudo
            </Link>
          )}
        </div>
      </div>

      {/* Trilho de Cards */}
      <div
        id={id ?? (shouldReset ? "selecionados-rail" : undefined)}
        ref={railRef}
        data-scroll-restoration-id={shouldReset ? "selecionados-rail" : undefined}
        className="rail -mx-4 px-4 sm:-mx-6 sm:px-6 gap-2.5 sm:gap-3.5 md:gap-4 py-2 overscroll-x-contain"
      >
        {loading
          ? Array.from({ length: 8 }, (_, i) => (
              <AnimeCardSkeleton key={i} />
            ))
          : items.map((anime, index) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                rank={showRank ? index + 1 : undefined}
                showBookmark={showBookmark}
              />
            ))}
        {/* Espaçador invisível para limites suaves no fim da rolagem */}
        <div className="w-1 shrink-0 -ml-1 sm:w-2 sm:-ml-2 pointer-events-none" aria-hidden="true" />
      </div>
    </section>
  );
}
