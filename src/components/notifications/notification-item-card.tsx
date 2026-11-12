import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronRight,
  Clock,
  CornerDownRight,
  EyeOff,
  Heart,
  Loader2,
  MessageCircle,
  Trash2,
  UserCheck,
  UserCircle,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getBearerToken } from "@/lib/auth/client";
import {
  acceptFollowRequest,
  rejectFollowRequest,
} from "@/lib/profile.functions";
import type { LocalAnime } from "@/lib/types";
import { cn } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;

  actorId: string | null;
  actorName: string | null;
  actorNick?: string | null;
  actorImage: string | null;

  commentId: string | null;
  animeId: string | null;
  episodeId: string | null;

  animeTitle?: string | null;
  animeCover?: string | null;
  animeSeasonNumber?: number | null;

  commentContent?: string | null;
  commentHasMedia?: boolean;
  commentIsSpoiler?: boolean;

  parentCommentId?: string | null;
  parentCommentContent?: string | null;
  parentCommentHasMedia?: boolean;
  parentCommentIsSpoiler?: boolean;
  parentCommentAuthorName?: string | null;

  commentLikes?: number;

  likeAvatars?: Array<{
    id: string;
    name: string | null;
    nick?: string | null;
    image: string | null;
  }>;

  isFollowingActor?: boolean;
  hasPendingFollowRequestToActor?: boolean;
  groupedIds?: string[];
  groupedFollowers?: Array<{
    id: string;
    name: string | null;
    nick: string | null;
    image: string | null;
  }>;
  totalFollowersCount?: number;
};

const INLINE_SPOILER_REGEX =
  /\|\|([\s\S]+?)\|\||<spoiler>([\s\S]+?)<\/spoiler>|\[spoiler\]([\s\S]+?)\[\/spoiler\]|>!([\s\S]+?)!<|~!([\s\S]+?)!~/gi;

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);

  if (diffSec < 45) return "agora";
  if (diffSec < 90) return "há 1 min";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `há ${diffDays}d`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `há ${weeks} ${weeks === 1 ? "sem." : "sem."}`;
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function extractSeasonFromTitle(title: string | null | undefined): number | null {
  if (!title) return null;
  const trimmed = title.trim();
  if (!trimmed) return null;

  const patterns = [
    /\b(?:season|temporada)\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*(?:ª|º|a|o)\s*temporada\b/i,
    /\b(\d{1,2})(?:st|nd|rd|th)\s+season\b/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const parsed = Number(match[1]);
      if (Number.isInteger(parsed) && parsed > 0 && parsed <= 50) {
        return parsed;
      }
    }
  }

  return null;
}

function parseEpisodeIdInfo(episodeId: string | null | undefined): {
  seasonNumber: number | null;
  episodeNumber: number | null;
} {
  if (!episodeId) {
    return { seasonNumber: null, episodeNumber: null };
  }

  const raw = episodeId.trim();
  if (!raw || raw === "anime") {
    return { seasonNumber: null, episodeNumber: null };
  }

  const streamMatch = raw.match(/^stream-[^-]+-(\d+)$/i);
  if (streamMatch?.[1]) {
    const idx = Number(streamMatch[1]);
    if (Number.isInteger(idx) && idx >= 0) {
      return { seasonNumber: null, episodeNumber: idx + 1 };
    }
  }

  const seasonEpMatch = raw.match(
    /(?:^|[-_])s(\d{1,2})[-_]?e(?:p)?[-_]?(\d{1,4})$/i,
  );
  if (seasonEpMatch?.[1] && seasonEpMatch?.[2]) {
    const sNum = Number(seasonEpMatch[1]);
    const eNum = Number(seasonEpMatch[2]);
    return {
      seasonNumber: Number.isInteger(sNum) && sNum > 0 ? sNum : null,
      episodeNumber: Number.isInteger(eNum) && eNum > 0 ? eNum : null,
    };
  }

  const knownEpMatch = raw.match(
    /^(?:mal-ep|kitsu-ep|ep)-.+?-(\d{1,4})$/i,
  );
  if (knownEpMatch?.[1]) {
    const eNum = Number(knownEpMatch[1]);
    if (Number.isInteger(eNum) && eNum > 0) {
      return { seasonNumber: null, episodeNumber: eNum };
    }
  }

  if (/^\d{1,4}$/.test(raw)) {
    const eNum = Number(raw);
    if (Number.isInteger(eNum) && eNum > 0) {
      return { seasonNumber: null, episodeNumber: eNum };
    }
  }

  const genericEpMatch = raw.match(/(?:^|[-_])ep(?:isodio|isode)?[-_]?(\d{1,4})$/i);
  if (genericEpMatch?.[1]) {
    const eNum = Number(genericEpMatch[1]);
    if (Number.isInteger(eNum) && eNum > 0) {
      return { seasonNumber: null, episodeNumber: eNum };
    }
  }

  return { seasonNumber: null, episodeNumber: null };
}

