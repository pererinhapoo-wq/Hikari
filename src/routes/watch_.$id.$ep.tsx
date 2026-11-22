import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  HeartHandshake,
  ShieldAlert,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { SectionReveal } from "@/components/section-reveal";
import { ElizabethHikariPlayerBanner } from "@/components/player/ElizabethHikariPlayerBanner";

const EpisodeCommentsSection = lazy(() =>
  import("@/components/comments/EpisodeCommentsSection").then((mod) => ({
    default: mod.EpisodeCommentsSection ?? mod.default,
  })),
);

import { fetchAnimeDetail } from "@/lib/api";
import { anilistImage, getResponsiveCoverAttrs } from "@/lib/image-utils";
import { mergeDetail } from "@/lib/overlay";
import { buildCleanCanonical, buildWatchJsonLd, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { useHikariStore } from "@/lib/store";
import {
  buildResolvedSeasons,
  executeGetCatalogEpisodes,
  getCachedResolvedSeasons,
  getCatalogEpisodes,
  primeCatalogEpisodesCache,
  resolveEpisodes,
} from "@/lib/catalog-episodes";
import {
  resolveEpisodeThumbnailUrl,
  selectEpisodeForWatch,
} from "@/lib/published-episodes";
import {
  buildHikariPlayerEpisodeUrl,
  normalizeHikariPlayerEpisodeId,
} from "@/lib/hikari-player";
import {
  displayTitle,
  type Episode,
  type Season,
} from "@/lib/types";

function parseEpisodeNumber(epStr?: string): number {
  if (!epStr) return 1;
  const match = epStr.match(/ep-(?:\d+-)?(\d+)$/i) || epStr.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 1;
}

// Helpers de resolução de stream e validação de mídia são importados de "@/lib/published-episodes"

export const Route = createFileRoute("/watch_/$id/$ep")({
  validateSearch: (
    raw: Record<string, unknown>,
  ): {
    comment?: string;
  } => ({
    comment:
      typeof raw.comment === "string" && raw.comment
        ? raw.comment
        : undefined,
  }),

  beforeLoad: ({ params, search }) => {
    const epNum = parseEpisodeNumber(params.ep);
    const canonicalEp = `ep-${epNum}`;
    if (params.ep !== canonicalEp) {
      throw redirect({
        to: "/watch/$id/$ep",
        params: { id: params.id, ep: canonicalEp },
        search: search.comment ? { comment: search.comment } : undefined,
        statusCode: 301,
      });
    }
  },

  loader: async ({ params }) => {
    if (params.id.startsWith("local-")) {
      return { remote: null, catalogEpisodes: null };
    }

    const [remote, initialCatalogEpisodes] = await Promise.all([
      fetchAnimeDetail({
        data: { id: params.id },
      }),
      (typeof window === "undefined"
        ? executeGetCatalogEpisodes(params.id)
        : getCatalogEpisodes({ data: { animeId: params.id } })
      ).catch(() => null),
    ]);

    let catalogEpisodes = initialCatalogEpisodes;
    if (
      remote?.serverCatalogId &&
      remote.serverCatalogId !== params.id &&
      (!catalogEpisodes || catalogEpisodes.episodes.length === 0)
    ) {
      catalogEpisodes = await (typeof window === "undefined"
        ? executeGetCatalogEpisodes(remote.serverCatalogId)
        : getCatalogEpisodes({ data: { animeId: remote.serverCatalogId } })
      ).catch(() => catalogEpisodes);
    }

    return { remote, catalogEpisodes };
  },

  head: ({ params, loaderData }) => {
    const remote = loaderData?.remote;
    const catalogEpisodes = loaderData?.catalogEpisodes;
    const epNum = parseEpisodeNumber(params.ep);

    const animeTitle =
      (remote ? displayTitle(remote) || remote.titles?.romaji || remote.titles?.english : null) ||
      "Anime";
    const pageTitle = `Episódio ${epNum} — ${animeTitle} — HIKARI`;
    const description = `Assista ao episódio ${epNum} de ${animeTitle} online.`;
    const canonicalUrl = buildCleanCanonical(`/watch/${params.id}/ep-${epNum}`);
    const coverImageExtraLarge =
      (remote as { coverImage?: { extraLarge?: string } })?.coverImage?.extraLarge ||
      remote?.cover ||
      DEFAULT_OG_IMAGE;

    const targetCatalogEp =
      catalogEpisodes?.episodes?.find((e: { number: number }) => e.number === epNum);
    const remoteEps = (remote?.seasons ?? []).flatMap((s: Season) => s.episodes ?? []);
    const targetRemoteEp =
      remoteEps.find((e: Episode) => e.number === epNum);
    const externalOriginSet = new Set<string>();

    const rawPoster =
      targetCatalogEp?.thumbnail?.trim() ||
      targetRemoteEp?.thumbnail?.trim() ||
      remote?.banner?.trim() ||
      remote?.cover?.trim() ||
      "";
    if (rawPoster) {
      const optimizedPoster = anilistImage(rawPoster, 1280);
      try {
        const posterOrigin = new URL(optimizedPoster).origin;
        if (posterOrigin !== "https://s4.anilist.co") {
          externalOriginSet.add(posterOrigin);
        }
      } catch {
        // ignora URL relativa
      }
    }

    const preconnectLinks = Array.from(externalOriginSet).flatMap((origin) => [
      { rel: "preconnect", href: origin },
      { rel: "dns-prefetch", href: origin },
    ]);

    const meta = [
      { title: pageTitle },
      { name: "description", content: description },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: description },
      { property: "og:image", content: coverImageExtraLarge },
      { property: "og:url", content: canonicalUrl },
      { property: "og:type", content: "video.tv_show" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: "HIKARI" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: pageTitle },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: coverImageExtraLarge },
    ];

    const jsonLd = buildWatchJsonLd({
      animeId: params.id,
      animeTitle,
      episodeNumber: epNum,
      image: coverImageExtraLarge,
      description,
    });

    return {
      links: [
        ...preconnectLinks,
        {
          rel: "canonical",
          href: canonicalUrl,
        },
      ],
      meta,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(jsonLd),
        },
      ],
    };
  },

  component: WatchPage,
});

