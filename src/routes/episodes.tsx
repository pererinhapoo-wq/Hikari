import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Search as SearchIcon, Film, Clapperboard } from "lucide-react";
import { useHikariStore } from "@/lib/store";
import { resolvePublicEpisodes } from "@/lib/published-episodes";
import {
  executeGetPaginatedPublicCatalogEpisodes,
  getPaginatedPublicCatalogEpisodes,
  executeGetPublicCatalogAnimeOptions,
  getPublicCatalogAnimeOptionsFn,
} from "@/lib/catalog-episodes";
import { EpisodeCard } from "@/components/episode-card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

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

  const totalPages = paginatedResult?.totalPages ?? 1;
  const currentPage = paginatedResult?.page ?? 1;
  const totalCount = paginatedResult?.totalCount ?? paginatedEpisodes.length;

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
    <div className="space-y-6 pt-6 pb-12 sm:space-y-8">
      {/* Navegação de Retorno e Título */}
      <header className="space-y-3">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-white"
          >
            <ChevronLeft className="size-4" />
            <span>Voltar ao início</span>
          </Link>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-purple-400 uppercase">
              <Film className="size-3.5 text-purple-400" />
              <span>Catálogo Completo de Lançamentos</span>
            </div>
            <h1 className="font-section text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white">
              Todos os Episódios
            </h1>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-purple-950/60 border border-purple-500/30 px-3 py-1 text-xs font-semibold text-purple-200">
            <span>{totalCount}</span>
            <span className="text-zinc-400 font-normal">
              {totalCount === 1 ? "episódio encontrado" : "episódios encontrados"}
            </span>
          </div>
        </div>
      </header>

      {/* Barra de Filtros e Busca Rápida */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        {/* Campo de Busca */}
        <div className="relative sm:col-span-7 md:col-span-8">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar por anime ou número do episódio…"
            className="pl-9 h-10 bg-surface/80 border-purple-500/20 text-sm focus:border-purple-400"
          />
        </div>

        {/* Filtro por Anime */}
        <div className="sm:col-span-5 md:col-span-4">
          <NativeSelect
            value={selectedAnime}
            onChange={(e) => handleAnimeChange(e.target.value)}
            aria-label="Filtrar por anime"
            className="h-10 bg-surface/80 border-purple-500/20 text-sm"
          >
            <option value="all">Todos os animes ({animeOptions.length})</option>
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
        <div className="grid grid-cols-3 gap-2 sm:gap-3.5 md:gap-4.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-video animate-pulse rounded-lg sm:rounded-xl bg-elevated/70 border border-purple-500/10" />
          ))}
        </div>
      ) : paginatedEpisodes.length === 0 ? (
        <div className="rounded-2xl border border-purple-500/15 bg-surface/40 px-6 py-20 text-center">
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
          {/* Grade de 3 Colunas com Imagens Horizontais (3 cards por linha) */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3.5 md:gap-4.5">
            {paginatedEpisodes.map((episode) => (
              <EpisodeCard
                key={`${episode.animeId}-${episode.episodeId}`}
                episode={episode}
                showRecentBadges={false}
              />
            ))}
          </div>

          {/* Paginação para Navegação em Grandes Catálogos */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-6">
              <button
                type="button"
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                aria-label="Página anterior"
                className="flex size-9 items-center justify-center rounded-lg border border-purple-500/20 bg-surface text-zinc-300 transition-colors hover:bg-elevated hover:text-white disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </button>

              <span className="px-3 text-xs font-medium text-zinc-400">
                Página <strong className="text-white font-bold">{currentPage}</strong> de {totalPages}
              </span>

              <button
                type="button"
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Próxima página"
                className="flex size-9 items-center justify-center rounded-lg border border-purple-500/20 bg-surface text-zinc-300 transition-colors hover:bg-elevated hover:text-white disabled:pointer-events-none disabled:opacity-30"
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
