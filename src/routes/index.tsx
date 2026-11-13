import { useEffect, useMemo, useState } from "react";
import {
  createFileRoute,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { fetchHomeCatalog, fetchSeasonSection } from "@/lib/api";
import { useHikariStore } from "@/lib/store";
import { overlayList } from "@/lib/overlay";
import { localToAnime, type SlimAnime } from "@/lib/types";

import { getAnimeLogo } from "@/lib/anime-logos";
import { Hero } from "@/components/hero";
import { AnimeRow } from "@/components/anime-row";
import { TodayEpisodesSection } from "@/components/today-episodes-section";
import { RecentEpisodesSection } from "@/components/recent-episodes-section";
import { resolvePublicRecentEpisodes } from "@/lib/published-episodes";
import {
  executeGetPublicCatalogEpisodes,
  getPublicCatalogEpisodes,
} from "@/lib/catalog-episodes";
import { AnimeCardSkeleton } from "@/components/anime-card";
import { SectionReveal } from "@/components/section-reveal";

function pickHeroItems(trending: SlimAnime[], popular: SlimAnime[]): SlimAnime[] {
  const seen = new Set<string>();
  const merged: SlimAnime[] = [];
  for (const item of [...trending, ...popular]) {
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  const withDistinctBanner = merged.filter((a) => {
    const banner = a.banner?.trim();
    const cover = a.cover?.trim();
    return Boolean(banner && cover && banner !== cover);
  });
  const withoutDistinctBanner = merged.filter((a) => {
    const banner = a.banner?.trim();
    const cover = a.cover?.trim();
    return !(banner && cover && banner !== cover);
  });
  return [...withDistinctBanner, ...withoutDistinctBanner].slice(0, 8);
}

export const Route = createFileRoute("/")({
  staleTime: 1000 * 60 * 10,
  gcTime: 1000 * 60 * 30,
  loader: async () => {
    const [homeCatalog, publicEpisodesResult] = await Promise.all([
      fetchHomeCatalog(),
      (typeof window === "undefined"
        ? executeGetPublicCatalogEpisodes()
        : getPublicCatalogEpisodes()
      ).catch((err) => ({
        status: "error" as const,
        episodes: [],
        total: 0,
        error: String(err),
      })),
    ]);
    return {
      ...homeCatalog,
      publicEpisodesResult,
    };
  },
  head: ({ loaderData }) => {
    const heroCandidates = pickHeroItems(
      loaderData?.trending ?? [],
      loaderData?.popular ?? [],
    );
    const featured = heroCandidates[0] ?? null;
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
        const mobileWebp = logoConfig.webpSrcSet.split(",")[0].trim().split(" ")[0];
        links.push({
          rel: "preload",
          as: "image",
          href: mobileWebp,
          imageSrcSet: logoConfig.webpSrcSet,
          imageSizes: logoConfig.sizes,
          type: "image/webp",
          fetchPriority: "low",
        });
      } else {
        links.push({
          rel: "preload",
          as: "image",
          href: logoConfig.src,
          fetchPriority: "low",
        });
      }
    }

    const homeTitle = "HIKARI — catálogo e streaming de animes";
    const homeDesc =
      "Assista a animes online legendados e dublados em alta definição. Lançamentos da temporada, catálogo completo, calendário semanal e episódios atualizados.";
    const homeUrl = "https://grokhikari.vercel.app/";
    const homeImage = "https://grokhikari.vercel.app/og.jpg";

    return {
      meta: [
        { title: homeTitle },
        { name: "description", content: homeDesc },
        { property: "og:title", content: homeTitle },
        { property: "og:description", content: homeDesc },
        { property: "og:image", content: homeImage },
        { property: "og:url", content: homeUrl },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: "pt_BR" },
        { property: "og:site_name", content: "HIKARI" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: homeTitle },
        { name: "twitter:description", content: homeDesc },
        { name: "twitter:image", content: homeImage },
      ],
      links: [
        ...links,
        {
          rel: "canonical",
          href: homeUrl,
        },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "HIKARI",
            url: homeUrl,
            description: homeTitle,
            inLanguage: "pt-BR",
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${homeUrl}search?q={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
          }),
        },
      ],
    };
  },
  pendingComponent: HomePending,
  errorComponent: HomeError,
  component: Home,
});

