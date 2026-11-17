import type { NotificationItem } from "@/components/notifications/notification-item-card";

export const NOTIFICATION_POLL_INTERVAL_MS = 120_000;
export const NOTIFICATION_FOCUS_MIN_INTERVAL_MS = 30_000;

export interface NotificationsApiPayload {
  notifications?: NotificationItem[];
  unreadCount?: number;
  totalCount?: number;
  hasMore?: boolean;
  nextOffset?: number;
}

export interface FetchNotificationsParams {
  userId: string;
  limit: number;
  offset: number;
  filter?: "all" | "unread";
}

export interface NotificationsSummaryEvent {
  userId: string;
  unreadCount: number;
}

type SummaryListener = (event: NotificationsSummaryEvent) => void;

const inFlightRequests = new Map<string, Promise<NotificationsApiPayload | null>>();
const summaryListeners = new Set<SummaryListener>();

let syncEpoch = 0;
let lastSyncActivityAt = 0;
let activeNotificationsPageCount = 0;
let activeSyncUserId: string | null = null;

export function isDocumentHidden(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  return Boolean(document.hidden || document.visibilityState === "hidden");
}

export function setActiveNotificationsSyncUser(userId: string | null): void {
  if (activeSyncUserId === userId) {
    return;
  }
  activeSyncUserId = userId;
  syncEpoch += 1;
  lastSyncActivityAt = 0;
  inFlightRequests.clear();
}

export function invalidateNotificationsSync(): void {
  syncEpoch += 1;
  inFlightRequests.clear();
}

export function getNotificationsSyncEpoch(): number {
  return syncEpoch;
}

export function markNotificationSyncActivity(now = Date.now()): void {
  lastSyncActivityAt = now;
}

export function shouldSkipFocusNotificationSync(now = Date.now()): boolean {
  if (isDocumentHidden()) {
    return true;
  }
  if (
    lastSyncActivityAt > 0 &&
    now - lastSyncActivityAt < NOTIFICATION_FOCUS_MIN_INTERVAL_MS
  ) {
    return true;
  }
  return false;
}

export function registerNotificationsPageMount(): () => void {
  activeNotificationsPageCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeNotificationsPageCount = Math.max(0, activeNotificationsPageCount - 1);
  };
}

export function isNotificationsPageMounted(): boolean {
  return activeNotificationsPageCount > 0;
}

export function subscribeNotificationsSummary(listener: SummaryListener): () => void {
  summaryListeners.add(listener);
  return () => {
    summaryListeners.delete(listener);
  };
}

export function emitNotificationsSummary(event: NotificationsSummaryEvent): void {
  for (const listener of summaryListeners) {
    listener(event);
  }
}

export function fetchNotificationsSingleflight(
  params: FetchNotificationsParams,
): Promise<NotificationsApiPayload | null> {
  const { userId, limit, offset } = params;
  const filter = params.filter ?? "all";

  if (!userId) {
    return Promise.resolve(null);
  }

  const requestKey = `${userId}:${limit}:${offset}:${filter}`;
  const existing = inFlightRequests.get(requestKey);
  if (existing) {
    return existing;
  }

  const requestEpoch = syncEpoch;
  let flightRef: Promise<NotificationsApiPayload | null> | null = null;

  const currentFlight = (async (): Promise<NotificationsApiPayload | null> => {
    try {
      const { getBearerToken } = await import("@/lib/auth/client");
      const bearer = getBearerToken();
      const query = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (filter !== "all" || limit !== 10) {
        query.set("filter", filter);
      }

      const response = await fetch(`/api/notifications?${query.toString()}`, {
        method: "GET",
        credentials: "include",
        headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as NotificationsApiPayload;
      if (
        requestEpoch !== syncEpoch ||
        (activeSyncUserId !== null && activeSyncUserId !== userId)
      ) {
        return null;
      }

      return data;
    } catch {
      return null;
    } finally {
      if (inFlightRequests.get(requestKey) === flightRef) {
        inFlightRequests.delete(requestKey);
      }
    }
  })();

  flightRef = currentFlight;
  inFlightRequests.set(requestKey, currentFlight);
  return currentFlight;
}
