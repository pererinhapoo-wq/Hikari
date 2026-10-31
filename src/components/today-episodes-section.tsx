import { Link, useRouter } from "@tanstack/react-router";
import { Calendar } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AnimeCard } from "@/components/anime-card";
import { fetchTodaySchedule } from "@/lib/api";
import { useHikariStore } from "@/lib/store";
import { localToAnime, type SlimAnime } from "@/lib/types";

const TIMEZONE_BR = "America/Recife";
const PERIODIC_SYNC_MS = 15 * 60 * 1000; // 15 minutos

function getDayKeyRecife(dateOrUnixSeconds: Date | number): string {
  const date =
    typeof dateOrUnixSeconds === "number"
      ? new Date(dateOrUnixSeconds * 1000)
      : dateOrUnixSeconds;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getMsUntilNextRecifeMidnight(): number {
  const todayKey = getDayKeyRecife(new Date());
  const [year, month, day] = todayKey.split("-").map(Number);
  // America/Recife opera permanentemente em UTC-3 (00:00:02 em Recife = 03:00:02 UTC)
  const nextMidnightUtcMs = Date.UTC(year, month - 1, day + 1, 3, 0, 2);
  return Math.max(1000, nextMidnightUtcMs - Date.now());
}

export function TodayEpisodesSection({
  initialItems,
}: {
  initialItems: SlimAnime[];
}) {
  const router = useRouter();
  const locals = useHikariStore((s) => s.animes);

  const railRef = useRef<HTMLDivElement>(null);
  const [scheduleSource, setScheduleSource] = useState<SlimAnime[]>(initialItems);
  const [nowSeconds, setNowSeconds] = useState<number | null>(null);

  const loadedDayKeyRef = useRef<string>(getDayKeyRecife(new Date()));
  const lastSyncAtRef = useRef<number>(Date.now());
  const syncInFlightRef = useRef(false);

  // Sincroniza quando o loader da rota atualiza os dados iniciais
  useEffect(() => {
    setScheduleSource(initialItems);
    loadedDayKeyRef.current = getDayKeyRecife(new Date());
    lastSyncAtRef.current = Date.now();
  }, [initialItems]);

  // Ativa o relógio em tempo real após a montagem no cliente
  useEffect(() => {
    setNowSeconds(Math.floor(Date.now() / 1000));
  }, []);

  const syncTodayFromServer = useCallback(async (force = false) => {
    if (syncInFlightRef.current) return;

    const currentDayKey = getDayKeyRecife(new Date());
    const dayChanged = currentDayKey !== loadedDayKeyRef.current;
    const elapsed = Date.now() - lastSyncAtRef.current;

    if (!force && !dayChanged && elapsed < PERIODIC_SYNC_MS) {
      return;
    }

    syncInFlightRef.current = true;
    try {
      const fresh = await fetchTodaySchedule();
      if (Array.isArray(fresh)) {
        setScheduleSource(fresh);
        loadedDayKeyRef.current = getDayKeyRecife(new Date());
        lastSyncAtRef.current = Date.now();
      }
      setNowSeconds(Math.floor(Date.now() / 1000));
    } finally {
      syncInFlightRef.current = false;
    }
  }, []);

  // Seleciona somente animes com episódios ainda previstos para hoje em America/Recife
  const activeItems = useMemo(() => {
    if (scheduleSource.length === 0) return [];

    const currentDayKey =
      nowSeconds !== null ? getDayKeyRecife(nowSeconds) : null;

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

      const rawEpisodes =
        item.todayUpcomingEpisodes && item.todayUpcomingEpisodes.length > 0
          ? item.todayUpcomingEpisodes
          : item.todayEpisode
            ? [item.todayEpisode]
            : [];

      const remainingEpisodes = rawEpisodes.filter((ep) => {
        if (
          typeof ep.airingAt !== "number" ||
          !Number.isFinite(ep.airingAt) ||
          ep.airingAt <= 0
        ) {
          return false;
        }
        if (nowSeconds !== null) {
          if (ep.airingAt <= nowSeconds) return false;
          if (
            currentDayKey &&
            getDayKeyRecife(ep.airingAt) !== currentDayKey
          ) {
            return false;
          }
        }
        return true;
      });

      if (remainingEpisodes.length === 0) {
        continue;
      }

      const nextEpisode = remainingEpisodes[0];
      const localOverride = item.anilistId
        ? localByAnilist.get(item.anilistId)
        : undefined;

      if (!localOverride) {
        result.push({
          ...item,
          todayEpisode: nextEpisode,
          todayUpcomingEpisodes: remainingEpisodes,
        });
        continue;
      }

      const mappedLocal = localToAnime(localOverride);
      result.push({
        ...item,
        titles: {
          romaji: mappedLocal.titles.romaji || item.titles.romaji,
          english: mappedLocal.titles.english || item.titles.english,
          native: mappedLocal.titles.native || item.titles.native,
        },
        cover: mappedLocal.cover || item.cover,
        banner: mappedLocal.banner || item.banner,
        todayEpisode: nextEpisode,
        todayUpcomingEpisodes: remainingEpisodes,
      });
    }

    result.sort(
      (a, b) =>
        (a.todayEpisode?.airingAt ?? Number.MAX_SAFE_INTEGER) -
        (b.todayEpisode?.airingAt ?? Number.MAX_SAFE_INTEGER),
    );

    return result;
  }, [scheduleSource, locals, nowSeconds]);

  // Agendamento exato para o próximo horário de exibição (sem polling curto)
  const nextAiringAt = activeItems[0]?.todayEpisode?.airingAt ?? null;

  useEffect(() => {
    if (nextAiringAt === null) return;

    const delayMs = Math.max(
      500,
      nextAiringAt * 1000 - Date.now() + 1000,
    );

    const timer = window.setTimeout(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [nextAiringAt]);

  // Virada automática de meia-noite no fuso America/Recife
  useEffect(() => {
    let midnightTimer: number;

    const scheduleMidnightRefresh = () => {
      const waitMs = getMsUntilNextRecifeMidnight();
      midnightTimer = window.setTimeout(() => {
        setNowSeconds(Math.floor(Date.now() / 1000));
        void syncTodayFromServer(true);
        scheduleMidnightRefresh();
      }, waitMs);
    };

    scheduleMidnightRefresh();

    return () => window.clearTimeout(midnightTimer);
  }, [syncTodayFromServer]);

  // Atualização suave ao retornar à aba e sincronização periódica moderada (15 min)
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState !== "visible") return;
      setNowSeconds(Math.floor(Date.now() / 1000));
      void syncTodayFromServer(false);
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setNowSeconds(Math.floor(Date.now() / 1000));
      void syncTodayFromServer(false);
    }, PERIODIC_SYNC_MS);

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      window.clearInterval(interval);
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

  return (
    <section className="space-y-3.5 sm:space-y-4 [content-visibility:auto] [contain-intrinsic-size:auto_260px]">
      {/* Cabeçalho da Seção seguindo o padrão visual do Hikari */}
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold tracking-widest text-purple-400 uppercase">
            <span className="flex items-center justify-center size-4 rounded-full bg-purple-950/90 border border-purple-500/30 shrink-0">
              <Calendar className="size-3.5 text-purple-400" />
            </span>
            <span className="truncate">PROGRAMAÇÃO DE HOJE</span>
          </div>

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

        <div className="flex shrink-0 items-center gap-2 mb-0.5">
          <Link
            to="/calendar"
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
            Ver calendário
          </Link>
        </div>
      </div>

      {/* Trilho compacto e proporcional ao layout original do Hikari ou Estado Vazio */}
      {activeItems.length === 0 ? (
        <div className="rounded-xl border border-purple-500/15 bg-[#100e1b]/80 px-4 py-7 sm:px-6 sm:py-9 text-center">
          <p className="text-xs sm:text-sm font-semibold text-zinc-200">
            Nenhum episódio previsto para o restante de hoje
          </p>
          <p className="mx-auto mt-1 max-w-lg text-[11px] sm:text-xs leading-relaxed text-zinc-400">
            Não há novos episódios programados para lançamento no restante da data de hoje.
          </p>
        </div>
      ) : (
        <div
          ref={railRef}
          className="rail -mx-4 px-4 sm:-mx-6 sm:px-6 gap-2.5 sm:gap-3.5 md:gap-4 py-2 overscroll-x-contain"
        >
          {activeItems.map((anime) => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              showBookmark={false}
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
}
