import { lazy, Suspense, useMemo } from "react";
import {
  createFileRoute,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { fetchHomeCatalog } from "@/lib/api";
import { useHikariStore } from "@/lib/store";
import { overlayList } from "@/lib/overlay";
import { localToAnime } from "@/lib/types";

import { getAnimeLogo } from "@/lib/anime-logos";
import { Hero } from "@/components/hero";
import { AnimeRow } from "@/components/anime-row";
import { TodayEpisodesSection } from "@/components/today-episodes-section";
import { AnimeCardSkeleton } from "@/components/anime-card";
import { HomeFooter } from "@/components/home-footer";

const LazyRecentEpisodesSection = lazy(() =>
  import("@/components/recent-episodes-section").then((m) => ({
    default: m.RecentEpisodesSection,
  })),
);

export const Route = createFileRoute("/")({
  staleTime: 1000 * 60 * 10,
  gcTime: 1000 * 60 * 30,
  loader: () => fetchHomeCatalog(),
  head: ({ loaderData }) => {
    const featured =
      loaderData?.trending?.[0] ?? loaderData?.popular?.[0] ?? null;
    if (!featured) {
      return {};
    }

    const mobileBackdrop =
      featured.cover?.trim() || featured.banner?.trim() || "";
    const desktopBackdrop =
      featured.banner?.trim() || featured.cover?.trim() || "";

    const links: Array<{
      rel: string;
      as: string;
      href: string;
      media?: string;
      imageSrcSet?: string;
      imageSizes?: string;
      type?: string;
      fetchPriority?: "high" | "auto" | "low";
    }> = [];

    if (
      mobileBackdrop &&
      desktopBackdrop &&
      mobileBackdrop !== desktopBackdrop
    ) {
      links.push(
        {
          rel: "preload",
          as: "image",
          href: mobileBackdrop,
          media: "(max-width: 767.98px)",
          fetchPriority: "high",
        },
        {
          rel: "preload",
          as: "image",
          href: desktopBackdrop,
          media: "(min-width: 768px)",
          fetchPriority: "high",
        },
      );
    } else if (mobileBackdrop || desktopBackdrop) {
      links.push({
        rel: "preload",
        as: "image",
        href: mobileBackdrop || desktopBackdrop,
        fetchPriority: "high",
      });
    }

    const logoConfig = getAnimeLogo(featured);
    if (logoConfig?.src) {
      if (logoConfig.webpSrcSet) {
        links.push({
          rel: "preload",
          as: "image",
          href: logoConfig.src,
          imageSrcSet: logoConfig.webpSrcSet,
          imageSizes: logoConfig.sizes,
          type: "image/webp",
          fetchPriority: "high",
        });
      } else {
        links.push({
          rel: "preload",
          as: "image",
          href: logoConfig.src,
          fetchPriority: "high",
        });
      }
    }

    return { links };
  },
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
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-transparent px-4 text-sm font-medium text-fg shadow-[var(--shadow-border)] transition-[background-color,color,opacity,transform,box-shadow] duration-150 ease-[var(--ease-out)] hover:bg-elevated hover:shadow-[var(--shadow-border-hover)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          }}
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

function Home() {
  const data = Route.useLoaderData();

  const locals = useHikariStore((s) => s.animes);
  const hydrated = useHikariStore((s) => s.hydrated);

  const trending = useMemo(
    () => overlayList(data.trending, locals),
    [data.trending, locals],
  );
  const popular = useMemo(
    () => overlayList(data.popular, locals),
    [data.popular, locals],
  );
  const season = useMemo(
    () => overlayList(data.season, locals),
    [data.season, locals],
  );
  const emAltaItems = trending.length > 0 ? trending : popular;

  const hasLocalEpisodes = useMemo(
    () =>
      locals.some(
        (a) =>
          !a.hidden &&
          (a.seasons?.some((s) => (s.episodes?.length ?? 0) > 0) ?? false),
      ),
    [locals],
  );

  // Animes Recém-Adicionados: animes incluídos no catálogo próprio do Hikari com data real (createdAt),
  // ordenados do mais recente para o mais antigo
  const { recentlyAddedAnimes, hasLocalWithoutCreationDate } = useMemo(() => {
    const visibleLocals = locals.filter((a) => !a.hidden);
    const withValidCreatedAt = visibleLocals.filter(
      (a) =>
        typeof a.createdAt === "number" &&
        Number.isFinite(a.createdAt) &&
        a.createdAt > 0,
    );

    const sorted = [...withValidCreatedAt]
      .sort(
        (a, b) =>
          b.createdAt - a.createdAt ||
          (b.updatedAt || 0) - (a.updatedAt || 0),
      )
      .slice(0, 18)
      .map(localToAnime);

    return {
      recentlyAddedAnimes: sorted,
      hasLocalWithoutCreationDate:
        visibleLocals.length > 0 && withValidCreatedAt.length === 0,
    };
  }, [locals]);

  const featured = trending[0] ?? popular[0];

  const featuredItems = useMemo(
    () =>
      [
        ...trending,
        ...popular.filter((a) => !trending.some((t) => t.id === a.id)),
      ].slice(0, 8),
    [trending, popular],
  );

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

      {/* 1. Episódios de Hoje */}
      <TodayEpisodesSection initialItems={data.todaySchedule ?? []} />

      {/* 2. Novos Episódios (publicados pelo administrador) */}
      {hydrated && hasLocalEpisodes ? (
        <Suspense fallback={null}>
          <LazyRecentEpisodesSection />
        </Suspense>
      ) : null}

      {/* 3. Em Alta */}
      <AnimeRow
        title="Em Alta"
        href="/browse/trending"
        items={emAltaItems}
        showBookmark={false}
        showRank={false}
      />

      {/* 4. Animes Recém-Adicionados */}
      <AnimeRow
        title="Animes Recém-Adicionados"
        items={recentlyAddedAnimes}
        loading={!hydrated}
        showBookmark={false}
        showRank={false}
        emptyTitle="Não há dados suficientes de animes recém-adicionados"
        emptyDescription={
          hasLocalWithoutCreationDate
            ? "Os registros encontrados no catálogo local não possuem data de criação ou inclusão válida para ordenação."
            : "Ainda não há animes cadastrados no catálogo próprio do Hikari com data de inclusão registrada, e a fonte externa de catálogo não informa a data de adição à plataforma."
        }
      />

      {/* 5. Animes da Temporada */}
      <AnimeRow
        title="Animes da Temporada"
        tag={`${data.seasonName} ${data.seasonYear}`}
        href="/browse/season"
        items={season}
        showBookmark={false}
        showRank={false}
      />

      {/* Rodapé institucional */}
      <HomeFooter />
    </div>
  );
}
