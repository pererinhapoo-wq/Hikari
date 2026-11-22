import { useEffect, useMemo, useState } from "react";
import {
  createFileRoute,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { fetchHomeCatalog, fetchSeasonSection } from "@/lib/api";
import { useHikariStore } from "@/lib/store";
import { overlayList, overlaySeasonList } from "@/lib/overlay";
import {
  countDistinctTitlesWithEpisode,
  selectHomeSectionItems,
} from "@/lib/anime-search-ranking";
import { currentAnimeSeason, type OfficialAnimeSeason } from "@/lib/utils";
import {
  hasLocalPublishedEpisodes,
  localToAnime,
  type SlimAnime,
} from "@/lib/types";

import { getAnimeLogo } from "@/lib/anime-logos";
import {
  anilistImage,
  getResponsiveCoverAttrs,
  withCatalogImageVersion,
} from "@/lib/image-utils";
import { Hero } from "@/components/hero";
import { AnimeRow } from "@/components/anime-row";
import { TodayEpisodesSection } from "@/components/today-episodes-section";
import { RecentEpisodesSection } from "@/components/recent-episodes-section";
import {
  getRecentEpisodesSection,
  resolvePublicRecentEpisodes,
} from "@/lib/published-episodes";
import { getHomePublicEpisodes } from "@/lib/home-episodes.functions";
import { AnimeCardSkeleton } from "@/components/anime-card";
import { SectionReveal } from "@/components/section-reveal";

function pickHeroItems(
  trending: SlimAnime[],
  popular: SlimAnime[],
  fallbackCatalog: SlimAnime[] = [],
): SlimAnime[] {
  const seen = new Set<string>();
  const catalog: SlimAnime[] = [];
  for (const item of [...trending, ...popular, ...fallbackCatalog]) {
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    catalog.push(item);
  }

  const withEpisodeMerged = catalog.filter(
    (item) =>
      item.hasEpisode === true &&
      Boolean(item.banner?.trim() || item.cover?.trim()),
  );

  if (withEpisodeMerged.length > 0) {
    const withDistinctBanner = withEpisodeMerged.filter((a) => {
      const banner = a.banner?.trim();
      const cover = a.cover?.trim();
      return Boolean(banner && cover && banner !== cover);
    });
    const withoutDistinctBanner = withEpisodeMerged.filter((a) => {
      const banner = a.banner?.trim();
      const cover = a.cover?.trim();
      return !(banner && cover && banner !== cover);
    });
    return [...withDistinctBanner, ...withoutDistinctBanner].slice(0, 8);
  }

  const firstWithBanner = catalog.find((item) => Boolean(item.banner?.trim()));
  if (firstWithBanner) {
    return [firstWithBanner];
  }

  const firstWithCover = catalog.find((item) => Boolean(item.cover?.trim()));
  return firstWithCover ? [firstWithCover] : [];
}

export const Route = createFileRoute("/")({
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 30,
  loader: async () => {
    const [homeCatalog, publicEpisodesResult] = await Promise.all([
      fetchHomeCatalog(),
      getHomePublicEpisodes().catch((err: unknown) => ({
        status: "error" as const,
        episodes: [],
        total: 0,
        error: String(err),
      })),
    ]);
    const publicRecentEpisodes = resolvePublicRecentEpisodes(
      publicEpisodesResult,
      [],
    );
    return {
      ...homeCatalog,
      publicRecentEpisodes,
      publicEpisodesStatus: publicEpisodesResult.status,
    };
  },
  head: ({ loaderData }) => {
    const heroCandidates = pickHeroItems(
      loaderData?.trending ?? [],
      loaderData?.popular ?? [],
      loaderData?.season ?? [],
    );
    const featured = heroCandidates[0] ?? null;
    if (!featured) {
      return {};
    }

    const mobileBackdrop = withCatalogImageVersion(
      featured.cover?.trim() || featured.banner?.trim() || "",
      featured.catalogUpdatedAt,
    );
    const desktopBackdrop = withCatalogImageVersion(
      featured.banner?.trim() || featured.cover?.trim() || "",
      featured.catalogUpdatedAt,
    );

    const mobileSrc480 = anilistImage(mobileBackdrop, 480);
    const mobileSrc768 = anilistImage(mobileBackdrop, 768);
    const desktopSrc1200 = anilistImage(desktopBackdrop, 1200);
    const desktopSrc1600 = anilistImage(desktopBackdrop, 1600);

    const mobileSrcSet = `${mobileSrc480} 480w, ${mobileSrc768} 768w`;
    const desktopSrcSet = `${desktopSrc1200} 1200w, ${desktopSrc1600} 1600w`;
    const heroSizes = "(min-width: 768px) 100vw, 100vw";

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
          href: mobileSrc768,
          media: "(max-width: 767.98px)",
          imageSrcSet: mobileSrcSet,
          imageSizes: heroSizes,
          fetchPriority: "low",
        },
        {
          rel: "preload",
          as: "image",
          href: desktopSrc1600,
          media: "(min-width: 768px)",
          imageSrcSet: desktopSrcSet,
          imageSizes: heroSizes,
          fetchPriority: "low",
        },
      );
    } else if (mobileBackdrop || desktopBackdrop) {
      const single = mobileBackdrop || desktopBackdrop;
      links.push({
        rel: "preload",
        as: "image",
        href: anilistImage(single, 1600),
        imageSrcSet: `${anilistImage(single, 480)} 480w, ${anilistImage(single, 768)} 768w, ${anilistImage(single, 1200)} 1200w, ${anilistImage(single, 1600)} 1600w`,
        imageSizes: heroSizes,
        fetchPriority: "low",
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

    const todayPreloadItems = (loaderData?.todaySchedule ?? [])
      .filter((item) => Boolean(item?.cover?.trim()))
      .slice(0, 2);
    for (const item of todayPreloadItems) {
      const coverAttrs = getResponsiveCoverAttrs(item.cover, "card-md");
      if (coverAttrs.src) {
        links.push({
          rel: "preload",
          as: "image",
          href: coverAttrs.src,
          imageSrcSet: coverAttrs.srcSet,
          imageSizes: coverAttrs.sizes,
          media: "(min-width: 768px)",
          fetchPriority: "high",
        });
      }
    }

    const homeTitle = "HIKARI — Assista animes online legendados e dublados";
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

  const rawTrending = useMemo(
    () => overlayList(data.trending, locals, { includeExtras: false }),
    [data.trending, locals],
  );
  const rawPopular = useMemo(
    () => overlayList(data.popular, locals, { includeExtras: false }),
    [data.popular, locals],
  );
  const resolvedSeasonCode = data.seasonCode || currentAnimeSeason().season;
  const rawSeason = useMemo(
    () =>
      overlaySeasonList(
        data.season ?? [],
        locals,
        resolvedSeasonCode,
        data.seasonYear,
      ),
    [data.season, locals, resolvedSeasonCode, data.seasonYear],
  );
  const rawTodaySchedule = useMemo(
    () => overlayList(data.todaySchedule ?? [], locals, { includeExtras: false }),
    [data.todaySchedule, locals],
  );

  const emAltaSource = useMemo(() => {
    const trendingHasEp = rawTrending.some((item) => item.hasEpisode === true);
    const popularHasEp = rawPopular.some((item) => item.hasEpisode === true);
    if (trendingHasEp || !popularHasEp) {
      return rawTrending.length > 0 ? rawTrending : rawPopular;
    }
    return rawPopular;
  }, [rawTrending, rawPopular]);

  // Animes Recém-Adicionados: animes incluídos no catálogo próprio do Hikari com data real (createdAt),
  // ordenados do mais recente para o mais antigo (apenas os que possuem episódios)
  const recentlyAddedAnimes = useMemo(() => {
    const visibleLocals = locals.filter(
      (a) =>
        !a.hidden &&
        (a.hasEpisode === true || hasLocalPublishedEpisodes(a.seasons)),
    );
    const withValidCreatedAt = visibleLocals.filter(
      (a) =>
        typeof a.createdAt === "number" &&
        Number.isFinite(a.createdAt) &&
        a.createdAt > 0,
    );

    return [...withValidCreatedAt]
      .sort(
        (a, b) =>
          b.createdAt - a.createdAt ||
          (b.updatedAt || 0) - (a.updatedAt || 0),
      )
      .slice(0, 18)
      .map(localToAnime);
  }, [locals]);

  const homeWithEpisodeCount = useMemo(
    () =>
      countDistinctTitlesWithEpisode([
        rawTodaySchedule,
        emAltaSource,
        rawSeason,
        recentlyAddedAnimes,
      ]),
    [rawTodaySchedule, emAltaSource, rawSeason, recentlyAddedAnimes],
  );

  const emAltaItems = useMemo(
    () => selectHomeSectionItems(emAltaSource, homeWithEpisodeCount),
    [emAltaSource, homeWithEpisodeCount],
  );

  const featuredItems = useMemo(
    () => pickHeroItems(rawTrending, rawPopular, rawSeason),
    [rawTrending, rawPopular, rawSeason],
  );
  const featured = featuredItems[0];

  // Novos Episódios: apenas monta o container de carregamento progressivo se houver episódios cadastrados
  // Prioriza os 18 itens resolvidos no loader (evitando serializar milhares de linhas no HTML SSR)
  // e mescla com o catálogo local apenas quando houver registros locais no navegador
  const recentEpisodes = useMemo(() => {
    const base = data.publicRecentEpisodes ?? [];
    if (locals.length === 0) return base;
    const localRecent = getRecentEpisodesSection(locals);
    if (localRecent.length === 0) return base;
    const seenIds = new Set(base.map((ep) => ep.episodeId));
    const merged = [...base];
    for (const ep of localRecent) {
      if (!seenIds.has(ep.episodeId)) {
        seenIds.add(ep.episodeId);
        merged.push(ep);
      }
    }
    merged.sort((a, b) => b.publishedAt - a.publishedAt);
    return merged.slice(0, 18);
  }, [data.publicRecentEpisodes, locals]);

  return (
    <div className="space-y-8 pb-12 sm:space-y-11 md:space-y-14">
      {featured ? (
        <Hero
          anime={featured}
          animes={featuredItems}
        />
      ) : null}

      {/* 1. Episódios de Hoje (prioritário na primeira visualização) */}
      <TodayEpisodesSection
        initialItems={data.todaySchedule ?? []}
        homeWithEpisodeCount={homeWithEpisodeCount}
      />

      {/* 2. Em Alta */}
      {emAltaItems.length > 0 && (
        <SectionReveal minHeight="260px" rootMargin="300px 0px" lazy={false}>
          <AnimeRow
            title="Em Alta"
            items={emAltaItems}
            showBookmark={false}
            showRank={false}
            priorityCount={0}
            disableHoverPreload={true}
            optimizedHover={true}
          />
        </SectionReveal>
      )}

      {/* 3. Episódios Recentes (publicados pelo administrador) */}
      {(recentEpisodes.length > 0 || data.publicEpisodesStatus === "error") && (
        <SectionReveal minHeight="380px" rootMargin="300px 0px" lazy={false}>
          <RecentEpisodesSection
            serverStatus={data.publicEpisodesStatus}
            initialEpisodes={recentEpisodes}
          />
        </SectionReveal>
      )}

      {/* 4. Animes Recém-Adicionados (renderiza apenas quando há itens cadastrados) */}
      {hydrated && recentlyAddedAnimes.length > 0 && (
        <SectionReveal minHeight="260px" rootMargin="300px 0px" lazy={false}>
          <AnimeRow
            title="Animes Recém-Adicionados"
            items={recentlyAddedAnimes}
            showBookmark={false}
            showRank={false}
            priorityCount={0}
          />
        </SectionReveal>
      )}

      {/* 5. Animes da Temporada */}
      <SeasonAnimeRow
        seasonName={data.seasonName}
        seasonYear={data.seasonYear}
        seasonCode={data.seasonCode}
        initialItems={data.season && data.season.length > 0 ? data.season : []}
        homeWithEpisodeCount={homeWithEpisodeCount}
      />
    </div>
  );
}

function SeasonAnimeRow({
  seasonName,
  seasonYear,
  seasonCode,
  initialItems = [],
  homeWithEpisodeCount,
}: {
  seasonName: string;
  seasonYear: number;
  seasonCode?: OfficialAnimeSeason;
  initialItems?: SlimAnime[];
  homeWithEpisodeCount: number;
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

  const resolvedSeasonCode = seasonCode || currentAnimeSeason().season;

  const season = useMemo(
    () =>
      selectHomeSectionItems(
        overlaySeasonList(seasonItems, locals, resolvedSeasonCode, seasonYear),
        homeWithEpisodeCount,
      ),
    [seasonItems, locals, resolvedSeasonCode, seasonYear, homeWithEpisodeCount],
  );

  if (season.length === 0) {
    return null;
  }

  return (
    <SectionReveal minHeight="260px" rootMargin="300px 0px" lazy={false}>
      <AnimeRow
        title="Animes da Temporada"
        tag={`${seasonName} ${seasonYear}`}
        href="/browse/season"
        items={season}
        loading={loading}
        showBookmark={false}
        showRank={false}
        priorityCount={0}
        disableHoverPreload={true}
        optimizedHover={true}
      />
    </SectionReveal>
  );
}
