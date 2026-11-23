import { createFileRoute, Link } from "@tanstack/react-router";
import { memo, useState, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Search as SearchIcon, Film, Clapperboard } from "lucide-react";
import { useHikariStore } from "@/lib/store";
import {
  isPublishedEpisodeDubbed,
  resolveEpisodeThumbnailUrl,
  resolvePublicEpisodes,
  type PublishedEpisode,
} from "@/lib/published-episodes";
import {
  executeGetPaginatedPublicCatalogEpisodes,
  getPaginatedPublicCatalogEpisodes,
  executeGetPublicCatalogAnimeOptions,
  getPublicCatalogAnimeOptionsFn,
} from "@/lib/catalog-episodes";
import { HikariImage } from "@/components/ui/hikari-image";
import { anilistImage } from "@/lib/image-utils";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { triggerMonetagSmartLinkOnNavigationClick } from "@/lib/monetag-smartlink";
import {
  formatEpisodeRelativeTime,
  getNextEpisodeRelativeTickMs,
} from "@/lib/relative-published-time";

export interface EpisodesSearch {
  page?: number;
  q?: string;
  animeId?: string;
}

const CLIENT_ANIME_OPTIONS_TTL_MS = 180 * 1000;
let clientCachedAnimeOptions: {
  data: Awaited<ReturnType<typeof executeGetPublicCatalogAnimeOptions>>;
  timestamp: number;
} | null = null;

function useRelativeEpisodesNow(
  episodes: ReadonlyArray<
    Pick<PublishedEpisode, "published" | "publishedTimestamp">
  >,
): number {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const nowMsRef = useRef(nowMs);
  nowMsRef.current = nowMs;

  useEffect(() => {
    if (typeof window === "undefined" || episodes.length === 0) {
      return;
    }

    let timerId: number | null = null;

    const clearTimer = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    };

    const syncIfChanged = (forceFreshOnStale = false) => {
      const currentNow = Date.now();
      const prevNow = nowMsRef.current;
      const changed =
        (forceFreshOnStale && currentNow - prevNow > 5_000) ||
        episodes.some(
          (ep) =>
            formatEpisodeRelativeTime(ep.publishedTimestamp, prevNow, {
              published: ep.published,
            }) !==
            formatEpisodeRelativeTime(ep.publishedTimestamp, currentNow, {
              published: ep.published,
            }),
        );
      if (changed) {
        nowMsRef.current = currentNow;
        setNowMs(currentNow);
      }
      return currentNow;
    };

    const scheduleNext = (referenceNow: number) => {
      clearTimer();
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      const delay = getNextEpisodeRelativeTickMs(episodes, referenceNow);
      if (delay === null) return;

      timerId = window.setTimeout(() => {
        const updatedNow = syncIfChanged(false);
        scheduleNext(updatedNow);
      }, delay);
    };

    const initialNow = syncIfChanged(true);
    scheduleNext(initialNow);

    const handleVisibilityOrFocus = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        clearTimer();
        return;
      }
      const updatedNow = syncIfChanged(true);
      scheduleNext(updatedNow);
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [episodes]);

  return nowMs;
}

