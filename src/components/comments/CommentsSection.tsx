import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  Edit3,
  Eye,
  EyeOff,
  Flag,
  Image as ImageIcon,
  Loader2,
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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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

export interface CommentsSectionProps {
  animeId: string;
  episodeId?: string;
  animeTitle?: string;
  episodeNumber?: number;
  targetCommentId?: string;
  isAnimeGeneral?: boolean;
}

export function CommentsSection({
  animeId,
  episodeId: rawEpisodeId,
  animeTitle,
  episodeNumber,
  targetCommentId,
  isAnimeGeneral = false,
}: CommentsSectionProps) {
  // Se episodeId não for fornecido ou for a página geral do anime, usa "anime"
  const episodeId =
    rawEpisodeId && rawEpisodeId.trim() ? rawEpisodeId.trim() : "anime";

  const [text, setText] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pendingReactionIds, setPendingReactionIds] = useState<
    Record<string, boolean>
  >({});
  const inFlightReactionsRef = useRef<Set<string>>(new Set());

  const [rootOrder, setRootOrder] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyIsSpoiler, setReplyIsSpoiler] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const [error, setError] = useState("");

  const [loginOpen, setLoginOpen] = useState(false);
  const [commentsLoginOpen, setCommentsLoginOpen] = useState(false);
  const [commentsLoginWarning, setCommentsLoginWarning] = useState<string | null>(
    null,
  );
  const [sessionLoadingState, setSessionLoadingState] = useState(false);
  const [newCommentId, setNewCommentId] = useState<string | null>(null);
  const newCommentTimeoutRef = useRef<number | null>(null);

  /* ====================================================== */
  /* IMAGEM DO COMENTÁRIO                                   */
  /* ====================================================== */

  const [commentImage, setCommentImage] = useState<File | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState<string | null>(
    null,
  );
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  /* ====================================================== */
  /* GIF                                                     */
  /* ====================================================== */

  const [gifOpen, setGifOpen] = useState(false);

  useEffect(() => {
    if (!gifOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [gifOpen]);

  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState<
    Array<{
      id: string;
      url: string;
      preview: string;
      title: string;
    }>
  >([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState("");
  const [selectedGifUrl, setSelectedGifUrl] = useState<string | null>(null);
  const gifSearchInputRef = useRef<HTMLInputElement | null>(null);
  const gifGalleryInputRef = useRef<HTMLInputElement | null>(null);

  /* ====================================================== */
  /* USUÁRIO ATUAL & SESSÃO                                  */
  /* ====================================================== */

  const { user: authUser, isPending: authUserPending } = useCurrentUserState();
  const getProfileFn = useServerFn(getProfile);

  const [userNick, setUserNick] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showMedia, setShowMedia] = useState<boolean>(() => {
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

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentUserImage, setCurrentUserImage] = useState<string | null>(null);

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

  useEffect(() => {
    if (!userMenuOpen && !loginOpen && !commentsLoginOpen && !sortDropdownOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
        setLoginOpen(false);
        setCommentsLoginOpen(false);
        setSortDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [userMenuOpen, loginOpen, commentsLoginOpen, sortDropdownOpen]);

  const effectiveUserId = authUser?.id ?? currentUserId;
  const effectiveUserEmail = authUser?.primaryEmail ?? currentUserEmail;
  const effectiveUserName =
    authUser?.displayName ||
    userNick ||
    currentUserName ||
    (effectiveUserEmail ? effectiveUserEmail.split("@")[0] : "Usuário");
  const effectiveUserImage = authUser?.profileImageUrl ?? currentUserImage;

  const sessionLoading =
    (authUserPending || sessionLoadingState) && !effectiveUserId;
  const isAdmin = isHikariAdmin(effectiveUserEmail);

  /* ====================================================== */
  /* DESTAQUE DA NOTIFICAÇÃO                                */
  /* ====================================================== */

  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(
    null,
  );


  /* ====================================================== */
  /* MODERAÇÃO                                               */
  /* ====================================================== */

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [reportingComment, setReportingComment] = useState<Comment | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason | "">("");
  const [reportSending, setReportSending] = useState(false);
  const [spamComment, setSpamComment] = useState<Comment | null>(null);
  const [moderationSuccess, setModerationSuccess] = useState("");

  /* ====================================================== */
  /* EDIÇÃO                                                  */
  /* ====================================================== */

  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [editText, setEditText] = useState("");
  const [editIsSpoiler, setEditIsSpoiler] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  /* ====================================================== */
  /* EXCLUSÃO                                                */
  /* ====================================================== */

  const [deletingComment, setDeletingComment] = useState<Comment | null>(null);
  const [deleteSending, setDeleteSending] = useState(false);

  /* ====================================================== */
  /* LIMPAR PREVIEW QUANDO A IMAGEM MUDA                     */
  /* ====================================================== */

  useEffect(() => {
    if (!commentImage) {
      setCommentImagePreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(commentImage);
    setCommentImagePreview(previewUrl);
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [commentImage]);

  /* ====================================================== */
  /* SELECIONAR IMAGEM                                      */
  /* ====================================================== */

  const handleSelectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
    ) {
      setError("Escolha uma imagem JPG, PNG, WebP ou GIF.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("A imagem pode ter no máximo 10 MB.");
      event.target.value = "";
      return;
    }

    setError("");
    setSelectedGifUrl(null);
    setCommentImage(file);
  };

  const handleRemoveImage = () => {
    setCommentImage(null);
    setCommentImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  /* ====================================================== */
  /* UPLOAD DA IMAGEM                                       */
  /* ====================================================== */

  const uploadCommentImage = async (file: File): Promise<string> => {
    if (typeof window === "undefined") {
      throw new Error("Navegador necessário.");
    }

    const blob = await upload(`hikari/comments/${file.name}`, file, {
      access: "public",
      handleUploadUrl: "/api/upload-comment-image",
      multipart: true,
    });

    return blob.url;
  };

  /* ====================================================== */
  /* GIF                                                     */
  /* ====================================================== */

  const searchGifs = async (query = gifSearch) => {
    const apiKey = import.meta.env.VITE_GIPHY_API_KEY;

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

      const trimmed = query.trim();
      const endpoint = trimmed
        ? "https://api.giphy.com/v1/gifs/search"
        : "https://api.giphy.com/v1/gifs/trending";

      const params = new URLSearchParams({
        api_key: apiKey,
        limit: "24",
        rating: "pg-13",
        lang: "pt",
      });

      if (trimmed) {
        params.set("q", trimmed);
      }

      const response = await fetch(`${endpoint}?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Não foi possível buscar GIFs.");
      }

      const results = Array.isArray(data?.data)
        ? data.data
            .map((gif: any) => {
              const images = gif?.images;
              const url = images?.original?.url || images?.fixed_width?.url;
              const preview = images?.fixed_width?.url || images?.original?.url;

              if (
                typeof gif?.id !== "string" ||
                typeof url !== "string" ||
                typeof preview !== "string"
              ) {
                return null;
              }

              return {
                id: gif.id,
                url,
                preview,
                title: typeof gif?.title === "string" ? gif.title : "GIF",
              };
            })
            .filter(
              (
                gif: any,
              ): gif is {
                id: string;
                url: string;
                preview: string;
                title: string;
              } => Boolean(gif),
            )
        : [];

      setGifResults(results);
    } catch (err) {
      console.error("ERRO AO BUSCAR GIFS:", err);
      setGifResults([]);
      setGifError(
        err instanceof Error ? err.message : "Não foi possível buscar GIFs.",
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
  };

  const handleSelectGif = (url: string) => {
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
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      file.type !== "image/gif" &&
      !file.name.toLowerCase().endsWith(".gif")
    ) {
      setError("Escolha um arquivo GIF.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("O GIF pode ter no máximo 10 MB.");
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

        const response = await fetch("/api/auth/get-session", {
          method: "GET",
          credentials: "include",
          headers,
        });

        if (!response.ok) {
          if (!cancelled) {
            setCurrentUserId(null);
            setCurrentUserEmail(null);
            setCurrentUserName(null);
            setCurrentUserImage(null);
          }
          return;
        }

        const data = await response.json();

        if (!cancelled) {
          setCurrentUserId(
            typeof data?.user?.id === "string" ? data.user.id : null,
          );
          setCurrentUserEmail(
            typeof data?.user?.email === "string" ? data.user.email : null,
          );
          setCurrentUserName(
            typeof data?.user?.name === "string" ? data.user.name : null,
          );
          setCurrentUserImage(
            typeof data?.user?.image === "string" ? data.user.image : null,
          );
        }
      } catch (err) {
        console.error("ERRO AO CARREGAR SESSÃO:", err);
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
    if (!animeId) return;

    let cancelled = false;

    async function loadComments() {
      try {
        setLoading(true);
        setError("");

        const bearer = getBearerToken();
        const headers: Record<string, string> = {
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        };

        const response = await fetch(
          `/api/comments?animeId=${encodeURIComponent(
            animeId,
          )}&episodeId=${encodeURIComponent(episodeId)}`,
          {
            method: "GET",
            credentials: "include",
            headers,
          },
        );

        if (!response.ok) {
          throw new Error("Não foi possível carregar os comentários.");
        }

        const data = await response.json();

        if (!cancelled) {
          const loaded = Array.isArray(data.comments) ? data.comments : [];
          setComments(loaded);

          const roots = loaded.filter((c: Comment) => !c.parentId);
          const sorted = [...roots];
          if (sortBy === "highlight") {
            sorted.sort((a: Comment, b: Comment) => {
              const repliesA = loaded.filter(
                (c: Comment) => c.parentId === a.id,
              ).length;
              const repliesB = loaded.filter(
                (c: Comment) => c.parentId === b.id,
              ).length;
              const scoreA =
                (a.likes ?? 0) * 2 + repliesA - (a.dislikes ?? 0);
              const scoreB =
                (b.likes ?? 0) * 2 + repliesB - (b.dislikes ?? 0);
              if (scoreB !== scoreA) return scoreB - scoreA;
              return (
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
              );
            });
          } else if (sortBy === "recent") {
            sorted.sort(
              (a: Comment, b: Comment) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            );
          } else if (sortBy === "oldest") {
            sorted.sort(
              (a: Comment, b: Comment) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            );
          }
          setRootOrder(sorted.map((c) => c.id));

          if (typeof data.currentUserId === "string") {
            setCurrentUserId(data.currentUserId);
          } else {
            setCurrentUserId(null);
          }

          if (typeof data.isAdmin === "boolean" && data.isAdmin && currentUserEmail) {
            setCurrentUserEmail(currentUserEmail);
          }
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Não foi possível carregar os comentários.");
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
  }, [animeId, episodeId]);

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
      if (cancelled) return;

      const element = document.getElementById(`comment-${targetCommentId}`);
      if (!element) return;

      hasScrolledTargetRef.current = targetCommentId;
      setHighlightedCommentId(targetCommentId);

      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      window.setTimeout(() => {
        if (!cancelled) {
          setHighlightedCommentId(null);
        }
      }, 4000);
    };

    const firstFrame = window.requestAnimationFrame(focusComment);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrame);
    };
  }, [loading, comments, targetCommentId]);

  /* ====================================================== */
  /* ENVIAR COMENTÁRIO                                      */
  /* ====================================================== */

  const handleComment = async () => {
    const value = text.trim();

    if (!effectiveUserId) {
      setLoginOpen(true);
      return;
    }

    if (
      (!value && !commentImage && !selectedGifUrl) ||
      !animeId ||
      sending ||
      imageUploading
    ) {
      return;
    }

    try {
      setSending(true);
      setError("");

      let imageUrl: string | null = null;

      if (commentImage) {
        setImageUploading(true);
        imageUrl = await uploadCommentImage(commentImage);
      } else if (selectedGifUrl) {
        imageUrl = selectedGifUrl;
      }

      const bearer = getBearerToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      };

      const response = await fetch("/api/comments", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          animeId,
          episodeId,
          content: value,
          imageUrl,
          parentId: null,
          isSpoiler,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Não foi possível publicar o comentário.",
        );
      }

      if (data.comment) {
        setComments((current) => [data.comment, ...current]);
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

  const handleReply = async (parentId: string) => {
    const value = replyText.trim();

    if (!effectiveUserId) {
      setLoginOpen(true);
      return;
    }

    if (!value || !animeId || replySending) {
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

      const response = await fetch("/api/comments", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          animeId,
          episodeId,
          content: value,
          parentId,
          isSpoiler: replyIsSpoiler,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível publicar a resposta.");
      }

      if (data.comment) {
        setComments((current) => [...current, data.comment]);
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

  const handleReaction = async (
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

    const previousComments = [...comments];

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
            dislikes:
              reaction === "dislike" ? Math.max(0, c.dislikes - 1) : c.dislikes,
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

      const response = await fetch("/api/comments/like", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          commentId,
          reaction,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setComments(previousComments);
        if (response.status === 401) {
          setCommentsLoginOpen(true);
        }
        throw new Error(
          data?.error || "Não foi possível registrar a reação.",
        );
      }

      setComments((current) =>
        current.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                likes: Number(data.likes) || 0,
                dislikes: Number(data.dislikes) || 0,
                liked: Boolean(data.liked),
                disliked: Boolean(data.disliked),
                userReaction: data.userReaction ?? null,
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
    setModerationSuccess("");
  };

  const handleEdit = async () => {
    if (!editingComment || !editText.trim() || editSaving) {
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

      const response = await fetch("/api/comments/edit", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          commentId: editingComment.id,
          action: "edit",
          content: editText.trim(),
          isSpoiler: editIsSpoiler,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Não foi possível editar o comentário.",
        );
      }

      if (data.comment) {
        setComments((current) =>
          current.map((comment) =>
            comment.id === editingComment.id
              ? {
                  ...comment,
                  ...data.comment,
                  liked: comment.liked,
                  likes: comment.likes,
                }
              : comment,
          ),
        );
      }

      setEditingComment(null);
      setEditText("");
      setEditIsSpoiler(false);
      setModerationSuccess("Comentário editado com sucesso.");
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
    setModerationSuccess("");
  };

  const handleDelete = async () => {
    if (!deletingComment || deleteSending) {
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

      const response = await fetch("/api/comments/edit", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          commentId: deletingComment.id,
          action: "delete",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Não foi possível excluir o comentário.",
        );
      }

      setComments((current) =>
        current.filter(
          (comment) =>
            comment.id !== deletingComment.id &&
            comment.parentId !== deletingComment.id,
        ),
      );

      if (replyingId === deletingComment.id) {
        setReplyingId(null);
        setReplyText("");
        setReplyIsSpoiler(false);
      }

      setDeletingComment(null);
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

  const handleModeration = async (
    commentId: string,
    action: "spoiler" | "report" | "spam",
    reason?: ReportReason,
  ) => {
    if (moderatingId) return;

    try {
      setModeratingId(commentId);
      setError("");
      setModerationSuccess("");

      if (action === "report") {
        setReportSending(true);
      }

      const bearer = getBearerToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      };

      const response = await fetch("/api/comments/moderation", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          commentId,
          action,
          ...(reason ? { reason } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Não foi possível realizar esta ação.",
        );
      }

      if (action === "spoiler") {
        setComments((current) =>
          current.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  isSpoiler: true,
                }
              : comment,
          ),
        );
        setModerationSuccess("Comentário marcado como spoiler.");
      }

      if (action === "spam") {
        setModerationSuccess("Comentário sinalizado como spam.");
      }

      if (action === "report") {
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
      setModeratingId(null);
      setReportSending(false);
    }
  };

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
    setModerationSuccess("");
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
  /* RESPOSTAS                                               */
  /* ====================================================== */

  const repliesFor = (parentId: string) =>
    comments.filter((comment) => comment.parentId === parentId);

  /* ====================================================== */
  /* COMENTÁRIOS FILTRADOS / ORDENADOS                       */
  /* ====================================================== */

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
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    } else if (sortBy === "recent") {
      sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else if (sortBy === "oldest") {
      sorted.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
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

    for (const [id, c] of rootMap.entries()) {
      if (!seen.has(id)) {
        result.unshift(c);
      }
    }

    return result;
  }, [comments, rootOrder]);

  return (
    <section
      className={cn(
        isAnimeGeneral
          ? "mt-12"
          : "mt-10 border-t border-purple-500/20 pt-8 sm:pt-10",
      )}
    >
      <div className="grid gap-6 sm:gap-8">
        <div className="min-w-0">
          {/* =============================================== */}
          {/* CABEÇALHO CONTEXTUAL DOS COMENTÁRIOS           */}
          {/* =============================================== */}

          {isAnimeGeneral ? (
            /* Contexto 1: Página de detalhes do anime (estilo nativo Hikari) */
            <div className="border-b border-purple-500/20 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="h-6 w-1 rounded-full bg-purple-500 shrink-0" />
                    <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                      Comentários
                    </h2>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 shrink-0 tabular-nums">
                      {comments.length}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs sm:text-sm text-zinc-400">
                    Espaço para a comunidade compartilhar impressões sobre este anime.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
                  {/* Seletor compacto de ordenação: "Mais recentes ˅" */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSortDropdownOpen((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-purple-500/25 bg-purple-950/30 text-purple-200 hover:bg-purple-950/60 hover:border-purple-500/40 transition-all cursor-pointer"
                      aria-expanded={sortDropdownOpen}
                      aria-haspopup="menu"
                    >
                      <span>
                        {sortBy === "recent"
                          ? "Mais recentes"
                          : sortBy === "highlight"
                            ? "Em destaque"
                            : "Mais antigos"}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-3.5 text-purple-400 transition-transform duration-200",
                          sortDropdownOpen && "rotate-180",
                        )}
                      />
                    </button>

                    {sortDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setSortDropdownOpen(false)}
                        />
                        <div
                          role="menu"
                          className="absolute left-0 sm:left-auto sm:right-0 top-[calc(100%+6px)] z-50 min-w-[140px] overflow-hidden rounded-xl border border-purple-500/30 bg-[#121020]/95 backdrop-blur-xl p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                        >
                          {[
                            { value: "recent" as const, label: "Mais recentes" },
                            { value: "highlight" as const, label: "Em destaque" },
                            { value: "oldest" as const, label: "Mais antigos" },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setSortBy(opt.value);
                                setSortDropdownOpen(false);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between px-3 py-1.5 text-xs rounded-lg text-left transition-colors cursor-pointer",
                                sortBy === opt.value
                                  ? "bg-purple-600/30 font-semibold text-purple-200"
                                  : "text-zinc-300 hover:bg-white/5 hover:text-white",
                              )}
                            >
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Lado direito: Login OU Menu da pessoa autenticada */}
                  {!effectiveUserId ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setCommentsLoginOpen((prev) => !prev);
                          setCommentsLoginWarning(null);
                        }}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-purple-500/35 bg-purple-950/40 px-3 py-1 text-xs sm:text-sm font-semibold text-purple-300 hover:bg-purple-950/70 hover:text-white hover:border-purple-500/55 active:scale-95 transition-all shadow-sm cursor-pointer"
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
                            className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-purple-500/30 bg-[#141419]/95 backdrop-blur-xl p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
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
                                className="text-white/40 hover:text-white text-xs transition-colors p-1 cursor-pointer"
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
                                  } catch {
                                    setCommentsLoginWarning(
                                      "Erro ao iniciar login com Google.",
                                    );
                                  }
                                }}
                                className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-all cursor-pointer"
                              >
                                <svg className="size-3.5" viewBox="0 0 24 24">
                                  <path
                                    fill="currentColor"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                  />
                                  <path
                                    fill="currentColor"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                  />
                                  <path
                                    fill="currentColor"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                  />
                                  <path
                                    fill="currentColor"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                  />
                                </svg>
                                <span>Entrar com Google</span>
                              </button>

                              {/* Email / Conta Hikari */}
                              <Link
                                to="/login"
                                search={{ redirect: typeof window !== "undefined" ? window.location.pathname + window.location.search : "/" }}
                                onClick={() => setCommentsLoginOpen(false)}
                                className="w-full flex items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-purple-950/40 hover:bg-purple-950/70 px-3 py-2 text-xs font-semibold text-purple-200 transition-all text-center"
                              >
                                <LogIn className="size-3.5" />
                                <span>Entrar com Email / Hikari</span>
                              </Link>
                            </div>

                            {commentsLoginWarning && (
                              <div className="mt-2.5 rounded-lg bg-red-950/50 border border-red-500/30 p-2 text-[10px] text-red-200">
                                {commentsLoginWarning}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setUserMenuOpen((prev) => !prev)}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1.5 pr-2.5 text-xs text-white hover:bg-white/[0.08] hover:border-purple-500/40 transition-all cursor-pointer"
                      >
                        <div className="size-6 rounded-full overflow-hidden bg-purple-950/60 ring-1 ring-purple-500/30 flex items-center justify-center text-[10px] font-bold text-purple-200">
                          {effectiveUserImage ? (
                            <img
                              src={effectiveUserImage}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            (effectiveUserName || "U").charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="font-semibold max-w-[100px] truncate">
                          {effectiveUserName}
                        </span>
                        <ChevronDown className="size-3 text-white/50" />
                      </button>

                      {userMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setUserMenuOpen(false)}
                          />
                          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#141419] p-1.5 shadow-2xl backdrop-blur-md">
                            {userNick && (
                              <Link
                                to="/profile/$nick"
                                params={{ nick: userNick }}
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white hover:bg-white/10 transition-colors"
                              >
                                <UserCircle className="size-4 text-purple-400" />
                                <span>Meu Perfil</span>
                              </Link>
                            )}
                            <Link
                              to="/settings"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white hover:bg-white/10 transition-colors"
                            >
                              <Settings2 className="size-4 text-purple-400" />
                              <span>Configurações</span>
                            </Link>
                            <button
                              type="button"
                              onClick={async () => {
                                setUserMenuOpen(false);
                                try {
                                  await signOut();
                                  window.location.reload();
                                } catch {
                                  /* ignore signout error */
                                }
                              }}
                              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            >
                              <LogOut className="size-4" />
                              <span>Sair da conta</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Contexto 2: Página de reprodução (estilo compacto com contexto do episódio) */
            <div className="border-b border-purple-500/20 pb-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                    <div className="flex size-7 sm:size-8 items-center justify-center rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 shrink-0">
                      <MessageCircle className="size-3.5 sm:size-4" />
                    </div>
                    <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
                      Comentários
                    </h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 shrink-0 tabular-nums">
                      {comments.length}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    {episodeNumber && animeTitle
                      ? `Episódio ${episodeNumber} · ${animeTitle}`
                      : episodeNumber
                        ? `Episódio ${episodeNumber}`
                        : animeTitle || "Comentários deste episódio"}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
                  {/* Seletor compacto de ordenação: "Mais recentes ˅" */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSortDropdownOpen((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-purple-500/25 bg-purple-950/30 text-purple-200 hover:bg-purple-950/60 hover:border-purple-500/40 transition-all cursor-pointer"
                      aria-expanded={sortDropdownOpen}
                      aria-haspopup="menu"
                    >
                      <span>
                        {sortBy === "recent"
                          ? "Mais recentes"
                          : sortBy === "highlight"
                            ? "Em destaque"
                            : "Mais antigos"}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-3.5 text-purple-400 transition-transform duration-200",
                          sortDropdownOpen && "rotate-180",
                        )}
                      />
                    </button>

                    {sortDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setSortDropdownOpen(false)}
                        />
                        <div
                          role="menu"
                          className="absolute left-0 sm:left-auto sm:right-0 top-[calc(100%+6px)] z-50 min-w-[140px] overflow-hidden rounded-xl border border-purple-500/30 bg-[#121020]/95 backdrop-blur-xl p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                        >
                          {[
                            { value: "recent" as const, label: "Mais recentes" },
                            { value: "highlight" as const, label: "Em destaque" },
                            { value: "oldest" as const, label: "Mais antigos" },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setSortBy(opt.value);
                                setSortDropdownOpen(false);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between px-3 py-1.5 text-xs rounded-lg text-left transition-colors cursor-pointer",
                                sortBy === opt.value
                                  ? "bg-purple-600/30 font-semibold text-purple-200"
                                  : "text-zinc-300 hover:bg-white/5 hover:text-white",
                              )}
                            >
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Lado direito: Login OU Menu da pessoa autenticada */}
                  {!effectiveUserId ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setCommentsLoginOpen((prev) => !prev);
                          setCommentsLoginWarning(null);
                        }}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-purple-500/35 bg-purple-950/40 px-3 py-1 text-xs sm:text-sm font-semibold text-purple-300 hover:bg-purple-950/70 hover:text-white hover:border-purple-500/55 active:scale-95 transition-all shadow-sm cursor-pointer"
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
                            className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-purple-500/30 bg-[#141419]/95 backdrop-blur-xl p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
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
                                className="text-white/40 hover:text-white text-xs transition-colors p-1 cursor-pointer"
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
                                  } catch {
                                    setCommentsLoginWarning(
                                      "Erro ao iniciar login com Google.",
                                    );
                                  }
                                }}
                                className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-all cursor-pointer"
                              >
                                <svg className="size-3.5" viewBox="0 0 24 24">
                                  <path
                                    fill="currentColor"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                  />
                                  <path
                                    fill="currentColor"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                  />
                                  <path
                                    fill="currentColor"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                  />
                                  <path
                                    fill="currentColor"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                  />
                                </svg>
                                <span>Entrar com Google</span>
                              </button>

                              {/* Email / Conta Hikari */}
                              <Link
                                to="/login"
                                search={{ redirect: typeof window !== "undefined" ? window.location.pathname + window.location.search : "/" }}
                                onClick={() => setCommentsLoginOpen(false)}
                                className="w-full flex items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-purple-950/40 hover:bg-purple-950/70 px-3 py-2 text-xs font-semibold text-purple-200 transition-all text-center"
                              >
                                <LogIn className="size-3.5" />
                                <span>Entrar com Email / Hikari</span>
                              </Link>
                            </div>

                            {commentsLoginWarning && (
                              <div className="mt-2.5 rounded-lg bg-red-950/50 border border-red-500/30 p-2 text-[10px] text-red-200">
                                {commentsLoginWarning}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setUserMenuOpen((prev) => !prev)}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1.5 pr-2.5 text-xs text-white hover:bg-white/[0.08] hover:border-purple-500/40 transition-all cursor-pointer"
                      >
                        <div className="size-6 rounded-full overflow-hidden bg-purple-950/60 ring-1 ring-purple-500/30 flex items-center justify-center text-[10px] font-bold text-purple-200">
                          {effectiveUserImage ? (
                            <img
                              src={effectiveUserImage}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            (effectiveUserName || "U").charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="font-semibold max-w-[100px] truncate">
                          {effectiveUserName}
                        </span>
                        <ChevronDown className="size-3 text-white/50" />
                      </button>

                      {userMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setUserMenuOpen(false)}
                          />
                          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#141419] p-1.5 shadow-2xl backdrop-blur-md">
                            {userNick && (
                              <Link
                                to="/profile/$nick"
                                params={{ nick: userNick }}
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white hover:bg-white/10 transition-colors"
                              >
                                <UserCircle className="size-4 text-purple-400" />
                                <span>Meu Perfil</span>
                              </Link>
                            )}
                            <Link
                              to="/settings"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white hover:bg-white/10 transition-colors"
                            >
                              <Settings2 className="size-4 text-purple-400" />
                              <span>Configurações</span>
                            </Link>
                            <button
                              type="button"
                              onClick={async () => {
                                setUserMenuOpen(false);
                                try {
                                  await signOut();
                                  window.location.reload();
                                } catch {
                                  /* ignore signout error */
                                }
                              }}
                              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            >
                              <LogOut className="size-4" />
                              <span>Sair da conta</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        {/* =============================================== */}
        {/* FORMULÁRIO DE COMENTÁRIO PRINCIPAL               */}
        {/* =============================================== */}

        <div className="mt-4 sm:mt-5 rounded-2xl border border-purple-500/20 bg-gradient-to-b from-[#120f22]/70 to-[#0e0c18] p-3 sm:p-4 shadow-sm focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/20 transition-all">
          <div className="flex gap-2.5 sm:gap-3">
            {/* Avatar do usuário */}
            <div className="size-8 sm:size-9 shrink-0 rounded-full overflow-hidden bg-purple-950/60 ring-1 ring-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-200">
              {effectiveUserImage ? (
                <img
                  src={effectiveUserImage}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <UserCircle className="size-5 text-purple-400" />
              )}
            </div>

            {/* Textarea e controles */}
            <div className="min-w-0 flex-1">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleComment();
                  }
                }}
                rows={2}
                maxLength={2000}
                placeholder={
                  isAnimeGeneral
                    ? "Participe da conversa sobre este anime..."
                    : "Participe da conversa..."
                }
                className="w-full resize-none rounded-xl border border-white/10 bg-[#0c0c10] px-3 py-2.5 text-xs sm:text-sm text-fg outline-none placeholder:text-white/35 focus:border-purple-500/40 transition-colors"
              />

              {/* Previews de imagem/GIF anexados */}
              {(commentImagePreview || selectedGifUrl) && (
                <div className="mt-2 relative inline-block rounded-xl overflow-hidden border border-purple-500/30 bg-black/40">
                  <img
                    src={commentImagePreview || selectedGifUrl || ""}
                    alt="Anexo"
                    className="max-h-40 rounded-xl object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleRemoveImage();
                      handleRemoveGif();
                    }}
                    className="absolute top-1.5 right-1.5 size-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
                    aria-label="Remover mídia"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              {/* Dica única e discreta posicionada logo abaixo do campo de texto */}
              <p className="mt-1.5 text-[11px] text-white/40 select-none">
                Enter para enviar · Shift + Enter para quebrar linha
              </p>

              {/* Barra de Ações Inferior com controles à esquerda e botão à direita */}
              <div className="mt-2.5 flex items-center justify-between gap-2.5 pt-1">
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                  {/* Botão de Anexo de Imagem */}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleSelectImage}
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-white/60 hover:text-purple-300 transition-colors cursor-pointer"
                    title="Anexar imagem (JPG, PNG, WebP até 10MB)"
                  >
                    <ImageIcon className="size-4" />
                    <span className="hidden sm:inline">Imagem</span>
                  </button>

                  {/* Botão de GIF */}
                  <button
                    type="button"
                    onClick={openGifPicker}
                    className="flex items-center gap-1.5 text-xs text-white/60 hover:text-purple-300 transition-colors cursor-pointer"
                    title="Inserir GIF"
                  >
                    <span className="rounded border border-white/20 px-1 py-0.2 text-[10px] font-bold">
                      GIF
                    </span>
                  </button>

                  {/* Checkbox de Spoiler */}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-white/60 hover:text-white select-none">
                    <input
                      type="checkbox"
                      checked={isSpoiler}
                      onChange={(e) => setIsSpoiler(e.target.checked)}
                      className="size-3.5 rounded border-white/20 bg-[#0c0c10] text-purple-600 accent-purple-600"
                    />
                    <span>Spoiler</span>
                  </label>
                </div>

                <div className="flex items-center shrink-0 ml-auto">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleComment()}
                    disabled={
                      (!text.trim() && !commentImage && !selectedGifUrl) ||
                      sending ||
                      imageUploading
                    }
                    className="h-8 px-4 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {sending || imageUploading ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        <span>Publicando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="size-3 shrink-0" />
                        <span>Comentar</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* Mensagens de Erro ou Sucesso */}
          {error && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-950/40 p-2.5 text-xs text-red-200 flex items-center justify-between gap-2">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                className="text-red-300 hover:text-white cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {moderationSuccess && (
            <div className="mt-3 rounded-xl border border-green-500/30 bg-green-950/40 p-2.5 text-xs text-green-200 flex items-center justify-between gap-2">
              <span>{moderationSuccess}</span>
              <button
                type="button"
                onClick={() => setModerationSuccess("")}
                className="text-green-300 hover:text-white cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Toggle de Ocultar/Mostrar Imagens */}
          <div className="mt-4 flex items-center justify-end">
            <button
              type="button"
              onClick={handleToggleShowMedia}
              className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              {showMedia ? (
                <>
                  <EyeOff className="size-3.5" />
                  <span>Ocultar imagens</span>
                </>
              ) : (
                <>
                  <Eye className="size-3.5" />
                  <span>Mostrar imagens</span>
                </>
              )}
            </button>
          </div>

          {/* =============================================== */}
          {/* LISTA DE COMENTÁRIOS                             */}
          {/* =============================================== */}

          {loading ? (
            <div className="mt-8 flex flex-col items-center justify-center py-10 gap-2 text-white/50">
              <Loader2 className="size-6 animate-spin text-purple-400" />
              <span className="text-xs">Carregando comentários...</span>
            </div>
          ) : displayedRootComments.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-purple-500/15 bg-gradient-to-b from-[#120f22]/40 to-[#0e0c18] p-8 text-center sm:p-10">
              <div className="flex size-12 items-center justify-center rounded-full border border-purple-500/30 bg-purple-950/60 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                <MessageCircle className="size-6" />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold text-white">
                Nenhum comentário ainda
              </h3>
              <p className="mt-1 text-xs text-zinc-400 max-w-sm">
                Seja o primeiro a compartilhar o que achou deste anime com a comunidade do Hikari!
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3 sm:space-y-4">
              {displayedRootComments.map((root) => {
                const replies = repliesFor(root.id);
                return (
                  <div
                    key={root.id}
                    className="rounded-2xl border border-purple-500/15 bg-gradient-to-b from-[#131024]/60 to-[#0e0c18]/80 p-3 sm:p-4 shadow-sm"
                  >
                    <CommentCard
                      comment={root}
                      replyCount={replies.length}
                      replyToName={root.userName || "Usuário"}
                      isPendingReaction={Boolean(pendingReactionIds[root.id])}
                      replyingId={replyingId}
                      replyText={replyText}
                      replyIsSpoiler={replyIsSpoiler}
                      replySending={replySending}
                      formatDate={formatCommentDate}
                      onReaction={handleReaction}
                      onReplyChange={setReplyText}
                      onReplySpoilerChange={setReplyIsSpoiler}
                      onStartReply={() => {
                        setReplyingId(root.id);
                        setReplyText("");
                        setReplyIsSpoiler(false);
                      }}
                      onCancelReply={() => setReplyingId(null)}
                      onSendReply={() => void handleReply(root.id)}
                      menuOpen={menuOpenId === root.id}
                      onToggleMenu={() =>
                        setMenuOpenId(menuOpenId === root.id ? null : root.id)
                      }
                      onEdit={() => openEdit(root)}
                      onDelete={() => openDelete(root)}
                      onMarkSpoiler={() =>
                        void handleModeration(root.id, "spoiler")
                      }
                      onReport={() => openReport(root)}
                      onSpam={() => void handleModeration(root.id, "spam")}
                      moderating={moderatingId === root.id}
                      canEdit={Boolean(effectiveUserId && (effectiveUserId === root.userId || isAdmin))}
                      canReport={Boolean(!effectiveUserId || effectiveUserId !== root.userId)}
                      highlighted={highlightedCommentId === root.id}
                      showMedia={showMedia}
                      isNew={newCommentId === root.id}
                    />

                    {/* Respostas Aninhadas */}
                    {replies.length > 0 && (
                      <div className="mt-3 ml-4 sm:ml-8 space-y-2 border-l border-purple-500/20 pl-3 sm:pl-4">
                        {replies.map((reply) => (
                          <CommentCard
                            key={reply.id}
                            comment={reply}
                            replyCount={0}
                            replyToName={reply.userName || "Usuário"}
                            isPendingReaction={Boolean(
                              pendingReactionIds[reply.id],
                            )}
                            replyingId={replyingId}
                            replyText={replyText}
                            replyIsSpoiler={replyIsSpoiler}
                            replySending={replySending}
                            formatDate={formatCommentDate}
                            onReaction={handleReaction}
                            onReplyChange={setReplyText}
                            onReplySpoilerChange={setReplyIsSpoiler}
                            onStartReply={() => {
                              setReplyingId(reply.id);
                              setReplyText(`@${reply.userName || "Usuário"} `);
                              setReplyIsSpoiler(false);
                            }}
                            onCancelReply={() => setReplyingId(null)}
                            onSendReply={() => void handleReply(root.id)}
                            isReply
                            menuOpen={menuOpenId === reply.id}
                            onToggleMenu={() =>
                              setMenuOpenId(
                                menuOpenId === reply.id ? null : reply.id,
                              )
                            }
                            onEdit={() => openEdit(reply)}
                            onDelete={() => openDelete(reply)}
                            onMarkSpoiler={() =>
                              void handleModeration(reply.id, "spoiler")
                            }
                            onReport={() => openReport(reply)}
                            onSpam={() =>
                              void handleModeration(reply.id, "spam")
                            }
                            moderating={moderatingId === reply.id}
                            canEdit={Boolean(effectiveUserId && (effectiveUserId === reply.userId || isAdmin))}
                            canReport={Boolean(!effectiveUserId || effectiveUserId !== reply.userId)}
                            highlighted={highlightedCommentId === reply.id}
                            showMedia={showMedia}
                            isNew={newCommentId === reply.id}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de GIF */}
      {gifOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-purple-500/30 bg-[#121020] p-4 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
              <h3 className="text-sm font-bold text-white">Escolher GIF</h3>
              <button
                type="button"
                onClick={closeGifPicker}
                className="text-white/50 hover:text-white cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-white/40" />
                <input
                  ref={gifSearchInputRef}
                  value={gifSearch}
                  onChange={(e) => {
                    setGifSearch(e.target.value);
                    void searchGifs(e.target.value);
                  }}
                  placeholder="Buscar no GIPHY..."
                  className="w-full rounded-xl border border-white/10 bg-[#0c0a18] pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>

              {/* Botão para carregar arquivo GIF local */}
              <input
                ref={gifGalleryInputRef}
                type="file"
                accept="image/gif"
                className="hidden"
                onChange={handleSelectGifFromGallery}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => gifGalleryInputRef.current?.click()}
                className="rounded-xl border-white/10 text-xs text-white"
              >
                Arquivo GIF
              </Button>
            </div>

            {gifError && (
              <p className="mt-2 text-xs text-red-300">{gifError}</p>
            )}

            <div className="mt-3 flex-1 overflow-y-auto grid grid-cols-3 gap-2 min-h-48">
              {gifLoading ? (
                <div className="col-span-3 flex items-center justify-center py-10">
                  <Loader2 className="size-6 animate-spin text-purple-400" />
                </div>
              ) : gifResults.length === 0 ? (
                <div className="col-span-3 flex items-center justify-center py-10 text-xs text-white/50">
                  Nenhum GIF encontrado.
                </div>
              ) : (
                gifResults.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    onClick={() => handleSelectGif(gif.url)}
                    className="relative aspect-video rounded-lg overflow-hidden border border-white/10 hover:border-purple-500 focus:outline-none transition-all cursor-pointer"
                  >
                    <img
                      src={gif.preview}
                      alt={gif.title}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {editingComment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-purple-500/30 bg-[#121020] p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
              <h3 className="text-sm font-bold text-white">Editar comentário</h3>
              <button
                type="button"
                onClick={() => setEditingComment(null)}
                className="text-white/50 hover:text-white cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              maxLength={2000}
              className="mt-3 w-full rounded-xl border border-white/10 bg-[#0c0a18] p-3 text-xs sm:text-sm text-white outline-none focus:border-purple-500"
            />

            <div className="mt-3 flex items-center justify-between">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-white/60">
                <input
                  type="checkbox"
                  checked={editIsSpoiler}
                  onChange={(e) => setEditIsSpoiler(e.target.checked)}
                  className="size-3.5 rounded accent-purple-600"
                />
                <span>Spoiler</span>
              </label>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingComment(null)}
                  className="rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleEdit()}
                  disabled={!editText.trim() || editSaving}
                  className="rounded-xl bg-purple-600 text-xs font-semibold text-white"
                >
                  {editSaving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exclusão Padronizado */}
      <Dialog
        open={Boolean(deletingComment)}
        onOpenChange={(open) => {
          if (!open && !deleteSending) setDeletingComment(null);
        }}
      >
        <DialogContent className="border border-purple-500/30 bg-[#121020]/95 backdrop-blur-xl sm:max-w-md text-left shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-950/70 border border-red-500/40 text-red-300">
              <Trash2 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">
                Excluir comentário?
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-zinc-300">
                Esta ação é permanente e removerá o comentário e todas as respostas associadas.
              </DialogDescription>
            </div>
          </div>

          <div className="mt-5 flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingComment(null)}
              disabled={deleteSending}
              className="rounded-xl border border-white/10 bg-white/5 text-xs text-white/80 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleDelete()}
              disabled={deleteSending}
              className="rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all cursor-pointer"
            >
              {deleteSending ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Denúncia */}
      {reportingComment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-purple-500/30 bg-[#121020] p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
              <h3 className="text-sm font-bold text-white">Denunciar comentário</h3>
              <button
                type="button"
                onClick={() => setReportingComment(null)}
                className="text-white/50 hover:text-white cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="mt-3 text-xs text-zinc-300 mb-2">
              Selecione o motivo da denúncia:
            </p>

            <div className="space-y-1.5 text-xs text-white">
              {[
                { id: "spam", label: "Spam ou divulgação" },
                { id: "hate", label: "Discurso de ódio ou ofensa" },
                { id: "spoiler", label: "Spoiler não sinalizado" },
                { id: "sexual", label: "Conteúdo sexual explícito" },
                { id: "harassment", label: "Assédio ou perseguição" },
                { id: "other", label: "Outro motivo" },
              ].map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={r.id}
                    checked={reportReason === r.id}
                    onChange={() => setReportReason(r.id as ReportReason)}
                    className="accent-purple-600"
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>

            <div className="mt-4 flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReportingComment(null)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  reportingComment &&
                  reportReason &&
                  void handleModeration(
                    reportingComment.id,
                    "report",
                    reportReason as ReportReason,
                  )
                }
                disabled={!reportReason || reportSending}
                className="rounded-xl bg-purple-600 text-xs font-semibold text-white"
              >
                {reportSending ? "Enviando..." : "Enviar denúncia"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal LoginMenu Global */}
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

export function CommentCard({
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
  onSpam,
  moderating,
  canEdit,
  canReport = true,
  highlighted = false,
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
  onSpam: () => void;
  moderating: boolean;
  canEdit: boolean;
  canReport?: boolean;
  highlighted?: boolean;
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
          "rounded-xl bg-purple-500/10 p-3 border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)]",
        isNew
          ? "rounded-xl bg-purple-500/15 border border-purple-500/40 p-3 shadow-[0_0_15px_rgba(168,85,247,0.15)] transition-colors duration-1000 ease-out motion-safe:animate-in motion-safe:fade-in-50"
          : "border border-transparent transition-colors duration-500 ease-out",
      )}
    >
      {/* Topo do Comentário */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {comment.userNick ? (
            <Link
              to="/profile/$nick"
              params={{ nick: comment.userNick }}
              className="flex items-center gap-2.5 min-w-0 group/author hover:opacity-90 transition-opacity"
            >
              <div className="relative flex size-7 sm:size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1b1b22] ring-1 ring-white/10 text-xs font-semibold text-white/90 group-hover/author:ring-purple-500/50 transition-all">
                {comment.userImage ? (
                  <img
                    src={comment.userImage}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-purple-300 font-bold">
                    {(comment.userName || "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-xs sm:text-sm font-bold text-white group-hover/author:text-purple-300 truncate transition-colors">
                {comment.userName || "Usuário"}
              </span>
            </Link>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex size-7 sm:size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1b1b22] ring-1 ring-white/10 text-xs font-semibold text-white/90">
                {comment.userImage ? (
                  <img
                    src={comment.userImage}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-purple-300 font-bold">
                    {(comment.userName || "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-xs sm:text-sm font-bold text-white truncate">
                {comment.userName || "Usuário"}
              </span>
            </div>
          )}

          {/* Data */}
          <span className="text-[11px] text-white/40 shrink-0">
            {formattedDate.date} {formattedDate.time}
          </span>
        </div>

        {/* Menu 3 Pontos */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={onToggleMenu}
            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Opções do comentário"
          >
            <MoreVertical className="size-4" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={onToggleMenu} />
              <div className="absolute right-0 top-full z-40 mt-1 w-44 rounded-xl border border-white/10 bg-[#161324] p-1 shadow-2xl backdrop-blur-md">
                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onToggleMenu();
                        onEdit();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-white hover:bg-white/10 cursor-pointer"
                    >
                      <Edit3 className="size-3.5 text-purple-400" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onToggleMenu();
                        onDelete();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Excluir</span>
                    </button>
                  </>
                )}

                {canReport && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onToggleMenu();
                        onMarkSpoiler();
                      }}
                      disabled={comment.isSpoiler || moderating}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-white hover:bg-white/10 cursor-pointer disabled:opacity-50"
                    >
                      <EyeOff className="size-3.5 text-amber-400" />
                      <span>Sinalizar spoiler</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onToggleMenu();
                        onSpam();
                      }}
                      disabled={moderating}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-white hover:bg-white/10 cursor-pointer"
                    >
                      <Ban className="size-3.5 text-orange-400" />
                      <span>Sinalizar spam</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onToggleMenu();
                        onReport();
                      }}
                      disabled={moderating}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 cursor-pointer"
                    >
                      <Flag className="size-3.5" />
                      <span>Denunciar</span>
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Conteúdo do Comentário */}
      <div className="mt-2 text-xs sm:text-sm text-zinc-200 leading-relaxed pl-9 sm:pl-10">
        {comment.isSpoiler && !spoilerRevealed ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-2.5 flex items-center justify-between gap-2">
            <span className="text-xs text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>Contém spoiler</span>
            </span>
            <button
              type="button"
              onClick={() => setSpoilerRevealed(true)}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 underline cursor-pointer"
            >
              Revelar
            </button>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{comment.content}</p>
        )}

        {/* Imagem / GIF do comentário */}
        {comment.imageUrl &&
          (!comment.isSpoiler || spoilerRevealed) &&
          (showMedia || localMediaRevealed ? (
            <div className="mt-2.5 max-w-sm rounded-xl overflow-hidden border border-white/10 bg-black/40">
              <img
                src={comment.imageUrl}
                alt="Imagem anexada"
                className="max-h-64 w-auto rounded-xl object-contain"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => setLocalMediaRevealed(true)}
                className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 underline cursor-pointer"
              >
                <Eye className="size-3.5" />
                <span>Ver imagem anexada</span>
              </button>
            </div>
          ))}
      </div>

      {/* Botões de Reação (Like, Dislike, Responder) */}
      <div className="mt-2.5 flex items-center gap-2 pl-9 sm:pl-10 text-xs">
        <button
          type="button"
          onClick={() => onReaction(comment.id, "like")}
          disabled={isPendingReaction}
          className={cn(
            "group/like inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all cursor-pointer",
            comment.liked
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/45 shadow-[0_0_12px_rgba(168,85,247,0.22)]"
              : "text-white/50 hover:text-white hover:bg-white/[0.06] border border-transparent active:bg-white/[0.08]",
            isPendingReaction && "opacity-60 pointer-events-none",
          )}
          aria-label={comment.liked ? "Remover curtida" : "Curtir comentário"}
        >
          <ThumbsUp
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-200",
              comment.liked
                ? "fill-current scale-110"
                : "group-hover/like:scale-110 active:scale-90",
            )}
          />
          <span className="font-semibold tabular-nums">{comment.likes}</span>
        </button>

        <button
          type="button"
          onClick={() => onReaction(comment.id, "dislike")}
          disabled={isPendingReaction}
          className={cn(
            "group/dislike inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all cursor-pointer",
            comment.disliked
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/45 shadow-[0_0_12px_rgba(168,85,247,0.22)]"
              : "text-white/50 hover:text-white hover:bg-white/[0.06] border border-transparent active:bg-white/[0.08]",
            isPendingReaction && "opacity-60 pointer-events-none",
          )}
          aria-label={
            comment.disliked ? "Remover descurtida" : "Não curtir comentário"
          }
        >
          <ThumbsDown
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-200",
              comment.disliked
                ? "fill-current scale-110"
                : "group-hover/dislike:scale-110 active:scale-90",
            )}
          />
          <span className="font-semibold tabular-nums">{comment.dislikes}</span>
        </button>

        <button
          type="button"
          onClick={onStartReply}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-white/50 hover:text-white hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer"
        >
          <MessageCircle className="size-3.5 shrink-0" />
          <span>Responder</span>
        </button>

        {!isReply && replyCount > 0 && (
          <span className="text-[11px] text-white/40 ml-0.5">
            · {replyCount} {replyCount === 1 ? "resposta" : "respostas"}
          </span>
        )}
      </div>

      {/* Formulário de Resposta Inline */}
      {isReplying && (
        <div className="mt-3 ml-9 sm:ml-10 rounded-xl border border-purple-500/25 bg-[#121217] p-3 shadow-lg focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/20 transition-all">
          <textarea
            value={replyText}
            onChange={(e) => onReplyChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
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
            className="w-full resize-none rounded-lg border border-white/10 bg-[#0c0c10] px-3 py-2 text-xs sm:text-sm text-fg outline-none placeholder:text-white/35 focus:border-purple-500/40 transition-colors"
          />

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-white/60 hover:text-white select-none">
              <input
                type="checkbox"
                checked={replyIsSpoiler}
                onChange={(e) => onReplySpoilerChange(e.target.checked)}
                className="size-3.5 rounded border-white/20 bg-[#0c0c10] text-purple-600 accent-purple-600"
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
                className="h-7 px-3 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.25)] active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer"
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
