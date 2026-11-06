import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  LogOut,
  ShieldCheck,
} from "lucide-react";

import { isHikariAdmin } from "@/lib/auth/admin";
import { signOut } from "@/lib/auth/client";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

import {
  getMyComments,
  getProfile,
  getProfileFollowers,
  getProfileFollowing,
  updateProfile,
  type MyProfileComment,
  type ProfileUser,
  type UserProfile,
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
  const getCommentsFn = useServerFn(getMyComments);
  const getTrackingFn = useServerFn(getMyAnimeTracking);
  const getFavoritesFn = useServerFn(getMyProfileFavorites);
  const getListsFn = useServerFn(getMyProfileLists);
  const getHistoryFn = useServerFn(getMyWatchedEpisodes);

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

  // Histórico de Episódios
  const [historyItems, setHistoryItems] = useState<WatchedEpisodeItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Comentários da Comunidade
  const [comments, setComments] = useState<MyProfileComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);

  // Modais
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [connectionsModalOpen, setConnectionsModalOpen] = useState(false);
  const [connectionsTab, setConnectionsTab] = useState<"followers" | "following">("followers");
  const [followersList, setFollowersList] = useState<ProfileUser[]>([]);
  const [followingList, setFollowingList] = useState<ProfileUser[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);

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

  // Carregamento de acompanhamento, favoritos, listas, histórico e comentários
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

    // 4. Histórico
    setHistoryLoading(true);
    void getHistoryFn({ data: { page: 1, limit: 15 } })
      .then((res) => {
        if (!active) return;
        setHistoryItems(res.items);
        setHistoryTotal(res.total);
        setHistoryPage(res.page);
        setHistoryTotalPages(res.totalPages);
      })
      .catch((err) => console.warn("Erro ao buscar histórico:", err))
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    // 5. Comentários
    setCommentsLoading(true);
    void getCommentsFn()
      .then((res) => {
        if (!active) return;
        setComments(res);
      })
      .catch((err) => console.warn("Erro ao buscar comentários:", err))
      .finally(() => {
        if (active) setCommentsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  // Troca de página no histórico
  const handleHistoryPageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > historyTotalPages) return;
    setHistoryLoading(true);
    try {
      const res = await getHistoryFn({
        data: { page: newPage, limit: 15 },
      });
      setHistoryItems(res.items);
      setHistoryTotal(res.total);
      setHistoryPage(res.page);
      setHistoryTotalPages(res.totalPages);
    } catch (err) {
      console.warn("Erro ao mudar página do histórico:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Abrir conexões (Seguidores / Seguindo)
  const handleOpenConnections = async (tab: "followers" | "following") => {
    setConnectionsTab(tab);
    setConnectionsModalOpen(true);
    setConnectionsLoading(true);

    try {
      if (tab === "followers") {
        const data = await getFollowersFn();
        setFollowersList(data);
      } else {
        const data = await getFollowingFn();
        setFollowingList(data);
      }
    } catch (err) {
      console.warn("Erro ao buscar conexões:", err);
    } finally {
      setConnectionsLoading(false);
    }
  };

  // Alternar aba dentro do modal de conexões
  const handleConnectionsTabChange = async (tab: "followers" | "following") => {
    setConnectionsTab(tab);
    setConnectionsLoading(true);
    try {
      if (tab === "followers") {
        const data = await getFollowersFn();
        setFollowersList(data);
      } else {
        const data = await getFollowingFn();
        setFollowingList(data);
      }
    } catch (err) {
      console.warn("Erro ao alternar aba de conexões:", err);
    } finally {
      setConnectionsLoading(false);
    }
  };

  // Salvar perfil editado
  const handleSaveProfile = async (data: {
    nick: string;
    bio: string;
    favorites: string[];
  }) => {
    const updated = await updateProfileFn({
      data: {
        nick: data.nick,
        bio: data.bio,
        favorites: data.favorites,
      },
    });

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            nick: updated.nick,
            bio: updated.bio,
            favorites: updated.favorites,
          }
        : {
            ...updated,
            name: user?.displayName || "",
            email: user?.primaryEmail || "",
            image: user?.profileImageUrl || null,
          },
    );
  };

  if (isPending || (profileLoading && !profile)) {
    return (
      <main className="min-h-screen bg-[#07060a] px-4 py-8 text-white">
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
      </main>
    );
  }

  if (!user) {
    return <RedirectToSignIn to="/login" />;
  }

  const isAdmin = isHikariAdmin(user.primaryEmail);

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
    <main className="min-h-screen bg-[#07060a] text-zinc-100 pb-20 pt-4 sm:pt-6">
      <div className="mx-auto w-full max-w-6xl px-3 sm:px-6 space-y-7">
        {/* Cabeçalho do Perfil: Banner, Avatar, Nome, Username, Privacidade, Bio, Seguidores e Seguindo */}
        <ProfileIdentityHeader
          name={displayName}
          nick={userNick}
          bio={userBio}
          image={userImage}
          followersCount={followersCount}
          followingCount={followingCount}
          commentCount={commentCount}
          totalTrackingCount={trackingItems.length}
          favorites={userFavoritesList}
          onOpenEdit={() => setEditModalOpen(true)}
          onOpenFollowers={() => void handleOpenConnections("followers")}
          onOpenFollowing={() => void handleOpenConnections("following")}
        />

        {/* Navegação Horizontal: Visão geral | Animes | Comentários | Sobre | Atividade */}
        <ProfileNavRail
          activeSpace={activeSpace}
          onChangeSpace={setActiveSpace}
          counts={{
            animes: trackingItems.length,
            comments: commentCount,
            activity: historyTotal,
          }}
        />

        {/* Área de Conteúdo da Aba Selecionada */}
        <section aria-label="Conteúdo da Aba Ativa" className="relative z-10 min-h-[350px]">
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

          {/* Aba 5: Atividade (Histórico de episódios assistidos) */}
          {activeSpace === "activity" && (
            <ProfileHistorySpace
              items={historyItems}
              total={historyTotal}
              page={historyPage}
              totalPages={historyTotalPages}
              onPageChange={(p) => void handleHistoryPageChange(p)}
              loading={historyLoading}
            />
          )}
        </section>

        {/* Rodapé do Perfil */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-6 pb-8 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-zinc-300 transition-all hover:bg-white/[0.08] hover:text-white"
            >
              <span>Voltar ao início</span>
            </Link>

            {isAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3.5 py-2 font-semibold text-violet-300 transition-all hover:bg-violet-500/20"
              >
                <ShieldCheck className="size-3.5" />
                <span>Painel Admin</span>
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => void signOut("/")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3.5 py-2 text-rose-300 transition-all hover:bg-rose-500/15"
          >
            <LogOut className="size-3.5" />
            <span>Encerrar Sessão</span>
          </button>
        </footer>
      </div>

      {/* Modal de Personalização do Perfil */}
      <ProfileEditModal
        isOpen={editModalOpen}
        initialNick={userNick}
        initialBio={userBio}
        initialFavorites={userFavoritesList}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSaveProfile}
      />

      {/* Modal de Conexões da Comunidade (Seguidores / Seguindo) */}
      <ProfileConnectionsModal
        isOpen={connectionsModalOpen}
        initialTab={connectionsTab}
        activeTab={connectionsTab}
        onTabChange={(t) => void handleConnectionsTabChange(t)}
        followers={followersList}
        following={followingList}
        followersCount={followersCount}
        followingCount={followingCount}
        loading={connectionsLoading}
        onClose={() => setConnectionsModalOpen(false)}
      />
    </main>
  );
}
