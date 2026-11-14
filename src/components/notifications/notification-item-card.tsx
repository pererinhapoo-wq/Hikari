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
  Play,
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

function formatRelativeTime(dateString: string): string {
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
  const [actorImgFailed, setActorImgFailed] = useState(false);

  useEffect(() => {
    setIsFollowing(notification.isFollowingActor ?? false);
  }, [notification.isFollowingActor]);

  useEffect(() => {
    setIsRequested(notification.hasPendingFollowRequestToActor ?? false);
  }, [notification.hasPendingFollowRequestToActor]);

  useEffect(() => {
    setActorImgFailed(false);
  }, [notification.actorImage]);

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

  const actionLabel =
    !notification.commentId && hasEpisodeTarget
      ? "Ver episódio"
      : !notification.commentId && hasAnimeTarget
        ? "Ver anime"
        : isGroupedFollowers
          ? "Ver seguidores"
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
          <p className="font-bold text-white text-xs sm:text-[13px] tracking-tight">
            Você tem {total} novos seguidores
          </p>
          <p className="text-[11px] text-zinc-300 leading-snug">
            {firstNames ? (
              <>
                <span className="font-semibold text-purple-200">{firstNames}</span>
                {others > 0 ? ` e outras ${others} pessoas` : ""} começaram a seguir você.
              </>
            ) : (
              "Novas pessoas começaram a seguir seu perfil."
            )}
          </p>
        </div>
      );
    }

    // 2. Novo seguidor individual
    if (isIndividualFollower && actorName) {
      return (
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
            <span className="font-bold text-white text-xs sm:text-[13px] truncate max-w-[140px] sm:max-w-[200px]">
              {actorName}
            </span>
            {notification.actorNick && (
              <span className="text-[11px] font-medium text-purple-300/80 truncate max-w-[120px]">
                @{notification.actorNick}
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-zinc-300 leading-tight">
            {notification.type === "follow_request"
              ? "solicitou para seguir você"
              : notification.type === "follow_accept"
                ? "aceitou sua solicitação para seguir"
                : "começou a seguir você"}
          </p>
        </div>
      );
    }

    // 3. Curtidas (Likes)
    if (isLikeNotification) {
      if (likeAvatars.length >= 2) {
        const name1 = likeAvatars[0].name || "Usuário";
        const name2 = likeAvatars[1].name || "Usuário";
        const others = Math.max(0, likeCount - 2);

        if (others > 0) {
          return (
            <span className="text-zinc-200 text-xs sm:text-[12.5px] leading-snug">
              <span className="font-bold text-white">{name1}</span>,{" "}
              <span className="font-bold text-white">{name2}</span> e mais{" "}
              <span className="font-semibold text-purple-300">{others} {others === 1 ? "pessoa" : "pessoas"}</span>{" "}
              curtiram seu comentário.
            </span>
          );
        }

        return (
          <span className="text-zinc-200 text-xs sm:text-[12.5px] leading-snug">
            <span className="font-bold text-white">{name1}</span> e{" "}
            <span className="font-bold text-white">{name2}</span> curtiram seu comentário.
          </span>
        );
      }

      if (actorName) {
        if (likeCount > 1) {
          const others = likeCount - 1;
          return (
            <span className="text-zinc-200 text-xs sm:text-[12.5px] leading-snug">
              <span className="font-bold text-white">{actorName}</span> e mais{" "}
              <span className="font-semibold text-purple-300">{others} {others === 1 ? "pessoa" : "pessoas"}</span>{" "}
              curtiram seu comentário.
            </span>
          );
        }
        return (
          <span className="text-zinc-200 text-xs sm:text-[12.5px] leading-snug">
            <span className="font-bold text-white">{actorName}</span> curtiu seu comentário.
          </span>
        );
      }
    }

    // 4. Respostas (Replies)
    if (isReplyNotification && actorName) {
      return (
        <span className="text-zinc-200 text-xs sm:text-[12.5px] leading-snug">
          <span className="font-bold text-white">{actorName}</span>{" "}
          <span className="text-purple-300/90 font-medium">respondeu</span> ao seu comentário.
        </span>
      );
    }

    // 5. Comentários diretos / Menções
    if (isCommentNotification && actorName) {
      return (
        <span className="text-zinc-200 text-xs sm:text-[12.5px] leading-snug">
          <span className="font-bold text-white">{actorName}</span> comentou em uma publicação.
        </span>
      );
    }

    if (actorName && notification.message.startsWith(`${actorName} `)) {
      const rest = notification.message.slice(actorName.length);
      return (
        <span className="text-zinc-200 text-xs sm:text-[12.5px] leading-snug">
          <span className="font-bold text-white">{actorName}</span>
          <span className="text-zinc-300">{rest}</span>
        </span>
      );
    }

    return <span className="text-zinc-200 text-xs sm:text-[12.5px] leading-snug">{notification.message}</span>;
  };

  const showMediaMetaRow = Boolean(
    animeCover || animeTitle || seasonLabel || episodeLabel,
  );

  const innerContent = (
    <div
      className={cn(
        "relative transition-all duration-200 border-b border-white/[0.06] last:border-b-0",
        compact ? "px-3.5 py-3" : "px-4 py-3.5 sm:px-5 sm:py-4",
        !notification.read
          ? "bg-gradient-to-r from-purple-950/30 via-purple-900/10 to-transparent border-l-[3px] border-l-[#c084fc]"
          : "bg-transparent border-l-[3px] border-l-transparent hover:bg-white/[0.025]",
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {/* AVATAR DO AUTOR OU PILHA DE AVATARES DE SEGUIDORES COM BADGE ELEGANTE */}
        {isGroupedFollowers ? (
          <div className="relative shrink-0 pt-0.5">
            <div className="flex items-center">
              {(notification.groupedFollowers ?? []).slice(0, 3).map((f, i) => (
                <div
                  key={f.id}
                  className={cn(
                    "relative overflow-hidden rounded-full bg-[#171326] ring-2 ring-[#0b0914] border border-white/10 shadow-sm",
                    compact ? "size-7" : "size-8",
                    i > 0 && "-ml-2.5",
                  )}
                  style={{ zIndex: 10 - i }}
                >
                  {f.image ? (
                    <img
                      src={f.image}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-[10px] font-bold text-purple-200">
                      {(f.name || f.nick || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              ))}
              {(notification.totalFollowersCount ?? (notification.groupedFollowers?.length ?? 0)) > 3 && (
                <div
                  className={cn(
                    "relative -ml-2.5 flex items-center justify-center rounded-full bg-[#201838] font-bold text-purple-200 ring-2 ring-[#0b0914] border border-purple-400/30 tabular-nums shadow-sm",
                    compact ? "size-7 text-[9px]" : "size-8 text-[10px]",
                  )}
                  style={{ zIndex: 6 }}
                >
                  +{(notification.totalFollowersCount ?? (notification.groupedFollowers?.length ?? 0)) - 3}
                </div>
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white border-2 border-[#0b0914] shadow-[0_0_8px_rgba(14,165,233,0.5)]">
              <Users className="size-2.5" />
            </span>
          </div>
        ) : (
          <div className="relative shrink-0 pt-0.5">
            {notification.actorImage && !actorImgFailed ? (
              <img
                src={notification.actorImage}
                alt={actorName ? `Foto de ${actorName}` : ""}
                referrerPolicy="no-referrer"
                onError={() => setActorImgFailed(true)}
                className={cn(
                  "rounded-full object-cover bg-[#171326] ring-2 ring-purple-500/25 shadow-md",
                  compact ? "size-9" : "size-10",
                )}
              />
            ) : (
              <div
                className={cn(
                  "flex items-center justify-center rounded-full bg-gradient-to-br from-[#241940] to-[#130f24] text-[#c084fc] font-bold ring-2 ring-purple-500/25 shadow-md",
                  compact ? "size-9 text-xs" : "size-10 text-sm",
                )}
              >
                {actorName ? (
                  <span>{actorName.charAt(0).toUpperCase()}</span>
                ) : (
                  <UserCircle className="size-5 text-zinc-400" />
                )}
              </div>
            )}

            {/* BADGES REFORMULADAS DO TIPO DE NOTIFICAÇÃO COM HALO DE COR */}
            {isLikeNotification && (
              <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-pink-600 text-white border-2 border-[#0b0914] shadow-[0_0_8px_rgba(244,63,94,0.6)]">
                <Heart className="size-2.5 fill-current" />
              </span>
            )}
            {isReplyNotification && (
              <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white border-2 border-[#0b0914] shadow-[0_0_8px_rgba(147,51,234,0.6)]">
                <MessageCircle className="size-2.5" />
              </span>
            )}
            {isCommentNotification && (
              <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-600 text-white border-2 border-[#0b0914] shadow-[0_0_8px_rgba(139,92,246,0.6)]">
                <MessageCircle className="size-2.5" />
              </span>
            )}
            {notification.type === "new_follower" && (
              <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white border-2 border-[#0b0914] shadow-[0_0_8px_rgba(14,165,233,0.6)]">
                <UserPlus className="size-2.5" />
              </span>
            )}
            {notification.type === "follow_request" && (
              <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white border-2 border-[#0b0914] shadow-[0_0_8px_rgba(245,158,11,0.6)]">
                <UserPlus className="size-2.5" />
              </span>
            )}
            {notification.type === "follow_accept" && (
              <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-2 border-[#0b0914] shadow-[0_0_8px_rgba(16,185,129,0.6)]">
                <UserCheck className="size-2.5" />
              </span>
            )}
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL COM HIERARQUIA VISUAL APRIMORADA */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* CABEÇALHO DO ITEM: RESUMO + INDICADOR NÃO LIDA / EXCLUIR */}
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1 leading-snug">
              {renderSummaryText()}
            </div>

            <div className="flex items-center gap-1 shrink-0 pt-0.5">
              {!notification.read && (
                <span
                  title="Não lida"
                  aria-label="Notificação não lida"
                  className="size-2 rounded-full bg-[#c084fc] shadow-[0_0_8px_rgba(192,132,252,0.9)] animate-pulse"
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
                  className="flex size-6.5 items-center justify-center rounded-lg text-zinc-400 hover:bg-rose-500/15 hover:text-rose-300 border border-transparent hover:border-rose-500/25 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400/50 cursor-pointer"
                  title="Excluir notificação"
                  aria-label="Excluir notificação"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* NOVO SEGUIDOR: BOTÃO SEGUIR DE VOLTA REFORMULADO */}
          {isIndividualFollower && notification.type === "new_follower" && (
            <div className="pt-0.5">
              {isFollowing ? (
                <span className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold shadow-sm select-none">
                  <Check className="size-3.5" />
                  <span>Seguindo</span>
                </span>
              ) : isRequested ? (
                <span className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-200 text-xs font-semibold shadow-sm select-none">
                  <Clock className="size-3.5" />
                  <span>Solicitado</span>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={followLoading}
                  onClick={handleFollowBack}
                  className="inline-flex items-center gap-1.5 h-7.5 px-3.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-[0_0_14px_rgba(147,51,234,0.35)] transition-all active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  {followLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="size-3.5" />
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
              <div className="pt-0.5 flex flex-wrap items-center gap-2">
                {requestDecision === "accepted" ? (
                  <span className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold shadow-sm select-none">
                    <Check className="size-3.5" />
                    <span>Solicitação aceita</span>
                  </span>
                ) : requestDecision === "rejected" ? (
                  <span className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded-lg bg-white/[0.06] border border-white/10 text-zinc-400 text-xs font-semibold shadow-sm select-none">
                    <X className="size-3.5" />
                    <span>Solicitação recusada</span>
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={requestLoading !== null}
                      onClick={handleAcceptFollowRequest}
                      className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-[0_0_12px_rgba(147,51,234,0.35)] transition-all active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      {requestLoading === "accept" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      <span>Aceitar</span>
                    </button>
                    <button
                      type="button"
                      disabled={requestLoading !== null}
                      onClick={handleRejectFollowRequest}
                      className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded-lg border border-white/10 bg-white/[0.05] hover:bg-rose-500/15 hover:border-rose-400/30 text-zinc-300 hover:text-rose-200 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      {requestLoading === "reject" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <X className="size-3.5" />
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
              <div className="flex items-center shrink-0">
                {likeAvatars.slice(0, 3).map((avatar, index) => (
                  <div
                    key={avatar.id}
                    className={cn(
                      "relative size-5.5 sm:size-6 overflow-hidden rounded-full bg-[#171326] ring-2 ring-[#0b0914] border border-white/10 shadow-sm",
                      index > 0 && "-ml-2",
                    )}
                    style={{ zIndex: 10 - index }}
                    title={avatar.name || "Usuário"}
                  >
                    {avatar.image ? (
                      <img
                        src={avatar.image}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-[8px] font-bold text-zinc-300">
                        {(avatar.name ?? "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
                {likeCount > 3 && (
                  <div
                    className="relative -ml-2 flex size-5.5 sm:size-6 items-center justify-center rounded-full bg-[#201838] text-[8px] font-bold text-purple-200 ring-2 ring-[#0b0914] border border-purple-500/25 tabular-nums shadow-sm"
                    style={{ zIndex: 5 }}
                  >
                    +{likeCount - 3}
                  </div>
                )}
              </div>

              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[11px] font-semibold text-rose-300 tabular-nums">
                <Heart className="size-3 text-rose-400 fill-rose-400" />
                <span>{likeCount} {likeCount === 1 ? "curtida" : "curtidas"}</span>
              </span>
            </div>
          )}

          {/* TRECHO DO COMENTÁRIO CURTIDO */}
          {isLikeNotification && commentSnippet.text && (
            <div className="rounded-xl border border-rose-500/20 bg-[#160d1b]/70 p-2.5 min-w-0 shadow-sm">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-rose-300/80 mb-1">
                Comentário curtido
              </span>
              <p
                className={cn(
                  "text-xs leading-relaxed break-words [overflow-wrap:anywhere]",
                  compact ? "line-clamp-2" : "line-clamp-3",
                  commentSnippet.isSpoilerMasked
                    ? "inline-flex items-center gap-1.5 italic text-zinc-400"
                    : "text-zinc-200",
                )}
              >
                {commentSnippet.isSpoilerMasked && (
                  <EyeOff className="size-3.5 shrink-0 text-purple-300" />
                )}
                <span>
                  {commentSnippet.isSpoilerMasked
                    ? commentSnippet.text
                    : `"${commentSnippet.text}"`}
                </span>
              </p>
            </div>
          )}

          {/* CONTEXTO DE RESPOSTA REFORMULADO (DESTAQUE DA RESPOSTA E COMENTÁRIO ORIGINAL) */}
          {isReplyNotification && (commentSnippet.text || parentSnippet.text) && (
            <div className="rounded-xl border border-purple-500/25 bg-[#130f24]/85 p-3 min-w-0 shadow-md space-y-2.5">
              {commentSnippet.text && (
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-200 border border-purple-500/30">
                      <MessageCircle className="size-3" />
                      Resposta recebida
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-xs leading-relaxed break-words [overflow-wrap:anywhere] text-zinc-100 font-medium pl-0.5",
                      compact ? "line-clamp-2" : "line-clamp-3",
                      commentSnippet.isSpoilerMasked && "italic text-zinc-400",
                    )}
                  >
                    {commentSnippet.isSpoilerMasked && (
                      <EyeOff className="size-3.5 inline mr-1 text-purple-300" />
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
                <div className="rounded-lg bg-black/40 border-l-2 border-purple-400/50 px-2.5 py-1.5 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-purple-300/80 mb-0.5">
                    <CornerDownRight className="size-2.5 text-purple-400" />
                    <span>Seu comentário original</span>
                  </div>
                  <p
                    className={cn(
                      "leading-relaxed break-words [overflow-wrap:anywhere] text-zinc-300/90",
                      compact ? "line-clamp-1" : "line-clamp-2",
                      parentSnippet.isSpoilerMasked && "italic",
                    )}
                  >
                    {parentSnippet.isSpoilerMasked
                      ? parentSnippet.text
                      : `"${parentSnippet.text}"`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CONTEXTO DE COMENTÁRIO DIRETO */}
          {isCommentNotification && commentSnippet.text && (
            <div className="rounded-xl border border-white/[0.08] bg-[#120f22]/70 p-2.5 min-w-0 shadow-sm">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-purple-300/80 mb-1">
                Trecho do comentário
              </span>
              <p
                className={cn(
                  "text-xs leading-relaxed break-words [overflow-wrap:anywhere]",
                  compact ? "line-clamp-2" : "line-clamp-3",
                  commentSnippet.isSpoilerMasked
                    ? "inline-flex items-center gap-1.5 italic text-zinc-400"
                    : "text-zinc-200",
                )}
              >
                {commentSnippet.isSpoilerMasked && (
                  <EyeOff className="size-3.5 shrink-0 text-purple-300" />
                )}
                <span>
                  {commentSnippet.isSpoilerMasked
                    ? commentSnippet.text
                    : `"${commentSnippet.text}"`}
                </span>
              </p>
            </div>
          )}

          {/* CARD DE ANIME RELACIONADO REFORMULADO (POSTER + TÍTULO + BADGES) */}
          {showMediaMetaRow && (
            <div className="flex items-center gap-3 p-2 rounded-xl bg-gradient-to-r from-[#141026]/90 to-[#0d0b1a]/90 border border-purple-500/20 hover:border-purple-400/45 shadow-sm transition-all group/anime min-w-0">
              {animeCover ? (
                <div className="relative h-13 w-9.5 shrink-0 overflow-hidden rounded-lg bg-[#161226] ring-1 ring-white/10 shadow-md group-hover/anime:ring-purple-400/50 transition-all">
                  <img
                    src={animeCover}
                    alt={animeTitle || "Capa do anime"}
                    referrerPolicy="no-referrer"
                    className="size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                </div>
              ) : (
                <div className="flex h-13 w-9.5 shrink-0 items-center justify-center rounded-lg bg-[#161226] text-purple-300 ring-1 ring-white/10">
                  <Play className="size-4 fill-current" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                {animeTitle && (
                  <p
                    title={animeTitle}
                    className="font-bold text-xs sm:text-[13px] leading-snug text-white group-hover/anime:text-purple-200 transition-colors truncate"
                  >
                    {animeTitle}
                  </p>
                )}

                {(seasonLabel || episodeLabel || hasAnimeTarget) && (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] min-w-0">
                    {seasonLabel && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-semibold bg-purple-500/20 text-purple-200 border border-purple-500/30 truncate max-w-full">
                        {seasonLabel}
                      </span>
                    )}
                    {episodeLabel && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-semibold bg-white/[0.08] text-zinc-200 border border-white/10 truncate max-w-full tabular-nums">
                        {episodeLabel}
                      </span>
                    )}
                    {!seasonLabel && !episodeLabel && hasAnimeTarget && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-semibold bg-white/[0.05] text-zinc-400 border border-white/5">
                        Página do anime
                      </span>
                    )}
                  </div>
                )}
              </div>

              <ChevronRight className="size-4 text-purple-400/60 group-hover/anime:text-purple-300 group-hover/anime:translate-x-0.5 transition-all shrink-0 ml-auto" />
            </div>
          )}

          {/* RODAPÉ DO ITEM: DATA RELATIVA COM ÍCONE + AÇÃO CONTEXTUAL */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 min-w-0">
            <time
              dateTime={notification.createdAt}
              title={fullDateTitle}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-400 tabular-nums hover:text-zinc-200 transition-colors"
            >
              <Clock className="size-3 text-zinc-400" />
              <span>{relativeDate}</span>
            </time>

            {hasTarget && actionLabel && (
              <span
                onPointerDown={triggerPressFeedback}
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-semibold text-purple-300 select-none",
                  "[@media(hover:hover)]:group-hover/notif:text-purple-200 group-hover/notif:underline decoration-purple-400/50 underline-offset-2",
                  "transition-colors duration-150 ease-out",
                  isPressingAction && "opacity-75",
                )}
              >
                {isGroupedFollowers ? (
                  <Users className="size-3 shrink-0" />
                ) : (
                  <MessageCircle className="size-3 shrink-0" />
                )}
                <span>{actionLabel}</span>
                <ChevronRight className="size-3 shrink-0 opacity-70 group-hover/notif:translate-x-0.5 transition-transform" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const interactiveWrapperClass = cn(
    "group/notif block w-full text-left select-none touch-manipulation [-webkit-tap-highlight-color:transparent]",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-purple-400/50",
    "transition-colors duration-150 ease-out",
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
