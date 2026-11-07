import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

import {
  getMyComments,
  getMyActivities,
  getProfile,
  getProfileFollowers,
  getProfileFollowing,
  updateProfile,
  type MyProfileComment,
  type UserActivityItem,
  type ProfileUser,
  type UserProfile,
  type FollowRequestItem,
  getReceivedFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
} from "@/lib/profile.functions";

import { getMyProfileFavorites } from "@/lib/profile-favorites.functions";
import { getMyProfileLists } from "@/lib/profile-lists.functions";
import {
  getMyAnimeTracking,
  getMyWatchedEpisodes,
} from "@/lib/profile-tracking.functions";

import type {
  ProfileFavoriteItem,
  ProfileFavoritesGrouped,
} from "@/types/favorite";
import type { ProfileListSummary } from "@/types/profile-list";
import type {
  UserAnimeTrackingItem,
  WatchedEpisodeItem,
} from "@/types/profile-tracking";

import { ProfileIdentityHeader } from "@/components/profile/ProfileIdentityHeader";
import {
  ProfileNavRail,
  type ProfileSpace,
} from "@/components/profile/ProfileNavRail";
import { ProfileOverviewSpace } from "@/components/profile/ProfileOverviewSpace";
import { ProfileTrackingSpace } from "@/components/profile/ProfileTrackingSpace";
import { ProfileCommentsSpace } from "@/components/profile/ProfileCommentsSpace";
import { ProfileAboutSpace } from "@/components/profile/ProfileAboutSpace";
import { ProfileHistorySpace } from "@/components/profile/ProfileHistorySpace";
import { ProfileEditModal } from "@/components/profile/ProfileEditModal";
import { ProfileConnectionsModal } from "@/components/profile/ProfileConnectionsModal";
import { ProfilePrivacyModal } from "@/components/profile/ProfilePrivacyModal";

export const Route = createFileRoute("/account")({
  component: AccountProfile,
});

