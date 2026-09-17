import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bookmark,
  BookmarkCheck,
  Pencil,
  Play,
} from "lucide-react";
import { useState } from "react";

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
      <div className="-mx-4 h-52 animate-pulse bg-elevated sm:-mx-6" />
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

  return (
    <article className="pb-8">
      <div className="relative -mx-4 h-48 overflow-hidden sm:-mx-6 sm:h-72">
        {(anime.banner || anime.cover) && (
          <img
            src={anime.banner || anime.cover}
            alt=""
            className="size-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/40 to-transparent" />
      </div>

      <div className="relative z-10 -mt-20 flex flex-col gap-5 sm:-mt-24 sm:flex-row">
        <div className="mx-auto w-32 shrink-0 overflow-hidden rounded-lg bg-elevated shadow-[var(--shadow-border)] sm:mx-0 sm:w-40">
          {anime.cover ? (
            <img
              src={anime.cover}
              alt=""
              className="aspect-2/3 w-full object-cover"
            />
          ) : (
            <div className="aspect-2/3" />
          )}
        </div>

        <div className="flex-1 space-y-3 sm:pt-16">
          <p className="text-[11px] tracking-[0.28em] text-muted uppercase">
            {formatLabel(anime.format)}
            {anime.year ? ` · ${anime.year}` : ""}
          </p>

          <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
            {title}
          </h1>

          {anime.titles.native && (
            <p className="font-display text-sm text-muted">
              {anime.titles.native}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {anime.score != null && (
              <span className="text-sm font-medium tabular-nums text-score">
                {scoreLabel(anime.score)}
              </span>
            )}

            <span className="text-sm text-muted">
              {statusLabel(anime.status)}
            </span>

            {episodeCount > 0 && (
              <span className="text-sm text-muted">
                {episodeCount} episódios
              </span>
            )}

            {seasonLabel(anime.season, anime.year) && (
              <span className="text-sm text-muted">
                {seasonLabel(anime.season, anime.year)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
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

          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild>
              <Link to="/watch/$id" params={{ id: anime.id }}>
                <Play className="size-4" />
                Assistir
              </Link>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => toggleList(anime)}
            >
              {inList ? (
                <BookmarkCheck className="size-4" />
              ) : (
                <Bookmark className="size-4" />
              )}
              {inList ? "Na lista" : "Minha Lista"}
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

      {anime.synopsis && (
        <section className="mt-8 max-w-3xl">
          <h2 className="text-[11px] tracking-[0.28em] text-muted uppercase">
            Sinopse
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {anime.synopsis}
          </p>
        </section>
      )}

      {yt && (
        <section className="mt-8">
          <h2 className="text-[11px] tracking-[0.28em] text-muted uppercase">
            Trailer
          </h2>
          <div className="mt-3 aspect-video overflow-hidden rounded-xl bg-elevated shadow-[var(--shadow-border)]">
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

      {seasons.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl tracking-tight">Episódios</h2>

          <div className="mt-4 space-y-8">
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

      {anime.studios.length > 0 && (
        <p className="mt-8 text-xs text-subtle">
          Estúdio: {anime.studios.join(", ")}
        </p>
      )}

      {anime.recommendations.length > 0 && (
        <section className="mt-10 space-y-3">
          <h2 className="font-display text-2xl tracking-tight">
            Relacionados
          </h2>

          <div className="rail -mx-4 px-4 sm:-mx-6 sm:px-6">
            {anime.recommendations.map((r) => (
              <AnimeCard key={r.id} anime={r} />
            ))}
          </div>
        </section>
      )}
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
      <ol className="grid gap-2 sm:grid-cols-2">
        {visible.map((ep) => (
          <li key={ep.id}>
            <Link
              to="/watch/$id"
              params={{ id: animeId }}
              search={{ ep: ep.id }}
              className="flex gap-3 rounded-lg bg-surface p-2 shadow-[var(--shadow-border)] transition-colors hover:bg-elevated"
            >
              <div className="h-[4.5rem] w-28 shrink-0 overflow-hidden rounded-md bg-elevated">
                {ep.thumbnail || cover ? (
                  <img
                    src={ep.thumbnail || cover}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : null}
              </div>

              <div className="min-w-0 py-0.5">
                <p className="text-[11px] tabular-nums text-subtle">
                  Ep. {ep.number}
                </p>
                <p className="line-clamp-2 text-sm leading-snug text-fg">
                  {ep.title}
                </p>
                {ep.duration && (
                  <p className="text-xs text-subtle">{ep.duration}</p>
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
          className="mt-3 w-full"
          onClick={() => setShown((n) => n + 24)}
        >
          Mais episódios ({episodes.length - shown} restantes)
        </Button>
      )}
    </>
  );
                }
