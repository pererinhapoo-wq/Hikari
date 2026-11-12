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

import {
  blockUser,
  cancelFollowRequest,
  followUser,
  getPublicActivities,
  getPublicComments,
  getPublicProfile,
  unblockUser,
  unfollowUser,
  getPublicProfileFollowers,
  getPublicProfileFollowing,
  setUserVerification,
  type PublicProfileComment,
  type UserActivityItem,
  type ProfileUser,
} from "@/lib/profile.functions";
import { getPublicProfileFavorites } from "@/lib/profile-favorites.functions";
import { getPublicAnimeTracking } from "@/lib/profile-tracking.functions";
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
  component: PublicProfile,
});

const EMPTY_FAVORITES: string[] = [];

function PublicProfile() {
  const { nick } = Route.useParams();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user: currentUser } = useCurrentUserState();

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

  const getPublicProfileFn = useServerFn(getPublicProfile);
  const getPublicCommentsFn = useServerFn(getPublicComments);
  const getPublicActivitiesFn = useServerFn(getPublicActivities);
  const getPublicFavoritesFn = useServerFn(getPublicProfileFavorites);
  const getPublicAnimeTrackingFn = useServerFn(getPublicAnimeTracking);
  const getFollowersFn = useServerFn(getPublicProfileFollowers);
  const getFollowingFn = useServerFn(getPublicProfileFollowing);

  const followUserFn = useServerFn(followUser);
  const unfollowUserFn = useServerFn(unfollowUser);
  const cancelFollowRequestFn = useServerFn(cancelFollowRequest);
  const blockUserFn = useServerFn(blockUser);
  const unblockUserFn = useServerFn(unblockUser);
  const setUserVerificationFn = useServerFn(setUserVerification);

  const [profile, setProfile] = useState<
    Awaited<ReturnType<typeof getPublicProfileFn>> | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeSpace, setActiveSpace] = useState<ProfileSpace>("overview");

  // Acompanhamento de animes para o Anime Stats do perfil visitado
  const [trackingItems, setTrackingItems] = useState<UserAnimeTrackingItem[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [statusCounts, setStatusCounts] = useState<Record<"all" | TrackingStatus, number> | null>(null);

  // Favoritos agrupados (necessários para a Visão Geral)
  const [favoritesGrouped, setFavoritesGrouped] = useState<ProfileFavoritesGrouped>({
    anime: [],
    character: [],
    studio: [],
    company: [],
    person: [],
  });
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  // Comentários (Carregados sob demanda na aba "comments")
  const [comments, setComments] = useState<PublicProfileComment[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsTotalPages, setCommentsTotalPages] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const commentsFetchingRef = useRef(false);

  // Atividades (Carregadas sob demanda na aba "activity")
  const [activities, setActivities] = useState<UserActivityItem[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const activityFetchingRef = useRef(false);

  // Ações sociais
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  // Bloqueio
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByTarget, setIsBlockedByTarget] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  // Modal de Conexões (Seguidores / Seguindo)
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connectionsTab, setConnectionsTab] = useState<"followers" | "following" | "requests">("followers");
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [followersList, setFollowersList] = useState<ProfileUser[]>([]);
  const [followingList, setFollowingList] = useState<ProfileUser[]>([]);

  // Sincroniza aba inicial caso venha via URL search ?tab=
  useEffect(() => {
    if (search.tab === "comments") setActiveSpace("comments");
    else if (search.tab === "activity") setActiveSpace("activity");
    else if (search.tab === "favorites") setActiveSpace("overview");
  }, [search.tab]);

  // Carregamento inicial obrigatório do perfil e favoritos da Visão Geral
  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");
    setTrackingItems([]);
    setTrackingLoading(false);
    setStatusCounts(null);
    setFavoritesGrouped({
      anime: [],
      character: [],
      studio: [],
      company: [],
      person: [],
    });
    setFavoritesLoading(false);
    setComments([]);
    setCommentsTotal(0);
    setCommentsLoaded(false);
    setActivities([]);
    setActivityTotal(0);
    setActivityLoaded(false);

    void getPublicProfileFn({
      data: {
        nick,
      },
    })
      .then(async (result) => {
        if (!active) return;

        // Se for o próprio usuário, redireciona imediatamente para o Perfil próprio (/account)
        if (result.isOwner) {
          void navigate({
            to: "/account",
            search: statusParamRef.current ? { status: statusParamRef.current } : undefined,
            replace: true,
          });
          return;
        }

        setProfile(result);
        setFollowing(result.isFollowing);
        setHasPendingRequest(Boolean(result.hasPendingRequest));
        setFollowersCount(result.followersCount);
        setIsBlockedByMe(Boolean(result.isBlockedByMe));
        setIsBlockedByTarget(Boolean(result.isBlockedByTarget));

        const canAccessProfileContent =
          result.canViewContent && !result.isBlockedByMe && !result.isBlockedByTarget;

        // Carrega dados reais de acompanhamento de animes para o Anime Stats do perfil visitado
        if (canAccessProfileContent) {
          setTrackingLoading(true);
          getPublicAnimeTrackingFn({
            data: {
              userId: result.userId,
              minimal: true,
            },
          })
            .then((items) => {
              if (active) setTrackingItems(items);
            })
            .catch((err) => {
              console.warn("Erro ao buscar estatísticas públicas de animes:", err);
            })
            .finally(() => {
              if (active) setTrackingLoading(false);
            });
        }

        // Carrega Favoritos da Visão Geral somente se o perfil e a seção de favoritos estiverem acessíveis
        if (canAccessProfileContent && result.canViewFavorites) {
          setFavoritesLoading(true);
          getPublicFavoritesFn({
            data: {
              userId: result.userId,
            },
          })
            .then((favs) => {
              if (active) setFavoritesGrouped(favs.grouped);
            })
            .catch((err) => {
              console.warn("Erro ao buscar favoritos públicos:", err);
            })
            .finally(() => {
              if (active) setFavoritesLoading(false);
            });
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar o perfil.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [nick, getPublicProfileFn, getPublicFavoritesFn, getPublicAnimeTrackingFn, navigate]);

  // Carregamento sob demanda para a aba de Comentários (Cache e trava contra cliques rápidos)
  useEffect(() => {
    if (
      !profile?.userId ||
      !profile.canViewComments ||
      (activeSpace !== "comments" && activeSpace !== "overview") ||
      commentsLoaded ||
      commentsFetchingRef.current
    ) {
      return;
    }

    let active = true;
    commentsFetchingRef.current = true;
    setCommentsLoading(true);

    void getPublicCommentsFn({
      data: {
        userId: profile.userId,
        page: 1,
        limit: 15,
      },
    })
      .then((res) => {
        if (!active) return;
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
        if (active) setCommentsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    profile?.userId,
    profile?.canViewComments,
    activeSpace,
    commentsLoaded,
    getPublicCommentsFn,
  ]);

  // Carregamento sob demanda para a aba de Atividades ou Visão Geral (Cache e trava contra cliques rápidos)
  useEffect(() => {
    if (
      !profile?.userId ||
      !profile.canViewHistory ||
      (activeSpace !== "activity" && activeSpace !== "overview") ||
      activityLoaded ||
      activityFetchingRef.current
    ) {
      return;
    }

    let active = true;
    activityFetchingRef.current = true;
    setActivityLoading(true);

    void getPublicActivitiesFn({
      data: {
        userId: profile.userId,
        page: 1,
        limit: 15,
      },
    })
      .then((act) => {
        if (!active) return;
        setActivities(act.items);
        setActivityTotal(act.total);
        setActivityPage(act.page);
        setActivityTotalPages(act.totalPages);
        setActivityHasMore(act.hasMore);
        setActivityLoaded(true);
      })
      .catch((err) => {
        console.warn("Erro ao buscar atividades públicas:", err);
      })
      .finally(() => {
        activityFetchingRef.current = false;
        if (active) setActivityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    profile?.userId,
    profile?.canViewHistory,
    activeSpace,
    activityLoaded,
    getPublicActivitiesFn,
  ]);

  const handleFollowToggle = useCallback(async () => {
    if (!profile || followLoading) return;
    setFollowLoading(true);

    try {
      if (following) {
        await unfollowUserFn({ data: { targetUserId: profile.userId } });
        setFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
        toast.success(`Você deixou de seguir @${profile.nick}`);
      } else if (hasPendingRequest) {
        await cancelFollowRequestFn({ data: { targetUserId: profile.userId } });
        setHasPendingRequest(false);
        toast.info("Solicitação para seguir cancelada.");
      } else {
        const res = await followUserFn({ data: { targetUserId: profile.userId } });
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
        toast.success(`Usuário @${profile.nick} desbloqueado com sucesso.`);
      } else {
        await blockUserFn({ data: { targetUserId: profile.userId } });
        setIsBlockedByMe(true);
        setFollowing(false);
        toast.success(`Usuário @${profile.nick} bloqueado.`);
      }
    } catch (err) {
      console.error("Erro ao atualizar bloqueio:", err);
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar o bloqueio.");
    } finally {
      setBlockLoading(false);
    }
  }, [profile, blockLoading, isBlockedByMe, unblockUserFn, blockUserFn]);

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
  }, [profile, setUserVerificationFn]);

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
          const data = await getFollowersFn({
            data: {
              userId: profile.userId,
            },
          });
          setFollowersList(data || []);
        } else {
          const data = await getFollowingFn({
            data: {
              userId: profile.userId,
            },
          });
          setFollowingList(data || []);
        }
      } catch (err) {
        console.warn("Erro ao buscar conexões:", err);
        if (tab === "followers") {
          setFollowersList([]);
        } else {
          setFollowingList([]);
        }
      } finally {
        setConnectionsLoading(false);
      }
    },
    [profile?.userId, getFollowersFn, getFollowingFn],
  );

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
        const data = await getFollowersFn({
          data: {
            userId: profile.userId,
          },
        });
        setFollowersList(data || []);
      } else if (tab === "following") {
        const data = await getFollowingFn({
          data: {
            userId: profile.userId,
          },
        });
        setFollowingList(data || []);
      }
    } catch (err) {
      console.warn("Erro ao alternar conexões:", err);
      if (tab === "followers") {
        setFollowersList([]);
      } else if (tab === "following") {
        setFollowingList([]);
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

  if (loading) {
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

  // Espaços públicos baseados em permissões de privacidade
  const publicSpaces: ProfileSpaceItem[] = [
    { id: "overview", label: "Visão Geral" },
    ...(profile.canViewComments
      ? [{ id: "comments" as const, label: "Comentários", count: commentsTotal }]
      : []),
    { id: "about", label: "Sobre" },
    ...(profile.canViewHistory
      ? [{ id: "activity" as const, label: "Atividades", count: activityTotal }]
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
          commentCount={commentsTotal}
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
                comments: commentsTotal,
                activity: activityTotal,
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
                        loading={favoritesLoading || trackingLoading}
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
