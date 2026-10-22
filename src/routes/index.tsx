import {
  createFileRoute,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { fetchHomeCatalog } from "@/lib/api";
import { useHikariStore } from "@/lib/store";
import { overlayList } from "@/lib/overlay";

import { Hero } from "@/components/hero";
import { AnimeRow } from "@/components/anime-row";
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

      <div className="rail -mx-4 gap-2.5 px-4 sm:-mx-6 sm:gap-3.5 sm:px-6 md:gap-4">
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
  const top = overlayList(data.top, locals);
  const season = overlayList(data.season, locals);

  const featured = trending[0] ?? popular[0];

  const featuredItems = [
    ...trending,
    ...popular.filter(
      (a) => !trending.some((t) => t.id === a.id),
    ),
  ].slice(0, 6);

  return (
    <div className="space-y-8 pb-12 sm:space-y-10 md:space-y-12">
      {featured ? (
        <Hero
          anime={featured}
          animes={featuredItems}
        />
      ) : (
        <HomePending />
      )}

      <AnimeRow
        title={`Temporada ${data.seasonName} ${data.seasonYear}`}
        href="/browse/season"
        items={season}
      />

      <AnimeRow
        title="Populares"
        href="/browse/popular"
        items={popular}
      />

      <AnimeRow
        title="Mais bem avaliados"
        href="/browse/top"
        items={top}
      />

      <AnimeRow
        title="Em alta"
        href="/browse/trending"
        items={trending.slice(1)}
      />

      <p className="pt-4 text-center text-xs text-subtle">
        Fonte:{" "}
        {data.source === "anilist"
          ? "AniList"
          : data.source === "kitsu"
            ? "Kitsu"
            : data.source === "jikan"
              ? "MyAnimeList / Jikan"
              : "Catálogo seguro"}
      </p>
    </div>
  );
}
