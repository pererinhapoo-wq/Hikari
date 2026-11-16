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
  trackingLoading?: boolean;
  favoritesLoading?: boolean;
  onUpdateItem?: (updatedItem: UserAnimeTrackingItem) => void;
  onRemoveFavorite?: (item: ProfileFavoriteItem) => Promise<void> | void;
  profileNick?: string;
  isOwner?: boolean;
}

export function ProfileOverviewSpace({
  trackingItems,
  favoritesGrouped,
  activityItems = [],
  comments = [],
  loading = false,
  trackingLoading = false,
  favoritesLoading = false,
  onUpdateItem,
  onRemoveFavorite,
  profileNick,
  isOwner = true,
}: ProfileOverviewSpaceProps) {
  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Seção A: Anime Stats */}
      {trackingLoading && trackingItems.length === 0 ? (
        <div className="h-64 sm:h-72 rounded-3xl bg-white/[0.03] border border-white/[0.05] animate-pulse" />
      ) : (
        <ProfileAnimeStats
          items={trackingItems}
          onUpdateItem={onUpdateItem}
          profileNick={profileNick}
        />
      )}

      {/* Seções B, C, D, E: Favoritos (Animes, Personagens, Studios, People) */}
      {favoritesLoading && Object.values(favoritesGrouped).every((arr) => arr.length === 0) ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-6 w-36 rounded bg-white/[0.05]" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-white/[0.03] border border-white/[0.05]" />
            ))}
          </div>
        </div>
      ) : (
        <ProfileOverviewFavorites
          grouped={favoritesGrouped}
          onRemoveFavorite={onRemoveFavorite}
          isOwner={isOwner}
        />
      )}

      {/* Nova Seção Independente: Atividades recentes (exclusivamente no final da Visão Geral, abaixo da dobra) */}
      <div className="[content-visibility:auto] [contain-intrinsic-size:auto_360px]">
        <ProfileRecentActivities
          activityItems={activityItems}
          comments={comments}
          loading={loading}
        />
      </div>
    </div>
  );
}
