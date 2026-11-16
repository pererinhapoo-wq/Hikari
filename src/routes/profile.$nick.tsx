import { lazy, startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Clock,
  Lock,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authEnabled, getBearerToken } from "@/lib/auth/client";

import {
  blockUser,
  cancelFollowRequest,
  followUser,
  getPublicActivities,
  getPublicComments,
  getPublicProfileBundle,
  unblockUser,
  unfollowUser,
  getPublicProfileFollowers,
  getPublicProfileFollowing,
  setUserVerification,
  type PublicProfileBundle,
  type PublicProfileComment,
  type PublicUserProfile,
  type UserActivityItem,
  type ProfileUser,
} from "@/lib/profile.functions";
import {
  getCachedPublicProfileBundle,
  getKnownViewerId,
  invalidateAccountProfileCache,
  invalidatePublicProfileCache,
  setCachedPublicProfileBundle,
  setKnownViewerId,
} from "@/lib/profile-client-cache";
import type { ProfileFavoritesGrouped } from "@/types/favorite";
import {
  STATUS_CONFIG,
  STATUS_ORDER,
  type TrackingStatus,
  type UserAnimeTrackingItem,
} from "@/types/profile-tracking";

import { ProfileIdentityHeader } from "@/components/profile/ProfileIdentityHeader";
import {
  ProfileNavRail,
  type ProfileSpace,
  type ProfileSpaceItem,
} from "@/components/profile/ProfileNavRail";

// Code-splitting dos componentes de abas, modais e visualizações secundárias
const LazyProfileOverviewSpace = lazy(() =>
  import("@/components/profile/ProfileOverviewSpace").then((m) => ({
    default: m.ProfileOverviewSpace,
  })),
);

const LazyProfileTrackingSpace = lazy(() =>
  import("@/components/profile/ProfileTrackingSpace").then((m) => ({
    default: m.ProfileTrackingSpace,
  })),
);

const TAB_PREFETCHERS: Record<ProfileSpace, () => void> = {
  overview: () => {
    void import("@/components/profile/ProfileOverviewSpace");
  },
  animes: () => {
    void import("@/components/profile/ProfileTrackingSpace");
  },
  comments: () => {
    void import("@/components/profile/ProfileCommentsSpace");
  },
  about: () => {
    void import("@/components/profile/ProfileAboutSpace");
  },
  activity: () => {
    void import("@/components/profile/ProfileHistorySpace");
  },
};

function OverviewSpaceSkeleton() {
  return (
    <div className="space-y-10 sm:space-y-12 animate-pulse min-h-[520px]">
      <div className="h-64 sm:h-72 rounded-3xl bg-white/[0.03] border border-white/[0.05]" />
      <div className="space-y-3">
        <div className="h-6 w-36 rounded bg-white/[0.05]" />
        <div className="h-44 rounded-2xl bg-white/[0.03] border border-white/[0.05]" />
      </div>
      <div className="space-y-3">
        <div className="h-6 w-44 rounded bg-white/[0.05]" />
        <div className="h-32 rounded-2xl bg-white/[0.03] border border-white/[0.05]" />
      </div>
    </div>
  );
}

// Code-splitting dos componentes de abas, modais e visualizações secundárias
const LazyProfileCommentsSpace = lazy(() =>
  import("@/components/profile/ProfileCommentsSpace").then((m) => ({
    default: m.ProfileCommentsSpace,
  })),
);

const LazyProfileAboutSpace = lazy(() =>
  import("@/components/profile/ProfileAboutSpace").then((m) => ({
    default: m.ProfileAboutSpace,
  })),
);

const LazyProfileHistorySpace = lazy(() =>
  import("@/components/profile/ProfileHistorySpace").then((m) => ({
    default: m.ProfileHistorySpace,
  })),
);

const LazyProfileConnectionsModal = lazy(() =>
  import("@/components/profile/ProfileConnectionsModal").then((m) => ({
    default: m.ProfileConnectionsModal,
  })),
);

const LazyProfileStudioWorksView = lazy(() =>
  import("@/components/anime/EntityWorksExpansion").then((m) => ({
    default: m.ProfileStudioWorksView,
  })),
);

const LazyDubladorWorksView = lazy(() =>
  import("@/components/anime/EntityWorksExpansion").then((m) => ({
    default: m.DubladorWorksView,
  })),
);

const LazyStaffWorksView = lazy(() =>
  import("@/components/anime/EntityWorksExpansion").then((m) => ({
    default: m.StaffWorksView,
  })),
);

// Skeletons específicos mantendo o layout e as dimensões dos componentes reais
function CommentsSpaceSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-48 rounded-lg bg-white/[0.05]" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-white/[0.05]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-32 rounded bg-white/[0.05]" />
                <div className="h-3 w-20 rounded bg-white/[0.04]" />
              </div>
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="h-4 w-full rounded bg-white/[0.04]" />
              <div className="h-4 w-3/4 rounded bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AboutSpaceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-3 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
        <div className="h-5 w-48 rounded bg-white/[0.05]" />
        <div className="flex flex-wrap gap-2 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 w-20 rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      </div>
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
        <div className="h-12 w-48 rounded-xl bg-white/[0.04]" />
      </div>
    </div>
  );
}

function HistorySpaceSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-44 rounded-lg bg-white/[0.05]" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <div className="size-9 shrink-0 rounded-full bg-white/[0.05]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-40 rounded bg-white/[0.05]" />
              <div className="h-3 w-24 rounded bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorksViewSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded-xl bg-white/[0.05]" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] rounded-2xl bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

interface PublicProfileSearchParams {
  tab?: "comments" | "activity" | "favorites";
  status?: TrackingStatus;
  studio?: string;
  studioId?: string;
  dublador?: string;
  dubladorId?: string;
  staff?: string;
  staffId?: string;
  person?: string;
  personId?: string;
}

