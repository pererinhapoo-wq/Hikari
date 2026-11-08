import { ProfileAnimeStats } from "@/components/profile/ProfileAnimeStats";
import { ProfileOverviewFavorites } from "@/components/profile/ProfileOverviewFavorites";
import type { ProfileFavoritesGrouped } from "@/types/favorite";
import type { UserAnimeTrackingItem } from "@/types/profile-tracking";

interface ProfileOverviewSpaceProps {
  trackingItems: UserAnimeTrackingItem[];
  favoritesGrouped: ProfileFavoritesGrouped;
  loading?: boolean;
  onUpdateItem?: (updatedItem: UserAnimeTrackingItem) => void;
}

export function ProfileOverviewSpace({
  trackingItems,
  favoritesGrouped,
  loading = false,
  onUpdateItem,
}: ProfileOverviewSpaceProps) {
  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Placeholder para Anime Stats */}
        <div className="h-64 rounded-3xl bg-white/[0.03] border border-white/[0.05]" />
        {/* Placeholder para Seções de Favoritos */}
        <div className="h-44 rounded-2xl bg-white/[0.03] border border-white/[0.05]" />
        <div className="h-44 rounded-2xl bg-white/[0.03] border border-white/[0.05]" />
      </div>
    );
  }

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Seção A: Anime Stats */}
      <ProfileAnimeStats items={trackingItems} onUpdateItem={onUpdateItem} />

      {/* Seções B, C, D, E: Favoritos (Animes, Personagens, Studios, People) */}
      <ProfileOverviewFavorites grouped={favoritesGrouped} />
    </div>
  );
}
