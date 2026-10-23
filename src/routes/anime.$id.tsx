import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  MessageSquare,
  Pencil,
  Play,
  Share2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AnimeCard } from "@/components/anime-card";
import { fetchAnimeDetail } from "@/lib/api";
import { isHikariAdmin } from "@/lib/auth/admin";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  formatLabel,
  genreLabel,
  scoreLabel,
  statusLabel,
} from "@/lib/labels";
import { mergeDetail } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";
import { displayTitle } from "@/lib/types";
import { youtubeIdFrom } from "@/lib/utils";

const EMPTY_WATCHED_EPISODES: string[] = [];

export const Route = createFileRoute("/anime/$id")({
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 15,
  loader: async ({ params }) => {
    if (params.id.startsWith("local-")) {
      return { remote: null };
    }

    const remote = await fetchAnimeDetail({
      data: { id: params.id },
    });

    return { remote };
  },

  pendingComponent: () => (
    <div className="space-y-4 pt-4">
      <div className="-mx-4 h-56 animate-pulse bg-elevated sm:-mx-6 sm:h-72" />

      <div className="h-8 w-2/3 animate-pulse rounded bg-elevated" />

      <div className="h-24 rounded bg-elevated" />
    </div>
  ),

  component: AnimePage,
});

function AnimePage() {
  const { id } = Route.useParams();
  const { remote } = Route.useLoaderData();
  const navigate = useNavigate();

  const hydrated = useHikariStore((s) => s.hydrated);

  const { user } = useCurrentUserState();
  const canEdit = isHikariAdmin(user?.primaryEmail);

  const locals = useHikariStore((s) => s.animes);

  const inList = useHikariStore(
    (s) =>
      s.myList.includes(id) ||
      (remote?.id ? s.myList.includes(remote.id) : false),
  );

  const toggleList = useHikariStore((s) => s.toggleList);

  const continueEntry = useHikariStore((s) =>
    s.continueWatching.find(
      (entry) => entry.animeId === id,
    ),
  );

  const watchedEpisodes = useHikariStore(
    (s) =>
      s.watchedEpisodes[id] ??
      EMPTY_WATCHED_EPISODES,
  );

  const anime = mergeDetail(remote, id, locals);

  const [seasonsOpen, setSeasonsOpen] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      setCanGoBack(true);
    }
  }, []);

  /*
   * COR DA ABA DO NAVEGADOR
   */
  useEffect(() => {
    const defaultColor = "#09090b";

    let meta = document.querySelector(
      'meta[name="theme-color"]',
    ) as HTMLMetaElement | null;

    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }

    if (anime?.color) {
      meta.content = anime.color;
      return;
    }

    meta.content = defaultColor;

    if (!anime?.banner) {
      return;
    }

    // Executa em segundo plano para não disputar CPU com a navegação/renderização inicial
    const timer = setTimeout(() => {
      const image = new Image();
      image.crossOrigin = "anonymous";

      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) return;

          const width = image.naturalWidth;
          const height = image.naturalHeight;
          if (!width || !height) return;

          canvas.width = 40;
          canvas.height = 20;

          context.drawImage(
            image,
            width * 0.25,
            height * 0.1,
            width * 0.5,
            height * 0.35,
            0,
            0,
            canvas.width,
            canvas.height,
          );

          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let red = 0, green = 0, blue = 0, count = 0;

          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] < 180) continue;
            red += pixels[i];
            green += pixels[i + 1];
            blue += pixels[i + 2];
            count++;
          }

          if (!count || !meta) return;

          const factor = 0.72;
          const finalRed = Math.round((red / count) * factor);
          const finalGreen = Math.round((green / count) * factor);
          const finalBlue = Math.round((blue / count) * factor);

          meta.content = `rgb(${finalRed}, ${finalGreen}, ${finalBlue})`;
        } catch {
          if (meta) meta.content = defaultColor;
        }
      };

      image.onerror = () => {
        if (meta) meta.content = defaultColor;
      };

      image.src = anime.banner;
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [anime?.id, anime?.banner, anime?.color]);

  /*
   * TEMPORADAS
   */
  const seasonNavigation =
    (
      remote as unknown as {
        seasonNavigation?: {
          items?: Array<{ id: string; label?: string; title?: string }>;
        };
      }
    )?.seasonNavigation?.items ?? [];

  const seasons = anime?.seasons ?? [];

  /*
   * A página representa uma temporada.
   * Portanto usamos somente os episódios dessa página.
   */
  const currentSeason = seasons[0] ?? null;
  const currentEpisodes = currentSeason?.episodes;

  const allEpisodes = useMemo(
    () =>
      (currentEpisodes ?? []).map((episode) => ({
        ...episode,
        seasonId: currentSeason?.id ?? "",
      })),
    [currentEpisodes, currentSeason?.id],
  );

  if (!anime && !hydrated) {
    return null;
  }

  if (!anime) {
    return (
      <div className="py-24 text-center">
        <p className="font-display text-2xl">
          Anime não encontrado
        </p>

        <Link
          to="/"
          className="mt-3 inline-block text-sm text-muted underline"
        >
          Voltar ao início
        </Link>
      </div>
    );
  }

  const title = displayTitle(anime);
  const yt = youtubeIdFrom(anime.trailerId);

  const localRecord = locals.find(
    (a) =>
      a.id === anime.id ||
      (anime.anilistId &&
        a.anilistId === anime.anilistId),
  );

  const episodeCount =
    currentEpisodes?.length ||
    anime.episodesCount ||
    0;

  const watchedCount = allEpisodes.filter(
    (episode) =>
      watchedEpisodes.includes(episode.id),
  ).length;

  /*
   * CONTINUAR
   *
   * Procura exatamente o episódio onde
   * o usuário parou.
   */
  const continueEpisode =
    continueEntry
      ? allEpisodes.find(
          (episode) =>
            episode.id ===
            continueEntry.episodeId,
        )
      : undefined;

  const continueTarget =
    continueEpisode ??
    allEpisodes[0];

  const watchButtonLabel =
    continueEpisode
      ? `Continuar no ep. ${continueEpisode.number}`
      : "Assistir";

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: `Confira ${title} no Hikari`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(
          window.location.href,
        );
      }
    } catch {
      // Usuário cancelou o compartilhamento.
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    }
  };

  return (
    <article className="pb-12">
      {/* HERO */}
      <section className="relative -mx-4 overflow-hidden sm:-mx-6">
        <div
          key={`banner-${anime.id}`}
          className="relative h-[14rem] sm:h-[22rem]"
        >
          {anime.banner ? (
            <img
              src={anime.banner}
              alt=""
              loading="eager"
              decoding="async"
              className="size-full object-cover"
            />
          ) : null}

          <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/60 to-bg/10" />

          <div className="absolute inset-0 bg-linear-to-r from-bg/80 via-transparent to-bg/30" />

          {/* BOTÃO VOLTAR */}
          {canGoBack && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Voltar"
              title="Voltar"
              className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-xl border border-purple-500/30 bg-black/60 px-3.5 py-2 text-sm font-medium text-white backdrop-blur-md shadow-md transition-all hover:bg-purple-950/50 hover:border-purple-500/60 hover:text-purple-200 sm:left-6 cursor-pointer"
            >
              <ArrowLeft className="size-4" />
              <span>Voltar</span>
            </button>
          )}
        </div>

        <div className="relative z-10 -mt-24 px-4 sm:-mt-32 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row">
            {/* CAPA */}
            <div className="mx-auto w-32 shrink-0 overflow-hidden rounded-2xl bg-elevated shadow-[0_12px_36px_rgba(0,0,0,0.8),0_0_24px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/30 sm:mx-0 sm:w-44">
              {anime.cover ? (
                <img
                  src={anime.cover}
                  alt={title}
                  className="aspect-2/3 w-full object-cover"
                />
              ) : (
                <div className="aspect-2/3 bg-elevated" />
              )}
            </div>

            {/* INFORMAÇÕES */}
            <div className="flex min-w-0 flex-1 flex-col justify-end pb-1 sm:pb-2">
              <div className="mb-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-950/70 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-purple-300 uppercase shadow-[0_0_12px_rgba(168,85,247,0.15)] sm:text-xs">
                  <span className="size-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]" />
                  <span>Anime</span>
                </span>
              </div>

              <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-white drop-shadow-sm sm:text-4xl md:text-5xl">
                {title}
              </h1>

              {anime.titles.native && (
                <p className="mt-1 font-display text-sm font-medium text-purple-300/70">
                  {anime.titles.native}
                </p>
              )}

              {/* METADADOS */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                {anime.score != null && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-purple-500/35 bg-purple-950/80 px-2.5 py-1 text-xs font-bold tabular-nums text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.15)]">
                    ★ {scoreLabel(anime.score)}
                  </span>
                )}

                {anime.year && (
                  <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300">
                    {anime.year}
                  </span>
                )}

                <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300">
                  {formatLabel(anime.format)}
                </span>

                {episodeCount > 0 && (
                  <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300">
                    {episodeCount} episódios
                  </span>
                )}

                {statusLabel(anime.status) && (
                  <span className="inline-flex items-center rounded-lg border border-purple-500/20 bg-purple-950/40 px-2.5 py-1 text-xs font-medium text-purple-300">
                    {statusLabel(anime.status)}
                  </span>
                )}
              </div>

              {/* GÊNEROS */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {anime.genres.map((g) => (
                  <Link
                    key={g}
                    to="/search"
                    search={{
                      q: "",
                      genre: g,
                      year: "",
                      format: "",
                      status: "",
                      sort: "TRENDING_DESC",
                    }}
                    className="inline-flex items-center rounded-lg border border-purple-500/20 bg-[#161326]/80 px-2.5 py-1 text-xs font-medium text-purple-200/90 transition-all hover:border-purple-500/50 hover:bg-purple-950/50 hover:text-purple-100"
                  >
                    {genreLabel(g)}
                  </Link>
                ))}
              </div>

              {/* BOTÕES DE AÇÃO */}
              <div className="mt-5 flex flex-wrap items-center gap-2.5 sm:gap-3">
                <Link
                  to="/watch/$id"
                  params={{
                    id: anime.id,
                  }}
                  search={
                    continueTarget
                      ? {
                          ep: continueTarget.id,
                        }
                      : undefined
                  }
                  className="inline-flex h-11 sm:h-12 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 px-5 sm:px-6 text-sm sm:text-base font-semibold text-white shadow-[0_4px_20px_rgba(168,85,247,0.35)] transition-all duration-200 hover:from-purple-500 hover:to-purple-400 hover:shadow-[0_4px_26px_rgba(168,85,247,0.5)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 cursor-pointer"
                  onClick={(e) => {
                    if (
                      !e.metaKey &&
                      !e.altKey &&
                      !e.ctrlKey &&
                      !e.shiftKey &&
                      e.button === 0
                    ) {
                      e.preventDefault();
                      void navigate({
                        to: "/watch/$id",
                        params: {
                          id: anime.id,
                        },
                        search: continueTarget
                          ? {
                              ep: continueTarget.id,
                            }
                          : undefined,
                      });
                    }
                  }}
                >
                  <Play className="size-4 fill-current pointer-events-none" />
                  <span>{watchButtonLabel}</span>
                </Link>

                <button
                  type="button"
                  onClick={() => toggleList(anime)}
                  className="inline-flex h-11 sm:h-12 items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-[#0f0d18]/90 px-4 sm:px-5 text-sm sm:text-base font-medium text-zinc-100 shadow-sm transition-all duration-200 hover:border-purple-500/60 hover:bg-[#1a142e] hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 cursor-pointer"
                >
                  {inList ? (
                    <BookmarkCheck className="size-4 text-purple-400" />
                  ) : (
                    <Bookmark className="size-4 text-zinc-400" />
                  )}
                  <span>{inList ? "Na lista" : "Minha Lista"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex h-11 sm:h-12 items-center justify-center gap-2 rounded-xl border border-purple-500/25 bg-[#0f0d18]/90 px-4 sm:px-5 text-sm sm:text-base font-medium text-zinc-200 shadow-sm transition-all duration-200 hover:border-purple-500/50 hover:bg-[#1a142e] hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 cursor-pointer"
                >
                  <Share2 className="size-4 text-zinc-400" />
                  <span>Compartilhar</span>
                </button>

                {canEdit && (
                  <Link
                    to="/admin/$id"
                    params={{
                      id: localRecord?.id ?? "new",
                    }}
                    search={{
                      importId: anime.id,
                    }}
                    className="inline-flex h-11 sm:h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 sm:px-5 text-sm sm:text-base font-medium text-zinc-300 shadow-sm transition-all duration-200 hover:border-purple-500/40 hover:bg-[#1a142e] hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 cursor-pointer"
                  >
                    <Pencil className="size-4 text-zinc-400" />
                    <span>Editar</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SINOPSE */}
      {anime.synopsis && (
        <section className="mt-10 max-w-4xl rounded-2xl border border-purple-500/15 bg-gradient-to-b from-[#131024]/70 to-[#0d0b18]/50 p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-1 rounded-full bg-purple-500" />
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
              Sinopse
            </h2>
          </div>

          <p
            className={`mt-3.5 text-sm sm:text-base leading-relaxed text-zinc-300 ${
              synopsisExpanded ? "" : "line-clamp-4"
            }`}
          >
            {anime.synopsis}
          </p>

          {anime.synopsis.length > 260 && (
            <button
              type="button"
              onClick={() => setSynopsisExpanded(!synopsisExpanded)}
              className="mt-3 inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
            >
              {synopsisExpanded ? "Mostrar menos" : "Ler mais"}
            </button>
          )}
        </section>
      )}

      {/* TRAILER */}
      {yt && (
        <section className="mt-10 max-w-4xl">
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-1 rounded-full bg-purple-500" />
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
              Trailer Oficial
            </h2>
          </div>

          <div className="mt-4 aspect-video overflow-hidden rounded-2xl border border-purple-500/20 bg-[#0d0b18] shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
            <iframe
              title={`Trailer de ${title}`}
              src={`https://www.youtube-nocookie.com/embed/${yt}`}
              className="size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>
      )}

      {/* TEMPORADAS */}
      {seasonNavigation.length > 1 && (
        <section className="mt-8">
          <div className="relative w-[240px] max-w-full">
            <button
              type="button"
              onClick={() => setSeasonsOpen((open) => !open)}
              className="flex w-full items-center justify-between rounded-xl border border-purple-500/25 bg-[#0f0d18] px-3.5 py-2.5 text-left shadow-sm transition-all hover:border-purple-500/50 hover:bg-[#161326] cursor-pointer"
              aria-expanded={seasonsOpen}
            >
              <span className="font-display text-sm font-semibold tracking-tight text-zinc-100">
                Temporadas
              </span>

              <ChevronDown
                className={`size-4 text-purple-400 transition-transform duration-200 ${
                  seasonsOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {seasonsOpen && (
              <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-purple-500/25 bg-[#0f0d18] p-1.5 shadow-2xl backdrop-blur-md">
                {seasonNavigation.map((season, index) => {
                  const selected = season.id === anime.id;
                  const seasonName =
                    season.label ??
                    season.title ??
                    `Temporada ${index + 1}`;

                  return (
                    <Link
                      key={season.id}
                      to="/anime/$id"
                      params={{ id: season.id }}
                      onClick={() => setSeasonsOpen(false)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs leading-snug transition-colors ${
                        selected
                          ? "bg-purple-950/70 font-semibold text-purple-200 border border-purple-500/30"
                          : "text-zinc-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span>{seasonName}</span>
                      {selected && (
                        <Check className="ml-2 size-3.5 shrink-0 text-purple-400" />
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* EPISÓDIOS */}
      {currentSeason && (
        <section id="episodes" className="mt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-1 rounded-full bg-purple-500" />
                <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Episódios
                </h2>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-zinc-400">
                <span className="inline-flex items-center rounded-md border border-white/5 bg-white/5 px-2.5 py-1 text-zinc-300">
                  {episodeCount} episódios disponíveis
                </span>
                <span className="text-zinc-600">·</span>
                <span className="inline-flex items-center rounded-md border border-purple-500/20 bg-purple-950/40 px-2.5 py-1 font-medium text-purple-300">
                  {watchedCount}/{episodeCount} assistidos
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <EpisodeGrid
              episodes={currentSeason.episodes}
              animeId={anime.id}
              cover={anime.cover}
              watchedEpisodes={watchedEpisodes}
            />
          </div>
        </section>
      )}

      {/* ESTÚDIO */}
      {anime.studios.length > 0 && (
        <section className="mt-10 rounded-2xl border border-purple-500/20 bg-gradient-to-r from-[#120f22]/70 via-[#0f0d18] to-[#0d0b18] p-5 shadow-sm">
          <p className="text-[11px] font-bold tracking-[0.2em] text-purple-400 uppercase">
            Estúdio
          </p>
          <p className="mt-1.5 text-sm font-medium text-zinc-200">
            {anime.studios.join(", ")}
          </p>
        </section>
      )}

      {/* RELACIONADOS */}
      {anime.recommendations.length > 0 && (
        <section className="mt-12 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="h-6 w-1 rounded-full bg-purple-500" />
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Relacionados
            </h2>
          </div>

          <div className="rail -mx-4 px-4 sm:-mx-6 sm:px-6">
            {anime.recommendations.map((r) => (
              <AnimeCard key={r.id} anime={r} />
            ))}
          </div>
        </section>
      )}

      {/* COMENTÁRIOS */}
      <section className="mt-14 border-t border-purple-500/20 pt-10">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 rounded-full bg-purple-500" />
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Comentários
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Espaço para a comunidade compartilhar impressões sobre este anime.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-purple-500/20 bg-gradient-to-b from-[#120f22]/60 to-[#0d0b18] p-8 text-center shadow-sm sm:p-10">
          <div className="flex size-12 items-center justify-center rounded-full border border-purple-500/30 bg-purple-950/60 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <MessageSquare className="size-6" />
          </div>
          <h3 className="mt-4 font-display text-base font-semibold text-white">
            Comentários em breve
          </h3>
          <p className="mt-1.5 max-w-md text-xs sm:text-sm text-zinc-400 leading-relaxed">
            O sistema de discussão e avaliação da comunidade do Hikari está sendo preparado e estará disponível aqui em breve.
          </p>
        </div>
      </section>
    </article>
  );
}

function EpisodeGrid({
  episodes,
  animeId,
  cover,
  watchedEpisodes,
}: {
  episodes: {
    id: string;
    number: number;
    title: string;
    thumbnail?: string;
    duration?: string;
  }[];
  animeId: string;
  cover: string;
  watchedEpisodes: string[];
}) {
  return (
    <div
      className="
        max-h-[28rem]
        overflow-y-auto
        overscroll-contain
        rounded-xl
        pr-1
        touch-pan-y
        sm:max-h-[34rem]
      "
    >
      <ol className="grid gap-3 sm:grid-cols-2">
        {episodes.map((ep) => {
          const watched = watchedEpisodes.includes(ep.id);

          return (
            <li key={ep.id}>
              <Link
                to="/watch/$id"
                params={{
                  id: animeId,
                }}
                search={{
                  ep: ep.id,
                }}
                className={`group flex gap-3 rounded-xl border p-2.5 transition-all duration-200 hover:-translate-y-0.5 ${
                  watched
                    ? "border-purple-500/30 bg-[#141026]/90 hover:bg-[#1a1530] hover:border-purple-500/50"
                    : "border-purple-500/15 bg-[#0f0d18]/90 hover:border-purple-500/40 hover:bg-[#161326]"
                } shadow-[0_2px_12px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_20px_rgba(168,85,247,0.15)]`}
              >
                {/* THUMBNAIL */}
                <div className="relative h-[5rem] w-32 shrink-0 overflow-hidden rounded-lg bg-elevated sm:h-[5.5rem] sm:w-36">
                  {ep.thumbnail || cover ? (
                    <img
                      src={ep.thumbnail || cover}
                      alt=""
                      className={`size-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                        watched ? "opacity-75" : ""
                      }`}
                    />
                  ) : null}

                  <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/5" />

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <div className="flex size-9 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg shadow-purple-950/60 ring-2 ring-white/20">
                      <Play className="ml-0.5 size-4 fill-current" />
                    </div>
                  </div>

                  {watched && (
                    <div className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full border border-purple-500/40 bg-purple-950/90 text-purple-200 shadow-md">
                      <Check className="size-3.5" />
                    </div>
                  )}
                </div>

                {/* INFORMAÇÕES */}
                <div className="min-w-0 flex-1 py-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold tracking-wider text-purple-400 uppercase">
                      Episódio {ep.number}
                    </p>

                    {watched && (
                      <span className="shrink-0 rounded bg-purple-950/80 border border-purple-500/30 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-purple-300 uppercase">
                        Assistido
                      </span>
                    )}
                  </div>

                  <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-zinc-100 group-hover:text-purple-200 transition-colors">
                    {ep.title}
                  </p>

                  {ep.duration && (
                    <p className="mt-1.5 text-xs text-zinc-400">
                      {ep.duration}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
