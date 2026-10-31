import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  CornerDownRight,
  EyeOff,
  Heart,
  MessageCircle,
  UserCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  actorImage: string | null;

  commentId: string | null;
  animeId: string | null;
  episodeId: string | null;

  animeTitle: string | null;
  animeCover: string | null;
  animeSeasonNumber?: number | null;

  commentContent?: string | null;
  commentHasMedia?: boolean;
  commentIsSpoiler?: boolean;

  parentCommentId?: string | null;
  parentCommentContent?: string | null;
  parentCommentHasMedia?: boolean;
  parentCommentIsSpoiler?: boolean;
  parentCommentAuthorName?: string | null;

  commentLikes: number;

  likeAvatars: Array<{
    id: string;
    name: string | null;
    image: string | null;
  }>;
};

const INLINE_SPOILER_REGEX =
  /\|\|([\s\S]+?)\|\||<spoiler>([\s\S]+?)<\/spoiler>|\[spoiler\]([\s\S]+?)\[\/spoiler\]|>!([\s\S]+?)!<|~!([\s\S]+?)!~/gi;

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

  // Formato stream-<animeId>-<zeroBasedIndex> usado no AniList streamingEpisodes
  const streamMatch = raw.match(/^stream-[^-]+-(\d+)$/i);
  if (streamMatch?.[1]) {
    const idx = Number(streamMatch[1]);
    if (Number.isInteger(idx) && idx >= 0) {
      return { seasonNumber: null, episodeNumber: idx + 1 };
    }
  }

  // Formato s<season>-ep<episode> ou S01E05
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

  // Formatos ep-<id>-<num>, mal-ep-<id>-<num>, kitsu-ep-<id>-<num>
  const knownEpMatch = raw.match(
    /^(?:mal-ep|kitsu-ep|ep)-.+?-(\d{1,4})$/i,
  );
  if (knownEpMatch?.[1]) {
    const eNum = Number(knownEpMatch[1]);
    if (Number.isInteger(eNum) && eNum > 0) {
      return { seasonNumber: null, episodeNumber: eNum };
    }
  }

  // Número puro de episódio
  if (/^\d{1,4}$/.test(raw)) {
    const eNum = Number(raw);
    if (Number.isInteger(eNum) && eNum > 0) {
      return { seasonNumber: null, episodeNumber: eNum };
    }
  }

  // Fallback explícito com prefixo ep/episodio
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
  const { content, hasMedia = false, isSpoiler = false, maxLength = 140 } = params;

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
  onNavigate,
}: {
  notification: NotificationItem;
  localAnimes: LocalAnime[];
  compact?: boolean;
  onMarkAsRead: (id: string) => void;
  onNavigate?: () => void;
}) {
  const [isPressingAction, setIsPressingAction] = useState(false);
  const pressTimerRef = useRef<number | null>(null);

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

  const {
    hasEpisodeTarget,
    hasAnimeTarget,
    hasTarget,
    animeTitle,
    animeCover,
    seasonLabel,
    episodeLabel,
  } = resolveNotificationMediaContext(notification, localAnimes);

  const isLikeNotification = notification.type === "comment_like";
  const isReplyNotification = notification.type === "comment_reply";
  const isCommentNotification =
    !isLikeNotification &&
    !isReplyNotification &&
    (Boolean(notification.commentId) ||
      notification.type === "comment" ||
      notification.type === "mention" ||
      notification.type === "episode_comment" ||
      notification.type === "anime_comment");

  const likeCount = Number(notification.commentLikes ?? 0) || 0;
  const likeAvatars = Array.isArray(notification.likeAvatars)
    ? notification.likeAvatars
    : [];

  const actorName = notification.actorName?.trim() || null;

  const commentSnippet = formatCommentSnippet({
    content: notification.commentContent,
    hasMedia: notification.commentHasMedia,
    isSpoiler: notification.commentIsSpoiler,
    maxLength: compact ? 115 : 170,
  });

  const parentSnippet = isReplyNotification
    ? formatCommentSnippet({
        content: notification.parentCommentContent,
        hasMedia: notification.parentCommentHasMedia,
        isSpoiler: notification.parentCommentIsSpoiler,
        maxLength: compact ? 95 : 140,
      })
    : { text: null, isSpoilerMasked: false };

  const actionLabel = notification.commentId
    ? "Ver comentário"
    : hasEpisodeTarget
      ? "Ver episódio"
      : "Ver anime";

  const formattedDate = (() => {
    const parsed = new Date(notification.createdAt);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  })();

  const handleActivate = () => {
    triggerPressFeedback();
    onMarkAsRead(notification.id);
    if (notification.commentId) {
      dispatchFocusCommentEvent(notification.commentId);
    }
    onNavigate?.();
  };

  const renderSummaryText = () => {
    if (isLikeNotification && actorName) {
      if (likeCount > 1) {
        const others = likeCount - 1;
        return (
          <>
            <span className="font-semibold text-fg">{actorName}</span>{" "}
            <span className="text-fg/90">
              e mais {others} {others === 1 ? "pessoa" : "pessoas"} curtiram seu
              comentário.
            </span>
          </>
        );
      }
      return (
        <>
          <span className="font-semibold text-fg">{actorName}</span>{" "}
          <span className="text-fg/90">curtiu seu comentário.</span>
        </>
      );
    }

    if (isReplyNotification && actorName) {
      return (
        <>
          <span className="font-semibold text-fg">{actorName}</span>{" "}
          <span className="text-fg/90">respondeu ao seu comentário.</span>
        </>
      );
    }

    if (
      actorName &&
      notification.message.startsWith(`${actorName} `)
    ) {
      const rest = notification.message.slice(actorName.length);
      return (
        <>
          <span className="font-semibold text-fg">{actorName}</span>
          <span className="text-fg/90">{rest}</span>
        </>
      );
    }

    return <span className="text-fg">{notification.message}</span>;
  };

  const showMediaMetaRow = Boolean(
    animeCover || animeTitle || seasonLabel || episodeLabel,
  );

  const innerContent = (
    <div
      className={cn(
        "relative border-b border-border last:border-b-0",
        compact ? "px-3.5 py-3.5 sm:px-4" : "px-4 py-4 sm:px-5",
        "motion-safe:transition-[background-color,border-color] motion-safe:duration-200 motion-reduce:transition-none",
        !notification.read && "border-l-4 border-l-blue-500 bg-blue-500/10",
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {/* AVATAR DO AUTOR */}
        {notification.actorImage ? (
          <img
            src={notification.actorImage}
            alt=""
            className="size-10 shrink-0 rounded-full object-cover ring-1 ring-white/10"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated text-muted ring-1 ring-white/5">
            <UserCircle className="size-5" />
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* LINHA 1: MENSAGEM + INDICADOR AZUL DE NÃO LIDA */}
          <div className="flex items-start justify-between gap-2.5 min-w-0">
            <p className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] text-[13px] sm:text-sm leading-5">
              {renderSummaryText()}
            </p>

            {!notification.read && (
              <span
                aria-label="Notificação não lida"
                className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.65)] motion-safe:transition-opacity motion-safe:duration-200 motion-reduce:transition-none"
              />
            )}
          </div>

          {/* AVATARES E CONTAGEM DE CURTIDAS */}
          {isLikeNotification && likeCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {likeAvatars.length > 0 && (
                <div className="flex items-center pl-0.5 shrink-0">
                  {likeAvatars.slice(0, 3).map((avatar, index) => (
                    <div
                      key={avatar.id}
                      className={cn(
                        "relative size-6 overflow-hidden rounded-full border-2 border-bg bg-elevated",
                        index > 0 && "-ml-2",
                      )}
                      style={{ zIndex: 10 - index }}
                    >
                      {avatar.image ? (
                        <img
                          src={avatar.image}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-[9px] font-semibold text-muted">
                          {(avatar.name ?? "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                <Heart className="size-3 shrink-0 text-rose-400/85 fill-rose-400/85" />
                <span>
                  {likeCount} {likeCount === 1 ? "curtida" : "curtidas"}
                </span>
              </span>
            </div>
          )}

          {/* CONTEXTO DE RESPOSTA: RESPOSTA RECEBIDA + COMENTÁRIO ORIGINAL */}
          {isReplyNotification && (commentSnippet.text || parentSnippet.text) && (
            <div className="rounded-lg border border-border/80 bg-elevated/55 px-2.5 py-2 min-w-0 space-y-1.5">
              {commentSnippet.text && (
                <div className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-purple-300/90">
                    Resposta
                  </span>
                  <p
                    className={cn(
                      "mt-0.5 text-xs leading-relaxed break-words [overflow-wrap:anywhere]",
                      compact ? "line-clamp-2" : "line-clamp-3",
                      commentSnippet.isSpoilerMasked
                        ? "inline-flex items-center gap-1.5 italic text-muted"
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
                      "text-[11px] leading-snug text-muted break-words [overflow-wrap:anywhere]",
                      compact ? "line-clamp-1" : "line-clamp-2",
                    )}
                  >
                    <CornerDownRight className="mr-1 inline size-3 -translate-y-px text-purple-400/80" />
                    <span className="font-medium text-subtle">
                      Comentário original:{" "}
                    </span>
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

          {/* CONTEXTO DE CURTIDA: QUAL COMENTÁRIO FOI CURTIDO */}
          {isLikeNotification && commentSnippet.text && (
            <div className="rounded-lg border border-border/80 bg-elevated/45 px-2.5 py-1.5 min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-subtle">
                Comentário curtido
              </span>
              <p
                className={cn(
                  "mt-0.5 text-xs leading-relaxed break-words [overflow-wrap:anywhere]",
                  compact ? "line-clamp-2" : "line-clamp-3",
                  commentSnippet.isSpoilerMasked
                    ? "inline-flex items-center gap-1.5 italic text-muted"
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

          {/* CONTEXTO DE COMENTÁRIO DIRETO / MENÇÃO */}
          {isCommentNotification && commentSnippet.text && (
            <div className="rounded-lg border border-border/80 bg-elevated/50 px-2.5 py-1.5 min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-subtle">
                Comentário
              </span>
              <p
                className={cn(
                  "mt-0.5 text-xs leading-relaxed break-words [overflow-wrap:anywhere]",
                  compact ? "line-clamp-2" : "line-clamp-3",
                  commentSnippet.isSpoilerMasked
                    ? "inline-flex items-center gap-1.5 italic text-muted"
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

          {/* IDENTIFICAÇÃO DO ANIME, TEMPORADA E EPISÓDIO */}
          {showMediaMetaRow && (
            <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-elevated/35 p-2 min-w-0">
              {animeCover ? (
                <img
                  src={animeCover}
                  alt=""
                  className={cn(
                    "shrink-0 rounded object-cover bg-elevated",
                    compact ? "h-12 w-9" : "h-14 w-10",
                  )}
                />
              ) : null}

              <div className="min-w-0 flex-1">
                {animeTitle && (
                  <p
                    title={animeTitle}
                    className={cn(
                      "font-semibold leading-snug text-fg break-words [overflow-wrap:anywhere]",
                      compact
                        ? "line-clamp-1 text-xs"
                        : "line-clamp-2 text-xs sm:text-sm",
                    )}
                  >
                    {animeTitle}
                  </p>
                )}

                {(seasonLabel || episodeLabel || hasAnimeTarget) && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-medium text-muted min-w-0">
                    {seasonLabel && (
                      <span className="truncate max-w-full text-purple-300/90">
                        {seasonLabel}
                      </span>
                    )}
                    {seasonLabel && episodeLabel && (
                      <span aria-hidden="true" className="text-subtle">
                        ·
                      </span>
                    )}
                    {episodeLabel && (
                      <span className="truncate max-w-full text-fg/80">
                        {episodeLabel}
                      </span>
                    )}
                    {!seasonLabel && !episodeLabel && hasAnimeTarget && (
                      <span className="truncate max-w-full text-muted">
                        Página do anime
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RODAPÉ: DATA + BOTÃO "VER COMENTÁRIO" */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 min-w-0">
            <time
              dateTime={notification.createdAt}
              className="text-[11px] text-muted tabular-nums"
            >
              {formattedDate}
            </time>

            {hasTarget && (
              <span
                onPointerDown={triggerPressFeedback}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold select-none",
                  "border-purple-500/35 bg-purple-500/12 text-purple-200",
                  "[@media(hover:hover)]:group-hover/notif:border-purple-400/55 [@media(hover:hover)]:group-hover/notif:bg-purple-500/22 [@media(hover:hover)]:group-hover/notif:text-white",
                  "motion-safe:transition-[transform,background-color,border-color,color,box-shadow] motion-safe:duration-150 motion-safe:ease-out motion-reduce:transition-none motion-reduce:transform-none",
                  "motion-safe:group-active/notif:scale-[0.95] group-active/notif:border-purple-400/70 group-active/notif:bg-purple-500/30 group-active/notif:text-white",
                  isPressingAction &&
                    "motion-safe:scale-[0.95] border-purple-400/75 bg-purple-500/30 text-white shadow-[0_0_14px_rgba(168,85,247,0.3)]",
                )}
              >
                <MessageCircle className="size-3.5 shrink-0 text-purple-300 [@media(hover:hover)]:group-hover/notif:text-purple-200" />
                <span>{actionLabel}</span>
                <ChevronRight className="size-3.5 shrink-0 opacity-75 motion-safe:transition-transform motion-safe:duration-150 [@media(hover:hover)]:group-hover/notif:translate-x-0.5 motion-reduce:transform-none" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const interactiveWrapperClass = cn(
    "group/notif block w-full text-left select-none touch-manipulation [-webkit-tap-highlight-color:transparent]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500/60",
    "motion-safe:transition-[background-color,transform] motion-safe:duration-150 motion-safe:ease-out motion-reduce:transition-none motion-reduce:transform-none",
    "[@media(hover:hover)]:hover:bg-elevated/65 active:bg-elevated/85 motion-safe:active:scale-[0.996]",
  );

  if (hasEpisodeTarget && notification.animeId && notification.episodeId) {
    return (
      <Link
        to="/watch/$id"
        params={{ id: notification.animeId }}
        search={{
          ep: notification.episodeId,
          comment: notification.commentId ?? undefined,
        }}
        onClick={handleActivate}
        className={interactiveWrapperClass}
      >
        {innerContent}
      </Link>
    );
  }

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
