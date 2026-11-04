import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Film,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { withCache } from "@/lib/api";
import { getResponsiveCoverAttrs } from "@/lib/image-utils";

/* =========================================================
   CONFIGURAÇÃO DE FUSO HORÁRIO: AMÉRICA/RECIFE (UTC-3)
========================================================= */

const TIMEZONE_BR = "America/Recife";

/* =========================================================
   TIPOS DE DADOS DO CALENDÁRIO
========================================================= */

export type AiringMedia = {
  id: number;
  idMal?: number | null;
  isAdult?: boolean;
  format?: string | null;
  title: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  };
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
    medium?: string | null;
    color?: string | null;
  } | null;
  bannerImage?: string | null;
  genres?: string[] | null;
  status?: string | null;
};

export type AiringScheduleItem = {
  id: number;
  airingAt: number;
  timeUntilAiring?: number;
  episode: number;
  media: AiringMedia;
};

type WeekDayInfo = {
  index: number; // 0 = Segunda-feira ... 6 = Domingo
  name: string; // "Segunda-feira"
  cleanName: string; // "Segunda"
  shortName: string; // "Seg"
  dateKey: string; // "YYYY-MM-DD" no fuso America/Recife
  dateStr: string; // "26/10"
  fullDateStr: string; // "Segunda-feira, 26 de outubro"
  isToday: boolean;
};

/* =========================================================
   UTILITÁRIOS DE DATA E FUSO HORÁRIO (AMERICA/RECIFE)
========================================================= */

/**
 * Converte timestamp Unix (segundos) para horário formatado em "America/Recife" (UTC-3).
 * Retorna null se não houver horário confiável.
 */
function formatTimeRecife(airingAt?: number | null): string | null {
  if (!airingAt || typeof airingAt !== "number" || isNaN(airingAt) || airingAt <= 0) {
    return null;
  }
  try {
    const date = new Date(airingAt * 1000);
    return date.toLocaleTimeString("pt-BR", {
      timeZone: TIMEZONE_BR,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return null;
  }
}

/**
 * Retorna a chave "YYYY-MM-DD" correspondente ao dia no fuso "America/Recife".
 */
function getDayKeyRecife(dateOrTimestamp: Date | number): string {
  const date =
    typeof dateOrTimestamp === "number"
      ? new Date(dateOrTimestamp * 1000)
      : dateOrTimestamp;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Calcula os dias da semana de segunda-feira a domingo com base no fuso "America/Recife".
 * Aceita offsetWeeks (0 = semana atual, -1 = semana anterior, 1 = próxima semana).
 */
function getWeekInfoRecife(offsetWeeks = 0): {
  days: WeekDayInfo[];
  weekRangeLabel: string;
  startTimestamp: number;
  endTimestamp: number;
} {
  // Obtém o dia atual no fuso de Recife
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const now = new Date();
  const [currentYear, currentMonth, currentDay] = formatter
    .format(now)
    .split("-")
    .map(Number);

  // Data base em UTC correspondente ao meio-dia da data local em Recife
  const baseDate = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay, 12, 0, 0));

  // Dia da semana: 0=Domingo, 1=Segunda ... 6=Sábado
  const dayOfWeek = baseDate.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const mondayDate = new Date(baseDate);
  mondayDate.setUTCDate(baseDate.getUTCDate() + diffToMonday + offsetWeeks * 7);

  const todayKey = formatter.format(now);

  const dayNames = [
    { name: "Segunda-feira", cleanName: "Segunda", shortName: "Seg" },
    { name: "Terça-feira", cleanName: "Terça", shortName: "Ter" },
    { name: "Quarta-feira", cleanName: "Quarta", shortName: "Qua" },
    { name: "Quinta-feira", cleanName: "Quinta", shortName: "Qui" },
    { name: "Sexta-feira", cleanName: "Sexta", shortName: "Sex" },
    { name: "Sábado", cleanName: "Sábado", shortName: "Sáb" },
    { name: "Domingo", cleanName: "Domingo", shortName: "Dom" },
  ];

  const days: WeekDayInfo[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayDate);
    d.setUTCDate(mondayDate.getUTCDate() + i);

    const dateKey = d.toISOString().slice(0, 10);
    const [, m, dayNum] = dateKey.split("-");
    const dateStr = `${dayNum}/${m}`;

    // Data por extenso em português
    const [y, mon, dy] = dateKey.split("-").map(Number);
    const dateObj = new Date(y, mon - 1, dy);
    const fullDateStr = dateObj.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    days.push({
      index: i,
      name: dayNames[i].name,
      cleanName: dayNames[i].cleanName,
      shortName: dayNames[i].shortName,
      dateKey,
      dateStr,
      fullDateStr,
      isToday: dateKey === todayKey,
    });
  }

  const firstDay = days[0];
  const lastDay = days[6];
  const weekRangeLabel = `${firstDay.dateStr} a ${lastDay.dateStr}`;

  // Timestamps Unix com margem de segurança de 24h para consulta
  const mondayStartUTC = Date.UTC(
    Number(firstDay.dateKey.slice(0, 4)),
    Number(firstDay.dateKey.slice(5, 7)) - 1,
    Number(firstDay.dateKey.slice(8, 10)),
    3, // 00:00 em Recife (UTC-3) corresponde a 03:00 UTC
    0,
    0,
  );
  const sundayEndUTC = Date.UTC(
    Number(lastDay.dateKey.slice(0, 4)),
    Number(lastDay.dateKey.slice(5, 7)) - 1,
    Number(lastDay.dateKey.slice(8, 10)) + 1,
    2, // 23:59:59 em Recife corresponde a 02:59:59 UTC do dia seguinte
    59,
    59,
  );

  return {
    days,
    weekRangeLabel,
    startTimestamp: Math.floor(mondayStartUTC / 1000) - 86400,
    endTimestamp: Math.floor(sundayEndUTC / 1000) + 86400,
  };
}

