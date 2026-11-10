import { ProfileAnimeStats } from "@/components/profile/ProfileAnimeStats";
import { ProfileOverviewFavorites } from "@/components/profile/ProfileOverviewFavorites";
import { ProfileRecentActivities } from "@/components/profile/ProfileRecentActivities";
import type { MyProfileComment, UserActivityItem } from "@/lib/profile.functions";
import type { ProfileFavoriteItem, ProfileFavoritesGrouped } from "@/types/favorite";
import type { UserAnimeTrackingItem } from "@/types/profile-tracking";

interface ProfileOverviewSpaceProps {
  trackingItems: UserAnimeTrackingItem[];
  favoritesGrouped: ProfileFavoritesGrouped;
  activityItems?: UserActivityItem[];
  comments?: MyProfileComment[];
  loading?: boolean;
  onUpdateItem?: (updatedItem: UserAnimeTrackingItem) => void;
  onRemoveFavorite?: (item: ProfileFavoriteItem) => Promise<void> | void;
}

export function ProfileOverviewSpace({
  trackingItems,
  favoritesGrouped,
  activityItems = [],
  comments = [],
  loading = false,
  onUpdateItem,
  onRemoveFavorite,
}: ProfileOverviewSpaceProps) {
  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Placeholder para Anime Stats */}
        <div className="h-64 rounded-3xl bg-white/[0.03] border border-white/[0.05]" />
        {/* Placeholder para Seções de Favoritos */}
        <div className="h-44 rounded-2xl bg-white/[0.03] border border-white/[0.05]" />
        <div className="h-44 rounded-2xl bg-white/[0.03] border border-white/[0.05]" />
        {/* Placeholder para Atividades Recentes */}
        <div className="h-32 rounded-2xl bg-white/[0.03] border border-white/[0.05]" />
      </div>
    );
  }

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Seção A: Anime Stats */}
      <ProfileAnimeStats items={trackingItems} onUpdateItem={onUpdateItem} />

      {/* Seções B, C, D, E: Favoritos (Animes, Personagens, Studios, People) */}
      <ProfileOverviewFavorites
        grouped={favoritesGrouped}
        onRemoveFavorite={onRemoveFavorite}
      />

      {/* Nova Seção Independente: Atividades recentes (exclusivamente no final da Visão Geral) */}
      <ProfileRecentActivities
        activityItems={activityItems}
        comments={comments}
        loading={loading}
      />
    </div>
  );
}
