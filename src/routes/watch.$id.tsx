import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Heart,
  MessageCircle,
  MoreVertical,
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
/* TIPO DA ORDENAÇÃO                                         */
/* ========================================================= */

type SortBy =
  | "recent"
  | "liked"
  | "replies"
  | "spoiler";

/* ========================================================= */
/* TIPO DO MOTIVO DA DENÚNCIA                                */
/* ========================================================= */

type ReportReason =
  | "spam"
  | "hate"
  | "spoiler"
  | "sexual"
  | "harassment"
  | "other";

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
  /* ORDENAÇÃO / FILTRO                                      */
  /* ====================================================== */

  const [sortBy, setSortBy] =
    useState<SortBy>("recent");

  const [sortOpen, setSortOpen] =
    useState(false);

  /* ====================================================== */
  /* MODERAÇÃO                                               */
  /* ====================================================== */

  const [openMenuId, setOpenMenuId] =
    useState<string | null>(null);

  const [reportingComment, setReportingComment] =
    useState<Comment | null>(null);

  const [reportReason, setReportReason] =
    useState<ReportReason | "">("");

  const [reportSending, setReportSending] =
    useState(false);

  const [spamConfirmComment, setSpamConfirmComment] =
    useState<Comment | null>(null);

  const [moderatingId, setModeratingId] =
    useState<string | null>(null);

  const [moderationMessage, setModerationMessage] =
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
  /* MARCAR COMO SPOILER                                    */
  /* ====================================================== */

  const handleMarkSpoiler =
    async (
      commentId: string,
    ) => {
      if (moderatingId) {
        return;
      }

      try {
        setModeratingId(
          commentId,
        );

        setError("");
        setOpenMenuId(null);

        const response =
          await fetch(
            "/api/comments/moderation",
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
                action: "spoiler",
              }),
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Não foi possível marcar o comentário como spoiler.",
          );
        }

        if (data.isSpoiler) {
          setComments(
            (current) =>
              current.map(
                (comment) =>
                  comment.id ===
                  commentId
                    ? {
                        ...comment,
                        isSpoiler:
                          true,
                      }
                    : comment,
              ),
          );
        }

        setModerationMessage(
          "Comentário marcado como spoiler.",
        );

        window.setTimeout(() => {
          setModerationMessage("");
        }, 3000);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível marcar o comentário como spoiler.",
        );
      } finally {
        setModeratingId(
          null,
        );
      }
    };

  /* ====================================================== */
  /* ABRIR DENÚNCIA                                         */
  /* ====================================================== */

  const handleOpenReport =
    (comment: Comment) => {
      setOpenMenuId(null);
      setReportingComment(
        comment,
      );
      setReportReason("");
    };

  /* ====================================================== */
  /* ENVIAR DENÚNCIA                                        */
  /* ====================================================== */

  const handleReport =
    async () => {
      if (
        !reportingComment ||
        !reportReason ||
        reportSending
      ) {
        return;
      }

      try {
        setReportSending(
          true,
        );
        setError("");

        const response =
          await fetch(
            "/api/comments/moderation",
            {
              method: "POST",
              credentials:
                "include",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                commentId:
                  reportingComment.id,
                action: "report",
                reason:
                  reportReason,
              }),
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Não foi possível enviar a denúncia.",
          );
        }

        setReportingComment(
          null,
        );
        setReportReason("");

        setModerationMessage(
          "Denúncia enviada. Obrigado por ajudar a manter a comunidade segura.",
        );

        window.setTimeout(() => {
          setModerationMessage("");
        }, 4000);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível enviar a denúncia.",
        );
      } finally {
        setReportSending(
          false,
        );
      }
    };

  /* ====================================================== */
  /* ABRIR CONFIRMAÇÃO DE SPAM                              */
  /* ====================================================== */

  const handleOpenSpam =
    (comment: Comment) => {
      setOpenMenuId(null);
      setSpamConfirmComment(
        comment,
      );
    };

  /* ====================================================== */
  /* CONFIRMAR SPAM                                         */
  /* ====================================================== */

  const handleConfirmSpam =
    async () => {
      if (
        !spamConfirmComment ||
        moderatingId
      ) {
        return;
      }

      const commentId =
        spamConfirmComment.id;

      try {
        setModeratingId(
          commentId,
        );
        setError("");

        const response =
          await fetch(
            "/api/comments/moderation",
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
                action: "spam",
              }),
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Não foi possível marcar o comentário como spam.",
          );
        }

        setSpamConfirmComment(
          null,
        );

        setModerationMessage(
          "Comentário marcado como spam e enviado para análise da moderação.",
        );

        window.setTimeout(() => {
          setModerationMessage("");
        }, 4000);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível marcar o comentário como spam.",
        );
      } finally {
        setModeratingId(
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
  /* COMENTÁRIOS FILTRADOS / ORDENADOS                       */
  /* ====================================================== */

  const displayedRootComments =
    useMemo(() => {
      let result = [
        ...rootComments,
      ];

      if (
        sortBy ===
        "spoiler"
      ) {
        result =
          result.filter(
            (comment) =>
              comment.isSpoiler,
          );
      }

      if (
        sortBy ===
        "liked"
      ) {
        result.sort(
          (a, b) =>
            (b.likes ?? 0) -
            (a.likes ?? 0),
        );
      }

      if (
        sortBy ===
        "replies"
      ) {
        result.sort(
          (a, b) =>
            repliesFor(
              b.id,
            ).length -
            repliesFor(
              a.id,
            ).length,
        );
      }

      if (
        sortBy ===
        "recent"
      ) {
        result.sort(
          (a, b) =>
            new Date(
              b.createdAt,
            ).getTime() -
            new Date(
              a.createdAt,
            ).getTime(),
        );
      }

      return result;
    }, [
      rootComments,
      sortBy,
      comments,
    ]);

  /* ====================================================== */
  /* TEXTO DO FILTRO ATUAL                                  */
  /* ====================================================== */

  const sortLabel =
    sortBy ===
    "recent"
      ? "Mais recentes"
      : sortBy ===
          "liked"
        ? "Mais curtidos"
        : sortBy ===
            "replies"
          ? "Mais respondidos"
          : "Com spoiler";

  /* ====================================================== */
  /* RENDER                                                   */
  /* ====================================================== */

  return (
    <section className="mt-12 border-t border-white/5 pt-10">

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">

        {/* ================================================= */}
        {/* ÁREA PRINCIPAL                                     */}
        {/* ================================================= */}

        <div className="min-w-0">

          {/* =============================================== */}
          {/* TÍTULO + ORDENAÇÃO                              */}
          {/* =============================================== */}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

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

            <div className="flex items-center justify-between gap-3 sm:justify-end">

              <div className="flex items-center gap-2 text-sm text-muted">

                <MessageCircle className="size-4" />

                {comments.length}

              </div>

              {/* ========================================= */}
              {/* DROPDOWN                                  */}
              {/* ========================================= */}

              <div className="relative">

                <button
                  type="button"
                  onClick={() =>
                    setSortOpen(
                      (open) => !open,
                    )
                  }
                  aria-haspopup="menu"
                  aria-expanded={
                    sortOpen
                  }
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-surface px-3 text-sm text-fg outline-none transition-colors hover:border-white/20 hover:bg-elevated focus:border-white/20"
                >

                  <span>
                    {sortLabel}
                  </span>

                  <ChevronDown
                    className={cn(
                      "size-4 text-muted transition-transform",
                      sortOpen &&
                        "rotate-180",
                    )}
                  />

                </button>

                {sortOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[190px] overflow-hidden rounded-xl border border-white/10 bg-[#17171a] p-1 shadow-2xl"
                  >

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSortBy(
                          "recent",
                        );
                        setSortOpen(
                          false,
                        );
                      }}
                      className={cn(
                        "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        sortBy ===
                          "recent"
                          ? "bg-elevated text-fg"
                          : "text-muted hover:bg-elevated hover:text-fg",
                      )}
                    >
                      Mais recentes
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSortBy(
                          "liked",
                        );
                        setSortOpen(
                          false,
                        );
                      }}
                      className={cn(
                        "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        sortBy ===
                          "liked"
                          ? "bg-elevated text-fg"
                          : "text-muted hover:bg-elevated hover:text-fg",
                      )}
                    >
                      Mais curtidos
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSortBy(
                          "replies",
                        );
                        setSortOpen(
                          false,
                        );
                      }}
                      className={cn(
                        "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        sortBy ===
                          "replies"
                          ? "bg-elevated text-fg"
                          : "text-muted hover:bg-elevated hover:text-fg",
                      )}
                    >
                      Mais respondidos
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSortBy(
                          "spoiler",
                        );
                        setSortOpen(
                          false,
                        );
                      }}
                      className={cn(
                        "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        sortBy ===
                          "spoiler"
                          ? "bg-elevated text-fg"
                          : "text-muted hover:bg-elevated hover:text-fg",
                      )}
                    >
                      Com spoiler
                    </button>

                  </div>
                )}

              </div>

            </div>

          </div>

          {/* =============================================== */}
          {/* CAMPO DE COMENTÁRIO                             */}
          {/* =============================================== */}

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

          {/* =============================================== */}
          {/* REGRAS — MOBILE                                  */}
          {/* =============================================== */}

          <div className="mt-5 lg:hidden">
            <CommunityRules />
          </div>

          {/* =============================================== */}
          {/* INDICADOR DO FILTRO                             */}
          {/* =============================================== */}

          {sortBy ===
            "spoiler" && (
            <div className="mt-4 rounded-lg border border-white/5 bg-surface px-4 py-3 text-sm text-muted">
              Mostrando apenas comentários marcados como spoiler.
            </div>
          )}

          {/* =============================================== */}
          {/* LISTA DE COMENTÁRIOS                            */}
          {/* =============================================== */}

          <div className="mt-5 space-y-3">

            {loading ? (
              <div className="rounded-xl border border-white/5 bg-surface p-5 text-sm text-muted">
                Carregando comentários...
              </div>
            ) : displayedRootComments.length ===
              0 ? (
              <div className="rounded-xl border border-white/5 bg-surface p-5 text-center text-sm text-muted">
                {sortBy ===
                "spoiler"
                  ? (
                    <>
                      Não há comentários com spoiler neste episódio.
                      <br />
                      Tente outro filtro.
                    </>
                  )
                  : (
                    <>
                      Ainda não há comentários neste episódio.
                      <br />
                      Seja o primeiro a comentar.
                    </>
                  )}
              </div>
            ) : (
              displayedRootComments.map(
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
                        openMenuId={
                          openMenuId
                        }
                        onToggleMenu={() => {
                          setOpenMenuId(
                            (current) =>
                              current ===
                              comment.id
                                ? null
                                : comment.id,
                          );
                        }}
                        onMarkSpoiler={() =>
                          void handleMarkSpoiler(
                            comment.id,
                          )
                        }
                        onReport={() =>
                          handleOpenReport(
                            comment,
                          )
                        }
                        onSpam={() =>
                          handleOpenSpam(
                            comment,
                          )
                        }
                        moderatingId={
                          moderatingId
                        }
                      />

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
                                openMenuId={
                                  openMenuId
                                }
                                onToggleMenu={() => {
                                  setOpenMenuId(
                                    (current) =>
                                      current ===
                                      reply.id
                                        ? null
                                        : reply.id,
                                  );
                                }}
                                onMarkSpoiler={() =>
                                  void handleMarkSpoiler(
                                    reply.id,
                                  )
                                }
                                onReport={() =>
                                  handleOpenReport(
                                    reply,
                                  )
                                }
                                onSpam={() =>
                                  handleOpenSpam(
                                    reply,
                                  )
                                }
                                moderatingId={
                                  moderatingId
                                }
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

        </div>

        {/* ================================================= */}
        {/* REGRAS — DESKTOP                                  */}
        {/* ================================================= */}

        <div className="hidden lg:block">
          <CommunityRules />
        </div>

      </div>

      {/* =================================================== */}
      {/* MENSAGEM DE MODERAÇÃO                               */}
      {/* =================================================== */}

      {moderationMessage && (
        <div className="fixed inset-x-3 bottom-4 z-[100] flex justify-center pointer-events-none">
          <div className="rounded-xl border border-white/10 bg-[#17171a] px-4 py-3 text-center text-sm text-fg shadow-2xl">
            {moderationMessage}
          </div>
        </div>
      )}

      {/* =================================================== */}
      {/* MODAL DE DENÚNCIA                                   */}
      {/* =================================================== */}

      {reportingComment && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              if (!reportSending) {
                setReportingComment(
                  null,
                );
                setReportReason(
                  "",
                );
              }
            }
          }}
        >

          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl sm:p-6">

            <div className="flex items-start gap-3">

              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated">
                <Flag className="size-5" />
              </div>

              <div className="min-w-0 flex-1">

                <h3 className="font-display text-xl">
                  Denunciar comentário
                </h3>

                <p className="mt-1 text-sm text-muted">
                  Por que você está denunciando este comentário?
                </p>

              </div>

              <button
                type="button"
                onClick={() => {
                  if (
                    !reportSending
                  ) {
                    setReportingComment(
                      null,
                    );
                    setReportReason(
                      "",
                    );
                  }
                }}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-fg"
                aria-label="Fechar"
              >
                <X className="size-5" />
              </button>

            </div>

            <div className="mt-5 space-y-2">

              <ReportOption
                value="spam"
                label="Spam ou propaganda"
                selected={
                  reportReason ===
                  "spam"
                }
                onChange={
                  setReportReason
                }
              />

              <ReportOption
                value="hate"
                label="Discurso de ódio ou ofensa"
                selected={
                  reportReason ===
                  "hate"
                }
                onChange={
                  setReportReason
                }
              />

              <ReportOption
                value="spoiler"
                label="Spoiler não marcado"
                selected={
                  reportReason ===
                  "spoiler"
                }
                onChange={
                  setReportReason
                }
              />

              <ReportOption
                value="sexual"
                label="Conteúdo sexual ou impróprio"
                selected={
                  reportReason ===
                  "sexual"
                }
                onChange={
                  setReportReason
                }
              />

              <ReportOption
                value="harassment"
                label="Assédio ou ameaça"
                selected={
                  reportReason ===
                  "harassment"
                }
                onChange={
                  setReportReason
                }
              />

              <ReportOption
                value="other"
                label="Outro motivo"
                selected={
                  reportReason ===
                  "other"
                }
                onChange={
                  setReportReason
                }
              />

            </div>

            <p className="mt-4 text-xs leading-5 text-subtle">
              Sua denúncia será analisada pela equipe de moderação.
            </p>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (
                    !reportSending
                  ) {
                    setReportingComment(
                      null,
                    );
                    setReportReason(
                      "",
                    );
                  }
                }}
                disabled={
                  reportSending
                }
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={() =>
                  void handleReport()
                }
                disabled={
                  !reportReason ||
                  reportSending
                }
              >
                <Flag className="size-4" />

                {reportSending
                  ? "Enviando..."
                  : "Enviar denúncia"}
              </Button>

            </div>

          </div>

        </div>
      )}

      {/* =================================================== */}
      {/* MODAL DE SPAM                                       */}
      {/* =================================================== */}

      {spamConfirmComment && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              if (
                !moderatingId
              ) {
                setSpamConfirmComment(
                  null,
                );
              }
            }
          }}
        >

          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl sm:p-6">

            <div className="flex items-start gap-3">

              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated">
                <AlertTriangle className="size-5" />
              </div>

              <div className="min-w-0 flex-1">

                <h3 className="font-display text-xl">
                  Marcar como spam?
                </h3>

                <p className="mt-2 text-sm leading-6 text-muted">
                  Este comentário será sinalizado para análise da moderação.
                </p>

              </div>

            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setSpamConfirmComment(
                    null,
                  )
                }
                disabled={
                  Boolean(
                    moderatingId,
                  )
                }
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={() =>
                  void handleConfirmSpam()
                }
                disabled={
                  Boolean(
                    moderatingId,
                  )
                }
              >
                <AlertTriangle className="size-4" />

                {moderatingId
                  ? "Enviando..."
                  : "Marcar como spam"}
              </Button>

            </div>

          </div>

        </div>
      )}

    </section>
  );
}

