import {
  createFileRoute,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { AnimeCardSkeleton } from "@/components/anime-card";
import { AnimeRow } from "@/components/anime-row";
import { Hero } from "@/components/hero";
import { fetchHomeCatalog } from "@/lib/api";
import { overlayList } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";
import { localToAnime } from "@/lib/types";

export const Route = createFileRoute("/")({
  loader: () => fetchHomeCatalog(),
  pendingComponent: HomePending,
  errorComponent: HomeError,
  component: Home,
});

function HomePending() {
  return (
    <div className="space-y-6 pt-3">
      <div className="-mx-4 h-[20rem] animate-pulse bg-elevated sm:-mx-6 sm:h-[27rem]" />
      <div className="rail">
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
      <p className="font-display text-2xl">Catálogo indisponível</p>
      <p className="mt-2 text-sm text-muted">{message}</p>
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

  const added = locals
    .filter((a) => !a.hidden && !a.anilistId)
    .map(localToAnime);

  return (
    <div className="space-y-5 pb-5 sm:space-y-8">
      {featured ? (
        <Hero anime={featured} animes={featuredItems} />
      ) : (
        <HomePending />
      )}

      {added.length > 0 && (
        <AnimeRow
          title="Últimos Lançamentos"
          items={added}
        />
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

      <p className="pt-4 text-center text-[11px] text-subtle">
        Fonte:{" "}
        {data.source === "anilist"
          ? "AniList"
          : "MyAnimeList / Jikan"}
      </p>
    </div>
  );
      }