/* =========================================================
   QUERY GRAPHQL PARA LANÇAMENTOS SEMANAIS (ANILIST)
========================================================= */

const AIRING_SCHEDULE_QUERY = `
  query ($start: Int, $end: Int, $page: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo {
        hasNextPage
      }
      airingSchedules(
        airingAt_greater: $start
        airingAt_lesser: $end
        sort: TIME
      ) {
        id
        airingAt
        timeUntilAiring
        episode
        media {
          id
          idMal
          isAdult
          format
          title {
            romaji
            english
            native
          }
          coverImage {
            extraLarge
            large
            medium
            color
          }
          bannerImage
          genres
          status
        }
      }
    }
  }
`;

/* =========================================================
   SERVER FUNCTION COM CACHE (SINGLEFLIGHT, SWR 15M/3H, LRU)
========================================================= */

export const fetchWeeklyScheduleFn = createServerFn({ method: "GET" })
  .validator((d: { start: number; end: number; weekKey?: string }) => d)
  .handler(async ({ data }): Promise<AiringScheduleItem[]> => {
    const { start, end, weekKey } = data;
    // Chave de cache específica para o calendário semanal
    const cacheKey = `calendar:week:${weekKey || `${start}:${end}`}`;

    return withCache<AiringScheduleItem[]>(
      cacheKey,
      async () => {
        const fetchPage = async (page: number): Promise<AiringScheduleItem[]> => {
          const res = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "User-Agent": "Hikari/1.0 (anime streaming platform)",
            },
            body: JSON.stringify({
              query: AIRING_SCHEDULE_QUERY,
              variables: { start, end, page },
            }),
            signal: AbortSignal.timeout(10000),
          });

          if (!res.ok) {
            throw new Error(`AniList returned HTTP ${res.status}`);
          }

          const json = await res.json();
          return json?.data?.Page?.airingSchedules || [];
        };

        const pages = await Promise.all([
          fetchPage(1),
          fetchPage(2),
          fetchPage(3),
        ]);
        const flat = pages.flat();

        // Deduplica por id e exclui estritamente conteúdo adulto (+18)
        const uniqueMap = new Map<number, AiringScheduleItem>();
        for (const item of flat) {
          if (!item || !item.id || item.media?.isAdult) continue;
          if (!uniqueMap.has(item.id)) {
            uniqueMap.set(item.id, item);
          }
        }
        return Array.from(uniqueMap.values());
      },
      {
        freshTtl: 15 * 60 * 1000, // 15 minutos fresco
        swrWindow: 3 * 60 * 60 * 1000, // +3 horas janela SWR (total 3h15m)
        shouldCache: (items, staleItems) =>
          items.length > 0 || !staleItems || staleItems.length === 0,
        fallback: (err) => {
          console.warn("[Hikari] Erro ao carregar calendário semanal no AniList:", err);
          return [];
        },
      },
    );
  });