/* ========================================================= */
/* OPÇÃO DE DENÚNCIA                                         */
/* ========================================================= */

function ReportOption({
  value,
  label,
  selected,
  onChange,
}: {
  value: ReportReason;
  label: string;
  selected: boolean;
  onChange: (
    value: ReportReason,
  ) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm transition-colors",
        selected
          ? "border-white/15 bg-elevated text-fg"
          : "border-white/5 bg-bg/40 text-muted hover:border-white/10 hover:bg-elevated hover:text-fg",
      )}
    >

      <input
        type="radio"
        name="comment-report-reason"
        value={value}
        checked={selected}
        onChange={() =>
          onChange(value)
        }
        className="size-4 accent-current"
      />

      <span>
        {label}
      </span>

    </label>
  );
}

/* ========================================================= */
/* REGRAS DA COMUNIDADE                                      */
/* ========================================================= */

function CommunityRules() {
  return (
    <aside className="h-fit rounded-xl border border-white/5 bg-surface p-5 lg:sticky lg:top-5">

      <div className="flex items-start gap-3">

        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated text-lg">
          🛡️
        </div>

        <div>
          <h3 className="font-display text-lg">
            Regras da comunidade
          </h3>

          <p className="mt-1 text-xs leading-5 text-subtle">
            Ajude a manter os comentários do Hikari agradáveis para todos.
          </p>
        </div>

      </div>

      <div className="mt-5 space-y-3">

        <RuleItem
          icon="🤝"
          text="Seja respeitoso"
        />

        <RuleItem
          icon="🚫"
          text="Sem spoilers no título"
        />

        <RuleItem
          icon="🛑"
          text="Sem discurso de ódio"
        />

        <RuleItem
          icon="📵"
          text="Proibido spam"
        />

        <RuleItem
          icon="⚠️"
          text="Denuncie conteúdo impróprio"
        />

      </div>

    </aside>
  );
}