function WatchPage() {
  const { id, ep } = Route.useParams();
  const targetEpNum = parseEpisodeNumber(ep);

  const {
    comment: commentQuery,
  } = Route.useSearch();

  const { remote, catalogEpisodes } = Route.useLoaderData();

  const locals = useHikariStore((s) => s.animes);
  const hydrated = useHikariStore((s) => s.hydrated);

  const markContinue = useHikariStore(
    (s) => s.markContinue,
  );

  const baseAnime = useMemo(
    () => mergeDetail(remote, id, locals),
    [remote, id, locals],
  );

  const episodeCatalogId = baseAnime?.serverCatalogId || baseAnime?.id || id;

  const [resolvedSeasons, setResolvedSeasons] = useState<Season[] | null>(() => {
    if (catalogEpisodes) {
      const cacheKey = catalogEpisodes.animeId || episodeCatalogId;
      if (typeof window !== "undefined") {
        primeCatalogEpisodesCache(cacheKey, catalogEpisodes);
        if (episodeCatalogId && episodeCatalogId !== cacheKey) {
          primeCatalogEpisodesCache(episodeCatalogId, catalogEpisodes);
        }
        if (id && id !== cacheKey && id !== episodeCatalogId) {
          primeCatalogEpisodesCache(id, catalogEpisodes);
        }
      }
      return buildResolvedSeasons(cacheKey, catalogEpisodes, baseAnime?.seasons ?? []);
    }
    return getCachedResolvedSeasons(episodeCatalogId, baseAnime?.seasons);
  });

  useEffect(() => {
    if (!episodeCatalogId) return;

    let cancelled = false;
    void resolveEpisodes(episodeCatalogId, baseAnime?.seasons).then((seasons) => {
      if (cancelled) return;
      setResolvedSeasons(seasons);
    });

    return () => {
      cancelled = true;
    };
  }, [episodeCatalogId, baseAnime?.seasons]);

  const anime = useMemo(() => {
    if (!baseAnime) return null;
    if (!resolvedSeasons) return baseAnime;
    return {
      ...baseAnime,
      seasons: resolvedSeasons,
    };
  }, [baseAnime, resolvedSeasons]);

  const episodes = useMemo(() => {
    if (!anime) {
      return [] as Episode[];
    }

    return (anime.seasons ?? []).flatMap(
      (s) => s.episodes ?? [],
    );
  }, [anime]);

  const current = useMemo(
    () => selectEpisodeForWatch(episodes, ep, targetEpNum),
    [episodes, ep, targetEpNum],
  );

  const hikariPlayerEpisodeId = useMemo(
    () => normalizeHikariPlayerEpisodeId(current?.hikariPlayerEpisodeId),
    [current?.hikariPlayerEpisodeId],
  );
  const hikariPlayerEpisodeUrl = useMemo(
    () => buildHikariPlayerEpisodeUrl(hikariPlayerEpisodeId),
    [hikariPlayerEpisodeId],
  );

  const idx = current
    ? episodes.findIndex(
        (e) => e.id === current.id,
      )
    : -1;

  const prev =
    idx > 0
      ? episodes[idx - 1]
      : null;

  const next =
    idx >= 0 &&
    idx < episodes.length - 1
      ? episodes[idx + 1]
      : null;

  useEffect(() => {
    if (!anime || !current) {
      return;
    }

    markContinue({
      animeId: anime.id,
      episodeId: current.id,
      episodeNumber: current.number,
      episodeTitle: current.title,
      cover:
        resolveEpisodeThumbnailUrl(current) ||
        anime.cover,
      title: displayTitle(anime),
      updatedAt: Date.now(),
    });
  }, [
    anime?.id,
    current?.id,
  ]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [id, ep]);

  const title = anime
    ? displayTitle(anime)
    : "";

  if (!hydrated && !anime) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg text-fg">
        <div className="flex flex-col items-center justify-center gap-3">
          <div
            className="size-8 animate-spin rounded-full border-2 border-white/10 border-t-[#a855f7]"
            aria-label="Carregando"
          />
          <span className="text-sm text-white/50">
            Carregando...
          </span>
        </div>
      </main>
    );
  }

  if (!anime) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg text-fg">
        <div className="flex flex-col items-center justify-center gap-3">
          <div
            className="size-8 animate-spin rounded-full border-2 border-white/10 border-t-[#a855f7]"
            aria-label="Carregando"
          />
          <span className="text-sm text-white/50">
            Carregando...
          </span>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">

      {/* ================================================== */}
      {/* CABEÇALHO */}
      {/* ================================================== */}

      <header className="flex h-14 sm:h-16 items-center px-4 sm:px-6 border-b border-white/[0.06] bg-bg sm:bg-bg/80 backdrop-blur-none sm:backdrop-blur-md sticky top-0 z-40">
        <Logo />
      </header>

      <main
        className="mx-auto w-full max-w-6xl flex-1 px-3 pb-12 sm:px-5"
        data-hikari-player-episode-id={hikariPlayerEpisodeId ?? undefined}
        data-hikari-player-url={hikariPlayerEpisodeUrl ?? undefined}
      >

        {/* ================================================== */}
        {/* BANNER DE REDIRECIONAMENTO AO HIKARI PLAYER        */}
        {/* ================================================== */}

        <section aria-label="Assistir episódio no Hikari Player" className="mt-2 sm:mt-3">
          <ElizabethHikariPlayerBanner
            animeTitle={title}
            episodeNumber={current?.number ?? targetEpNum}
            episodeTitle={current?.title}
            hikariPlayerEpisodeId={hikariPlayerEpisodeId}
            hikariPlayerEpisodeUrl={hikariPlayerEpisodeUrl}
          />
        </section>

        {/* ================================================== */}
        {/* INFORMAÇÕES DO ANIME (ABAIXO DO BANNER)           */}
        {/* ================================================== */}

        <section className="mt-4 flex items-center gap-3 sm:gap-3.5 rounded-none border border-white/10 bg-[#0e0c16] sm:bg-[#0e0c16]/95 p-2.5 sm:p-3 backdrop-blur-none sm:backdrop-blur-md shadow-sm">
          <Link
            to="/anime/$id"
            params={{ id: anime.id }}
            className="group relative block aspect-[2/3] w-14 sm:w-16 shrink-0 overflow-hidden rounded-none border border-white/15 bg-elevated transition-transform hover:scale-[1.02]"
            aria-label={title}
          >
            {anime.cover ? (() => {
              const infoCoverAttrs = getResponsiveCoverAttrs(
                anime.cover,
                "thumb",
              );
              return (
                <img
                  src={infoCoverAttrs.src}
                  srcSet={infoCoverAttrs.srcSet}
                  sizes="(min-width: 640px) 64px, 56px"
                  alt={title}
                  width={64}
                  height={96}
                  className="size-full object-cover rounded-none transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                  fetchPriority="low"
                  decoding="async"
                />
              );
            })() : (
              <div className="size-full bg-elevated rounded-none flex items-center justify-center text-white/30 text-[10px]">
                Sem Capa
              </div>
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="font-sans text-base sm:text-lg font-bold tracking-tight leading-snug text-white truncate">
              <Link
                to="/anime/$id"
                params={{ id: anime.id }}
                className="transition-colors hover:text-[#c084fc]"
              >
                {title}
              </Link>
            </h1>

            <div className="mt-1 flex items-center gap-2 text-xs sm:text-[13px] text-white/60">
              <span className="truncate font-medium">
                {current
                  ? `Episódio ${current.number}${current.title ? ` · ${current.title}` : ""}`
                  : `Episódio ${targetEpNum}`}
              </span>
            </div>
          </div>
        </section>

        {/* ================================================== */}
        {/* NAVEGAÇÃO DOS EPISÓDIOS                           */}
        {/* ================================================== */}

        <div className="mt-3.5 flex items-center justify-between gap-1.5 sm:gap-3 rounded-2xl border border-white/10 bg-[#131317] sm:bg-[#131317]/80 p-2 sm:p-2.5 backdrop-blur-none sm:backdrop-blur-md">
          {prev ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex-1 min-w-0 rounded-xl border-white/10 bg-white/[0.03] px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white/90 hover:bg-white/[0.08] hover:text-white hover:border-[#a855f7]/40 active:scale-95 transition-all"
            >
              <Link
                to="/watch/$id/$ep"
                replace
                params={{ id: anime.id, ep: `ep-${prev.number}` }}
              >
                <ChevronLeft className="size-4 mr-1 shrink-0 text-white/70" />
                <span className="truncate">Episódio anterior</span>
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              className="flex-1 min-w-0 rounded-xl border-white/5 bg-white/[0.01] px-2 sm:px-4 py-2 text-xs sm:text-sm text-white/30 cursor-not-allowed"
            >
              <ChevronLeft className="size-4 mr-1 shrink-0" />
              <span className="truncate">Episódio anterior</span>
            </Button>
          )}

          <Button
            asChild
            variant="outline"
            size="sm"
            className="shrink-0 w-10 sm:w-12 h-9 sm:h-10 rounded-xl border-[#a855f7]/40 bg-[#a855f7]/15 p-0 flex items-center justify-center text-lg sm:text-xl font-bold text-[#c084fc] hover:bg-[#a855f7]/25 hover:border-[#a855f7]/60 active:scale-95 transition-all sm:shadow-[0_0_15px_rgba(168,85,247,0.15)]"
          >
            <Link
              to="/anime/$id"
              params={{ id: anime.id }}
              className="flex size-full items-center justify-center text-center font-bold leading-none select-none"
              aria-label="Ver detalhes do anime"
              title="Ver detalhes do anime"
            >
              =
            </Link>
          </Button>

          {next ? (
            <Button
              asChild
              size="sm"
              className="flex-1 min-w-0 rounded-xl border border-transparent bg-white/10 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-[#a855f7] hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] active:scale-95 transition-all"
            >
              <Link
                to="/watch/$id/$ep"
                replace
                params={{ id: anime.id, ep: `ep-${next.number}` }}
              >
                <span className="truncate">Próximo episódio</span>
                <ChevronRight className="size-4 ml-1 shrink-0 text-white/70" />
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled
              className="flex-1 min-w-0 rounded-xl border-white/5 bg-white/[0.01] px-2 sm:px-4 py-2 text-xs sm:text-sm text-white/30 cursor-not-allowed"
            >
              <span className="truncate">Próximo episódio</span>
              <ChevronRight className="size-4 ml-1 shrink-0" />
            </Button>
          )}
        </div>

        {/* ================================================== */}
        {/* AVISO ANTES DOS COMENTÁRIOS                        */}
        {/* ================================================== */}

        <aside
          aria-label="Aviso antes de comentar"
          className="relative mt-4 overflow-hidden rounded-2xl border border-[#a855f7]/25 bg-gradient-to-b from-[#151124] to-[#0f0d18] sm:from-[#151124]/95 sm:to-[#0f0d18]/95 px-3.5 py-3 sm:px-4 sm:py-3.5 shadow-md sm:shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-none sm:backdrop-blur-md"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#a855f7]/50 to-transparent"
          />

          <div className="flex items-center gap-2">
            <ShieldAlert
              className="size-4 shrink-0 text-[#c084fc]"
              aria-hidden="true"
            />
            <h2 className="text-xs sm:text-sm font-bold tracking-tight text-white">
              Antes de comentar, atenção!
            </h2>
          </div>

          <p className="mt-2 flex items-start gap-2 text-xs sm:text-[13px] font-medium leading-relaxed text-[#f3e8ff]">
            <EyeOff
              className="mt-[3px] size-3.5 shrink-0 text-[#c084fc]"
              aria-hidden="true"
            />
            <span>
              Os comentários podem conter{" "}
              <strong className="font-semibold text-[#d8b4fe]">
                spoilers deste episódio
              </strong>
              . Se ainda não terminou de assistir, leia com cuidado!
            </span>
          </p>

          <div className="mt-2.5 space-y-1.5 border-t border-[#a855f7]/15 pt-2.5 text-xs leading-relaxed text-zinc-300/90">
            <p>
              Respeite a opinião dos outros, seja gentil com a comunidade e evite ofensas, provocações e discussões desnecessárias.
            </p>
            <p className="flex items-start gap-1.5 font-medium text-[#d8b4fe]/90">
              <HeartHandshake
                className="mt-[3px] size-3.5 shrink-0 text-[#c084fc]"
                aria-hidden="true"
              />
              <span>Vamos manter o Hikari um espaço agradável para todos!</span>
            </p>
          </div>
        </aside>

        {/* ================================================== */}
        {/* COMENTÁRIOS */}
        {/* ================================================== */}

        {current?.id ? (
          <SectionReveal
            key={`${anime.id}-${current.id}`}
            minHeight="300px"
            rootMargin="300px 0px"
            lazy={!commentQuery}
          >
            <Suspense fallback={<CommentsLoadingFallback />}>
              <EpisodeCommentsSection
                key={`${anime.id}-${current.id}`}
                animeId={anime.id}
                episodeId={current.id}
                animeTitle={title}
                episodeNumber={current.number ?? targetEpNum}
                targetCommentId={commentQuery}
              />
            </Suspense>
          </SectionReveal>
        ) : (
          <div className="mt-10 border-t border-purple-500/20 pt-8 text-center text-sm text-zinc-500">
            Selecione um episódio para carregar os comentários.
          </div>
        )}

      </main>
    </div>
  );
}


function CommentsLoadingFallback() {
  return (
    <section
      aria-label="Carregando comentários"
      className="mt-10 border-t border-[#a855f7]/20 pt-8 sm:pt-10"
    >
      <div
        role="status"
        aria-live="polite"
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-[#a855f7]/25 bg-gradient-to-b from-[#130f24] via-[#0c0a15] to-[#08070d] sm:from-[#130f24]/90 sm:via-[#0c0a15]/95 sm:to-[#08070d] p-6 sm:p-8 text-center shadow-md sm:shadow-[0_8px_32px_rgba(0,0,0,0.65),0_0_35px_rgba(168,85,247,0.12)] backdrop-blur-none sm:backdrop-blur-md"
      >
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-24 bg-[#a855f7]/15 rounded-full blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center justify-center gap-2.5 py-4">
          <div
            className="size-5 rounded-full border-2 border-[#a855f7]/25 border-t-[#c084fc] animate-spin shadow-[0_0_12px_rgba(168,85,247,0.45)] shrink-0"
            aria-hidden="true"
          />
          <p className="text-sm font-medium tracking-wide text-white/85 select-none">
            Carregando os comentários...
          </p>
        </div>
      </div>
    </section>
  );
}