function AccountProfile() {
  const { user, isPending } = useCurrentUserState();

  // Server Functions
  const getProfileFn = useServerFn(getProfile);
  const updateProfileFn = useServerFn(updateProfile);
  const getFollowersFn = useServerFn(getProfileFollowers);
  const getFollowingFn = useServerFn(getProfileFollowing);
  const getRequestsFn = useServerFn(getReceivedFollowRequests);
  const acceptRequestFn = useServerFn(acceptFollowRequest);
  const rejectRequestFn = useServerFn(rejectFollowRequest);
  const getCommentsFn = useServerFn(getMyComments);
  const getTrackingFn = useServerFn(getMyAnimeTracking);
  const getFavoritesFn = useServerFn(getMyProfileFavorites);
  const getListsFn = useServerFn(getMyProfileLists);
  const getActivitiesFn = useServerFn(getMyActivities);

  // Estados principais do perfil
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Espaço ativo na navegação horizontal do perfil:
  // "overview" (Visão geral) como espaço inicial obrigatório
  const [activeSpace, setActiveSpace] = useState<ProfileSpace>("overview");

  // Acompanhamento de Animes
  const [trackingItems, setTrackingItems] = useState<UserAnimeTrackingItem[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(true);

  // Favoritos Canônicos
  const [favoritesGrouped, setFavoritesGrouped] = useState<ProfileFavoritesGrouped>({
    anime: [],
    character: [],
    studio: [],
    company: [],
    person: [],
  });
  const [, setFavoritesItems] = useState<ProfileFavoriteItem[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);

  // Listas Personalizadas
  const [lists, setLists] = useState<ProfileListSummary[]>([]);

  // Feed de Atividades Unificado (Etapa 11)
  const [activityItems, setActivityItems] = useState<UserActivityItem[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityLoading, setActivityLoading] = useState(true);

  // Comentários da Comunidade (Paginados)
  const [comments, setComments] = useState<MyProfileComment[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsTotalPages, setCommentsTotalPages] = useState(1);
  const [commentsLoading, setCommentsLoading] = useState(true);

  // Modais
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [connectionsModalOpen, setConnectionsModalOpen] = useState(false);
  const [connectionsTab, setConnectionsTab] = useState<"followers" | "following" | "requests">("followers");
  const [followersList, setFollowersList] = useState<ProfileUser[]>([]);
  const [followingList, setFollowingList] = useState<ProfileUser[]>([]);
  const [requestsList, setRequestsList] = useState<FollowRequestItem[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);

  // Escuta requisição para abrir modal de edição (ex: vindo de "Configurações do Perfil" no menu da foto)
  useEffect(() => {
    const handleOpenEdit = () => {
      setEditModalOpen(true);
    };

    window.addEventListener("hikari:open-profile-edit", handleOpenEdit);

    // Se navegou com o marcador de abertura automática
    try {
      if (sessionStorage.getItem("hikari:open-profile-edit-on-load") === "true") {
        sessionStorage.removeItem("hikari:open-profile-edit-on-load");
        setEditModalOpen(true);
      }
    } catch {
      // ignore storage access errors
    }

    // Se veio com query param ?edit=1 ou ?edit=true
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
  }, [user?.id]);

  // Carregamento de acompanhamento, favoritos, listas, atividades e comentários
  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    // 1. Acompanhamento
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

    // 2. Favoritos
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

    // 3. Listas
    void getListsFn({ data: {} })
      .then((res) => {
        if (!active) return;
        setLists(res);
      })
      .catch((err) => console.warn("Erro ao buscar listas:", err));

    // 4. Feed de Atividades Unificado (Etapa 11)
    setActivityLoading(true);
    void getActivitiesFn({ data: { page: 1, limit: 15 } })
      .then((res) => {
        if (!active) return;
        setActivityItems(res.items);
        setActivityTotal(res.total);
        setActivityPage(res.page);
        setActivityTotalPages(res.totalPages);
      })
      .catch((err) => console.warn("Erro ao buscar atividades:", err))
      .finally(() => {
        if (active) setActivityLoading(false);
      });

    // 5. Comentários (Paginados)
    setCommentsLoading(true);
    void getCommentsFn({ data: { page: 1, limit: 15 } })
      .then((res) => {
        if (!active) return;
        setComments(res.items);
        setCommentsTotal(res.total);
        setCommentsPage(res.page);
        setCommentsTotalPages(res.totalPages);
      })
      .catch((err) => console.warn("Erro ao buscar comentários:", err))
      .finally(() => {
        if (active) setCommentsLoading(false);
      });

    // 6. Solicitações de seguidores recebidas
    void getRequestsFn()
      .then((res) => {
        if (!active) return;
        setRequestsList(res);
      })
      .catch((err) => console.warn("Erro ao buscar solicitações:", err));

    return () => {
      active = false;
    };
  }, [user?.id]);

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

  // Abrir conexões (Seguidores / Seguindo / Solicitações)
  const handleOpenConnections = async (tab: "followers" | "following" | "requests") => {
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
      // Atualizar lista de seguidores
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

  if (isPending || (profileLoading && !profile)) {
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

  // Dados consolidados
  const displayName = profile?.name || user.displayName || profile?.nick || "Membro";
  const userNick = profile?.nick || "";
  const userBio = profile?.bio || "";
  const userImage = profile?.image || user.profileImageUrl || null;
  const followersCount = profile?.followersCount ?? 0;
  const followingCount = profile?.followingCount ?? 0;
  const commentCount = profile?.commentCount ?? comments.length;
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

        {/* Navegação Horizontal: Visão geral | Animes | Comentários | Sobre | Atividade */}
        <ProfileNavRail
          activeSpace={activeSpace}
          onChangeSpace={setActiveSpace}
          counts={{
            animes: trackingItems.length,
            comments: commentsTotal,
            activity: activityTotal,
          }}
        />

        {/* Área de Conteúdo da Aba Selecionada */}
        <section aria-label="Conteúdo da Aba Ativa" className="relative z-10">
          {/* Aba 1: Visão geral (Anime Stats + Favoritos Animes, Personagens, Studios, People) */}
          {activeSpace === "overview" && (
            <ProfileOverviewSpace
              trackingItems={trackingItems}
              favoritesGrouped={favoritesGrouped}
              loading={trackingLoading || favoritesLoading}
            />
          )}

          {/* Aba 2: Animes (Acompanhamento completo com filtros) */}
          {activeSpace === "animes" && (
            <ProfileTrackingSpace
              items={trackingItems}
              loading={trackingLoading}
            />
          )}

          {/* Aba 3: Comentários */}
          {activeSpace === "comments" && (
            <ProfileCommentsSpace
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
          )}

          {/* Aba 4: Sobre */}
          {activeSpace === "about" && (
            <ProfileAboutSpace
              name={displayName}
              nick={userNick}
              bio={userBio}
              favorites={userFavoritesList}
              lists={lists}
              onOpenEdit={() => setEditModalOpen(true)}
            />
          )}

          {/* Aba 5: Atividade (Feed unificado da Etapa 11) */}
          {activeSpace === "activity" && (
            <ProfileHistorySpace
              items={activityItems}
              total={activityTotal}
              page={activityPage}
              totalPages={activityTotalPages}
              onPageChange={(p) => void handleActivityPageChange(p)}
              isOwner={true}
              loading={activityLoading}
            />
          )}
        </section>
      </div>

      {/* Modal de Personalização do Perfil */}
      <ProfileEditModal
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

      {/* Modal de Conexões da Comunidade (Seguidores / Seguindo / Solicitações) */}
      <ProfileConnectionsModal
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
      />

      {/* Modal de Configurações de Privacidade do Perfil */}
      <ProfilePrivacyModal
        isOpen={privacyModalOpen}
        profile={profile}
        onClose={() => setPrivacyModalOpen(false)}
        onSave={handleSavePrivacy}
      />
    </div>
  );
}
