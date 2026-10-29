import { useMemo } from "react";
import {
  createFileRoute,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { fetchHomeCatalog } from "@/lib/api";
import { useHikariStore } from "@/lib/store";
import { overlayList } from "@/lib/overlay";

import { Hero } from "@/components/hero";
import { AnimeRow } from "@/components/anime-row";
import { RecentEpisodesSection } from "@/components/recent-episodes-section";
import { AnimeCardSkeleton } from "@/components/anime-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  staleTime: 1000 * 60 * 10,
  gcTime: 1000 * 60 * 30,
  loader: () => fetchHomeCatalog(),
  pendingComponent: HomePending,
  errorComponent: HomeError,
  component: Home,
});

function HomePending() {
  return (
    <div className="space-y-6 pt-1 sm:space-y-8">
      <div className="-mx-4 h-56 animate-pulse rounded-2xl border border-purple-500/10 bg-elevated/70 sm:-mx-6 sm:h-72 md:mx-0 md:h-[480px] lg:h-[520px]" />

      <div className="rail -mx-4 gap-3 px-4 sm:-mx-6 sm:gap-3.5 sm:px-6 md:gap-4">
        {Array.from({ length: 8 }, (_, i) => (
          <AnimeCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function HomeError({ error }: ErrorComponentProps) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : typeof error === "string"
        ? error
        : "Tente recarregar.";

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="font-display text-2xl">
        Catálogo indisponível
      </p>

      <p className="mt-2 text-sm text-muted">
        {message}
      </p>

      <div className="mt-5 flex justify-center">
        <Button
          variant="outline"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          }}
        >
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

function Home() {
  const data = Route.useLoaderData();

  const locals = useHikariStore((s) => s.animes);

  const trending = overlayList(data.trending, locals);
  const popular = overlayList(data.popular, locals);
  const season = overlayList(data.season, locals);

  // Combina dados reais de tendências recentes (sort: TRENDING_DESC) e popularidade geral (sort: POPULARITY_DESC) do AniList
  const trendingAndPopular = useMemo(() => {
    const scoreMap = new Map<string, { anime: (typeof trending)[number]; score: number }>();

    // Tendências recentes reais (AniList TRENDING_DESC)
    trending.forEach((item, index) => {
      const trendScore = (trending.length - index) * 1.5;
      scoreMap.set(item.id, { anime: item, score: trendScore });
    });

    // Popularidade geral real (AniList POPULARITY_DESC)
    popular.forEach((item, index) => {
      const popScore = popular.length - index;
      const existing = scoreMap.get(item.id);
      if (existing) {
        existing.score += popScore;
      } else {
        scoreMap.set(item.id, { anime: item, score: popScore });
      }
    });

    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.anime)
      .slice(0, 10);
  }, [trending, popular]);

  const featured = trending[0] ?? popular[0];

  const featuredItems = [
    ...trending,
    ...popular.filter(
      (a) => !trending.some((t) => t.id === a.id),
    ),
  ].slice(0, 6);

  return (
    <div className="space-y-8 pb-12 sm:space-y-11 md:space-y-14">
      {featured ? (
        <Hero
          anime={featured}
          animes={featuredItems}
        />
      ) : (
        <HomePending />
      )}

      {/* Seção 1: Selecionados */}
      <AnimeRow
        id="selecionados"
        title="Selecionados"
        eyebrow="TENDÊNCIAS & POPULARIDADE"
        iconType="flame"
        items={trendingAndPopular}
        showBookmark={false}
        showRank={false}
        resetScrollOnReturn
      />

      {/* Seção 2: Últimos Episódios (publicados pelo administrador) */}
      <RecentEpisodesSection />

      {/* Seção 3: Animes da Temporada */}
      <AnimeRow
        title="Animes da Temporada"
        eyebrow="SIMULCAST SEMANAL"
        tag={`${data.seasonName} ${data.seasonYear}`}
        iconType="calendar"
        href="/browse/season"
        items={season}
        showBookmark={false}
        showRank={false}
      />

      {/* Rodapé Elegante com indicação de catálogo */}
      <div className="pt-6 pb-2 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-purple-500/20 px-4 py-1.5 text-xs text-zinc-400 shadow-sm">
          <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
          <span>
            Catálogo atualizado via{" "}
            <strong className="text-zinc-200 font-semibold">
              {data.source === "anilist"
                ? "AniList"
                : data.source === "kitsu"
                  ? "Kitsu"
                  : data.source === "jikan"
                    ? "MyAnimeList"
                    : "Servidor Seguro"}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}
