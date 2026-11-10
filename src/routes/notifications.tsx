import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, CheckCheck, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  NotificationItemCard,
  type NotificationItem,
} from "@/components/notifications/notification-item-card";
import { getBearerToken } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useHikariStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
});

const PAGE_SIZE = 20;

function NotificationsPage() {
  const { user, isPending } = useCurrentUserState();
  const localAnimes = useHikariStore((s) => s.animes);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const filterRef = useRef<"all" | "unread">(filter);
  filterRef.current = filter;

  const offsetRef = useRef(0);

  const loadNotifications = useCallback(
    async (
      offsetToFetch = 0,
      append = false,
      showSpinner = false,
      forcedFilter?: "all" | "unread",
    ) => {
      if (!user) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      if (showSpinner) {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
      }

      try {
        const activeFilter = forcedFilter ?? filterRef.current;
        const bearer = getBearerToken();
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offsetToFetch),
          filter: activeFilter,
        });

        const response = await fetch(`/api/notifications?${params.toString()}`, {
          method: "GET",
          credentials: "include",
          headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
        });

        if (!response.ok) return;

        const data = (await response.json()) as {
          notifications?: NotificationItem[];
          unreadCount?: number;
          totalCount?: number;
          hasMore?: boolean;
        };

        const incomingList = data.notifications ?? [];
        if (append) {
          setNotifications((prev) => {
            const seen = new Set(prev.map((i) => i.id));
            const fresh = incomingList.filter((i) => !seen.has(i.id));
            return [...prev, ...fresh];
          });
        } else {
          setNotifications(incomingList);
        }

        offsetRef.current = offsetToFetch;
        setHasMore(Boolean(data.hasMore));
        setUnreadCount(Number(data.unreadCount ?? 0) || 0);
        setTotalCount(Number(data.totalCount ?? 0) || 0);
      } catch {
        if (!append) {
          setNotifications([]);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    offsetRef.current = 0;
    void loadNotifications(0, false, true, filter);

    const handleSync = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void loadNotifications(0, false, false);
    };

    window.addEventListener("focus", handleSync);
    document.addEventListener("visibilitychange", handleSync);
    window.addEventListener("hikari:notifications-updated", handleSync);

    return () => {
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleSync);
      window.removeEventListener("hikari:notifications-updated", handleSync);
    };
  }, [user, isPending, filter, loadNotifications]);

  const handleFilterChange = (newFilter: "all" | "unread") => {
    if (filter === newFilter) return;
    setFilter(newFilter);
    offsetRef.current = 0;
    setNotifications([]);
    void loadNotifications(0, false, true, newFilter);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    const nextOffset = notifications.length;
    void loadNotifications(nextOffset, true, true);
  };

  const handleMarkAsRead = async (id: string) => {
    if (!user) return;

    const target = notifications.find((i) => i.id === id);
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      const bearer = getBearerToken();
      const payload = target?.groupedIds?.length
        ? { ids: target.groupedIds }
        : { id };

      const response = await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = (await response.json()) as { unreadCount?: number };
        if (typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        }
        window.dispatchEvent(new CustomEvent("hikari:notifications-updated"));
      }
    } catch {
      // Falha não-bloqueante
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user || unreadCount === 0) return;

    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);

    try {
      const bearer = getBearerToken();
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify({ all: true }),
      });

      if (response.ok) {
        window.dispatchEvent(new CustomEvent("hikari:notifications-updated"));
      }
    } catch {
      void loadNotifications(0, false, false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!user) return;

    const target = notifications.find((i) => i.id === id);
    const wasUnread = target ? !target.read : false;
    const removedCount = target?.groupedIds?.length || 1;

    setNotifications((prev) => prev.filter((item) => item.id !== id));
    setTotalCount((t) => Math.max(0, t - removedCount));
    if (wasUnread) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    try {
      const bearer = getBearerToken();
      const response = target?.groupedIds?.length
        ? await fetch("/api/notifications", {
            method: "DELETE",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
            },
            body: JSON.stringify({ ids: target.groupedIds }),
          })
        : await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, {
            method: "DELETE",
            credentials: "include",
            headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
          });

      if (response.ok) {
        const data = (await response.json()) as { unreadCount?: number };
        if (typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        }
        window.dispatchEvent(new CustomEvent("hikari:notifications-updated"));
      }
    } catch {
      void loadNotifications(0, false, false);
    }
  };

  const handleDeleteAllNotifications = async () => {
    if (!user || notifications.length === 0) return;

    setNotifications([]);
    setUnreadCount(0);
    setTotalCount(0);
    setHasMore(false);
    setConfirmClearAll(false);

    try {
      const bearer = getBearerToken();
      const response = await fetch("/api/notifications?all=true", {
        method: "DELETE",
        credentials: "include",
        headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
      });

      if (response.ok) {
        window.dispatchEvent(new CustomEvent("hikari:notifications-updated"));
      }
    } catch {
      void loadNotifications(0, false, false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl py-6 sm:py-8">
      {/* CABEÇALHO */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-surface text-muted hover:border-[#a855f7]/40 hover:bg-elevated hover:text-fg motion-safe:transition-all motion-safe:duration-150 active:scale-95"
            aria-label="Voltar para a página inicial"
          >
            <ArrowLeft className="size-5" />
          </Link>

          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
              Notificações
            </h1>
            <p className="text-xs text-muted sm:text-sm">
              Suas atividades recentes e interações
            </p>
          </div>
        </div>

        {/* AÇÕES DE CABEÇALHO: MARCAR TODAS COMO LIDAS / LIMPAR */}
        {user && notifications.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#a855f7]/30 bg-[#a855f7]/10 px-3 py-1.5 text-xs font-semibold text-[#c084fc] hover:border-[#a855f7]/60 hover:bg-[#a855f7]/20 transition-all active:scale-95"
                title="Marcar todas as notificações como lidas"
              >
                <CheckCheck className="size-3.5" />
                <span>Marcar todas lidas</span>
              </button>
            )}

            {!confirmClearAll ? (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 transition-all active:scale-95"
                title="Excluir todas as notificações"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden sm:inline">Limpar todas</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs">
                <span className="text-rose-300 font-medium">Limpar tudo?</span>
                <button
                  type="button"
                  onClick={handleDeleteAllNotifications}
                  className="rounded bg-rose-600 px-2 py-0.5 font-bold text-white hover:bg-rose-500 transition-colors"
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="rounded border border-white/10 px-2 py-0.5 text-muted hover:text-fg transition-colors"
                >
                  Não
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ABAS DE FILTRO: TODAS / NÃO LIDAS */}
      <div className="mb-4 flex items-center gap-2 border-b border-border/80 pb-2">
        <button
          type="button"
          onClick={() => handleFilterChange("all")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all",
            filter === "all"
              ? "bg-[#a855f7]/20 text-[#c084fc] shadow-[0_0_12px_rgba(168,85,247,0.2)]"
              : "text-muted hover:bg-elevated hover:text-fg",
          )}
        >
          <span>Todas</span>
          {totalCount > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums",
                filter === "all"
                  ? "bg-[#a855f7] text-white"
                  : "bg-surface text-muted border border-border",
              )}
            >
              {totalCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleFilterChange("unread")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all",
            filter === "unread"
              ? "bg-[#a855f7]/20 text-[#c084fc] shadow-[0_0_12px_rgba(168,85,247,0.2)]"
              : "text-muted hover:bg-elevated hover:text-fg",
          )}
        >
          <span>Não lidas</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white tabular-nums">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* ESTADO CARREGANDO */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface/80 p-4 animate-pulse"
            >
              <div className="size-10 rounded-full bg-elevated shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-3/4 rounded bg-elevated" />
                <div className="h-3 w-1/3 rounded bg-elevated/70" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ESTADO VAZIO */}
      {!loading && notifications.length === 0 && (
        <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-border/80 bg-surface/50 px-5 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-elevated/80 text-muted shadow-inner mb-3">
            <Bell className="size-7" />
          </div>
          <p className="text-base font-semibold text-fg">
            {filter === "unread"
              ? "Nenhuma notificação não lida"
              : "Nenhuma notificação por enquanto"}
          </p>
          <p className="mt-1 max-w-sm text-xs text-muted sm:text-sm">
            {filter === "unread"
              ? "Você está em dia com todas as suas atividades e respostas."
              : "Quando alguém interagir com seus comentários, seguir você ou responder, aparecerá aqui."}
          </p>
          {filter === "unread" && (
            <button
              type="button"
              onClick={() => handleFilterChange("all")}
              className="mt-4 rounded-lg border border-border bg-elevated px-3.5 py-1.5 text-xs font-semibold text-fg hover:border-[#a855f7]/40 hover:bg-[#a855f7]/10 hover:text-[#c084fc] transition-colors"
            >
              Ver todas as notificações
            </button>
          )}
        </div>
      )}

      {/* LISTA DE NOTIFICAÇÕES */}
      {!loading && notifications.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface/70 shadow-sm backdrop-blur-sm divide-y divide-border/60">
            {notifications.map((notification) => (
              <NotificationItemCard
                key={notification.id}
                notification={notification}
                localAnimes={localAnimes}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDeleteNotification}
              />
            ))}
          </div>

          {/* BOTÃO CARREGAR MAIS */}
          {hasMore && (
            <div className="pt-3 text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-xs font-semibold text-fg hover:border-[#a855f7]/50 hover:bg-elevated hover:text-[#c084fc] disabled:opacity-50 transition-all active:scale-95"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-[#c084fc]" />
                    <span>Carregando mais...</span>
                  </>
                ) : (
                  <span>Carregar mais notificações</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
