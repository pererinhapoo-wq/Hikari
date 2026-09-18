import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Flag,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreVertical,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { upload } from "@vercel/blob/client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { fetchAnimeDetail } from "@/lib/api";
import { isHikariAdmin } from "@/lib/auth/admin";
import {
  cn,
  isDirectVideo,
  youtubeIdFrom,
} from "@/lib/utils";
import { mergeDetail } from "@/lib/overlay";
import { useHikariStore } from "@/lib/store";
import {
  displayTitle,
  type Episode,
} from "@/lib/types";

export const Route = createFileRoute("/watch/$id")({
  validateSearch: (
    raw: Record<string, unknown>,
  ): {
    ep?: string;
    comment?: string;
  } => ({
    ep:
      typeof raw.ep === "string" && raw.ep
        ? raw.ep
        : undefined,

    comment:
      typeof raw.comment === "string" &&
      raw.comment
        ? raw.comment
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

  const {
    ep: epQuery,
    comment: commentQuery,
  } = Route.useSearch();

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
          targetCommentId={
            commentQuery
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
  imageUrl: string | null;
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
/* TIPO DA DENÚNCIA                                          */
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
  targetCommentId,
}: {
  animeId: string;
  episodeId: string;
  animeTitle: string;
  episodeNumber: number;
  targetCommentId?: string;
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
  /* IMAGEM DO COMENTÁRIO                                   */
  /* ====================================================== */

  const [commentImage, setCommentImage] =
    useState<File | null>(null);

  const [commentImagePreview, setCommentImagePreview] =
    useState<string | null>(null);

  const [imageUploading, setImageUploading] =
    useState(false);

  const imageInputRef =
    useRef<HTMLInputElement | null>(null);

  /* ====================================================== */
  /* USUÁRIO ATUAL                                          */
  /* ====================================================== */

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [currentUserEmail, setCurrentUserEmail] =
    useState<string | null>(null);

  const [sessionLoading, setSessionLoading] =
    useState(true);

  const isAdmin =
    isHikariAdmin(
      currentUserEmail,
    );

  /* ====================================================== */
  /* DESTAQUE DA NOTIFICAÇÃO                                */
  /* ====================================================== */

  const [
    highlightedCommentId,
    setHighlightedCommentId,
  ] = useState<string | null>(
    null,
  );

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

  const [menuOpenId, setMenuOpenId] =
    useState<string | null>(null);

  const [moderatingId, setModeratingId] =
    useState<string | null>(null);

  const [reportingComment, setReportingComment] =
    useState<Comment | null>(null);

  const [reportReason, setReportReason] =
    useState<ReportReason | "">("");

  const [reportSending, setReportSending] =
    useState(false);

  const [spamComment, setSpamComment] =
    useState<Comment | null>(null);

  const [moderationSuccess, setModerationSuccess] =
    useState("");

  /* ====================================================== */
  /* EDIÇÃO                                                  */
  /* ====================================================== */

  const [editingComment, setEditingComment] =
    useState<Comment | null>(null);

  const [editText, setEditText] =
    useState("");

  const [editIsSpoiler, setEditIsSpoiler] =
    useState(false);

  const [editSaving, setEditSaving] =
    useState(false);

  /* ====================================================== */
  /* EXCLUSÃO                                                */
  /* ====================================================== */

  const [deletingComment, setDeletingComment] =
    useState<Comment | null>(null);

  const [deleteSending, setDeleteSending] =
    useState(false);

  /* ====================================================== */
  /* LIMPAR PREVIEW QUANDO A IMAGEM MUDA                     */
  /* ====================================================== */

  useEffect(() => {
    if (!commentImage) {
      setCommentImagePreview(null);
      return;
    }

    const previewUrl =
      URL.createObjectURL(
        commentImage,
      );

    setCommentImagePreview(
      previewUrl,
    );

    return () => {
      URL.revokeObjectURL(
        previewUrl,
      );
    };
  }, [
    commentImage,
  ]);

  /* ====================================================== */
  /* SELECIONAR IMAGEM                                      */
  /* ====================================================== */

  const handleSelectImage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ].includes(file.type)
    ) {
      setError(
        "Escolha uma imagem JPG, PNG, WebP ou GIF.",
      );

      event.target.value = "";

      return;
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      setError(
        "A imagem pode ter no máximo 10 MB.",
      );

      event.target.value = "";

      return;
    }

    setError("");

    setCommentImage(
      file,
    );
  };

  /* ====================================================== */
  /* REMOVER IMAGEM                                         */
  /* ====================================================== */

  const handleRemoveImage = () => {
    setCommentImage(
      null,
    );

    setCommentImagePreview(
      null,
    );

    if (imageInputRef.current) {
      imageInputRef.current.value =
        "";
    }
  };

  /* ====================================================== */
  /* UPLOAD DA IMAGEM                                       */
  /* ====================================================== */

  const uploadCommentImage =
    async (
      file: File,
    ): Promise<string> => {
      if (
        typeof window ===
        "undefined"
      ) {
        throw new Error(
          "Navegador necessário.",
        );
      }

      const blob =
        await upload(
          `hikari/comments/${file.name}`,
          file,
          {
            access: "public",
            handleUploadUrl:
              "/api/upload-comment-image",
            multipart: true,
          },
        );

      return blob.url;
    };

  /* ====================================================== */
  /* CARREGAR SESSÃO                                         */
  /* ====================================================== */

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        setSessionLoading(true);

        const response =
          await fetch(
            "/api/auth/get-session",
            {
              method: "GET",
              credentials: "include",
            },
          );

        if (!response.ok) {
          if (!cancelled) {
            setCurrentUserId(null);
            setCurrentUserEmail(null);
          }

          return;
        }

        const data =
          await response.json();

        if (!cancelled) {
          setCurrentUserId(
            typeof data?.user?.id ===
              "string"
              ? data.user.id
              : null,
          );

          setCurrentUserEmail(
            typeof data?.user?.email ===
              "string"
              ? data.user.email
              : null,
          );
        }
      } catch (err) {
        console.error(
          "ERRO AO CARREGAR SESSÃO:",
          err,
        );

        if (!cancelled) {
          setCurrentUserId(null);
          setCurrentUserEmail(null);
        }
      } finally {
        if (!cancelled) {
          setSessionLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

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

          if (
            typeof data.currentUserId ===
            "string"
          ) {
            setCurrentUserId(
              data.currentUserId,
            );
          } else {
            setCurrentUserId(
              null,
            );
          }

          if (
            typeof data.isAdmin ===
            "boolean"
          ) {
            if (
              data.isAdmin &&
              currentUserEmail
            ) {
              setCurrentUserEmail(
                currentUserEmail,
              );
            }
          }
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
  /* IR PARA O COMENTÁRIO DA NOTIFICAÇÃO                    */
  /* ====================================================== */

  useEffect(() => {
    if (
      loading ||
      !targetCommentId ||
      comments.length === 0
    ) {
      return;
    }

    let cancelled = false;

    const focusComment = () => {
      if (cancelled) {
        return;
      }

      const element =
        document.getElementById(
          `comment-${targetCommentId}`,
        );

      if (!element) {
        return;
      }

      setHighlightedCommentId(
        targetCommentId,
      );

      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      window.setTimeout(() => {
        if (!cancelled) {
          setHighlightedCommentId(
            null,
          );
        }
      }, 4000);
    };

    const firstFrame =
      window.requestAnimationFrame(
        focusComment,
      );

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(
        firstFrame,
      );
    };
  }, [
    loading,
    comments,
    targetCommentId,
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
        sending ||
        imageUploading
      ) {
        return;
      }

      try {
        setSending(true);
        setError("");

        let imageUrl:
          | string
          | null = null;

        if (commentImage) {
          setImageUploading(true);

          imageUrl =
            await uploadCommentImage(
              commentImage,
            );
        }

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
                imageUrl,
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
        handleRemoveImage();
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível publicar o comentário.",
        );
      } finally {
        setSending(false);
        setImageUploading(false);
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
  /* EDITAR COMENTÁRIO                                      */
  /* ====================================================== */

  const openEdit =
    (comment: Comment) => {
      setMenuOpenId(null);

      setEditingComment(
        comment,
      );

      setEditText(
        comment.content,
      );

      setEditIsSpoiler(
        comment.isSpoiler,
      );

      setError("");
      setModerationSuccess("");
    };

  const handleEdit =
    async () => {
      if (
        !editingComment ||
        !editText.trim() ||
        editSaving
      ) {
        return;
      }

      try {
        setEditSaving(true);
        setError("");

        const response =
          await fetch(
            "/api/comments/edit",
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
                  editingComment.id,
                action: "edit",
                content:
                  editText.trim(),
                isSpoiler:
                  editIsSpoiler,
              }),
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Não foi possível editar o comentário.",
          );
        }

        if (data.comment) {
          setComments(
            (current) =>
              current.map(
                (comment) =>
                  comment.id ===
                  editingComment.id
                    ? {
                        ...comment,
                        ...data.comment,
                        liked:
                          comment.liked,
                        likes:
                          comment.likes,
                      }
                    : comment,
              ),
          );
        }

        setEditingComment(
          null,
        );

        setEditText("");

        setEditIsSpoiler(
          false,
        );

        setModerationSuccess(
          "Comentário editado com sucesso.",
        );
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível editar o comentário.",
        );
      } finally {
        setEditSaving(false);
      }
    };

  /* ====================================================== */
  /* EXCLUIR COMENTÁRIO                                     */
  /* ====================================================== */

  const openDelete =
    (comment: Comment) => {
      setMenuOpenId(null);

      setDeletingComment(
        comment,
      );

      setError("");
      setModerationSuccess("");
    };

  const handleDelete =
    async () => {
      if (
        !deletingComment ||
        deleteSending
      ) {
        return;
      }

      try {
        setDeleteSending(true);
        setError("");

        const response =
          await fetch(
            "/api/comments/edit",
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
                  deletingComment.id,
                action: "delete",
              }),
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Não foi possível excluir o comentário.",
          );
        }

        setComments(
          (current) =>
            current.filter(
              (comment) =>
                comment.id !==
                  deletingComment.id &&
                comment.parentId !==
                  deletingComment.id,
            ),
        );

        if (
          replyingId ===
          deletingComment.id
        ) {
          setReplyingId(null);
          setReplyText("");
          setReplyIsSpoiler(false);
        }

        setDeletingComment(
          null,
        );

        setModerationSuccess(
          "Comentário excluído com sucesso.",
        );
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível excluir o comentário.",
        );
      } finally {
        setDeleteSending(false);
      }
    };

  /* ====================================================== */
  /* MODERAÇÃO                                               */
  /* ====================================================== */

  const handleModeration =
    async (
      commentId: string,
      action:
        | "spoiler"
        | "report"
        | "spam",
      reason?: ReportReason,
    ) => {
      if (moderatingId) {
        return;
      }

      try {
        setModeratingId(
          commentId,
        );

        setError("");
        setModerationSuccess("");

        if (action === "report") {
          setReportSending(true);
        }

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
                action,
                ...(reason
                  ? { reason }
                  : {}),
              }),
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Não foi possível realizar esta ação.",
          );
        }

        if (
          action ===
          "spoiler"
        ) {
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

          setModerationSuccess(
            "Comentário marcado como spoiler.",
          );
        }

        if (
          action ===
          "spam"
        ) {
          setModerationSuccess(
            "Comentário sinalizado como spam.",
          );
        }

        if (
          action ===
          "report"
        ) {
          setModerationSuccess(
            "Denúncia enviada. Obrigado por ajudar a manter a comunidade do Hikari segura.",
          );
        }

        setMenuOpenId(null);
        setSpamComment(null);
        setReportingComment(null);
        setReportReason("");
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível realizar esta ação.",
        );
      } finally {
        setModeratingId(
          null,
        );

        setReportSending(
          false,
        );
      }
    };

  /* ====================================================== */
  /* ABRIR DENÚNCIA                                         */
  /* ====================================================== */

  const openReport =
    (comment: Comment) => {
      setMenuOpenId(null);

      setReportingComment(
        comment,
      );

      setReportReason("");

      setError("");

      setModerationSuccess("");
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
  /* COMENTÁRIOS PRINCIPAIS                                 */
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

      <div className="grid gap-8">

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

            {/* ============================================= */}
            {/* IMAGEM / GIF                                   */}
            {/* ============================================= */}

            <div className="mt-3 flex items-center gap-2">

              <input
                ref={
                  imageInputRef
                }
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={
                  handleSelectImage
                }
                className="hidden"
              />

              <button
                type="button"
                onClick={() =>
                  imageInputRef.current?.click()
                }
                disabled={
                  sending ||
                  imageUploading
                }
                aria-label="Adicionar imagem"
                title="Imagem"
                className="flex min-h-10 items-center gap-2 rounded-lg border border-white/5 bg-bg px-3 text-xs font-medium text-muted transition-colors hover:border-white/10 hover:bg-elevated hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ImageIcon className="size-4" />
                Imagem
              </button>

              <button
                type="button"
                disabled
                aria-label="Adicionar GIF"
                title="GIF"
                className="flex min-h-10 items-center gap-2 rounded-lg border border-white/5 bg-bg px-3 text-xs font-medium text-muted opacity-60"
              >
                <span className="text-[10px] font-bold tracking-wide">
                  GIF
                </span>
                GIF
              </button>

            </div>

            {/* ============================================= */}
            {/* PRÉVIA DA IMAGEM                               */}
            {/* ============================================= */}

            {commentImagePreview && (
              <div className="relative mt-3 w-fit max-w-full overflow-hidden rounded-xl border border-white/10 bg-bg">

                <img
                  src={
                    commentImagePreview
                  }
                  alt="Prévia da imagem do comentário"
                  className="max-h-64 max-w-full object-contain"
                />

                <button
                  type="button"
                  onClick={
                    handleRemoveImage
                  }
                  disabled={
                    sending ||
                    imageUploading
                  }
                  aria-label="Remover imagem"
                  title="Remover imagem"
                  className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-sm transition-colors hover:bg-black disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>

              </div>
            )}

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
                  sending ||
                  imageUploading
                }
              >
                <Send className="size-4" />

                {imageUploading
                  ? "Enviando imagem..."
                  : sending
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
          {/* SUCESSO                                          */}
          {/* =============================================== */}

          {moderationSuccess && (
            <div className="mt-4 rounded-lg border border-white/5 bg-surface px-4 py-3 text-sm text-muted">
              {moderationSuccess}
            </div>
          )}

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

                  const canEdit =
                    !sessionLoading &&
                    Boolean(
                      currentUserId &&
                      (
                        currentUserId ===
                          comment.userId ||
                        isAdmin
                      ),
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
                        replyToName={
                          undefined
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
                        menuOpen={
                          menuOpenId ===
                          comment.id
                        }
                        onToggleMenu={() => {
                          setMenuOpenId(
                            (current) =>
                              current ===
                              comment.id
                                ? null
                                : comment.id,
                          );
                        }}
                        onEdit={() =>
                          openEdit(
                            comment,
                          )
                        }
                        onDelete={() =>
                          openDelete(
                            comment,
                          )
                        }
                        onMarkSpoiler={() => {
                          void handleModeration(
                            comment.id,
                            "spoiler",
                          );
                        }}
                        onReport={() =>
                          openReport(
                            comment,
                          )
                        }
                        onSpam={() =>
                          setSpamComment(
                            comment,
                          )
                        }
                        moderating={
                          moderatingId ===
                          comment.id
                        }
                        canEdit={
                          canEdit
                        }
                        highlighted={
                          highlightedCommentId ===
                          comment.id
                        }
                      />

                      {replies.length >
                        0 && (
                        <div className="ml-5 space-y-2 border-l border-white/10 pl-3 sm:ml-8 sm:pl-4">

                          {replies.map(
                            (
                              reply,
                            ) => {
                              const canEditReply =
                                !sessionLoading &&
                                Boolean(
                                  currentUserId &&
                                  (
                                    currentUserId ===
                                      reply.userId ||
                                    isAdmin
                                  ),
                                );

                              return (
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
                                  menuOpen={
                                    menuOpenId ===
                                    reply.id
                                  }
                                  onToggleMenu={() => {
                                    setMenuOpenId(
                                      (current) =>
                                        current ===
                                        reply.id
                                          ? null
                                          : reply.id,
                                    );
                                  }}
                                  onEdit={() =>
                                    openEdit(
                                      reply,
                                    )
                                  }
                                  onDelete={() =>
                                    openDelete(
                                      reply,
                                    )
                                  }
                                  onMarkSpoiler={() => {
                                    void handleModeration(
                                      reply.id,
                                      "spoiler",
                                    );
                                  }}
                                  onReport={() =>
                                    openReport(
                                      reply,
                                    )
                                  }
                                  onSpam={() =>
                                    setSpamComment(
                                      reply,
                                    )
                                  }
                                  moderating={
                                    moderatingId ===
                                    reply.id
                                  }
                                  canEdit={
                                    canEditReply
                                  }
                                  highlighted={
                                    highlightedCommentId ===
                                    reply.id
                                  }
                                />
                              );
                            },
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

      </div>

      {/* ================================================== */}
      {/* MODAL DE EDIÇÃO                                    */}
      {/* ================================================== */}

      {editingComment && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5">

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-dialog-title"
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl"
          >

            <div className="flex items-start gap-3">

              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated">

                <Edit3 className="size-5" />

              </div>

              <div className="min-w-0 flex-1">

                <h3
                  id="edit-dialog-title"
                  className="font-display text-xl"
                >
                  Editar comentário
                </h3>

                <p className="mt-1 text-sm text-muted">
                  Altere o texto do seu comentário.
                </p>

              </div>

              <button
                type="button"
                onClick={() => {
                  if (!editSaving) {
                    setEditingComment(
                      null,
                    );
                    setEditText("");
                    setEditIsSpoiler(
                      false,
                    );
                  }
                }}
                disabled={
                  editSaving
                }
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
                aria-label="Fechar"
              >
                <X className="size-5" />
              </button>

            </div>

            <textarea
              value={editText}
              onChange={(
                event,
              ) =>
                setEditText(
                  event.target.value,
                )
              }
              rows={6}
              maxLength={2000}
              disabled={
                editSaving
              }
              className="mt-5 w-full resize-none rounded-lg border border-white/5 bg-bg px-4 py-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-white/15 disabled:opacity-60"
            />

            <div className="mt-2 flex justify-end">

              <span className="text-xs text-subtle">
                {editText.length}/2000
              </span>

            </div>

            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-muted select-none">

              <input
                type="checkbox"
                checked={
                  editIsSpoiler
                }
                onChange={(
                  event,
                ) =>
                  setEditIsSpoiler(
                    event.target.checked,
                  )
                }
                disabled={
                  editSaving
                }
                className="size-4 accent-current"
              />

              <span>
                Marcar como spoiler
              </span>

            </label>

            {error && (
              <p className="mt-3 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!editSaving) {
                    setEditingComment(
                      null,
                    );
                    setEditText("");
                    setEditIsSpoiler(
                      false,
                    );
                  }
                }}
                disabled={
                  editSaving
                }
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={() =>
                  void handleEdit()
                }
                disabled={
                  !editText.trim() ||
                  editSaving
                }
              >
                <Edit3 className="size-4" />

                {editSaving
                  ? "Salvando..."
                  : "Salvar alterações"}
              </Button>

            </div>

          </div>

        </div>
      )}

      {/* ================================================== */}
      {/* MODAL DE EXCLUSÃO                                  */}
      {/* ================================================== */}

      {deletingComment && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5">

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl"
          >

            <div className="flex items-start gap-3">

              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated">

                <Trash2 className="size-5" />

              </div>

              <div className="min-w-0 flex-1">

                <h3
                  id="delete-dialog-title"
                  className="font-display text-xl"
                >
                  Excluir comentário?
                </h3>

                <p className="mt-1 text-sm text-muted">
                  Essa ação não pode ser desfeita.
                </p>

              </div>

              <button
                type="button"
                onClick={() => {
                  if (!deleteSending) {
                    setDeletingComment(
                      null,
                    );
                  }
                }}
                disabled={
                  deleteSending
                }
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
                aria-label="Fechar"
              >
                <X className="size-5" />
              </button>

            </div>

            <div className="mt-5 rounded-lg border border-white/5 bg-surface p-3">

              <p className="line-clamp-5 whitespace-pre-wrap text-sm text-muted">
                {deletingComment.content}
              </p>

              {deletingComment.imageUrl && (
                <img
                  src={
                    deletingComment.imageUrl
                  }
                  alt=""
                  className="mt-3 max-h-40 rounded-lg object-contain"
                />
              )}

            </div>

            {error && (
              <p className="mt-3 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!deleteSending) {
                    setDeletingComment(
                      null,
                    );
                  }
                }}
                disabled={
                  deleteSending
                }
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={() =>
                  void handleDelete()
                }
                disabled={
                  deleteSending
                }
              >
                <Trash2 className="size-4" />

                {deleteSending
                  ? "Excluindo..."
                  : "Excluir comentário"}
              </Button>

            </div>

          </div>

        </div>
      )}

      {/* ================================================== */}
      {/* MODAL DE DENÚNCIA                                  */}
      {/* ================================================== */}

      {reportingComment && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5">

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-dialog-title"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl"
          >

            <div className="flex items-start gap-3">

              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated">

                <Flag className="size-5" />

              </div>

              <div className="min-w-0 flex-1">

                <h3
                  id="report-dialog-title"
                  className="font-display text-xl"
                >
                  Denunciar comentário
                </h3>

                <p className="mt-1 text-sm text-muted">
                  Por que você está denunciando este comentário?
                </p>

              </div>

              <button
                type="button"
                onClick={() => {
                  if (!reportSending) {
                    setReportingComment(
                      null,
                    );
                    setReportReason(
                      "",
                    );
                  }
                }}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
                aria-label="Fechar"
                disabled={
                  reportSending
                }
              >
                <X className="size-5" />
              </button>

            </div>

            <div className="mt-5 space-y-2">

              {[
                {
                  value: "spam" as const,
                  label: "Spam ou propaganda",
                },
                {
                  value: "hate" as const,
                  label: "Discurso de ódio ou ofensa",
                },
                {
                  value: "spoiler" as const,
                  label: "Spoiler não marcado",
                },
                {
                  value: "sexual" as const,
                  label: "Conteúdo sexual ou impróprio",
                },
                {
                  value: "harassment" as const,
                  label: "Assédio ou ameaça",
                },
                {
                  value: "other" as const,
                  label: "Outro motivo",
                },
              ].map(
                (item) => (
                  <label
                    key={
                      item.value
                    }
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm transition-colors",
                      reportReason ===
                        item.value
                        ? "border-white/20 bg-elevated text-fg"
                        : "border-white/5 bg-surface text-muted hover:border-white/10 hover:text-fg",
                    )}
                  >

                    <input
                      type="radio"
                      name="report-reason"
                      value={
                        item.value
                      }
                      checked={
                        reportReason ===
                        item.value
                      }
                      onChange={() =>
                        setReportReason(
                          item.value,
                        )
                      }
                      className="size-4 accent-current"
                    />

                    <span>
                      {item.label}
                    </span>

                  </label>
                ),
              )}

            </div>

            {error && (
              <p className="mt-3 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!reportSending) {
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
                onClick={() => {
                  if (
                    reportingComment &&
                    reportReason
                  ) {
                    void handleModeration(
                      reportingComment.id,
                      "report",
                      reportReason,
                    );
                  }
                }}
                disabled={
                  !reportReason ||
                  reportSending ||
                  Boolean(
                    moderatingId,
                  )
                }
              >
                <Flag className="size-4" />

                {reportSending
                  ? "Enviando..."
                  : "Enviar denúncia"}
              </Button>

            </div>

            <p className="mt-4 text-xs leading-5 text-subtle">
              As denúncias ajudam a equipe de moderação a manter a comunidade do Hikari segura.
            </p>

          </div>

        </div>
      )}

      {/* ================================================== */}
      {/* MODAL DE SPAM                                      */}
      {/* ================================================== */}

      {spamComment && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5">

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="spam-dialog-title"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl"
          >

            <div className="flex items-start gap-3">

              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated">

                <Ban className="size-5" />

              </div>

              <div className="min-w-0 flex-1">

                <h3
                  id="spam-dialog-title"
                  className="font-display text-xl"
                >
                  Marcar como spam?
                </h3>

                <p className="mt-1 text-sm text-muted">
                  Este comentário será sinalizado para análise da moderação.
                </p>

              </div>

            </div>

            <div className="mt-4 rounded-lg border border-white/5 bg-surface p-3">

              <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted">
                {spamComment.content}
              </p>

              {spamComment.imageUrl && (
                <img
                  src={
                    spamComment.imageUrl
                  }
                  alt=""
                  className="mt-3 max-h-40 rounded-lg object-contain"
                />
              )}

            </div>

            {error && (
              <p className="mt-3 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!moderatingId) {
                    setSpamComment(
                      null,
                    );
                  }
                }}
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
                onClick={() => {
                  void handleModeration(
                    spamComment.id,
                    "spam",
                  );
                }}
                disabled={
                  Boolean(
                    moderatingId,
                  )
                }
              >
                <Ban className="size-4" />

                {moderatingId ===
                spamComment.id
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
  menuOpen,
  onToggleMenu,
  onEdit,
  onDelete,
  onMarkSpoiler,
  onReport,
  onSpam,
  moderating,
  canEdit,
  highlighted = false,
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
  menuOpen: boolean;
  onToggleMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkSpoiler: () => void;
  onReport: () => void;
  onSpam: () => void;
  moderating: boolean;
  canEdit: boolean;
  highlighted?: boolean;
}) {
  const isReplying =
    replyingId ===
    comment.id;

  return (
    <article
      id={`comment-${comment.id}`}
      className={cn(
        "rounded-xl border border-white/5 bg-surface p-4 transition-all duration-500 sm:p-5",
        isReply &&
          "bg-surface/80",
        highlighted &&
          "border-white/30 bg-elevated shadow-[0_0_0_2px_rgba(255,255,255,0.08)]",
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

          {/* =============================================== */}
          {/* USUÁRIO + DATA + MENU                           */}
          {/* =============================================== */}

          <div className="relative flex items-start gap-2">

            <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1">

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
            {/* MENU                                           */}
            {/* ============================================= */}

            <div className="relative shrink-0">

              <button
                type="button"
                onClick={
                  onToggleMenu
                }
                disabled={
                  moderating
                }
                aria-label="Opções do comentário"
                aria-haspopup="menu"
                aria-expanded={
                  menuOpen
                }
                className="flex size-9 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-elevated hover:text-fg disabled:opacity-50"
              >

                <MoreVertical className="size-5" />

              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#17171a] p-1 shadow-2xl"
                >

                  {canEdit ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={
                          onEdit
                        }
                        disabled={
                          moderating
                        }
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-50"
                      >

                        <Edit3 className="size-4 shrink-0" />

                        <span>
                          Editar comentário
                        </span>

                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={
                          onDelete
                        }
                        disabled={
                          moderating
                        }
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-50"
                      >

                        <Trash2 className="size-4 shrink-0" />

                        <span>
                          Excluir comentário
                        </span>

                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={
                          onMarkSpoiler
                        }
                        disabled={
                          moderating
                        }
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-50"
                      >

                        <AlertTriangle className="size-4 shrink-0" />

                        <span>
                          {moderating
                            ? "Enviando..."
                            : "Marcar como spoiler"}
                        </span>

                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={
                          onReport
                        }
                        disabled={
                          moderating
                        }
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-50"
                      >

                        <Flag className="size-4 shrink-0" />

                        <span>
                          Denunciar comentário
                        </span>

                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={
                          onSpam
                        }
                        disabled={
                          moderating
                        }
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-50"
                      >

                        <Ban className="size-4 shrink-0" />

                        <span>
                          Marcar como spam
                        </span>

                      </button>
                    </>
                  )}

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
          {/* IMAGEM DO COMENTÁRIO                            */}
          {/* =============================================== */}

          {comment.imageUrl && (
            <div className="mt-3 overflow-hidden rounded-xl border border-white/5 bg-bg">

              <img
                src={
                  comment.imageUrl
                }
                alt="Imagem anexada ao comentário"
                loading="lazy"
                className="max-h-[520px] w-auto max-w-full object-contain"
              />

            </div>
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