export const Route = createFileRoute("/profile/$nick")({
  validateSearch: (raw: Record<string, unknown>): PublicProfileSearchParams => {
    const status =
      typeof raw.status === "string" &&
      STATUS_ORDER.includes(raw.status as TrackingStatus)
        ? (raw.status as TrackingStatus)
        : undefined;

    return {
      tab:
        raw.tab === "comments" || raw.tab === "activity" || raw.tab === "favorites"
          ? (raw.tab as "comments" | "activity" | "favorites")
          : undefined,
      status,
      studio:
        typeof raw.studio === "string" && raw.studio ? raw.studio : undefined,
    studioId:
      typeof raw.studioId === "string" && raw.studioId
        ? raw.studioId
        : typeof raw.studioId === "number"
          ? String(raw.studioId)
          : undefined,
    dublador:
      typeof raw.dublador === "string" && raw.dublador ? raw.dublador : undefined,
    dubladorId:
      typeof raw.dubladorId === "string" && raw.dubladorId
        ? raw.dubladorId
        : typeof raw.dubladorId === "number"
          ? String(raw.dubladorId)
          : undefined,
    staff:
      typeof raw.staff === "string" && raw.staff
        ? raw.staff
        : typeof raw.person === "string" && raw.person
          ? raw.person
          : undefined,
    staffId:
      typeof raw.staffId === "string" && raw.staffId
        ? raw.staffId
        : typeof raw.staffId === "number"
          ? String(raw.staffId)
          : typeof raw.personId === "string" && raw.personId
            ? raw.personId
            : typeof raw.personId === "number"
              ? String(raw.personId)
              : undefined,
    person:
      typeof raw.staff === "string" && raw.staff
        ? raw.staff
        : typeof raw.person === "string" && raw.person
          ? raw.person
          : undefined,
    personId:
      typeof raw.staffId === "string" && raw.staffId
        ? raw.staffId
        : typeof raw.staffId === "number"
          ? String(raw.staffId)
          : typeof raw.personId === "string" && raw.personId
            ? raw.personId
            : typeof raw.personId === "number"
              ? String(raw.personId)
              : undefined,
    };
  },
  loaderDeps: () => ({}),
  loader: async ({ params }) => {
    try {
      if (typeof window !== "undefined") {
        const hasBearer = Boolean(getBearerToken());
        const viewerKey = getKnownViewerId();
        if (!hasBearer || viewerKey) {
          const cached = getCachedPublicProfileBundle(viewerKey, params.nick);
          if (cached) {
            return { bundle: cached, errorMessage: null as string | null };
          }
        }
      }
      const bundle = await getPublicProfileBundle({
        data: { nick: params.nick },
      });
      if (typeof window !== "undefined") {
        if (bundle.viewerUserId) {
          setKnownViewerId(bundle.viewerUserId);
        }
        setCachedPublicProfileBundle(bundle.viewerUserId, params.nick, bundle);
      }
      return { bundle, errorMessage: null as string | null };
    } catch (err) {
      return {
        bundle: null as PublicProfileBundle | null,
        errorMessage:
          err instanceof Error ? err.message : "Erro ao carregar o perfil.",
      };
    }
  },
  component: PublicProfile,
});

const EMPTY_FAVORITES: string[] = [];
const EMPTY_FAVORITES_GROUPED: ProfileFavoritesGrouped = {
  anime: [],
  character: [],
  studio: [],
  company: [],
  person: [],
};

