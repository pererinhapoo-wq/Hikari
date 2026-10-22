import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useHikariStore } from "@/lib/store";
import { getAllPublishedEpisodes } from "@/lib/published-episodes";
import { EpisodeCard } from "@/components/episode-card";

export function RecentEpisodesSection() {
  const animes = useHikariStore((s) => s.animes);
  const hydrated = useHikariStore((s) => s.hydrated);

  const allEpisodes = useMemo(() => {
    return getAllPublishedEpisodes(animes);
  }, [animes]);

  // Se não houver episódios publicados, oculta a seção sem deixar espaços vazios
  if (!hydrated || allEpisodes.length === 0) {
    return null;
  }

  // Exibe no máximo 18 episódios mais recentes (até 6 linhas de 3 cards lado a lado)
  const recentEpisodes = allEpisodes.slice(0, 18);

  return (
    <section className="space-y-3 sm:space-y-4 [content-visibility:auto]">
      {/* Cabeçalho da Seção com Botão Ver todos alinhado à direita */}
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
          {/* Eyebrow sem ícone ou emoji */}
          <div className="text-[10px] sm:text-[11px] font-bold tracking-widest text-purple-400 uppercase">
            LANÇAMENTOS NO HIKARI
          </div>

          {/* Título da Seção */}
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-section text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white drop-shadow-sm truncate">
              Últimos Episódios
            </h2>
            <span className="hidden sm:inline-flex shrink-0 rounded-full bg-purple-950/50 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300/80">
              {allEpisodes.length} {allEpisodes.length === 1 ? "episódio" : "episódios"}
            </span>
          </div>
        </div>

        {/* Botão Ver todos discreto e elegante */}
        <div className="flex shrink-0 items-center gap-2 mb-0.5">
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

      {/* Grade de 3 Colunas Lado a Lado (3 cards por linha, até 6 linhas de 3 cards) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3.5 md:gap-4.5">
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
