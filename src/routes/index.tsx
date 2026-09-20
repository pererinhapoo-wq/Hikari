import {
  createFileRoute,
  Link,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { useEffect, useState } from "react";

import { fetchHomeCatalog } from "@/lib/api";
import { useHikariStore } from "@/lib/store";
import { overlayList } from "@/lib/overlay";

import { Hero } from "@/components/hero";
import { AnimeRow } from "@/components/anime-row";
import { AnimeCardSkeleton } from "@/components/anime-card";

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
      <p className="font-display text-2xl">
        Catálogo indisponível
      </p>

      <p className="mt-2 text-sm text-muted">
        {message}
      </p>
    </div>
  );
}

function Home() {
  const data = Route.useLoaderData();

  const locals = useHikariStore((s) => s.animes);
  const continueWatching = useHikariStore(
    (s) => s.continueWatching,
  );

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

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
    <div className="space-y-5 pb-5 sm:space-y-8">
      {featured ? (
        <Hero
          anime={featured}
          animes={featuredItems}
        />
      ) : (
        <HomePending />
      )}

      {!hydrated ? (
        <section className="space-y-2">
          <div className="h-6" />

          <div className="rail -mx-4 px-4 sm:-mx-6 sm:px-6">
            {Array.from({ length: 3 }, (_, i) => (
              <AnimeCardSkeleton key={i} />
            ))}
          </div>
        </section>
      ) : (
        continueWatching.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-display text-base tracking-tight sm:text-2xl">
              Continuar assistindo
            </h2>

            <div className="rail -mx-4 px-4 sm:-mx-6 sm:px-6">
              {continueWatching.map((c) => (
                <Link
                  key={c.animeId}
                  to="/watch/$id"
                  params={{ id: c.animeId }}
                  search={{ ep: c.episodeId }}
                  className="w-40 shrink-0 overflow-hidden rounded-lg bg-elevated shadow-[var(--shadow-border)] sm:w-52"
                >
                  <div className="aspect-video bg-surface">
                    {c.cover && (
                      <img
                        src={c.cover}
                        alt=""
                        className="size-full object-cover"
                      />
                    )}
                  </div>

                  <div className="px-2.5 py-1.5">
                    <p className="truncate text-xs text-fg">
                      {c.title}
                    </p>

                    <p className="truncate text-[11px] text-muted">
                      Ep. {c.episodeNumber} ·{" "}
                      {c.episodeTitle}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )
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
