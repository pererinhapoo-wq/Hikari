import { createContext, useContext, useSyncExternalStore } from "react";
import { authClient, authEnabled } from "./client";

/** Normalized user shape used across the app, auth on or off. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  profileNick?: string | null;
  /** True when this is the sandbox/dev fallback (auth not configured). */
  isDevFallback: boolean;
};

/**
 * Context populated by the root route SSR loader so authenticated cookie
 * sessions render immediately on SSR and first client paint without flashing
 * signed-out UI.
 */
export const InitialSessionUserContext = createContext<AppUser | null>(null);

const subscribeToNothing = () => () => {};
const getSignedOutSnapshot = (): boolean => {
  try {
    return window.sessionStorage.getItem("hikari_signed_out") === "true";
  } catch {
    return false;
  }
};
const getSignedOutServerSnapshot = (): boolean => false;
const getAdminEmailSnapshot = (): string | null => {
  try {
    return window.sessionStorage.getItem("hikari_preview_admin_email");
  } catch {
    return null;
  }
};
const getAdminEmailServerSnapshot = (): string | null => null;

/**
 * Stable fallback user, used ONLY when auth is disabled
 * (`VITE_AUTH_ENABLED=false`, the shipped default). With auth on, the sandbox
 * live preview does real sign-in via the baked preview client. Its id is
 * `"dev-user"` — the SAME id `verify.server.ts` returns server-side — so per-user
 * rows written in that mode belong to one consistent owner.
 */
export const DEV_USER: AppUser = {
  id: "dev-user",
  displayName: "Dev User",
  primaryEmail: "dev@example.com",
  profileImageUrl: null,
  profileNick: null,
  isDevFallback: true,
};

/** `useCurrentUserState()` result: the user plus the session-loading flag. */
export type CurrentUserState = {
  /** The user — `null` BOTH while the session loads and when signed out. */
  user: AppUser | null;
  /** True while the session is still resolving — don't treat `user: null` as signed out yet. */
  isPending: boolean;
};

export function useCurrentUserState(): CurrentUserState {
  const initialSessionUser = useContext(InitialSessionUserContext);

  if (!authEnabled) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- authEnabled is constant for the app's lifetime
    const isSignedOut = useSyncExternalStore(
      subscribeToNothing,
      getSignedOutSnapshot,
      getSignedOutServerSnapshot,
    );
    // eslint-disable-next-line react-hooks/rules-of-hooks -- authEnabled is constant for the app's lifetime
    const adminEmailOverride = useSyncExternalStore(
      subscribeToNothing,
      getAdminEmailSnapshot,
      getAdminEmailServerSnapshot,
    );

    if (isSignedOut) {
      return {
        user: null,
        isPending: false,
      };
    }
    if (adminEmailOverride) {
      return {
        user: {
          ...DEV_USER,
          primaryEmail: adminEmailOverride,
          displayName: "Admin Hikari",
          isDevFallback: false,
        },
        isPending: false,
      };
    }
    return {
      user: initialSessionUser ?? DEV_USER,
      isPending: false,
    };
  }
  const { data, isPending } = authClient.useSession();
  const user = data?.user;
  if (user) {
    const matchesInitial = initialSessionUser?.id === user.id;
    return {
      user: {
        id: user.id,
        displayName: user.name ?? (matchesInitial ? initialSessionUser.displayName : null) ?? null,
        primaryEmail: user.email ?? null,
        profileImageUrl:
          (matchesInitial && initialSessionUser.profileImageUrl) ||
          user.image ||
          null,
        profileNick: matchesInitial ? (initialSessionUser.profileNick ?? null) : null,
        isDevFallback: false,
      },
      isPending: false,
    };
  }

  // Enquanto o useSession() ainda está validando no cliente, preserva o usuário
  // já verificado via cookie no SSR para evitar flash de "Entrar".
  if (isPending && initialSessionUser) {
    return {
      user: initialSessionUser,
      isPending: false,
    };
  }

  return {
    user: null,
    isPending,
  };
}

/**
 * Convenience view of `useCurrentUserState().user` for display (e.g.
 * `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
 * for redirects/guards use `useCurrentUserState()` and check `isPending`.
 */
export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
