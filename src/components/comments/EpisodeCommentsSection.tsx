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
  EyeOff,
  Flag,
  Forward,
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
/* TRANSIÇÕES DISCRETAS COM SUPORTE A REDUCED MOTION         */
/* ========================================================= */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function usePresence(open: boolean, exitMs = 135) {
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
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs]);

  return {
    mounted: open || mounted,
    visible: open && visible,
    closing: !open && mounted,
  };
}

function useModalPresence<T>(value: T | null, exitMs = 150) {
  const [cachedItem, setCachedItem] = useState<T | null>(value);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (value !== null) {
      setCachedItem(value);
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
      setCachedItem(null);
      return;
    }
    const timer = window.setTimeout(() => setCachedItem(null), exitMs);
    return () => window.clearTimeout(timer);
  }, [value, exitMs]);

  return {
    item: value ?? cachedItem,
    visible: value !== null && visible,
    closing: value === null && cachedItem !== null,
  };
}

/* ========================================================= */
/* TEMPO RELATIVO AUTOMÁTICO (SEM TIMERS DUPLICADOS)         */
/* ========================================================= */
function parseCommentDate(value: string): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hasExplicitTimezone = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(trimmed);
  const normalized =
    !hasExplicitTimezone &&
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)
      ? `${trimmed.replace(" ", "T")}Z`
      : trimmed;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatRelativeCommentTime(value: string, nowMs: number): string {
  const date = parseCommentDate(value);
  if (!date) return "";

  const publishedMs = date.getTime();
  const diffMs = nowMs - publishedMs;

  if (diffMs < 60_000) {
    return "Agora";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? "1 minuto" : `${diffMinutes} minutos`;
  }

  const diffHours = Math.floor(diffMs / 3_600_000);
  if (diffHours < 24) {
    return diffHours === 1 ? "1 hora" : `${diffHours} horas`;
  }

  const nowDate = new Date(nowMs);
  let totalMonths =
    (nowDate.getFullYear() - date.getFullYear()) * 12 +
    (nowDate.getMonth() - date.getMonth());

  if (totalMonths > 0) {
    const maxDayInNowMonth = new Date(
      nowDate.getFullYear(),
      nowDate.getMonth() + 1,
      0,
    ).getDate();
    const targetDay = Math.min(date.getDate(), maxDayInNowMonth);
    const anniversaryInCurrentMonth = new Date(
      nowDate.getFullYear(),
      nowDate.getMonth(),
      targetDay,
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds(),
    ).getTime();

    if (nowMs < anniversaryInCurrentMonth) {
      totalMonths -= 1;
    }
  }

  if (totalMonths >= 12) {
    const years = Math.floor(totalMonths / 12);
    return years === 1 ? "1 ano" : `${years} anos`;
  }

  if (totalMonths >= 1) {
    return totalMonths === 1 ? "1 mês" : `${totalMonths} meses`;
  }

  const days = Math.max(1, Math.floor(diffMs / 86_400_000));
  return days === 1 ? "1 dia" : `${days} dias`;
}

function getNextRelativeTickDelayMs(
  items: ReadonlyArray<{ createdAt: string }>,
  nowMs: number,
): number | null {
  if (items.length === 0) return null;

  let minDelayMs = 300_000;

  for (const item of items) {
    const date = parseCommentDate(item.createdAt);
    if (!date) continue;

    const elapsedMs = nowMs - date.getTime();
    let delayMs: number;

    if (elapsedMs < 0) {
      delayMs = 60_000 - elapsedMs;
    } else if (elapsedMs < 3_600_000) {
      delayMs = 60_000 - (elapsedMs % 60_000);
    } else if (elapsedMs < 86_400_000) {
      delayMs = 3_600_000 - (elapsedMs % 3_600_000);
    } else {
      delayMs = 86_400_000 - (elapsedMs % 86_400_000);
    }

    if (delayMs < minDelayMs) {
      minDelayMs = delayMs;
    }
  }

  return Math.max(1_000, minDelayMs + 80);
}

