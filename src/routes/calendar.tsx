import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Film,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getResponsiveCoverAttrs } from "@/lib/image-utils";
import {
  getDayKeySaoPaulo,
  getWeekInfoSaoPaulo,
} from "@/lib/calendar-timezone";
import { HikariImage } from "@/components/ui/hikari-image";
import { triggerMonetagSmartLinkOnNavigationClick } from "@/lib/monetag-smartlink";
import { buildCleanCanonical, DEFAULT_OG_IMAGE } from "@/lib/seo";

/* =========================================================
   TIPOS DE DADOS DO CALENDÁRIO
========================================================= */

export type AiringMedia = {
  id: number;
  animeId?: string | null;
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
  isRecurring?: boolean;
  recurrenceId?: string;
  media: AiringMedia;
};

/* =========================================================
   SERVER FUNCTION COM CACHE (UPSTASH REDIS E NEON/FALLBACK)
========================================================= */

export const fetchWeeklyScheduleFn = createServerFn({ method: "GET" })
  .validator((d: { start: number; end: number; weekKey?: string }) => d)
  .handler(async ({ data }): Promise<AiringScheduleItem[]> => {
    // Lê exclusivamente cache Redis (getRedisCalendarSchedule) + PostgreSQL
    // combinando catalog_airing_schedule e catalog_weekly_recurrence (sem AniList).
    const { getWeeklyScheduleFromDbAndRedis } = await import(
      "@/lib/calendar-schedule.server"
    );
    return getWeeklyScheduleFromDbAndRedis({
      startTimestamp: data.start,
      endTimestamp: data.end,
      weekKey: data.weekKey,
    });
  });

/* =========================================================
   ROTA DO CALENDÁRIO COM SERVER LOADER
========================================================= */

export const Route = createFileRoute("/calendar")({
  loader: async () => {
    const weekInfo = getWeekInfoSaoPaulo(0);
    try {
      const schedules = await fetchWeeklyScheduleFn({
        data: {
          start: weekInfo.startTimestamp,
          end: weekInfo.endTimestamp,
          weekKey: weekInfo.weekKey,
        },
      });
      return {
        schedules: schedules || [],
        loaderError: false,
      };
    } catch (err) {
      console.error("[Hikari] Falha no loader do calendário semanal:", err);
      return {
        schedules: [] as AiringScheduleItem[],
        loaderError: true,
      };
    }
  },
  head: () => {
    const title = "Calendário de lançamentos da semana — HIKARI";
    const description =
      "Confira os dias e horários de transmissão dos novos episódios de animes da semana no calendário oficial do HIKARI.";
    const url = buildCleanCanonical("/calendar");
    const image = DEFAULT_OG_IMAGE;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: image },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: "pt_BR" },
        { property: "og:site_name", content: "HIKARI" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
      links: [
        {
          rel: "canonical",
          href: url,
        },
      ],
    };
  },
  component: CalendarPage,
});