/* ========================================================= */
/* ITEM DE REGRA                                             */
/* ========================================================= */

function RuleItem({
  icon,
  text,
}: {
  icon: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-bg/40 px-3 py-2.5">

      <span className="flex size-7 shrink-0 items-center justify-center text-sm">
        {icon}
      </span>

      <span className="text-sm text-muted">
        {text}
      </span>

    </div>
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
  openMenuId,
  onToggleMenu,
  onMarkSpoiler,
  onReport,
  onSpam,
  moderatingId,
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
  openMenuId: string | null;
  onToggleMenu: () => void;
  onMarkSpoiler: () => void;
  onReport: () => void;
  onSpam: () => void;
  moderatingId: string | null;
  isReply?: boolean;
}) {
  const isReplying =
    replyingId ===
    comment.id;

  const menuOpen =
    openMenuId ===
    comment.id;

  const isModerating =
    moderatingId ===
    comment.id;

  return (
    <article
      className={cn(
        "relative rounded-xl border border-white/5 bg-surface p-4 sm:p-5",
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

          <div className="flex items-start justify-between gap-3">

            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">

              <span className="text-sm font-semibold">
                {comment.userName ||
                  "Usuário"}
              </span>

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

            {/* ============================================= */}
            {/* MENU DE TRÊS PONTOS                           */}
            {/* ============================================= */}

            <div className="relative shrink-0">

              <button
                type="button"
                onClick={
                  onToggleMenu
                }
                aria-label="Mais opções"
                aria-haspopup="menu"
                aria-expanded={
                  menuOpen
                }
                className="flex size-9 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-elevated hover:text-fg"
              >

                <MoreVertical className="size-5" />

              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#17171a] p-1 shadow-2xl"
                >

                  {/* MARCAR SPOILER */}

                  <button
                    type="button"
                    role="menuitem"
                    disabled={
                      comment.isSpoiler ||
                      isModerating
                    }
                    onClick={
                      onMarkSpoiler
                    }
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      comment.isSpoiler
                        ? "cursor-not-allowed text-subtle"
                        : "text-muted hover:bg-elevated hover:text-fg",
                    )}
                  >

                    <span>
                      ⚠️
                    </span>

                    <span>
                      {comment.isSpoiler
                        ? "Já marcado como spoiler"
                        : "Marcar como spoiler"}
                    </span>

                  </button>

                  {/* DENUNCIAR */}

                  <button
                    type="button"
                    role="menuitem"
                    disabled={
                      isModerating
                    }
                    onClick={
                      onReport
                    }
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-elevated hover:text-fg"
                  >

                    <Flag className="size-4" />

                    <span>
                      Denunciar comentário
                    </span>

                  </button>

                  {/* SPAM */}

                  <button
                    type="button"
                    role="menuitem"
                    disabled={
                      isModerating
                    }
                    onClick={
                      onSpam
                    }
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-elevated hover:text-fg"
                  >

                    <span>
                      🚫
                    </span>

                    <span>
                      Marcar como spam
                    </span>

                  </button>

                </div>
              )}

            </div>

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