function formatCommentSnippet(params: {
  content?: string | null;
  hasMedia?: boolean;
  isSpoiler?: boolean;
  maxLength?: number;
}): { text: string | null; isSpoilerMasked: boolean } {
  const { content, hasMedia = false, isSpoiler = false, maxLength = 120 } = params;

  if (isSpoiler) {
    return {
      text: "Comentário marcado como spoiler",
      isSpoilerMasked: true,
    };
  }

  const raw = typeof content === "string" ? content.trim() : "";
  if (!raw) {
    if (hasMedia) {
      return {
        text: "Comentário com imagem/GIF",
        isSpoilerMasked: false,
      };
    }
    return { text: null, isSpoilerMasked: false };
  }

  let hadInlineSpoiler = false;
  const sanitized = raw
    .replace(INLINE_SPOILER_REGEX, () => {
      hadInlineSpoiler = true;
      return "[spoiler]";
    })
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) {
    return {
      text: hadInlineSpoiler
        ? "Comentário com trecho de spoiler"
        : hasMedia
          ? "Comentário com imagem/GIF"
          : null,
      isSpoilerMasked: hadInlineSpoiler,
    };
  }

  const truncated =
    sanitized.length > maxLength
      ? `${sanitized.slice(0, maxLength - 1).trimEnd()}…`
      : sanitized;

  return {
    text: truncated,
    isSpoilerMasked: false,
  };
}

function resolveNotificationMediaContext(
  notification: NotificationItem,
  localAnimes: LocalAnime[],
): {
  hasEpisodeTarget: boolean;
  hasAnimeTarget: boolean;
  hasTarget: boolean;
  animeTitle: string | null;
  animeCover: string | null;
  seasonLabel: string | null;
  episodeLabel: string | null;
} {
  const hasEpisodeTarget = Boolean(
    notification.animeId &&
      notification.episodeId &&
      notification.episodeId !== "anime",
  );

  const hasAnimeTarget = Boolean(
    notification.animeId &&
      (!notification.episodeId || notification.episodeId === "anime"),
  );

  const hasTarget = hasEpisodeTarget || hasAnimeTarget;

  const numericAnimeId = notification.animeId
    ? Number(notification.animeId)
    : Number.NaN;

  const matchedLocal = notification.animeId
    ? localAnimes.find(
        (a) =>
          a.id === notification.animeId ||
          (!Number.isNaN(numericAnimeId) &&
            numericAnimeId > 0 &&
            (a.anilistId === numericAnimeId || a.malId === numericAnimeId)),
      )
    : undefined;

  const animeTitle =
    notification.animeTitle?.trim() ||
    (matchedLocal
      ? matchedLocal.titleEnglish?.trim() ||
        matchedLocal.titleRomaji?.trim() ||
        matchedLocal.titleNative?.trim() ||
        null
      : null);

  const animeCover =
    notification.animeCover?.trim() || matchedLocal?.cover?.trim() || null;

  let seasonNumber: number | null = null;
  let customSeasonLabel: string | null = null;
  let episodeNumber: number | null = null;

  if (matchedLocal && Array.isArray(matchedLocal.seasons)) {
    if (hasEpisodeTarget && notification.episodeId) {
      for (const season of matchedLocal.seasons) {
        const foundEp = (season.episodes ?? []).find(
          (ep) =>
            ep.id === notification.episodeId ||
            String(ep.id) === String(notification.episodeId) ||
            String(ep.number) === String(notification.episodeId),
        );
        if (foundEp) {
          episodeNumber =
            typeof foundEp.number === "number" && foundEp.number > 0
              ? foundEp.number
              : null;
          if (typeof season.number === "number" && season.number > 0) {
            seasonNumber = season.number;
          } else if (season.title?.trim()) {
            customSeasonLabel = season.title.trim();
          }
          break;
        }
      }

      if (
        seasonNumber === null &&
        !customSeasonLabel &&
        matchedLocal.seasons.length === 1
      ) {
        const onlySeason = matchedLocal.seasons[0];
        if (typeof onlySeason.number === "number" && onlySeason.number > 0) {
          seasonNumber = onlySeason.number;
        } else if (onlySeason.title?.trim()) {
          customSeasonLabel = onlySeason.title.trim();
        }
      }
    }
  }

  const parsedEpInfo = parseEpisodeIdInfo(notification.episodeId);
  if (episodeNumber === null && parsedEpInfo.episodeNumber !== null) {
    episodeNumber = parsedEpInfo.episodeNumber;
  }

  if (seasonNumber === null && !customSeasonLabel) {
    if (parsedEpInfo.seasonNumber !== null) {
      seasonNumber = parsedEpInfo.seasonNumber;
    } else if (
      typeof notification.animeSeasonNumber === "number" &&
      notification.animeSeasonNumber > 0
    ) {
      seasonNumber = notification.animeSeasonNumber;
    } else {
      const fromTitle = extractSeasonFromTitle(animeTitle);
      if (fromTitle !== null) {
        seasonNumber = fromTitle;
      }
    }
  }

  const seasonLabel =
    customSeasonLabel ||
    (seasonNumber !== null && seasonNumber > 0
      ? `Temporada ${seasonNumber}`
      : null);

  const episodeLabel = hasEpisodeTarget
    ? episodeNumber !== null && episodeNumber > 0
      ? `Episódio ${episodeNumber}`
      : "Episódio"
    : null;

  return {
    hasEpisodeTarget,
    hasAnimeTarget,
    hasTarget,
    animeTitle,
    animeCover,
    seasonLabel,
    episodeLabel,
  };
}

