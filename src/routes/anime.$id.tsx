import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Pencil,
  Play,
  Share2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AnimeCard } from "@/components/anime-card";
import { fetchAnimeDetail, fetchAnimePictures } from "@/lib/api";
import { isHikariAdmin } from "@/lib/auth/admin";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getStudioLogo } from "@/lib/studio-logos";
import {
  formatDateLabel,
  formatLabel,
  genreLabel,
  ratingLabel,
  scoreLabel,
  seasonLabel,
  sourceLabel,
  staffRoleLabel,
  statusLabel,
} from "@/lib/labels";
import { mergeDetail } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";
import {
  displayTitle,
  type Anime,
  type AnimeCharacter,
  type AnimeStaff,
} from "@/lib/types";
import { cn, youtubeIdFrom } from "@/lib/utils";

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
            {/* CAPA (alinhada à esquerda no teste visual) */}
            <div className="self-start sm:self-auto w-32 shrink-0 overflow-hidden rounded-2xl bg-elevated shadow-[0_12px_36px_rgba(0,0,0,0.8),0_0_24px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/30 sm:w-44">
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

      {/* TRAILER OFICIAL (posicionado logo após a Sinopse) */}
      {yt && (
        <section className="mt-10 max-w-4xl">
          <div className="flex items-center gap-2.5">
            <span className="h-6 w-1 rounded-full bg-purple-500" />
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
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

      {/* EPISÓDIOS (ACIMA DO ELENCO) */}
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

      {/* ELENCO */}
      <ElencoSection characters={anime.characters} />

      {/* DIREÇÃO E EQUIPE TÉCNICA */}
      <DirecaoEquipeSection studios={anime.studios} staff={anime.staff} />

      {/* INFORMAÇÕES ADICIONAIS */}
      <InformacoesAdicionaisSection anime={anime} />

      {/* IMAGENS */}
      <ImagensSection
        images={anime.images}
        title={title}
        bannerUrl={anime.banner}
        coverUrl={anime.cover}
        malId={anime.malId}
      />

      {/* RELACIONADOS (SEM BOTÃO DE SALVAR) */}
      {anime.recommendations.length > 0 && (
        <section className="mt-12 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="h-6 w-1 rounded-full bg-purple-500" />
              <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Relacionados
              </h2>
            </div>

            {anime.recommendations.length > 3 && (
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const rail = document.getElementById("related-anime-rail");
                    rail?.scrollBy({ left: -320, behavior: "smooth" });
                  }}
                  aria-label="Rolar relacionados para a esquerda"
                  className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 hover:border-purple-500/50 hover:bg-[#19142b] transition-all cursor-pointer"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const rail = document.getElementById("related-anime-rail");
                    rail?.scrollBy({ left: 320, behavior: "smooth" });
                  }}
                  aria-label="Rolar relacionados para a direita"
                  className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 hover:border-purple-500/50 hover:bg-[#19142b] transition-all cursor-pointer"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
          </div>

          <div
            id="related-anime-rail"
            className="rail -mx-4 px-4 sm:-mx-6 sm:px-6 scroll-smooth"
          >
            {anime.recommendations.map((r) => (
              <AnimeCard key={r.id} anime={r} showBookmark={false} />
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

function InformacoesAdicionaisSection({ anime }: { anime: Anime }) {
  const [expanded, setExpanded] = useState(false);

  // Não repetimos informações do cabeçalho (formato, status, número de episódios, nota, ano, gêneros)
  // E removemos expressamente "País de origem: Japão"
  // Não duplicamos estúdios ou diretores (que já possuem sua seção própria)
  const startDate = formatDateLabel(anime.startDate);
  const endDate = formatDateLabel(anime.endDate);
  const season = seasonLabel(anime.season, anime.year);
  const duration = anime.duration ? `${anime.duration} min. por episódio` : "";
  const source = sourceLabel(anime.originSource);
  const rating = ratingLabel(
    anime.rating,
    (anime as unknown as { isAdult?: boolean }).isAdult ||
      Boolean(anime.rating?.includes("18+")),
  );
  const broadcast = anime.broadcast ?? "";
  const producers = (anime.producers ?? []).filter(Boolean);
  const licensors = (anime.licensors ?? []).filter(Boolean);

  const romajiTitle = anime.titles?.romaji;
  const englishTitle =
    anime.titles?.english && anime.titles?.english !== romajiTitle
      ? anime.titles.english
      : "";
  const synonyms = (anime.synonyms ?? []).filter(
    (s) => s !== romajiTitle && s !== englishTitle,
  );
  const tags = anime.tags ?? [];

  const mainRows = [
    { label: "Estreia completa", value: startDate },
    { label: "Término da exibição", value: endDate },
    { label: "Temporada de lançamento", value: season },
    { label: "Duração média", value: duration },
    { label: "Obra original", value: source },
    { label: "Classificação indicativa", value: rating },
    { label: "Transmissão", value: broadcast },
    { label: "Produtores", value: producers.join(", ") },
    { label: "Licenciadores", value: licensors.join(", ") },
  ].filter((item) => Boolean(item.value));

  const hasSecondary =
    Boolean(romajiTitle) ||
    Boolean(englishTitle) ||
    synonyms.length > 0 ||
    tags.length > 0;

  if (mainRows.length === 0 && !hasSecondary) {
    return null;
  }

  return (
    <section className="mt-12 max-w-4xl">
      <div className="flex items-center gap-2.5">
        <span className="h-6 w-1 rounded-full bg-purple-500" />
        <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Informações adicionais
        </h2>
      </div>

      <div className="mt-4 rounded-2xl border border-purple-500/15 bg-gradient-to-b from-[#131024]/70 to-[#0e0c18]/90 p-4 sm:p-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 sm:gap-y-3.5">
          {mainRows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between border-b border-purple-500/10 pb-2.5 sm:pb-3"
            >
              <span className="text-[11px] sm:text-xs font-semibold text-purple-300/80 uppercase tracking-wider">
                {row.label}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-zinc-100 text-right">
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {hasSecondary && expanded && (
          <div className="mt-4 space-y-3 border-t border-purple-500/15 pt-4">
            {romajiTitle && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-purple-500/10 pb-2.5">
                <span className="text-[11px] sm:text-xs font-semibold text-purple-300/80 uppercase tracking-wider">
                  Título Romaji
                </span>
                <span className="text-xs sm:text-sm font-semibold text-zinc-200">
                  {romajiTitle}
                </span>
              </div>
            )}
            {englishTitle && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-purple-500/10 pb-2.5">
                <span className="text-[11px] sm:text-xs font-semibold text-purple-300/80 uppercase tracking-wider">
                  Título em Inglês
                </span>
                <span className="text-xs sm:text-sm font-semibold text-zinc-200">
                  {englishTitle}
                </span>
              </div>
            )}
            {synonyms.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 border-b border-purple-500/10 pb-2.5">
                <span className="text-[11px] sm:text-xs font-semibold text-purple-300/80 uppercase tracking-wider shrink-0">
                  Sinônimos
                </span>
                <span className="text-xs sm:text-sm text-zinc-300 sm:text-right">
                  {synonyms.slice(0, 5).join(" • ")}
                </span>
              </div>
            )}
            {tags.length > 0 && (
              <div className="pt-1">
                <span className="text-[11px] sm:text-xs font-semibold text-purple-300/80 uppercase tracking-wider block mb-2">
                  Temas e Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {tags.slice(0, 10).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-md border border-purple-500/20 bg-purple-950/30 px-2 py-0.5 text-[11px] font-medium text-purple-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {hasSecondary && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-4 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
          >
            <span>
              {expanded ? "Mostrar menos detalhes" : "Mais detalhes da ficha"}
            </span>
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-200",
                expanded && "rotate-180",
              )}
            />
          </button>
        )}
      </div>
    </section>
  );
}

function ImagensSection({
  images,
  title,
  bannerUrl,
  coverUrl,
  malId,
}: {
  images?: string[];
  title: string;
  bannerUrl?: string;
  coverUrl?: string;
  malId?: number | null;
}) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [extraPictures, setExtraPictures] = useState<string[]>([]);
  const railRef = useRef<HTMLDivElement>(null);

  // Busca em segundo plano na API Jikan (MyAnimeList) caso o anime possua poucas imagens carregadas
  useEffect(() => {
    if (!malId || (images && images.length >= 3)) return;
    let isMounted = true;

    fetchAnimePictures({ data: { malId } })
      .then((pics) => {
        if (isMounted && Array.isArray(pics) && pics.length > 0) {
          setExtraPictures(pics);
        }
      })
      .catch(() => {
        // Silencioso: não impacta a experiência visual do usuário
      });

    return () => {
      isMounted = false;
    };
  }, [malId, images]);

  const validImages = useMemo(() => {
    const raw = [...(images ?? []), ...extraPictures];
    const set = new Set<string>();
    const result: string[] = [];

    const norm = (url: string) =>
      url.replace(/^https?:\/\//i, "").split("?")[0].toLowerCase().trim();

    const bannerNorm = bannerUrl ? norm(bannerUrl) : "";
    const coverNorm = coverUrl ? norm(coverUrl) : "";

    for (const url of raw) {
      if (typeof url === "string" && url.trim().length > 0) {
        const clean = url.trim();
        const key = norm(clean);

        // Não exibe a capa principal nem o banner da obra na galeria, nem duplicatas
        if (
          !set.has(key) &&
          key !== bannerNorm &&
          key !== coverNorm
        ) {
          set.add(key);
          result.push(clean);
        }
      }
    }
    return result;
  }, [images, extraPictures, bannerUrl, coverUrl]);

  const closeModal = useCallback(() => {
    setSelectedImage((current) => {
      if (current && window.history.state?.hikariGalleryModal) {
        window.history.back();
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (!selectedImage) return;

    // Preserva o scroll original da página sem saltos
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Suporte ao botão voltar nativo do celular
    window.history.pushState({ hikariGalleryModal: true }, "");

    const handlePopState = () => {
      setSelectedImage(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedImage, closeModal]);

  if (validImages.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    if (!railRef.current) return;
    const offset = direction === "left" ? -320 : 320;
    railRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <section className="mt-12 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 rounded-full bg-purple-500" />
          <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Imagens
          </h2>
        </div>

        {validImages.length > 2 && (
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Rolar imagens para a esquerda"
              className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 hover:border-purple-500/50 hover:bg-[#19142b] transition-all cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Rolar imagens para a direita"
              className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 hover:border-purple-500/50 hover:bg-[#19142b] transition-all cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={railRef}
        className="rail -mx-4 flex gap-3.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 pb-2 scroll-smooth"
      >
        {validImages.map((imgUrl, idx) => (
          <button
            key={`${imgUrl}-${idx}`}
            type="button"
            onClick={() => setSelectedImage(imgUrl)}
            className="group relative h-52 sm:h-60 w-36 sm:w-44 shrink-0 overflow-hidden rounded-2xl border border-purple-500/20 bg-[#0e0c1a] shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/60 hover:shadow-[0_8px_30px_rgba(168,85,247,0.25)] cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 p-2 flex flex-col items-center justify-center"
          >
            <div className="relative size-full flex items-center justify-center overflow-hidden rounded-xl bg-[#07060d]">
              <img
                src={imgUrl}
                alt={`Arte promocional de ${title} (${idx + 1})`}
                className="size-full object-contain transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5 pointer-events-none">
              <span className="text-[11px] font-semibold text-purple-200 drop-shadow">
                Ampliar arte
              </span>
            </div>
          </button>
        ))}
      </div>

      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Visualização de imagem de ${title}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={closeModal}
        >
          {/* Botão fechar proeminente */}
          <button
            type="button"
            onClick={closeModal}
            aria-label="Fechar visualização de imagem"
            className="absolute right-3.5 top-3.5 sm:right-6 sm:top-6 z-10 flex size-10 sm:size-11 items-center justify-center rounded-full bg-[#18132d]/90 text-zinc-200 hover:text-white hover:bg-purple-600 transition-all cursor-pointer border border-purple-500/30 shadow-lg"
          >
            <X className="size-5 sm:size-6" />
          </button>

          {/* Imagem inteira: object-contain, sem cortes, proporção original intacta */}
          <div
            className="relative flex items-center justify-center max-h-[88vh] max-w-[92vw] select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage}
              alt={`Visualização completa de ${title}`}
              className="max-h-[88vh] max-w-[92vw] w-auto h-auto object-contain rounded-xl border border-purple-500/20 bg-[#090812] shadow-[0_20px_60px_rgba(0,0,0,0.85)]"
            />
          </div>
        </div>
      )}
    </section>
  );
}

function ElencoSection({
  characters,
}: {
  characters?: AnimeCharacter[];
}) {
  const [selectedLang, setSelectedLang] = useState<"ja" | "pt">("ja");
  const railRef = useRef<HTMLDivElement>(null);

  const validCharacters = useMemo(() => {
    return (characters ?? []).filter((c) => Boolean(c.name?.full));
  }, [characters]);

  // Verifica se há dubladores em português brasileiro
  const hasPortuguese = useMemo(() => {
    return validCharacters.some((c) =>
      (c.voiceActors ?? []).some((va) => {
        const lang = (va.language ?? "").toLowerCase();
        return (
          lang.includes("portuguese") ||
          lang.includes("brazil") ||
          lang.includes("pt-br") ||
          lang.includes("pt_br")
        );
      }),
    );
  }, [validCharacters]);

  if (validCharacters.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    if (!railRef.current) return;
    const offset = direction === "left" ? -320 : 320;
    railRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <section className="mt-12 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 rounded-full bg-purple-500" />
          <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Elenco
          </h2>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {hasPortuguese ? (
            <div className="inline-flex items-center rounded-xl border border-purple-500/25 bg-[#0f0d18] p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setSelectedLang("ja")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                  selectedLang === "ja"
                    ? "bg-purple-950/90 text-purple-200 border border-purple-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                <span className="size-1.5 rounded-full bg-purple-400" />
                <span>Japonês</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedLang("pt")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                  selectedLang === "pt"
                    ? "bg-purple-950/90 text-purple-200 border border-purple-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                <span className="size-1.5 rounded-full bg-emerald-400" />
                <span>Português (BR)</span>
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/20 bg-purple-950/30 px-2.5 py-1 text-[11px] font-medium text-purple-300">
              <span className="size-1.5 rounded-full bg-purple-400" />
              Dublagem original (Japonês)
            </span>
          )}

          {validCharacters.length > 3 && (
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scroll("left")}
                aria-label="Rolar elenco para a esquerda"
                className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 hover:border-purple-500/50 hover:bg-[#19142b] transition-all cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                aria-label="Rolar elenco para a direita"
                className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 hover:border-purple-500/50 hover:bg-[#19142b] transition-all cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={railRef}
        className="rail -mx-4 flex gap-2.5 sm:gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 pb-2 scroll-smooth"
      >
        {validCharacters.map((char) => (
          <ElencoCard
            key={char.id || char.name.full}
            char={char}
            selectedLang={selectedLang}
          />
        ))}
      </div>
    </section>
  );
}

function ElencoCard({
  char,
  selectedLang,
}: {
  char: AnimeCharacter;
  selectedLang: "ja" | "pt";
}) {
  const matchingVa = (char.voiceActors ?? []).find((va) => {
    const l = (va.language ?? "").toLowerCase();
    if (selectedLang === "pt") {
      return (
        l.includes("portuguese") ||
        l.includes("brazil") ||
        l.includes("pt-br") ||
        l.includes("pt_br")
      );
    }
    return l.includes("japanese");
  });

  const isMain = char.role === "MAIN";
  const roleLabel = isMain ? "Protagonista" : "Secundário";

  return (
    <div className="group relative flex w-[110px] sm:w-[126px] md:w-[136px] shrink-0 flex-col overflow-hidden rounded-xl border border-purple-500/15 bg-[#100e1b] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/45 hover:shadow-[0_8px_24px_rgba(168,85,247,0.2)]">
      {/* Imagem retangular do personagem (elemento visual principal, nunca circular) */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#0d0c16]">
        {char.image ? (
          <img
            src={char.image}
            alt={char.name.full}
            loading="lazy"
            decoding="async"
            className="size-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-b from-[#17132a] to-[#0d0b18] font-display text-xl sm:text-2xl font-bold text-purple-400/80">
            {char.name.full.charAt(0)}
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#100e1b] via-transparent to-black/20 opacity-60" />

        {/* Linha discreta para a função (Principal / Secundário) protegida contra overflow */}
        <span
          className={cn(
            "absolute bottom-1.5 left-1.5 max-w-[calc(100%-12px)] truncate rounded px-1.5 py-0.5 text-[8px] sm:text-[8.5px] font-semibold tracking-wider uppercase backdrop-blur-md shadow-sm border",
            isMain
              ? "bg-purple-950/85 text-purple-200 border-purple-500/40"
              : "bg-black/75 text-zinc-300 border-white/10",
          )}
        >
          {roleLabel}
        </span>
      </div>

      {/* Textos abaixo da imagem protegidos com min-w-0 e flexbox */}
      <div className="flex flex-1 flex-col justify-between p-2 sm:p-2.5 min-w-0">
        {/* Nome do personagem */}
        <p
          title={char.name.full}
          className="line-clamp-2 font-display text-[11px] sm:text-xs font-bold text-zinc-100 transition-colors group-hover:text-purple-300 min-w-0 break-words leading-snug"
        >
          {char.name.full}
        </p>

        {/* Nome do dublador correspondente logo abaixo em texto */}
        <div className="mt-1.5 min-w-0">
          {matchingVa ? (
            <p
              title={matchingVa.name.full}
              className="truncate text-[10px] sm:text-[10.5px] font-medium text-purple-300/90 min-w-0"
            >
              {matchingVa.name.full}
            </p>
          ) : (
            <p className="truncate text-[9.5px] sm:text-[10px] italic text-zinc-500 min-w-0">
              {selectedLang === "pt"
                ? "Sem dublagem BR"
                : "Sem dublador creditado"}
            </p>
          )}

          <span className="mt-0.5 inline-block rounded bg-white/5 px-1 py-0.5 text-[8px] sm:text-[8.5px] font-medium uppercase tracking-wider text-zinc-400">
            {selectedLang === "pt" ? "Voz BR" : "Voz JP"}
          </span>
        </div>
      </div>
    </div>
  );
}

function DirecaoEquipeSection({
  studios,
  staff,
}: {
  studios: string[];
  staff?: AnimeStaff[];
}) {
  const railRef = useRef<HTMLDivElement>(null);

  const getRoleWeight = (role: string): number => {
    const r = role.toLowerCase();
    if (r === "director" || r.startsWith("director")) return 1;
    if (r.includes("original creator") || r.includes("creator")) return 2;
    if (r.includes("series composition")) return 3;
    if (
      r.includes("script") ||
      r.includes("screenplay") ||
      r.includes("writer")
    )
      return 4;
    if (r.includes("character design")) return 5;
    if (r.includes("music") || r.includes("composer")) return 6;
    if (r.includes("sound director")) return 7;
    if (r.includes("art director")) return 8;
    if (r.includes("chief animation director")) return 9;
    if (r.includes("animation director")) return 10;
    if (r.includes("producer")) return 11;
    return 20;
  };

  const validStaff = useMemo(() => {
    return [...(staff ?? [])]
      .filter((s) => Boolean(s.name && s.role))
      .sort((a, b) => getRoleWeight(a.role) - getRoleWeight(b.role));
  }, [staff]);

  const studioItems = useMemo(() => {
    return (studios ?? []).map((name) => ({
      id: `studio-${name}`,
      name,
      role: "Estúdio de animação",
      isStudio: true,
      image: getStudioLogo(name),
    }));
  }, [studios]);

  const allItems = useMemo(() => {
    return [...studioItems, ...validStaff];
  }, [studioItems, validStaff]);

  if (allItems.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    if (!railRef.current) return;
    const offset = direction === "left" ? -320 : 320;
    railRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <section className="mt-12 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 rounded-full bg-purple-500" />
          <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Direção e equipe técnica
          </h2>
        </div>

        {allItems.length > 3 && (
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Rolar equipe para a esquerda"
              className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 hover:border-purple-500/50 hover:bg-[#19142b] transition-all cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Rolar equipe para a direita"
              className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-[#0f0d18] text-purple-300 hover:border-purple-500/50 hover:bg-[#19142b] transition-all cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={railRef}
        className="rail -mx-4 flex gap-2.5 sm:gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 pb-2 scroll-smooth"
      >
        {allItems.map((item, index) => (
          <StaffCard key={`${item.role}-${item.name}-${index}`} item={item} />
        ))}
      </div>
    </section>
  );
}

function StaffCard({
  item,
}: {
  item: {
    name: string;
    role: string;
    image?: string;
    isStudio?: boolean;
  };
}) {
  const [imgError, setImgError] = useState(false);
  const roleText = staffRoleLabel(item.role);
  const showImage = Boolean(item.image) && !imgError;

  return (
    <div className="group relative flex w-[110px] sm:w-[126px] md:w-[136px] shrink-0 flex-col overflow-hidden rounded-xl border border-purple-500/15 bg-[#100e1b] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/45 hover:shadow-[0_8px_24px_rgba(168,85,247,0.2)]">
      {/* Imagem retangular (logo real para estúdio, retrato real para profissional ou card tipográfico elegante) */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#0d0c16]">
        {item.isStudio && showImage ? (
          <div className="flex size-full items-center justify-center p-2.5 sm:p-3 bg-[#0d0c16]">
            <img
              src={item.image}
              alt={item.name}
              onError={() => setImgError(true)}
              className="max-h-full max-w-full object-contain filter drop-shadow transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        ) : !item.isStudio && showImage ? (
          <img
            src={item.image}
            alt={item.name}
            onError={() => setImgError(true)}
            className="size-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center bg-gradient-to-b from-[#18132d] to-[#0c0a15] p-2.5 text-center">
            <span className="font-display text-xl sm:text-2xl font-black text-purple-400/80">
              {item.name.charAt(0).toUpperCase()}
            </span>
            <span className="mt-1 text-[8.5px] sm:text-[9.5px] text-zinc-500 uppercase tracking-widest font-medium">
              {item.isStudio ? "Estúdio" : "Equipe"}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#100e1b] via-transparent to-black/20 opacity-60" />
      </div>

      {/* Textos abaixo da imagem protegidos com min-w-0 e flexbox */}
      <div className="flex flex-1 flex-col justify-between p-2 sm:p-2.5 min-w-0">
        <div className="min-w-0">
          <p
            title={roleText}
            className="truncate text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-purple-400 min-w-0"
          >
            {roleText}
          </p>
          <p
            title={item.name}
            className="mt-0.5 line-clamp-2 font-display text-[11px] sm:text-xs font-semibold text-zinc-100 transition-colors group-hover:text-purple-300 min-w-0 break-words leading-snug"
          >
            {item.name}
          </p>
        </div>
      </div>
    </div>
  );
}