function PublicProfile() {
  const { nick } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user: currentUser, isPending: authPending } = useCurrentUserState();

  const [isClientReady, setIsClientReady] = useState(false);
  useEffect(() => {
    setIsClientReady(true);
  }, []);

  const urlStatus =
    search.status ||
    (typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("status") as TrackingStatus | null)
      : null);
  const statusParam =
    urlStatus && STATUS_ORDER.includes(urlStatus) ? urlStatus : undefined;
  const statusParamRef = useRef(statusParam);
  statusParamRef.current = statusParam;

  const studioParam =
    search.studio ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("studio") || undefined
      : undefined);
  const studioIdParam =
    search.studioId ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("studioId") || undefined
      : undefined);

  const dubladorParam =
    search.dublador ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("dublador") || undefined
      : undefined);
  const dubladorIdParam =
    search.dubladorId ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("dubladorId") || undefined
      : undefined);

  const staffParam =
    search.staff ||
    search.person ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("staff") ||
        new URLSearchParams(window.location.search).get("person") ||
        undefined
      : undefined);
  const staffIdParam =
    search.staffId ||
    search.personId ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("staffId") ||
        new URLSearchParams(window.location.search).get("personId") ||
        undefined
      : undefined);

  const getPublicProfileBundleFn = useServerFn(getPublicProfileBundle);
  const getPublicCommentsFn = useServerFn(getPublicComments);
  const getPublicActivitiesFn = useServerFn(getPublicActivities);
  const getFollowersFn = useServerFn(getPublicProfileFollowers);
  const getFollowingFn = useServerFn(getPublicProfileFollowing);

  const followUserFn = useServerFn(followUser);
  const unfollowUserFn = useServerFn(unfollowUser);
  const cancelFollowRequestFn = useServerFn(cancelFollowRequest);
  const blockUserFn = useServerFn(blockUser);
  const unblockUserFn = useServerFn(unblockUser);
  const setUserVerificationFn = useServerFn(setUserVerification);

  const getPublicProfileBundleFnRef = useRef(getPublicProfileBundleFn);
  getPublicProfileBundleFnRef.current = getPublicProfileBundleFn;
  const stableGetPublicProfileBundle = useCallback(
    (...args: Parameters<typeof getPublicProfileBundleFn>) =>
      getPublicProfileBundleFnRef.current(...args),
    [],
  );

  const getPublicCommentsFnRef = useRef(getPublicCommentsFn);
  getPublicCommentsFnRef.current = getPublicCommentsFn;
  const stableGetPublicComments = useCallback(
    (...args: Parameters<typeof getPublicCommentsFn>) =>
      getPublicCommentsFnRef.current(...args),
    [],
  );

  const getPublicActivitiesFnRef = useRef(getPublicActivitiesFn);
  getPublicActivitiesFnRef.current = getPublicActivitiesFn;
  const stableGetPublicActivities = useCallback(
    (...args: Parameters<typeof getPublicActivitiesFn>) =>
      getPublicActivitiesFnRef.current(...args),
    [],
  );

  const initialBundle = loaderData?.bundle ?? null;

  const [bundleViewerUserId, setBundleViewerUserId] = useState<string | null>(
    () => initialBundle?.viewerUserId ?? null,
  );
  const [profile, setProfile] = useState<PublicUserProfile | null>(
    () => initialBundle?.profile ?? null,
  );
  const [loading, setLoading] = useState<boolean>(
    () => !initialBundle && !loaderData?.errorMessage,
  );
  const [error, setError] = useState<string>(() => loaderData?.errorMessage ?? "");

  const [activeSpace, setActiveSpace] = useState<ProfileSpace>(() => {
    if (search.tab === "comments") return "comments";
    if (search.tab === "activity") return "activity";
    return "overview";
  });

  // Acompanhamento de animes para o Anime Stats do perfil visitado
  const [trackingItems, setTrackingItems] = useState<UserAnimeTrackingItem[]>(
    () => initialBundle?.trackingItems ?? [],
  );
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [statusCounts, setStatusCounts] = useState<Record<"all" | TrackingStatus, number> | null>(null);

  // Favoritos agrupados (necessários para a Visão Geral)
  const [favoritesGrouped, setFavoritesGrouped] = useState<ProfileFavoritesGrouped>(
    () => initialBundle?.favoritesGrouped ?? EMPTY_FAVORITES_GROUPED,
  );
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  // Comentários (Carregados progressivamente quando visíveis na visão geral ou ao abrir a aba)
  const [comments, setComments] = useState<PublicProfileComment[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsTotalPages, setCommentsTotalPages] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const commentsFetchingRef = useRef(false);

  // Atividades (Carregadas progressivamente: modo preview na Visão Geral, modo completo na aba)
  const [activities, setActivities] = useState<UserActivityItem[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [activityLoadedMode, setActivityLoadedMode] = useState<"none" | "preview" | "full">("none");
  const activityFetchingRef = useRef(false);

  // Ações sociais
  const [following, setFollowing] = useState(() => Boolean(initialBundle?.profile.isFollowing));
  const [followersCount, setFollowersCount] = useState(() => initialBundle?.profile.followersCount ?? 0);
  const [followLoading, setFollowLoading] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(() => Boolean(initialBundle?.profile.hasPendingRequest));

  // Bloqueio
  const [isBlockedByMe, setIsBlockedByMe] = useState(() => Boolean(initialBundle?.profile.isBlockedByMe));
  const [isBlockedByTarget, setIsBlockedByTarget] = useState(() => Boolean(initialBundle?.profile.isBlockedByTarget));
  const [blockLoading, setBlockLoading] = useState(false);

  // Modal de Conexões (Seguidores / Seguindo)
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connectionsTab, setConnectionsTab] = useState<"followers" | "following" | "requests">("followers");
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [followersList, setFollowersList] = useState<ProfileUser[]>([]);
  const [followingList, setFollowingList] = useState<ProfileUser[]>([]);
  const [followersPage, setFollowersPage] = useState(1);
  const [followersHasMore, setFollowersHasMore] = useState(false);
  const [followingPage, setFollowingPage] = useState(1);
  const [followingHasMore, setFollowingHasMore] = useState(false);
  const [connectionsLoadingMore, setConnectionsLoadingMore] = useState(false);

  const bundleRequestIdRef = useRef(0);
  const lastAppliedKeyRef = useRef<string | null>(
    initialBundle
      ? `${initialBundle.viewerUserId ?? "anon"}:${nick.trim().toLowerCase()}`
      : null,
  );

  const applyBundle = useCallback(
    (bundle: PublicProfileBundle) => {
      setBundleViewerUserId(bundle.viewerUserId);
      setProfile(bundle.profile);
      setFollowing(bundle.profile.isFollowing);
      setHasPendingRequest(Boolean(bundle.profile.hasPendingRequest));
      setFollowersCount(bundle.profile.followersCount);
      setIsBlockedByMe(Boolean(bundle.profile.isBlockedByMe));
      setIsBlockedByTarget(Boolean(bundle.profile.isBlockedByTarget));
      setTrackingItems(bundle.trackingItems || []);
      setFavoritesGrouped(bundle.favoritesGrouped || EMPTY_FAVORITES_GROUPED);
      setError("");
      setLoading(false);
      setTrackingLoading(false);
      setFavoritesLoading(false);
    },
    [],
  );

  const resetLazySections = useCallback(() => {
    setComments([]);
    setCommentsTotal(0);
    setCommentsPage(1);
    setCommentsTotalPages(1);
    setCommentsHasMore(false);
    setCommentsLoading(false);
    setCommentsLoaded(false);
    commentsFetchingRef.current = false;

    setActivities([]);
    setActivityTotal(0);
    setActivityPage(1);
    setActivityTotalPages(1);
    setActivityHasMore(false);
    setActivityLoading(false);
    setActivityLoadedMode("none");
    activityFetchingRef.current = false;
  }, []);

  // Sincroniza aba inicial caso venha via URL search ?tab=
  useEffect(() => {
    if (search.tab === "comments") setActiveSpace("comments");
    else if (search.tab === "activity") setActiveSpace("activity");
    else if (search.tab === "favorites") setActiveSpace("overview");
  }, [search.tab]);

  // Atualiza viewer conhecido para cache cliente isolado por sessão
  useEffect(() => {
    if (!isClientReady || authPending) return;
    setKnownViewerId(currentUser?.id ?? null);
  }, [isClientReady, authPending, currentUser?.id]);

  // Detecta se o SSR anônimo divergiu da sessão autenticada no cliente (ex: Bearer Token no Preview)
  const bearerPresent = isClientReady && Boolean(getBearerToken());
  const needsAuthRevalidation = Boolean(
    isClientReady &&
      ((bearerPresent && bundleViewerUserId === null) ||
        (authEnabled &&
          !authPending &&
          (currentUser?.id ?? null) !== (bundleViewerUserId ?? null))),
  );

  // Sincroniza troca de perfil (loaderData) ou revalidação de sessão no cliente sem duplicar chamadas
  useEffect(() => {
    if (!isClientReady) return;

    const normalizedNick = nick.trim().replace(/^@+/, "").toLowerCase();
    const targetKey = `${currentUser?.id ?? bundleViewerUserId ?? "anon"}:${normalizedNick}`;

    // Se o loader acabou de trazer um bundle fresco compatível com a sessão atual, apenas aplica
    if (
      loaderData?.bundle &&
      !needsAuthRevalidation &&
      loaderData.bundle.profile.nick.trim().replace(/^@+/, "").toLowerCase() === normalizedNick &&
      lastAppliedKeyRef.current !==
        `${loaderData.bundle.viewerUserId ?? "anon"}:${normalizedNick}`
    ) {
      lastAppliedKeyRef.current = `${loaderData.bundle.viewerUserId ?? "anon"}:${normalizedNick}`;
      setCachedPublicProfileBundle(loaderData.bundle.viewerUserId, nick, loaderData.bundle);
      resetLazySections();
      applyBundle(loaderData.bundle);
      return;
    }

    // Se o loader já retornou erro definitivo compatível com a sessão atual, não refaz chamada redundante
    if (loaderData?.errorMessage && !needsAuthRevalidation) {
      if (lastAppliedKeyRef.current !== targetKey) {
        lastAppliedKeyRef.current = targetKey;
        resetLazySections();
        setError(loaderData.errorMessage);
        setProfile(null);
        setLoading(false);
        setTrackingLoading(false);
        setFavoritesLoading(false);
      }
      return;
    }

    // Caso o perfil já esteja carregado e não haja mismatch de sessão ou mudança de nick, não refaz fetch
    if (!needsAuthRevalidation && lastAppliedKeyRef.current === targetKey) {
      return;
    }

    // Aguarda sessão pendente se já sabemos que há Bearer token sendo resolvido
    if (authEnabled && authPending && bearerPresent) {
      return;
    }

    const viewerCacheKey = currentUser?.id ?? null;
    if (!needsAuthRevalidation || viewerCacheKey) {
      const cached = getCachedPublicProfileBundle(viewerCacheKey, nick);
      if (cached && (!bearerPresent || cached.viewerUserId !== null)) {
        lastAppliedKeyRef.current = `${cached.viewerUserId ?? "anon"}:${normalizedNick}`;
        resetLazySections();
        applyBundle(cached);
        return;
      }
    }

    let active = true;
    const reqId = ++bundleRequestIdRef.current;
    setLoading(true);
    setError("");
    setStatusCounts(null);
    resetLazySections();

    void stableGetPublicProfileBundle({
      data: { nick },
    })
      .then((bundle) => {
        if (!active || reqId !== bundleRequestIdRef.current) return;
        if (bundle.viewerUserId) {
          setKnownViewerId(bundle.viewerUserId);
        }
        setCachedPublicProfileBundle(bundle.viewerUserId, nick, bundle);
        lastAppliedKeyRef.current = `${bundle.viewerUserId ?? "anon"}:${normalizedNick}`;
        applyBundle(bundle);
      })
      .catch((err) => {
        if (!active || reqId !== bundleRequestIdRef.current) return;
        lastAppliedKeyRef.current = targetKey;
        setError(err instanceof Error ? err.message : "Erro ao carregar o perfil.");
        setProfile(null);
        setLoading(false);
        setTrackingLoading(false);
        setFavoritesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    isClientReady,
    nick,
    loaderData,
    needsAuthRevalidation,
    authPending,
    bearerPresent,
    currentUser?.id,
    bundleViewerUserId,
    applyBundle,
    resetLazySections,
    stableGetPublicProfileBundle,
  ]);

  // Redirecionamento preservado para o próprio perfil (/profile/$nick -> /account)
  useEffect(() => {
    if (!isClientReady || !profile?.isOwner) return;
    void navigate({
      to: "/account",
      search: statusParamRef.current ? { status: statusParamRef.current } : undefined,
      replace: true,
    });
  }, [isClientReady, profile?.isOwner, navigate]);

  const loadCommentsFirstPage = useCallback(
    (targetProfile: PublicUserProfile) => {
      if (
        !targetProfile.userId ||
        !targetProfile.canViewComments ||
        commentsLoaded ||
        commentsFetchingRef.current
      ) {
        return;
      }

      commentsFetchingRef.current = true;
      setCommentsLoading(true);
      const targetUserId = targetProfile.userId;

      void stableGetPublicComments({
        data: {
          userId: targetUserId,
          page: 1,
          limit: 15,
        },
      })
        .then((res) => {
          setComments(res.items);
          setCommentsTotal(res.total);
          setCommentsPage(res.page);
          setCommentsTotalPages(res.totalPages);
          setCommentsHasMore(res.hasMore);
          setCommentsLoaded(true);
        })
        .catch((err) => {
          console.warn("Erro ao buscar comentários públicos:", err);
        })
        .finally(() => {
          commentsFetchingRef.current = false;
          setCommentsLoading(false);
        });
    },
    [commentsLoaded, stableGetPublicComments],
  );

  const loadActivitiesFirstPage = useCallback(
    (targetProfile: PublicUserProfile, mode: "preview" | "full") => {
      if (
        !targetProfile.userId ||
        !targetProfile.canViewHistory ||
        activityFetchingRef.current
      ) {
        return;
      }

      if (mode === "preview" && activityLoadedMode !== "none") {
        return;
      }
      if (mode === "full" && activityLoadedMode === "full") {
        return;
      }

      // Se a prévia já carregou todos os registros (< 6), promove para completo sem chamada extra
      if (mode === "full" && activityLoadedMode === "preview" && !activityHasMore) {
        setActivityLoadedMode("full");
        setActivityTotal(activities.length);
        setActivityTotalPages(1);
        return;
      }

      activityFetchingRef.current = true;
      setActivityLoading(true);

      const isPreview = mode === "preview";
      void stableGetPublicActivities({
        data: {
          userId: targetProfile.userId,
          page: 1,
          limit: isPreview ? 6 : 15,
          preview: isPreview,
        },
      })
        .then((act) => {
          setActivities(act.items);
          setActivityTotal(act.total);
          setActivityPage(act.page);
          setActivityTotalPages(act.totalPages);
          setActivityHasMore(act.hasMore);
          setActivityLoadedMode(isPreview ? "preview" : "full");
        })
        .catch((err) => {
          console.warn("Erro ao buscar atividades públicas:", err);
        })
        .finally(() => {
          activityFetchingRef.current = false;
          setActivityLoading(false);
        });
    },
    [activityLoadedMode, activityHasMore, activities.length, stableGetPublicActivities],
  );

  // Carregamento sob demanda somente ao abrir as abas "comments" ou "activity"
  useEffect(() => {
    if (!profile || profile.isOwner || needsAuthRevalidation) return;
    if (activeSpace === "comments") {
      loadCommentsFirstPage(profile);
    } else if (activeSpace === "activity") {
      loadActivitiesFirstPage(profile, "full");
    }
  }, [
    profile,
    needsAuthRevalidation,
    activeSpace,
    loadCommentsFirstPage,
    loadActivitiesFirstPage,
  ]);

  // Carregamento progressivo disparado por IntersectionObserver na seção abaixo da dobra
  const handleRecentActivitiesNearVisible = useCallback(() => {
    if (!profile || profile.isOwner || needsAuthRevalidation) return;
    if (profile.canViewHistory) {
      loadActivitiesFirstPage(profile, "preview");
    }
    if (profile.canViewComments) {
      loadCommentsFirstPage(profile);
    }
  }, [
    profile,
    needsAuthRevalidation,
    loadActivitiesFirstPage,
    loadCommentsFirstPage,
  ]);

  // Paginação e carregamento incremental de comentários/atividades preservados abaixo

  const handleFollowToggle = useCallback(async () => {
    if (!profile || followLoading) return;
    setFollowLoading(true);

    try {
      if (following) {
        await unfollowUserFn({ data: { targetUserId: profile.userId } });
        setFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
        invalidatePublicProfileCache(profile.nick);
        invalidatePublicProfileCache(nick);
        invalidateAccountProfileCache(currentUser?.id);
        toast.success(`Você deixou de seguir @${profile.nick}`);
      } else if (hasPendingRequest) {
        await cancelFollowRequestFn({ data: { targetUserId: profile.userId } });
        setHasPendingRequest(false);
        invalidatePublicProfileCache(profile.nick);
        invalidatePublicProfileCache(nick);
        toast.info("Solicitação para seguir cancelada.");
      } else {
        const res = await followUserFn({ data: { targetUserId: profile.userId } });
        invalidatePublicProfileCache(profile.nick);
        invalidatePublicProfileCache(nick);
        invalidateAccountProfileCache(currentUser?.id);
        if (res.status === "requested") {
          setHasPendingRequest(true);
          toast.success("Solicitação enviada.");
        } else {
          setFollowing(true);
          setFollowersCount((prev) => prev + 1);
          toast.success(`Você começou a seguir @${profile.nick}`);
        }
      }
    } catch (err) {
      console.error("Erro ao alterar seguidor:", err);
      toast.error(err instanceof Error ? err.message : "Não foi possível realizar esta ação.");
    } finally {
      setFollowLoading(false);
    }
  }, [
    profile,
    nick,
    currentUser?.id,
    followLoading,
    following,
    hasPendingRequest,
    unfollowUserFn,
    cancelFollowRequestFn,
    followUserFn,
  ]);

  const handleToggleBlock = useCallback(async () => {
    if (!profile || blockLoading) return;
    setBlockLoading(true);

    try {
      if (isBlockedByMe) {
        await unblockUserFn({ data: { targetUserId: profile.userId } });
        setIsBlockedByMe(false);
        invalidatePublicProfileCache(profile.nick);
        invalidatePublicProfileCache(nick);
        invalidateAccountProfileCache(currentUser?.id);
        toast.success(`Usuário @${profile.nick} desbloqueado com sucesso.`);
      } else {
        await blockUserFn({ data: { targetUserId: profile.userId } });
        setIsBlockedByMe(true);
        setFollowing(false);
        invalidatePublicProfileCache(profile.nick);
        invalidatePublicProfileCache(nick);
        invalidateAccountProfileCache(currentUser?.id);
        toast.success(`Usuário @${profile.nick} bloqueado.`);
      }
    } catch (err) {
      console.error("Erro ao atualizar bloqueio:", err);
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar o bloqueio.");
    } finally {
      setBlockLoading(false);
    }
  }, [profile, nick, currentUser?.id, blockLoading, isBlockedByMe, unblockUserFn, blockUserFn]);

  const handleToggleVerification = useCallback(async () => {
    if (!profile) return;
    const newVerified = !profile.isVerified;
    try {
      await setUserVerificationFn({
        data: {
          targetUserId: profile.userId,
          isVerified: newVerified,
        },
      });
      setProfile((prev) => (prev ? { ...prev, isVerified: newVerified } : prev));
      invalidatePublicProfileCache(profile.nick);
      invalidatePublicProfileCache(nick);
      invalidateAccountProfileCache(profile.userId);
      toast.success(
        newVerified
          ? `Selo de verificado concedido a @${profile.nick}.`
          : `Selo de verificado removido de @${profile.nick}.`,
      );
    } catch (err) {
      console.error("Erro ao alterar verificação:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Não foi possível alterar o selo de verificação.",
      );
    }
  }, [profile, nick, setUserVerificationFn]);

  const handleFollowBack = async (targetUserId: string) => {
    try {
      const res = await followUserFn({ data: { targetUserId } });
      if (res.status === "following") {
        setFollowersList((prev) =>
          prev.map((p) =>
            p.userId === targetUserId
              ? { ...p, isFollowing: true, hasPendingRequest: false }
              : p,
          ),
        );
        setFollowingList((prev) =>
          prev.map((p) =>
            p.userId === targetUserId
              ? { ...p, isFollowing: true, hasPendingRequest: false }
              : p,
          ),
        );
        toast.success("Você agora está seguindo este usuário.");
      } else if (res.status === "requested") {
        setFollowersList((prev) =>
          prev.map((p) =>
            p.userId === targetUserId ? { ...p, hasPendingRequest: true } : p,
          ),
        );
        setFollowingList((prev) =>
          prev.map((p) =>
            p.userId === targetUserId ? { ...p, hasPendingRequest: true } : p,
          ),
        );
        toast.info("Solicitação para seguir enviada.");
      }
    } catch (err) {
      console.error("Erro ao seguir de volta:", err);
      toast.error(
        err instanceof Error ? err.message : "Não foi possível seguir o usuário.",
      );
    }
  };

  const handleLoadMoreComments = useCallback(async () => {
    if (
      !profile?.userId ||
      !profile.canViewComments ||
      commentsFetchingRef.current ||
      !commentsHasMore ||
      commentsLoadingMore
    ) {
      return;
    }
    commentsFetchingRef.current = true;
    setCommentsLoadingMore(true);

    const nextPage = commentsPage + 1;
    try {
      const res = await getPublicCommentsFn({
        data: {
          userId: profile.userId,
          page: nextPage,
          limit: 15,
        },
      });
      setComments((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const uniqueNew = res.items.filter((c) => !existingIds.has(c.id));
        return [...prev, ...uniqueNew];
      });
      setCommentsPage(nextPage);
      setCommentsTotal(res.total);
      setCommentsTotalPages(res.totalPages);
      setCommentsHasMore(res.hasMore);
    } catch (err) {
      console.warn("Erro ao carregar mais comentários públicos:", err);
    } finally {
      commentsFetchingRef.current = false;
      setCommentsLoadingMore(false);
    }
  }, [
    profile?.userId,
    profile?.canViewComments,
    commentsHasMore,
    commentsLoadingMore,
    commentsPage,
    getPublicCommentsFn,
  ]);

  const handleLoadMoreActivities = useCallback(async () => {
    if (
      !profile?.userId ||
      !profile.canViewHistory ||
      activityFetchingRef.current ||
      !activityHasMore ||
      activityLoadingMore
    ) {
      return;
    }
    activityFetchingRef.current = true;
    setActivityLoadingMore(true);

    const nextPage = activityPage + 1;
    try {
      const act = await getPublicActivitiesFn({
        data: {
          userId: profile.userId,
          page: nextPage,
          limit: 15,
        },
      });
      setActivities((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const uniqueNew = act.items.filter((a) => !existingIds.has(a.id));
        return [...prev, ...uniqueNew];
      });
      setActivityPage(nextPage);
      setActivityTotal(act.total);
      setActivityTotalPages(act.totalPages);
      setActivityHasMore(act.hasMore);
    } catch (err) {
      console.warn("Erro ao carregar mais atividades públicas:", err);
    } finally {
      activityFetchingRef.current = false;
      setActivityLoadingMore(false);
    }
  }, [
    profile?.userId,
    profile?.canViewHistory,
    activityHasMore,
    activityLoadingMore,
    activityPage,
    getPublicActivitiesFn,
  ]);

  const handleCommentsPageChange = useCallback(
    async (newPage: number) => {
      if (!profile || !profile.canViewComments || commentsLoading) return;
      setCommentsLoading(true);
      try {
        const res = await getPublicCommentsFn({
          data: {
            userId: profile.userId,
            page: newPage,
            limit: 15,
          },
        });
        setComments(res.items);
        setCommentsPage(res.page);
        setCommentsTotalPages(res.totalPages);
        setCommentsHasMore(res.hasMore);
      } catch (err) {
        console.error("Erro ao paginar comentários:", err);
      } finally {
        setCommentsLoading(false);
      }
    },
    [profile, commentsLoading, getPublicCommentsFn],
  );

  const handleActivityPageChange = useCallback(
    async (newPage: number) => {
      if (!profile || !profile.canViewHistory || activityLoading) return;
      setActivityLoading(true);
      try {
        const act = await getPublicActivitiesFn({
          data: {
            userId: profile.userId,
            page: newPage,
            limit: 15,
          },
        });
        setActivities(act.items);
        setActivityPage(act.page);
        setActivityTotalPages(act.totalPages);
        setActivityHasMore(act.hasMore);
      } catch (err) {
        console.error("Erro ao paginar atividades:", err);
      } finally {
        setActivityLoading(false);
      }
    },
    [profile, activityLoading, getPublicActivitiesFn],
  );

  const handleOpenConnections = useCallback(
    async (tab: "followers" | "following") => {
      if (!profile?.userId) return;
      setConnectionsTab(tab);
      setConnectionsOpen(true);
      setConnectionsLoading(true);
      try {
        if (tab === "followers") {
          setFollowersPage(1);
          const data = await getFollowersFn({
            data: {
              userId: profile.userId,
              page: 1,
              limit: 20,
            },
          });
          const items = Array.isArray(data) ? data : (data?.items ?? []);
          const hasMore = Array.isArray(data) ? false : Boolean(data?.hasMore);
          setFollowersList(items);
          setFollowersHasMore(hasMore);
        } else {
          setFollowingPage(1);
          const data = await getFollowingFn({
            data: {
              userId: profile.userId,
              page: 1,
              limit: 20,
            },
          });
          const items = Array.isArray(data) ? data : (data?.items ?? []);
          const hasMore = Array.isArray(data) ? false : Boolean(data?.hasMore);
          setFollowingList(items);
          setFollowingHasMore(hasMore);
        }
      } catch (err) {
        console.warn("Erro ao buscar conexões:", err);
        if (tab === "followers") {
          setFollowersList([]);
          setFollowersHasMore(false);
        } else {
          setFollowingList([]);
          setFollowingHasMore(false);
        }
      } finally {
        setConnectionsLoading(false);
      }
    },
    [profile?.userId, getFollowersFn, getFollowingFn],
  );

  const handleLoadMoreFollowers = useCallback(async () => {
    if (!profile?.userId || connectionsLoadingMore || !followersHasMore) return;
    setConnectionsLoadingMore(true);
    try {
      const nextPage = followersPage + 1;
      const data = await getFollowersFn({
        data: {
          userId: profile.userId,
          page: nextPage,
          limit: 20,
        },
      });
      const newItems = Array.isArray(data) ? data : (data?.items ?? []);
      const hasMore = Array.isArray(data) ? false : Boolean(data?.hasMore);
      setFollowersList((prev) => {
        const existingIds = new Set(prev.map((u) => u.userId));
        const filtered = newItems.filter((u) => !existingIds.has(u.userId));
        return [...prev, ...filtered];
      });
      setFollowersPage(nextPage);
      setFollowersHasMore(hasMore);
    } catch (err) {
      console.warn("Erro ao carregar mais seguidores:", err);
    } finally {
      setConnectionsLoadingMore(false);
    }
  }, [profile?.userId, connectionsLoadingMore, followersHasMore, followersPage, getFollowersFn]);

  const handleLoadMoreFollowing = useCallback(async () => {
    if (!profile?.userId || connectionsLoadingMore || !followingHasMore) return;
    setConnectionsLoadingMore(true);
    try {
      const nextPage = followingPage + 1;
      const data = await getFollowingFn({
        data: {
          userId: profile.userId,
          page: nextPage,
          limit: 20,
        },
      });
      const newItems = Array.isArray(data) ? data : (data?.items ?? []);
      const hasMore = Array.isArray(data) ? false : Boolean(data?.hasMore);
      setFollowingList((prev) => {
        const existingIds = new Set(prev.map((u) => u.userId));
        const filtered = newItems.filter((u) => !existingIds.has(u.userId));
        return [...prev, ...filtered];
      });
      setFollowingPage(nextPage);
      setFollowingHasMore(hasMore);
    } catch (err) {
      console.warn("Erro ao carregar mais seguidos:", err);
    } finally {
      setConnectionsLoadingMore(false);
    }
  }, [profile?.userId, connectionsLoadingMore, followingHasMore, followingPage, getFollowingFn]);

  const handleOpenFollowers = useCallback(() => {
    void handleOpenConnections("followers");
  }, [handleOpenConnections]);

  const handleOpenFollowing = useCallback(() => {
    void handleOpenConnections("following");
  }, [handleOpenConnections]);

  const headerActions = useMemo(() => {
    if (isBlockedByMe || isBlockedByTarget) return null;
    return (
      <button
        type="button"
        onClick={handleFollowToggle}
        disabled={followLoading}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 select-none shadow-sm cursor-pointer",
          following
            ? "border border-white/15 bg-white/[0.08] text-zinc-200 hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-300"
            : hasPendingRequest
              ? "border border-amber-500/30 bg-amber-500/15 text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/20"
              : "bg-violet-600 text-white hover:bg-violet-500 active:scale-95 shadow-[0_0_15px_rgba(139,92,246,0.3)]",
        )}
      >
        {following ? (
          <>
            <UserCheck className="size-4 text-emerald-400" />
            <span>Seguindo</span>
          </>
        ) : hasPendingRequest ? (
          <>
            <Clock className="size-4 text-amber-400" />
            <span>Solicitado</span>
          </>
        ) : (
          <>
            <UserPlus className="size-4" />
            <span>{profile?.isFollowedBy ? "Seguir de volta" : "Seguir"}</span>
          </>
        )}
      </button>
    );
  }, [
    isBlockedByMe,
    isBlockedByTarget,
    handleFollowToggle,
    followLoading,
    following,
    hasPendingRequest,
    profile?.isFollowedBy,
  ]);

  const handleConnectionsTabChange = async (tab: "followers" | "following" | "requests") => {
    if (!profile?.userId) return;
    setConnectionsTab(tab);
    setConnectionsLoading(true);
    try {
      if (tab === "followers") {
        setFollowersPage(1);
        const data = await getFollowersFn({
          data: {
            userId: profile.userId,
            page: 1,
            limit: 20,
          },
        });
        const items = Array.isArray(data) ? data : (data?.items ?? []);
        const hasMore = Array.isArray(data) ? false : Boolean(data?.hasMore);
        setFollowersList(items);
        setFollowersHasMore(hasMore);
      } else if (tab === "following") {
        setFollowingPage(1);
        const data = await getFollowingFn({
          data: {
            userId: profile.userId,
            page: 1,
            limit: 20,
          },
        });
        const items = Array.isArray(data) ? data : (data?.items ?? []);
        const hasMore = Array.isArray(data) ? false : Boolean(data?.hasMore);
        setFollowingList(items);
        setFollowingHasMore(hasMore);
      }
    } catch (err) {
      console.warn("Erro ao alternar conexões:", err);
      if (tab === "followers") {
        setFollowersList([]);
        setFollowersHasMore(false);
      } else if (tab === "following") {
        setFollowingList([]);
        setFollowingHasMore(false);
      }
    } finally {
      setConnectionsLoading(false);
    }
  };

  // Preservação de posição de scroll isolada por aba
  const scrollPositionsRef = useRef<Partial<Record<ProfileSpace, number>>>({});

  const handleSpaceChange = useCallback(
    (nextSpace: ProfileSpace) => {
      if (typeof window !== "undefined") {
        scrollPositionsRef.current[activeSpace] = window.scrollY;
      }
      startTransition(() => {
        setActiveSpace(nextSpace);
      });
    },
    [activeSpace],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const targetY = scrollPositionsRef.current[activeSpace];
    if (typeof targetY === "number") {
      requestAnimationFrame(() => {
        window.scrollTo({ top: targetY, behavior: "instant" });
      });
    }
  }, [activeSpace]);

  const handlePrefetchSpace = useCallback((space: ProfileSpace) => {
    TAB_PREFETCHERS[space]?.();
  }, []);

  if (studioParam) {
    return (
      <Suspense fallback={<WorksViewSkeleton />}>
        <LazyProfileStudioWorksView
          studioName={studioParam}
          studioId={studioIdParam}
          onClear={() => {
            void (navigate as any)({
              to: "/profile/$nick",
              params: { nick },
              search: (prev: any) => {
                const next = { ...prev };
                delete next.studio;
                delete next.studioId;
                return next;
              },
            });
          }}
        />
      </Suspense>
    );
  }

  if (dubladorParam) {
    return (
      <Suspense fallback={<WorksViewSkeleton />}>
        <LazyDubladorWorksView
          dubladorName={dubladorParam}
          dubladorId={dubladorIdParam}
          onClear={() => {
            void (navigate as any)({
              to: "/profile/$nick",
              params: { nick },
              search: (prev: any) => {
                const next = { ...prev };
                delete next.dublador;
                delete next.dubladorId;
                return next;
              },
            });
          }}
        />
      </Suspense>
    );
  }

  if (staffParam) {
    return (
      <Suspense fallback={<WorksViewSkeleton />}>
        <LazyStaffWorksView
          staffName={staffParam}
          staffId={staffIdParam}
          onClear={() => {
            void (navigate as any)({
              to: "/profile/$nick",
              params: { nick },
              search: (prev: any) => {
                const next = { ...prev };
                delete next.staff;
                delete next.staffId;
                delete next.person;
                delete next.personId;
                return next;
              },
            });
          }}
        />
      </Suspense>
    );
  }

  if (loading || needsAuthRevalidation || profile?.isOwner) {
    return (
      <div className="w-full px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="h-64 animate-pulse rounded-3xl bg-white/[0.04]" />
          <div className="h-14 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl bg-white/[0.04]"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-white">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white mb-6"
        >
          <ArrowLeft className="size-4" />
          Voltar ao início
        </Link>

        <div className="rounded-3xl border border-red-500/20 bg-[#0d0c18] p-8 text-center shadow-xl">
          <Users className="mx-auto size-12 text-red-400 mb-3" />
          <h1 className="text-xl font-bold text-white">
            Perfil não encontrado
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {error || "O perfil solicitado não existe ou não está mais disponível."}
          </p>
        </div>
      </div>
    );
  }

  // Se o perfil visitado for aberto com parâmetro de status (clicando em Anime Stats),
  // exibe a lista filtrada somente leitura do usuário visitado respeitando privacidade e bloqueios.
  if (
    statusParam &&
    STATUS_CONFIG[statusParam] &&
    profile.canViewContent &&
    !isBlockedByTarget &&
    !isBlockedByMe
  ) {
    const cfg = STATUS_CONFIG[statusParam];
    const filteredCount =
      statusCounts?.[statusParam] ??
      trackingItems.filter((i) => i.status === statusParam).length;

    return (
      <div
        key={statusParam}
        className="anime-stats-category-enter relative min-h-[80vh] w-full pb-16 pt-6 sm:pt-8"
      >
        <div
          className="pointer-events-none absolute -left-20 top-0 size-96 rounded-full bg-violet-600/10 blur-[120px]"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
            <div className="flex items-center gap-3">
              <span className={`size-3.5 rounded-full ${cfg.indicatorDot}`} />
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Animes — {cfg.label}
              </h1>
              {(!trackingLoading || statusCounts !== null) && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-zinc-300">
                  {filteredCount}
                </span>
              )}
            </div>
          </div>

          <Suspense fallback={<WorksViewSkeleton />}>
            <LazyProfileTrackingSpace
              targetUserId={profile.userId}
              readOnly={true}
              activeFilter={statusParam}
              hideFilterBar={true}
              onCountsChange={setStatusCounts}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  const displayName = profile.name || profile.nick;
  const userNick = profile.nick;
  const userBio = profile.bio || "";
  const userImage = profile.image;
  const followingCount = profile.followingCount ?? 0;
  const userFavoritesList = (profile as { favorites?: string[] }).favorites ?? EMPTY_FAVORITES;
  const effectiveCommentCount = commentsLoaded ? commentsTotal : profile.commentCount;
  const effectiveActivityCount =
    activityLoadedMode === "full" || (activityLoadedMode === "preview" && !activityHasMore)
      ? activityTotal
      : 0;
  const overviewRecentActivitiesLoaded =
    (!profile.canViewHistory || activityLoadedMode !== "none") &&
    (!profile.canViewComments || commentsLoaded);

  // Espaços públicos baseados em permissões de privacidade
  const publicSpaces: ProfileSpaceItem[] = [
    { id: "overview", label: "Visão Geral" },
    ...(profile.canViewComments
      ? [{ id: "comments" as const, label: "Comentários", count: effectiveCommentCount }]
      : []),
    { id: "about", label: "Sobre" },
    ...(profile.canViewHistory
      ? [{ id: "activity" as const, label: "Atividades", count: effectiveActivityCount }]
      : []),
  ];

  return (
    <div className="w-full text-zinc-100 pt-1 sm:pt-3">
      <div className="mx-auto w-full max-w-6xl px-1 sm:px-2 space-y-7">
        {/* Cabeçalho do Perfil: Banner, Avatar, Nome, Username, Bio, Seguidores e Ações */}
        <ProfileIdentityHeader
          name={displayName}
          nick={userNick}
          bio={userBio}
          image={userImage}
          bannerUrl={profile.bannerUrl || null}
          accountType={profile.accountType}
          isOwner={false}
          isVerified={Boolean(profile.isVerified)}
          canManageVerification={Boolean(profile.canManageVerification)}
          onToggleVerification={handleToggleVerification}
          followersCount={followersCount}
          followingCount={followingCount}
          commentCount={effectiveCommentCount}
          totalTrackingCount={trackingItems.length}
          favorites={userFavoritesList}
          isBlockedByMe={isBlockedByMe}
          onBlockAction={handleToggleBlock}
          actions={headerActions}
          onOpenFollowers={handleOpenFollowers}
          onOpenFollowing={handleOpenFollowing}
        />

        {/* Notificação se o usuário estiver bloqueado */}
        {isBlockedByTarget && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-white/[0.08] bg-[#0c0b14]/70 p-12 text-center backdrop-blur-xl">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/20 mb-4">
              <UserX className="size-8 text-rose-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Perfil Indisponível</h3>
            <p className="max-w-md text-sm text-zinc-400">
              Não foi possível carregar as informações deste usuário.
            </p>
          </div>
        )}

        {isBlockedByMe && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-white/[0.08] bg-[#0c0b14]/70 p-12 text-center backdrop-blur-xl">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/20 mb-4">
              <UserX className="size-8 text-rose-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Usuário Bloqueado</h3>
            <p className="max-w-md text-sm text-zinc-400 mb-6">
              Você bloqueou @{profile.nick}. As atividades e publicações deste perfil estão ocultas.
            </p>
            <button
              type="button"
              onClick={handleToggleBlock}
              disabled={blockLoading}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white transition hover:bg-violet-500 cursor-pointer"
            >
              Desbloquear Usuário
            </button>
          </div>
        )}

        {!isBlockedByTarget && !isBlockedByMe && (
          <>
            {/* Navegação Horizontal do Perfil */}
            <ProfileNavRail
              activeSpace={activeSpace}
              onChangeSpace={handleSpaceChange}
              onPrefetchSpace={handlePrefetchSpace}
              counts={{
                animes: trackingItems.length,
                comments: effectiveCommentCount,
                activity: effectiveActivityCount,
              }}
              spaces={publicSpaces}
            />

            {/* Conteúdo da Aba Ativa */}
            <section aria-label="Conteúdo da Aba Ativa" className="relative z-10">
              {/* Se o perfil for privado e o visitante não seguir */}
              {!profile.canViewContent ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-white/[0.08] bg-[#0c0b14]/70 p-12 text-center backdrop-blur-xl">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-white/[0.05] ring-1 ring-white/10 mb-4">
                    <Lock className="size-8 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Esta conta é privada</h3>
                  <p className="max-w-md text-sm text-zinc-400 mb-6">
                    Siga esta conta para ver suas postagens, atividades, lista de favoritos e comentários.
                  </p>
                  {!following && (
                    <button
                      type="button"
                      onClick={handleFollowToggle}
                      disabled={followLoading}
                      className={cn(
                        "rounded-xl px-5 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer",
                        hasPendingRequest
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-600/30",
                      )}
                    >
                      {hasPendingRequest
                        ? "Solicitação enviada"
                        : profile.isFollowedBy
                          ? "Seguir de volta"
                          : "Seguir esta conta"}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Aba 1: Visão Geral */}
                  {activeSpace === "overview" && (
                    <Suspense fallback={<OverviewSpaceSkeleton />}>
                      <LazyProfileOverviewSpace
                        trackingItems={trackingItems}
                        favoritesGrouped={favoritesGrouped}
                        activityItems={activities}
                        comments={comments}
                        trackingLoading={trackingLoading}
                        favoritesLoading={favoritesLoading}
                        activitiesLoading={activityLoading || commentsLoading}
                        activitiesLoaded={overviewRecentActivitiesLoaded}
                        onRecentActivitiesNearVisible={handleRecentActivitiesNearVisible}
                        profileNick={profile.nick}
                        isOwner={false}
                      />
                    </Suspense>
                  )}

                  {/* Aba 2: Comentários */}
                  {activeSpace === "comments" && (
                    <Suspense fallback={<CommentsSpaceSkeleton />}>
                      <LazyProfileCommentsSpace
                        comments={comments}
                        total={commentsTotal}
                        page={commentsPage}
                        totalPages={commentsTotalPages}
                        hasMore={commentsHasMore}
                        loadingMore={commentsLoadingMore}
                        onLoadMore={handleLoadMoreComments}
                        onPageChange={(p) => void handleCommentsPageChange(p)}
                        isOwner={false}
                        loading={commentsLoading}
                      />
                    </Suspense>
                  )}

                  {/* Aba 3: Sobre */}
                  {activeSpace === "about" && (
                    <Suspense fallback={<AboutSpaceSkeleton />}>
                      <LazyProfileAboutSpace
                        favorites={userFavoritesList}
                        createdAt={profile?.createdAt}
                      />
                    </Suspense>
                  )}

                  {/* Aba 4: Atividades */}
                  {activeSpace === "activity" && (
                    <Suspense fallback={<HistorySpaceSkeleton />}>
                      <LazyProfileHistorySpace
                        items={activities}
                        total={activityTotal}
                        page={activityPage}
                        totalPages={activityTotalPages}
                        hasMore={activityHasMore}
                        loadingMore={activityLoadingMore}
                        onLoadMore={handleLoadMoreActivities}
                        onPageChange={(p) => void handleActivityPageChange(p)}
                        isOwner={false}
                        loading={activityLoading}
                      />
                    </Suspense>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>

      {/* Modal de Conexões */}
      {connectionsOpen && (
        <Suspense fallback={null}>
          <LazyProfileConnectionsModal
            isOpen={connectionsOpen}
            activeTab={connectionsTab}
            onTabChange={handleConnectionsTabChange}
            followers={followersList}
            following={followingList}
            followersCount={followersCount}
            followingCount={followingCount}
            loading={connectionsLoading}
            hasMoreFollowers={followersHasMore}
            hasMoreFollowing={followingHasMore}
            onLoadMoreFollowers={handleLoadMoreFollowers}
            onLoadMoreFollowing={handleLoadMoreFollowing}
            loadingMore={connectionsLoadingMore}
            onClose={() => setConnectionsOpen(false)}
            onFollowBack={handleFollowBack}
            currentUserId={currentUser?.id ?? null}
            profileOwnerId={profile?.userId ?? null}
          />
        </Suspense>
      )}
    </div>
  );
}