function dispatchFocusCommentEvent(commentId: string | null | undefined) {
  if (typeof window === "undefined" || !commentId) return;
  window.dispatchEvent(
    new CustomEvent("hikari:focus-comment", {
      detail: { commentId },
    }),
  );
}

export function NotificationItemCard({
  notification,
  localAnimes,
  compact = false,
  onMarkAsRead,
  onDelete,
  onNavigate,
}: {
  notification: NotificationItem;
  localAnimes: LocalAnime[];
  compact?: boolean;
  onMarkAsRead: (id: string) => void;
  onDelete?: (id: string) => void;
  onNavigate?: () => void;
}) {
  const [isPressingAction, setIsPressingAction] = useState(false);
  const pressTimerRef = useRef<number | null>(null);

  // Estado local para botão "Seguir de volta" -> "Seguindo" / "Solicitado"
  const [isFollowing, setIsFollowing] = useState(notification.isFollowingActor ?? false);
  const [isRequested, setIsRequested] = useState(
    notification.hasPendingFollowRequestToActor ?? false,
  );
  const [followLoading, setFollowLoading] = useState(false);

  // Estado local para solicitações de perfil privado ("Aceitar" / "Recusar")
  const acceptRequestFn = useServerFn(acceptFollowRequest);
  const rejectRequestFn = useServerFn(rejectFollowRequest);
  const [requestDecision, setRequestDecision] = useState<"accepted" | "rejected" | null>(null);
  const [requestLoading, setRequestLoading] = useState<"accept" | "reject" | null>(null);

  useEffect(() => {
    setIsFollowing(notification.isFollowingActor ?? false);
  }, [notification.isFollowingActor]);

  useEffect(() => {
    setIsRequested(notification.hasPendingFollowRequestToActor ?? false);
  }, [notification.hasPendingFollowRequestToActor]);

  useEffect(() => {
    return () => {
      if (pressTimerRef.current !== null) {
        window.clearTimeout(pressTimerRef.current);
      }
    };
  }, []);

  const triggerPressFeedback = () => {
    setIsPressingAction(true);
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
    }
    pressTimerRef.current = window.setTimeout(() => {
      setIsPressingAction(false);
      pressTimerRef.current = null;
    }, 180);
  };

  const handleFollowBack = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFollowing || isRequested || followLoading || !notification.actorId) return;

    setFollowLoading(true);
    try {
      const bearer = getBearerToken();
      const res = await fetch("/api/profile/follow", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify({ targetUserId: notification.actorId }),
      });

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { status?: string };
        if (data.status === "requested") {
          setIsRequested(true);
        } else {
          setIsFollowing(true);
        }
        window.dispatchEvent(new CustomEvent("hikari:notifications-updated"));
      }
    } catch {
      // Falha não impeditiva
    } finally {
      setFollowLoading(false);
    }
  };

  const handleAcceptFollowRequest = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!notification.actorId || requestLoading || requestDecision) return;

    setRequestLoading("accept");
    try {
      await acceptRequestFn({ data: { requesterId: notification.actorId } });
      setRequestDecision("accepted");
      toast.success("Solicitação aceita.");
      window.dispatchEvent(new CustomEvent("hikari:notifications-updated"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível aceitar a solicitação.",
      );
      window.dispatchEvent(new CustomEvent("hikari:notifications-updated"));
    } finally {
      setRequestLoading(null);
    }
  };

  const handleRejectFollowRequest = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!notification.actorId || requestLoading || requestDecision) return;

    setRequestLoading("reject");
    try {
      await rejectRequestFn({ data: { requesterId: notification.actorId } });
      setRequestDecision("rejected");
      toast.info("Solicitação recusada.");
      window.dispatchEvent(new CustomEvent("hikari:notifications-updated"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível recusar a solicitação.",
      );
      window.dispatchEvent(new CustomEvent("hikari:notifications-updated"));
    } finally {
      setRequestLoading(null);
    }
  };

  const {
    hasEpisodeTarget,
    hasAnimeTarget,
    hasTarget: hasMediaTarget,
    animeTitle,
    animeCover,
    seasonLabel,
    episodeLabel,
  } = resolveNotificationMediaContext(notification, localAnimes);

  const isLikeNotification = notification.type === "comment_like";
  const isReplyNotification = notification.type === "comment_reply";
  const isGroupedFollowers =
    notification.type === "grouped_followers" ||
    (Boolean(notification.groupedFollowers) && (notification.totalFollowersCount ?? 0) >= 3);
  const isIndividualFollower =
    !isGroupedFollowers &&
    (notification.type === "new_follower" ||
      notification.type === "follow_request" ||
      notification.type === "follow_accept");
  const isCommentNotification =
    !isLikeNotification &&
    !isReplyNotification &&
    !isGroupedFollowers &&
    !isIndividualFollower &&
    (Boolean(notification.commentId) ||
      notification.type === "comment" ||
      notification.type === "mention" ||
      notification.type === "episode_comment" ||
      notification.type === "anime_comment");

  const hasTarget =
    hasMediaTarget ||
    (isIndividualFollower && Boolean(notification.actorNick)) ||
    isGroupedFollowers;

  const likeCount = Number(notification.commentLikes ?? 0) || 0;
  const likeAvatars = Array.isArray(notification.likeAvatars)
    ? notification.likeAvatars
    : [];

  const actorName = notification.actorName?.trim() || null;

  const commentSnippet = formatCommentSnippet({
    content: notification.commentContent,
    hasMedia: notification.commentHasMedia,
    isSpoiler: notification.commentIsSpoiler,
    maxLength: compact ? 95 : 150,
  });

  const parentSnippet = isReplyNotification
    ? formatCommentSnippet({
        content: notification.parentCommentContent,
        hasMedia: notification.parentCommentHasMedia,
        isSpoiler: notification.parentCommentIsSpoiler,
        maxLength: compact ? 80 : 130,
      })
    : { text: null, isSpoilerMasked: false };

  const actionLabel = notification.commentId
    ? "Ver comentário"
    : hasEpisodeTarget
      ? "Ver episódio"
      : hasAnimeTarget
        ? "Ver anime"
        : isGroupedFollowers
          ? "Ver seguidores"
          : isIndividualFollower && notification.actorNick
            ? "Ver perfil"
            : null;

  const relativeDate = formatRelativeTime(notification.createdAt);
  const fullDateTitle = (() => {
    const parsed = new Date(notification.createdAt);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString("pt-BR", {
      dateStyle: "full",
      timeStyle: "short",
    });
  })();

  const handleActivate = () => {
    triggerPressFeedback();
    onMarkAsRead(notification.id);
    if (notification.commentId) {
      dispatchFocusCommentEvent(notification.commentId);
    }
    if (isGroupedFollowers) {
      window.dispatchEvent(
        new CustomEvent("hikari:open-connections", {
          detail: { tab: "followers" },
        }),
      );
    }
    onNavigate?.();
  };

  const renderSummaryText = () => {
    // 1. Agrupamento de seguidores (3 ou mais)
    if (isGroupedFollowers) {
      const total = notification.totalFollowersCount || notification.groupedFollowers?.length || 3;
      const followers = notification.groupedFollowers || [];
      const firstNames = followers
        .slice(0, 2)
        .map((f) => f.name || (f.nick ? `@${f.nick}` : "Usuário"))
        .join(", ");
      const others = total - 2;

      return (
        <div className="space-y-0.5">
          <p className="font-semibold text-fg">
            Você tem {total} novos seguidores
          </p>
          <p className="text-[11px] text-muted leading-tight">
            {firstNames ? (
              <>
                <span className="text-fg/90">{firstNames}</span>
                {others > 0 ? ` e outras ${others} pessoas` : ""} começaram a seguir você.
              </>
            ) : (
              "Novas pessoas começaram a seguir seu perfil."
            )}
          </p>
        </div>
      );
    }

    // 2. Novo seguidor individual (1 ou 2)
    if (isIndividualFollower && actorName) {
      return (
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
            <span className="font-semibold text-fg truncate max-w-[140px] sm:max-w-[200px]">
              {actorName}
            </span>
            {notification.actorNick && (
              <span className="text-[11px] text-muted truncate max-w-[120px]">
                @{notification.actorNick}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted">
            {notification.type === "follow_request"
              ? "solicitou para seguir você"
              : notification.type === "follow_accept"
                ? "aceitou sua solicitação para seguir"
                : "começou a seguir você"}
          </p>
        </div>
      );
    }

    // 3. Curtidas (com identificação dos usuários que curtiram e agrupamento)
    if (isLikeNotification) {
      if (likeAvatars.length >= 2) {
        const name1 = likeAvatars[0].name || "Usuário";
        const name2 = likeAvatars[1].name || "Usuário";
        const others = Math.max(0, likeCount - 2);

        if (others > 0) {
          return (
            <span className="text-fg leading-snug">
              <span className="font-semibold">{name1}</span>,{" "}
              <span className="font-semibold">{name2}</span> e mais{" "}
              <span className="font-medium text-purple-300">{others} {others === 1 ? "pessoa" : "pessoas"}</span>{" "}
              curtiram seu comentário.
            </span>
          );
        }

        return (
          <span className="text-fg leading-snug">
            <span className="font-semibold">{name1}</span> e{" "}
            <span className="font-semibold">{name2}</span> curtiram seu comentário.
          </span>
        );
      }

      if (actorName) {
        if (likeCount > 1) {
          const others = likeCount - 1;
          return (
            <span className="text-fg leading-snug">
              <span className="font-semibold">{actorName}</span> e mais{" "}
              <span className="font-medium text-purple-300">{others} {others === 1 ? "pessoa" : "pessoas"}</span>{" "}
              curtiram seu comentário.
            </span>
          );
        }
        return (
          <span className="text-fg leading-snug">
            <span className="font-semibold">{actorName}</span> curtiu seu comentário.
          </span>
        );
      }
    }

    // 4. Respostas
    if (isReplyNotification && actorName) {
      return (
        <span className="text-fg leading-snug">
          <span className="font-semibold">{actorName}</span> respondeu ao seu comentário.
        </span>
      );
    }

    // 5. Comentários diretos / Menções
    if (isCommentNotification && actorName) {
      return (
        <span className="text-fg leading-snug">
          <span className="font-semibold">{actorName}</span> comentou em uma publicação.
        </span>
      );
    }

    if (actorName && notification.message.startsWith(`${actorName} `)) {
      const rest = notification.message.slice(actorName.length);
      return (
        <span className="text-fg leading-snug">
          <span className="font-semibold">{actorName}</span>
          <span className="text-fg/90">{rest}</span>
        </span>
      );
    }

    return <span className="text-fg leading-snug">{notification.message}</span>;
  };

  const showMediaMetaRow = Boolean(
    animeCover || animeTitle || seasonLabel || episodeLabel,
  );

  const innerContent = (
    <div
      className={cn(
        "relative border-b border-purple-500/10 last:border-b-0",
        compact ? "px-3 py-2.5 sm:px-3.5 sm:py-3" : "px-4 py-3.5 sm:px-5 sm:py-4",
        "motion-safe:transition-[background-color,border-color] motion-safe:duration-150 motion-reduce:transition-none",
        !notification.read
          ? "border-l-[3px] border-l-[#a855f7] bg-[#a855f7]/[0.07]"
          : "border-l-[3px] border-l-transparent opacity-95",
      )}
    >
      <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
        {/* AVATAR DO AUTOR OU PILHA DE AVATARES DE SEGUIDORES */}
        {isGroupedFollowers ? (
          <div className="relative shrink-0 pt-0.5">
            <div className="flex items-center pl-0.5">
              {(notification.groupedFollowers ?? []).slice(0, 3).map((f, i) => (
                <div
                  key={f.id}
                  className={cn(
                    "relative overflow-hidden rounded-full border border-bg bg-elevated shadow-sm ring-1 ring-purple-500/20",
                    compact ? "size-7" : "size-8",
                    i > 0 && "-ml-2.5",
                  )}
                  style={{ zIndex: 10 - i }}
                >
                  {f.image ? (
                    <img src={f.image} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-[9px] font-bold text-purple-300">
                      {(f.name || f.nick || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              ))}
              {(notification.totalFollowersCount ?? (notification.groupedFollowers?.length ?? 0)) > 3 && (
                <div
                  className={cn(
                    "relative -ml-2.5 flex items-center justify-center rounded-full border border-bg bg-purple-600/30 font-bold text-[#c084fc] shadow-sm ring-1 ring-purple-500/30",
                    compact ? "size-7 text-[9px]" : "size-8 text-[10px]",
                  )}
                  style={{ zIndex: 6 }}
                >
                  +{(notification.totalFollowersCount ?? (notification.groupedFollowers?.length ?? 0)) - 3}
                </div>
              )}
            </div>
            <span className="absolute -bottom-1 -right-0.5 flex size-4 items-center justify-center rounded-full bg-blue-500 text-white ring-2 ring-bg shadow-sm">
              <Users className="size-2.5" />
            </span>
          </div>
        ) : (
          <div className="relative shrink-0 pt-0.5">
            {notification.actorImage ? (
              <img
                src={notification.actorImage}
                alt=""
                className={cn(
                  "rounded-full object-cover ring-1 ring-white/10 shadow-sm",
                  compact ? "size-8" : "size-9 sm:size-10",
                )}
              />
            ) : (
              <div
                className={cn(
                  "flex items-center justify-center rounded-full bg-elevated text-purple-300/80 ring-1 ring-purple-500/20 shadow-sm",
                  compact ? "size-8" : "size-9 sm:size-10",
                )}
              >
                {actorName ? (
                  <span className="text-xs font-bold">{actorName.charAt(0).toUpperCase()}</span>
                ) : (
                  <UserCircle className="size-5" />
                )}
              </div>
            )}

            {/* BADGES DE TIPO */}
            {isLikeNotification && (
              <span className="absolute -bottom-1 -right-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-white ring-2 ring-bg shadow-sm">
                <Heart className="size-2.5 fill-current" />
              </span>
            )}
            {isReplyNotification && (
              <span className="absolute -bottom-1 -right-0.5 flex size-4 items-center justify-center rounded-full bg-purple-500 text-white ring-2 ring-bg shadow-sm">
                <MessageCircle className="size-2.5 fill-current" />
              </span>
            )}
            {isCommentNotification && (
              <span className="absolute -bottom-1 -right-0.5 flex size-4 items-center justify-center rounded-full bg-purple-500 text-white ring-2 ring-bg shadow-sm">
                <MessageCircle className="size-2.5" />
              </span>
            )}
            {notification.type === "new_follower" && (
              <span className="absolute -bottom-1 -right-0.5 flex size-4 items-center justify-center rounded-full bg-blue-500 text-white ring-2 ring-bg shadow-sm">
                <UserPlus className="size-2.5" />
              </span>
            )}
            {notification.type === "follow_request" && (
              <span className="absolute -bottom-1 -right-0.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-white ring-2 ring-bg shadow-sm">
                <UserPlus className="size-2.5" />
              </span>
            )}
            {notification.type === "follow_accept" && (
              <span className="absolute -bottom-1 -right-0.5 flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-bg shadow-sm">
                <UserCheck className="size-2.5" />
              </span>
            )}
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL */}
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* CABEÇALHO DO ITEM: RESUMO + BOTÃO EXCLUIR */}
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1 text-xs sm:text-[13px] leading-snug">
              {renderSummaryText()}
            </div>

            <div className="flex items-center gap-1 shrink-0 pt-0.5">
              {!notification.read && (
                <span
                  aria-label="Notificação não lida"
                  className="size-1.5 rounded-full bg-[#a855f7] shadow-[0_0_8px_rgba(168,85,247,0.8)]"
                />
              )}

              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(notification.id);
                  }}
                  className="flex size-5 items-center justify-center rounded text-muted/50 hover:bg-rose-500/15 hover:text-rose-400 transition-colors focus-visible:outline-none"
                  title="Excluir notificação"
                  aria-label="Excluir notificação"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          </div>

          {/* NOVO SEGUIDOR INDIVIDUAL: BOTÃO SEGUIR DE VOLTA */}
          {isIndividualFollower && notification.type === "new_follower" && (
            <div className="pt-0.5">
              {isFollowing ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-muted select-none">
                  <Check className="size-3 text-emerald-400" />
                  <span>Seguindo</span>
                </span>
              ) : isRequested ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-amber-300 select-none">
                  <Clock className="size-3" />
                  <span>Solicitado</span>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={followLoading}
                  onClick={handleFollowBack}
                  className="inline-flex items-center gap-1 rounded-md bg-[#a855f7] px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-white shadow-sm hover:bg-[#9333ea] active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#a855f7] cursor-pointer"
                >
                  {followLoading ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <UserPlus className="size-3" />
                  )}
                  <span>Seguir de volta</span>
                </button>
              )}
            </div>
          )}

          {/* SOLICITAÇÃO DE PERFIL PRIVADO: BOTÕES ACEITAR E RECUSAR */}
          {isIndividualFollower &&
            notification.type === "follow_request" &&
            notification.actorId && (
              <div className="pt-0.5 flex flex-wrap items-center gap-1.5">
                {requestDecision === "accepted" ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-emerald-300 select-none">
                    <Check className="size-3" />
                    <span>Solicitação aceita</span>
                  </span>
                ) : requestDecision === "rejected" ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-muted select-none">
                    <X className="size-3" />
                    <span>Solicitação recusada</span>
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={requestLoading !== null}
                      onClick={handleAcceptFollowRequest}
                      className="inline-flex items-center gap-1 rounded-md bg-[#a855f7] px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-white shadow-sm hover:bg-[#9333ea] active:scale-95 disabled:opacity-50 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#a855f7] cursor-pointer"
                    >
                      {requestLoading === "accept" ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Check className="size-3" />
                      )}
                      <span>Aceitar</span>
                    </button>
                    <button
                      type="button"
                      disabled={requestLoading !== null}
                      onClick={handleRejectFollowRequest}
                      className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-zinc-200 hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-300 active:scale-95 disabled:opacity-50 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500/50 cursor-pointer"
                    >
                      {requestLoading === "reject" ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <X className="size-3" />
                      )}
                      <span>Recusar</span>
                    </button>
                  </>
                )}
              </div>
            )}

          {/* AVATARES DE QUEM CURTIU O COMENTÁRIO */}
          {isLikeNotification && likeCount > 0 && likeAvatars.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-0.5 min-w-0">
              <div className="flex items-center pl-0.5 shrink-0">
                {likeAvatars.slice(0, 3).map((avatar, index) => (
                  <div
                    key={avatar.id}
                    className={cn(
                      "relative size-5 sm:size-6 overflow-hidden rounded-full border border-bg bg-elevated shadow-sm ring-1 ring-white/10",
                      index > 0 && "-ml-1.5 sm:-ml-2",
                    )}
                    style={{ zIndex: 10 - index }}
                    title={avatar.name || "Usuário"}
                  >
                    {avatar.image ? (
                      <img
                        src={avatar.image}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-[8px] font-bold text-muted">
                        {(avatar.name ?? "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
                {likeCount > 3 && (
                  <div
                    className="relative -ml-1.5 flex size-5 sm:size-6 items-center justify-center rounded-full border border-bg bg-rose-500/20 text-[8px] font-bold text-rose-300 ring-1 ring-rose-500/30"
                    style={{ zIndex: 5 }}
                  >
                    +{likeCount - 3}
                  </div>
                )}
              </div>

              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted">
                <Heart className="size-2.5 text-rose-400 fill-rose-400" />
                <span>{likeCount} {likeCount === 1 ? "curtida" : "curtidas"}</span>
              </span>
            </div>
          )}

          {/* TRECHO DO COMENTÁRIO CURTIDO */}
          {isLikeNotification && commentSnippet.text && (
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1.5 min-w-0">
              <span className="block text-[9px] font-semibold uppercase tracking-wider text-subtle">
                Comentário curtido
              </span>
              <p
                className={cn(
                  "mt-0.5 text-[11px] leading-snug break-words [overflow-wrap:anywhere]",
                  compact ? "line-clamp-2" : "line-clamp-3",
                  commentSnippet.isSpoilerMasked
                    ? "inline-flex items-center gap-1 italic text-muted"
                    : "text-fg/85",
                )}
              >
                {commentSnippet.isSpoilerMasked && (
                  <EyeOff className="size-3 shrink-0 text-purple-400" />
                )}
                <span>
                  {commentSnippet.isSpoilerMasked
                    ? commentSnippet.text
                    : `"${commentSnippet.text}"`}
                </span>
              </p>
            </div>
          )}

          {/* CONTEXTO DE RESPOSTA */}
          {isReplyNotification && (commentSnippet.text || parentSnippet.text) && (
            <div className="rounded-lg border border-purple-500/15 bg-elevated/50 px-2.5 py-1.5 min-w-0 space-y-1">
              {commentSnippet.text && (
                <div className="min-w-0">
                  <span className="block text-[9px] font-semibold uppercase tracking-wider text-purple-300/90">
                    Resposta recebida
                  </span>
                  <p
                    className={cn(
                      "mt-0.5 text-[11px] leading-snug break-words [overflow-wrap:anywhere]",
                      compact ? "line-clamp-2" : "line-clamp-3",
                      commentSnippet.isSpoilerMasked
                        ? "inline-flex items-center gap-1 italic text-muted"
                        : "text-fg/95",
                    )}
                  >
                    {commentSnippet.isSpoilerMasked && (
                      <EyeOff className="size-3 shrink-0 text-purple-400" />
                    )}
                    <span>
                      {commentSnippet.isSpoilerMasked
                        ? commentSnippet.text
                        : `"${commentSnippet.text}"`}
                    </span>
                  </p>
                </div>
              )}

              {parentSnippet.text && (
                <div className="border-l-2 border-purple-500/40 pl-2 min-w-0">
                  <p
                    className={cn(
                      "text-[10px] leading-tight text-muted break-words [overflow-wrap:anywhere]",
                      compact ? "line-clamp-1" : "line-clamp-2",
                    )}
                  >
                    <CornerDownRight className="mr-1 inline size-2.5 text-purple-400/80" />
                    <span className="font-medium text-subtle">Original: </span>
                    <span className={cn(parentSnippet.isSpoilerMasked && "italic")}>
                      {parentSnippet.isSpoilerMasked
                        ? parentSnippet.text
                        : `"${parentSnippet.text}"`}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CONTEXTO DE COMENTÁRIO DIRETO */}
          {isCommentNotification && commentSnippet.text && (
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1.5 min-w-0">
              <span className="block text-[9px] font-semibold uppercase tracking-wider text-subtle">
                Trecho do comentário
              </span>
              <p
                className={cn(
                  "mt-0.5 text-[11px] leading-snug break-words [overflow-wrap:anywhere]",
                  compact ? "line-clamp-2" : "line-clamp-3",
                  commentSnippet.isSpoilerMasked
                    ? "inline-flex items-center gap-1 italic text-muted"
                    : "text-fg/90",
                )}
              >
                {commentSnippet.isSpoilerMasked && (
                  <EyeOff className="size-3 shrink-0 text-purple-400" />
                )}
                <span>
                  {commentSnippet.isSpoilerMasked
                    ? commentSnippet.text
                    : `"${commentSnippet.text}"`}
                </span>
              </p>
            </div>
          )}

          {/* IDENTIFICAÇÃO DO ANIME, TEMPORADA E EPISÓDIO */}
          {showMediaMetaRow && (
            <div className="flex items-center gap-2 rounded-lg border border-purple-500/10 bg-white/[0.02] p-1.5 min-w-0">
              {animeCover ? (
                <img
                  src={animeCover}
                  alt=""
                  className={cn(
                    "shrink-0 rounded object-cover bg-elevated ring-1 ring-white/5",
                    compact ? "h-9 w-6.5" : "h-11 w-8",
                  )}
                />
              ) : null}

              <div className="min-w-0 flex-1">
                {animeTitle && (
                  <p
                    title={animeTitle}
                    className="font-semibold text-[11px] sm:text-xs leading-tight text-fg truncate"
                  >
                    {animeTitle}
                  </p>
                )}

                {(seasonLabel || episodeLabel || hasAnimeTarget) && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-medium text-muted min-w-0">
                    {seasonLabel && (
                      <span className="text-purple-300/90 font-medium truncate max-w-full">
                        {seasonLabel}
                      </span>
                    )}
                    {seasonLabel && episodeLabel && (
                      <span aria-hidden="true" className="text-subtle">
                        ·
                      </span>
                    )}
                    {episodeLabel && (
                      <span className="text-fg/80 font-medium truncate max-w-full">
                        {episodeLabel}
                      </span>
                    )}
                    {!seasonLabel && !episodeLabel && hasAnimeTarget && (
                      <span className="text-muted">Página do anime</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RODAPÉ DO ITEM: DATA RELATIVA + BOTÃO DE AÇÃO */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 min-w-0">
            <time
              dateTime={notification.createdAt}
              title={fullDateTitle}
              className="text-[10px] text-muted tabular-nums hover:text-fg transition-colors"
            >
              {relativeDate}
            </time>

            {hasTarget && actionLabel && (
              <span
                onPointerDown={triggerPressFeedback}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold select-none",
                  "border-purple-500/30 bg-purple-500/10 text-[#c084fc]",
                  "[@media(hover:hover)]:group-hover/notif:border-purple-400/50 [@media(hover:hover)]:group-hover/notif:bg-purple-500/20 [@media(hover:hover)]:group-hover/notif:text-white",
                  "transition-all duration-150 ease-out",
                  isPressingAction && "scale-95 bg-purple-500/30 text-white",
                )}
              >
                {isGroupedFollowers ? (
                  <Users className="size-3 shrink-0" />
                ) : isIndividualFollower ? (
                  <UserCheck className="size-3 shrink-0" />
                ) : (
                  <MessageCircle className="size-3 shrink-0" />
                )}
                <span>{actionLabel}</span>
                <ChevronRight className="size-3 shrink-0 opacity-75 group-hover/notif:translate-x-0.5 transition-transform" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const interactiveWrapperClass = cn(
    "group/notif block w-full text-left select-none touch-manipulation [-webkit-tap-highlight-color:transparent]",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-purple-500/60",
    "transition-colors duration-150 ease-out",
    "hover:bg-white/[0.02] active:bg-white/[0.04]",
  );

  // 1. Agrupamento de seguidores -> Abre /account?connections=followers
  if (isGroupedFollowers) {
    return (
      <Link
        to="/account"
        search={{ connections: "followers" }}
        onClick={handleActivate}
        className={interactiveWrapperClass}
      >
        {innerContent}
      </Link>
    );
  }

  // 2. Destino de episódio (comentário, resposta ou curtida)
  if (hasEpisodeTarget && notification.animeId && notification.episodeId) {
    const epNumMatch = String(notification.episodeId).match(/(\d+)$/);
    const epSlug = `ep-${epNumMatch ? epNumMatch[1] : "1"}`;
    return (
      <Link
        to="/watch/$id/$ep"
        params={{ id: notification.animeId, ep: epSlug }}
        search={{
          comment: notification.commentId ?? undefined,
        }}
        onClick={handleActivate}
        className={interactiveWrapperClass}
      >
        {innerContent}
      </Link>
    );
  }

  // 3. Destino da página do anime
  if (hasAnimeTarget && notification.animeId) {
    return (
      <Link
        to="/anime/$id"
        params={{ id: notification.animeId }}
        search={{
          comment: notification.commentId ?? undefined,
        }}
        onClick={handleActivate}
        className={interactiveWrapperClass}
      >
        {innerContent}
      </Link>
    );
  }

  // 4. Seguidor individual -> Perfil
  if (isIndividualFollower && notification.actorNick) {
    return (
      <Link
        to="/profile/$nick"
        params={{ nick: notification.actorNick }}
        onClick={handleActivate}
        className={interactiveWrapperClass}
      >
        {innerContent}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handleActivate}
      className={cn(interactiveWrapperClass, "cursor-pointer")}
    >
      {innerContent}
    </button>
  );
}
