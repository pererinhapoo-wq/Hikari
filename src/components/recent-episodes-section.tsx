import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useHikariStore } from "@/lib/store";
import {
  getRecentEpisodesSection,
  resolvePublicRecentEpisodes,
  type PublishedEpisode,
} from "@/lib/published-episodes";
import type { PublicEpisodesResult } from "@/lib/catalog-episodes";
import { EpisodeCard } from "@/components/episode-card";

function EpisodeCardSkeleton() {
  return (
    <div className="w-full">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg sm:rounded-xl bg-[#0f0d1a] border border-purple-500/15 animate-pulse" />
      <div className="mt-1.5 sm:mt-2.5 px-0.5 space-y-1 sm:space-y-1.5">
        <div className="h-3 sm:h-3.5 w-3/4 rounded bg-purple-950/40 animate-pulse" />
        <div className="h-2.5 sm:h-3 w-1/3 rounded bg-purple-950/30 animate-pulse" />
      </div>
    </div>
  );
}

export function RecentEpisodesSection({
  serverResult,
  initialEpisodes,
  title = "Episódios Recentes",
}: {
  serverResult?: PublicEpisodesResult | null;
  initialEpisodes?: PublishedEpisode[];
  title?: string;
}) {
  const animes = useHikariStore((s) => s.animes);
  const hydrated = useHikariStore((s) => s.hydrated);

  const displayEpisodes = useMemo(() => {
    if (initialEpisodes && initialEpisodes.length > 0) {
      return initialEpisodes;
    }
    if (serverResult !== undefined) {
      return resolvePublicRecentEpisodes(serverResult, animes);
    }
    return getRecentEpisodesSection(animes);
  }, [serverResult, initialEpisodes, animes]);

  const hasEpisodes = displayEpisodes.length > 0;
  const isLoading = !hydrated && !hasEpisodes && serverResult === undefined;

  // Se já hidratou e não houver episódios publicados, oculta a seção sem deixar espaços vazios
  if (hydrated && !hasEpisodes) {
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
              {title}
            </h2>
            {!isLoading && displayEpisodes.length > 0 && (
              <span className="hidden sm:inline-flex shrink-0 rounded-full bg-purple-950/50 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300/80">
                {displayEpisodes.length} {displayEpisodes.length === 1 ? "episódio" : "episódios"}
              </span>
            )}
          </div>
        </div>

        {/* Botão Ver todos discreto e elegante */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/episodes"
            className="inline-flex items-center rounded-md bg-purple-950/30 border border-purple-500/20 px-2.5 py-1 text-xs font-medium text-purple-300 transition-all duration-200 hover:bg-purple-900/40 hover:border-purple-400/40 hover:text-white"
          >
            Ver todos
          </Link>
        </div>
      </div>

      {isLoading ? (
        /* Grade de carregamento em 2 colunas lado a lado */
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 md:gap-4.5">
          {Array.from({ length: 6 }, (_, i) => (
            <EpisodeCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        /* Grade de exatamente 2 colunas (dois cards por linha, lado a lado) */
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 md:gap-4.5">
          {recentEpisodes.map((episode, idx) => (
            <EpisodeCard
              key={`${episode.animeId}-${episode.episodeId}`}
              episode={episode}
              priority={false}
              defer={idx !== 0}
              first={idx === 0}
            />
          ))}
        </div>
      )}
    </section>
  );
}
