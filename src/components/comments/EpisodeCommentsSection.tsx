import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Eye,
  EyeOff,
  Flag,
  Image as ImageIcon,
  LogIn,
  LogOut,
  MessageCircle,
  MoreVertical,
  Search,
  Send,
  Settings2,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { LoginMenu } from "@/components/LoginMenu";
import { signOut, signIn, getBearerToken } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getProfile } from "@/lib/profile.functions";
import { isHikariAdmin } from "@/lib/auth/admin";
import { cn } from "@/lib/utils";

/* ========================================================= */
/* TIPO DO COMENTÁRIO                                        */
/* ========================================================= */
export type Comment = {
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
  userNick?: string | null;
  likes: number;
  dislikes: number;
  liked: boolean;
  disliked: boolean;
  userReaction?: "like" | "dislike" | null;
};

/* ========================================================= */
/* TIPO DA ORDENAÇÃO                                         */
/* ========================================================= */
export type SortBy = "highlight" | "recent" | "oldest";

/* ========================================================= */
/* TIPO DA DENÚNCIA                                          */
/* ========================================================= */
export type ReportReason =
  | "spam"
  | "hate"
  | "spoiler"
  | "sexual"
  | "harassment"
  | "other";

export interface EpisodeCommentsSectionProps {
  animeId: string;
  episodeId: string;
  animeTitle: string;
  episodeNumber: number;
  targetCommentId?: string;
}

/* ========================================================= */
/* TELA DE CARREGAMENTO DOS COMENTÁRIOS COM ELIZABETH (HIKARI) */
/* ========================================================= */
export function ElizabethCommentsLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="elizabeth-loading-container relative overflow-hidden rounded-2xl sm:rounded-3xl border border-[#a855f7]/25 bg-gradient-to-b from-[#130f24]/90 via-[#0c0a15]/95 to-[#08070d] p-8 sm:p-14 text-center shadow-[0_8px_32px_rgba(0,0,0,0.65),0_0_35px_rgba(168,85,247,0.12)] backdrop-blur-md"
    >
      {/* Brilho violeta radial sutil no fundo */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-44 bg-[#a855f7]/15 rounded-full blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* Elizabeth segurando a placa com balanço suave e inclinação sutil */}
        <div className="elizabeth-sway-anim inline-flex items-center justify-center select-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.7)]">
          <img
            src="/assets/hikari-elizabeth-character.png"
            alt="Elizabeth"
            className="w-44 sm:w-52 md:w-56 h-auto object-contain pointer-events-none"
            loading="eager"
            decoding="async"
            draggable={false}
          />
        </div>

        {/* Indicador circular roxo com animação suave e texto fixo */}
        <div className="mt-5 flex items-center justify-center gap-2.5">
          <div
            className="elizabeth-spinner size-5 rounded-full border-2 border-[#a855f7]/25 border-t-[#c084fc] animate-spin shadow-[0_0_12px_rgba(168,85,247,0.45)] shrink-0"
            aria-hidden="true"
          />
          <p className="text-sm font-medium tracking-wide text-white/85 select-none">
            Carregando os comentários...
          </p>
        </div>
      </div>
    </div>
  );
}

