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
import { cn, isDirectVideo, youtubeIdFrom } from "@/lib/utils";
import { mergeDetail } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";
import { displayTitle, type Episode } from "@/lib/types";

export const Route = createFileRoute("/watch/$id")({
  validateSearch: (
    raw: Record<string, unknown>,
  ): { ep?: string } => ({
    ep:
      typeof raw.ep === "string" && raw.ep
        ? raw.ep
        : undefined,
  }),

  loader: async ({ params }) => {
    if (params.id.startsWith("local-")) {
      return { remote: null };
    }

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
  const markContinue = useHikariStore(
    (s) => s.markContinue,
  );

  const anime = mergeDetail(
    remote,
    id,
    locals,
  );

  const episodes = useMemo(() => {
    if (!anime) {
      return [] as Episode[];
    }

    return anime.seasons.flatMap(
      (s) => s.episodes,
    );
  }, [anime]);

  const current = useMemo(() => {
    if (!episodes.length) {
      return null;
    }

    return (
      episodes.find(
        (e) => e.id === epQuery,
      ) ?? episodes[0]
    );
  }, [episodes, epQuery]);

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
        current.thumbnail ||
        anime.cover,
      title: displayTitle(anime),
      updatedAt: Date.now(),
    });
  }, [
    anime,
    current,
    markContinue,
  ]);

  const title = anime
    ? displayTitle(anime)
    : "";

  const playerUrls = useMemo(
    () => [
      current?.videoUrl,
      current?.videoUrl2,
      current?.videoUrl3,
    ],
    [current],
  );

  const [playerIndex, setPlayerIndex] =
    useState(0);

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
    playerUrls[playerIndex] ??
    current?.videoUrl ??
    "";

  const yt =
    youtubeIdFrom(playUrl) ||
    (!playUrl
      ? youtubeIdFrom(
          anime.trailerId,
        )
      : null);

  const file =
    playUrl &&
    isDirectVideo(playUrl)
      ? playUrl
      : null;

  const external =
    playUrl &&
    !yt &&
    !file
      ? playUrl
      : null;

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">

      {/* ================================================== */}
      {/* CABEÇALHO */}
      {/* ================================================== */}

      <header className="flex h-14 items-center gap-2 px-3 sm:px-5">
        <Link
          to="/anime/$id"
          params={{
            id: anime.id,
          }}
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

        {/* ================================================== */}
        {/* PLAYERS */}
        {/* ================================================== */}

        {playerUrls.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {playerUrls.map(
              (url, index) =>
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
                    onClick={() =>
                      setPlayerIndex(index)
                    }
                  >
                    Player {index + 1}
                  </Button>
                ) : null,
            )}
          </div>
        )}

        {/* ================================================== */}
        {/* PLAYER */}
        {/* ================================================== */}

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

              <Button
                asChild
                variant="outline"
              >
                <Link
                  to="/admin/$id"
                  params={{
                    id: anime.id.startsWith(
                      "local-",
                    )
                      ? anime.id
                      : "new",
                  }}
                  search={{
                    importId: anime.id,
                  }}
                >
                  Abrir Admin
                </Link>
              </Button>

            </div>
          )}

        </div>

        {/* ================================================== */}
        {/* ANTERIOR / PRÓXIMO */}
        {/* ================================================== */}

        <div className="mt-4 flex items-center justify-between gap-3">

          {prev ? (
            <Button
              asChild
              variant="outline"
              size="sm"
            >
              <Link
                to="/watch/$id"
                params={{
                  id: anime.id,
                }}
                search={{
                  ep: prev.id,
                }}
              >
                <ChevronLeft className="size-4" />
                Anterior
              </Link>
            </Button>
          ) : (
            <span />
          )}

          {next && (
            <Button
              asChild
              size="sm"
            >
              <Link
                to="/watch/$id"
                params={{
                  id: anime.id,
                }}
                search={{
                  ep: next.id,
                }}
              >
                Próximo
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          )}

        </div>

        {/* ================================================== */}
        {/* LISTA DE EPISÓDIOS */}
        {/* ================================================== */}

        {episodes.length > 0 && (
          <section className="mt-6">

            <h2 className="mb-3 font-display text-xl">
              Episódios
            </h2>

            <ol className="grid max-h-[40vh] gap-1 overflow-y-auto sm:grid-cols-2">

              {episodes.map(
                (ep) => (
                  <li key={ep.id}>

                    <Link
                      to="/watch/$id"
                      params={{
                        id: anime.id,
                      }}
                      search={{
                        ep: ep.id,
                      }}
                      className={cn(
                        "flex min-h-12 items-center gap-3 rounded-md px-3 text-sm",
                        current?.id ===
                          ep.id
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
                ),
              )}

            </ol>

          </section>
        )}

        {/* ================================================== */}
        {/* COMENTÁRIOS */}
        {/* ================================================== */}

        <CommentsSection
          animeId={anime.id}
          episodeId={
            current?.id ?? ""
          }
          animeTitle={title}
          episodeNumber={
            current?.number ?? 1
          }
        />

      </div>
    </div>
  );
}

