import { lazy, startTransition, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { RedirectToSignIn } from "@/lib/auth/gates";
import { authEnabled, getBearerToken } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

import {
  getMyComments,
  getMyActivities,
  getAccountProfileBundle,
  getProfileFollowers,
  getProfileFollowing,
  updateProfile,
  followUser,
  type AccountProfileBundle,
  type MyProfileComment,
  type UserActivityItem,
  type ProfileUser,
  type UserProfile,
  type FollowRequestItem,
  getReceivedFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  removeFollower,
} from "@/lib/profile.functions";

import { removeProfileFavorite } from "@/lib/profile-favorites.functions";
import { getMyTrackingStatsSummary } from "@/lib/profile-tracking.functions";
import {
  getCachedAccountProfileBundle,
  getKnownViewerId,
  invalidateAccountProfileCache,
  invalidatePublicProfileCache,
  setCachedAccountProfileBundle,
  setCachedProfileMeta,
  setKnownViewerId,
} from "@/lib/profile-client-cache";

import type {
  ProfileFavoriteItem,
  ProfileFavoritesGrouped,
} from "@/types/favorite";
import {
  applyTrackingItemDeltaToStats,
  createEmptyTrackingStatsSummary,
  STATUS_CONFIG,
  STATUS_ORDER,
  type AnimeTrackingStatsSummary,
  type TrackingStatus,
  type UserAnimeTrackingItem,
} from "@/types/profile-tracking";

import { ProfileIdentityHeader } from "@/components/profile/ProfileIdentityHeader";
import {
  ProfileNavRail,
  type ProfileSpace,
} from "@/components/profile/ProfileNavRail";

// Code-splitting de todos os componentes pesados das abas e modais
const LazyProfileOverviewSpace = lazy(() =>
  import("@/components/profile/ProfileOverviewSpace").then((m) => ({
    default: m.ProfileOverviewSpace,
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

const LazyProfileTrackingSpace = lazy(() =>
  import("@/components/profile/ProfileTrackingSpace").then((m) => ({
    default: m.ProfileTrackingSpace,
  })),
);

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

const LazyProfileEditModal = lazy(() =>
  import("@/components/profile/ProfileEditModal").then((m) => ({
    default: m.ProfileEditModal,
  })),
);

const LazyProfileConnectionsModal = lazy(() =>
  import("@/components/profile/ProfileConnectionsModal").then((m) => ({
    default: m.ProfileConnectionsModal,
  })),
);

const LazyProfilePrivacyModal = lazy(() =>
  import("@/components/profile/ProfilePrivacyModal").then((m) => ({
    default: m.ProfilePrivacyModal,
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

// Skeletons específicos com dimensões e espaçamentos equivalentes aos componentes reais
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

function TrackingSpaceSkeleton({
  hideFilterBar = false,
}: {
  hideFilterBar?: boolean;
}) {
  return (
    <div className="space-y-6 animate-pulse min-h-[500px]">
      {!hideFilterBar && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-24 rounded-xl border border-white/[0.05] bg-white/[0.04]"
            />
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="min-w-0">
            <div className="aspect-[2/3] rounded-none border border-white/[0.08] bg-white/[0.04]" />
            <div className="mt-2 h-3.5 w-3/4 rounded-none bg-white/5" />
            <div className="mt-1 h-2.5 w-1/2 rounded-none bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

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

interface AccountSearchParams {
  tab?: "comments" | "activity" | "favorites";
  status?: TrackingStatus;
  edit?: string;
  studio?: string;
  studioId?: string;
  dublador?: string;
  dubladorId?: string;
  staff?: string;
  staffId?: string;
  person?: string;
  personId?: string;
  connections?: "followers" | "following" | "requests";
}

export const Route = createFileRoute("/account")({
  validateSearch: (raw: Record<string, unknown>): AccountSearchParams => {
    const validStatuses: TrackingStatus[] = [
      "watching",
      "completed",
      "on_hold",
      "dropped",
      "planning",
    ];
    const status =
      typeof raw.status === "string" &&
      validStatuses.includes(raw.status as TrackingStatus)
        ? (raw.status as TrackingStatus)
        : undefined;

    const edit = typeof raw.edit === "string" ? raw.edit : undefined;

    const studio =
      typeof raw.studio === "string" && raw.studio ? raw.studio : undefined;
    const studioId =
      typeof raw.studioId === "string" && raw.studioId
        ? raw.studioId
        : typeof raw.studioId === "number"
          ? String(raw.studioId)
          : undefined;

    const dublador =
      typeof raw.dublador === "string" && raw.dublador ? raw.dublador : undefined;
    const dubladorId =
      typeof raw.dubladorId === "string" && raw.dubladorId
        ? raw.dubladorId
        : typeof raw.dubladorId === "number"
          ? String(raw.dubladorId)
          : undefined;

    const staff =
      typeof raw.staff === "string" && raw.staff
        ? raw.staff
        : typeof raw.person === "string" && raw.person
          ? raw.person
          : undefined;
    const staffId =
      typeof raw.staffId === "string" && raw.staffId
        ? raw.staffId
        : typeof raw.staffId === "number"
          ? String(raw.staffId)
          : typeof raw.personId === "string" && raw.personId
            ? raw.personId
            : typeof raw.personId === "number"
              ? String(raw.personId)
              : undefined;

    const connections =
      raw.connections === "followers" ||
      raw.connections === "following" ||
      raw.connections === "requests"
        ? (raw.connections as "followers" | "following" | "requests")
        : undefined;

    const tab =
      raw.tab === "comments" || raw.tab === "activity" || raw.tab === "favorites"
        ? (raw.tab as "comments" | "activity" | "favorites")
        : undefined;

    return {
      tab,
      status,
      edit,
      connections,
      studio,
      studioId,
      dublador,
      dubladorId,
      staff,
      staffId,
      person: staff,
      personId: staffId,
    };
  },
  loaderDeps: () => ({}),
  loader: async () => {
    try {
      if (typeof window !== "undefined") {
        const cached = getCachedAccountProfileBundle(getKnownViewerId());
        if (cached) {
          return { bundle: cached };
        }
      }
      const bundle = await getAccountProfileBundle();
      if (typeof window !== "undefined") {
        setCachedAccountProfileBundle(bundle);
      }
      return { bundle };
    } catch {
      return { bundle: null as AccountProfileBundle | null };
    }
  },
  component: AccountProfile,
});

const EMPTY_FAVORITES: string[] = [];
const EMPTY_FAVORITES_GROUPED: ProfileFavoritesGrouped = {
  anime: [],
  character: [],
  studio: [],
  company: [],
  person: [],
};

function AccountProfile() {
  const loaderData = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const urlStatus =
    search.status ||
    (typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("status") as TrackingStatus | null)
      : null);
  const statusParam =
    urlStatus && STATUS_ORDER.includes(urlStatus) ? urlStatus : undefined;

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

  const { user, isPending } = useCurrentUserState();
  const [isClientReady, setIsClientReady] = useState(false);
  useEffect(() => {
    setIsClientReady(true);
  }, []);

  // Server Functions
  const getAccountProfileBundleFn = useServerFn(getAccountProfileBundle);
  const getMyTrackingStatsSummaryFn = useServerFn(getMyTrackingStatsSummary);
  const updateProfileFn = useServerFn(updateProfile);
  const followUserFn = useServerFn(followUser);
  const getFollowersFn = useServerFn(getProfileFollowers);
  const getFollowingFn = useServerFn(getProfileFollowing);
  const getRequestsFn = useServerFn(getReceivedFollowRequests);
  const acceptRequestFn = useServerFn(acceptFollowRequest);
  const rejectRequestFn = useServerFn(rejectFollowRequest);
  const removeFollowerFn = useServerFn(removeFollower);
  const getCommentsFn = useServerFn(getMyComments);
  const removeFavoriteFn = useServerFn(removeProfileFavorite);
  const getActivitiesFn = useServerFn(getMyActivities);

  const getAccountProfileBundleFnRef = useRef(getAccountProfileBundleFn);
  getAccountProfileBundleFnRef.current = getAccountProfileBundleFn;
  const stableGetAccountBundle = useCallback(
    (...args: Parameters<typeof getAccountProfileBundleFn>) =>
      getAccountProfileBundleFnRef.current(...args),
    [],
  );

  const getMyTrackingStatsSummaryFnRef = useRef(getMyTrackingStatsSummaryFn);
  getMyTrackingStatsSummaryFnRef.current = getMyTrackingStatsSummaryFn;
  const stableGetMyTrackingStatsSummary = useCallback(
    (...args: Parameters<typeof getMyTrackingStatsSummaryFn>) =>
      getMyTrackingStatsSummaryFnRef.current(...args),
    [],
  );

  const getRequestsFnRef = useRef(getRequestsFn);
  getRequestsFnRef.current = getRequestsFn;

  const getFollowersFnRef = useRef(getFollowersFn);
  getFollowersFnRef.current = getFollowersFn;
  const getFollowingFnRef = useRef(getFollowingFn);
  getFollowingFnRef.current = getFollowingFn;

  const getCommentsFnRef = useRef(getCommentsFn);
  getCommentsFnRef.current = getCommentsFn;
  const stableGetComments = useCallback(
    (...args: Parameters<typeof getCommentsFn>) => getCommentsFnRef.current(...args),
    [],
  );

  const getActivitiesFnRef = useRef(getActivitiesFn);
  getActivitiesFnRef.current = getActivitiesFn;
  const stableGetActivities = useCallback(
    (...args: Parameters<typeof getActivitiesFn>) => getActivitiesFnRef.current(...args),
    [],
  );

  // Contadores de sequência para controle de concorrência e descarte de respostas obsoletas
  const profileRequestIdRef = useRef(0);
  const trackingStatsRequestIdRef = useRef(0);
  const commentsRequestIdRef = useRef(0);
  const activitiesRequestIdRef = useRef(0);

  const initialBundle = loaderData?.bundle ?? null;

  // Estados principais do perfil (pré-populados pelo loader agregado quando disponível)
  const [profile, setProfile] = useState<UserProfile | null>(
    () => initialBundle?.profile ?? null,
  );
  const [profileLoading, setProfileLoading] = useState<boolean>(() => !initialBundle);

  // Espaço ativo na navegação horizontal do perfil:
  // "overview" (Visão geral) como espaço inicial padrão, respeitando ?tab=
  const [activeSpace, setActiveSpace] = useState<ProfileSpace>(() => {
    if (search.tab === "comments") return "comments";
    if (search.tab === "activity") return "activity";
    return "overview";
  });

  useEffect(() => {
    if (search.tab === "comments") setActiveSpace("comments");
    else if (search.tab === "activity") setActiveSpace("activity");
    else if (search.tab === "favorites") setActiveSpace("overview");
  }, [search.tab]);

  // Resumo agregado de acompanhamento de animes (calculado no PostgreSQL)
  const [trackingStats, setTrackingStats] = useState<AnimeTrackingStatsSummary | null>(
    () => initialBundle?.trackingStats ?? null,
  );
  const [trackingLoading, setTrackingLoading] = useState<boolean>(() => !initialBundle);
  const [trackingLoaded, setTrackingLoaded] = useState<boolean>(() => Boolean(initialBundle));
  const [statusCounts, setStatusCounts] = useState<Record<"all" | TrackingStatus, number> | null>(null);
  const lastKnownTrackingItemsRef = useRef<Map<string, UserAnimeTrackingItem>>(new Map());

  // Favoritos Canônicos (Necessário para a visão geral)
  const [favoritesGrouped, setFavoritesGrouped] = useState<ProfileFavoritesGrouped>(
    () => initialBundle?.favoritesGrouped ?? EMPTY_FAVORITES_GROUPED,
  );
  const [, setFavoritesItems] = useState<ProfileFavoriteItem[]>(
    () => initialBundle?.favoritesItems ?? [],
  );
  const [favoritesLoading, setFavoritesLoading] = useState<boolean>(() => !initialBundle);
  const [favoritesLoaded, setFavoritesLoaded] = useState<boolean>(() => Boolean(initialBundle));

  // Feed de Atividades Unificado (Carregado progressivamente: preview na Visão Geral ou completo na aba)
  const [activityItems, setActivityItems] = useState<UserActivityItem[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [activityLoadedMode, setActivityLoadedMode] = useState<"none" | "preview" | "full">("none");
  const activityFetchingRef = useRef(false);

  // Comentários da Comunidade (Carregados progressivamente quando visíveis ou ao abrir a aba)
  const [comments, setComments] = useState<MyProfileComment[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsTotalPages, setCommentsTotalPages] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const commentsFetchingRef = useRef(false);

  // Modais
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [connectionsModalOpen, setConnectionsModalOpen] = useState(false);
  const [connectionsTab, setConnectionsTab] = useState<"followers" | "following" | "requests">("followers");
  const [followersList, setFollowersList] = useState<ProfileUser[]>([]);
  const [followingList, setFollowingList] = useState<ProfileUser[]>([]);
  const [requestsList, setRequestsList] = useState<FollowRequestItem[]>([]);
  const [requestsCount, setRequestsCount] = useState<number>(
    () => initialBundle?.requestsCount ?? 0,
  );
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [followersPage, setFollowersPage] = useState(1);
  const [followersHasMore, setFollowersHasMore] = useState(false);
  const [followingPage, setFollowingPage] = useState(1);
  const [followingHasMore, setFollowingHasMore] = useState(false);
  const [connectionsLoadingMore, setConnectionsLoadingMore] = useState(false);

  // Abrir conexões (Seguidores / Seguindo / Solicitações)
  const handleOpenConnections = useCallback(
    async (tab: "followers" | "following" | "requests") => {
      setConnectionsTab(tab);
      setConnectionsModalOpen(true);
      setConnectionsLoading(true);

      try {
        if (tab === "followers") {
          setFollowersPage(1);
          const data = await getFollowersFnRef.current({ data: { page: 1, limit: 20 } });
          const items = Array.isArray(data) ? data : (data?.items ?? []);
          const hasMore = Array.isArray(data) ? false : Boolean(data?.hasMore);
          setFollowersList(items);
          setFollowersHasMore(hasMore);
        } else if (tab === "following") {
          setFollowingPage(1);
          const data = await getFollowingFnRef.current({ data: { page: 1, limit: 20 } });
          const items = Array.isArray(data) ? data : (data?.items ?? []);
          const hasMore = Array.isArray(data) ? false : Boolean(data?.hasMore);
          setFollowingList(items);
          setFollowingHasMore(hasMore);
        } else {
          const data = await getRequestsFnRef.current();
          setRequestsList(data);
          setRequestsCount(data.length);
        }
      } catch (err) {
        console.warn("Erro ao buscar conexões:", err);
      } finally {
        setConnectionsLoading(false);
      }
    },
    [],
  );

  const handleLoadMoreFollowers = useCallback(async () => {
    if (connectionsLoadingMore || !followersHasMore) return;
    setConnectionsLoadingMore(true);
    try {
      const nextPage = followersPage + 1;
      const data = await getFollowersFnRef.current({ data: { page: nextPage, limit: 20 } });
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
  }, [connectionsLoadingMore, followersHasMore, followersPage]);

  const handleLoadMoreFollowing = useCallback(async () => {
    if (connectionsLoadingMore || !followingHasMore) return;
    setConnectionsLoadingMore(true);
    try {
      const nextPage = followingPage + 1;
      const data = await getFollowingFnRef.current({ data: { page: nextPage, limit: 20 } });
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
  }, [connectionsLoadingMore, followingHasMore, followingPage]);

  // Callbacks estabilizados para o cabeçalho e modais do perfil
  const handleOpenEdit = useCallback(() => {
    setEditModalOpen(true);
  }, []);

  const handleOpenPrivacy = useCallback(() => {
    setPrivacyModalOpen(true);
  }, []);

  const handleOpenFollowers = useCallback(() => {
    void handleOpenConnections("followers");
  }, [handleOpenConnections]);

  const handleOpenFollowing = useCallback(() => {
    void handleOpenConnections("following");
  }, [handleOpenConnections]);

  const handleOpenRequests = useCallback(() => {
    void handleOpenConnections("requests");
  }, [handleOpenConnections]);

  // Escuta requisição para abrir modal de edição (ex: vindo de "Configurações do Perfil" no menu da foto)
  useEffect(() => {
    const handleOpenEditEvent = () => {
      setEditModalOpen(true);
    };

    window.addEventListener("hikari:open-profile-edit", handleOpenEditEvent);

    try {
      if (sessionStorage.getItem("hikari:open-profile-edit-on-load") === "true") {
        sessionStorage.removeItem("hikari:open-profile-edit-on-load");
        setEditModalOpen(true);
      }
    } catch {
      // ignore storage access errors
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("edit") === "true" || params.get("edit") === "1") {
        setEditModalOpen(true);
      }
    }

    return () => {
      window.removeEventListener("hikari:open-profile-edit", handleOpenEditEvent);
    };
  }, []);

  // Escuta requisição para abrir modal de conexões (ex: vindo de notificação de novos seguidores)
  useEffect(() => {
    const handleOpenConn = (e: Event) => {
      const custom = e as CustomEvent<{ tab?: "followers" | "following" | "requests" }>;
      const tab = custom.detail?.tab || "followers";
      void handleOpenConnections(tab);
    };

    window.addEventListener("hikari:open-connections", handleOpenConn);

    if (search.connections) {
      void handleOpenConnections(search.connections);
    } else if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const conn = params.get("connections");
      if (conn === "followers" || conn === "following" || conn === "requests") {
        void handleOpenConnections(conn);
      }
    }

    return () => {
      window.removeEventListener("hikari:open-connections", handleOpenConn);
    };
  }, [search.connections, handleOpenConnections]);

  const lastSyncedShellMetaRef = useRef<string>("");
  const syncShellProfileMeta = useCallback((p: UserProfile) => {
    if (typeof window === "undefined") return;
    const metaKey = `${p.userId ?? ""}|${p.image ?? ""}|${p.nick ?? ""}`;
    if (lastSyncedShellMetaRef.current === metaKey) {
      return;
    }
    lastSyncedShellMetaRef.current = metaKey;
    if (p.userId) {
      setCachedProfileMeta(p.userId, {
        image: p.image ?? null,
        nick: p.nick ?? null,
      });
    }
    window.dispatchEvent(
      new CustomEvent("hikari:profile-updated", {
        detail: {
          image: p.image ?? null,
          nick: p.nick,
        },
      }),
    );
  }, []);

  const applyAccountBundle = useCallback(
    (bundle: AccountProfileBundle) => {
      setProfile(bundle.profile);
      setRequestsCount(bundle.requestsCount);
      setTrackingStats(bundle.trackingStats ?? createEmptyTrackingStatsSummary());
      setTrackingLoaded(true);
      setFavoritesGrouped(bundle.favoritesGrouped);
      setFavoritesItems(bundle.favoritesItems);
      setFavoritesLoaded(true);
      setProfileLoading(false);
      setTrackingLoading(false);
      setFavoritesLoading(false);
      syncShellProfileMeta(bundle.profile);
    },
    [syncShellProfileMeta],
  );

  // Carregamento agregado e reconciliação entre SSR, Preview Bearer Token e Cache
  const bearerPresent = isClientReady && Boolean(getBearerToken());
  const cachedInitialBundleRef = useRef<AccountProfileBundle | null>(null);
  useEffect(() => {
    if (!isClientReady) return;
    if (!user?.id) {
      // Caso o modo sem auth explícita ainda use Bearer ou fallback, só aguarda se sessão estiver pendente
      if (!authEnabled && bearerPresent) return;
      return;
    }

    setKnownViewerId(user.id);

    // Se o loader já entregou os dados deste exato usuário, sincroniza o cache inicial uma única vez e não refaz chamada
    if (profile?.userId === user.id && trackingLoaded && favoritesLoaded) {
      if (initialBundle && initialBundle.profile.userId === user.id && cachedInitialBundleRef.current !== initialBundle) {
        cachedInitialBundleRef.current = initialBundle;
        setCachedAccountProfileBundle(initialBundle);
      }
      syncShellProfileMeta(profile);
      return;
    }

    const cached = getCachedAccountProfileBundle(user.id);
    if (cached && cached.profile.userId === user.id) {
      applyAccountBundle(cached);
      return;
    }

    const reqId = ++profileRequestIdRef.current;
    setProfileLoading(true);
    setTrackingLoading(true);
    setFavoritesLoading(true);

    void stableGetAccountBundle()
      .then((bundle) => {
        if (reqId !== profileRequestIdRef.current) return;
        setCachedAccountProfileBundle(bundle);
        applyAccountBundle(bundle);
      })
      .catch((err) => {
        if (reqId !== profileRequestIdRef.current) return;
        console.warn("Erro ao carregar bundle da conta:", err);
        setProfileLoading(false);
        setTrackingLoading(false);
        setFavoritesLoading(false);
      });
  }, [
    isClientReady,
    user?.id,
    bearerPresent,
    initialBundle,
    profile,
    trackingLoaded,
    favoritesLoaded,
    applyAccountBundle,
    syncShellProfileMeta,
    stableGetAccountBundle,
  ]);

  const loadCommentsFirstPage = useCallback(() => {
    if (!user?.id || commentsLoaded || commentsFetchingRef.current) {
      return;
    }

    const reqId = ++commentsRequestIdRef.current;
    commentsFetchingRef.current = true;
    setCommentsLoading(true);

    void stableGetComments({ data: { page: 1, limit: 15 } })
      .then((res) => {
        if (reqId !== commentsRequestIdRef.current) return;
        setComments(res.items);
        setCommentsTotal(res.total);
        setCommentsPage(res.page);
        setCommentsTotalPages(res.totalPages);
        setCommentsHasMore(res.hasMore);
        setCommentsLoaded(true);
      })
      .catch((err) => {
        if (reqId === commentsRequestIdRef.current) {
          console.warn("Erro ao buscar comentários:", err);
        }
      })
      .finally(() => {
        if (reqId === commentsRequestIdRef.current) {
          commentsFetchingRef.current = false;
          setCommentsLoading(false);
        }
      });
  }, [user?.id, commentsLoaded, stableGetComments]);

  const loadActivitiesFirstPage = useCallback(
    (mode: "preview" | "full") => {
      if (!user?.id || activityFetchingRef.current) {
        return;
      }
      if (mode === "preview" && activityLoadedMode !== "none") {
        return;
      }
      if (mode === "full" && activityLoadedMode === "full") {
        return;
      }

      if (mode === "full" && activityLoadedMode === "preview" && !activityHasMore) {
        setActivityLoadedMode("full");
        setActivityTotal(activityItems.length);
        setActivityTotalPages(1);
        return;
      }

      const reqId = ++activitiesRequestIdRef.current;
      activityFetchingRef.current = true;
      setActivityLoading(true);

      const isPreview = mode === "preview";
      void stableGetActivities({
        data: {
          page: 1,
          limit: isPreview ? 6 : 15,
          preview: isPreview,
        },
      })
        .then((res) => {
          if (reqId !== activitiesRequestIdRef.current) return;
          setActivityItems(res.items);
          setActivityTotal(res.total);
          setActivityPage(res.page);
          setActivityTotalPages(res.totalPages);
          setActivityHasMore(res.hasMore);
          setActivityLoadedMode(isPreview ? "preview" : "full");
        })
        .catch((err) => {
          if (reqId === activitiesRequestIdRef.current) {
            console.warn("Erro ao buscar atividades:", err);
          }
        })
        .finally(() => {
          if (reqId === activitiesRequestIdRef.current) {
            activityFetchingRef.current = false;
            setActivityLoading(false);
          }
        });
    },
    [user?.id, activityLoadedMode, activityHasMore, activityItems.length, stableGetActivities],
  );

  // Carregamento sob demanda somente quando a aba correspondente é aberta
  useEffect(() => {
    if (!user?.id) return;
    if (activeSpace === "comments") {
      loadCommentsFirstPage();
    } else if (activeSpace === "activity") {
      loadActivitiesFirstPage("full");
    }
  }, [user?.id, activeSpace, loadCommentsFirstPage, loadActivitiesFirstPage]);

  // Carregamento progressivo disparado por IntersectionObserver quando "Atividades recentes" entra próximo da viewport
  const handleRecentActivitiesNearVisible = useCallback(() => {
    if (!user?.id) return;
    loadActivitiesFirstPage("preview");
    loadCommentsFirstPage();
  }, [user?.id, loadActivitiesFirstPage, loadCommentsFirstPage]);

  // Carregamento contínuo (scroll infinito via IntersectionObserver) no feed de atividades
  const handleLoadMoreActivities = useCallback(async () => {
    if (activityFetchingRef.current || !activityHasMore || activityLoadingMore) return;
    activityFetchingRef.current = true;
    setActivityLoadingMore(true);

    const nextPage = activityPage + 1;
    try {
      const res = await stableGetActivities({
        data: { page: nextPage, limit: 15 },
      });
      setActivityItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const uniqueNew = res.items.filter((i) => !existingIds.has(i.id));
        return [...prev, ...uniqueNew];
      });
      setActivityPage(nextPage);
      setActivityTotal(res.total);
      setActivityTotalPages(res.totalPages);
      setActivityHasMore(res.hasMore);
    } catch (err) {
      console.warn("Erro ao carregar mais atividades:", err);
    } finally {
      activityFetchingRef.current = false;
      setActivityLoadingMore(false);
    }
  }, [activityHasMore, activityLoadingMore, activityPage, stableGetActivities]);

  // Carregamento contínuo (scroll infinito via IntersectionObserver) nos comentários
  const handleLoadMoreComments = useCallback(async () => {
    if (commentsFetchingRef.current || !commentsHasMore || commentsLoadingMore) return;
    commentsFetchingRef.current = true;
    setCommentsLoadingMore(true);

    const nextPage = commentsPage + 1;
    try {
      const res = await stableGetComments({
        data: { page: nextPage, limit: 15 },
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
      console.warn("Erro ao carregar mais comentários:", err);
    } finally {
      commentsFetchingRef.current = false;
      setCommentsLoadingMore(false);
    }
  }, [commentsHasMore, commentsLoadingMore, commentsPage, stableGetComments]);

  const handleCommentDeleted = useCallback(
    (commentId: string) => {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentsTotal((prev) => Math.max(0, prev - 1));
      setProfile((prev) =>
        prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) } : prev,
      );
      invalidateAccountProfileCache(user?.id);
      invalidatePublicProfileCache(profile?.nick);
    },
    [user?.id, profile?.nick],
  );

  const handleCommentUpdated = useCallback(
    (commentId: string, newContent: string, isSpoiler: boolean) => {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, content: newContent, isSpoiler, updatedAt: new Date().toISOString() }
            : c,
        ),
      );
    },
    [],
  );

  const handleUpdateTrackingItem = useCallback(
    (
      updated: UserAnimeTrackingItem,
      previousAnimeId?: string,
      previousItem?: UserAnimeTrackingItem,
      settled?: boolean,
    ) => {
      const lookupId = previousAnimeId ?? updated.animeId;
      const resolvedPrev =
        previousItem ??
        lastKnownTrackingItemsRef.current.get(lookupId) ??
        lastKnownTrackingItemsRef.current.get(updated.animeId) ??
        null;

      if (previousAnimeId && previousAnimeId !== updated.animeId) {
        lastKnownTrackingItemsRef.current.delete(previousAnimeId);
      }
      lastKnownTrackingItemsRef.current.set(updated.animeId, updated);

      if (resolvedPrev) {
        setTrackingStats((prev) =>
          applyTrackingItemDeltaToStats(
            prev ?? createEmptyTrackingStatsSummary(),
            resolvedPrev,
            updated,
          ),
        );
      }

      if (settled !== false) {
        invalidateAccountProfileCache(user?.id);
        invalidatePublicProfileCache(profile?.nick);
      }

      if (settled === true || !resolvedPrev) {
        const statsReqId = ++trackingStatsRequestIdRef.current;
        void stableGetMyTrackingStatsSummary()
          .then((freshStats) => {
            if (statsReqId !== trackingStatsRequestIdRef.current) return;
            setTrackingStats(freshStats);
          })
          .catch(() => {
            // Mantém o delta otimista se a reconciliação em segundo plano falhar
          });
      }
    },
    [user?.id, profile?.nick, stableGetMyTrackingStatsSummary],
  );

  const handleRemoveFavorite = useCallback(
    async (item: ProfileFavoriteItem) => {
      try {
        await removeFavoriteFn({
          data: {
            favoriteId: item.id,
            targetType: item.targetType,
            targetId: item.targetId,
          },
        });
        setFavoritesGrouped((prev) => ({
          ...prev,
          [item.targetType]: (prev[item.targetType] ?? []).filter(
            (f) => f.id !== item.id && f.targetId !== item.targetId,
          ),
        }));
        setFavoritesItems((prev) => prev.filter((f) => f.id !== item.id));
        invalidateAccountProfileCache(user?.id);
        invalidatePublicProfileCache(profile?.nick);
        toast.info(`"${item.title}" removido dos favoritos.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao remover favorito.";
        toast.error(msg);
      }
    },
    [removeFavoriteFn, user?.id, profile?.nick],
  );

  // Alternar aba dentro do modal de conexões
  const handleConnectionsTabChange = async (tab: "followers" | "following" | "requests") => {
    setConnectionsTab(tab);
    setConnectionsLoading(true);
    try {
      if (tab === "followers") {
        const data = await getFollowersFn();
        const items = Array.isArray(data) ? data : (data?.items ?? []);
        setFollowersList(items);
        setFollowersHasMore(Array.isArray(data) ? false : Boolean(data?.hasMore));
      } else if (tab === "following") {
        const data = await getFollowingFn();
        const items = Array.isArray(data) ? data : (data?.items ?? []);
        setFollowingList(items);
        setFollowingHasMore(Array.isArray(data) ? false : Boolean(data?.hasMore));
      } else {
        const data = await getRequestsFn();
        setRequestsList(data);
        setRequestsCount(data.length);
      }
    } catch (err) {
      console.warn("Erro ao alternar aba de conexões:", err);
    } finally {
      setConnectionsLoading(false);
    }
  };

  const handleAcceptRequest = async (requesterId: string) => {
    try {
      await acceptRequestFn({ data: { requesterId } });
      setRequestsList((prev) => prev.filter((r) => r.requesterId !== requesterId));
      setRequestsCount((prev) => Math.max(0, prev - 1));
      setProfile((prev) =>
        prev ? { ...prev, followersCount: prev.followersCount + 1 } : prev,
      );
      invalidateAccountProfileCache(user?.id);
      invalidatePublicProfileCache(profile?.nick);
      const freshFollowers = await getFollowersFn();
      setFollowersList(Array.isArray(freshFollowers) ? freshFollowers : (freshFollowers?.items ?? []));
    } catch (err) {
      console.error("Erro ao aceitar solicitação:", err);
    }
  };

  const handleRejectRequest = async (requesterId: string) => {
    try {
      await rejectRequestFn({ data: { requesterId } });
      setRequestsList((prev) => prev.filter((r) => r.requesterId !== requesterId));
      setRequestsCount((prev) => Math.max(0, prev - 1));
      invalidateAccountProfileCache(user?.id);
    } catch (err) {
      console.error("Erro ao recusar solicitação:", err);
    }
  };

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
        setProfile((prev) =>
          prev ? { ...prev, followingCount: prev.followingCount + 1 } : prev,
        );
        invalidateAccountProfileCache(user?.id);
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

  const handleRemoveFollower = async (followerId: string) => {
    try {
      const res = await removeFollowerFn({ data: { followerId } });
      setFollowersList((prev) => prev.filter((p) => p.userId !== followerId));
      setFollowingList((prev) =>
        prev.map((p) =>
          p.userId === followerId
            ? { ...p, followsViewer: false, followsOpenProfile: false }
            : p,
        ),
      );
      if (res.removed) {
        setProfile((prev) =>
          prev ? { ...prev, followersCount: Math.max(0, prev.followersCount - 1) } : prev,
        );
        invalidateAccountProfileCache(user?.id);
        invalidatePublicProfileCache(profile?.nick);
      }
      toast.success("Seguidor removido.");
    } catch (err) {
      console.error("Erro ao remover seguidor:", err);
      toast.error(
        err instanceof Error ? err.message : "Não foi possível remover o seguidor.",
      );
    }
  };

  // Salvar perfil editado
  const handleSaveProfile = useCallback(
    async (data: {
      name: string;
      nick: string;
      bio: string;
      image: string | null;
      bannerUrl: string | null;
      favorites: string[];
    }) => {
      const updated = await updateProfileFn({
        data: {
          name: data.name,
          nick: data.nick,
          bio: data.bio,
          image: data.image,
          bannerUrl: data.bannerUrl,
          favorites: data.favorites,
        },
      });

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: updated.name || prev.name,
              nick: updated.nick,
              bio: updated.bio,
              image: updated.image !== undefined ? updated.image : prev.image,
              bannerUrl:
                updated.bannerUrl !== undefined
                  ? updated.bannerUrl
                  : prev.bannerUrl,
              favorites: updated.favorites,
            }
          : {
              ...updated,
              name: updated.name || user?.displayName || "",
              email: user?.primaryEmail || "",
              image: updated.image ?? user?.profileImageUrl ?? null,
              bannerUrl: updated.bannerUrl ?? null,
            },
      );

      if (typeof window !== "undefined") {
        const nextImage = updated.image !== undefined ? updated.image : null;
        if (user?.id) {
          setCachedProfileMeta(user.id, {
            image: nextImage,
            nick: updated.nick,
          });
        }
        invalidateAccountProfileCache(user?.id);
        invalidatePublicProfileCache(profile?.nick);
        invalidatePublicProfileCache(updated.nick);
        window.dispatchEvent(
          new CustomEvent("hikari:profile-updated", {
            detail: {
              image: nextImage,
              nick: updated.nick,
            },
          }),
        );
      }
    },
    [updateProfileFn, user?.id, user?.displayName, user?.primaryEmail, user?.profileImageUrl, profile?.nick],
  );

  const handleRemoveBanner = useCallback(async () => {
    const currentDisplayName = profile?.name || user?.displayName || profile?.nick || "Membro";
    const currentNick = profile?.nick || "";
    const currentBio = profile?.bio || "";
    const currentImage = profile?.image !== undefined ? profile.image : (user?.profileImageUrl || null);
    const currentFavorites = profile?.favorites || EMPTY_FAVORITES;

    await handleSaveProfile({
      name: currentDisplayName,
      nick: currentNick,
      bio: currentBio,
      image: currentImage,
      favorites: currentFavorites,
      bannerUrl: null,
    });
  }, [handleSaveProfile, profile, user?.displayName, user?.profileImageUrl]);

  // Salvar configurações de privacidade
  const handleSavePrivacy = async (data: {
    accountType?: "public" | "private";
    allowFollowers?: boolean;
    privacyLists?: "public" | "followers" | "private";
    privacyFavorites?: "public" | "followers" | "private";
    privacyHistory?: "public" | "followers" | "private";
    privacyComments?: "public" | "followers" | "private";
    privacyFollowers?: "public" | "followers" | "private";
  }) => {
    const updated = await updateProfileFn({
      data: {
        accountType: data.accountType,
        allowFollowers: data.allowFollowers,
        privacyLists: data.privacyLists,
        privacyFavorites: data.privacyFavorites,
        privacyHistory: data.privacyHistory,
        privacyComments: data.privacyComments,
        privacyFollowers: data.privacyFollowers,
      },
    });

    setProfile((prev) => (prev ? { ...prev, ...updated } : null));
    invalidateAccountProfileCache(user?.id);
    invalidatePublicProfileCache(profile?.nick);
  };

  // Filtro selecionado na aba Animes (preservado entre trocas de abas)
  const [trackingFilter, setTrackingFilter] = useState<"all" | TrackingStatus>("all");

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

  if (isPending || (!user && !isClientReady)) {
    return (
      <div className="w-full px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="h-64 animate-pulse rounded-3xl bg-white/[0.04]" />
          <div className="h-14 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse rounded-2xl bg-white/[0.04]"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <RedirectToSignIn to="/login" />;
  }

  if (!statusParam && profileLoading && !profile) {
    return (
      <div className="w-full px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="h-64 animate-pulse rounded-3xl bg-white/[0.04]" />
          <div className="h-14 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse rounded-2xl bg-white/[0.04]"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (studioParam) {
    return (
      <Suspense fallback={<WorksViewSkeleton />}>
        <LazyProfileStudioWorksView
          studioName={studioParam}
          studioId={studioIdParam}
          onClear={() => {
            void navigate({
              to: "/account",
              search: (prev: AccountSearchParams) => {
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
            void navigate({
              to: "/account",
              search: (prev: AccountSearchParams) => {
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
            void navigate({
              to: "/account",
              search: (prev: AccountSearchParams) => {
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

  // Se a rota for aberta com parâmetro de status, exibe diretamente a lista de animes correspondente
  if (statusParam && STATUS_CONFIG[statusParam]) {
    const cfg = STATUS_CONFIG[statusParam];
    const filteredCount =
      statusCounts?.[statusParam] ??
      trackingStats?.counts[statusParam] ??
      0;

    return (
      <div
        key={statusParam}
        className="anime-stats-category-enter relative min-h-[80vh] w-full pb-16 pt-6 sm:pt-8"
      >
        <div
          className="pointer-events-none absolute -left-20 top-0 size-96 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.12)_0%,rgba(124,58,237,0.05)_45%,transparent_70%)]"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
            <div className="flex items-center gap-3">
              <span className={`size-3.5 rounded-full ${cfg.indicatorDot}`} />
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Animes — {cfg.label}
              </h1>
              {(!trackingLoading || statusCounts !== null || trackingStats !== null) && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-zinc-300">
                  {filteredCount}
                </span>
              )}
            </div>
          </div>

          <Suspense fallback={<TrackingSpaceSkeleton hideFilterBar={true} />}>
            <LazyProfileTrackingSpace
              initialCounts={trackingStats?.counts}
              loading={trackingLoading}
              activeFilter={statusParam}
              hideFilterBar={true}
              onCountsChange={setStatusCounts}
              onUpdateItem={handleUpdateTrackingItem}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  // Dados consolidados
  const displayName = profile?.name || user.displayName || profile?.nick || "Membro";
  const userNick = profile?.nick || "";
  const userBio = profile?.bio || "";
  const userImage = profile?.image || user.profileImageUrl || null;
  const userFavoritesList = profile?.favorites ?? EMPTY_FAVORITES;
  const followersCount = profile?.followersCount ?? 0;
  const followingCount = profile?.followingCount ?? 0;
  const effectiveCommentCount = commentsLoaded
    ? commentsTotal
    : (profile?.commentCount ?? commentsTotal);
  const effectiveActivityCount =
    activityLoadedMode === "full" || (activityLoadedMode === "preview" && !activityHasMore)
      ? activityTotal
      : 0;
  const overviewRecentActivitiesLoaded =
    activityLoadedMode !== "none" && commentsLoaded;

  return (
    <div className="w-full text-zinc-100 pt-1 sm:pt-3">
      <div className="mx-auto w-full max-w-6xl px-1 sm:px-2 space-y-7">
        {/* Cabeçalho do Perfil: Banner, Avatar, Nome, Username, Privacidade, Bio, Seguidores e Seguindo */}
        <ProfileIdentityHeader
          name={displayName}
          nick={userNick}
          bio={userBio}
          image={userImage}
          bannerUrl={profile?.bannerUrl || null}
          accountType={profile?.accountType}
          isVerified={Boolean(profile?.isVerified)}
          followersCount={followersCount}
          followingCount={followingCount}
          requestsCount={requestsCount}
          favorites={userFavoritesList}
          onOpenEdit={handleOpenEdit}
          onRemoveBanner={handleRemoveBanner}
          onOpenPrivacy={handleOpenPrivacy}
          onOpenFollowers={handleOpenFollowers}
          onOpenFollowing={handleOpenFollowing}
          onOpenRequests={handleOpenRequests}
        />

        {/* Navegação Horizontal: Visão geral | Animes | Comentários | Sobre | Atividades */}
        <ProfileNavRail
          activeSpace={activeSpace}
          onChangeSpace={handleSpaceChange}
          onPrefetchSpace={handlePrefetchSpace}
          counts={{
            animes: trackingStats?.totalEntries ?? 0,
            comments: effectiveCommentCount,
            activity: effectiveActivityCount,
          }}
        />

        {/* Área de Conteúdo da Aba Selecionada */}
        <section aria-label="Conteúdo da Aba Ativa" className="relative z-10">
          {/* Aba 1: Visão geral (Anime Stats + Favoritos Animes, Personagens, Studios, People + Atividades recentes) */}
          {activeSpace === "overview" && (
            <Suspense fallback={<OverviewSpaceSkeleton />}>
              <LazyProfileOverviewSpace
                trackingStats={trackingStats}
                favoritesGrouped={favoritesGrouped}
                activityItems={activityItems}
                comments={comments}
                trackingLoading={trackingLoading}
                favoritesLoading={favoritesLoading}
                activitiesLoading={activityLoading || commentsLoading}
                activitiesLoaded={overviewRecentActivitiesLoaded}
                onRecentActivitiesNearVisible={handleRecentActivitiesNearVisible}
                onUpdateItem={handleUpdateTrackingItem}
                onRemoveFavorite={handleRemoveFavorite}
              />
            </Suspense>
          )}

          {/* Aba 2: Animes (Acompanhamento completo com filtros) */}
          {activeSpace === "animes" && (
            <Suspense fallback={<TrackingSpaceSkeleton />}>
              <LazyProfileTrackingSpace
                initialCounts={trackingStats?.counts}
                loading={trackingLoading}
                activeFilter={trackingFilter}
                onFilterChange={setTrackingFilter}
                onUpdateItem={handleUpdateTrackingItem}
              />
            </Suspense>
          )}

          {/* Aba 3: Comentários */}
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
                onCommentDeleted={handleCommentDeleted}
                onCommentUpdated={handleCommentUpdated}
                isOwner={true}
                loading={commentsLoading}
              />
            </Suspense>
          )}

          {/* Aba 4: Sobre */}
          {activeSpace === "about" && (
            <Suspense fallback={<AboutSpaceSkeleton />}>
              <LazyProfileAboutSpace
                name={displayName}
                nick={userNick}
                bio={userBio}
                favorites={userFavoritesList}
                createdAt={profile?.createdAt}
                onOpenEdit={handleOpenEdit}
              />
            </Suspense>
          )}

          {/* Aba 5: Atividade (Feed unificado da Etapa 11) */}
          {activeSpace === "activity" && (
            <Suspense fallback={<HistorySpaceSkeleton />}>
              <LazyProfileHistorySpace
                items={activityItems}
                total={activityTotal}
                page={activityPage}
                totalPages={activityTotalPages}
                hasMore={activityHasMore}
                loadingMore={activityLoadingMore}
                onLoadMore={handleLoadMoreActivities}
                isOwner={true}
                loading={activityLoading}
              />
            </Suspense>
          )}
        </section>
      </div>

      {/* Modal de Personalização do Perfil */}
      {editModalOpen && (
        <Suspense fallback={null}>
          <LazyProfileEditModal
            isOpen={editModalOpen}
            initialName={profile?.name || user.displayName || profile?.nick || ""}
            initialNick={userNick}
            initialBio={userBio}
            initialImage={userImage}
            initialBannerUrl={profile?.bannerUrl || null}
            initialFavorites={userFavoritesList}
            onClose={() => setEditModalOpen(false)}
            onSave={handleSaveProfile}
          />
        </Suspense>
      )}

      {/* Modal de Conexões da Comunidade (Seguidores / Seguindo / Solicitações) */}
      {connectionsModalOpen && (
        <Suspense fallback={null}>
          <LazyProfileConnectionsModal
            isOpen={connectionsModalOpen}
            initialTab={connectionsTab}
            activeTab={connectionsTab}
            onTabChange={(t) => void handleConnectionsTabChange(t)}
            followers={followersList}
            following={followingList}
            requests={requestsList}
            followersCount={followersCount}
            followingCount={followingCount}
            requestsCount={requestsCount}
            loading={connectionsLoading}
            hasMoreFollowers={followersHasMore}
            hasMoreFollowing={followingHasMore}
            onLoadMoreFollowers={handleLoadMoreFollowers}
            onLoadMoreFollowing={handleLoadMoreFollowing}
            loadingMore={connectionsLoadingMore}
            onClose={() => setConnectionsModalOpen(false)}
            onAcceptRequest={handleAcceptRequest}
            onRejectRequest={handleRejectRequest}
            onFollowBack={handleFollowBack}
            onRemoveFollower={handleRemoveFollower}
            currentUserId={user?.id ?? null}
            profileOwnerId={profile?.userId || user?.id || null}
          />
        </Suspense>
      )}

      {/* Modal de Configurações de Privacidade do Perfil */}
      {privacyModalOpen && (
        <Suspense fallback={null}>
          <LazyProfilePrivacyModal
            isOpen={privacyModalOpen}
            profile={profile}
            onClose={() => setPrivacyModalOpen(false)}
            onSave={handleSavePrivacy}
          />
        </Suspense>
      )}
    </div>
  );
}
