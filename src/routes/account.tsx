import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
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
import { getMyProfileLists } from "@/lib/profile-lists.functions";
import { getMyAnimeTracking } from "@/lib/profile-tracking.functions";

import type {
  ProfileFavoriteItem,
  ProfileFavoritesGrouped,
} from "@/types/favorite";
import type { ProfileListSummary } from "@/types/profile-list";
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
import { ProfileOverviewSpace } from "@/components/profile/ProfileOverviewSpace";

// Code-splitting dos componentes pesados das abas e modais
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
function TrackingSpaceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-24 rounded-xl border border-white/[0.05] bg-white/[0.04]"
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[3/4] rounded-2xl border border-white/[0.05] bg-white/[0.04]"
          />
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
  const getListsFn = useServerFn(getMyProfileLists);
  const getActivitiesFn = useServerFn(getMyActivities);

  // Estados principais do perfil
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Espaço ativo na navegação horizontal do perfil:
  // "overview" (Visão geral) como espaço inicial obrigatório
  const [activeSpace, setActiveSpace] = useState<ProfileSpace>("overview");

  // Acompanhamento de Animes (Necessário para a visão geral e contadores)
  const [trackingItems, setTrackingItems] = useState<UserAnimeTrackingItem[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(true);

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

  // Listas Personalizadas (Carregadas sob demanda na aba "about")
  const [lists, setLists] = useState<ProfileListSummary[]>([]);
  const [listsLoaded, setListsLoaded] = useState(false);
  const listsFetchingRef = useRef(false);

  // Feed de Atividades Unificado (Carregado sob demanda na aba "activity")
  const [activityItems, setActivityItems] = useState<UserActivityItem[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const activityFetchingRef = useRef(false);

  // Comentários da Comunidade (Carregados sob demanda na aba "comments")
  const [comments, setComments] = useState<MyProfileComment[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsTotalPages, setCommentsTotalPages] = useState(1);
  const [commentsLoading, setCommentsLoading] = useState(false);
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
        console.warn("Erro ao buscar conexões:", err);
      } finally {
        setConnectionsLoading(false);
      }
    },
    [getFollowersFn, getFollowingFn, getRequestsFn],
  );

  // Escuta requisição para abrir modal de edição (ex: vindo de "Configurações do Perfil" no menu da foto)
  useEffect(() => {
    const handleOpenEdit = () => {
      setEditModalOpen(true);
    };

    window.addEventListener("hikari:open-profile-edit", handleOpenEdit);

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
      window.removeEventListener("hikari:open-profile-edit", handleOpenEdit);
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
    let active = true;

    setProfileLoading(true);

    void getProfileFn()
      .then((data) => {
        if (!active) return;
        setProfile(data);
      })
      .catch((err) => {
        console.warn("Erro ao obter dados do perfil:", err);
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id, getProfileFn]);

  // Carregamento essencial da montagem inicial: Acompanhamento, Favoritos Canônicos e Solicitações de Seguidores
  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    // 1. Acompanhamento (usado nas estatísticas da Visão Geral e contadores)
    setTrackingLoading(true);
    void getTrackingFn({ data: {} })
      .then((items) => {
        if (!active) return;
        setTrackingItems(items);
      })
      .catch((err) => console.warn("Erro ao buscar acompanhamento:", err))
      .finally(() => {
        if (active) setTrackingLoading(false);
      });

    // 2. Favoritos Canônicos (usados nas seções da Visão Geral)
    setFavoritesLoading(true);
    void getFavoritesFn({ data: {} })
      .then((res) => {
        if (!active) return;
        setFavoritesGrouped(res.grouped);
        setFavoritesItems(res.items);
      })
      .catch((err) => console.warn("Erro ao buscar favoritos:", err))
      .finally(() => {
        if (active) setFavoritesLoading(false);
      });

    // 3. Solicitações de seguidores (necessárias para o indicador de badge do cabeçalho)
    void getRequestsFn()
      .then((res) => {
        if (!active) return;
        setRequestsList(res);
      })
      .catch((err) => console.warn("Erro ao buscar solicitações:", err));

    return () => {
      active = false;
    };
  }, [user?.id, getTrackingFn, getFavoritesFn, getRequestsFn]);

  // Carregamento sob demanda para a aba de Comentários (Cache por aba e trava contra cliques rápidos)
  useEffect(() => {
    if (!user?.id || activeSpace !== "comments" || commentsLoaded || commentsFetchingRef.current) {
      return;
    }

    let active = true;
    commentsFetchingRef.current = true;
    setCommentsLoading(true);

    void getCommentsFn({ data: { page: 1, limit: 15 } })
      .then((res) => {
        if (!active) return;
        setComments(res.items);
        setCommentsTotal(res.total);
        setCommentsPage(res.page);
        setCommentsTotalPages(res.totalPages);
        setCommentsLoaded(true);
      })
      .catch((err) => console.warn("Erro ao buscar comentários:", err))
      .finally(() => {
        commentsFetchingRef.current = false;
        if (active) setCommentsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id, activeSpace, commentsLoaded, getCommentsFn]);

  // Carregamento sob demanda para a aba de Atividades (Cache por aba e trava contra cliques rápidos)
  useEffect(() => {
    if (!user?.id || activeSpace !== "activity" || activityLoaded || activityFetchingRef.current) {
      return;
    }

    let active = true;
    activityFetchingRef.current = true;
    setActivityLoading(true);

    void getActivitiesFn({ data: { page: 1, limit: 15 } })
      .then((res) => {
        if (!active) return;
        setActivityItems(res.items);
        setActivityTotal(res.total);
        setActivityPage(res.page);
        setActivityTotalPages(res.totalPages);
        setActivityLoaded(true);
      })
      .catch((err) => console.warn("Erro ao buscar atividades:", err))
      .finally(() => {
        activityFetchingRef.current = false;
        if (active) setActivityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id, activeSpace, activityLoaded, getActivitiesFn]);

  // Carregamento sob demanda para a aba Sobre (listas personalizadas)
  useEffect(() => {
    if (!user?.id || activeSpace !== "about" || listsLoaded || listsFetchingRef.current) {
      return;
    }

    let active = true;
    listsFetchingRef.current = true;

    void getListsFn({ data: {} })
      .then((res) => {
        if (!active) return;
        setLists(res);
        setListsLoaded(true);
      })
      .catch((err) => console.warn("Erro ao buscar listas:", err))
      .finally(() => {
        listsFetchingRef.current = false;
      });

    return () => {
      active = false;
    };
  }, [user?.id, activeSpace, listsLoaded, getListsFn]);

  // Troca de página no feed de atividades
  const handleActivityPageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > activityTotalPages) return;
    setActivityLoading(true);
    try {
      const res = await getActivitiesFn({
        data: { page: newPage, limit: 15 },
      });
      setActivityItems(res.items);
      setActivityTotal(res.total);
      setActivityPage(res.page);
      setActivityTotalPages(res.totalPages);
    } catch (err) {
      console.warn("Erro ao mudar página de atividades:", err);
    } finally {
      setActivityLoading(false);
    }
  };

  // Troca de página nos comentários
  const handleCommentsPageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > commentsTotalPages) return;
    setCommentsLoading(true);
    try {
      const res = await getCommentsFn({
        data: { page: newPage, limit: 15 },
      });
      setComments(res.items);
      setCommentsTotal(res.total);
      setCommentsPage(res.page);
      setCommentsTotalPages(res.totalPages);
    } catch (err) {
      console.warn("Erro ao mudar página de comentários:", err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleCommentDeleted = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setCommentsTotal((prev) => Math.max(0, prev - 1));
    setProfile((prev) =>
      prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) } : prev,
    );
  };

  const handleCommentUpdated = (
    commentId: string,
    newContent: string,
    isSpoiler: boolean,
  ) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, content: newContent, isSpoiler, updatedAt: new Date().toISOString() }
          : c,
      ),
    );
  };

  const handleUpdateTrackingItem = (updated: UserAnimeTrackingItem) => {
    setTrackingItems((prev) =>
      prev.map((item) => (item.animeId === updated.animeId ? updated : item)),
    );
  };

  const handleRemoveFavorite = async (item: ProfileFavoriteItem) => {
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
  };

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
  const handleSaveProfile = async (data: {
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
  };

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
  const userFavoritesList = profile?.favorites ?? [];

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
          onOpenEdit={() => setEditModalOpen(true)}
          onRemoveBanner={async () => {
            await handleSaveProfile({
              name: profile?.name || displayName,
              nick: profile?.nick || userNick,
              bio: profile?.bio || userBio,
              image: profile?.image !== undefined ? profile.image : userImage,
              favorites: profile?.favorites || userFavoritesList,
              bannerUrl: null,
            });
          }}
          onOpenPrivacy={() => setPrivacyModalOpen(true)}
          onOpenFollowers={() => void handleOpenConnections("followers")}
          onOpenFollowing={() => void handleOpenConnections("following")}
          onOpenRequests={() => void handleOpenConnections("requests")}
        />

        {/* Navegação Horizontal: Visão geral | Animes | Comentários | Sobre | Atividades */}
        <ProfileNavRail
          activeSpace={activeSpace}
          onChangeSpace={setActiveSpace}
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
            <ProfileOverviewSpace
              trackingItems={trackingItems}
              favoritesGrouped={favoritesGrouped}
              activityItems={activityItems}
              comments={comments}
              loading={trackingLoading || favoritesLoading}
              onUpdateItem={handleUpdateTrackingItem}
              onRemoveFavorite={handleRemoveFavorite}
            />
          )}

          {/* Aba 2: Animes (Acompanhamento completo com filtros) */}
          {activeSpace === "animes" && (
            <Suspense fallback={<TrackingSpaceSkeleton />}>
              <LazyProfileTrackingSpace
                items={trackingItems}
                loading={trackingLoading}
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
                onPageChange={(p) => void handleCommentsPageChange(p)}
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
                lists={lists}
                onOpenEdit={() => setEditModalOpen(true)}
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
                onPageChange={(p) => void handleActivityPageChange(p)}
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