/* ========================================================= */
/* TIPO DO COMENTÁRIO                                        */
/* ========================================================= */

type Comment = {
  id: string;
  animeId: string;
  episodeId: string;
  content: string;
  parentId: string | null;
  isSpoiler: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
  userName: string | null;
  userImage: string | null;
  likes: number;
  liked: boolean;
};

/* ========================================================= */
/* COMENTÁRIOS                                               */
/* ========================================================= */

function CommentsSection({
  animeId,
  episodeId,
  animeTitle,
  episodeNumber,
}: {
  animeId: string;
  episodeId: string;
  animeTitle: string;
  episodeNumber: number;
}) {
  const [text, setText] =
    useState("");

  const [isSpoiler, setIsSpoiler] =
    useState(false);

  const [comments, setComments] =
    useState<Comment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [likingId, setLikingId] =
    useState<string | null>(null);

  const [replyingId, setReplyingId] =
    useState<string | null>(null);

  const [replyText, setReplyText] =
    useState("");

  const [replyIsSpoiler, setReplyIsSpoiler] =
    useState(false);

  const [replySending, setReplySending] =
    useState(false);

  const [error, setError] =
    useState("");

  /* ====================================================== */
  /* CARREGAR COMENTÁRIOS                                   */
  /* ====================================================== */

  useEffect(() => {
    if (
      !animeId ||
      !episodeId
    ) {
      return;
    }

    let cancelled = false;

    async function loadComments() {
      try {
        setLoading(true);
        setError("");

        const response =
          await fetch(
            `/api/comments?animeId=${encodeURIComponent(
              animeId,
            )}&episodeId=${encodeURIComponent(
              episodeId,
            )}`,
            {
              method: "GET",
              credentials:
                "include",
            },
          );

        if (!response.ok) {
          throw new Error(
            "Não foi possível carregar os comentários.",
          );
        }

        const data =
          await response.json();

        if (!cancelled) {
          setComments(
            Array.isArray(
              data.comments,
            )
              ? data.comments
              : [],
          );
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            "Não foi possível carregar os comentários.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadComments();

    return () => {
      cancelled = true;
    };
  }, [
    animeId,
    episodeId,
  ]);

  /* ====================================================== */
  /* ENVIAR COMENTÁRIO                                      */
  /* ====================================================== */

  const handleComment =
    async () => {
      const value =
        text.trim();

      if (
        !value ||
        !animeId ||
        !episodeId ||
        sending
      ) {
        return;
      }

      try {
        setSending(true);
        setError("");

        const response =
          await fetch(
            "/api/comments",
            {
              method: "POST",
              credentials:
                "include",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                animeId,
                episodeId,
                content: value,
                parentId: null,
                isSpoiler,
              }),
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Não foi possível publicar o comentário.",
          );
        }

        if (data.comment) {
          setComments(
            (current) => [
              data.comment,
              ...current,
            ],
          );
        }

        setText("");
        setIsSpoiler(false);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível publicar o comentário.",
        );
      } finally {
        setSending(false);
      }
    };

  /* ====================================================== */
  /* ENVIAR RESPOSTA                                        */
  /* ====================================================== */

  const handleReply =
    async (
      parentId: string,
    ) => {
      const value =
        replyText.trim();

      if (
        !value ||
        !animeId ||
        !episodeId ||
        replySending
      ) {
        return;
      }

      try {
        setReplySending(true);
        setError("");

        const response =
          await fetch(
            "/api/comments",
            {
              method: "POST",
              credentials:
                "include",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                animeId,
                episodeId,
                content: value,
                parentId,
                isSpoiler:
                  replyIsSpoiler,
              }),
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Não foi possível publicar a resposta.",
          );
        }

        if (data.comment) {
          setComments(
            (current) => [
              ...current,
              data.comment,
            ],
          );
        }

        setReplyText("");
        setReplyIsSpoiler(false);
        setReplyingId(null);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível publicar a resposta.",
        );
      } finally {
        setReplySending(false);
      }
    };

  /* ====================================================== */
  /* CURTIR / DESCURTIR                                     */
  /* ====================================================== */

  const handleLike =
    async (
      commentId: string,
    ) => {
      if (likingId) {
        return;
      }

      try {
        setLikingId(
          commentId,
        );

        setError("");

        const response =
          await fetch(
            "/api/comments/like",
            {
              method: "POST",
              credentials:
                "include",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                commentId,
              }),
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Não foi possível alterar a curtida.",
          );
        }

        setComments(
          (current) =>
            current.map(
              (comment) =>
                comment.id ===
                commentId
                  ? {
                      ...comment,
                      likes:
                        Number(
                          data.likes,
                        ) || 0,
                      liked:
                        Boolean(
                          data.liked,
                        ),
                    }
                  : comment,
            ),
        );
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível alterar a curtida.",
        );
      } finally {
        setLikingId(
          null,
        );
      }
    };

  /* ====================================================== */
  /* DATA                                                    */
  /* ====================================================== */

  const formatDate =
    (value: string) => {
      const date =
        new Date(value);

      if (
        Number.isNaN(
          date.getTime(),
        )
      ) {
        return "";
      }

      return date.toLocaleDateString(
        "pt-BR",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        },
      );
    };

  /* ====================================================== */
  /* COMENTÁRIOS PRINCIPAIS                                  */
  /* ====================================================== */

  const rootComments =
    comments.filter(
      (comment) =>
        !comment.parentId,
    );

  /* ====================================================== */
  /* RESPOSTAS                                               */
  /* ====================================================== */

  const repliesFor =
    (parentId: string) =>
      comments.filter(
        (comment) =>
          comment.parentId ===
          parentId,
      );

  /* ====================================================== */
  /* RENDER                                                   */
  /* ====================================================== */

  return (
    <section className="mt-12 border-t border-white/5 pt-10">

      {/* ================================================== */}
      {/* TÍTULO */}
      {/* ================================================== */}

      <div className="flex items-center justify-between gap-4">

        <div>

          <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
            Comentários
          </h2>

          <p className="mt-1 text-sm text-muted">
            Comentários do episódio{" "}
            {episodeNumber} de{" "}
            {animeTitle}
          </p>

        </div>

        <div className="hidden items-center gap-2 text-sm text-muted sm:flex">

          <MessageCircle className="size-4" />

          {comments.length}

        </div>

      </div>

      {/* ================================================== */}
      {/* CAMPO DE COMENTÁRIO                                 */}
      {/* ================================================== */}

      <div className="mt-5 rounded-xl border border-white/5 bg-surface p-4 sm:p-5">

        <textarea
          value={text}
          onChange={(
            event,
          ) => {
            setText(
              event.target.value,
            );
          }}
          onKeyDown={(
            event,
          ) => {
            if (
              event.key ===
                "Enter" &&
              !event.shiftKey
            ) {
              event.preventDefault();

              void handleComment();
            }
          }}
          placeholder="Escreva um comentário..."
          rows={3}
          maxLength={2000}
          className="w-full resize-none rounded-lg border border-white/5 bg-bg px-4 py-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-white/15"
        />

        {/* ================================================= */}
        {/* OPÇÃO DE SPOILER                                  */}
        {/* ================================================= */}

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-muted select-none">

          <input
            type="checkbox"
            checked={isSpoiler}
            onChange={(
              event,
            ) => {
              setIsSpoiler(
                event.target
                  .checked,
              );
            }}
            className="size-4 accent-current"
          />

          <span>
            Marcar como spoiler
          </span>

        </label>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <p className="text-xs text-subtle">
            Enter para enviar · Shift + Enter para quebrar linha
          </p>

          <Button
            type="button"
            size="sm"
            onClick={() =>
              void handleComment()
            }
            disabled={
              !text.trim() ||
              sending
            }
          >
            <Send className="size-4" />

            {sending
              ? "Enviando..."
              : "Comentar"}
          </Button>

        </div>

        {error && (
          <p className="mt-3 text-sm text-red-400">
            {error}
          </p>
        )}

      </div>

      {/* ================================================== */}
      {/* LISTA DE COMENTÁRIOS                               */}
      {/* ================================================== */}

      <div className="mt-5 space-y-3">

        {loading ? (
          <div className="rounded-xl border border-white/5 bg-surface p-5 text-sm text-muted">
            Carregando comentários...
          </div>
        ) : rootComments.length ===
          0 ? (
          <div className="rounded-xl border border-white/5 bg-surface p-5 text-center text-sm text-muted">
            Ainda não há comentários neste episódio.
            <br />
            Seja o primeiro a comentar.
          </div>
        ) : (
          rootComments.map(
            (comment) => {
              const replies =
                repliesFor(
                  comment.id,
                );

              return (
                <div
                  key={
                    comment.id
                  }
                  className="space-y-2"
                >

                  {/* ====================================== */}
                  {/* COMENTÁRIO PRINCIPAL                   */}
                  {/* ====================================== */}

                  <CommentCard
                    comment={
                      comment
                    }
                    replyCount={
                      replies.length
                    }
                    likingId={
                      likingId
                    }
                    replyingId={
                      replyingId
                    }
                    replyText={
                      replyText
                    }
                    replyIsSpoiler={
                      replyIsSpoiler
                    }
                    replySending={
                      replySending
                    }
                    formatDate={
                      formatDate
                    }
                    onLike={
                      handleLike
                    }
                    onReplyChange={
                      setReplyText
                    }
                    onReplySpoilerChange={
                      setReplyIsSpoiler
                    }
                    onStartReply={() => {
                      setReplyingId(
                        comment.id,
                      );
                      setReplyText(
                        "",
                      );
                      setReplyIsSpoiler(
                        false,
                      );
                    }}
                    onCancelReply={() => {
                      setReplyingId(
                        null,
                      );
                      setReplyText(
                        "",
                      );
                      setReplyIsSpoiler(
                        false,
                      );
                    }}
                    onSendReply={() => {
                      void handleReply(
                        comment.id,
                      );
                    }}
                  />

                  {/* ====================================== */}
                  {/* RESPOSTAS                               */}
                  {/* ====================================== */}

                  {replies.length >
                    0 && (
                    <div className="ml-5 space-y-2 border-l border-white/10 pl-3 sm:ml-8 sm:pl-4">

                      {replies.map(
                        (
                          reply,
                        ) => (
                          <CommentCard
                            key={
                              reply.id
                            }
                            comment={
                              reply
                            }
                            replyCount={
                              0
                            }
                            replyToName={
                              comment.userName ||
                              "Usuário"
                            }
                            likingId={
                              likingId
                            }
                            replyingId={
                              null
                            }
                            replyText=""
                            replyIsSpoiler={
                              false
                            }
                            replySending={
                              false
                            }
                            formatDate={
                              formatDate
                            }
                            onLike={
                              handleLike
                            }
                            onReplyChange={() => {}}
                            onReplySpoilerChange={() => {}}
                            onStartReply={() => {}}
                            onCancelReply={() => {}}
                            onSendReply={() => {}}
                            isReply
                          />
                        ),
                      )}

                    </div>
                  )}

                </div>
              );
            },
          )
        )}

      </div>

    </section>
  );
}