const AllEpisodesCard = memo(function AllEpisodesCard({
  episode,
  eager = false,
  relativeTimeNowMs,
}: {
  episode: PublishedEpisode;
  eager?: boolean;
  relativeTimeNowMs: number;
}) {
  const isDub = useMemo(() => isPublishedEpisodeDubbed(episode), [episode]);

  const rawThumb = resolveEpisodeThumbnailUrl({
    thumbnail: episode.thumbnail,
    videoUrl: episode.videoUrl,
  });
  const optimizedThumb = rawThumb ? anilistImage(rawThumb, 480) : "";
  const hasValidThumbnail = Boolean(optimizedThumb);

  const relativePublishedLabel = formatEpisodeRelativeTime(
    episode.publishedTimestamp,
    relativeTimeNowMs,
    { published: episode.published },
  );

  return (
    <article className="group relative w-full episode-card-cv">
      <Link
        to="/watch/$id/$ep"
        params={{ id: episode.animeId, ep: `ep-${episode.episodeNumber || 1}` }}
        preload="intent"
        resetScroll={true}
        onClick={triggerMonetagSmartLinkOnNavigationClick}
        className={cn(
          "block group select-none touch-manipulation [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80 rounded-xl",
          "motion-safe:transition-[transform,opacity] motion-safe:duration-150 motion-safe:active:scale-[0.98] motion-safe:active:opacity-85 motion-reduce:transition-none motion-reduce:transform-none",
        )}
      >
        <div
          className={cn(
            "relative aspect-video w-full overflow-hidden rounded-xl bg-[#0f0d1a] border border-purple-500/15 transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none",
            "[@media(hover:hover)]:group-hover:border-purple-400/50 [@media(hover:hover)]:group-hover:shadow-[0_8px_20px_-4px_rgba(168,85,247,0.25)]",
            "group-active:border-purple-400/80",
          )}
        >
          {hasValidThumbnail ? (
            <HikariImage
              src={optimizedThumb}
              fallbackSrc={
                rawThumb && optimizedThumb !== rawThumb ? rawThumb : undefined
              }
              alt={episode.animeTitle}
              width={480}
              height={270}
              priority={eager}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={eager ? "high" : "low"}
              defer={!eager}
              fallback={
                <div className="flex size-full items-center justify-center bg-[#131022] text-purple-400/40">
                  <Film className="size-8" />
                </div>
              }
              fallbackClassName="bg-[#0f0d1a]"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-[#131022] text-purple-400/40">
              <Film className="size-8" />
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent opacity-60" />

          {isDub && (
            <div className="absolute top-2 left-2 flex items-center z-10 select-none pointer-events-none">
              <span
                data-badge="dub"
                className="inline-flex items-center justify-center h-[18px] px-1.5 rounded bg-emerald-600/95 border border-emerald-300/50 text-[9px] font-bold tracking-wider text-white shadow-sm leading-none uppercase"
              >
                DUB
              </span>
            </div>
          )}
        </div>

        <div className="mt-2 px-0.5 space-y-0.5">
          <h4
            title={episode.animeTitle}
            className="text-[13px] sm:text-sm md:text-[15px] font-semibold leading-snug text-sky-400 line-clamp-2 break-words transition-colors motion-reduce:transition-none [@media(hover:hover)]:group-hover:text-sky-300 group-active:text-sky-200"
          >
            {episode.animeTitle}
          </h4>

          <p className="text-[11px] sm:text-xs font-medium text-zinc-400 truncate">
            Episódio {episode.episodeNumber}
          </p>

          {relativePublishedLabel && (
            <p
              data-testid="episode-relative-time"
              suppressHydrationWarning
              className="text-[11px] sm:text-xs font-normal text-zinc-400/80 truncate"
            >
              {relativePublishedLabel}
            </p>
          )}
        </div>
      </Link>
    </article>
  );
});

export const Route = createFileRoute("/episodes")({
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 20,
  validateSearch: (search: Record<string, unknown>): EpisodesSearch => {
    const parsedPage = Number(search.page);
    const page = Number.isFinite(parsedPage) && parsedPage > 1 ? Math.floor(parsedPage) : 1;
    const q = typeof search.q === "string" && search.q.trim() ? search.q.trim() : undefined;
    const animeId =
      typeof search.animeId === "string" && search.animeId.trim() && search.animeId !== "all"
        ? search.animeId.trim()
        : undefined;
    return { page, q, animeId };
  },
  loaderDeps: ({ search }) => ({
    page: search.page ?? 1,
    q: search.q,
    animeId: search.animeId,
  }),
  loader: async ({ deps }) => {
    const page = deps.page;
    const q = deps.q;
    const animeId = deps.animeId;

    const isClient = typeof window !== "undefined";
    const hasFreshClientOptions =
      isClient &&
      clientCachedAnimeOptions &&
      Date.now() - clientCachedAnimeOptions.timestamp < CLIENT_ANIME_OPTIONS_TTL_MS;

    const [paginatedResult, animeOptions] = await Promise.all([
      (!isClient
        ? executeGetPaginatedPublicCatalogEpisodes({ page, pageSize: 24, q, animeId })
        : getPaginatedPublicCatalogEpisodes({ data: { page, pageSize: 24, q, animeId } })
      ).catch((err) => ({
        status: "error" as const,
        episodes: [],
        totalCount: 0,
        page,
        pageSize: 24,
        totalPages: 0,
        error: String(err),
      })),
      hasFreshClientOptions && clientCachedAnimeOptions
        ? Promise.resolve(clientCachedAnimeOptions.data)
        : (!isClient
            ? executeGetPublicCatalogAnimeOptions()
            : getPublicCatalogAnimeOptionsFn()
          )
            .then((opts) => {
              if (isClient && Array.isArray(opts) && opts.length > 0) {
                clientCachedAnimeOptions = {
                  data: opts,
                  timestamp: Date.now(),
                };
              }
              return opts;
            })
            .catch(() => clientCachedAnimeOptions?.data ?? []),
    ]);

    return {
      paginatedResult,
      animeOptions,
    };
  },
  component: AllEpisodesPage,
});

function AllEpisodesPage() {
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const loaderData = Route.useLoaderData();
  const animes = useHikariStore((s) => s.animes);
  const hydrated = useHikariStore((s) => s.hydrated);

  const [search, setSearch] = useState(searchParams.q ?? "");

  // Sincroniza input de busca local quando searchParams.q mudar na URL
  useEffect(() => {
    setSearch(searchParams.q ?? "");
  }, [searchParams.q]);

  const paginatedResult = loaderData?.paginatedResult;
  const animeOptions = loaderData?.animeOptions ?? [];
  const selectedAnime = searchParams.animeId ?? "all";

  // Resolve episódios publicados paginados com fallback local seguro
  const paginatedEpisodes = useMemo(() => {
    return resolvePublicEpisodes(
      paginatedResult
        ? {
            ...paginatedResult,
            total: paginatedResult.totalCount,
          }
        : null,
      animes,
    );
  }, [paginatedResult, animes]);

  const relativeNowMs = useRelativeEpisodesNow(paginatedEpisodes);

  const totalPages = paginatedResult?.totalPages ?? 1;
  const currentPage = paginatedResult?.page ?? 1;
  const totalCount =
    paginatedResult?.status === "success"
      ? paginatedResult.totalCount
      : paginatedEpisodes.length;

  const handleAnimeChange = (animeId: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        animeId: animeId === "all" ? undefined : animeId,
        page: 1,
      }),
      replace: true,
    });
  };

  const handleSearchChange = (term: string) => {
    setSearch(term);
    navigate({
      search: (prev) => ({
        ...prev,
        q: term.trim() ? term.trim() : undefined,
        page: 1,
      }),
      replace: true,
    });
  };

  const handlePageChange = (newPage: number) => {
    navigate({
      search: (prev) => ({
        ...prev,
        page: newPage,
      }),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-4 pt-3 pb-12 sm:space-y-6 sm:pt-5">
      {/* Cabeçalho compacto com título e contador */}
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="font-section text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white">
          Todos os Episódios
        </h1>

        <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-purple-950/60 border border-purple-500/30 px-3 py-1 text-xs font-semibold text-purple-200 tabular-nums">
          <span>{totalCount}</span>
          <span className="text-zinc-400 font-normal">
            {totalCount === 1 ? "episódio encontrado" : "episódios encontrados"}
          </span>
        </div>
      </header>

      {/* Barra de Filtros e Busca Rápida */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 sm:gap-3">
        {/* Campo de Busca */}
        <div className="relative sm:col-span-7 md:col-span-8">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar por anime ou número do episódio…"
            className="pl-9 h-11 sm:h-10 bg-surface/80 border-purple-500/20 text-sm focus:border-purple-400"
          />
        </div>

        {/* Filtro por Anime */}
        <div className="sm:col-span-5 md:col-span-4">
          <NativeSelect
            value={selectedAnime}
            onChange={(e) => handleAnimeChange(e.target.value)}
            aria-label="Filtrar por anime"
            className="h-11 sm:h-10 bg-surface/80 border-purple-500/20 text-sm"
          >
            <option value="all">{`Todos os animes (${animeOptions.length})`}</option>
            {animeOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.title}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {/* Lista de Episódios */}
      {!hydrated ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-full">
              <div className="aspect-video animate-pulse rounded-xl bg-elevated/70 border border-purple-500/10" />
              <div className="mt-2 px-0.5 space-y-1.5">
                <div className="h-3.5 w-4/5 rounded bg-purple-950/40 animate-pulse" />
                <div className="h-3 w-1/3 rounded bg-purple-950/30 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : paginatedEpisodes.length === 0 ? (
        <div className="rounded-2xl border border-purple-500/15 bg-surface/40 px-6 py-16 sm:py-20 text-center">
          <Clapperboard className="mx-auto size-12 text-zinc-500" />
          <h2 className="mt-4 font-section text-xl font-bold text-white">
            Nenhum episódio publicado
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-zinc-400">
            {paginatedResult?.status === "error"
              ? "Não foi possível conectar ao servidor de episódios no momento. Exibindo catálogo local quando disponível."
              : searchParams.q || selectedAnime !== "all"
                ? "Nenhum episódio corresponde aos filtros de busca selecionados."
                : "Ainda não há episódios cadastrados pelo administrador no Hikari. Novos lançamentos aparecerão aqui automaticamente."}
          </p>
          {searchParams.q || selectedAnime !== "all" ? (
            <button
              type="button"
              onClick={() => {
                navigate({
                  search: {},
                  replace: true,
                });
              }}
              className="mt-5 inline-flex items-center rounded-lg bg-purple-950/60 border border-purple-500/40 px-4 py-2 text-xs font-semibold text-purple-200 transition-colors hover:bg-purple-900/70 hover:text-white"
            >
              Limpar filtros
            </button>
          ) : (
            <Link
              to="/"
              className="mt-5 inline-flex items-center rounded-lg bg-purple-950/60 border border-purple-500/40 px-4 py-2 text-xs font-semibold text-purple-200 transition-colors hover:bg-purple-900/70 hover:text-white"
            >
              Voltar ao catálogo principal
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Grade de 2 colunas lado a lado, priorizando legibilidade mobile */}
          <div
            data-testid="episodes-grid"
            className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5"
          >
            {paginatedEpisodes.map((episode, idx) => (
              <AllEpisodesCard
                key={`${episode.animeId}-${episode.episodeId}`}
                episode={episode}
                eager={idx < 4}
                relativeTimeNowMs={relativeNowMs}
              />
            ))}
          </div>

          {/* Paginação para Navegação em Grandes Catálogos */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-4 sm:pt-6">
              <button
                type="button"
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                aria-label="Página anterior"
                className="flex size-11 sm:size-9 items-center justify-center rounded-lg border border-purple-500/20 bg-surface text-zinc-300 transition-colors hover:bg-elevated hover:text-white disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </button>

              <span className="px-3 text-xs font-medium text-zinc-400 tabular-nums">
                Página <strong className="text-white font-bold">{currentPage}</strong> de {totalPages}
              </span>

              <button
                type="button"
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Próxima página"
                className="flex size-11 sm:size-9 items-center justify-center rounded-lg border border-purple-500/20 bg-surface text-zinc-300 transition-colors hover:bg-elevated hover:text-white disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
