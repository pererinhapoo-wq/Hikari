import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Search as SearchIcon, Film, Clapperboard } from "lucide-react";
import { useHikariStore } from "@/lib/store";
import { getAllPublishedEpisodes } from "@/lib/published-episodes";
import { EpisodeCard } from "@/components/episode-card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

export const Route = createFileRoute("/episodes")({
  component: AllEpisodesPage,
});

const ITEMS_PER_PAGE = 24;

function AllEpisodesPage() {
  const animes = useHikariStore((s) => s.animes);
  const hydrated = useHikariStore((s) => s.hydrated);

  const [search, setSearch] = useState("");
  const [selectedAnime, setSelectedAnime] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Todos os episódios publicados, ordenados do mais recente para o mais antigo
  const allEpisodes = useMemo(() => {
    return getAllPublishedEpisodes(animes);
  }, [animes]);

  // Lista única de animes que possuem episódios para o filtro
  const animeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const ep of allEpisodes) {
      if (!map.has(ep.animeId)) {
        map.set(ep.animeId, ep.animeTitle);
      }
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [allEpisodes]);

  // Filtra por termo de busca e anime selecionado
  const filteredEpisodes = useMemo(() => {
    const q = search.trim().toLowerCase();

    return allEpisodes.filter((ep) => {
      if (selectedAnime !== "all" && ep.animeId !== selectedAnime) {
        return false;
      }
      if (!q) return true;

      const matchAnime = ep.animeTitle.toLowerCase().includes(q);
      const matchEpisode =
        ep.episodeTitle.toLowerCase().includes(q) ||
        String(ep.episodeNumber) === q ||
        `episodio ${ep.episodeNumber}`.includes(q) ||
        `ep ${ep.episodeNumber}`.includes(q);

      return matchAnime || matchEpisode;
    });
  }, [allEpisodes, search, selectedAnime]);

  // Paginação otimizada para suportar centenas ou milhares de episódios
  const totalPages = Math.max(1, Math.ceil(filteredEpisodes.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedEpisodes = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEpisodes.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEpisodes, currentPage]);

  const handleAnimeChange = (animeId: string) => {
    setSelectedAnime(animeId);
    setPage(1);
  };

  const handleSearchChange = (term: string) => {
    setSearch(term);
    setPage(1);
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
            <span>{filteredEpisodes.length}</span>
            <span className="text-zinc-400 font-normal">
              {filteredEpisodes.length === 1 ? "episódio encontrado" : "episódios encontrados"}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-video animate-pulse rounded-xl bg-elevated/70 border border-purple-500/10" />
          ))}
        </div>
      ) : filteredEpisodes.length === 0 ? (
        <div className="rounded-2xl border border-purple-500/15 bg-surface/40 px-6 py-20 text-center">
          <Clapperboard className="mx-auto size-12 text-zinc-500" />
          <h2 className="mt-4 font-section text-xl font-bold text-white">
            Nenhum episódio publicado
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-zinc-400">
            {allEpisodes.length === 0
              ? "Ainda não há episódios cadastrados pelo administrador no Hikari. Novos lançamentos aparecerão aqui automaticamente."
              : "Nenhum episódio corresponde ao filtro de busca selecionado."}
          </p>
          {search || selectedAnime !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedAnime("all");
                setPage(1);
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
          {/* Grade de 3 Colunas com Imagens Horizontais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 md:gap-5">
            {paginatedEpisodes.map((episode) => (
              <EpisodeCard
                key={`${episode.animeId}-${episode.episodeId}`}
                episode={episode}
              />
            ))}
          </div>

          {/* Paginação para Navegação em Grandes Catálogos */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-6">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
