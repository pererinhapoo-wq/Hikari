import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bookmark,
  BookmarkCheck,
  Pencil,
  Play,
  Share2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AnimeCard } from "@/components/anime-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchAnimeDetail } from "@/lib/api";
import { isHikariAdmin } from "@/lib/auth/admin";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  formatLabel,
  genreLabel,
  scoreLabel,
  seasonLabel,
  statusLabel,
} from "@/lib/labels";
import { mergeDetail } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";
import { displayTitle } from "@/lib/types";
import { youtubeIdFrom } from "@/lib/utils";

export const Route = createFileRoute("/anime/$id")({
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
      <div className="h-24 animate-pulse rounded bg-elevated" />
    </div>
  ),

  component: AnimePage,
});

function AnimePage() {
  const { id } = Route.useParams();
  const { remote } = Route.useLoaderData();

  const { user } = useCurrentUserState();
  const canEdit = isHikariAdmin(user?.primaryEmail);

  const locals = useHikariStore((s) => s.animes);

  const inList = useHikariStore(
    (s) =>
      s.myList.includes(id) ||
      (remote?.id ? s.myList.includes(remote.id) : false),
  );

  const toggleList = useHikariStore((s) => s.toggleList);

  const anime = mergeDetail(remote, id, locals);

  const [loadedBanner, setLoadedBanner] = useState<{
    id: string;
    src: string;
  } | null>(null);

  useEffect(() => {
    setLoadedBanner(null);

    if (!anime?.banner) {
      return;
    }

    const bannerId = anime.id;
    const bannerSrc = anime.banner;

    const image = new Image();

    image.onload = () => {
      setLoadedBanner({
        id: bannerId,
        src: bannerSrc,
      });
    };

    image.src = bannerSrc;

    return () => {
      image.onload = null;
    };
  }, [id, anime?.id, anime?.banner]);

  if (!anime) {
    return (
      <div className="py-24 text-center">
        <p className="font-display text-2xl">Anime não encontrado</p>

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
      (anime.anilistId && a.anilistId === anime.anilistId),
  );

  const seasons = anime.seasons;

  const episodeCount =
    seasons.reduce((n, s) => n + s.episodes.length, 0) ||
    anime.episodesCount ||
    0;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: `Confira ${title} no Hikari`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
      }
    } catch {
      // Usuário cancelou o compartilhamento.
    }
  };

  const bannerIsReady =
    loadedBanner?.id === anime.id &&
    loadedBanner.id === id;

  return (
    <article className="pb-12">
      {/* HERO */}
      <section className="relative -mx-4 overflow-hidden sm:-mx-6">
        <div
          key={`banner-${anime.id}`}
          className="relative h-[14rem] overflow-hidden sm:h-[22rem]"
        >
          {bannerIsReady && (
            <>
              {/* FUNDO DO PRÓPRIO BANNER, SEM BORDA PRETA */}
              <img
                src={loadedBanner.src}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 size-full scale-110 object-cover blur-xl"
              />

              {/* IMAGEM PRINCIPAL COM MENOS ZOOM */}
              <img
                key={`${loadedBanner.id}-${loadedBanner.src}`}
                src={loadedBanner.src}
                alt=""
                loading="eager"
                decoding="async"
                className="relative z-10 size-full object-contain object-center"
              />
            </>
          )}

          <div className="absolute inset-0 z-20 bg-linear-to-t from-bg via-bg/40 to-bg/5" />
          <div className="absolute inset-0 z-20 bg-linear-to-r from-bg/60 via-transparent to-bg/20" />
        </div>

        <div className="relative z-10 -mt-24 px-4 sm:-mt-32 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row">
            {/* CAPA */}
            <div className="mx-auto w-32 shrink-0 overflow-hidden rounded-xl bg-elevated shadow-2xl ring-1 ring-white/10 sm:mx-0 sm:w-44">
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
                <span className="text-[11px] font-medium tracking-[0.3em] text-muted uppercase">
                  Anime
                </span>
              </div>

              <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-5xl">
                {title}
              </h1>

              {anime.titles.native && (
                <p className="mt-1 font-display text-sm text-muted">
                  {anime.titles.native}
                </p>
              )}

              {/* METADADOS */}
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                {anime.score != null && (
                  <span className="font-semibold tabular-nums text-score">
                    ★ {scoreLabel(anime.score)}
                  </span>
                )}

                {anime.year && (
                  <span className="text-muted">{anime.year}</span>
                )}

                <span className="text-muted">
                  {formatLabel(anime.format)}
                </span>

                {episodeCount > 0 && (
                  <span className="text-muted">
                    {episodeCount} episódios
                  </span>
                )}

                {statusLabel(anime.status) && (
                  <span className="text-muted">
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
                  >
                    <Badge>{genreLabel(g)}</Badge>
                  </Link>
                ))}
              </div>

              {/* BOTÕES */}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild size="lg">
                  <Link to="/watch/$id" params={{ id: anime.id }}>
                    <Play className="size-4 fill-current" />
                    Assistir
                  </Link>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => toggleList(anime)}
                >
                  {inList ? (
                    <BookmarkCheck className="size-4" />
                  ) : (
                    <Bookmark className="size-4" />
                  )}

                  {inList ? "Na lista" : "Minha Lista"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleShare}
                >
                  <Share2 className="size-4" />
                  Compartilhar
                </Button>

                {canEdit && (
                  <Button asChild variant="ghost">
                    <Link
                      to="/admin/$id"
                      params={{ id: localRecord?.id ?? "new" }}
                      search={{ importId: anime.id }}
                    >
                      <Pencil className="size-4" />
                      Editar
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SINOPSE */}
      {anime.synopsis && (
        <section className="mt-10 max-w-4xl">
          <h2 className="font-display text-2xl tracking-tight">
            Sinopse
          </h2>

          <p className="mt-3 text-sm leading-7 text-muted sm:text-base">
            {anime.synopsis}
          </p>
        </section>
      )}

      {/* TRAILER */}
      {yt && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl tracking-tight">
              Trailer
            </h2>
          </div>

          <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-elevated shadow-[var(--shadow-border)]">
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

      {/* EPISÓDIOS */}
      {seasons.length > 0 && (
        <section className="mt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
                Episódios
              </h2>

              <p className="mt-1 text-sm text-muted">
                {episodeCount} episódios disponíveis
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-8">
            {seasons.map((season) => (
              <div key={season.id}>
                {seasons.length > 1 && (
                  <h3 className="mb-3 text-sm font-medium text-muted">
                    {season.title}
                  </h3>
                )}

                <EpisodeGrid
                  episodes={season.episodes}
                  animeId={anime.id}
                  cover={anime.cover}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ESTÚDIO */}
      {anime.studios.length > 0 && (
        <section className="mt-10 rounded-xl border border-white/5 bg-surface p-5">
          <p className="text-xs tracking-[0.2em] text-subtle uppercase">
            Estúdio
          </p>

          <p className="mt-2 text-sm text-fg">
            {anime.studios.join(", ")}
          </p>
        </section>
      )}

      {/* RELACIONADOS */}
      {anime.recommendations.length > 0 && (
        <section className="mt-12 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
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

      {/* COMENTÁRIOS — ESPAÇO RESERVADO PARA A PRÓXIMA ETAPA */}
      <section className="mt-12 border-t border-white/5 pt-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
              Comentários
            </h2>

            <p className="mt-1 text-sm text-muted">
              A discussão deste anime ficará aqui.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-white/5 bg-surface p-6 text-center">
          <p className="text-sm text-muted">
            Os comentários do Hikari serão adicionados aqui.
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
}) {
  const [shown, setShown] = useState(24);
  const visible = episodes.slice(0, shown);

  return (
    <>
      <ol className="grid gap-3 sm:grid-cols-2">
        {visible.map((ep) => (
          <li key={ep.id}>
            <Link
              to="/watch/$id"
              params={{ id: animeId }}
              search={{ ep: ep.id }}
              className="group flex gap-3 rounded-xl border border-white/5 bg-surface p-2.5 shadow-[var(--shadow-border)] transition-all hover:-translate-y-0.5 hover:bg-elevated"
            >
              {/* THUMBNAIL */}
              <div className="relative h-[5rem] w-32 shrink-0 overflow-hidden rounded-lg bg-elevated sm:h-[5.5rem] sm:w-36">
                {ep.thumbnail || cover ? (
                  <img
                    src={ep.thumbnail || cover}
                    alt=""
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : null}

                <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/5" />

                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex size-9 items-center justify-center rounded-full bg-white text-black shadow-lg">
                    <Play className="ml-0.5 size-4 fill-current" />
                  </div>
                </div>
              </div>

              {/* INFORMAÇÕES */}
              <div className="min-w-0 flex-1 py-1">
                <p className="text-[11px] font-medium tracking-wide text-subtle uppercase">
                  Episódio {ep.number}
                </p>

                <p className="mt-1 line-clamp-2 text-sm leading-snug text-fg">
                  {ep.title}
                </p>

                {ep.duration && (
                  <p className="mt-1 text-xs text-subtle">
                    {ep.duration}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ol>

      {shown < episodes.length && (
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full"
          onClick={() => setShown((n) => n + 24)}
        >
          Mais episódios ({episodes.length - shown} restantes)
        </Button>
      )}
    </>
  );
  }