/* =========================================================
   COMPONENTE DO CARD DE ANIME NO CALENDÁRIO
   - Sem horário exibido visualmente
   - Imagem, título e episódio
   - Grade de 3 colunas
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
  const coverVariant = "card-md";
  const coverAttrs = getResponsiveCoverAttrs(cover, coverVariant);
  const targetAnimeParam =
    item.media.id > 0
      ? String(item.media.id)
      : item.media.animeId || String(item.media.id);

  return (
    <Link
      to="/anime/$id"
      params={{ id: targetAnimeParam }}
      onClick={triggerMonetagSmartLinkOnNavigationClick}
      className="group relative flex flex-col md:flex-row min-w-0 w-full overflow-hidden rounded-xl md:rounded-2xl border border-purple-500/15 bg-[#100e1b] p-1.5 sm:p-2 md:p-3 transition-all duration-200 hover:border-purple-400/50 hover:bg-[#151224] hover:shadow-[0_8px_24px_rgba(168,85,247,0.18)] active:scale-[0.98] active:brightness-110 motion-reduce:transition-none motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50"
    >
      {/* Imagem de Capa */}
      <div className="relative aspect-[2/3] w-full md:w-20 lg:w-24 shrink-0 overflow-hidden rounded-lg md:rounded-xl bg-[#0d0c16]">
        <HikariImage
          src={cover ? coverAttrs.src : null}
          srcSet={cover ? coverAttrs.srcSet : undefined}
          sizes="(min-width: 1024px) 96px, (min-width: 768px) 80px, (min-width: 640px) 126px, 106px"
          fallbackSrc={coverAttrs.fallbackSrc}
          alt={title}
          width={160}
          height={240}
          fallbackClassName="bg-[#0d0c16]"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />
      </div>

      {/* Informações do Anime */}
      <div className="flex min-w-0 flex-1 flex-col justify-between pt-1.5 md:pt-0 pl-0 md:pl-3">
        <div className="min-w-0">
          {/* Badges: Episódio */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 text-xs min-w-0">
            {typeof item.episode === "number" && item.episode > 0 && (
              <span className="inline-flex items-center rounded-md border border-purple-500/30 bg-purple-500/20 px-1.5 py-0.5 text-[9px] sm:text-[10.5px] md:text-xs font-semibold text-purple-300 shrink-0">
                <span className="sm:hidden">Ep. {item.episode}</span>
                <span className="hidden sm:inline">Episódio {item.episode}</span>
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
  const initialLoaderError = Boolean(loaderData?.loaderError);

  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Calcula os dias da semana de segunda a domingo no fuso America/Sao_Paulo
  const weekInfo = useMemo(() => getWeekInfoSaoPaulo(weekOffset), [weekOffset]);

  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => {
    const today = weekInfo.days.find((d) => d.isToday);
    return today ? today.dateKey : (weekInfo.days[0]?.dateKey ?? "");
  });

  const [schedules, setSchedules] = useState<AiringScheduleItem[]>(initialSchedules);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    initialLoaderError ? "Não foi possível carregar os lançamentos da semana." : null,
  );

  // Sincroniza dados do loader caso mudem na semana atual
  useEffect(() => {
    if (weekOffset === 0) {
      setSchedules(initialSchedules);
      setLoading(false);
      setError(
        initialLoaderError
          ? "Não foi possível carregar os lançamentos da semana."
          : null,
      );
    }
  }, [initialSchedules, initialLoaderError, weekOffset]);

  // Busca os lançamentos semanais via Server Function (Neon PostgreSQL + Upstash Redis)
  const loadScheduleData = async (targetOffset = weekOffset) => {
    setLoading(true);
    setError(null);

    const targetWeekInfo = getWeekInfoSaoPaulo(targetOffset);
    const { startTimestamp, endTimestamp, weekKey } = targetWeekInfo;

    try {
      const data = await fetchWeeklyScheduleFn({
        data: {
          start: startTimestamp,
          end: endTimestamp,
          weekKey,
        },
      });

      if (!data || data.length === 0) {
        setSchedules([]);
        return;
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
      setError("Não foi possível carregar os lançamentos da semana.");
    } finally {
      setLoading(false);
    }
  };

  const handleWeekChange = (newOffset: number) => {
    setWeekOffset(newOffset);
    const newWeekInfo = getWeekInfoSaoPaulo(newOffset);
    const todayInNewWeek = newWeekInfo.days.find((d) => d.isToday);
    setSelectedDayKey(
      todayInNewWeek ? todayInNewWeek.dateKey : newWeekInfo.days[0].dateKey,
    );

    // Se voltar para a semana atual e o loader carregou sem erro, restaura instantaneamente
    if (newOffset === 0 && !initialLoaderError) {
      setSchedules(initialSchedules);
      setLoading(false);
      setError(null);
      return;
    }

    void loadScheduleData(newOffset);
  };

  // Agrupa os animes por dia da semana no fuso horário America/Sao_Paulo
  const episodesByDay = useMemo(() => {
    const map = new Map<string, AiringScheduleItem[]>();

    for (const day of weekInfo.days) {
      map.set(day.dateKey, []);
    }

    for (const item of schedules) {
      const localKey = getDayKeySaoPaulo(item.airingAt);
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
    <div className="space-y-6 pb-16">
      {/* =========================================================
          CABEÇALHO DA PÁGINA: ESTILO TEMPORADAS (HIKARI)
      ========================================================== */}
      <header className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-r from-[#120f24] via-[#0d0b17] to-[#0a0814] p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
        <div className="absolute -right-12 -top-12 size-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-xl border border-purple-500/35 bg-purple-500/15 px-3 py-1 text-xs font-semibold text-purple-300 shadow-sm">
              <CalendarIcon className="size-3.5 text-purple-400" />
              <span>Programação Oficial</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-fg">
              Calendário da Semana
            </h1>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto bg-black/40 border border-white/10 rounded-2xl p-1.5 backdrop-blur-md">
            <button
              type="button"
              onClick={() => handleWeekChange(weekOffset - 1)}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-purple-500/20 hover:text-purple-300 text-xs font-semibold text-muted transition-colors"
            >
              Semana Anterior
            </button>
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => handleWeekChange(0)}
                className="px-3 py-2 rounded-xl bg-purple-500 text-white hover:bg-purple-600 text-xs font-semibold transition-colors shadow-md shadow-purple-500/20"
              >
                Hoje
              </button>
            )}
            <button
              type="button"
              onClick={() => handleWeekChange(weekOffset + 1)}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-purple-500/20 hover:text-purple-300 text-xs font-semibold text-muted transition-colors"
            >
              Próxima Semana
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================
          DIAS DA SEMANA: SEGUNDA A DOMINGO (SEM O SELETOR INDEVIDO)
      ========================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1 text-xs text-muted">
          <span className="font-medium">
            Período: <strong className="text-fg font-semibold">Semana de {weekInfo.weekRangeLabel}</strong>
          </span>
          <span className="tabular-nums text-purple-300 font-medium">
            {loading ? "Carregando..." : `${totalWeekEpisodes} lançamentos programados`}
          </span>
        </div>

        {/* Grade de 7 dias da semana: Segunda a Domingo */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 w-full">
          {weekInfo.days.map((day) => {
            const count = episodesByDay.get(day.dateKey)?.length ?? 0;
            const isSelected = selectedDayKey === day.dateKey;

            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => setSelectedDayKey(day.dateKey)}
                className={`flex flex-col items-center justify-center rounded-2xl py-3 px-1 sm:py-4 sm:px-2 text-center transition-all min-w-0 border ${
                  isSelected
                    ? "border-purple-500 bg-gradient-to-b from-purple-500/25 to-purple-600/15 text-white shadow-lg shadow-purple-500/20 ring-1 ring-purple-500"
                    : "border-white/10 bg-[#120f24]/70 text-muted hover:border-purple-500/40 hover:bg-[#181530] hover:text-fg"
                }`}
              >
                {/* Nome do dia: abreviado em telas pequenas, completo em telas maiores */}
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider truncate w-full text-center">
                  <span className="sm:hidden">{day.shortName}</span>
                  <span className="hidden sm:inline">{day.cleanName}</span>
                </span>

                {/* Data: DD/MM */}
                <span className="mt-1 text-xs sm:text-base font-bold text-fg leading-none">
                  {day.dateStr}
                </span>

                {/* Indicador 'Hoje' ou Quantidade */}
                <div className="mt-2 flex items-center justify-center">
                  {day.isToday ? (
                    <span className="rounded-full bg-purple-500 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider leading-none shadow-sm">
                      Hoje
                    </span>
                  ) : (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${
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
          <div className="mb-4 flex w-full items-center justify-between border-b border-purple-500/25 pb-3">
            <div>
              <h2 className="text-lg font-bold text-fg capitalize">
                {activeDay.fullDateStr}
              </h2>
              <p className="text-xs text-subtle">
                {activeDayEpisodes.length}{" "}
                {activeDayEpisodes.length === 1
                  ? "lançamento programado"
                  : "lançamentos programados"}
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