/* ========================================================= */
/* COMENTÁRIOS DO EPISÓDIO (HIKARI / WATCH)                  */
/* ========================================================= */
export function EpisodeCommentsSection({
  animeId,
  episodeId,
  animeTitle,
  episodeNumber,
  targetCommentId,
}: EpisodeCommentsSectionProps) {
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

  const [pendingReactionIds, setPendingReactionIds] =
    useState<Record<string, boolean>>({});

  const inFlightReactionsRef =
    useRef<Set<string>>(new Set());

  const [rootOrder, setRootOrder] =
    useState<string[]>([]);

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

  const [loginOpen, setLoginOpen] =
    useState(false);

  const [commentsLoginOpen, setCommentsLoginOpen] =
    useState(false);

  const [commentsLoginWarning, setCommentsLoginWarning] =
    useState<string | null>(null);

  const [sessionLoadingState, setSessionLoadingState] =
    useState(false);

  const [newCommentId, setNewCommentId] =
    useState<string | null>(null);

  const newCommentTimeoutRef =
    useRef<number | null>(null);

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
  /* GIF                                                     */
  /* ====================================================== */

  const [gifOpen, setGifOpen] =
    useState(false);

  // Bloqueio e restauração da rolagem gerenciados de forma unificada abaixo para todas as janelas

  const [gifSearch, setGifSearch] =
    useState("");

  const [gifResults, setGifResults] =
    useState<
      Array<{
        id: string;
        url: string;
        preview: string;
        title: string;
      }>
    >([]);

  const [gifLoading, setGifLoading] =
    useState(false);

  const [gifError, setGifError] =
    useState("");

  const [selectedGifUrl, setSelectedGifUrl] =
    useState<string | null>(null);

  const gifSearchInputRef =
    useRef<HTMLInputElement | null>(null);

  const gifGalleryInputRef =
    useRef<HTMLInputElement | null>(null);

  /* ====================================================== */
  /* USUÁRIO ATUAL & SESSÃO                                  */
  /* ====================================================== */

  const { user: authUser, isPending: authUserPending } =
    useCurrentUserState();

  const getProfileFn =
    useServerFn(getProfile);

  const [userNick, setUserNick] =
    useState<string | null>(null);

  const [userMenuOpen, setUserMenuOpen] =
    useState(false);

  const [showMedia, setShowMedia] =
    useState<boolean>(() => {
      if (typeof window === "undefined") return true;
      try {
        const saved = localStorage.getItem("hikari_show_comment_media");
        return saved === null ? true : saved !== "false";
      } catch {
        return true;
      }
    });

  const handleToggleShowMedia = useCallback(() => {
    setShowMedia((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("hikari_show_comment_media", String(next));
      } catch {
        /* ignore storage error */
      }
      return next;
    });
  }, []);

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [currentUserEmail, setCurrentUserEmail] =
    useState<string | null>(null);

  const [currentUserName, setCurrentUserName] =
    useState<string | null>(null);

  const [currentUserImage, setCurrentUserImage] =
    useState<string | null>(null);

  // Busca o nick real do perfil caso disponível
  useEffect(() => {
    if (!authUser?.id) {
      setUserNick(null);
      return;
    }
    let active = true;
    getProfileFn()
      .then((p) => {
        if (active && p?.nick) {
          setUserNick(p.nick);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [authUser?.id, getProfileFn]);

  // Tecla Escape gerenciada de forma unificada abaixo para menus e janelas

  const effectiveUserId =
    authUser?.id ?? currentUserId;

  const effectiveUserEmail =
    authUser?.primaryEmail ?? currentUserEmail;

  const effectiveUserName =
    authUser?.displayName ||
    userNick ||
    currentUserName ||
    (effectiveUserEmail
      ? effectiveUserEmail.split("@")[0]
      : "Usuário");

  const effectiveUserImage =
    authUser?.profileImageUrl ?? currentUserImage;

  const sessionLoading =
    (authUserPending || sessionLoadingState) && !effectiveUserId;

  const isAdmin =
    isHikariAdmin(
      effectiveUserEmail,
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
    useState<SortBy>("highlight");

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
  const [moderationSuccessVisible, setModerationSuccessVisible] =
    useState(false);
  const successTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  const clearModerationSuccess = useCallback(() => {
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    if (exitTimerRef.current) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    setModerationSuccessVisible(false);
    setModerationSuccess("");
  }, []);

  const showModerationSuccess = useCallback((message: string) => {
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    if (exitTimerRef.current) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }

    setModerationSuccess(message);
    setModerationSuccessVisible(false);

    window.requestAnimationFrame(() => {
      setModerationSuccessVisible(true);
    });

    successTimerRef.current = window.setTimeout(() => {
      setModerationSuccessVisible(false);
      exitTimerRef.current = window.setTimeout(() => {
        setModerationSuccess("");
      }, 350);
    }, 4500);
  }, []);

  const handleDismissSuccess = useCallback(() => {
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    setModerationSuccessVisible(false);
    exitTimerRef.current = window.setTimeout(() => {
      setModerationSuccess("");
    }, 350);
  }, []);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    };
  }, []);

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

  // Controla o bloqueio e restauração da rolagem da página quando qualquer janela estiver aberta
  const isAnyModalOpen = Boolean(
    gifOpen ||
    editingComment ||
    deletingComment ||
    reportingComment ||
    spamComment,
  );

  useEffect(() => {
    if (!isAnyModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAnyModalOpen]);

  // Garante a restauração da rolagem caso o componente seja desmontado
  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleCancelEdit = () => {
    if (!editSaving) {
      setEditingComment(null);
      setEditText("");
      setEditIsSpoiler(false);
      setMenuOpenId(null);
      setUserMenuOpen(false);
      setSortDropdownOpen(false);
    }
  };

  const handleCancelDelete = () => {
    if (!deleteSending) {
      setDeletingComment(null);
      setMenuOpenId(null);
      setUserMenuOpen(false);
      setSortDropdownOpen(false);
    }
  };

  const handleCancelReport = () => {
    if (!reportSending) {
      setReportingComment(null);
      setReportReason("");
      setMenuOpenId(null);
      setUserMenuOpen(false);
      setSortDropdownOpen(false);
    }
  };

  const handleCancelSpam = () => {
    if (!moderatingId) {
      setSpamComment(null);
      setMenuOpenId(null);
      setUserMenuOpen(false);
      setSortDropdownOpen(false);
    }
  };

  // Tecla Escape para fechar menus, submenus e janelas de ações
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!editSaving && editingComment) {
          setEditingComment(null);
          setEditText("");
          setEditIsSpoiler(false);
        }
        if (!deleteSending && deletingComment) {
          setDeletingComment(null);
        }
        if (!reportSending && reportingComment) {
          setReportingComment(null);
          setReportReason("");
        }
        if (!moderatingId && spamComment) {
          setSpamComment(null);
        }
        if (gifOpen) {
          setGifOpen(false);
        }
        setMenuOpenId(null);
        setUserMenuOpen(false);
        setLoginOpen(false);
        setCommentsLoginOpen(false);
        setSortDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () =>
      window.removeEventListener("keydown", handleKeyDown);
  }, [
    userMenuOpen,
    loginOpen,
    commentsLoginOpen,
    sortDropdownOpen,
    menuOpenId,
    editingComment,
    editSaving,
    deletingComment,
    deleteSending,
    reportingComment,
    reportSending,
    spamComment,
    moderatingId,
    gifOpen,
  ]);

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
    setSelectedGifUrl(null);

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
  /* GIF                                                      */
  /* ====================================================== */

  const searchGifs =
    async (query = gifSearch) => {
      const apiKey =
        import.meta.env.VITE_GIPHY_API_KEY;

      if (!apiKey) {
        setGifError(
          "Configure VITE_GIPHY_API_KEY no Vercel para usar a busca de GIFs.",
        );
        setGifResults([]);
        return;
      }

      try {
        setGifLoading(true);
        setGifError("");

        const trimmed =
          query.trim();

        const endpoint =
          trimmed
            ? "https://api.giphy.com/v1/gifs/search"
            : "https://api.giphy.com/v1/gifs/trending";

        const params =
          new URLSearchParams({
            api_key: apiKey,
            limit: "24",
            rating: "pg-13",
            lang: "pt",
          });

        if (trimmed) {
          params.set("q", trimmed);
        }

        const response =
          await fetch(
            `${endpoint}?${params.toString()}`,
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Não foi possível buscar GIFs.",
          );
        }

        const results =
          Array.isArray(data?.data)
            ? data.data
                .map((gif: any) => {
                  const images =
                    gif?.images;

                  const url =
                    images?.original?.url ||
                    images?.fixed_width?.url;

                  const preview =
                    images?.fixed_width?.url ||
                    images?.original?.url;

                  if (
                    typeof gif?.id !==
                      "string" ||
                    typeof url !==
                      "string" ||
                    typeof preview !==
                      "string"
                  ) {
                    return null;
                  }

                  return {
                    id: gif.id,
                    url,
                    preview,
                    title:
                      typeof gif?.title ===
                      "string"
                        ? gif.title
                        : "GIF",
                  };
                })
                .filter(
                  (gif: any): gif is {
                    id: string;
                    url: string;
                    preview: string;
                    title: string;
                  } => Boolean(gif),
                )
            : [];

        setGifResults(results);
      } catch (err) {
        console.error(
          "ERRO AO BUSCAR GIFS:",
          err,
        );

        setGifResults([]);
        setGifError(
          err instanceof Error
            ? err.message
            : "Não foi possível buscar GIFs.",
        );
      } finally {
        setGifLoading(false);
      }
    };

  const openGifPicker = () => {
    setGifOpen(true);
    setGifError("");

    if (gifResults.length === 0) {
      void searchGifs("");
    }

    window.setTimeout(() => {
      gifSearchInputRef.current?.focus();
    }, 0);
  };

  const closeGifPicker = () => {
    setGifOpen(false);
    setGifError("");
    setMenuOpenId(null);
    setUserMenuOpen(false);
    setSortDropdownOpen(false);
  };

  const handleSelectGif = (
    url: string,
  ) => {
    setSelectedGifUrl(url);
    setCommentImage(null);
    setCommentImagePreview(null);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }

    closeGifPicker();
  };

  const handleSelectGifFromGallery = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      file.type !== "image/gif" &&
      !file.name.toLowerCase().endsWith(".gif")
    ) {
      setError(
        "Escolha um arquivo GIF.",
      );

      event.target.value = "";

      return;
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      setError(
        "O GIF pode ter no máximo 10 MB.",
      );

      event.target.value = "";

      return;
    }

    setError("");
    setSelectedGifUrl(null);
    setCommentImage(file);
    closeGifPicker();
  };

  const handleRemoveGif = () => {
    setSelectedGifUrl(null);
  };

  /* ====================================================== */
  /* CARREGAR SESSÃO                                         */
  /* ====================================================== */

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        setSessionLoadingState(true);

        const bearer = getBearerToken();
        const headers: Record<string, string> = {
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        };

        const response =
          await fetch(
            "/api/auth/get-session",
            {
              method: "GET",
              credentials: "include",
              headers,
            },
          );

        if (!response.ok) {
          if (!cancelled) {
            setCurrentUserId(null);
            setCurrentUserEmail(null);
            setCurrentUserName(null);
            setCurrentUserImage(null);
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

          setCurrentUserName(
            typeof data?.user?.name ===
              "string"
              ? data.user.name
              : null,
          );

          setCurrentUserImage(
            typeof data?.user?.image ===
              "string"
              ? data.user.image
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
          setCurrentUserName(null);
          setCurrentUserImage(null);
        }
      } finally {
        if (!cancelled) {
          setSessionLoadingState(false);
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
        setComments([]);
        setRootOrder([]);
        setError("");

        const bearer = getBearerToken();
        const headers: Record<string, string> = {
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        };

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
              headers,
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
          const loaded = Array.isArray(data.comments) ? data.comments : [];
          setComments(loaded);

          const roots = loaded.filter((c: Comment) => !c.parentId);
          const sorted = [...roots];
          if (sortBy === "highlight") {
            sorted.sort((a: Comment, b: Comment) => {
              const repliesA = loaded.filter((c: Comment) => c.parentId === a.id).length;
              const repliesB = loaded.filter((c: Comment) => c.parentId === b.id).length;
              const scoreA = (a.likes ?? 0) * 2 + repliesA - (a.dislikes ?? 0);
              const scoreB = (b.likes ?? 0) * 2 + repliesB - (b.dislikes ?? 0);
              if (scoreB !== scoreA) return scoreB - scoreA;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
          } else if (sortBy === "recent") {
            sorted.sort((a: Comment, b: Comment) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          } else if (sortBy === "oldest") {
            sorted.sort((a: Comment, b: Comment) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          }
          setRootOrder(sorted.map((c) => c.id));

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

  const hasScrolledTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      loading ||
      !targetCommentId ||
      comments.length === 0 ||
      hasScrolledTargetRef.current === targetCommentId
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

      hasScrolledTargetRef.current = targetCommentId;

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

      if (!effectiveUserId) {
        setLoginOpen(true);
        return;
      }

      if (
        (!value &&
          !commentImage &&
          !selectedGifUrl) ||
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
        } else if (selectedGifUrl) {
          imageUrl =
            selectedGifUrl;
        }

        const bearer = getBearerToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        };

        const response =
          await fetch(
            "/api/comments",
            {
              method: "POST",
              credentials:
                "include",
              headers,
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
          setRootOrder((current) => [data.comment.id, ...current]);
          setNewCommentId(data.comment.id);
          if (newCommentTimeoutRef.current) {
            window.clearTimeout(newCommentTimeoutRef.current);
          }
          newCommentTimeoutRef.current = window.setTimeout(() => {
            setNewCommentId(null);
          }, 3200);
        }

        setText("");
        setIsSpoiler(false);
        handleRemoveImage();
        setSelectedGifUrl(null);
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

      if (!effectiveUserId) {
        setLoginOpen(true);
        return;
      }

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

        const bearer = getBearerToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        };

        const response =
          await fetch(
            "/api/comments",
            {
              method: "POST",
              credentials:
                "include",
              headers,
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
          setNewCommentId(data.comment.id);
          if (newCommentTimeoutRef.current) {
            window.clearTimeout(newCommentTimeoutRef.current);
          }
          newCommentTimeoutRef.current = window.setTimeout(() => {
            setNewCommentId(null);
          }, 3200);
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
  /* CURTIR / NÃO CURTIR (LIKE / DISLIKE)                  */
  /* ====================================================== */

  const handleReaction =
    async (
      commentId: string,
      reaction: "like" | "dislike",
    ) => {
      if (!effectiveUserId) {
        setCommentsLoginOpen(true);
        return;
      }

      if (inFlightReactionsRef.current.has(commentId)) {
        return;
      }

      inFlightReactionsRef.current.add(commentId);
      setPendingReactionIds((prev) => ({ ...prev, [commentId]: true }));

      // Snapshot para restauração em caso de erro
      const previousComments = [...comments];

      // Atualização otimista imediata para resposta tátil instantânea
      setComments((current) =>
        current.map((c) => {
          if (c.id !== commentId) return c;

          const isCancelling =
            (reaction === "like" && c.liked) ||
            (reaction === "dislike" && c.disliked);

          if (isCancelling) {
            return {
              ...c,
              liked: false,
              disliked: false,
              userReaction: null,
              likes: reaction === "like" ? Math.max(0, c.likes - 1) : c.likes,
              dislikes: reaction === "dislike" ? Math.max(0, c.dislikes - 1) : c.dislikes,
            };
          } else {
            const wasLiked = c.liked;
            const wasDisliked = c.disliked;
            return {
              ...c,
              liked: reaction === "like",
              disliked: reaction === "dislike",
              userReaction: reaction,
              likes:
                reaction === "like"
                  ? c.likes + 1
                  : wasLiked
                    ? Math.max(0, c.likes - 1)
                    : c.likes,
              dislikes:
                reaction === "dislike"
                  ? c.dislikes + 1
                  : wasDisliked
                    ? Math.max(0, c.dislikes - 1)
                    : c.dislikes,
            };
          }
        }),
      );

      try {
        setError("");

        const bearer = getBearerToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        };

        const response =
          await fetch(
            "/api/comments/like",
            {
              method: "POST",
              credentials:
                "include",
              headers,
              body: JSON.stringify({
                commentId,
                reaction,
              }),
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          // Reverte o estado otimista
          setComments(previousComments);
          if (response.status === 401) {
            setCommentsLoginOpen(true);
          }
          throw new Error(
            data?.error ||
              "Não foi possível registrar a reação.",
          );
        }

        // Reconcilia com os números exatos persistidos no banco
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
                      dislikes:
                        Number(
                          data.dislikes,
                        ) || 0,
                      liked:
                        Boolean(
                          data.liked,
                        ),
                      disliked:
                        Boolean(
                          data.disliked,
                        ),
                      userReaction:
                        data.userReaction ??
                        null,
                    }
                  : comment,
            ),
        );
      } catch (err) {
        console.error(err);
        setComments(previousComments);

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível registrar a reação.",
        );
      } finally {
        inFlightReactionsRef.current.delete(commentId);
        setPendingReactionIds((prev) => {
          const next = { ...prev };
          delete next[commentId];
          return next;
        });
      }
    };

  /* ====================================================== */
  /* EDITAR COMENTÁRIO                                      */
  /* ====================================================== */

  const openEdit = (comment: Comment) => {
    if (!effectiveUserId) {
      setCommentsLoginOpen(true);
      return;
    }
    if (comment.userId !== effectiveUserId && !isAdmin) {
      return;
    }
    setMenuOpenId(null);
    setEditingComment(comment);
    setEditText(comment.content);
    setEditIsSpoiler(comment.isSpoiler);
    setError("");
    clearModerationSuccess();
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

        const bearer = getBearerToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        };

        const response =
          await fetch(
            "/api/comments/edit",
            {
              method: "POST",
              credentials:
                "include",
              headers,
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

        setMenuOpenId(null);

        showModerationSuccess(
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

  const openDelete = (comment: Comment) => {
    if (!effectiveUserId) {
      setCommentsLoginOpen(true);
      return;
    }
    if (comment.userId !== effectiveUserId && !isAdmin) {
      return;
    }
    setMenuOpenId(null);
    setDeletingComment(comment);
    setError("");
    clearModerationSuccess();
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

        const bearer = getBearerToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        };

        const response =
          await fetch(
            "/api/comments/edit",
            {
              method: "POST",
              credentials:
                "include",
              headers,
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
        setMenuOpenId(null);
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

      if (action === "spoiler" && !isAdmin) {
        setError("Apenas o administrador do Hikari pode marcar comentários como spoiler.");
        return;
      }

      try {
        setModeratingId(
          commentId,
        );

        setError("");
        clearModerationSuccess();

        if (action === "report") {
          setReportSending(true);
        }

        const bearer = getBearerToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        };

        const response =
          await fetch(
            "/api/comments/moderation",
            {
              method: "POST",
              credentials:
                "include",
              headers,
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

          showModerationSuccess(
            "Comentário marcado como spoiler.",
          );
        }

        if (
          action ===
          "spam"
        ) {
          showModerationSuccess(
            "Comentário sinalizado como spam.",
          );
        }

        if (
          action ===
          "report"
        ) {
          showModerationSuccess(
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

  const openReport = (comment: Comment) => {
    if (!effectiveUserId) {
      setCommentsLoginOpen(true);
      return;
    }
    if (comment.userId === effectiveUserId) {
      return;
    }
    setMenuOpenId(null);
    setReportingComment(comment);
    setReportReason("");
    setError("");
    clearModerationSuccess();
  };

  /* ====================================================== */
  /* DATA                                                    */
  /* ====================================================== */

  const formatCommentDate = (value: string) => {
    if (!value) return { date: "", time: "" };
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return { date: "", time: "" };
    }

    const day = date.getDate().toString().padStart(2, "0");
    const months = [
      "jan.",
      "fev.",
      "mar.",
      "abr.",
      "mai.",
      "jun.",
      "jul.",
      "ago.",
      "set.",
      "out.",
      "nov.",
      "dez.",
    ];
    const month = months[date.getMonth()] || "";
    const year = date.getFullYear();

    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return {
      date: `${day} ${month} ${year}`,
      time: `às ${hours}:${minutes}`,
    };
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

  // Reordena os IDs raiz quando o usuário clica nas abas de ordenação
  useEffect(() => {
    if (comments.length === 0) return;
    const roots = comments.filter((c) => !c.parentId);
    const sorted = [...roots];
    if (sortBy === "highlight") {
      sorted.sort((a, b) => {
        const repliesA = comments.filter((c) => c.parentId === a.id).length;
        const repliesB = comments.filter((c) => c.parentId === b.id).length;
        const scoreA = (a.likes ?? 0) * 2 + repliesA - (a.dislikes ?? 0);
        const scoreB = (b.likes ?? 0) * 2 + repliesB - (b.dislikes ?? 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sortBy === "recent") {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === "oldest") {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    setRootOrder(sorted.map((c) => c.id));
  }, [sortBy]);

  const displayedRootComments = useMemo(() => {
    const rootMap = new Map<string, Comment>();
    for (const comment of comments) {
      if (!comment.parentId) {
        rootMap.set(comment.id, comment);
      }
    }

    const result: Comment[] = [];
    const seen = new Set<string>();

    for (const id of rootOrder) {
      const c = rootMap.get(id);
      if (c) {
        result.push(c);
        seen.add(id);
      }
    }

    // Se houver algum comentário novo não presente em rootOrder, insere no topo
    for (const [id, c] of rootMap.entries()) {
      if (!seen.has(id)) {
        result.unshift(c);
      }
    }

    return result;
  }, [comments, rootOrder]);

  /* ====================================================== */
  /* RENDER                                                   */
  /* ====================================================== */

  if (!episodeId || !episodeId.trim()) {
    return (
      <div className="mt-10 border-t border-purple-500/20 pt-8 text-center text-sm text-zinc-500">
        Selecione um episódio para carregar os comentários.
      </div>
    );
  }

  return (
    <section className="mt-10 border-t border-white/10 pt-8 sm:pt-10">

      {loading ? (
        <ElizabethCommentsLoading />
      ) : (
        <div className="grid gap-6 sm:gap-8">

        <div className="min-w-0">

          {/* =============================================== */}
          {/* CABEÇALHO DOS COMENTÁRIOS ESTILO DISQUS/HIKARI  */}
          {/* =============================================== */}

          <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-2 border-b border-white/[0.08] pb-3">

            {/* Lado esquerdo: Título com contagem e as 3 abas de ordenação */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 min-w-0">

              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                <div className="flex size-7 sm:size-8 items-center justify-center rounded-lg bg-[#a855f7]/15 border border-[#a855f7]/30 text-[#c084fc] shrink-0">
                  <MessageCircle className="size-3.5 sm:size-4" />
                </div>
                <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
                  Comentários
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#a855f7]/15 border border-[#a855f7]/30 text-[#c084fc] shrink-0">
                  {comments.length}
                </span>
              </div>

              {/* Três opções compactas alinhadas horizontalmente: Destaque, Recentes, Antigos */}
              <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm">
                <button
                  type="button"
                  onClick={() => setSortBy("highlight")}
                  className={cn(
                    "px-2.5 sm:px-3 py-1 font-medium transition-all relative border-b-2 -mb-[13px] sm:-mb-[13px]",
                    sortBy === "highlight"
                      ? "border-[#a855f7] text-[#c084fc] font-semibold"
                      : "border-transparent text-white/50 hover:text-white/80"
                  )}
                >
                  Destaque
                </button>

                <button
                  type="button"
                  onClick={() => setSortBy("recent")}
                  className={cn(
                    "px-2.5 sm:px-3 py-1 font-medium transition-all relative border-b-2 -mb-[13px] sm:-mb-[13px]",
                    sortBy === "recent"
                      ? "border-[#a855f7] text-[#c084fc] font-semibold"
                      : "border-transparent text-white/50 hover:text-white/80"
                  )}
                >
                  Recentes
                </button>

                <button
                  type="button"
                  onClick={() => setSortBy("oldest")}
                  className={cn(
                    "px-2.5 sm:px-3 py-1 font-medium transition-all relative border-b-2 -mb-[13px] sm:-mb-[13px]",
                    sortBy === "oldest"
                      ? "border-[#a855f7] text-[#c084fc] font-semibold"
                      : "border-transparent text-white/50 hover:text-white/80"
                  )}
                >
                  Antigos
                </button>
              </div>

            </div>

            {/* Lado direito: Login OU Menu da pessoa autenticada */}
            <div className="flex items-center shrink-0 relative ml-auto">

              {!effectiveUserId ? (
                /* Visitante: Opção ENTRAR com Popover estilo Disqus */
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setCommentsLoginOpen((prev) => !prev);
                      setCommentsLoginWarning(null);
                    }}
                    className="inline-flex min-h-8 sm:min-h-9 items-center gap-1.5 rounded-xl border border-[#a855f7]/35 bg-[#a855f7]/10 px-3 py-1 text-xs sm:text-sm font-semibold text-[#c084fc] hover:bg-[#a855f7]/20 hover:text-white hover:border-[#a855f7]/55 active:scale-95 transition-all shadow-sm cursor-pointer"
                    aria-expanded={commentsLoginOpen}
                    aria-haspopup="dialog"
                  >
                    <LogIn className="size-3.5" />
                    <span>Entrar</span>
                  </button>

                  {commentsLoginOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => {
                          setCommentsLoginOpen(false);
                          setCommentsLoginWarning(null);
                        }}
                      />
                      <div
                        role="dialog"
                        aria-label="Opções de login"
                        className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#141419]/95 backdrop-blur-xl p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                      >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
                          <span className="text-xs font-bold text-white tracking-tight">
                            Entrar para comentar
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCommentsLoginOpen(false);
                              setCommentsLoginWarning(null);
                            }}
                            className="text-white/40 hover:text-white text-xs transition-colors p-1"
                            aria-label="Fechar"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>

                        <p className="text-[11px] text-white/60 mb-3">
                          Conecte-se com sua rede favorita ou conta Hikari para participar da conversa.
                        </p>

                        <div className="space-y-1.5">
                          {/* Google */}
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await signIn("google", {
                                  callbackURL: window.location.href,
                                });
                              } catch (err) {
                                console.error(err);
                                setCommentsLoginWarning("Não foi possível iniciar login com Google.");
                              }
                            }}
                            className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer"
                          >
                            <svg className="size-4 shrink-0" viewBox="0 0 24 24">
                              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                              <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z" />
                              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z" />
                            </svg>
                            <span>Continuar com Google</span>
                          </button>

                          {/* X (Twitter) */}
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await signIn("x", {
                                  callbackURL: window.location.href,
                                });
                              } catch (err) {
                                console.error(err);
                                setCommentsLoginWarning("Não foi possível iniciar login com X.");
                              }
                            }}
                            className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer"
                          >
                            <svg className="size-4 shrink-0 fill-current" viewBox="0 0 24 24">
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            <span>Continuar com X (Twitter)</span>
                          </button>

                          {/* Facebook (Com aviso informativo de configuração) */}
                          <button
                            type="button"
                            onClick={() => {
                              setCommentsLoginWarning("Login com Facebook temporariamente indisponível no ambiente de desenvolvimento.");
                            }}
                            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/[0.06] hover:text-white/80 transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <svg className="size-4 shrink-0 fill-[#1877F2]" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                              </svg>
                              <span>Continuar com Facebook</span>
                            </div>
                            <span className="text-[10px] text-amber-400/80 font-normal">Não config.</span>
                          </button>
                        </div>

                        {commentsLoginWarning && (
                          <div className="mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                            {commentsLoginWarning}
                          </div>
                        )}

                        <div className="h-px bg-white/[0.08] my-2.5" />

                        <button
                          type="button"
                          onClick={() => {
                            setCommentsLoginOpen(false);
                            setLoginOpen(true);
                          }}
                          className="w-full text-center text-xs text-[#c084fc] hover:underline font-medium py-1"
                        >
                          Entrar com email ou criar conta Hikari
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* Usuário autenticado: Avatar real + Nome + Menu com 5 opções */
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    className="inline-flex min-h-8 sm:min-h-9 items-center gap-2 rounded-xl border border-white/10 bg-[#16161b] px-2.5 py-1 text-xs sm:text-sm font-medium text-white/90 hover:border-[#a855f7]/40 hover:bg-white/[0.06] active:scale-95 transition-all shadow-sm max-w-[180px] sm:max-w-[240px]"
                    aria-expanded={userMenuOpen}
                    aria-haspopup="menu"
                  >
                    <div className="flex size-6 sm:size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1b1b22] ring-1 ring-[#a855f7]/40 text-xs font-semibold text-white">
                      {effectiveUserImage ? (
                        <img
                          src={effectiveUserImage}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="text-[#c084fc] font-bold text-[11px]">
                          {effectiveUserName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="truncate text-xs sm:text-sm text-white/95 font-medium">
                      {effectiveUserName}
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-3 text-white/50 shrink-0 transition-transform duration-200",
                        userMenuOpen && "rotate-180 text-[#c084fc]"
                      )}
                    />
                  </button>

                  {/* Menu da pessoa autenticada */}
                  {userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div
                        role="menu"
                        className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#141419]/95 backdrop-blur-xl p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                      >
                        {/* Header do Menu com Nome e Email */}
                        <div className="px-3 py-2 border-b border-white/[0.08] mb-1">
                          <p className="text-xs font-semibold text-white truncate">
                            {effectiveUserName}
                          </p>
                          {effectiveUserEmail && (
                            <p className="text-[11px] text-white/40 truncate">
                              {effectiveUserEmail}
                            </p>
                          )}
                        </div>

                        {/* 1. Seu perfil */}
                        <Link
                          to={userNick ? "/profile/$nick" : "/account"}
                          params={userNick ? { nick: userNick } : undefined}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-white/80 hover:bg-[#a855f7]/15 hover:text-white transition-colors"
                        >
                          <UserCircle className="size-4 text-[#c084fc] shrink-0" />
                          <span>Seu perfil</span>
                        </Link>

                        {/* 2. Comunidade */}
                        <Link
                          to="/news"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-white/80 hover:bg-[#a855f7]/15 hover:text-white transition-colors"
                        >
                          <Users className="size-4 text-[#c084fc] shrink-0" />
                          <span>Comunidade</span>
                        </Link>

                        {/* 3. Exibir mídia */}
                        <button
                          type="button"
                          onClick={() => {
                            handleToggleShowMedia();
                          }}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-white/80 hover:bg-[#a855f7]/15 hover:text-white transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <ImageIcon className="size-4 text-[#c084fc] shrink-0" />
                            <span>Exibir mídia</span>
                          </div>
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded font-semibold",
                              showMedia
                                ? "bg-[#a855f7]/25 text-[#c084fc]"
                                : "bg-white/10 text-white/40"
                            )}
                          >
                            {showMedia ? "Ativo" : "Oculto"}
                          </span>
                        </button>

                        {/* 4. Editar configurações */}
                        <Link
                          to="/settings-profile"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-white/80 hover:bg-[#a855f7]/15 hover:text-white transition-colors"
                        >
                          <Settings2 className="size-4 text-[#c084fc] shrink-0" />
                          <span>Editar configurações</span>
                        </Link>

                        {/* Divisor */}
                        <div className="h-px bg-white/[0.08] my-1" />

                        {/* 5. Sair */}
                        <button
                          type="button"
                          onClick={async () => {
                            setUserMenuOpen(false);
                            try {
                              await signOut();
                            } catch (e) {
                              console.error("Erro ao sair:", e);
                            }
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/15 hover:text-red-200 transition-colors"
                        >
                          <LogOut className="size-4 text-red-400 shrink-0" />
                          <span>Sair</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

            </div>

          </div>

          {/* =============================================== */}
          {/* CAMPO DE COMENTÁRIO                             */}
          {/* =============================================== */}

          <div className="mt-4 rounded-2xl border border-white/10 bg-[#141418] p-3.5 sm:p-4 shadow-xl focus-within:border-[#a855f7]/50 focus-within:ring-1 focus-within:ring-[#a855f7]/20 transition-all">

            <div className="flex items-start gap-3">
              <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1b1b22] text-xs font-semibold border border-white/10 text-white/80 mt-0.5">
                {effectiveUserImage ? (
                  <img
                    src={effectiveUserImage}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-[#c084fc] font-bold">
                    {effectiveUserName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
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
              placeholder="Escreva um comentário sobre o episódio..."
              rows={3}
              maxLength={2000}
              className="w-full resize-none rounded-xl border border-white/10 bg-[#0c0c10] px-4 py-3 text-sm text-fg outline-none placeholder:text-white/35 focus:border-[#a855f7]/40 transition-colors"
            />



            {gifOpen && (
              <div
                className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    closeGifPicker();
                  }
                }}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="gif-dialog-title"
                  className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#17171a] shadow-2xl"
                >
                  <div className="flex items-center gap-3 border-b border-white/10 p-4">
                    <div className="min-w-0 flex-1">
                      <h3
                        id="gif-dialog-title"
                        className="font-display text-xl"
                      >
                        Escolher GIF
                      </h3>
                      <p className="mt-1 text-xs text-subtle">
                        Busque um GIF para anexar ao comentário.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={closeGifPicker}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
                      aria-label="Fechar GIFs"
                    >
                      <X className="size-5" />
                    </button>
                  </div>

                  <div className="border-b border-white/10 p-4">
                    <input
                     ref={gifGalleryInputRef}
                     type="file"
                     accept="image/gif,.gif"
                     onChange={handleSelectGifFromGallery}
                     className="hidden"
                   />

                   <button
                     type="button"
                     onClick={() =>
                       gifGalleryInputRef.current?.click()
                     }
                     disabled={
                       sending ||
                       imageUploading
                     }
                     className="mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-bg px-4 text-sm font-medium text-muted transition-colors hover:border-white/20 hover:bg-elevated hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
                   >
                     <ImageIcon className="size-4" />
                     Escolher GIF da galeria
                   </button>

                   <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void searchGifs();
                      }}
                      className="flex gap-2"
                    >
                      <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                        <input
                          ref={gifSearchInputRef}
                          value={gifSearch}
                          onChange={(event) =>
                            setGifSearch(event.target.value)
                          }
                          placeholder="Buscar GIF..."
                          className="min-h-11 w-full rounded-lg border border-white/5 bg-bg pl-10 pr-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-white/15"
                        />
                      </div>

                      <Button
                        type="submit"
                        size="sm"
                        disabled={gifLoading}
                        className="min-h-11 shrink-0"
                      >
                        {gifLoading ? "Buscando..." : "Buscar"}
                      </Button>
                    </form>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {gifError && (
                      <div className="rounded-lg border border-white/5 bg-surface p-4 text-sm text-red-400">
                        {gifError}
                      </div>
                    )}

                    {!gifError && gifLoading && gifResults.length === 0 && (
                      <div className="py-10 text-center text-sm text-muted">
                        Buscando GIFs...
                      </div>
                    )}

                    {!gifError && !gifLoading && gifResults.length === 0 && (
                      <div className="py-10 text-center text-sm text-muted">
                        Nenhum GIF encontrado.
                      </div>
                    )}

                    {gifResults.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {gifResults.map((gif) => (
                          <button
                            key={gif.id}
                            type="button"
                            onClick={() =>
                              handleSelectGif(gif.url)
                            }
                            className="group aspect-square overflow-hidden rounded-lg border border-white/5 bg-bg transition-colors hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20"
                            title={gif.title || "GIF"}
                          >
                            <img
                              src={gif.preview}
                              alt={gif.title || "GIF"}
                              loading="lazy"
                              className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    <p className="mt-3 text-center text-[10px] text-subtle">
                      Powered by GIPHY
                    </p>
                  </div>
                </div>
              </div>
            )}

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

            {selectedGifUrl && (
              <div className="relative mt-3 w-fit max-w-full overflow-hidden rounded-xl border border-white/10 bg-bg">
                <img
                  src={selectedGifUrl}
                  alt="GIF selecionado"
                  className="max-h-64 max-w-full object-contain"
                />

                <button
                  type="button"
                  onClick={handleRemoveGif}
                  disabled={sending || imageUploading}
                  aria-label="Remover GIF"
                  title="Remover GIF"
                  className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-sm transition-colors hover:bg-black disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {/* ============================================= */}
            {/* ============================================= */}
            {/* BARRA DE FERRAMENTAS E CONTROLES DO FORMULÁRIO */}
            {/* ============================================= */}

            <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">

              {/* Grupo esquerdo: Imagem, GIF único e Spoiler */}
              <div className="flex flex-wrap items-center gap-2">

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

                {/* Botão Imagem */}
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
                  title="Adicionar imagem"
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-[#16161b] px-2.5 py-1 text-xs font-medium text-white/80 transition-all hover:border-[#a855f7]/40 hover:bg-[#a855f7]/10 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ImageIcon className="size-3.5 text-[#c084fc] shrink-0" />
                  <span>Imagem</span>
                </button>

                {/* Botão GIF - com identificação única (sem duplicidade) */}
                <button
                  type="button"
                  onClick={() => {
                    openGifPicker();
                  }}
                  disabled={
                    sending ||
                    imageUploading
                  }
                  aria-label="Adicionar GIF"
                  title="Adicionar GIF"
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-white/10 bg-[#16161b] px-2.5 py-1 text-xs font-medium text-white/80 transition-all hover:border-[#a855f7]/40 hover:bg-[#a855f7]/10 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="rounded bg-[#a855f7]/20 border border-[#a855f7]/35 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-[#c084fc] shrink-0">
                    GIF
                  </span>
                </button>

                {/* Separador vertical sutil */}
                <div className="hidden sm:block h-3.5 w-px bg-white/10 mx-0.5" />

                {/* Marcar como spoiler */}
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-white/70 hover:text-white select-none py-1 transition-colors">
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
                    className="size-3.5 rounded border-white/20 bg-[#0c0c10] text-[#a855f7] accent-[#a855f7] focus:ring-1 focus:ring-[#a855f7]"
                  />
                  <span className="truncate">
                    Spoiler
                  </span>
                </label>

              </div>

              {/* Grupo direito: Enviar */}
              <div className="flex items-center gap-2.5 ml-auto">
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    void handleComment()
                  }
                  disabled={
                    (!text.trim() &&
                      !commentImage &&
                      !selectedGifUrl) ||
                    sending ||
                    imageUploading
                  }
                  className="w-auto px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl bg-[#a855f7] hover:bg-[#9333ea] text-white shadow-[0_0_12px_rgba(168,85,247,0.25)] active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none shrink-0 inline-flex items-center gap-1.5"
                >
                  <Send className="size-3.5 shrink-0" />
                  <span>
                    {imageUploading
                      ? "Enviando..."
                      : sending
                        ? "Enviando..."
                        : "Comentar"}
                  </span>
                </Button>
              </div>

            </div>

            {error && (
              <p className="mt-3 text-xs sm:text-sm text-red-400">
                {error}
              </p>
            )}

              </div>
            </div>

          </div>

          {/* =============================================== */}
          {/* SUCESSO DE DENÚNCIA / MODERAÇÃO                   */}
          {/* =============================================== */}

          {moderationSuccess && (
            <div
              role="status"
              aria-live="polite"
              className={cn(
                "mt-4 flex items-center justify-between gap-3 rounded-xl border border-purple-500/30 bg-[#161224]/90 px-4 py-3 shadow-lg shadow-purple-950/25 backdrop-blur-md transition-all duration-300 ease-out",
                moderationSuccessVisible
                  ? "translate-y-0 opacity-100 scale-100"
                  : "-translate-y-1 opacity-0 scale-[0.98] pointer-events-none",
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[#c084fc]">
                  <CheckCircle2 className="size-3.5" />
                </div>
                <p className="text-xs sm:text-sm font-medium text-purple-100 leading-snug">
                  {moderationSuccess}
                </p>
              </div>

              <button
                type="button"
                onClick={handleDismissSuccess}
                className="flex size-6 shrink-0 items-center justify-center rounded-lg text-purple-300/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Fechar notificação"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* =============================================== */}
          {/* LISTA DE COMENTÁRIOS REDESENHADA (SEM CARTÕES PESADOS) */}
          {/* =============================================== */}

          <div className="mt-6 divide-y divide-white/[0.06] border-y border-white/[0.06]">

            {loading ? (
              <ElizabethCommentsLoading />
            ) : displayedRootComments.length ===
              0 ? (
              <div className="py-10 text-center text-sm text-white/40">
                Ainda não há comentários neste episódio.
                <br />
                Seja o primeiro a comentar!
              </div>
            ) : (
              displayedRootComments.map(
                (comment) => {
                  const replies =
                    repliesFor(
                      comment.id,
                    );

                  const isAuthor =
                    Boolean(
                      effectiveUserId &&
                      effectiveUserId === comment.userId,
                    );

                  const canEdit =
                    Boolean(
                      effectiveUserId &&
                      (isAuthor || isAdmin),
                    );

                  const canReport =
                    Boolean(!isAuthor);

                  return (
                    <div
                      key={
                        comment.id
                      }
                      className="py-3 sm:py-4 transition-colors"
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
                        isPendingReaction={
                          Boolean(pendingReactionIds[comment.id])
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
                          formatCommentDate
                        }
                        onReaction={
                          handleReaction
                        }
                        onReplyChange={
                          setReplyText
                        }
                        onReplySpoilerChange={
                          setReplyIsSpoiler
                        }
                        onStartReply={() => {
                          if (!effectiveUserId) {
                            setLoginOpen(true);
                            return;
                          }
                          setReplyingId(comment.id);
                          setReplyText("");
                          setReplyIsSpoiler(false);
                        }}
                        onCancelReply={() => {
                          setReplyingId(null);
                          setReplyText("");
                          setReplyIsSpoiler(false);
                          setMenuOpenId(null);
                        }}
                        onSendReply={() => {
                          void handleReply(comment.id);
                        }}
                        menuOpen={menuOpenId === comment.id}
                        onToggleMenu={() => {
                          setMenuOpenId((current) =>
                            current === comment.id ? null : comment.id,
                          );
                        }}
                        onEdit={() => openEdit(comment)}
                        onDelete={() => openDelete(comment)}
                        onMarkSpoiler={() => {
                          void handleModeration(comment.id, "spoiler");
                        }}
                        onReport={() => openReport(comment)}
                        onSpam={() => setSpamComment(comment)}
                        moderating={moderatingId === comment.id}
                        canEdit={canEdit}
                        canReport={canReport}
                        isAdmin={isAdmin}
                        highlighted={highlightedCommentId === comment.id}
                        onRequireLogin={() => setLoginOpen(true)}
                        showMedia={showMedia}
                        isNew={newCommentId === comment.id}
                      />

                      {/* Respostas com recuo progressivo e linha vertical discreta */}
                      {replies.length > 0 && (
                        <div className="mt-2.5 ml-3 sm:ml-7 border-l-2 border-white/10 hover:border-[#a855f7]/40 pl-3 sm:pl-4 space-y-2 transition-colors">
                          {replies.map((reply) => {
                            const isReplyAuthor =
                              Boolean(
                                effectiveUserId &&
                                effectiveUserId === reply.userId,
                              );
                            const canEditReply =
                              Boolean(
                                effectiveUserId &&
                                  (isReplyAuthor || isAdmin),
                              );
                            const canReportReply =
                              Boolean(!isReplyAuthor);
                            const mentionMatch = reply.content.match(/^@([^\s:,]+)/);
                            const replyRecipient = mentionMatch
                              ? mentionMatch[1]
                              : (comment.userName || "Usuário");

                            return (
                              <CommentCard
                                key={reply.id}
                                comment={reply}
                                replyCount={0}
                                replyToName={replyRecipient}
                                isPendingReaction={
                                  Boolean(pendingReactionIds[reply.id])
                                }
                                replyingId={replyingId}
                                replyText={replyText}
                                replyIsSpoiler={replyIsSpoiler}
                                replySending={replySending}
                                formatDate={formatCommentDate}
                                onReaction={handleReaction}
                                onReplyChange={setReplyText}
                                onReplySpoilerChange={setReplyIsSpoiler}
                                onStartReply={() => {
                                  if (!effectiveUserId) {
                                    setLoginOpen(true);
                                    return;
                                  }
                                  setReplyingId(reply.id);
                                  setReplyText(`@${reply.userName || "Usuário"} `);
                                  setReplyIsSpoiler(false);
                                }}
                                onCancelReply={() => {
                                  setReplyingId(null);
                                  setReplyText("");
                                  setReplyIsSpoiler(false);
                                  setMenuOpenId(null);
                                }}
                                onSendReply={() => {
                                  void handleReply(comment.id);
                                }}
                                isReply
                                menuOpen={menuOpenId === reply.id}
                                onToggleMenu={() => {
                                  setMenuOpenId((current) =>
                                    current === reply.id ? null : reply.id,
                                  );
                                }}
                                onEdit={() => openEdit(reply)}
                                onDelete={() => openDelete(reply)}
                                onMarkSpoiler={() => {
                                  void handleModeration(reply.id, "spoiler");
                                }}
                                onReport={() => openReport(reply)}
                                onSpam={() => setSpamComment(reply)}
                                moderating={moderatingId === reply.id}
                                canEdit={canEditReply}
                                canReport={canReportReply}
                                isAdmin={isAdmin}
                                highlighted={highlightedCommentId === reply.id}
                                onRequireLogin={() => setLoginOpen(true)}
                                showMedia={showMedia}
                                isNew={newCommentId === reply.id}
                              />
                            );
                          })}
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
      )}

      {/* ================================================== */}
      {/* MODAL DE EDIÇÃO                                    */}
      {/* ================================================== */}

      {editingComment && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelEdit();
            }
          }}
        >

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
                onClick={handleCancelEdit}
                disabled={
                  editSaving
                }
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg cursor-pointer"
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
                onClick={handleCancelEdit}
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
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelDelete();
            }
          }}
        >

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
                onClick={handleCancelDelete}
                disabled={
                  deleteSending
                }
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg cursor-pointer"
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
                onClick={handleCancelDelete}
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
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelReport();
            }
          }}
        >

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
                onClick={handleCancelReport}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg cursor-pointer"
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
                onClick={handleCancelReport}
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
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelSpam();
            }
          }}
        >

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

              <button
                type="button"
                onClick={handleCancelSpam}
                disabled={Boolean(moderatingId)}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg cursor-pointer"
                aria-label="Fechar"
              >
                <X className="size-5" />
              </button>

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
                onClick={handleCancelSpam}
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

      {/* ================================================== */}
      {/* MENU DE LOGIN COMPACTO                             */}
      {/* ================================================== */}

      <LoginMenu
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        callbackURL={
          typeof window !== "undefined"
            ? window.location.pathname + window.location.search
            : "/"
        }
      />

    </section>
  );
}

/* ========================================================= */
/* CARD DO COMENTÁRIO REDESENHADO (LEVE E MODERNO)          */
/* ========================================================= */

function CommentCard({
  comment,
  replyCount,
  replyToName,
  isPendingReaction,
  replyingId,
  replyText,
  replyIsSpoiler,
  replySending,
  formatDate,
  onReaction,
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
  onSpam: _onSpam,
  moderating,
  canEdit,
  canReport = true,
  isAdmin = false,
  highlighted = false,
  onRequireLogin: _onRequireLogin,
  showMedia = true,
  isNew = false,
}: {
  comment: Comment;
  replyCount: number;
  replyToName?: string;
  isPendingReaction: boolean;
  replyingId: string | null;
  replyText: string;
  replyIsSpoiler: boolean;
  replySending: boolean;
  formatDate: (value: string) => { date: string; time: string };
  onReaction: (id: string, reaction: "like" | "dislike") => void;
  onReplyChange: (value: string) => void;
  onReplySpoilerChange: (value: boolean) => void;
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
  onSpam?: () => void;
  moderating: boolean;
  canEdit: boolean;
  canReport?: boolean;
  isAdmin?: boolean;
  highlighted?: boolean;
  onRequireLogin?: () => void;
  showMedia?: boolean;
  isNew?: boolean;
}) {
  const isReplying = replyingId === comment.id;
  const [localMediaRevealed, setLocalMediaRevealed] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const formattedDate = formatDate(comment.createdAt);

  return (
    <article
      id={`comment-${comment.id}`}
      className={cn(
        "group/comment relative py-2.5 transition-colors",
        highlighted &&
          "rounded-xl bg-[#a855f7]/10 p-3 border border-[#a855f7]/40 shadow-[0_0_15px_rgba(168,85,247,0.15)]",
        isNew
          ? "rounded-xl bg-[#a855f7]/15 border border-[#a855f7]/40 p-3 shadow-[0_0_15px_rgba(168,85,247,0.15)] transition-colors duration-1000 ease-out motion-safe:animate-in motion-safe:fade-in-50"
          : "border border-transparent transition-colors duration-500 ease-out",
      )}
    >
      {/* =================================================== */}
      {/* TOPO: AVATAR, NOME, DATA E MENU DE OPÇÕES           */}
      {/* =================================================== */}

      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {comment.userNick ? (
            <Link
              to="/profile/$nick"
              params={{ nick: comment.userNick }}
              className="flex items-center gap-2.5 min-w-0 group/author hover:opacity-90 transition-opacity"
            >
              {/* Avatar compacto com borda interativa */}
              <div className="relative flex size-7 sm:size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1b1b22] ring-1 ring-white/10 text-xs font-semibold text-white/90 group-hover/author:ring-[#a855f7]/50 transition-all">
                {comment.userImage ? (
                  <img
                    src={comment.userImage}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-[#c084fc] font-bold">
                    {(comment.userName || "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Nome do autor com hover sutil */}
              <span className="text-xs sm:text-sm font-bold text-white group-hover/author:text-[#c084fc] truncate transition-colors">
                {comment.userName || "Usuário"}
              </span>
            </Link>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Avatar compacto */}
              <div className="relative flex size-7 sm:size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1b1b22] ring-1 ring-white/10 text-xs font-semibold text-white/90">
                {comment.userImage ? (
                  <img
                    src={comment.userImage}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-[#c084fc] font-bold">
                    {(comment.userName || "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Nome do autor estático */}
              <span className="text-xs sm:text-sm font-bold text-white truncate">
                {comment.userName || "Usuário"}
              </span>
            </div>
          )}

          {/* Em respostas: Usuário que responde → @Usuário mencionado e Data */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
            {isReply && replyToName && (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="text-[#c084fc]/70 font-semibold">→</span>
                <span className="text-[#c084fc] font-medium">@{replyToName}</span>
              </span>
            )}

            {formattedDate.date && (
              <span className="text-[11px] font-medium text-[#c084fc]/80">
                · {formattedDate.date}
              </span>
            )}

            {formattedDate.time && (
              <span className="text-[11px] text-white/40">
                {formattedDate.time}
              </span>
            )}
          </div>
        </div>

        {/* Menu de opções no topo direito */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
            }}
            disabled={moderating}
            aria-label="Opções do comentário"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex size-7 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            <MoreVertical className="size-4" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMenu();
                }}
              />
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+6px)] z-50 w-52 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-[#16161c]/95 backdrop-blur-xl p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
              >
                {canEdit && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onToggleMenu();
                        onEdit();
                      }}
                      disabled={moderating}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-white/80 hover:bg-[#a855f7]/15 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Edit3 className="size-3.5 shrink-0 text-[#c084fc]" />
                      <span>Editar comentário</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onToggleMenu();
                        onDelete();
                      }}
                      disabled={moderating}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-300 hover:bg-red-500/15 hover:text-red-200 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="size-3.5 shrink-0 text-red-400" />
                      <span>Excluir comentário</span>
                    </button>
                  </>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onToggleMenu();
                      onMarkSpoiler();
                    }}
                    disabled={comment.isSpoiler || moderating}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-white/80 hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <AlertTriangle className="size-3.5 shrink-0 text-amber-400" />
                    <span>
                      {moderating ? "Enviando..." : "Marcar como spoiler"}
                    </span>
                  </button>
                )}

                {canReport && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onToggleMenu();
                      onReport();
                    }}
                    disabled={moderating}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-white/80 hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Flag className="size-3.5 shrink-0 text-purple-400" />
                    <span>Denunciar comentário</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* =================================================== */}
      {/* CONTEÚDO (LOGO ABAIXO DO CABEÇALHO) COM SPOILER     */}
      {/* =================================================== */}

      <div className="mt-2 text-xs sm:text-sm text-white/85 leading-relaxed break-words">
        {comment.isSpoiler ? (
          !spoilerRevealed ? (
            /* Aviso elegante de spoiler antes de revelar */
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
                    <EyeOff className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-amber-300/90 tracking-tight">
                      Spoiler deste episódio
                    </p>
                    <p className="text-[11px] text-white/50 leading-tight">
                      Este comentário pode conter revelações sobre o enredo.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSpoilerRevealed(true)}
                  className="inline-flex self-start sm:self-center items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/30 active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <Eye className="size-3" />
                  <span>Revelar spoiler</span>
                </button>
              </div>
            </div>
          ) : (
            /* Conteúdo revelado com botão de ocultar novamente */
            <div className="rounded-xl border border-white/10 bg-[#0c0c11] p-3 transition-all motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
              <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/[0.06]">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-400/90">
                  <Eye className="size-3 text-amber-400" />
                  <span>Spoiler deste episódio</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSpoilerRevealed(false)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-white/50 hover:text-white transition-colors cursor-pointer"
                >
                  <EyeOff className="size-3" />
                  <span>Ocultar spoiler</span>
                </button>
              </div>

              <p className="whitespace-pre-wrap text-white/90 text-xs sm:text-sm leading-relaxed">
                {comment.content}
              </p>

              {/* Mídia dentro do spoiler */}
              {comment.imageUrl && (
                <div className="mt-2.5">
                  {!showMedia && !localMediaRevealed ? (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0e0e14] px-3 py-2 text-xs text-white/60">
                      <ImageIcon className="size-3.5 text-[#c084fc] shrink-0" />
                      <span>Mídia oculta</span>
                      <span className="text-white/30">·</span>
                      <button
                        type="button"
                        onClick={() => setLocalMediaRevealed(true)}
                        className="font-medium text-[#c084fc] hover:text-white hover:underline transition-colors cursor-pointer"
                      >
                        Exibir
                      </button>
                    </div>
                  ) : (
                    <div className="w-fit max-w-full overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0e]">
                      <a
                        href={comment.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-fit max-w-full cursor-zoom-in"
                        aria-label="Abrir imagem em tamanho maior"
                      >
                        <img
                          src={comment.imageUrl}
                          alt="Imagem anexada"
                          loading="lazy"
                          className="block max-h-72 sm:max-h-80 w-auto max-w-full object-contain rounded-lg"
                        />
                      </a>
                      {!showMedia && localMediaRevealed && (
                        <div className="border-t border-white/10 bg-[#0e0e14] px-2.5 py-1 text-right">
                          <button
                            type="button"
                            onClick={() => setLocalMediaRevealed(false)}
                            className="text-[11px] text-white/50 hover:text-white transition-colors cursor-pointer"
                          >
                            Ocultar mídia
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        ) : (
          <>
            <p className="whitespace-pre-wrap text-white/85">
              {comment.content}
            </p>

            {/* Anexo de Imagem ou GIF com suporte a exibição/ocultação */}
            {comment.imageUrl && (
              <div className="mt-2.5">
                {!showMedia && !localMediaRevealed ? (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0e0e14] px-3 py-2 text-xs text-white/60">
                    <ImageIcon className="size-3.5 text-[#c084fc] shrink-0" />
                    <span>Mídia oculta</span>
                    <span className="text-white/30">·</span>
                    <button
                      type="button"
                      onClick={() => setLocalMediaRevealed(true)}
                      className="font-medium text-[#c084fc] hover:text-white hover:underline transition-colors cursor-pointer"
                    >
                      Exibir
                    </button>
                  </div>
                ) : (
                  <div className="w-fit max-w-full overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0e]">
                    <a
                      href={comment.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-fit max-w-full cursor-zoom-in"
                      aria-label="Abrir imagem em tamanho maior"
                    >
                      <img
                        src={comment.imageUrl}
                        alt="Imagem anexada"
                        loading="lazy"
                        className="block max-h-72 sm:max-h-80 w-auto max-w-full object-contain rounded-lg"
                      />
                    </a>
                    {!showMedia && localMediaRevealed && (
                      <div className="border-t border-white/10 bg-[#0e0e14] px-2.5 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => setLocalMediaRevealed(false)}
                          className="text-[11px] text-white/50 hover:text-white transition-colors cursor-pointer"
                        >
                          Ocultar mídia
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* =================================================== */}
      {/* AÇÕES (LIKE, DISLIKE, RESPONDER)                   */}
      {/* =================================================== */}

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
        {/* Botão CURTIR (ThumbsUp) com transição fluida */}
        <button
          type="button"
          onClick={() => onReaction(comment.id, "like")}
          disabled={isPendingReaction}
          className={cn(
            "group/like inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all select-none cursor-pointer duration-200 motion-reduce:transition-none",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#a855f7]",
            comment.liked
              ? "bg-[#a855f7]/20 text-[#c084fc] border border-[#a855f7]/45 shadow-[0_0_12px_rgba(168,85,247,0.22)]"
              : "text-white/50 hover:text-white hover:bg-white/[0.06] border border-transparent active:bg-white/[0.08]",
            isPendingReaction && "opacity-60 pointer-events-none",
          )}
          aria-label={comment.liked ? "Remover curtida" : "Curtir comentário"}
        >
          <ThumbsUp
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none motion-reduce:transform-none ease-out",
              comment.liked
                ? "fill-current scale-110"
                : "group-hover/like:scale-110 active:scale-90",
            )}
          />
          <span className="font-semibold tabular-nums transition-colors duration-200 motion-reduce:transition-none">
            {comment.likes}
          </span>
        </button>

        {/* Botão NÃO CURTIR (ThumbsDown) com transição fluida */}
        <button
          type="button"
          onClick={() => onReaction(comment.id, "dislike")}
          disabled={isPendingReaction}
          className={cn(
            "group/dislike inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all select-none cursor-pointer duration-200 motion-reduce:transition-none",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#a855f7]",
            comment.disliked
              ? "bg-[#a855f7]/20 text-[#c084fc] border border-[#a855f7]/45 shadow-[0_0_12px_rgba(168,85,247,0.22)]"
              : "text-white/50 hover:text-white hover:bg-white/[0.06] border border-transparent active:bg-white/[0.08]",
            isPendingReaction && "opacity-60 pointer-events-none",
          )}
          aria-label={
            comment.disliked ? "Remover descurtida" : "Não curtir comentário"
          }
        >
          <ThumbsDown
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none motion-reduce:transform-none ease-out",
              comment.disliked
                ? "fill-current scale-110"
                : "group-hover/dislike:scale-110 active:scale-90",
            )}
          />
          <span className="font-semibold tabular-nums transition-colors duration-200 motion-reduce:transition-none">
            {comment.dislikes}
          </span>
        </button>

        {/* Botão RESPONDER */}
        <button
          type="button"
          onClick={onStartReply}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-white/50 hover:text-white hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer"
        >
          <MessageCircle className="size-3.5 shrink-0" />
          <span>Responder</span>
        </button>

        {/* Contador de respostas para comentário raiz */}
        {!isReply && replyCount > 0 && (
          <span className="text-[11px] text-white/40 ml-0.5">
            · {replyCount} {replyCount === 1 ? "resposta" : "respostas"}
          </span>
        )}
      </div>

      {/* =================================================== */}
      {/* FORMULÁRIO DE RESPOSTA INLINE                       */}
      {/* =================================================== */}

      {isReplying && (
        <div className="mt-3 rounded-xl border border-white/10 bg-[#121217] p-3 shadow-lg focus-within:border-[#a855f7]/50 focus-within:ring-1 focus-within:ring-[#a855f7]/20 transition-all">
          <textarea
            value={replyText}
            onChange={(event) => onReplyChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSendReply();
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder={
              replyToName
                ? `Responder para @${replyToName}...`
                : "Escreva sua resposta..."
            }
            className="w-full resize-none rounded-lg border border-white/10 bg-[#0c0c10] px-3 py-2 text-xs sm:text-sm text-fg outline-none placeholder:text-white/35 focus:border-[#a855f7]/40 transition-colors"
          />

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-white/60 hover:text-white select-none">
              <input
                type="checkbox"
                checked={replyIsSpoiler}
                onChange={(event) =>
                  onReplySpoilerChange(event.target.checked)
                }
                className="size-3.5 rounded border-white/20 bg-[#0c0c10] text-[#a855f7] accent-[#a855f7]"
              />
              <span>Spoiler</span>
            </label>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onCancelReply}
                disabled={replySending}
                className="h-7 px-2.5 text-xs rounded-lg border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
              >
                Cancelar
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={onSendReply}
                disabled={!replyText.trim() || replySending}
                className="h-7 px-3 text-xs font-semibold rounded-lg bg-[#a855f7] hover:bg-[#9333ea] text-white shadow-[0_0_10px_rgba(168,85,247,0.25)] active:scale-95 transition-all inline-flex items-center gap-1"
              >
                <Send className="size-3 shrink-0" />
                <span>{replySending ? "Enviando..." : "Responder"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}



export default EpisodeCommentsSection;
