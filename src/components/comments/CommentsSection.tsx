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
  Loader2,
  LogIn,
  LogOut,
  MessageCircle,
  MoreVertical,
  Reply,
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
  Fragment,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
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

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePresence(open: boolean, exitMs = 140) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (prefersReducedMotion()) {
        setVisible(true);
        return;
      }
      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setVisible(true);
        });
      });
      return () => {
        window.cancelAnimationFrame(raf1);
        if (raf2) window.cancelAnimationFrame(raf2);
      };
    }

    setVisible(false);
    if (prefersReducedMotion()) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setMounted(false);
    }, exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs]);

  return { mounted, visible, closing: mounted && !open };
}

function useModalPresence<T>(value: T | null, exitMs = 150) {
  const [retained, setRetained] = useState<T | null>(value);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (value !== null) {
      setRetained(value);
      if (prefersReducedMotion()) {
        setVisible(true);
        return;
      }
      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setVisible(true);
        });
      });
      return () => {
        window.cancelAnimationFrame(raf1);
        if (raf2) window.cancelAnimationFrame(raf2);
      };
    }

    setVisible(false);
    if (prefersReducedMotion()) {
      setRetained(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setRetained(null);
    }, exitMs);
    return () => window.clearTimeout(timer);
  }, [value, exitMs]);

  return {
    data: value ?? retained,
    mounted: value !== null || retained !== null,
    visible,
    closing: value === null && retained !== null,
  };
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
  const [moderationSuccessVisible, setModerationSuccessVisible] = useState(false);
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

  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [editText, setEditText] = useState("");
  const [editIsSpoiler, setEditIsSpoiler] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  /* ====================================================== */
  /* EXCLUSÃO                                                */
  /* ====================================================== */

  const [deletingComment, setDeletingComment] = useState<Comment | null>(null);
  const [deleteSending, setDeleteSending] = useState(false);

  // Controla o bloqueio e restauração da rolagem da página quando qualquer janela estiver aberta
  const isAnyModalOpen = Boolean(
    gifOpen ||
    editingComment ||
    deletingComment ||
    reportingComment ||
    spamComment,
  );

  const sortMenu = usePresence(sortDropdownOpen, 135);
  const commentsLoginMenu = usePresence(commentsLoginOpen, 135);
  const userDropdownMenu = usePresence(userMenuOpen, 135);
  const gifModal = usePresence(gifOpen, 150);
  const editModal = useModalPresence(editingComment, 150);
  const deleteModal = useModalPresence(deletingComment, 150);
  const reportModal = useModalPresence(reportingComment, 150);
  const activeEditingComment = editingComment ?? editModal.data;
  const activeDeletingComment = deletingComment ?? deleteModal.data;
  const activeReportingComment = reportingComment ?? reportModal.data;

  useEffect(() => {
    if (!isAnyModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isAnyModalOpen]);

  // Garante a restauração da rolagem caso o componente seja desmontado
  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, []);

  const handleCancelEdit = useCallback(() => {
    if (!editSaving) {
      setEditingComment(null);
      setEditText("");
      setEditIsSpoiler(false);
      setMenuOpenId(null);
      setUserMenuOpen(false);
      setSortDropdownOpen(false);
    }
  }, [editSaving]);

  const handleCancelDelete = useCallback(() => {
    if (!deleteSending) {
      setDeletingComment(null);
      setMenuOpenId(null);
      setUserMenuOpen(false);
      setSortDropdownOpen(false);
    }
  }, [deleteSending]);

  const handleCancelReport = useCallback(() => {
    if (!reportSending) {
      setReportingComment(null);
      setReportReason("");
      setMenuOpenId(null);
      setUserMenuOpen(false);
      setSortDropdownOpen(false);
    }
  }, [reportSending]);

  // Tecla Escape para fechar menus, submenus e janelas de ações
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!editSaving && editingComment) {
          handleCancelEdit();
        }
        if (!deleteSending && deletingComment) {
          handleCancelDelete();
        }
        if (!reportSending && reportingComment) {
          handleCancelReport();
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
    return () => window.removeEventListener("keydown", handleKeyDown);
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
    gifOpen,
    handleCancelEdit,
    handleCancelDelete,
    handleCancelReport,
  ]);

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
    clearModerationSuccess();
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
      setMenuOpenId(null);
      setUserMenuOpen(false);
      setSortDropdownOpen(false);
      showModerationSuccess("Comentário editado com sucesso.");
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

      setComments((current) => {
        const toRemove = new Set<string>([deletingComment.id]);
        let added = true;
        while (added) {
          added = false;
          for (const item of current) {
            if (
              item.parentId &&
              toRemove.has(item.parentId) &&
              !toRemove.has(item.id)
            ) {
              toRemove.add(item.id);
              added = true;
            }
          }
        }
        return current.filter((comment) => !toRemove.has(comment.id));
      });

      if (replyingId === deletingComment.id) {
        setReplyingId(null);
        setReplyText("");
        setReplyIsSpoiler(false);
      }

      setDeletingComment(null);
      setMenuOpenId(null);
      setUserMenuOpen(false);
      setSortDropdownOpen(false);
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

    if (action === "spoiler" && !isAdmin) {
      setError("Apenas o administrador do Hikari pode marcar comentários como spoiler.");
      return;
    }

    try {
      setModeratingId(commentId);
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
        showModerationSuccess("Comentário marcado como spoiler.");
      }

      if (action === "spam") {
        showModerationSuccess("Comentário sinalizado como spam.");
      }

      if (action === "report") {
        showModerationSuccess(
          "Denúncia enviada. Obrigado por ajudar a manter a comunidade do Hikari segura.",
        );
      }

      setMenuOpenId(null);
      setUserMenuOpen(false);
      setSortDropdownOpen(false);
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
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-purple-500/25 bg-purple-950/30 text-purple-200 hover:bg-purple-950/60 hover:border-purple-500/40 active:[transform:scale(0.96)] touch-manipulation transition-[color,background-color,border-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none cursor-pointer"
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
                          "size-3.5 text-purple-400 transition-transform duration-150 motion-reduce:transition-none motion-reduce:transform-none",
                          sortDropdownOpen && "[transform:rotate(180deg)]",
                        )}
                      />
                    </button>

                    {sortMenu.mounted && (
                      <>
                        {sortDropdownOpen && (
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setSortDropdownOpen(false)}
                          />
                        )}
                        <div
                          role="menu"
                          className={cn(
                            "absolute left-0 sm:left-auto sm:right-0 top-[calc(100%+6px)] z-50 min-w-[140px] overflow-hidden rounded-xl border border-purple-500/30 bg-[#121020]/95 backdrop-blur-xl p-1 shadow-2xl origin-top-left sm:origin-top-right transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none",
                            sortMenu.visible
                              ? "opacity-100 [transform:translateY(0)_scale(1)]"
                              : "opacity-0 [transform:translateY(-4px)_scale(0.97)]",
                            sortMenu.closing && "pointer-events-none",
                          )}
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
                                "flex w-full items-center justify-between px-3 py-1.5 text-xs rounded-lg text-left active:[transform:scale(0.985)] touch-manipulation transition-[color,background-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none cursor-pointer",
                                sortBy === opt.value
                                  ? "bg-purple-600/30 font-semibold text-purple-200"
                                  : "text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10",
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
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-purple-500/35 bg-purple-950/40 px-3 py-1 text-xs sm:text-sm font-semibold text-purple-300 hover:bg-purple-950/70 hover:text-white hover:border-purple-500/55 active:[transform:scale(0.96)] touch-manipulation transition-[color,background-color,border-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none shadow-sm cursor-pointer"
                        aria-expanded={commentsLoginOpen}
                        aria-haspopup="dialog"
                      >
                        <LogIn className="size-3.5" />
                        <span>Entrar</span>
                      </button>

                      {commentsLoginMenu.mounted && (
                        <>
                          {commentsLoginOpen && (
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => {
                                setCommentsLoginOpen(false);
                                setCommentsLoginWarning(null);
                              }}
                            />
                          )}
                          <div
                            role="dialog"
                            aria-label="Opções de login"
                            className={cn(
                              "absolute right-0 top-[calc(100%+8px)] z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-purple-500/30 bg-[#141419]/95 backdrop-blur-xl p-3.5 shadow-2xl origin-top-right transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none",
                              commentsLoginMenu.visible
                                ? "opacity-100 [transform:translateY(0)_scale(1)]"
                                : "opacity-0 [transform:translateY(-4px)_scale(0.97)]",
                              commentsLoginMenu.closing && "pointer-events-none",
                            )}
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
                                className="rounded-md text-white/40 hover:text-white hover:bg-white/10 active:[transform:scale(0.94)] text-xs transition-[color,background-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none p-1 cursor-pointer"
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
                        aria-expanded={userMenuOpen}
                        aria-haspopup="menu"
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1.5 pr-2.5 text-xs text-white hover:bg-white/[0.08] hover:border-purple-500/40 active:[transform:scale(0.97)] touch-manipulation transition-[color,background-color,border-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none cursor-pointer"
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
                        <ChevronDown
                          className={cn(
                            "size-3 text-white/50 transition-transform duration-150 motion-reduce:transition-none motion-reduce:transform-none",
                            userMenuOpen && "[transform:rotate(180deg)]",
                          )}
                        />
                      </button>

                      {userDropdownMenu.mounted && (
                        <>
                          {userMenuOpen && (
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setUserMenuOpen(false)}
                            />
                          )}
                          <div
                            role="menu"
                            className={cn(
                              "absolute right-0 top-[calc(100%+8px)] z-50 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#141419]/95 p-1.5 shadow-2xl backdrop-blur-xl origin-top-right transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none",
                              userDropdownMenu.visible
                                ? "opacity-100 [transform:translateY(0)_scale(1)]"
                                : "opacity-0 [transform:translateY(-4px)_scale(0.97)]",
                              userDropdownMenu.closing && "pointer-events-none",
                            )}
                          >
                            {userNick && (
                              <Link
                                to="/profile/$nick"
                                params={{ nick: userNick }}
                                role="menuitem"
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white hover:bg-white/10 active:bg-white/15 active:[transform:scale(0.985)] transition-[color,background-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none"
                              >
                                <UserCircle className="size-4 text-purple-400" />
                                <span>Meu Perfil</span>
                              </Link>
                            )}
                            <Link
                              to="/settings"
                              role="menuitem"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white hover:bg-white/10 active:bg-white/15 active:[transform:scale(0.985)] transition-[color,background-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none"
                            >
                              <Settings2 className="size-4 text-purple-400" />
                              <span>Configurações</span>
                            </Link>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={async () => {
                                setUserMenuOpen(false);
                                try {
                                  await signOut();
                                  window.location.reload();
                                } catch {
                                  /* ignore signout error */
                                }
                              }}
                              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 active:bg-red-500/20 active:[transform:scale(0.985)] transition-[color,background-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none cursor-pointer"
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
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-purple-500/25 bg-purple-950/30 text-purple-200 hover:bg-purple-950/60 hover:border-purple-500/40 active:[transform:scale(0.96)] touch-manipulation transition-[color,background-color,border-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none cursor-pointer"
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
                          "size-3.5 text-purple-400 transition-transform duration-150 motion-reduce:transition-none motion-reduce:transform-none",
                          sortDropdownOpen && "[transform:rotate(180deg)]",
                        )}
                      />
                    </button>

                    {sortMenu.mounted && (
                      <>
                        {sortDropdownOpen && (
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setSortDropdownOpen(false)}
                          />
                        )}
                        <div
                          role="menu"
                          className={cn(
                            "absolute left-0 sm:left-auto sm:right-0 top-[calc(100%+6px)] z-50 min-w-[140px] overflow-hidden rounded-xl border border-purple-500/30 bg-[#121020]/95 backdrop-blur-xl p-1 shadow-2xl origin-top-left sm:origin-top-right transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none",
                            sortMenu.visible
                              ? "opacity-100 [transform:translateY(0)_scale(1)]"
                              : "opacity-0 [transform:translateY(-4px)_scale(0.97)]",
                            sortMenu.closing && "pointer-events-none",
                          )}
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
                                "flex w-full items-center justify-between px-3 py-1.5 text-xs rounded-lg text-left active:[transform:scale(0.985)] touch-manipulation transition-[color,background-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none cursor-pointer",
                                sortBy === opt.value
                                  ? "bg-purple-600/30 font-semibold text-purple-200"
                                  : "text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10",
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
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-purple-500/35 bg-purple-950/40 px-3 py-1 text-xs sm:text-sm font-semibold text-purple-300 hover:bg-purple-950/70 hover:text-white hover:border-purple-500/55 active:[transform:scale(0.96)] touch-manipulation transition-[color,background-color,border-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none shadow-sm cursor-pointer"
                        aria-expanded={commentsLoginOpen}
                        aria-haspopup="dialog"
                      >
                        <LogIn className="size-3.5" />
                        <span>Entrar</span>
                      </button>

                      {commentsLoginMenu.mounted && (
                        <>
                          {commentsLoginOpen && (
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => {
                                setCommentsLoginOpen(false);
                                setCommentsLoginWarning(null);
                              }}
                            />
                          )}
                          <div
                            role="dialog"
                            aria-label="Opções de login"
                            className={cn(
                              "absolute right-0 top-[calc(100%+8px)] z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-purple-500/30 bg-[#141419]/95 backdrop-blur-xl p-3.5 shadow-2xl origin-top-right transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none",
                              commentsLoginMenu.visible
                                ? "opacity-100 [transform:translateY(0)_scale(1)]"
                                : "opacity-0 [transform:translateY(-4px)_scale(0.97)]",
                              commentsLoginMenu.closing && "pointer-events-none",
                            )}
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
                                className="rounded-md text-white/40 hover:text-white hover:bg-white/10 active:[transform:scale(0.94)] text-xs transition-[color,background-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none p-1 cursor-pointer"
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
                        aria-expanded={userMenuOpen}
                        aria-haspopup="menu"
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1.5 pr-2.5 text-xs text-white hover:bg-white/[0.08] hover:border-purple-500/40 active:[transform:scale(0.97)] touch-manipulation transition-[color,background-color,border-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none cursor-pointer"
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
                        <ChevronDown
                          className={cn(
                            "size-3 text-white/50 transition-transform duration-150 motion-reduce:transition-none motion-reduce:transform-none",
                            userMenuOpen && "[transform:rotate(180deg)]",
                          )}
                        />
                      </button>

                      {userDropdownMenu.mounted && (
                        <>
                          {userMenuOpen && (
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setUserMenuOpen(false)}
                            />
                          )}
                          <div
                            role="menu"
                            className={cn(
                              "absolute right-0 top-[calc(100%+8px)] z-50 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#141419]/95 p-1.5 shadow-2xl backdrop-blur-xl origin-top-right transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none",
                              userDropdownMenu.visible
                                ? "opacity-100 [transform:translateY(0)_scale(1)]"
                                : "opacity-0 [transform:translateY(-4px)_scale(0.97)]",
                              userDropdownMenu.closing && "pointer-events-none",
                            )}
                          >
                            {userNick && (
                              <Link
                                to="/profile/$nick"
                                params={{ nick: userNick }}
                                role="menuitem"
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white hover:bg-white/10 active:bg-white/15 active:[transform:scale(0.985)] transition-[color,background-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none"
                              >
                                <UserCircle className="size-4 text-purple-400" />
                                <span>Meu Perfil</span>
                              </Link>
                            )}
                            <Link
                              to="/settings"
                              role="menuitem"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white hover:bg-white/10 active:bg-white/15 active:[transform:scale(0.985)] transition-[color,background-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none"
                            >
                              <Settings2 className="size-4 text-purple-400" />
                              <span>Configurações</span>
                            </Link>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={async () => {
                                setUserMenuOpen(false);
                                try {
                                  await signOut();
                                  window.location.reload();
                                } catch {
                                  /* ignore signout error */
                                }
                              }}
                              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 active:bg-red-500/20 active:[transform:scale(0.985)] transition-[color,background-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none cursor-pointer"
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
            <div
              role="status"
              aria-live="polite"
              className={cn(
                "mt-3 flex items-center justify-between gap-3 rounded-xl border border-purple-500/30 bg-[#161224]/90 px-4 py-3 shadow-lg shadow-purple-950/25 backdrop-blur-md transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none",
                moderationSuccessVisible
                  ? "opacity-100 [transform:translateY(0)_scale(1)]"
                  : "opacity-0 [transform:translateY(-4px)_scale(0.98)] pointer-events-none",
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[#c084fc]">
                  <CheckCircle2 className="size-3.5" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-purple-100 leading-snug">
                  {moderationSuccess}
                </span>
              </div>
              <button
                type="button"
                onClick={handleDismissSuccess}
                className="flex size-6 shrink-0 items-center justify-center rounded-lg text-purple-300/60 hover:text-white hover:bg-white/10 active:[transform:scale(0.92)] transition-[color,background-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none cursor-pointer"
                aria-label="Fechar notificação"
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
            <div className="mt-3 divide-y divide-purple-500/15 border-y border-purple-500/15">
              {displayedRootComments.map((root) => {
                const renderThreadReplies = (
                  parentComment: Comment,
                  depth = 1,
                ): React.ReactNode => {
                  const childReplies = repliesFor(parentComment.id);
                  if (childReplies.length === 0) return null;

                  return (
                    <div
                      className={cn(
                        "mt-1.5 border-l border-[#a855f7]/20 hover:border-[#a855f7]/40 space-y-2 transition-colors",
                        depth === 1
                          ? "ml-3 sm:ml-4 pl-2.5 sm:pl-3"
                          : depth <= 3
                            ? "ml-2.5 sm:ml-3.5 pl-2.5 sm:pl-3"
                            : "ml-1 sm:ml-2 pl-2 sm:pl-2.5",
                      )}
                    >
                      {childReplies.map((reply) => {
                        const mentionMatch =
                          depth === 1
                            ? reply.content.match(/^@([^\s:,]+)/)
                            : null;
                        const replyRecipient = mentionMatch
                          ? mentionMatch[1]
                          : parentComment.userName || "Usuário";

                        return (
                          <div key={reply.id}>
                            <CommentCard
                              comment={reply}
                              replyToName={replyRecipient}
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
                                setReplyText("");
                                setReplyIsSpoiler(false);
                              }}
                              onCancelReply={() => setReplyingId(null)}
                              onSendReply={() => void handleReply(reply.id)}
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
                              canEdit={Boolean(
                                effectiveUserId &&
                                  (effectiveUserId === reply.userId || isAdmin),
                              )}
                              canReport={Boolean(
                                !effectiveUserId ||
                                  effectiveUserId !== reply.userId,
                              )}
                              isAdmin={isAdmin}
                              highlighted={highlightedCommentId === reply.id}
                              showMedia={showMedia}
                              isNew={newCommentId === reply.id}
                            />
                            {renderThreadReplies(reply, depth + 1)}
                          </div>
                        );
                      })}
                    </div>
                  );
                };

                return (
                  <div
                    key={root.id}
                    className="py-2.5 sm:py-3 transition-colors"
                  >
                    <CommentCard
                      comment={root}
                      replyToName={undefined}
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
                      isAdmin={isAdmin}
                      highlighted={highlightedCommentId === root.id}
                      showMedia={showMedia}
                      isNew={newCommentId === root.id}
                    />

                    {renderThreadReplies(root, 1)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de GIF */}
      {gifModal.mounted && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity duration-150 ease-out motion-reduce:transition-none overscroll-contain",
            gifModal.visible ? "opacity-100" : "opacity-0",
            gifModal.closing && "pointer-events-none",
          )}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeGifPicker();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Escolher GIF"
            className={cn(
              "w-full max-w-lg rounded-2xl border border-purple-500/30 bg-[#121020] p-4 shadow-2xl flex flex-col max-h-[85vh] transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none",
              gifModal.visible
                ? "opacity-100 [transform:translateY(0)_scale(1)]"
                : "opacity-0 [transform:translateY(6px)_scale(0.97)]",
            )}
          >
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
              <h3 className="text-sm font-bold text-white">Escolher GIF</h3>
              <button
                type="button"
                onClick={closeGifPicker}
                aria-label="Fechar"
                className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white active:[transform:scale(0.94)] transition-[color,background-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none cursor-pointer"
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
                  className="w-full rounded-xl border border-white/10 bg-[#0c0a18] pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-purple-500 transition-colors motion-reduce:transition-none"
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
                    className="relative aspect-video rounded-lg overflow-hidden border border-white/10 hover:border-purple-500 active:[transform:scale(0.98)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 transition-[border-color,transform] duration-150 motion-reduce:transition-none motion-reduce:transform-none cursor-pointer"
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

      {/* ================================================== */}
      {/* MODAL DE EDIÇÃO                                    */}
      {/* ================================================== */}

      {activeEditingComment && (
        <div
          className={cn(
            "fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 sm:items-center sm:p-5 backdrop-blur-md transition-opacity duration-150 ease-out motion-reduce:transition-none overscroll-contain",
            editModal.visible ? "opacity-100" : "opacity-0",
            editModal.closing && "pointer-events-none",
          )}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelEdit();
            }
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-dialog-title"
            className={cn(
              "w-full max-w-lg rounded-2xl sm:rounded-3xl border border-[#a855f7]/30 bg-gradient-to-b from-[#18142a] via-[#110e1f] to-[#0a0814] p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_35px_rgba(168,85,247,0.15)] transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transform-none motion-reduce:transition-none text-left",
              editModal.visible
                ? "opacity-100 [transform:translateY(0)_scale(1)]"
                : "opacity-0 [transform:translateY(6px)_scale(0.97)]",
            )}
          >
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-[#a855f7]/15 border border-[#a855f7]/30 text-[#c084fc] shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                  <Edit3 className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    id="edit-dialog-title"
                    className="font-display text-base sm:text-lg font-bold text-white tracking-tight"
                  >
                    Editar comentário
                  </h3>
                  <p className="mt-0.5 text-xs sm:text-sm text-zinc-400">
                    Faça as alterações desejadas no texto da sua publicação.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={editSaving}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 active:[transform:scale(0.95)] transition-[color,background-color,transform] duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]/60 cursor-pointer disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="size-4 sm:size-5" />
              </button>
            </div>

            {/* Campo de texto com contador */}
            <div className="mt-4">
              <textarea
                value={
                  editModal.closing
                    ? editText || activeEditingComment.content
                    : editText
                }
                onChange={(e) => setEditText(e.target.value)}
                rows={5}
                maxLength={2000}
                disabled={editSaving}
                placeholder="Escreva seu comentário..."
                className="w-full resize-none rounded-xl border border-white/10 bg-[#090714] p-3.5 sm:p-4 text-xs sm:text-sm text-white placeholder:text-zinc-500 outline-none focus:border-[#a855f7]/60 focus:ring-1 focus:ring-[#a855f7]/40 transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none disabled:opacity-60 shadow-inner"
              />

              <div className="mt-2.5 flex items-center justify-between text-xs text-zinc-500">
                <div>
                  {isAdmin ? (
                    <label className="flex cursor-pointer items-center gap-2 text-zinc-300 hover:text-white transition-colors motion-reduce:transition-none select-none">
                      <input
                        type="checkbox"
                        checked={editIsSpoiler}
                        onChange={(e) => setEditIsSpoiler(e.target.checked)}
                        disabled={editSaving}
                        className="size-4 rounded accent-purple-600 cursor-pointer"
                      />
                      <span className="font-medium">Marcar como spoiler</span>
                    </label>
                  ) : activeEditingComment.isSpoiler ? (
                    <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      <span>Comentário sinalizado como spoiler</span>
                    </div>
                  ) : null}
                </div>

                <span className="font-mono text-[11px] sm:text-xs tabular-nums">
                  {(editModal.closing
                    ? editText || activeEditingComment.content
                    : editText
                  ).length}{" "}
                  / 2000
                </span>
              </div>
            </div>

            {/* Ações */}
            <div className="mt-5 sm:mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={editSaving}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs sm:text-sm font-medium text-zinc-300 hover:bg-white/10 hover:text-white active:[transform:scale(0.96)] transition-[color,background-color,border-color,transform] duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]/60 cursor-pointer"
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={() => void handleEdit()}
                disabled={!editText.trim() || editSaving}
                className="rounded-xl bg-[#a855f7] hover:bg-[#9333ea] active:[transform:scale(0.96)] transition-[color,background-color,box-shadow,transform,opacity] duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]/60 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Edit3 className="size-4" />
                {editSaving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* MODAL DE EXCLUSÃO                                  */}
      {/* ================================================== */}

      {activeDeletingComment && (
        <div
          className={cn(
            "fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 sm:items-center sm:p-5 backdrop-blur-md transition-opacity duration-150 ease-out motion-reduce:transition-none overscroll-contain",
            deleteModal.visible ? "opacity-100" : "opacity-0",
            deleteModal.closing && "pointer-events-none",
          )}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelDelete();
            }
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className={cn(
              "w-full max-w-md rounded-2xl sm:rounded-3xl border border-red-500/35 bg-gradient-to-b from-[#1c1017] via-[#120a10] to-[#0a060a] p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_35px_rgba(239,68,68,0.15)] transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transform-none motion-reduce:transition-none text-left",
              deleteModal.visible
                ? "opacity-100 [transform:translateY(0)_scale(1)]"
                : "opacity-0 [transform:translateY(6px)_scale(0.97)]",
            )}
          >
            {/* Cabeçalho de Perigo */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-red-500/15 border border-red-500/35 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.25)]">
                  <Trash2 className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    id="delete-dialog-title"
                    className="font-display text-base sm:text-lg font-bold text-white tracking-tight"
                  >
                    Excluir comentário?
                  </h3>
                  <p className="mt-0.5 text-xs sm:text-sm text-zinc-400">
                    Esta ação é permanente e não poderá ser desfeita.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={deleteSending}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 active:[transform:scale(0.95)] transition-[color,background-color,transform] duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 cursor-pointer disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="size-4 sm:size-5" />
              </button>
            </div>

            {/* Pré-visualização do comentário */}
            <div className="mt-4 rounded-xl border border-red-500/20 bg-black/40 p-3 sm:p-4">
              <p className="text-[11px] sm:text-xs text-zinc-400 mb-1 font-medium">
                Conteúdo a ser removido:
              </p>
              <p className="line-clamp-4 whitespace-pre-wrap text-xs sm:text-sm text-zinc-200 italic">
                "{activeDeletingComment.content}"
              </p>
              {activeDeletingComment.imageUrl && (
                <img
                  src={activeDeletingComment.imageUrl}
                  alt=""
                  className="mt-2.5 max-h-32 rounded-lg border border-white/10 object-contain"
                />
              )}
            </div>

            {/* Ações */}
            <div className="mt-5 sm:mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelDelete}
                disabled={deleteSending}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs sm:text-sm font-medium text-zinc-300 hover:bg-white/10 hover:text-white active:[transform:scale(0.96)] transition-[color,background-color,border-color,transform] duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 cursor-pointer"
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleteSending}
                className="rounded-xl bg-red-600 hover:bg-red-500 active:[transform:scale(0.96)] transition-[color,background-color,box-shadow,transform,opacity] duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 className="size-4" />
                {deleteSending ? "Excluindo..." : "Excluir comentário"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* MODAL DE DENÚNCIA                                  */}
      {/* ================================================== */}

      {activeReportingComment && (
        <div
          className={cn(
            "fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 sm:items-center sm:p-5 backdrop-blur-md transition-opacity duration-150 ease-out motion-reduce:transition-none overscroll-contain",
            reportModal.visible ? "opacity-100" : "opacity-0",
            reportModal.closing && "pointer-events-none",
          )}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelReport();
            }
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-dialog-title"
            className={cn(
              "w-full max-w-lg rounded-2xl sm:rounded-3xl border border-[#a855f7]/30 bg-gradient-to-b from-[#18142a] via-[#110e1f] to-[#0a0814] p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_35px_rgba(168,85,247,0.15)] transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transform-none motion-reduce:transition-none text-left",
              reportModal.visible
                ? "opacity-100 [transform:translateY(0)_scale(1)]"
                : "opacity-0 [transform:translateY(6px)_scale(0.97)]",
            )}
          >
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-[#a855f7]/15 border border-[#a855f7]/30 text-[#c084fc] shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                  <Flag className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    id="report-dialog-title"
                    className="font-display text-base sm:text-lg font-bold text-white tracking-tight"
                  >
                    Denunciar comentário
                  </h3>
                  <p className="mt-0.5 text-xs sm:text-sm text-zinc-400">
                    Selecione o motivo que melhor descreve o problema com esta publicação.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancelReport}
                disabled={reportSending}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 active:[transform:scale(0.95)] transition-[color,background-color,transform] duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]/60 cursor-pointer disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="size-4 sm:size-5" />
              </button>
            </div>

            {/* Lista estruturada de motivos */}
            <div className="mt-4 space-y-2 max-h-[48vh] sm:max-h-[50vh] overflow-y-auto pr-1">
              {[
                {
                  id: "spam" as const,
                  label: "Spam ou propaganda",
                  description: "Mensagens repetitivas, links suspeitos ou promoções não autorizadas.",
                },
                {
                  id: "hate" as const,
                  label: "Discurso de ódio ou ofensa",
                  description: "Conteúdo discriminatório, preconceituoso ou agressivo.",
                },
                {
                  id: "spoiler" as const,
                  label: "Spoiler não marcado",
                  description: "Revelação de enredo ou acontecimentos cruciais sem aviso prévio.",
                },
                {
                  id: "sexual" as const,
                  label: "Conteúdo sexual ou impróprio",
                  description: "Imagens ou textos com teor explícito e inadequado para a plataforma.",
                },
                {
                  id: "harassment" as const,
                  label: "Assédio ou ameaça",
                  description: "Perseguição, intimidação, bullying ou ameaças direcionadas.",
                },
                {
                  id: "other" as const,
                  label: "Outro motivo",
                  description: "Outra violação das diretrizes de convivência da comunidade.",
                },
              ].map((r) => {
                const isSelected = reportReason === r.id;
                return (
                  <label
                    key={r.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-[color,background-color,border-color,box-shadow,transform] duration-150 select-none active:[transform:scale(0.985)] motion-reduce:transform-none motion-reduce:transition-none focus-within:ring-2 focus-within:ring-[#a855f7]/60",
                      isSelected
                        ? "border-[#a855f7] bg-[#a855f7]/15 text-white ring-1 ring-[#a855f7]/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                        : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-[#a855f7]/30 hover:bg-white/[0.06] hover:text-white active:bg-white/[0.08]",
                    )}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={r.id}
                      checked={isSelected}
                      onChange={() => setReportReason(r.id as ReportReason)}
                      className="mt-0.5 size-4 shrink-0 accent-purple-600 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs sm:text-sm font-semibold tracking-wide text-white">
                        {r.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] sm:text-xs text-zinc-400 leading-normal">
                        {r.description}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            <p className="mt-3 text-[11px] sm:text-xs text-zinc-400 leading-relaxed">
              As denúncias são confidenciais e avaliadas pela moderação para manter a comunidade do Hikari segura.
            </p>

            {/* Ações */}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelReport}
                disabled={reportSending}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs sm:text-sm font-medium text-zinc-300 hover:bg-white/10 hover:text-white active:[transform:scale(0.96)] transition-[color,background-color,border-color,transform] duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]/60 cursor-pointer"
              >
                Cancelar
              </Button>

              <Button
                type="button"
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
                className="rounded-xl bg-[#a855f7] hover:bg-[#9333ea] active:[transform:scale(0.96)] transition-[color,background-color,box-shadow,transform,opacity] duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]/60 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Flag className="size-4" />
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

type CommentTextSegment =
  | { type: "text"; content: string }
  | { type: "spoiler"; content: string };

const GENERAL_INLINE_SPOILER_SOURCE =
  "\\|\\|([\\s\\S]+?)\\|\\||<spoiler>([\\s\\S]+?)<\\/spoiler>|\\[spoiler\\]([\\s\\S]+?)\\[\\/spoiler\\]|>!([\\s\\S]+?)!<|~!([\\s\\S]+?)!~";

function parseCommentSpoilers(
  content: string,
  isWholeSpoiler: boolean,
): CommentTextSegment[] {
  if (!content) return [];

  const segments: CommentTextSegment[] = [];
  const regex = new RegExp(GENERAL_INLINE_SPOILER_SOURCE, "gi");
  let hasInlineSpoiler = false;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const spoilerBody =
      match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? "";

    if (!spoilerBody.trim()) {
      continue;
    }

    hasInlineSpoiler = true;

    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      });
    }

    segments.push({
      type: "spoiler",
      content: spoilerBody,
    });

    lastIndex = match.index + match[0].length;
  }

  if (hasInlineSpoiler) {
    if (lastIndex < content.length) {
      segments.push({
        type: "text",
        content: content.slice(lastIndex),
      });
    }
    return segments;
  }

  if (isWholeSpoiler) {
    return [{ type: "spoiler", content }];
  }

  return [{ type: "text", content }];
}

function SpoilerText({ content }: { content: string }) {
  const [revealed, setRevealed] = useState(false);

  const lines = content.split("\n");
  const isShort = content.trim().length <= 4;

  const handleReveal = (
    event:
      | ReactMouseEvent<HTMLSpanElement>
      | ReactKeyboardEvent<HTMLSpanElement>,
  ) => {
    if (revealed) return;
    event.stopPropagation();
    setRevealed(true);
  };

  return (
    <span
      role={revealed ? undefined : "button"}
      tabIndex={revealed ? undefined : 0}
      aria-expanded={revealed ? undefined : false}
      aria-label={
        revealed ? undefined : "Trecho com spoiler oculto. Toque para revelar"
      }
      title={revealed ? undefined : "Spoiler — toque para revelar"}
      onClick={revealed ? undefined : handleReveal}
      onKeyDown={
        revealed
          ? undefined
          : (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleReveal(event);
              }
            }
      }
      className={cn(
        "inline rounded-[5px] [overflow-wrap:anywhere] [-webkit-tap-highlight-color:transparent]",
        !revealed &&
          "group/spoiler cursor-pointer touch-manipulation select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc]",
      )}
    >
      <span aria-hidden={revealed ? undefined : true}>
        {lines.map((line, idx) => (
          <Fragment key={idx}>
            {line.trim().length > 0 ? (
              <span
                className={cn(
                  "box-decoration-clone [-webkit-box-decoration-break:clone] rounded-[5px] py-[1.5px] ring-1 ring-inset transition-[color,background-color,box-shadow,text-shadow] duration-150 ease-out motion-reduce:transition-none",
                  isShort ? "px-1.5 -mx-0.5" : "px-1 -mx-0.5",
                  revealed
                    ? "bg-transparent ring-transparent text-zinc-100 [text-shadow:0_0_0px_rgba(216,180,254,0)]"
                    : "bg-[#341b54]/95 ring-[#a855f7]/40 text-transparent [text-shadow:0_0_10px_rgba(216,180,254,0.24)] group-hover/spoiler:bg-[#402168] group-hover/spoiler:ring-[#c084fc]/60 group-active/spoiler:bg-[#4b277a] group-active/spoiler:ring-[#d8b4fe]/70",
                )}
              >
                {line}
              </span>
            ) : (
              line
            )}
            {idx < lines.length - 1 && <br />}
          </Fragment>
        ))}
      </span>
    </span>
  );
}

export function CommentCard({
  comment,
  replyCount: _replyCount,
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
  isAdmin = false,
  highlighted = false,
  showMedia = true,
  isNew = false,
}: {
  comment: Comment;
  replyCount?: number;
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
  isAdmin?: boolean;
  highlighted?: boolean;
  showMedia?: boolean;
  isNew?: boolean;
}) {
  const isReplying = replyingId === comment.id;
  const cardMenu = usePresence(menuOpen, 130);
  const [localMediaRevealed, setLocalMediaRevealed] = useState(false);
  const [mediaSpoilerRevealed, setMediaSpoilerRevealed] = useState(false);
  const isMediaSpoilerHidden = Boolean(
    comment.isSpoiler && !mediaSpoilerRevealed,
  );
  const formattedDate = formatDate(comment.createdAt);
  const cleanReplyToName = replyToName?.replace(/^@+/, "").trim();
  const authorName = comment.userName || "Usuário";
  const textSegments = useMemo(
    () => parseCommentSpoilers(comment.content, comment.isSpoiler),
    [comment.content, comment.isSpoiler],
  );

  useEffect(() => {
    setMediaSpoilerRevealed(false);
  }, [comment.id, comment.isSpoiler, comment.imageUrl]);

  return (
    <article
      id={`comment-${comment.id}`}
      className={cn(
        "group/comment relative motion-reduce:transition-none",
        highlighted &&
          "rounded-xl bg-purple-500/10 p-2.5 border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)] transition-colors duration-300 ease-out",
        isNew
          ? "rounded-xl bg-purple-500/15 border border-purple-500/40 p-2.5 shadow-[0_0_15px_rgba(168,85,247,0.15)] transition-colors duration-700 ease-out"
          : !highlighted &&
              "border border-transparent transition-colors duration-500 ease-out",
      )}
    >
      <div className="flex items-start gap-2 sm:gap-2.5">
        {/* Avatar alinhado ao topo */}
        {comment.userNick ? (
          <Link
            to="/profile/$nick"
            params={{ nick: comment.userNick }}
            className={cn(
              "relative mt-0.5 flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1b1b22] ring-1 ring-white/10 text-xs font-semibold text-white/90 hover:ring-purple-500/50 transition-all",
              isReply ? "size-6 sm:size-7" : "size-7 sm:size-8",
            )}
          >
            {comment.userImage ? (
              <img
                src={comment.userImage}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <span className="text-purple-300 font-bold">
                {authorName.charAt(0).toUpperCase()}
              </span>
            )}
          </Link>
        ) : (
          <div
            className={cn(
              "relative mt-0.5 flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1b1b22] ring-1 ring-white/10 text-xs font-semibold text-white/90",
              isReply ? "size-6 sm:size-7" : "size-7 sm:size-8",
            )}
          >
            {comment.userImage ? (
              <img
                src={comment.userImage}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <span className="text-purple-300 font-bold">
                {authorName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        )}

        {/* Coluna principal: Cabeçalho, Conteúdo, Ações e Resposta */}
        <div className="min-w-0 flex-1">
          {/* Topo do Comentário: Nome priorizado + etiqueta roxa na linha 1; data/hora na linha 2 */}
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">
                {comment.userNick ? (
                  <Link
                    to="/profile/$nick"
                    params={{ nick: comment.userNick }}
                    className="text-[13px] sm:text-sm font-bold text-white hover:text-purple-300 leading-tight [overflow-wrap:anywhere] transition-colors"
                  >
                    {authorName}
                  </Link>
                ) : (
                  <span className="text-[13px] sm:text-sm font-bold text-white leading-tight [overflow-wrap:anywhere]">
                    {authorName}
                  </span>
                )}

                {isReply && cleanReplyToName && (
                  <span
                    className="inline-flex max-w-full items-center gap-1 rounded-md border border-[#a855f7]/30 bg-[#a855f7]/15 px-1.5 py-0.5 text-[11px] font-medium leading-none text-[#d8b4fe]"
                    title={`Em resposta a ${cleanReplyToName}`}
                  >
                    <Reply className="size-3 shrink-0 text-[#c084fc]" />
                    <span className="truncate max-w-[140px] sm:max-w-[200px]">
                      {cleanReplyToName}
                    </span>
                  </span>
                )}
              </div>

              {(formattedDate.date || formattedDate.time) && (
                <p className="mt-0.5 text-[11px] leading-tight text-white/45 tabular-nums">
                  {formattedDate.date}
                  {formattedDate.date && formattedDate.time ? " " : ""}
                  {formattedDate.time}
                </p>
              )}
            </div>

            {/* Menu 3 Pontos */}
            <div className="relative shrink-0 -mr-1.5 -mt-1">
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
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 active:bg-purple-500/15 active:text-purple-200 touch-manipulation [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 motion-reduce:transition-none motion-reduce:transform-none disabled:opacity-50 cursor-pointer",
                  menuOpen && "bg-white/10 text-white",
                )}
              >
                <MoreVertical className="size-4" />
              </button>

              {cardMenu.mounted && (
                <>
                  {menuOpen && (
                    <div
                      className="fixed inset-0 z-30"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMenu();
                      }}
                    />
                  )}
                  <div
                    role="menu"
                    className={cn(
                      "absolute right-0 top-full z-40 mt-1 w-44 rounded-xl border border-white/10 bg-[#161324]/95 backdrop-blur-xl p-1 shadow-2xl origin-top-right transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none",
                      cardMenu.visible
                        ? "opacity-100 [transform:translateY(0)_scale(1)]"
                        : "opacity-0 [transform:translateY(-4px)_scale(0.97)]",
                      cardMenu.closing && "pointer-events-none",
                    )}
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
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-white hover:bg-purple-500/15 active:bg-purple-500/25 active:![transform:scale(0.985)] touch-manipulation motion-reduce:transition-none motion-reduce:transform-none disabled:opacity-50 cursor-pointer"
                        >
                          <Edit3 className="size-3.5 text-purple-400" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onToggleMenu();
                            onDelete();
                          }}
                          disabled={moderating}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/15 active:bg-red-500/25 active:![transform:scale(0.985)] touch-manipulation motion-reduce:transition-none motion-reduce:transform-none disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Excluir</span>
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
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 hover:bg-amber-500/15 active:bg-amber-500/25 active:![transform:scale(0.985)] touch-manipulation motion-reduce:transition-none motion-reduce:transform-none cursor-pointer disabled:opacity-50"
                      >
                        <EyeOff className="size-3.5 text-amber-400" />
                        <span>Marcar como spoiler</span>
                      </button>
                    )}

                    {canReport && (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onToggleMenu();
                            onSpam();
                          }}
                          disabled={moderating}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-white hover:bg-white/10 active:bg-white/15 active:![transform:scale(0.985)] touch-manipulation motion-reduce:transition-none motion-reduce:transform-none disabled:opacity-50 cursor-pointer"
                        >
                          <Ban className="size-3.5 text-orange-400" />
                          <span>Sinalizar spam</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onToggleMenu();
                            onReport();
                          }}
                          disabled={moderating}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/15 active:bg-red-500/25 active:![transform:scale(0.985)] touch-manipulation motion-reduce:transition-none motion-reduce:transform-none disabled:opacity-50 cursor-pointer"
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

          {/* Conteúdo do Comentário com spoiler compacto roxo */}
          <div className="mt-1 text-xs sm:text-sm text-zinc-200 leading-[1.55] break-words">
            {textSegments.length > 0 && (
              <p className="whitespace-pre-wrap break-words">
                {textSegments.map((segment, idx) =>
                  segment.type === "spoiler" ? (
                    <SpoilerText
                      key={`${comment.id}-${comment.isSpoiler}-${idx}-${segment.content}`}
                      content={segment.content}
                    />
                  ) : (
                    <Fragment key={idx}>{segment.content}</Fragment>
                  ),
                )}
              </p>
            )}

            {/* Imagem / GIF do comentário */}
            {comment.imageUrl &&
              (showMedia || localMediaRevealed ? (
                <div className={cn(textSegments.length > 0 ? "mt-2" : "mt-1")}>
                  <div
                    className={cn(
                      "relative w-fit max-w-sm rounded-xl overflow-hidden border transition-colors duration-200 motion-reduce:transition-none",
                      isMediaSpoilerHidden
                        ? "border-[#a855f7]/30 bg-[#140d22]"
                        : "border-white/10 bg-black/40",
                    )}
                  >
                    <img
                      src={comment.imageUrl}
                      alt={isMediaSpoilerHidden ? "" : "Imagem anexada"}
                      aria-hidden={isMediaSpoilerHidden ? true : undefined}
                      className={cn(
                        "block max-h-64 w-auto rounded-xl object-contain transition-[filter,transform] duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none",
                        isMediaSpoilerHidden
                          ? "blur-2xl [transform:scale(1.08)] brightness-50 saturate-75 select-none pointer-events-none"
                          : "blur-0 [transform:scale(1)] brightness-100 saturate-100",
                      )}
                      loading="lazy"
                    />
                    {comment.isSpoiler && (
                      <button
                        type="button"
                        tabIndex={isMediaSpoilerHidden ? 0 : -1}
                        aria-hidden={!isMediaSpoilerHidden ? true : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMediaSpoilerRevealed(true);
                        }}
                        aria-label="Imagem com spoiler oculto. Toque para revelar"
                        className={cn(
                          "group/imgspoiler absolute inset-0 flex items-center justify-center bg-[#26143d]/65 hover:bg-[#311a4f]/60 active:bg-[#3a1f5e]/65 active:!transform-none transition-[opacity,background-color] duration-150 ease-out motion-reduce:transition-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c084fc] [-webkit-tap-highlight-color:transparent]",
                          isMediaSpoilerHidden
                            ? "opacity-100 cursor-pointer"
                            : "opacity-0 pointer-events-none",
                        )}
                      >
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#a855f7]/35 bg-[#160d26]/85 px-2.5 py-1 text-[11px] font-medium text-[#e9d5ff] backdrop-blur-sm transition-transform duration-150 ease-out group-active/imgspoiler:[transform:scale(0.95)] motion-reduce:transition-none motion-reduce:transform-none">
                          <EyeOff className="size-3 shrink-0 text-[#c084fc]" />
                          <span>Spoiler</span>
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className={cn(textSegments.length > 0 ? "mt-2" : "mt-1")}>
                  <button
                    type="button"
                    onClick={() => setLocalMediaRevealed(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 underline motion-reduce:transition-none cursor-pointer"
                  >
                    <Eye className="size-3.5" />
                    <span>Ver imagem anexada</span>
                  </button>
                </div>
              ))}
          </div>

          {/* Botões de Reação (Like, Dislike, Responder) */}
          <div className="mt-1 -ml-1.5 flex flex-wrap items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => onReaction(comment.id, "like")}
              disabled={isPendingReaction}
              className={cn(
                "group/like inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 py-1 select-none cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 motion-reduce:transition-none motion-reduce:transform-none",
                comment.liked
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/45 shadow-[0_0_12px_rgba(168,85,247,0.22)] active:bg-purple-500/30"
                  : "text-white/50 hover:text-white hover:bg-white/[0.06] border border-transparent active:bg-purple-500/15 active:text-purple-200",
                isPendingReaction && "opacity-60 pointer-events-none",
              )}
              aria-label={comment.liked ? "Remover curtida" : "Curtir comentário"}
            >
              <ThumbsUp
                className={cn(
                  "size-3.5 shrink-0 transition-transform duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none",
                  comment.liked
                    ? "fill-current [transform:scale(1.06)]"
                    : "group-hover/like:[transform:scale(1.06)]",
                )}
              />
              <span className="font-semibold tabular-nums transition-colors duration-150 motion-reduce:transition-none">
                {comment.likes}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onReaction(comment.id, "dislike")}
              disabled={isPendingReaction}
              className={cn(
                "group/dislike inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 py-1 select-none cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 motion-reduce:transition-none motion-reduce:transform-none",
                comment.disliked
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/45 shadow-[0_0_12px_rgba(168,85,247,0.22)] active:bg-purple-500/30"
                  : "text-white/50 hover:text-white hover:bg-white/[0.06] border border-transparent active:bg-purple-500/15 active:text-purple-200",
                isPendingReaction && "opacity-60 pointer-events-none",
              )}
              aria-label={
                comment.disliked ? "Remover descurtida" : "Não curtir comentário"
              }
            >
              <ThumbsDown
                className={cn(
                  "size-3.5 shrink-0 transition-transform duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none",
                  comment.disliked
                    ? "fill-current [transform:scale(1.06)]"
                    : "group-hover/dislike:[transform:scale(1.06)]",
                )}
              />
              <span className="font-semibold tabular-nums transition-colors duration-150 motion-reduce:transition-none">
                {comment.dislikes}
              </span>
            </button>

            <button
              type="button"
              onClick={onStartReply}
              className={cn(
                "inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium select-none cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 motion-reduce:transition-none motion-reduce:transform-none",
                isReplying
                  ? "bg-purple-500/15 text-purple-200 active:bg-purple-500/25"
                  : "text-white/50 hover:text-white hover:bg-white/[0.06] active:bg-purple-500/15 active:text-purple-200",
              )}
            >
              <MessageCircle className="size-3.5 shrink-0" />
              <span>Responder</span>
            </button>
          </div>

          {/* Formulário de Resposta Inline */}
          {isReplying && (
            <div className="mt-2 rounded-xl border border-purple-500/25 bg-[#121217] p-2.5 shadow-lg focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/20 transition-all">
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
                placeholder={`Responder para @${authorName}...`}
                className="w-full resize-none rounded-lg border border-white/10 bg-[#0c0c10] px-3 py-2 text-xs sm:text-sm text-fg outline-none placeholder:text-white/35 focus:border-purple-500/40 transition-colors"
              />

              <div className="mt-2 flex items-center justify-between gap-2">
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
                    className="h-7 px-3 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.25)] motion-reduce:transition-none motion-reduce:transform-none inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="size-3 shrink-0" />
                    <span>{replySending ? "Enviando..." : "Responder"}</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
