import { lazy, startTransition, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

import {
  getMyComments,
  getMyActivities,
  getProfile,
  getProfileFollowers,
  getProfileFollowing,
  updateProfile,
  followUser,
  type MyProfileComment,
  type UserActivityItem,
  type ProfileUser,
  type UserProfile,
  type FollowRequestItem,
  getReceivedFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
} from "@/lib/profile.functions";

import {
  getMyProfileFavorites,
  removeProfileFavorite,
} from "@/lib/profile-favorites.functions";
import { getMyAnimeTracking } from "@/lib/profile-tracking.functions";

import type {
  ProfileFavoriteItem,
  ProfileFavoritesGrouped,
} from "@/types/favorite";
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

function TrackingSpaceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse min-h-[500px]">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-24 rounded-xl border border-white/[0.05] bg-white/[0.04]"
          />
        ))}
      </div>
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

    return {
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
  component: AccountProfile,
});

const EMPTY_FAVORITES: string[] = [];

function AccountProfile() {
  const navigate = useNavigate();
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

  // Server Functions
  const getProfileFn = useServerFn(getProfile);
  const updateProfileFn = useServerFn(updateProfile);
  const followUserFn = useServerFn(followUser);
  const getFollowersFn = useServerFn(getProfileFollowers);
  const getFollowingFn = useServerFn(getProfileFollowing);
  const getRequestsFn = useServerFn(getReceivedFollowRequests);
  const acceptRequestFn = useServerFn(acceptFollowRequest);
  const rejectRequestFn = useServerFn(rejectFollowRequest);
  const getCommentsFn = useServerFn(getMyComments);
  const getTrackingFn = useServerFn(getMyAnimeTracking);
  const getFavoritesFn = useServerFn(getMyProfileFavorites);
  const removeFavoriteFn = useServerFn(removeProfileFavorite);
  const getActivitiesFn = useServerFn(getMyActivities);

  // Estabilização de referências de Server Functions com useRef + useCallback
  // Evita que novas instâncias recriadas pelo hook useServerFn invalidem requisições em voo
  const getProfileFnRef = useRef(getProfileFn);
  getProfileFnRef.current = getProfileFn;
  const stableGetProfile = useCallback(
    (...args: Parameters<typeof getProfileFn>) => getProfileFnRef.current(...args),
    [],
  );

  const getRequestsFnRef = useRef(getRequestsFn);
  getRequestsFnRef.current = getRequestsFn;
  const stableGetRequests = useCallback(
    (...args: Parameters<typeof getRequestsFn>) => getRequestsFnRef.current(...args),
    [],
  );

  const getFollowersFnRef = useRef(getFollowersFn);
  getFollowersFnRef.current = getFollowersFn;
  const getFollowingFnRef = useRef(getFollowingFn);
  getFollowingFnRef.current = getFollowingFn;

  const getTrackingFnRef = useRef(getTrackingFn);
  getTrackingFnRef.current = getTrackingFn;
  const stableGetTracking = useCallback(
    (...args: Parameters<typeof getTrackingFn>) => getTrackingFnRef.current(...args),
    [],
  );

  const getFavoritesFnRef = useRef(getFavoritesFn);
  getFavoritesFnRef.current = getFavoritesFn;
  const stableGetFavorites = useCallback(
    (...args: Parameters<typeof getFavoritesFn>) => getFavoritesFnRef.current(...args),
    [],
  );

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
  const requestsRequestIdRef = useRef(0);
  const trackingRequestIdRef = useRef(0);
  const favoritesRequestIdRef = useRef(0);
  const commentsRequestIdRef = useRef(0);
  const activitiesRequestIdRef = useRef(0);

  // Estados principais do perfil
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Espaço ativo na navegação horizontal do perfil:
  // "overview" (Visão geral) como espaço inicial obrigatório
  const [activeSpace, setActiveSpace] = useState<ProfileSpace>("overview");

  // Acompanhamento de Animes (Necessário para a visão geral e contadores)
  const [trackingItems, setTrackingItems] = useState<UserAnimeTrackingItem[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(true);
  const [trackingLoaded, setTrackingLoaded] = useState(false);
  const trackingFetchingRef = useRef(false);

  // Favoritos Canônicos (Necessário para a visão geral)
  const [favoritesGrouped, setFavoritesGrouped] = useState<ProfileFavoritesGrouped>({
    anime: [],
    character: [],
    studio: [],
    company: [],
    person: [],
  });
  const [, setFavoritesItems] = useState<ProfileFavoriteItem[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const favoritesFetchingRef = useRef(false);

  // Feed de Atividades Unificado (Carregado sob demanda na aba "activity" ou Visão Geral)
  const [activityItems, setActivityItems] = useState<UserActivityItem[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const activityFetchingRef = useRef(false);

  // Comentários da Comunidade (Carregados sob demanda na aba "comments" ou Visão Geral)
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
  const [connectionsLoading, setConnectionsLoading] = useState(false);

  // Abrir conexões (Seguidores / Seguindo / Solicitações)
  const handleOpenConnections = useCallback(
    async (tab: "followers" | "following" | "requests") => {
      setConnectionsTab(tab);
      setConnectionsModalOpen(true);
      setConnectionsLoading(true);

      try {
        if (tab === "followers") {
          const data = await getFollowersFnRef.current();
          setFollowersList(data);
        } else if (tab === "following") {
          const data = await getFollowingFnRef.current();
          setFollowingList(data);
        } else {
          const data = await getRequestsFnRef.current();
          setRequestsList(data);
        }
      } catch (err) {
        console.warn("Erro ao buscar conexões:", err);
      } finally {
        setConnectionsLoading(false);
      }
    },
    [],
  );

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

  // Carregamento inicial do perfil
  useEffect(() => {
    if (!user?.id) return;
    const reqId = ++profileRequestIdRef.current;

    setProfileLoading(true);

    void stableGetProfile()
      .then((data) => {
        if (reqId !== profileRequestIdRef.current) return;
        setProfile(data);
      })
      .catch((err) => {
        if (reqId === profileRequestIdRef.current) {
          console.warn("Erro ao obter dados do perfil:", err);
        }
      })
      .finally(() => {
        if (reqId === profileRequestIdRef.current) {
          setProfileLoading(false);
        }
      });
  }, [user?.id, stableGetProfile]);

  // Solicitações de seguidores (necessárias para o indicador de badge do cabeçalho)
  useEffect(() => {
    if (!user?.id) return;
    const reqId = ++requestsRequestIdRef.current;

    void stableGetRequests()
      .then((res) => {
        if (reqId !== requestsRequestIdRef.current) return;
        setRequestsList(res);
      })
      .catch((err) => {
        if (reqId === requestsRequestIdRef.current) {
          console.warn("Erro ao buscar solicitações:", err);
        }
      });
  }, [user?.id, stableGetRequests]);

  // Carregamento sob demanda do Acompanhamento de Animes (Visão Geral e Aba Animes)
  useEffect(() => {
    if (
      !user?.id ||
      (activeSpace !== "overview" && activeSpace !== "animes" && !statusParam) ||
      trackingLoaded ||
      trackingFetchingRef.current
    ) {
      return;
    }

    const reqId = ++trackingRequestIdRef.current;
    trackingFetchingRef.current = true;
    setTrackingLoading(true);

    void stableGetTracking({ data: { minimal: true } })
      .then((items) => {
        if (reqId !== trackingRequestIdRef.current) return;
        setTrackingItems(items);
        setTrackingLoaded(true);
      })
      .catch((err) => {
        if (reqId === trackingRequestIdRef.current) {
          console.warn("Erro ao buscar acompanhamento:", err);
        }
      })
      .finally(() => {
        if (reqId === trackingRequestIdRef.current) {
          trackingFetchingRef.current = false;
          setTrackingLoading(false);
        }
      });
  }, [user?.id, activeSpace, statusParam, trackingLoaded, stableGetTracking]);

  // Carregamento sob demanda dos Favoritos Canônicos (Visão Geral)
  useEffect(() => {
    if (
      !user?.id ||
      activeSpace !== "overview" ||
      favoritesLoaded ||
      favoritesFetchingRef.current
    ) {
      return;
    }

    const reqId = ++favoritesRequestIdRef.current;
    favoritesFetchingRef.current = true;
    setFavoritesLoading(true);

    void stableGetFavorites({ data: {} })
      .then((res) => {
        if (reqId !== favoritesRequestIdRef.current) return;
        setFavoritesGrouped(res.grouped);
        setFavoritesItems(res.items);
        setFavoritesLoaded(true);
      })
      .catch((err) => {
        if (reqId === favoritesRequestIdRef.current) {
          console.warn("Erro ao buscar favoritos:", err);
        }
      })
      .finally(() => {
        if (reqId === favoritesRequestIdRef.current) {
          favoritesFetchingRef.current = false;
          setFavoritesLoading(false);
        }
      });
  }, [user?.id, activeSpace, favoritesLoaded, stableGetFavorites]);

  // Carregamento sob demanda para a aba de Comentários ou Visão Geral (Cache por aba e trava contra cliques rápidos)
  useEffect(() => {
    if (
      !user?.id ||
      (activeSpace !== "comments" && activeSpace !== "overview") ||
      commentsLoaded ||
      commentsFetchingRef.current
    ) {
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
  }, [user?.id, activeSpace, commentsLoaded, stableGetComments]);

  // Carregamento sob demanda para a aba de Atividades ou Visão Geral (Cache por aba e trava contra cliques rápidos)
  useEffect(() => {
    if (
      !user?.id ||
      (activeSpace !== "activity" && activeSpace !== "overview") ||
      activityLoaded ||
      activityFetchingRef.current
    ) {
      return;
    }

    const reqId = ++activitiesRequestIdRef.current;
    activityFetchingRef.current = true;
    setActivityLoading(true);

    void stableGetActivities({ data: { page: 1, limit: 15 } })
      .then((res) => {
        if (reqId !== activitiesRequestIdRef.current) return;
        setActivityItems(res.items);
        setActivityTotal(res.total);
        setActivityPage(res.page);
        setActivityTotalPages(res.totalPages);
        setActivityHasMore(res.hasMore);
        setActivityLoaded(true);
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
  }, [user?.id, activeSpace, activityLoaded, stableGetActivities]);

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

  const handleCommentDeleted = useCallback((commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setCommentsTotal((prev) => Math.max(0, prev - 1));
    setProfile((prev) =>
      prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) } : prev,
    );
  }, []);

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

  const handleUpdateTrackingItem = useCallback((updated: UserAnimeTrackingItem) => {
    setTrackingItems((prev) =>
      prev.map((item) => (item.animeId === updated.animeId ? updated : item)),
    );
  }, []);

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
        toast.info(`"${item.title}" removido dos favoritos.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao remover favorito.";
        toast.error(msg);
      }
    },
    [removeFavoriteFn],
  );

  // Alternar aba dentro do modal de conexões
  const handleConnectionsTabChange = async (tab: "followers" | "following" | "requests") => {
    setConnectionsTab(tab);
    setConnectionsLoading(true);
    try {
      if (tab === "followers") {
        const data = await getFollowersFn();
        setFollowersList(data);
      } else if (tab === "following") {
        const data = await getFollowingFn();
        setFollowingList(data);
      } else {
        const data = await getRequestsFn();
        setRequestsList(data);
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
      setProfile((prev) =>
        prev ? { ...prev, followersCount: prev.followersCount + 1 } : prev,
      );
      const freshFollowers = await getFollowersFn();
      setFollowersList(freshFollowers);
    } catch (err) {
      console.error("Erro ao aceitar solicitação:", err);
    }
  };

  const handleRejectRequest = async (requesterId: string) => {
    try {
      await rejectRequestFn({ data: { requesterId } });
      setRequestsList((prev) => prev.filter((r) => r.requesterId !== requesterId));
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
            p.userId === targetUserId ? { ...p, isFollowing: true } : p,
          ),
        );
        setFollowingList((prev) =>
          prev.map((p) =>
            p.userId === targetUserId ? { ...p, isFollowing: true } : p,
          ),
        );
        setProfile((prev) =>
          prev ? { ...prev, followingCount: prev.followingCount + 1 } : prev,
        );
        toast.success("Você agora está seguindo este usuário.");
      } else if (res.status === "requested") {
        toast.info("Solicitação para seguir enviada.");
      }
    } catch (err) {
      console.error("Erro ao seguir de volta:", err);
      toast.error("Não foi possível seguir o usuário.");
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
        window.dispatchEvent(
          new CustomEvent("hikari:profile-updated", {
            detail: {
              image: updated.image !== undefined ? updated.image : null,
              nick: updated.nick,
            },
          }),
        );
      }
    },
    [updateProfileFn, user?.displayName, user?.primaryEmail, user?.profileImageUrl],
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

  if (isPending || (!statusParam && profileLoading && !profile)) {
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

  if (studioParam) {
    return (
      <Suspense fallback={<WorksViewSkeleton />}>
        <LazyProfileStudioWorksView
          studioName={studioParam}
          studioId={studioIdParam}
          onClear={() => {
            void navigate({
              to: "/account",
              search: (prev) => {
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
              search: (prev) => {
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
              search: (prev) => {
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
    const filteredCount = trackingItems.filter((i) => i.status === statusParam).length;

    return (
      <div className="relative min-h-[80vh] w-full pb-16 pt-6 sm:pt-8">
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
              {!trackingLoading && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-zinc-300">
                  {filteredCount}
                </span>
              )}
            </div>
          </div>

          <Suspense fallback={<TrackingSpaceSkeleton />}>
            <LazyProfileTrackingSpace
              items={trackingItems}
              loading={trackingLoading}
              activeFilter={statusParam}
              hideFilterBar={true}
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
  const followersCount = profile?.followersCount ?? 0;
  const followingCount = profile?.followingCount ?? 0;
  const commentCount = profile?.commentCount ?? commentsTotal;
  const userFavoritesList = profile?.favorites ?? EMPTY_FAVORITES;

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
          requestsCount={requestsList.length}
          commentCount={commentCount}
          totalTrackingCount={trackingItems.length}
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
            animes: trackingItems.length,
            comments: commentsTotal || profile?.commentCount || 0,
            activity: activityTotal,
          }}
        />

        {/* Área de Conteúdo da Aba Selecionada */}
        <section aria-label="Conteúdo da Aba Ativa" className="relative z-10">
          {/* Aba 1: Visão geral (Anime Stats + Favoritos Animes, Personagens, Studios, People + Atividades recentes) */}
          {activeSpace === "overview" && (
            <Suspense fallback={<OverviewSpaceSkeleton />}>
              <LazyProfileOverviewSpace
                trackingItems={trackingItems}
                favoritesGrouped={favoritesGrouped}
                activityItems={activityItems}
                comments={comments}
                loading={trackingLoading || favoritesLoading}
                onUpdateItem={handleUpdateTrackingItem}
                onRemoveFavorite={handleRemoveFavorite}
              />
            </Suspense>
          )}

          {/* Aba 2: Animes (Acompanhamento completo com filtros) */}
          {activeSpace === "animes" && (
            <Suspense fallback={<TrackingSpaceSkeleton />}>
              <LazyProfileTrackingSpace
                items={trackingItems}
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
            requestsCount={requestsList.length}
            loading={connectionsLoading}
            onClose={() => setConnectionsModalOpen(false)}
            onAcceptRequest={handleAcceptRequest}
            onRejectRequest={handleRejectRequest}
            onFollowBack={handleFollowBack}
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
