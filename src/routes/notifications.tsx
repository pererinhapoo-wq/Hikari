import {
  createFileRoute,
  Link,
} from "@tanstack/react-router";

import {
  ArrowLeft,
  Bell,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  NotificationItemCard,
  type NotificationItem,
} from "@/components/notifications/notification-item-card";
import { getBearerToken } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useHikariStore } from "@/lib/store";

export const Route = createFileRoute(
  "/notifications",
)({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user, isPending } =
    useCurrentUserState();

  const localAnimes =
    useHikariStore((s) => s.animes);

  const [
    notifications,
    setNotifications,
  ] = useState<
    NotificationItem[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const notificationsRef = useRef<NotificationItem[]>([]);
  notificationsRef.current = notifications;

  const pendingReadTokensRef = useRef<Map<string, string>>(new Map());

  const reconcileNotifications = useCallback(
    (rawList: NotificationItem[]) => {
      return rawList.map((item) => {
        const pendingCreatedAt = pendingReadTokensRef.current.get(item.id);
        if (pendingCreatedAt !== undefined) {
          if (item.read) {
            pendingReadTokensRef.current.delete(item.id);
            return item;
          }
          if (pendingCreatedAt === item.createdAt) {
            return { ...item, read: true };
          }
          pendingReadTokensRef.current.delete(item.id);
        }
        return item;
      });
    },
    [],
  );

  const userId = user?.id ?? null;

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!userId) {
      pendingReadTokensRef.current.clear();
      setNotifications([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadNotifications =
      async (showSpinner = false) => {
        if (showSpinner) {
          setLoading(true);
        }

        try {
          const bearer = getBearerToken();
          const response =
            await fetch(
              "/api/notifications",
              {
                method: "GET",
                credentials: "include",
                headers: bearer
                  ? { Authorization: `Bearer ${bearer}` }
                  : undefined,
              },
            );

          if (!response.ok) {
            return;
          }

          const data =
            (await response.json()) as {
              notifications?: NotificationItem[];
            };

          if (cancelled) {
            return;
          }

          setNotifications(
            reconcileNotifications(data.notifications ?? []),
          );
        } catch {
          if (!cancelled && showSpinner) {
            setNotifications([]);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

    void loadNotifications(true);

    const handleSync = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      void loadNotifications(false);
    };

    window.addEventListener("focus", handleSync);
    document.addEventListener("visibilitychange", handleSync);
    window.addEventListener("hikari:notifications-updated", handleSync);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleSync);
      window.removeEventListener("hikari:notifications-updated", handleSync);
    };
  }, [userId, isPending, reconcileNotifications]);

  const markNotificationsAsRead = useCallback(
    async (ids: string[]) => {
      if (!user || ids.length === 0) {
        return;
      }

      const requestedSet = new Set(ids);
      const targets = notificationsRef.current.filter(
        (item) =>
          requestedSet.has(item.id) &&
          !item.read &&
          pendingReadTokensRef.current.get(item.id) !== item.createdAt,
      );

      if (targets.length === 0) {
        return;
      }

      const targetIdSet = new Set<string>();
      for (const item of targets) {
        targetIdSet.add(item.id);
        pendingReadTokensRef.current.set(item.id, item.createdAt);
      }
      const targetIds = Array.from(targetIdSet);

      setNotifications((current) =>
        current.map((notification) =>
          targetIdSet.has(notification.id)
            ? { ...notification, read: true }
            : notification,
        ),
      );

      try {
        const bearer = getBearerToken();
        const response = await fetch(
          "/api/notifications",
          {
            method: "PATCH",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
              ...(bearer
                ? { Authorization: `Bearer ${bearer}` }
                : {}),
            },
            body: JSON.stringify({
              ids: targetIds,
            }),
          },
        );

        for (const id of targetIds) {
          pendingReadTokensRef.current.delete(id);
        }

        if (response.ok) {
          window.dispatchEvent(
            new CustomEvent("hikari:notifications-updated"),
          );
        }
      } catch {
        for (const id of targetIds) {
          pendingReadTokensRef.current.delete(id);
        }
      }
    },
    [user],
  );

  // Marca automaticamente como lidas as notificações exibidas nesta página
  useEffect(() => {
    if (loading || !user || notifications.length === 0) {
      return;
    }

    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      return;
    }

    const displayedUnreadIds = notifications
      .filter(
        (item) =>
          !item.read &&
          pendingReadTokensRef.current.get(item.id) !== item.createdAt,
      )
      .map((item) => item.id);

    if (displayedUnreadIds.length > 0) {
      void markNotificationsAsRead(displayedUnreadIds);
    }
  }, [loading, user, notifications, markNotificationsAsRead]);

  return (
    <div className="mx-auto w-full max-w-3xl py-6 sm:py-8">

      {/* CABEÇALHO */}
      <div className="mb-6 flex items-center gap-3">

        <Link
          to="/"
          className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg motion-safe:transition-[color,background-color,transform] motion-safe:duration-150 motion-safe:active:scale-95 motion-reduce:transition-none motion-reduce:transform-none"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-5" />
        </Link>

        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">
            Todas as notificações
          </h1>

          <p className="mt-1 text-sm text-muted">
            Suas atividades recentes
          </p>
        </div>

      </div>

      {/* CARREGANDO */}
      {loading && (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-border bg-bg px-5 py-10">
          <p className="text-sm text-muted">
            Carregando notificações...
          </p>
        </div>
      )}

      {/* VAZIO */}
      {!loading &&
        notifications.length === 0 && (
          <div className="flex min-h-60 items-center justify-center rounded-xl border border-border bg-bg px-5 py-10 text-center">
            <div>
              <Bell className="mx-auto mb-4 size-8 text-muted" />

              <p className="text-sm font-medium">
                Nenhuma notificação
              </p>

              <p className="mt-1 text-xs text-muted">
                Quando alguém interagir com seu perfil, aparecerá aqui.
              </p>
            </div>
          </div>
        )}

      {/* LISTA */}
      {!loading &&
        notifications.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-bg">
            {notifications.map((notification) => (
              <NotificationItemCard
                key={notification.id}
                notification={notification}
                localAnimes={localAnimes}
                onMarkAsRead={(id) => void markNotificationsAsRead([id])}
              />
            ))}
          </div>
        )}

    </div>
  );
}
