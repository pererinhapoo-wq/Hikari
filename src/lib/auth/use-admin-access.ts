import { useEffect, useState } from "react";
import { getCurrentAdminAccess } from "./admin-access.functions";
import { getBearerToken } from "./client";
import { useCurrentUserState, type AppUser } from "./use-current-user";

export type AdminAccessState = {
  user: AppUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isPending: boolean;
};

type CachedAdminAccess = {
  key: string;
  authenticated: boolean;
  isAdmin: boolean;
};

const clientAdminCache = new Map<string, CachedAdminAccess>();
const inFlightChecks = new Map<string, Promise<CachedAdminAccess>>();

function buildSessionCacheKey(userId: string): string {
  const token = typeof window !== "undefined" ? getBearerToken() : null;
  return `${userId}:${token ?? "cookie"}`;
}

async function resolveServerAdminAccess(userId: string): Promise<CachedAdminAccess> {
  const key = buildSessionCacheKey(userId);
  const existing = clientAdminCache.get(key);
  if (existing) return existing;

  let pending = inFlightChecks.get(key);
  if (!pending) {
    pending = getCurrentAdminAccess()
      .then((res) => {
        const entry: CachedAdminAccess = {
          key,
          authenticated: res.authenticated,
          isAdmin: res.isAdmin,
        };
        clientAdminCache.set(key, entry);
        return entry;
      })
      .catch(() => ({
        key,
        authenticated: false,
        isAdmin: false,
      }))
      .finally(() => {
        inFlightChecks.delete(key);
      });
    inFlightChecks.set(key, pending);
  }

  return pending;
}

/**
 * Hook seguro para verificar privilégios administrativos na interface do Hikari.
 *
 * - Usa o resultado `isAdmin` resolvido no servidor via SSR (`__root.tsx`) quando disponível.
 * - Em sessões client-side (ex: Bearer token em iframe de preview), consulta o servidor via
 *   `getCurrentAdminAccess()` para validar os 3 critérios (`ADMIN_USER_IDS`, `HIKARI_ADMIN_EMAILS`,
 *   `profile.role === 'admin'`).
 * - Nunca confia em `dev-user` nem em alterações manuais de `sessionStorage` / `localStorage`.
 */
export function useAdminAccess(): AdminAccessState {
  const { user, isPending: userPending } = useCurrentUserState();
  const [mounted, setMounted] = useState(false);

  const hasValidRealUser = Boolean(
    user && !user.isDevFallback && user.id && user.id !== "dev-user",
  );
  const hasServerFlag = Boolean(
    hasValidRealUser && typeof user?.isAdmin === "boolean",
  );
  const cacheKey = hasValidRealUser && user ? buildSessionCacheKey(user.id) : null;

  const [resolved, setResolved] = useState<CachedAdminAccess | null>(() =>
    cacheKey ? (clientAdminCache.get(cacheKey) ?? null) : null,
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || userPending || !hasValidRealUser || !user || hasServerFlag) {
      return;
    }

    const currentKey = buildSessionCacheKey(user.id);
    const cached = clientAdminCache.get(currentKey);
    if (cached) {
      setResolved(cached);
      return;
    }

    let cancelled = false;
    void resolveServerAdminAccess(user.id).then((res) => {
      if (!cancelled) {
        setResolved(res);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [mounted, userPending, hasValidRealUser, hasServerFlag, user]);

  if (!mounted || userPending) {
    return {
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      isPending: true,
    };
  }

  if (!user) {
    return {
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      isPending: false,
    };
  }

  // Conta fallback local / manipulação de sessionStorage nunca tem acesso admin
  if (!hasValidRealUser) {
    return {
      user,
      isAuthenticated: false,
      isAdmin: false,
      isPending: false,
    };
  }

  // Flag já validada pelo servidor no SSR (__root.tsx)
  if (hasServerFlag) {
    return {
      user,
      isAuthenticated: true,
      isAdmin: Boolean(user.isAdmin),
      isPending: false,
    };
  }

  // Aguarda verificação server-side para sessões resolvidas apenas no cliente (ex: Bearer token)
  if (!resolved || resolved.key !== cacheKey) {
    return {
      user,
      isAuthenticated: true,
      isAdmin: false,
      isPending: true,
    };
  }

  return {
    user,
    isAuthenticated: resolved.authenticated,
    isAdmin: resolved.authenticated && resolved.isAdmin,
    isPending: false,
  };
}
