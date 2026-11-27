import { Link, useRouter } from "@tanstack/react-router";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { AnimeCard } from "@/components/anime-card";
import { fetchTodaySchedule } from "@/lib/api";
import {
  getDayKeySaoPaulo,
  getMsUntilNextSaoPauloMidnight,
} from "@/lib/calendar-timezone";
import { useHikariStore } from "@/lib/store";
import {
  hasLocalPublishedEpisodes,
  localToAnime,
  type SlimAnime,
} from "@/lib/types";
import {
  buildClientVisibilityContext,
  isPubliclyBlockedAnime,
} from "@/lib/public-visibility";

const DRAG_THRESHOLD_PX = 6;

export const TodayEpisodesSection = memo(
  function TodayEpisodesSection({
    initialItems,
  }: {
    initialItems: SlimAnime[];
    homeWithEpisodeCount?: number;
  }) {
    const router = useRouter();
    const locals = useHikariStore((s) => s.animes);

    const railRef = useRef<HTMLDivElement>(null);
    const [scheduleSource, setScheduleSource] = useState<SlimAnime[]>(initialItems);
    const [activeDayKey, setActiveDayKey] = useState<string>(() =>
      getDayKeySaoPaulo(new Date()),
    );

    const loadedDayKeyRef = useRef<string>(getDayKeySaoPaulo(new Date()));
    const syncInFlightRef = useRef(false);
    const suppressNextClickRef = useRef(false);
    const suppressClickTimerRef = useRef<number | null>(null);
    const dragCleanupRef = useRef<(() => void) | null>(null);

  // Sincroniza quando o loader da rota atualiza os dados iniciais
  useEffect(() => {
    const todayKey = getDayKeySaoPaulo(new Date());
    setScheduleSource(initialItems);
    loadedDayKeyRef.current = todayKey;
    setActiveDayKey(todayKey);
  }, [initialItems]);

  // Atualiza somente ao virar o dia em America/Sao_Paulo (lendo PostgreSQL + Redis, sem AniList)
  const syncTodayFromServer = useCallback(async (force = false) => {
    if (syncInFlightRef.current) return;

    const currentDayKey = getDayKeySaoPaulo(new Date());
    const dayChanged = currentDayKey !== loadedDayKeyRef.current;

    if (!force && !dayChanged) {
      return;
    }

    syncInFlightRef.current = true;
    try {
      const fresh = await fetchTodaySchedule();
      const updatedDayKey = getDayKeySaoPaulo(new Date());
      if (Array.isArray(fresh)) {
        setScheduleSource(fresh);
        loadedDayKeyRef.current = updatedDayKey;
      }
      setActiveDayKey(updatedDayKey);
    } finally {
      syncInFlightRef.current = false;
    }
  }, []);

  // Seleciona todos os animes previstos para o dia atual em America/Sao_Paulo,
  // mantendo consistência integral com a guia "Hoje" da página /calendar.
  const activeItems = useMemo(() => {
    if (scheduleSource.length === 0) return [];

    const visCtx = buildClientVisibilityContext(locals);

    const hiddenAnilist = new Set(
      locals
        .filter((a) => a.hidden && a.anilistId)
        .map((a) => a.anilistId as number),
    );

    const localByAnilist = new Map(
      locals
        .filter((a) => !a.hidden && a.anilistId)
        .map((a) => [a.anilistId as number, a]),
    );

    const result: SlimAnime[] = [];

    for (const item of scheduleSource) {
      if (item.anilistId && hiddenAnilist.has(item.anilistId)) {
        continue;
      }
      if (isPubliclyBlockedAnime(item, visCtx)) {
        continue;
      }

      const rawEpisodes =
        item.todayUpcomingEpisodes && item.todayUpcomingEpisodes.length > 0
          ? item.todayUpcomingEpisodes
          : item.todayEpisode
            ? [item.todayEpisode]
            : [];

      const todayEpisodes = rawEpisodes
        .filter(
          (ep) =>
            typeof ep.airingAt === "number" &&
            Number.isFinite(ep.airingAt) &&
            ep.airingAt > 0 &&
            getDayKeySaoPaulo(ep.airingAt) === activeDayKey,
        )
        .sort((a, b) => a.airingAt - b.airingAt);

      if (todayEpisodes.length === 0) {
        continue;
      }

      const firstTodayEpisode = todayEpisodes[0];
      const localOverride = item.anilistId
        ? localByAnilist.get(item.anilistId)
        : undefined;
      if (localOverride && isPubliclyBlockedAnime(localOverride, visCtx)) {
        continue;
      }

      const hasEpisodes =
        item.hasEpisode === true ||
        Boolean(
          localOverride &&
            (localOverride.hasEpisode === true ||
              hasLocalPublishedEpisodes(localOverride.seasons)),
        );

      if (!localOverride) {
        result.push({
          ...item,
          hasEpisode: hasEpisodes,
          todayEpisode: firstTodayEpisode,
          todayUpcomingEpisodes: todayEpisodes,
        });
        continue;
      }

      const mappedLocal = localToAnime(localOverride);
      const localHasTitle = Boolean(mappedLocal.titles.english || mappedLocal.titles.romaji);
      result.push({
        ...item,
        hasEpisode: hasEpisodes,
        titles: {
          romaji: mappedLocal.titles.romaji || item.titles.romaji,
          english: mappedLocal.titles.english || (localHasTitle ? "" : item.titles.english),
          native: mappedLocal.titles.native || item.titles.native,
        },
        cover: mappedLocal.cover || item.cover,
        banner: mappedLocal.banner || item.banner,
        todayEpisode: firstTodayEpisode,
        todayUpcomingEpisodes: todayEpisodes,
      });
    }

    result.sort(
      (a, b) =>
        Number(b.hasEpisode === true) - Number(a.hasEpisode === true) ||
        (a.todayEpisode?.airingAt ?? Number.MAX_SAFE_INTEGER) -
          (b.todayEpisode?.airingAt ?? Number.MAX_SAFE_INTEGER),
    );

    return result;
  }, [scheduleSource, locals, activeDayKey]);

  // Virada automática de meia-noite no fuso America/Sao_Paulo
  useEffect(() => {
    let midnightTimer: number;

    const scheduleMidnightRefresh = () => {
      const waitMs = getMsUntilNextSaoPauloMidnight();
      midnightTimer = window.setTimeout(() => {
        setActiveDayKey(getDayKeySaoPaulo(new Date()));
        void syncTodayFromServer(true);
        scheduleMidnightRefresh();
      }, waitMs);
    };

    scheduleMidnightRefresh();

    return () => window.clearTimeout(midnightTimer);
  }, [syncTodayFromServer]);

  // Ao retornar para a aba, verifica apenas se o dia civil em America/Sao_Paulo mudou
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState !== "visible") return;
      const currentDayKey = getDayKeySaoPaulo(new Date());
      if (currentDayKey !== loadedDayKeyRef.current) {
        setActiveDayKey(currentDayKey);
        void syncTodayFromServer(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [syncTodayFromServer]);

  // Reseta a posição do carrossel ao retornar à página inicial
  useEffect(() => {
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
  }, [router]);

  const displayedItems = useMemo(() => activeItems.slice(0, 12), [activeItems]);

  // Limpa listeners/timers de arraste ao desmontar
  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
      if (suppressClickTimerRef.current !== null) {
        window.clearTimeout(suppressClickTimerRef.current);
        suppressClickTimerRef.current = null;
      }
    };
  }, []);

  // Arraste horizontal exclusivo para mouse (preserva 100% do swipe nativo por toque e trackpad)
  const handleRailPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const rail = railRef.current;
      if (!rail || rail.scrollWidth <= rail.clientWidth) return;

      dragCleanupRef.current?.();
      if (suppressClickTimerRef.current !== null) {
        window.clearTimeout(suppressClickTimerRef.current);
        suppressClickTimerRef.current = null;
      }
      suppressNextClickRef.current = false;

      const startX = e.clientX;
      const startScrollLeft = rail.scrollLeft;
      let didDrag = false;

      const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
        if (moveEvent.pointerType !== "mouse") return;
        const dx = moveEvent.clientX - startX;
        if (!didDrag) {
          if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
          didDrag = true;
          suppressNextClickRef.current = true;
        }
        moveEvent.preventDefault();
        rail.scrollLeft = startScrollLeft - dx;
      };

      const finishDrag = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", finishDrag);
        window.removeEventListener("pointercancel", finishDrag);
        dragCleanupRef.current = null;

        if (didDrag) {
          suppressClickTimerRef.current = window.setTimeout(() => {
            suppressNextClickRef.current = false;
            suppressClickTimerRef.current = null;
          }, 250);
        }
      };

      dragCleanupRef.current = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", finishDrag);
        window.removeEventListener("pointercancel", finishDrag);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", finishDrag);
      window.addEventListener("pointercancel", finishDrag);
    },
    [],
  );

  const handleRailClickCapture = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!suppressNextClickRef.current) return;
      suppressNextClickRef.current = false;
      if (suppressClickTimerRef.current !== null) {
        window.clearTimeout(suppressClickTimerRef.current);
        suppressClickTimerRef.current = null;
      }
      e.preventDefault();
      e.stopPropagation();
    },
    [],
  );

  return (
    <section className="space-y-3.5 sm:space-y-4">
      {/* Cabeçalho da Seção seguindo o padrão visual do Hikari */}
      <div className="flex items-center justify-between gap-3 px-0.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-section text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white drop-shadow-sm truncate">
              Episódios de Hoje
            </h2>
            {activeItems.length > 0 && (
              <span className="hidden sm:inline-flex shrink-0 rounded-full bg-purple-950/50 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300/80">
                {activeItems.length}{" "}
                {activeItems.length === 1 ? "título" : "títulos"}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/calendar"
            className="inline-flex items-center rounded-md bg-purple-950/30 border border-purple-500/20 px-2.5 py-1 text-xs font-medium text-purple-300 transition-all duration-200 hover:bg-purple-900/40 hover:border-purple-400/40 hover:text-white"
          >
            Ver calendário
          </Link>
        </div>
      </div>

      {activeItems.length === 0 ? (
        <div className="rounded-xl border border-purple-500/15 bg-[#100e1b]/70 px-4 py-5 text-xs sm:text-sm text-muted">
          Não há episódios programados para hoje.
        </div>
      ) : (
        /* Trilho compacto e proporcional ao layout original do Hikari */
        <div
          ref={railRef}
          onPointerDown={handleRailPointerDown}
          onClickCapture={handleRailClickCapture}
          className="rail select-none -mx-4 px-4 sm:-mx-6 sm:px-6 gap-2.5 sm:gap-3.5 md:gap-4 py-2 overscroll-x-contain"
        >
          {displayedItems.map((anime, index) => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              priority={false}
              defer={index > 0}
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority="low"
              showBookmark={false}
              showGenre={false}
              disableHoverPreload
              optimizedHover
              disableLinkDrag
            />
          ))}
          <div
            className="w-1 shrink-0 -ml-1 sm:w-2 sm:-ml-2 pointer-events-none"
            aria-hidden="true"
          />
        </div>
      )}
    </section>
  );
  },
  (prev, next) => prev.initialItems === next.initialItems,
);