export function HomePending() {
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
  const emAltaItems = trending.length > 0 ? trending : popular;

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

  const featuredItems = useMemo(
    () => pickHeroItems(trending, popular),
    [trending, popular],
  );
  const featured = featuredItems[0];

  // Novos Episódios: apenas monta o container de carregamento progressivo se houver episódios cadastrados
  // Prioriza o PostgreSQL como fonte canônica com fallback seguro no catálogo local
  const recentEpisodes = useMemo(() => {
    return resolvePublicRecentEpisodes(data.publicEpisodesResult ?? null, locals);
  }, [data.publicEpisodesResult, locals]);

  const hasRecentEpisodes = recentEpisodes.length > 0;

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

      {/* 1. Episódios de Hoje (prioritário na primeira visualização) */}
      <TodayEpisodesSection initialItems={data.todaySchedule ?? []} />

      {/* 2. Em Alta */}
      <SectionReveal minHeight="260px" rootMargin="300px 0px" lazy={false}>
        <AnimeRow
          title="Em Alta"
          href="/browse/trending"
          items={emAltaItems}
          showBookmark={false}
          showRank={false}
          priorityCount={0}
        />
      </SectionReveal>

      {/* 3. Episódios Recentes (publicados pelo administrador) */}
      {hasRecentEpisodes && (
        <SectionReveal minHeight="380px" rootMargin="300px 0px" lazy={false}>
          <RecentEpisodesSection
            serverResult={data.publicEpisodesResult}
            initialEpisodes={recentEpisodes}
          />
        </SectionReveal>
      )}

      {/* 4. Animes Recém-Adicionados */}
      <SectionReveal minHeight="260px" rootMargin="300px 0px" lazy={false}>
        <AnimeRow
          title="Animes Recém-Adicionados"
          items={recentlyAddedAnimes}
          loading={!hydrated}
          showBookmark={false}
          showRank={false}
          priorityCount={0}
          emptyTitle="Não há dados suficientes de animes recém-adicionados"
          emptyDescription={
            hasLocalWithoutCreationDate
              ? "Os registros encontrados no catálogo local não possuem data de criação ou inclusão válida para ordenação."
              : "Ainda não há animes cadastrados no catálogo próprio do Hikari com data de inclusão registrada, e a fonte externa de catálogo não informa a data de adição à plataforma."
          }
        />
      </SectionReveal>

      {/* 5. Animes da Temporada */}
      <SectionReveal minHeight="260px" rootMargin="300px 0px" lazy={false}>
        <SeasonAnimeRow
          seasonName={data.seasonName}
          seasonYear={data.seasonYear}
          initialItems={data.season && data.season.length > 0 ? data.season : []}
        />
      </SectionReveal>
    </div>
  );
}

function SeasonAnimeRow({
  seasonName,
  seasonYear,
  initialItems = [],
}: {
  seasonName: string;
  seasonYear: number;
  initialItems?: SlimAnime[];
}) {
  const locals = useHikariStore((s) => s.animes);
  const [seasonItems, setSeasonItems] = useState<SlimAnime[]>(initialItems);
  const [loading, setLoading] = useState(initialItems.length === 0);

  useEffect(() => {
    if (seasonItems.length > 0) return;
    let active = true;
    fetchSeasonSection()
      .then((items) => {
        if (active && Array.isArray(items) && items.length > 0) {
          setSeasonItems(items);
        }
      })
      .catch((err) => {
        console.warn("[Hikari] Falha ao carregar temporada sob demanda:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [seasonItems.length]);

  const season = useMemo(
    () => overlayList(seasonItems, locals),
    [seasonItems, locals],
  );

  return (
    <AnimeRow
      title="Animes da Temporada"
      tag={`${seasonName} ${seasonYear}`}
      href="/browse/season"
      items={season}
      loading={loading}
      showBookmark={false}
      showRank={false}
      priorityCount={0}
    />
  );
}
