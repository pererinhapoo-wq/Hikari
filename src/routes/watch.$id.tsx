import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAnimeDetail } from "@/lib/api";
import { mergeDetail } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";
import { displayTitle, type Episode } from "@/lib/types";
import { isDirectVideo, youtubeIdFrom } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/watch/$id")({
  validateSearch: (raw: Record<string, unknown>): { ep?: string } => ({
    ep: typeof raw.ep === "string" && raw.ep ? raw.ep : undefined,
  }),
  loader: async ({ params }) => {
    if (params.id.startsWith("local-")) return { remote: null };
    const remote = await fetchAnimeDetail({ data: { id: params.id } });
    return { remote };
  },
  component: WatchPage,
});

function WatchPage() {
  const { id } = Route.useParams();
  const { ep: epQuery } = Route.useSearch();
  const { remote } = Route.useLoaderData();
  const locals = useHikariStore((s) => s.animes);
  const markContinue = useHikariStore((s) => s.markContinue);
  const anime = mergeDetail(remote, id, locals);

  const episodes = useMemo(() => {
    if (!anime) return [] as Episode[];
    return anime.seasons.flatMap((s) => s.episodes);
  }, [anime]);

  const current = useMemo(() => {
    if (!episodes.length) return null;
    return episodes.find((e) => e.id === epQuery) ?? episodes[0];
  }, [episodes, epQuery]);

  const idx = current ? episodes.findIndex((e) => e.id === current.id) : -1;
  const prev = idx > 0 ? episodes[idx - 1] : null;
  const next = idx >= 0 && idx < episodes.length - 1 ? episodes[idx + 1] : null;

  useEffect(() => {
    if (!anime || !current) return;
    markContinue({
      animeId: anime.id,
      episodeId: current.id,
      episodeNumber: current.number,
      episodeTitle: current.title,
      cover: current.thumbnail || anime.cover,
      title: displayTitle(anime),
      updatedAt: Date.now(),
    });
  }, [anime, current, markContinue]);

  const title = anime ? displayTitle(anime) : "";
  const playerUrls = useMemo(
    () => [current?.videoUrl, current?.videoUrl2, current?.videoUrl3],
    [current],
  );
  const [playerIndex, setPlayerIndex] = useState(0);
  useEffect(() => {
    setPlayerIndex(0);
  }, [current?.id]);

  if (!anime) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-fg">
        <p>Título não encontrado.</p>
      </div>
    );
  }

  const playUrl = playerUrls[playerIndex] ?? current?.videoUrl ?? "";
  const yt = youtubeIdFrom(playUrl) || (!playUrl ? youtubeIdFrom(anime.trailerId) : null);
  const file = playUrl && isDirectVideo(playUrl) ? playUrl : null;
  const external = playUrl && !yt && !file ? playUrl : null;

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex h-14 items-center gap-2 px-3 sm:px-5">
        <Link
          to="/anime/$id"
          params={{ id: anime.id }}
          className="flex size-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg"
          aria-label="Fechar player"
        >
          <X className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted">
            {current ? `Episódio ${current.number} · ${current.title}` : "Trailer"}
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-3 pb-6 sm:px-5">
        {playerUrls.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {playerUrls.map((url, index) =>
              url ? (
                <Button
                  key={index}
                  type="button"
                  size="sm"
                  variant={playerIndex === index ? "default" : "outline"}
                  onClick={() => setPlayerIndex(index)}
                >
                  Player {index + 1}
                </Button>
              ) : null,
            )}
          </div>
        )}

        <div className="aspect-video overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
          {yt ? (
            <iframe
              title={`${title} — player`}
              src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`}
              className="size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : file ? (
            <video src={file} controls autoPlay className="size-full bg-bg object-contain" />
          ) : external ? (
            <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="font-display text-2xl">Este episódio abre no site oficial</p>
              <p className="max-w-md text-sm text-muted">
                O catálogo não replica streams protegidos. Use o link da fonte ou adicione uma URL
                de vídeo no painel admin.
              </p>
              <Button asChild>
                <a href={external} target="_blank" rel="noreferrer">
                  Abrir episódio
                </a>
              </Button>
            </div>
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="font-display text-2xl">Sem vídeo neste episódio</p>
              <p className="max-w-md text-sm text-muted">
                Adicione um trailer do YouTube ou uma URL de vídeo no Admin para reproduzir aqui.
              </p>
              <Button asChild variant="outline">
                <Link to="/admin/$id" params={{ id: anime.id.startsWith("local-") ? anime.id : "new" }} search={{ importId: anime.id }}>
                  Abrir Admin
                </Link>
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          {prev ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/watch/$id" params={{ id: anime.id }} search={{ ep: prev.id }}>
                <ChevronLeft className="size-4" />
                Anterior
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {next && (
            <Button asChild size="sm">
              <Link to="/watch/$id" params={{ id: anime.id }} search={{ ep: next.id }}>
                Próximo
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>

        {episodes.length > 0 && (
          <ol className="mt-6 grid max-h-[40vh] gap-1 overflow-y-auto sm:grid-cols-2">
            {episodes.map((ep) => (
              <li key={ep.id}>
                <Link
                  to="/watch/$id"
                  params={{ id: anime.id }}
                  search={{ ep: ep.id }}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-md px-3 text-sm",
                    current?.id === ep.id ? "bg-elevated text-fg" : "text-muted hover:bg-surface hover:text-fg",
                  )}
                >
                  <span className="w-8 tabular-nums text-xs text-subtle">{ep.number}</span>
                  <span className="truncate">{ep.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