/* ========================================================= */
/* CARD DO COMENTÁRIO                                        */
/* ========================================================= */

function CommentCard({
  comment,
  replyCount,
  replyToName,
  likingId,
  replyingId,
  replyText,
  replyIsSpoiler,
  replySending,
  formatDate,
  onLike,
  onReplyChange,
  onReplySpoilerChange,
  onStartReply,
  onCancelReply,
  onSendReply,
  isReply = false,
}: {
  comment: Comment;
  replyCount: number;
  replyToName?: string;
  likingId: string | null;
  replyingId: string | null;
  replyText: string;
  replyIsSpoiler: boolean;
  replySending: boolean;
  formatDate: (
    value: string,
  ) => string;
  onLike: (
    id: string,
  ) => void;
  onReplyChange: (
    value: string,
  ) => void;
  onReplySpoilerChange: (
    value: boolean,
  ) => void;
  onStartReply: () => void;
  onCancelReply: () => void;
  onSendReply: () => void;
  isReply?: boolean;
}) {
  const isReplying =
    replyingId ===
    comment.id;

  return (
    <article
      className={cn(
        "rounded-xl border border-white/5 bg-surface p-4 sm:p-5",
        isReply &&
          "bg-surface/80",
      )}
    >

      <div className="flex gap-3">

        {/* ================================================= */}
        {/* AVATAR                                            */}
        {/* ================================================= */}

        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated text-sm font-semibold">

          {comment.userImage ? (
            <img
              src={
                comment.userImage
              }
              alt=""
              className="size-full object-cover"
            />
          ) : (
            (
              comment.userName ||
              "U"
            )
              .charAt(0)
              .toUpperCase()
          )}

        </div>

        {/* ================================================= */}
        {/* CONTEÚDO                                          */}
        {/* ================================================= */}

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">

            <span className="text-sm font-semibold">
              {comment.userName ||
                "Usuário"}
            </span>

            {/* ============================================= */}
            {/* DESTINATÁRIO DA RESPOSTA                      */}
            {/* ============================================= */}

            {isReply &&
              replyToName && (
                <>
                  <span className="text-sm text-subtle">
                    →
                  </span>

                  <span className="text-sm font-semibold text-muted">
                    {replyToName}
                  </span>
                </>
              )}

            <span className="text-xs text-subtle">
              ·{" "}
              {formatDate(
                comment.createdAt,
              )}
            </span>

          </div>

          {/* =============================================== */}
          {/* SPOILER                                          */}
          {/* =============================================== */}

          {comment.isSpoiler ? (
            <details className="mt-2 rounded-lg border border-white/5 bg-bg/50 px-3 py-2">

              <summary className="cursor-pointer text-sm font-medium text-fg">
                ⚠️ Mostrar spoiler
              </summary>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                {comment.content}
              </p>

            </details>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
              {comment.content}
            </p>
          )}

          {/* =============================================== */}
          {/* AÇÕES                                            */}
          {/* =============================================== */}

          <div className="mt-3 flex flex-wrap items-center gap-4">

            {/* CURTIDA */}

            <button
              type="button"
              onClick={() =>
                void onLike(
                  comment.id,
                )
              }
              disabled={
                likingId ===
                comment.id
              }
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors",
                comment.liked
                  ? "text-fg"
                  : "text-subtle hover:text-fg",
              )}
              aria-label={
                comment.liked
                  ? "Remover curtida"
                  : "Curtir comentário"
              }
            >

              <Heart
                className={cn(
                  "size-4",
                  comment.liked &&
                    "fill-current",
                )}
              />

              {comment.likes}

            </button>

            {/* RESPONDER */}

            {!isReply && (
              <button
                type="button"
                onClick={
                  onStartReply
                }
                className="flex items-center gap-1.5 text-xs text-subtle transition-colors hover:text-fg"
              >

                <MessageCircle className="size-4" />

                Responder

              </button>
            )}

            {/* CONTADOR DE RESPOSTAS */}

            {!isReply &&
              replyCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-subtle">

                  <MessageCircle className="size-4" />

                  {replyCount}{" "}
                  {replyCount ===
                  1
                    ? "Resposta"
                    : "Respostas"}

                </span>
              )}

          </div>

          {/* =============================================== */}
          {/* CAIXA DE RESPOSTA                                */}
          {/* =============================================== */}

          {isReplying && (
            <div className="mt-4 rounded-lg border border-white/5 bg-bg p-3">

              <textarea
                value={
                  replyText
                }
                onChange={(
                  event,
                ) => {
                  onReplyChange(
                    event.target
                      .value,
                  );
                }}
                rows={3}
                maxLength={
                  2000
                }
                placeholder="Escreva uma resposta..."
                className="w-full resize-none rounded-lg border border-white/5 bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-subtle focus:border-white/15"
              />

              {/* ========================================= */}
              {/* SPOILER DA RESPOSTA                        */}
              {/* ========================================= */}

              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted select-none">

                <input
                  type="checkbox"
                  checked={
                    replyIsSpoiler
                  }
                  onChange={(
                    event,
                  ) => {
                    onReplySpoilerChange(
                      event.target
                        .checked,
                    );
                  }}
                  className="size-4 accent-current"
                />

                <span>
                  Marcar como spoiler
                </span>

              </label>

              <div className="mt-3 flex items-center justify-end gap-2">

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={
                    onCancelReply
                  }
                  disabled={
                    replySending
                  }
                >
                  Cancelar
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={
                    onSendReply
                  }
                  disabled={
                    !replyText.trim() ||
                    replySending
                  }
                >
                  <Send className="size-4" />

                  {replySending
                    ? "Enviando..."
                    : "Responder"}
                </Button>

              </div>

            </div>
          )}

        </div>

      </div>

    </article>
  );
                 }