function useRelativeTimeNow(
  items: ReadonlyArray<{ createdAt: string }>,
): number {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const nowMsRef = useRef(nowMs);
  nowMsRef.current = nowMs;

  useEffect(() => {
    if (typeof window === "undefined" || items.length === 0) {
      return;
    }

    let timerId: number | null = null;

    const clearTimer = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    };

    const syncIfChanged = (forceFreshOnStale = false) => {
      const currentNow = Date.now();
      const prevNow = nowMsRef.current;
      const changed =
        (forceFreshOnStale && currentNow - prevNow > 5_000) ||
        items.some(
          (item) =>
            formatRelativeCommentTime(item.createdAt, prevNow) !==
            formatRelativeCommentTime(item.createdAt, currentNow),
        );
      if (changed) {
        nowMsRef.current = currentNow;
        setNowMs(currentNow);
      }
      return currentNow;
    };

    const scheduleNext = (referenceNow: number) => {
      clearTimer();
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      const delay = getNextRelativeTickDelayMs(items, referenceNow);
      if (delay === null) return;

      timerId = window.setTimeout(() => {
        const updatedNow = syncIfChanged(false);
        scheduleNext(updatedNow);
      }, delay);
    };

    const initialNow = syncIfChanged(true);
    scheduleNext(initialNow);

    const handleVisibilityOrFocus = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        clearTimer();
        return;
      }
      const updatedNow = syncIfChanged();
      scheduleNext(updatedNow);
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [items]);

  return nowMs;
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

  const [sortDropdownOpen, setSortDropdownOpen] =
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

  const commentsLoginMenu = usePresence(commentsLoginOpen, 135);
  const userDropdownMenu = usePresence(userMenuOpen, 135);
  const gifModal = usePresence(gifOpen, 150);
  const editModal = useModalPresence(editingComment, 150);
  const deleteModal = useModalPresence(deletingComment, 150);
  const reportModal = useModalPresence(reportingComment, 150);
  const spamModal = useModalPresence(spamComment, 150);
  const activeEditingComment = editModal.item;
  const activeDeletingComment = deleteModal.item;
  const activeReportingComment = reportModal.item;
  const activeSpamComment = spamModal.item;

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
        setUserMenuOpen(false);
        setSortDropdownOpen(false);

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

  const relativeNowMs = useRelativeTimeNow(comments);

  const formatCommentDate = (value: string) => {
    const date = parseCommentDate(value);

    if (!date) {
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
    <section className="mt-10 border-t border-[#a855f7]/20 pt-8 sm:pt-10">

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
                    className="inline-flex min-h-8 sm:min-h-9 items-center gap-1.5 rounded-xl border border-[#a855f7]/35 bg-[#a855f7]/10 px-3 py-1 text-xs sm:text-sm font-semibold text-[#c084fc] hover:bg-[#a855f7]/20 hover:text-white hover:border-[#a855f7]/55 active:bg-[#a855f7]/25 active:[transform:scale(0.97)] transition-[color,background-color,border-color,transform] duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none touch-manipulation shadow-sm cursor-pointer"
                    aria-expanded={commentsLoginOpen}
                    aria-haspopup="dialog"
                  >
                    <LogIn className="size-3.5" />
                    <span>Entrar</span>
                  </button>

                  {commentsLoginMenu.mounted && (
                    <>
                      <div
                        className={cn(
                          "fixed inset-0 z-40",
                          commentsLoginMenu.closing && "pointer-events-none",
                        )}
                        onClick={() => {
                          setCommentsLoginOpen(false);
                          setCommentsLoginWarning(null);
                        }}
                      />
                      <div
                        role="dialog"
                        aria-label="Opções de login"
                        className={cn(
                          "absolute right-0 top-[calc(100%+8px)] z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#141419]/95 backdrop-blur-xl p-3.5 shadow-2xl origin-top-right transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none",
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
                    className="inline-flex min-h-8 sm:min-h-9 items-center gap-2 rounded-xl border border-white/10 bg-[#16161b] px-2.5 py-1 text-xs sm:text-sm font-medium text-white/90 hover:border-[#a855f7]/40 hover:bg-white/[0.06] active:bg-white/[0.09] active:[transform:scale(0.97)] transition-[color,background-color,border-color,transform] duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none touch-manipulation shadow-sm max-w-[180px] sm:max-w-[240px]"
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
                        "size-3 text-white/50 shrink-0 transition-transform duration-150 motion-reduce:transition-none",
                        userMenuOpen && "rotate-180 text-[#c084fc]"
                      )}
                    />
                  </button>

                  {/* Menu da pessoa autenticada */}
                  {userDropdownMenu.mounted && (
                    <>
                      <div
                        className={cn(
                          "fixed inset-0 z-40",
                          userDropdownMenu.closing && "pointer-events-none",
                        )}
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div
                        role="menu"
                        className={cn(
                          "absolute right-0 top-[calc(100%+8px)] z-50 w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#141419]/95 backdrop-blur-xl p-1.5 shadow-2xl origin-top-right transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none",
                          userDropdownMenu.visible
                            ? "opacity-100 [transform:translateY(0)_scale(1)]"
                            : "opacity-0 [transform:translateY(-4px)_scale(0.97)]",
                          userDropdownMenu.closing && "pointer-events-none",
                        )}
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



            {gifModal.mounted && (
              <div
                className={cn(
                  "fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-5 backdrop-blur-sm transition-opacity duration-150 ease-out motion-reduce:transition-none overscroll-contain",
                  gifModal.visible ? "opacity-100" : "opacity-0",
                  gifModal.closing && "pointer-events-none",
                )}
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
                  className={cn(
                    "flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#17171a] shadow-2xl transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none",
                    gifModal.visible
                      ? "opacity-100 [transform:translateY(0)_scale(1)]"
                      : "opacity-0 [transform:translateY(6px)_scale(0.97)]",
                  )}
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
                "mt-4 flex items-center justify-between gap-3 rounded-xl border border-purple-500/30 bg-[#161224]/90 px-4 py-3 shadow-lg shadow-purple-950/25 backdrop-blur-md transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none",
                moderationSuccessVisible
                  ? "opacity-100 [transform:translateY(0)_scale(1)]"
                  : "opacity-0 [transform:translateY(-4px)_scale(0.98)] pointer-events-none",
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

          <div className="mt-4 divide-y divide-[#a855f7]/15 border-y border-[#a855f7]/15">

            {loading ? (
              <ElizabethCommentsLoading />
            ) : displayedRootComments.length ===
              0 ? (
              <div className="py-10 text-center text-sm text-white/45">
                Ainda não há comentários neste episódio.
                <br />
                Seja o primeiro a comentar!
              </div>
            ) : (
              displayedRootComments.map(
                (comment) => {
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

                  const renderThreadReplies = (
                    parentComment: Comment,
                    depth = 1,
                  ): React.ReactNode => {
                    const childReplies = repliesFor(parentComment.id);
                    if (childReplies.length === 0) return null;

                    return (
                      <div
                        className={cn(
                          "mt-2 border-l border-[#a855f7]/25 hover:border-[#a855f7]/45 space-y-2.5 transition-colors",
                          depth === 1
                            ? "ml-3.5 sm:ml-4 pl-2.5 sm:pl-3.5"
                            : depth <= 3
                              ? "ml-3 sm:ml-3.5 pl-2.5 sm:pl-3"
                              : "ml-1.5 sm:ml-2.5 pl-2 sm:pl-2.5",
                        )}
                      >
                        {childReplies.map((reply) => {
                          const isReplyAuthor = Boolean(
                            effectiveUserId &&
                              effectiveUserId === reply.userId,
                          );
                          const canEditReply = Boolean(
                            effectiveUserId && (isReplyAuthor || isAdmin),
                          );
                          const canReportReply = Boolean(!isReplyAuthor);
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
                                nowMs={relativeNowMs}
                                onReaction={handleReaction}
                                onReplyChange={setReplyText}
                                onReplySpoilerChange={setReplyIsSpoiler}
                                onStartReply={() => {
                                  if (!effectiveUserId) {
                                    setLoginOpen(true);
                                    return;
                                  }
                                  setReplyingId(reply.id);
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
                                  void handleReply(reply.id);
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
                              {renderThreadReplies(reply, depth + 1)}
                            </div>
                          );
                        })}
                      </div>
                    );
                  };

                  return (
                    <div
                      key={
                        comment.id
                      }
                      className="py-2.5 sm:py-3 transition-colors"
                    >

                      <CommentCard
                        comment={
                          comment
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
                        nowMs={
                          relativeNowMs
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

                      {renderThreadReplies(comment, 1)}

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
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]/60 cursor-pointer disabled:opacity-50"
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
                onChange={(event) => setEditText(event.target.value)}
                rows={5}
                maxLength={2000}
                disabled={editSaving}
                placeholder="Escreva seu comentário..."
                className="w-full resize-none rounded-xl border border-white/10 bg-[#090714] p-3.5 sm:p-4 text-xs sm:text-sm text-white placeholder:text-zinc-500 outline-none focus:border-[#a855f7]/60 focus:ring-1 focus:ring-[#a855f7]/40 transition-colors duration-150 motion-reduce:transition-none disabled:opacity-60 shadow-inner"
              />

              <div className="mt-2.5 flex items-center justify-between text-xs text-zinc-500">
                <div>
                  {isAdmin ? (
                    <label className="flex cursor-pointer items-center gap-2 text-zinc-300 hover:text-white transition-colors select-none">
                      <input
                        type="checkbox"
                        checked={editIsSpoiler}
                        onChange={(event) => setEditIsSpoiler(event.target.checked)}
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

                <span className="font-mono text-[11px] sm:text-xs">
                  {(editModal.closing
                    ? editText || activeEditingComment.content
                    : editText
                  ).length} / 2000
                </span>
              </div>
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <AlertTriangle className="size-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Ações */}
            <div className="mt-5 sm:mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={editSaving}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs sm:text-sm font-medium text-zinc-300 hover:bg-white/10 hover:text-white active:scale-95 transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]/60 cursor-pointer"
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={() => void handleEdit()}
                disabled={!editText.trim() || editSaving}
                className="rounded-xl bg-[#a855f7] hover:bg-[#9333ea] active:scale-95 transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]/60 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] cursor-pointer disabled:opacity-50 flex items-center gap-2"
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
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 cursor-pointer disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="size-4 sm:size-5" />
              </button>
            </div>

            {/* Pré-visualização do conteúdo do comentário */}
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

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <AlertTriangle className="size-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Ações */}
            <div className="mt-5 sm:mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelDelete}
                disabled={deleteSending}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs sm:text-sm font-medium text-zinc-300 hover:bg-white/10 hover:text-white active:scale-95 transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 cursor-pointer"
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleteSending}
                className="rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] cursor-pointer disabled:opacity-50 flex items-center gap-2"
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
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]/60 cursor-pointer disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="size-4 sm:size-5" />
              </button>
            </div>

            {/* Lista estruturada de motivos */}
            <div className="mt-4 space-y-2 max-h-[48vh] sm:max-h-[50vh] overflow-y-auto pr-1">
              {[
                {
                  value: "spam" as const,
                  label: "Spam ou propaganda",
                  description: "Mensagens repetitivas, links suspeitos ou promoções não autorizadas.",
                },
                {
                  value: "hate" as const,
                  label: "Discurso de ódio ou ofensa",
                  description: "Conteúdo discriminatório, preconceituoso ou agressivo.",
                },
                {
                  value: "spoiler" as const,
                  label: "Spoiler não marcado",
                  description: "Revelação de enredo ou acontecimentos cruciais sem aviso prévio.",
                },
                {
                  value: "sexual" as const,
                  label: "Conteúdo sexual ou impróprio",
                  description: "Imagens ou textos com teor explícito e inadequado para a plataforma.",
                },
                {
                  value: "harassment" as const,
                  label: "Assédio ou ameaça",
                  description: "Perseguição, intimidação, bullying ou ameaças direcionadas.",
                },
                {
                  value: "other" as const,
                  label: "Outro motivo",
                  description: "Outra violação das diretrizes de convivência da comunidade.",
                },
              ].map((item) => {
                const isSelected = reportReason === item.value;
                return (
                  <label
                    key={item.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-[color,background-color,border-color,box-shadow,transform] duration-150 select-none active:[transform:scale(0.985)] motion-reduce:transform-none motion-reduce:transition-none focus-within:ring-2 focus-within:ring-[#a855f7]/60",
                      isSelected
                        ? "border-[#a855f7] bg-[#a855f7]/15 text-white ring-1 ring-[#a855f7]/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                        : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-[#a855f7]/30 hover:bg-white/[0.06] hover:text-white active:bg-white/[0.08]",
                    )}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={item.value}
                      checked={isSelected}
                      onChange={() => setReportReason(item.value)}
                      className="mt-0.5 size-4 shrink-0 accent-purple-600 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs sm:text-sm font-semibold tracking-wide text-white">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] sm:text-xs text-zinc-400 leading-normal">
                        {item.description}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            <p className="mt-3 text-[11px] sm:text-xs text-zinc-400 leading-relaxed">
              As denúncias são confidenciais e avaliadas pela moderação para manter a comunidade do Hikari segura.
            </p>

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <AlertTriangle className="size-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

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
                onClick={() => {
                  if (reportingComment && reportReason) {
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
                  Boolean(moderatingId)
                }
                className="rounded-xl bg-[#a855f7] hover:bg-[#9333ea] active:[transform:scale(0.96)] transition-[color,background-color,box-shadow,transform,opacity] duration-150 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a855f7]/60 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Flag className="size-4" />
                {reportSending ? "Enviando..." : "Enviar denúncia"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* MODAL DE SPAM                                      */}
      {/* ================================================== */}

      {activeSpamComment && (
        <div
          className={cn(
            "fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 sm:items-center sm:p-5 backdrop-blur-md transition-opacity duration-150 ease-out motion-reduce:transition-none overscroll-contain",
            spamModal.visible ? "opacity-100" : "opacity-0",
            spamModal.closing && "pointer-events-none",
          )}
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
            className={cn(
              "w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-5 shadow-2xl transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transform-none motion-reduce:transition-none",
              spamModal.visible
                ? "opacity-100 [transform:translateY(0)_scale(1)]"
                : "opacity-0 [transform:translateY(6px)_scale(0.97)]",
            )}
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
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
                aria-label="Fechar"
              >
                <X className="size-5" />
              </button>

            </div>

            <div className="mt-4 rounded-lg border border-white/5 bg-surface p-3">

              <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted">
                {activeSpamComment.content}
              </p>

              {activeSpamComment.imageUrl && (
                <img
                  src={
                    activeSpamComment.imageUrl
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
                  if (spamComment) {
                    void handleModeration(
                      spamComment.id,
                      "spam",
                    );
                  }
                }}
                disabled={
                  Boolean(
                    moderatingId,
                  )
                }
              >
                <Ban className="size-4" />

                {moderatingId ===
                activeSpamComment.id
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

type CommentTextSegment =
  | { type: "text"; content: string }
  | { type: "spoiler"; content: string };

const EPISODE_INLINE_SPOILER_SOURCE =
  "\\|\\|([\\s\\S]+?)\\|\\||<spoiler>([\\s\\S]+?)<\\/spoiler>|\\[spoiler\\]([\\s\\S]+?)\\[\\/spoiler\\]|>!([\\s\\S]+?)!<|~!([\\s\\S]+?)!~";

function parseCommentSpoilers(
  content: string,
  isWholeSpoiler: boolean,
): CommentTextSegment[] {
  if (!content) return [];

  const segments: CommentTextSegment[] = [];
  const regex = new RegExp(EPISODE_INLINE_SPOILER_SOURCE, "gi");
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
      | React.MouseEvent<HTMLSpanElement>
      | React.KeyboardEvent<HTMLSpanElement>,
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
          <React.Fragment key={idx}>
            {line.trim().length > 0 ? (
              <span
                className={cn(
                  "box-decoration-clone [-webkit-box-decoration-break:clone] rounded-[5px] py-[1.5px] ring-1 ring-inset transition-[color,background-color,box-shadow,text-shadow] duration-150 ease-out motion-reduce:transition-none",
                  isShort ? "px-1.5 -mx-0.5" : "px-1 -mx-0.5",
                  revealed
                    ? "bg-transparent ring-transparent text-white/90 [text-shadow:0_0_0px_rgba(216,180,254,0)]"
                    : "bg-[#341b54]/95 ring-[#a855f7]/40 text-transparent [text-shadow:0_0_10px_rgba(216,180,254,0.24)] group-hover/spoiler:bg-[#402168] group-hover/spoiler:ring-[#c084fc]/60 group-active/spoiler:bg-[#4b277a] group-active/spoiler:ring-[#d8b4fe]/70",
                )}
              >
                {line}
              </span>
            ) : (
              line
            )}
            {idx < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </span>
    </span>
  );
}

function CommentCard({
  comment,
  replyCount: _replyCount,
  replyToName,
  isPendingReaction,
  replyingId,
  replyText,
  replyIsSpoiler,
  replySending,
  formatDate,
  nowMs,
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
  replyCount?: number;
  replyToName?: string;
  isPendingReaction: boolean;
  replyingId: string | null;
  replyText: string;
  replyIsSpoiler: boolean;
  replySending: boolean;
  formatDate?: (value: string) => { date: string; time: string };
  nowMs?: number;
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
  const cardMenu = usePresence(menuOpen, 130);
  const [localMediaRevealed, setLocalMediaRevealed] = useState(false);
  const [mediaSpoilerRevealed, setMediaSpoilerRevealed] = useState(false);
  const isMediaSpoilerHidden = Boolean(
    comment.isSpoiler && !mediaSpoilerRevealed,
  );
  const parsedCreatedDate = parseCommentDate(comment.createdAt);
  const relativeTime = formatRelativeCommentTime(
    comment.createdAt,
    nowMs ?? Date.now(),
  );
  const formattedDate = formatDate
    ? formatDate(comment.createdAt)
    : { date: "", time: "" };
  const fullDateTitle = [formattedDate.date, formattedDate.time]
    .filter(Boolean)
    .join(" ");
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
          "rounded-xl bg-[#a855f7]/10 p-2.5 border border-[#a855f7]/40 shadow-[0_0_15px_rgba(168,85,247,0.15)] transition-colors duration-300 ease-out",
        isNew
          ? "rounded-xl bg-[#a855f7]/15 border border-[#a855f7]/40 p-2.5 shadow-[0_0_15px_rgba(168,85,247,0.15)] transition-colors duration-700 ease-out"
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
              "relative mt-0.5 flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#171326] ring-1 ring-[#a855f7]/25 text-xs font-semibold text-white/90 hover:ring-[#a855f7]/55 transition-colors",
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
              <span className="text-[#c084fc] font-bold">
                {authorName.charAt(0).toUpperCase()}
              </span>
            )}
          </Link>
        ) : (
          <div
            className={cn(
              "relative mt-0.5 flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#171326] ring-1 ring-[#a855f7]/25 text-xs font-semibold text-white/90",
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
              <span className="text-[#c084fc] font-bold">
                {authorName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        )}

        {/* Coluna principal: Cabeçalho, Conteúdo, Ações e Resposta */}
        <div className="min-w-0 flex-1">
          {/* Topo: Nome priorizado + etiqueta roxa de resposta na linha 1; data/hora na linha 2 */}
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">
                {comment.userNick ? (
                  <Link
                    to="/profile/$nick"
                    params={{ nick: comment.userNick }}
                    className="min-w-0 max-w-full text-[13px] sm:text-sm font-bold text-white hover:text-[#c084fc] leading-tight [overflow-wrap:anywhere] transition-colors"
                  >
                    {authorName}
                  </Link>
                ) : (
                  <span className="min-w-0 max-w-full text-[13px] sm:text-sm font-bold text-white leading-tight [overflow-wrap:anywhere]">
                    {authorName}
                  </span>
                )}

                {isReply && cleanReplyToName && (
                  <span
                    className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-[#a855f7]/30 bg-[#a855f7]/15 px-1.5 py-[2px] text-[11px] font-medium leading-tight text-[#d8b4fe]"
                    title={`Em resposta a ${cleanReplyToName}`}
                  >
                    <Forward className="size-3 shrink-0 text-[#c084fc]" />
                    <span className="min-w-0 truncate max-w-[135px] sm:max-w-[200px]">
                      {cleanReplyToName}
                    </span>
                  </span>
                )}
              </div>

              {relativeTime && (
                <p className="mt-0.5 text-[11px] leading-tight text-white/50 tabular-nums">
                  <time
                    dateTime={
                      parsedCreatedDate
                        ? parsedCreatedDate.toISOString()
                        : undefined
                    }
                    title={fullDateTitle || undefined}
                  >
                    {relativeTime}
                  </time>
                </p>
              )}
            </div>

            {/* Menu de opções no topo direito */}
            <div className="relative shrink-0 -mt-0.5 -mr-1 sm:mr-0">
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
                  "flex size-8 items-center justify-center rounded-lg text-white/45 hover:text-white hover:bg-white/[0.08] active:bg-[#a855f7]/15 active:text-[#e9d5ff] touch-manipulation [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#a855f7] motion-reduce:transition-none motion-reduce:transform-none disabled:opacity-50 cursor-pointer",
                  menuOpen && "bg-[#a855f7]/15 text-[#e9d5ff]",
                )}
              >
                <MoreVertical className="size-4" />
              </button>

              {cardMenu.mounted && (
                <>
                  {menuOpen && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMenu();
                      }}
                    />
                  )}
                  <div
                    role="menu"
                    className={cn(
                      "absolute right-0 top-[calc(100%+4px)] z-50 w-52 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#a855f7]/25 bg-[#151221]/95 backdrop-blur-xl p-1 shadow-2xl origin-top-right transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:transform-none",
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
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-white/80 hover:bg-[#a855f7]/15 hover:text-white active:bg-[#a855f7]/25 active:![transform:scale(0.985)] touch-manipulation motion-reduce:transition-none motion-reduce:transform-none disabled:opacity-50 cursor-pointer"
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
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-300 hover:bg-red-500/15 hover:text-red-200 active:bg-red-500/25 active:![transform:scale(0.985)] touch-manipulation motion-reduce:transition-none motion-reduce:transform-none disabled:opacity-50 cursor-pointer"
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
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-amber-300 hover:bg-amber-500/15 hover:text-amber-200 active:bg-amber-500/25 active:![transform:scale(0.985)] touch-manipulation motion-reduce:transition-none motion-reduce:transform-none disabled:opacity-50 cursor-pointer"
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
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-white/80 hover:bg-[#a855f7]/15 hover:text-white active:bg-[#a855f7]/25 active:![transform:scale(0.985)] touch-manipulation motion-reduce:transition-none motion-reduce:transform-none disabled:opacity-50 cursor-pointer"
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

          <div className="mt-1 text-xs sm:text-sm text-zinc-100/90 leading-[1.55] [overflow-wrap:anywhere]">
            {textSegments.length > 0 && (
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-zinc-100/90">
                {textSegments.map((segment, idx) =>
                  segment.type === "spoiler" ? (
                    <SpoilerText
                      key={`${comment.id}-${comment.isSpoiler}-${idx}-${segment.content}`}
                      content={segment.content}
                    />
                  ) : (
                    <React.Fragment key={idx}>{segment.content}</React.Fragment>
                  ),
                )}
              </p>
            )}

            {/* Anexo de Imagem ou GIF com suporte a exibição/ocultação e proteção de spoiler */}
            {comment.imageUrl && (
              <div className={cn(textSegments.length > 0 ? "mt-2" : "mt-1")}>
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
                  <div
                    className={cn(
                      "relative w-fit max-w-full overflow-hidden rounded-xl border transition-colors duration-200 motion-reduce:transition-none",
                      isMediaSpoilerHidden
                        ? "border-[#a855f7]/30 bg-[#140d22]"
                        : "border-white/10 bg-[#0a0a0e]",
                    )}
                  >
                    <a
                      href={comment.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      tabIndex={isMediaSpoilerHidden ? -1 : undefined}
                      aria-hidden={isMediaSpoilerHidden ? true : undefined}
                      className={cn(
                        "block w-fit max-w-full",
                        isMediaSpoilerHidden
                          ? "pointer-events-none select-none"
                          : "cursor-zoom-in",
                      )}
                      aria-label="Abrir imagem em tamanho maior"
                    >
                      <img
                        src={comment.imageUrl}
                        alt={isMediaSpoilerHidden ? "" : "Imagem anexada"}
                        loading="lazy"
                        className={cn(
                          "block max-h-72 sm:max-h-80 w-auto max-w-full object-contain rounded-lg transition-[filter,transform] duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none",
                          isMediaSpoilerHidden
                            ? "blur-2xl [transform:scale(1.08)] brightness-50 saturate-75 select-none pointer-events-none"
                            : "blur-0 [transform:scale(1)] brightness-100 saturate-100",
                        )}
                      />
                    </a>
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
                    {!isMediaSpoilerHidden && !showMedia && localMediaRevealed && (
                      <div className="border-t border-white/10 bg-[#0e0e14] px-2.5 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => setLocalMediaRevealed(false)}
                          className="text-[11px] text-white/50 hover:text-white transition-colors motion-reduce:transition-none cursor-pointer"
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

          {/* =================================================== */}
          {/* AÇÕES (LIKE, DISLIKE, RESPONDER)                   */}
          {/* =================================================== */}

          <div className="mt-1 -ml-1 flex flex-wrap items-center gap-1.5 text-xs">
            {/* Botão CURTIR compacto com área de toque confortável */}
            <button
              type="button"
              onClick={() => onReaction(comment.id, "like")}
              disabled={isPendingReaction}
              className={cn(
                "group/like relative inline-flex items-center gap-1 rounded-md px-1.5 py-[3px] text-[11px] sm:text-xs font-medium leading-none select-none cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent] motion-reduce:transition-none motion-reduce:transform-none after:content-[''] after:absolute after:-inset-y-[7px] after:-inset-x-[3px]",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#a855f7]",
                comment.liked
                  ? "bg-[#a855f7]/[0.10] text-[#d8b4fe] border border-[#a855f7]/25 hover:bg-[#a855f7]/[0.15] active:bg-[#a855f7]/20"
                  : "text-white/55 hover:text-white/90 hover:bg-white/[0.05] border border-transparent active:bg-[#a855f7]/10 active:text-[#e9d5ff]",
                isPendingReaction && "opacity-60 pointer-events-none",
              )}
              aria-label={comment.liked ? "Remover curtida" : "Curtir comentário"}
            >
              <ThumbsUp
                className={cn(
                  "size-3 sm:size-[13px] shrink-0 transition-transform duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none",
                  comment.liked
                    ? "fill-current text-[#c084fc] [transform:scale(1.06)]"
                    : "group-hover/like:[transform:scale(1.06)]",
                )}
              />
              <span className="font-semibold tabular-nums leading-none transition-colors duration-150 motion-reduce:transition-none">
                {comment.likes}
              </span>
            </button>

            {/* Botão NÃO CURTIR compacto com área de toque confortável */}
            <button
              type="button"
              onClick={() => onReaction(comment.id, "dislike")}
              disabled={isPendingReaction}
              className={cn(
                "group/dislike relative inline-flex items-center gap-1 rounded-md px-1.5 py-[3px] text-[11px] sm:text-xs font-medium leading-none select-none cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent] motion-reduce:transition-none motion-reduce:transform-none after:content-[''] after:absolute after:-inset-y-[7px] after:-inset-x-[3px]",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#a855f7]",
                comment.disliked
                  ? "bg-[#a855f7]/[0.10] text-[#d8b4fe] border border-[#a855f7]/25 hover:bg-[#a855f7]/[0.15] active:bg-[#a855f7]/20"
                  : "text-white/55 hover:text-white/90 hover:bg-white/[0.05] border border-transparent active:bg-[#a855f7]/10 active:text-[#e9d5ff]",
                isPendingReaction && "opacity-60 pointer-events-none",
              )}
              aria-label={
                comment.disliked ? "Remover descurtida" : "Não curtir comentário"
              }
            >
              <ThumbsDown
                className={cn(
                  "size-3 sm:size-[13px] shrink-0 transition-transform duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none",
                  comment.disliked
                    ? "fill-current text-[#c084fc] [transform:scale(1.06)]"
                    : "group-hover/dislike:[transform:scale(1.06)]",
                )}
              />
              <span className="font-semibold tabular-nums leading-none transition-colors duration-150 motion-reduce:transition-none">
                {comment.dislikes}
              </span>
            </button>

            {/* Botão RESPONDER com feedback discreto */}
            <button
              type="button"
              onClick={onStartReply}
              className={cn(
                "inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 sm:px-2 py-1 text-xs font-medium select-none cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#a855f7] motion-reduce:transition-none motion-reduce:transform-none",
                isReplying
                  ? "bg-[#a855f7]/15 text-[#d8b4fe] border border-[#a855f7]/30 active:bg-[#a855f7]/25"
                  : "text-white/55 hover:text-white hover:bg-white/[0.06] border border-transparent active:bg-[#a855f7]/15 active:text-[#e9d5ff]",
              )}
            >
              <MessageCircle className="size-3.5 shrink-0" />
              <span>Responder</span>
            </button>
          </div>

          {/* =================================================== */}
          {/* FORMULÁRIO DE RESPOSTA INLINE                       */}
          {/* =================================================== */}

          {isReplying && (
            <div className="mt-2 rounded-xl border border-[#a855f7]/25 bg-[#120f1d] p-2.5 shadow-lg focus-within:border-[#a855f7]/50 focus-within:ring-1 focus-within:ring-[#a855f7]/20 transition-colors">
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
                placeholder={`Responder para @${authorName}...`}
                className="w-full resize-none rounded-lg border border-white/10 bg-[#0b0914] px-3 py-2 text-xs sm:text-sm text-fg outline-none placeholder:text-white/35 focus:border-[#a855f7]/45 transition-colors"
              />

              <div className="mt-2 flex items-center justify-between gap-2">
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
                    className="h-7 px-3 text-xs font-semibold rounded-lg bg-[#a855f7] hover:bg-[#9333ea] text-white shadow-[0_0_10px_rgba(168,85,247,0.25)] motion-reduce:transition-none motion-reduce:transform-none inline-flex items-center gap-1"
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



export default EpisodeCommentsSection;
