import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBearerToken } from "@/lib/auth/client";
import type { Comment } from "@/components/comments/EpisodeCommentsSection";
import type { TypingViewPayload } from "@/components/comments/useCommentTyping";

const POLL_UPDATES_INTERVAL_MS = 3000;
const MAX_POLL_BACKOFF_MS = 15000;

export interface PendingCommentSummary {
  id: string;
  parentId: string | null;
  userId: string;
  createdAt: string;
}

interface CommentUpdatesPollResponse {
  items?: PendingCommentSummary[];
  comments?: Comment[];
  totalCount?: number;
  totalRoots?: number;
  serverTime?: string;
  typing?: TypingViewPayload;
}

export interface AppliedNewCommentsPayload {
  comments: Comment[];
  newIds: string[];
  totalCount: number | null;
  totalRoots: number | null;
  serverTime: string | null;
}

export interface UseCommentUpdatesOptions {
  animeId: string;
  episodeId: string;
  viewerUserId: string | null;
  sessionReady: boolean;
  baselineSince: string | null;
  loadedCommentIds: ReadonlySet<string>;
  ownCommentIdsRef: RefObject<Set<string>>;
  containerRef?: RefObject<HTMLElement | null>;
  enabled?: boolean;
  includeTyping?: boolean;
  onApplyNewComments: (payload: AppliedNewCommentsPayload) => void;
  onTypingUpdate?: (payload: TypingViewPayload) => void;
}

function buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const bearer = getBearerToken();
  return {
    ...(extra ?? {}),
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
  };
}

