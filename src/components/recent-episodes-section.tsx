import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useHikariStore } from "@/lib/store";
import { getRecentEpisodesSection } from "@/lib/published-episodes";
import { EpisodeCard } from "@/components/episode-card";

export function RecentEpisodesSection() {
  const animes = useHikariStore((s) => s.animes);
  const hydrated = useHikariStore((s) => s.hydrated);

  const displayEpisodes = useMemo(() => {
    return getRecentEpisodesSection(animes);
  }, [animes]);

  // Se não houver episódios publicados, oculta a seção sem deixar espaços vazios
  if (!hydrated || displayEpisodes.length === 0) {
    return null;
  }

  // Exibe no máximo 18 episódios selecionados para a vitrine
  const recentEpisodes = displayEpisodes.slice(0, 18);

  return (
    <section className="space-y-3 sm:space-y-4 [content-visibility:auto] [contain-intrinsic-size:auto_600px]">
      {/* Cabeçalho da Seção com Botão Ver todos alinhado à direita */}
      <div className="flex items-center justify-between gap-3 px-0.5">
        <div className="min-w-0 flex-1">
          {/* Título da Seção */}
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-section text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white drop-shadow-sm truncate">
              Novos Episódios
            </h2>
            <span className="hidden sm:inline-flex shrink-0 rounded-full bg-purple-950/50 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300/80">
              {displayEpisodes.length} {displayEpisodes.length === 1 ? "episódio" : "episódios"}
            </span>
          </div>
        </div>

        {/* Botão Ver todos discreto e elegante */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/episodes"
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
            Ver todos
          </Link>
        </div>
      </div>

      {/* Grade de 2 colunas no mobile e 3 colunas em telas maiores */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5 md:gap-4.5">
        {recentEpisodes.map((episode) => (
          <EpisodeCard
            key={`${episode.animeId}-${episode.episodeId}`}
            episode={episode}
          />
        ))}
      </div>
    </section>
  );
}
