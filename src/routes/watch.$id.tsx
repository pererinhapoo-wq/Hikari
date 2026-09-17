import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchAnimeDetail } from "@/lib/api";
import { cn } from "@/lib/utils";
import { mergeDetail } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";
import { displayTitle, type Episode } from "@/lib/types";
import { isDirectVideo, youtubeIdFrom } from "@/lib/utils";

export const Route = createFileRoute("/watch/$id")({
  validateSearch: (raw: Record<string, unknown>): { ep?: string } => ({
    ep: typeof raw.ep === "string" && raw.ep ? raw.ep : undefined,
  }),

  loader: async ({ params }) => {
    if (params.id.startsWith("local-")) return { remote: null };

    const remote = await fetchAnimeDetail({
      data: { id: params.id },
    });

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

  const idx = current
    ? episodes.findIndex((e) => e.id === current.id)
    : -1;

  const prev = idx > 0 ? episodes[idx - 1] : null;

  const next =
    idx >= 0 && idx < episodes.length - 1
      ? episodes[idx + 1]
      : null;

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
    () => [
      current?.videoUrl,
      current?.videoUrl2,
      current?.videoUrl3,
    ],
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

  const playUrl =
    playerUrls[playerIndex] ?? current?.videoUrl ?? "";

  const yt =
    youtubeIdFrom(playUrl) ||
    (!playUrl ? youtubeIdFrom(anime.trailerId) : null);

  const file =
    playUrl && isDirectVideo(playUrl)
      ? playUrl
      : null;

  const external =
    playUrl && !yt && !file
      ? playUrl
      : null;

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      {/* CABEÇALHO */}
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
          <p className="truncate text-sm font-medium">
            {title}
          </p>

          <p className="truncate text-xs text-muted">
            {current
              ? `Episódio ${current.number} · ${current.title}`
              : "Trailer"}
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-3 pb-12 sm:px-5">
        {/* PLAYERS */}
        {playerUrls.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {playerUrls.map((url, index) =>
              url ? (
                <Button
                  key={index}
                  type="button"
                  size="sm"
                  variant={
                    playerIndex === index
                      ? "default"
                      : "outline"
                  }
                  onClick={() => setPlayerIndex(index)}
                >
                  Player {index + 1}
                </Button>
              ) : null,
            )}
          </div>
        )}

        {/* PLAYER */}
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
            <video
              src={file}
              controls
              autoPlay
              className="size-full bg-bg object-contain"
            />
          ) : external ? (
            <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="font-display text-2xl">
                Este episódio abre no site oficial
              </p>

              <p className="max-w-md text-sm text-muted">
                O catálogo não replica streams protegidos.
                Use o link da fonte ou adicione uma URL de
                vídeo no painel admin.
              </p>

              <Button asChild>
                <a
                  href={external}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir episódio
                </a>
              </Button>
            </div>
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="font-display text-2xl">
                Sem vídeo neste episódio
              </p>

              <p className="max-w-md text-sm text-muted">
                Adicione um trailer do YouTube ou uma URL de
                vídeo no Admin para reproduzir aqui.
              </p>

              <Button asChild variant="outline">
                <Link
                  to="/admin/$id"
                  params={{
                    id: anime.id.startsWith("local-")
                      ? anime.id
                      : "new",
                  }}
                  search={{ importId: anime.id }}
                >
                  Abrir Admin
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* ANTERIOR / PRÓXIMO */}
        <div className="mt-4 flex items-center justify-between gap-3">
          {prev ? (
            <Button
              asChild
              variant="outline"
              size="sm"
            >
              <Link
                to="/watch/$id"
                params={{ id: anime.id }}
                search={{ ep: prev.id }}
              >
                <ChevronLeft className="size-4" />
                Anterior
              </Link>
            </Button>
          ) : (
            <span />
          )}

          {next && (
            <Button asChild size="sm">
              <Link
                to="/watch/$id"
                params={{ id: anime.id }}
                search={{ ep: next.id }}
              >
                Próximo
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>

        {/* LISTA DE EPISÓDIOS */}
        {episodes.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 font-display text-xl">
              Episódios
            </h2>

            <ol className="grid max-h-[40vh] gap-1 overflow-y-auto sm:grid-cols-2">
              {episodes.map((ep) => (
                <li key={ep.id}>
                  <Link
                    to="/watch/$id"
                    params={{ id: anime.id }}
                    search={{ ep: ep.id }}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-md px-3 text-sm",
                      current?.id === ep.id
                        ? "bg-elevated text-fg"
                        : "text-muted hover:bg-surface hover:text-fg",
                    )}
                  >
                    <span className="w-8 tabular-nums text-xs text-subtle">
                      {ep.number}
                    </span>

                    <span className="truncate">
                      {ep.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ================================================== */}
        {/* COMENTÁRIOS */}
        {/* ================================================== */}

        <CommentsSection
          animeTitle={title}
          episodeNumber={current?.number ?? 1}
        />
      </div>
    </div>
  );
}

/* ========================================================= */
/* COMENTÁRIOS                                               */
/* ========================================================= */

type Comment = {
  id: number;
  name: string;
  text: string;
  likes: number;
  time: string;
};

function CommentsSection({
  animeTitle,
  episodeNumber,
}: {
  animeTitle: string;
  episodeNumber: number;
}) {
  const [text, setText] = useState("");

  const [comments, setComments] = useState<Comment[]>([
    {
      id: 1,
      name: "Hikari",
      text: "O que vocês acharam desse episódio?",
      likes: 12,
      time: "agora",
    },
    {
      id: 2,
      name: "Otaku",
      text: "Esse episódio é muito bom! 🔥",
      likes: 8,
      time: "5 min",
    },
  ]);

  const handleComment = () => {
    const value = text.trim();

    if (!value) return;

    setComments((current) => [
      {
        id: Date.now(),
        name: "Você",
        text: value,
        likes: 0,
        time: "agora",
      },
      ...current,
    ]);

    setText("");
  };

  const handleLike = (id: number) => {
    setComments((current) =>
      current.map((comment) =>
        comment.id === id
          ? {
              ...comment,
              likes: comment.likes + 1,
            }
          : comment,
      ),
    );
  };

  return (
    <section className="mt-12 border-t border-white/5 pt-10">
      {/* TÍTULO */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
            Comentários
          </h2>

          <p className="mt-1 text-sm text-muted">
            Comentários do episódio {episodeNumber} de{" "}
            {animeTitle}
          </p>
        </div>

        <div className="hidden items-center gap-2 text-sm text-muted sm:flex">
          <MessageCircle className="size-4" />
          {comments.length}
        </div>
      </div>

      {/* CAMPO DE COMENTÁRIO */}
      <div className="mt-5 rounded-xl border border-white/5 bg-surface p-4 sm:p-5">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey
            ) {
              event.preventDefault();
              handleComment();
            }
          }}
          placeholder="Escreva um comentário..."
          rows={3}
          className="w-full resize-none rounded-lg border border-white/5 bg-bg px-4 py-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-white/15"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-subtle">
            Enter para enviar · Shift + Enter para quebrar linha
          </p>

          <Button
            type="button"
            size="sm"
            onClick={handleComment}
            disabled={!text.trim()}
          >
            <Send className="size-4" />
            Comentar
          </Button>
        </div>
      </div>

      {/* LISTA */}
      <div className="mt-5 space-y-3">
        {comments.map((comment) => (
          <article
            key={comment.id}
            className="rounded-xl border border-white/5 bg-surface p-4 sm:p-5"
          >
            <div className="flex gap-3">
              {/* AVATAR */}
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated text-sm font-semibold">
                {comment.name.charAt(0).toUpperCase()}
              </div>

              {/* CONTEÚDO */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold">
                    {comment.name}
                  </span>

                  <span className="text-xs text-subtle">
                    · {comment.time}
                  </span>
                </div>

                <p className="mt-2 text-sm leading-6 text-muted">
                  {comment.text}
                </p>

                <div className="mt-3 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => handleLike(comment.id)}
                    className="flex items-center gap-1.5 text-xs text-subtle transition-colors hover:text-fg"
                  >
                    <Heart className="size-4" />
                    {comment.likes}
                  </button>

                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-subtle transition-colors hover:text-fg"
                  >
                    <MessageCircle className="size-4" />
                    Responder
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
            }