/* =========================================================
   ROTA DO CALENDÁRIO COM SERVER LOADER
========================================================= */

export const Route = createFileRoute("/calendar")({
  loader: async () => {
    const weekInfo = getWeekInfoRecife();
    try {
      const schedules = await fetchWeeklyScheduleFn({
        data: {
          start: weekInfo.startTimestamp,
          end: weekInfo.endTimestamp,
          weekKey: weekInfo.days[0].dateKey,
        },
      });
      return {
        schedules: schedules || [],
      };
    } catch (err) {
      console.error("[Hikari] Falha no loader do calendário semanal:", err);
      return {
        schedules: [] as AiringScheduleItem[],
      };
    }
  },
  component: CalendarPage,
});

/* =========================================================
   COMPONENTE DO CARD DE ANIME NO CALENDÁRIO
   - Sem botão "Ver animes"
   - Imagem, título, episódio e horário em America/Recife
   - Não ocupa 100% da largura em telas maiores (grade de 3 colunas)
========================================================= */

function CalendarAnimeCard({ item }: { item: AiringScheduleItem }) {
  const title =
    item.media.title.english?.trim() ||
    item.media.title.romaji?.trim() ||
    item.media.title.native?.trim() ||
    "Anime";

  const cover =
    item.media.coverImage?.large ||
    item.media.coverImage?.medium ||
    item.media.coverImage?.extraLarge ||
    "";
  const coverAttrs = getResponsiveCoverAttrs(cover, "card-sm");

  // Horário convertido para fuso America/Recife (UTC-3)
  const timeFormatted = formatTimeRecife(item.airingAt);

  return (
    <Link
      to="/anime/$id"
      params={{ id: String(item.media.id) }}
      className="group relative flex flex-col md:flex-row min-w-0 w-full overflow-hidden rounded-xl md:rounded-2xl border border-purple-500/15 bg-[#100e1b] p-1.5 sm:p-2 md:p-3 transition-all duration-300 hover:border-purple-400/50 hover:bg-[#151224] hover:shadow-[0_8px_24px_rgba(168,85,247,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50"
    >
      {/* Imagem de Capa (w-full no mobile para 3 colunas elegantes, w-20/24 no desktop) */}
      <div className="relative aspect-[2/3] w-full md:w-20 lg:w-24 shrink-0 overflow-hidden rounded-lg md:rounded-xl bg-[#0d0c16]">
        {cover ? (
          <img
            src={coverAttrs.src}
            srcSet={coverAttrs.srcSet}
            sizes="(min-width: 1024px) 96px, (min-width: 768px) 80px, (min-width: 640px) 126px, 106px"
            alt={title}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-subtle">
            <Film className="size-5 sm:size-6" />
          </div>
        )}
      </div>

      {/* Informações do Anime */}
      <div className="flex min-w-0 flex-1 flex-col justify-between pt-1.5 md:pt-0 pl-0 md:pl-3">
        <div className="min-w-0">
          {/* Badges: Episódio e Horário de Lançamento no Brasil */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 text-xs min-w-0">
            {typeof item.episode === "number" && item.episode > 0 && (
              <span className="inline-flex items-center rounded-md border border-purple-500/30 bg-purple-500/20 px-1.5 py-0.5 text-[9px] sm:text-[10.5px] md:text-xs font-semibold text-purple-300 shrink-0">
                <span className="sm:hidden">Ep. {item.episode}</span>
                <span className="hidden sm:inline">Episódio {item.episode}</span>
              </span>
            )}

            {timeFormatted && (
              <span
                className="inline-flex items-center gap-0.5 sm:gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] sm:text-[10.5px] md:text-xs text-muted shrink-0"
                title={`Horário de Brasília: ${timeFormatted}`}
              >
                <Clock className="size-2.5 sm:size-3 text-purple-400 shrink-0" />
                <span className="tabular-nums">{timeFormatted}</span>
              </span>
            )}
          </div>

          {/* Título do Anime */}
          <h3
            className="mt-1 md:mt-2 line-clamp-2 font-display text-[10.5px] sm:text-xs md:text-sm lg:text-base font-bold text-fg leading-tight transition-colors group-hover:text-purple-300 break-words"
            title={title}
          >
            {title}
          </h3>
        </div>

        {/* Informações adicionais (Gênero / Formato) */}
        <div className="mt-1.5 md:mt-2.5 border-t border-white/5 pt-1 md:pt-2 text-[8.5px] sm:text-[10px] md:text-xs text-subtle truncate">
          {item.media.genres && item.media.genres.length > 0
            ? item.media.genres.slice(0, 2).join(" • ")
            : item.media.format || "Anime"}
        </div>
      </div>
    </Link>
  );
}

/* =========================================================
   COMPONENTE PRINCIPAL DO CALENDÁRIO
========================================================= */

function CalendarPage() {
  const loaderData = Route.useLoaderData();
  const initialSchedules = useMemo(
    () => loaderData?.schedules ?? [],
    [loaderData?.schedules],
  );

  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Calcula os dias da semana de segunda a domingo no fuso America/Recife
  const weekInfo = useMemo(() => getWeekInfoRecife(weekOffset), [weekOffset]);

  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => {
    const today = weekInfo.days.find((d) => d.isToday);
    return today ? today.dateKey : (weekInfo.days[0]?.dateKey ?? "");
  });

  const [schedules, setSchedules] = useState<AiringScheduleItem[]>(initialSchedules);
  const [loading, setLoading] = useState(initialSchedules.length === 0);
  const [error, setError] = useState<string | null>(null);

  // Sincroniza dados do loader caso mudem na semana atual
  useEffect(() => {
    if (weekOffset === 0 && initialSchedules.length > 0) {
      setSchedules(initialSchedules);
      setLoading(false);
      setError(null);
    }
  }, [initialSchedules, weekOffset]);

  // Busca os lançamentos semanais com segurança (Server Fn + Fallback)
  const loadScheduleData = async (targetOffset = weekOffset) => {
    setLoading(true);
    setError(null);

    const targetWeekInfo = getWeekInfoRecife(targetOffset);
    const { startTimestamp, endTimestamp, days } = targetWeekInfo;

    try {
      let data: AiringScheduleItem[] = [];

      // 1. Tenta a Server Function primeiro (com Singleflight, SWR e LRU)
      try {
        data = await fetchWeeklyScheduleFn({
          data: {
            start: startTimestamp,
            end: endTimestamp,
            weekKey: days[0]?.dateKey,
          },
        });
      } catch {
        data = [];
      }

      // 2. Fallback via /api-anilist se necessário
      if (!data || data.length === 0) {
        const fetchProxyPage = async (page: number) => {
          const res = await fetch("/api-anilist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: AIRING_SCHEDULE_QUERY,
              variables: {
                start: startTimestamp,
                end: endTimestamp,
                page,
              },
            }),
          });
          const json = await res.json();
          return json?.data?.Page?.airingSchedules || [];
        };

        const pages = await Promise.all([
          fetchProxyPage(1),
          fetchProxyPage(2),
          fetchProxyPage(3),
        ]);
        data = pages.flat();
      }

      // Deduplica por id e exclui estritamente conteúdo adulto (+18)
      const uniqueMap = new Map<number, AiringScheduleItem>();
      for (const item of data) {
        if (!item || !item.id || item.media?.isAdult) continue;
        if (!uniqueMap.has(item.id)) {
          uniqueMap.set(item.id, item);
        }
      }

      const cleanList = Array.from(uniqueMap.values());
      setSchedules(cleanList);
    } catch (err) {
      console.error("Erro ao carregar calendário semanal:", err);
      if (schedules.length === 0) {
        setError("Não foi possível carregar os lançamentos da semana.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWeekChange = (newOffset: number) => {
    setWeekOffset(newOffset);
    const newWeekInfo = getWeekInfoRecife(newOffset);
    const todayInNewWeek = newWeekInfo.days.find((d) => d.isToday);
    setSelectedDayKey(
      todayInNewWeek ? todayInNewWeek.dateKey : newWeekInfo.days[0].dateKey,
    );

    // Se voltar para a semana atual e já temos dados do loader, restaura instantaneamente
    if (newOffset === 0 && initialSchedules.length > 0) {
      setSchedules(initialSchedules);
      setLoading(false);
      setError(null);
      return;
    }

    void loadScheduleData(newOffset);
  };

  useEffect(() => {
    if (
      weekOffset === 0 &&
      initialSchedules.length === 0 &&
      schedules.length === 0
    ) {
      void loadScheduleData(0);
    }
  }, [initialSchedules.length, weekOffset]);

  // Agrupa os animes por dia da semana no fuso horário America/Recife
  const episodesByDay = useMemo(() => {
    const map = new Map<string, AiringScheduleItem[]>();

    for (const day of weekInfo.days) {
      map.set(day.dateKey, []);
    }

    for (const item of schedules) {
      const localKey = getDayKeyRecife(item.airingAt);
      const list = map.get(localKey);
      if (list) {
        list.push(item);
      }
    }

    // Ordena pelo horário de exibição dentro de cada dia
    for (const [, list] of map.entries()) {
      list.sort((a, b) => a.airingAt - b.airingAt);
    }

    return map;
  }, [schedules, weekInfo.days]);

  // Total de animes na semana
  const totalWeekEpisodes = useMemo(() => {
    let count = 0;
    for (const list of episodesByDay.values()) {
      count += list.length;
    }
    return count;
  }, [episodesByDay]);

  // Inicializa o dia selecionado (para "Hoje" ou primeiro dia disponível) apenas se ainda não definido
  useEffect(() => {
    if (!selectedDayKey) {
      const today = weekInfo.days.find((d) => d.isToday);
      if (today) {
        setSelectedDayKey(today.dateKey);
      } else if (weekInfo.days[0]) {
        setSelectedDayKey(weekInfo.days[0].dateKey);
      }
    }
  }, [weekInfo.days, selectedDayKey]);

  const activeDay =
    weekInfo.days.find((d) => d.dateKey === selectedDayKey) ?? weekInfo.days[0];
  const activeDayEpisodes = episodesByDay.get(activeDay?.dateKey ?? "") || [];

  return (
    <div className="space-y-4 sm:space-y-5 pt-1 sm:pt-3 pb-12">
      {/* =========================================================
          CABEÇALHO DA PÁGINA: PROGRAMAÇÃO SEMANAL E CALENDÁRIO
      ========================================================== */}
      <header className="space-y-0.5">
        <p className="text-[11px] font-semibold tracking-[0.28em] text-muted uppercase">
          Programação Semanal
        </p>

        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl md:text-4xl text-fg">
          Calendário
        </h1>
      </header>

      {/* =========================================================
          DIAS DA SEMANA: SEGUNDA A DOMINGO (SEM SOBREPOSIÇÃO)
      ========================================================== */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-subtle px-1">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => handleWeekChange(weekOffset - 1)}
              title="Semana anterior"
              className="inline-flex size-6 sm:size-7 items-center justify-center rounded-lg border border-border/60 bg-elevated/60 text-muted hover:border-purple-500/40 hover:bg-elevated hover:text-fg transition-colors"
            >
              <ChevronLeft className="size-3.5 sm:size-4" />
            </button>
            <span className="font-medium text-fg/90">
              Semana de {weekInfo.weekRangeLabel}
            </span>
            <button
              type="button"
              onClick={() => handleWeekChange(weekOffset + 1)}
              title="Próxima semana"
              className="inline-flex size-6 sm:size-7 items-center justify-center rounded-lg border border-border/60 bg-elevated/60 text-muted hover:border-purple-500/40 hover:bg-elevated hover:text-fg transition-colors"
            >
              <ChevronRight className="size-3.5 sm:size-4" />
            </button>
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => handleWeekChange(0)}
                className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 underline underline-offset-2 ml-1"
              >
                Voltar para esta semana
              </button>
            )}
          </div>
          <span>
            {loading ? "Carregando..." : `${totalWeekEpisodes} animes previstos`}
          </span>
        </div>

        {/* Grade de 7 dias da semana: Segunda a Domingo */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 w-full">
          {weekInfo.days.map((day) => {
            const count = episodesByDay.get(day.dateKey)?.length ?? 0;
            const isSelected = selectedDayKey === day.dateKey;

            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => setSelectedDayKey(day.dateKey)}
                className={`flex flex-col items-center justify-center rounded-xl py-2 px-1 sm:py-3 sm:px-2 text-center transition-all min-w-0 border ${
                  isSelected
                    ? "border-purple-500 bg-purple-500/20 text-white shadow-md shadow-purple-500/10 ring-1 ring-purple-500"
                    : "border-border/60 bg-elevated/60 text-muted hover:border-purple-500/30 hover:bg-elevated hover:text-fg"
                }`}
              >
                {/* Nome do dia: abreviado em telas pequenas, completo em telas maiores */}
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate w-full text-center">
                  <span className="sm:hidden">{day.shortName}</span>
                  <span className="hidden sm:inline">{day.cleanName}</span>
                </span>

                {/* Data: DD/MM */}
                <span className="mt-1 text-xs sm:text-sm font-bold text-fg leading-none">
                  {day.dateStr}
                </span>

                {/* Indicador 'Hoje' ou Quantidade */}
                <div className="mt-1.5 flex items-center justify-center">
                  {day.isToday ? (
                    <span className="rounded-full bg-purple-500 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider leading-none">
                      Hoje
                    </span>
                  ) : (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${
                        isSelected
                          ? "bg-purple-500/40 text-purple-200"
                          : "bg-white/10 text-muted"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================
          ESTADOS: CARREGAMENTO, ERRO OU LISTA DE ANIMES DO DIA
      ========================================================== */}

      {/* 1. CARREGAMENTO */}
      {loading && (
        <div className="space-y-4">
          <div className="h-6 w-48 animate-pulse rounded bg-white/10" />

          {/* Grade de 3 colunas para os Skeletons */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 w-full">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col md:flex-row animate-pulse gap-2 md:gap-3 rounded-xl md:rounded-2xl border border-border/40 bg-[#100e1b] p-1.5 sm:p-2 md:p-3 min-w-0 w-full"
              >
                <div className="aspect-[2/3] w-full md:w-20 lg:w-24 shrink-0 rounded-lg md:rounded-xl bg-white/10" />
                <div className="flex flex-1 flex-col justify-between py-1 min-w-0 space-y-1.5">
                  <div className="space-y-1.5">
                    <div className="h-3 md:h-4 w-12 md:w-20 rounded bg-white/10" />
                    <div className="h-3 md:h-4 w-full rounded bg-white/10" />
                    <div className="h-2.5 md:h-3 w-3/4 rounded bg-white/10" />
                  </div>
                  <div className="h-2.5 md:h-3 w-10 md:w-16 rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. ERRO */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <AlertCircle className="size-10 text-red-400" />
          <p className="mt-3 text-base font-semibold text-red-200">
            {error}
          </p>
          <p className="mt-1 text-xs text-red-300/70 max-w-sm">
            Houve uma falha na conexão com a programação de lançamentos.
          </p>
          <button
            type="button"
            onClick={() => void loadScheduleData()}
            className="mt-4 flex items-center gap-2 rounded-xl bg-red-500/20 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/30 transition-colors"
          >
            <RotateCcw className="size-3.5" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* 3. LISTAGEM DO DIA SELECIONADO NA GRADE DE 3 COLUNAS */}
      {!loading && !error && activeDay && (
        <div>
          <div className="mb-4 flex items-center justify-between border-b border-border/30 pb-3">
            <div>
              <h2 className="text-lg font-bold text-fg capitalize">
                {activeDay.fullDateStr}
              </h2>
              <p className="text-xs text-subtle">
                {activeDayEpisodes.length}{" "}
                {activeDayEpisodes.length === 1
                  ? "episódio programado"
                  : "episódios programados"}
              </p>
            </div>
          </div>

          {activeDayEpisodes.length === 0 ? (
            /* Estado de Ausência de Lançamentos no Dia */
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-[#100e1b] py-16 text-center">
              <CalendarIcon className="size-10 text-subtle" />
              <p className="mt-3 text-base font-semibold text-fg">
                Nenhum lançamento previsto para este dia
              </p>
              <p className="mt-1 text-xs text-muted max-w-sm">
                Não há episódios programados para {activeDay.name}. Selecione outro dia da semana acima.
              </p>
            </div>
          ) : (
            /* Grade com exatamente 3 animes por linha (lado a lado no mobile e desktop) */
            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 w-full">
              {activeDayEpisodes.map((item) => (
                <CalendarAnimeCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