function filterNewItems(
  items: ReadonlyArray<PendingCommentSummary>,
  viewerUserId: string | null,
  loadedIds: ReadonlySet<string>,
  ownIds: ReadonlySet<string>,
): PendingCommentSummary[] {
  const unique: PendingCommentSummary[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    if (viewerUserId && item.userId === viewerUserId) continue;
    if (loadedIds.has(item.id)) continue;
    if (ownIds.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }

  return unique;
}

export function useCommentUpdates({
  animeId,
  episodeId,
  viewerUserId,
  sessionReady,
  baselineSince,
  loadedCommentIds,
  ownCommentIdsRef,
  containerRef,
  enabled = true,
  includeTyping = false,
  onApplyNewComments,
  onTypingUpdate,
}: UseCommentUpdatesOptions) {
  const trimmedAnimeId = animeId.trim();
  const trimmedEpisodeId = episodeId.trim();

  const [pendingItems, setPendingItems] = useState<PendingCommentSummary[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  const [isSectionVisible, setIsSectionVisible] = useState(() => {
    if (!containerRef) return true;
    if (typeof window === "undefined") return false;
    return !("IntersectionObserver" in window);
  });

  const loadedIdsRef = useRef(loadedCommentIds);
  loadedIdsRef.current = loadedCommentIds;

  const viewerUserIdRef = useRef(viewerUserId);
  viewerUserIdRef.current = viewerUserId;

  const baselineSinceRef = useRef(baselineSince);
  baselineSinceRef.current = baselineSince;

  const onApplyRef = useRef(onApplyNewComments);
  onApplyRef.current = onApplyNewComments;

  const onTypingUpdateRef = useRef(onTypingUpdate);
  onTypingUpdateRef.current = onTypingUpdate;

  const generationRef = useRef(0);
  const pollAbortRef = useRef<AbortController | null>(null);
  const revealAbortRef = useRef<AbortController | null>(null);
  const isRevealingRef = useRef(false);

  // Clear pending badge immediately when room switches, baseline resets, or comments module disables
  useEffect(() => {
    generationRef.current += 1;
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
    revealAbortRef.current?.abort();
    revealAbortRef.current = null;
    isRevealingRef.current = false;
    setIsRevealing(false);
    setPendingItems([]);
  }, [trimmedAnimeId, trimmedEpisodeId, enabled]);

  useEffect(() => {
    if (!baselineSince) {
      setPendingItems([]);
    }
  }, [baselineSince]);

  // Track browser tab foreground state
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const syncVisibility = () => {
      setIsTabVisible(document.visibilityState === "visible");
    };

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  // Track comments section visibility inside viewport
  useEffect(() => {
    if (!containerRef) {
      setIsSectionVisible(true);
      return;
    }

    if (typeof window === "undefined") {
      setIsSectionVisible(false);
      return;
    }

    const target = containerRef.current;
    if (!target) {
      setIsSectionVisible(false);
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setIsSectionVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setIsSectionVisible(entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: "0px",
        threshold: 0,
      },
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [containerRef, enabled, trimmedAnimeId, trimmedEpisodeId]);

  const shouldPoll =
    typeof window !== "undefined" &&
    enabled &&
    sessionReady &&
    Boolean(trimmedAnimeId && trimmedEpisodeId && baselineSince) &&
    isTabVisible &&
    isSectionVisible;

  useEffect(() => {
    if (!shouldPoll || !baselineSince) {
      return;
    }

    let cancelled = false;
    let pollTimer: number | null = null;
    let consecutiveErrors = 0;

    const clearPollTimer = () => {
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
      }
    };

    const scheduleNext = (delayMs: number) => {
      clearPollTimer();
      if (cancelled) return;
      pollTimer = window.setTimeout(() => {
        pollTimer = null;
        void pollOnce();
      }, delayMs);
    };

    const pollOnce = async () => {
      if (cancelled) return;
      if (isRevealingRef.current) {
        scheduleNext(POLL_UPDATES_INTERVAL_MS);
        return;
      }

      const activeBaseline = baselineSinceRef.current;
      if (!activeBaseline) return;

      const requestGen = generationRef.current;
      pollAbortRef.current?.abort();
      const controller = new AbortController();
      pollAbortRef.current = controller;

      try {
        const params = new URLSearchParams({
          animeId: trimmedAnimeId,
          episodeId: trimmedEpisodeId,
          since: activeBaseline,
        });
        if (includeTyping) {
          params.set("includeTyping", "1");
        }

        const response = await fetch(`/api/comments/updates?${params.toString()}`, {
          method: "GET",
          credentials: "include",
          headers: buildAuthHeaders({ Accept: "application/json" }),
          signal: controller.signal,
          cache: "no-store",
        });

        if (
          cancelled ||
          controller.signal.aborted ||
          requestGen !== generationRef.current
        ) {
          return;
        }

        if (!response.ok) {
          consecutiveErrors = Math.min(consecutiveErrors + 1, 3);
          const backoffMs = Math.min(
            MAX_POLL_BACKOFF_MS,
            POLL_UPDATES_INTERVAL_MS * 2 ** consecutiveErrors,
          );
          scheduleNext(backoffMs);
          return;
        }

        const data = (await response.json()) as CommentUpdatesPollResponse;

        if (
          cancelled ||
          controller.signal.aborted ||
          requestGen !== generationRef.current
        ) {
          return;
        }

        consecutiveErrors = 0;
        const rawItems = Array.isArray(data?.items) ? data.items : [];
        const filtered = filterNewItems(
          rawItems,
          viewerUserIdRef.current,
          loadedIdsRef.current,
          ownCommentIdsRef.current,
        );
        setPendingItems(filtered);
        if (includeTyping && data?.typing) {
          onTypingUpdateRef.current?.(data.typing);
        }
        scheduleNext(POLL_UPDATES_INTERVAL_MS);
      } catch (err) {
        if (
          cancelled ||
          controller.signal.aborted ||
          requestGen !== generationRef.current ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          return;
        }

        consecutiveErrors = Math.min(consecutiveErrors + 1, 3);
        const backoffMs = Math.min(
          MAX_POLL_BACKOFF_MS,
          POLL_UPDATES_INTERVAL_MS * 2 ** consecutiveErrors,
        );
        scheduleNext(backoffMs);
      }
    };

    void pollOnce();

    return () => {
      cancelled = true;
      clearPollTimer();
      pollAbortRef.current?.abort();
      pollAbortRef.current = null;
    };
  }, [
    shouldPoll,
    trimmedAnimeId,
    trimmedEpisodeId,
    viewerUserId,
    baselineSince,
    includeTyping,
    ownCommentIdsRef,
  ]);

  const filteredPendingItems = useMemo(
    () =>
      filterNewItems(
        pendingItems,
        viewerUserId,
        loadedCommentIds,
        ownCommentIdsRef.current,
      ),
    [pendingItems, viewerUserId, loadedCommentIds, ownCommentIdsRef],
  );

  const pendingNewCount = filteredPendingItems.length;

  const revealNewComments = useCallback(async () => {
    const activeBaseline = baselineSinceRef.current;
    if (
      typeof window === "undefined" ||
      isRevealingRef.current ||
      !trimmedAnimeId ||
      !trimmedEpisodeId ||
      !activeBaseline
    ) {
      return;
    }

    isRevealingRef.current = true;
    setIsRevealing(true);
    generationRef.current += 1;
    const revealGen = generationRef.current;

    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
    revealAbortRef.current?.abort();
    const controller = new AbortController();
    revealAbortRef.current = controller;

    try {
      const params = new URLSearchParams({
        animeId: trimmedAnimeId,
        episodeId: trimmedEpisodeId,
        since: activeBaseline,
        includeComments: "1",
      });
      if (includeTyping) {
        params.set("includeTyping", "1");
      }

      const response = await fetch(`/api/comments/updates?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        headers: buildAuthHeaders({ Accept: "application/json" }),
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as CommentUpdatesPollResponse;
      if (controller.signal.aborted || revealGen !== generationRef.current) {
        return;
      }

      const rawItems = Array.isArray(data?.items) ? data.items : [];
      const newIds = filterNewItems(
        rawItems,
        viewerUserIdRef.current,
        loadedIdsRef.current,
        ownCommentIdsRef.current,
      ).map((item) => item.id);

      const loadedComments = Array.isArray(data?.comments) ? data.comments : [];

      setPendingItems([]);
      if (includeTyping && data?.typing) {
        onTypingUpdateRef.current?.(data.typing);
      }
      onApplyRef.current({
        comments: loadedComments,
        newIds,
        totalCount: typeof data?.totalCount === "number" ? data.totalCount : null,
        totalRoots: typeof data?.totalRoots === "number" ? data.totalRoots : null,
        serverTime: typeof data?.serverTime === "string" ? data.serverTime : null,
      });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.error("[useCommentUpdates] Erro ao carregar novos comentários:", err);
      }
    } finally {
      if (revealAbortRef.current === controller) {
        revealAbortRef.current = null;
      }
      isRevealingRef.current = false;
      setIsRevealing(false);
    }
  }, [trimmedAnimeId, trimmedEpisodeId, includeTyping, ownCommentIdsRef]);

  return {
    pendingNewCount,
    isRevealingNewComments: isRevealing,
    revealNewComments,
  };
}
