import { useEffect, useRef } from "react";
import { ProfileAnimeStats } from "@/components/profile/ProfileAnimeStats";
import { ProfileOverviewFavorites } from "@/components/profile/ProfileOverviewFavorites";
import { ProfileRecentActivities } from "@/components/profile/ProfileRecentActivities";
import type { MyProfileComment, UserActivityItem } from "@/lib/profile.functions";
import type { ProfileFavoriteItem, ProfileFavoritesGrouped } from "@/types/favorite";
import type {
  AnimeTrackingStatsSummary,
  UserAnimeTrackingItem,
} from "@/types/profile-tracking";

interface ProfileOverviewSpaceProps {
  trackingStats?: AnimeTrackingStatsSummary | null;
  trackingItems?: UserAnimeTrackingItem[];
  favoritesGrouped: ProfileFavoritesGrouped;
  activityItems?: UserActivityItem[];
  comments?: MyProfileComment[];
  loading?: boolean;
  trackingLoading?: boolean;
  favoritesLoading?: boolean;
  activitiesLoading?: boolean;
  activitiesLoaded?: boolean;
  onRecentActivitiesNearVisible?: () => void;
  onUpdateItem?: (updatedItem: UserAnimeTrackingItem) => void;
  onRemoveFavorite?: (item: ProfileFavoriteItem) => Promise<void> | void;
  profileNick?: string;
  isOwner?: boolean;
}

export function ProfileOverviewSpace({
  trackingStats = null,
  trackingItems = [],
  favoritesGrouped,
  activityItems = [],
  comments = [],
  loading = false,
  trackingLoading = false,
  favoritesLoading = false,
  activitiesLoading,
  activitiesLoaded = true,
  onRecentActivitiesNearVisible,
  onUpdateItem,
  onRemoveFavorite,
  profileNick,
  isOwner = true,
}: ProfileOverviewSpaceProps) {
  const recentActivitiesRef = useRef<HTMLDivElement | null>(null);
  const onNearVisibleRef = useRef(onRecentActivitiesNearVisible);
  onNearVisibleRef.current = onRecentActivitiesNearVisible;
  const triggeredRef = useRef(false);

  const aboveFoldReady = !loading && !trackingLoading && !favoritesLoading;

  useEffect(() => {
    if (activitiesLoaded) {
      triggeredRef.current = true;
      return;
    }
    triggeredRef.current = false;
  }, [activitiesLoaded, profileNick]);

  useEffect(() => {
    if (!aboveFoldReady || activitiesLoaded || triggeredRef.current) return;
    if (!onNearVisibleRef.current) return;

    const fireOnce = () => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;
      onNearVisibleRef.current?.();
    };

    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(fireOnce, 150);
      return () => window.clearTimeout(timer);
    }

    const el = recentActivitiesRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          fireOnce();
        }
      },
      { rootMargin: "100px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [aboveFoldReady, activitiesLoaded]);

  const showRecentActivitiesLoading =
    activitiesLoading !== undefined
      ? activitiesLoading || (!activitiesLoaded && Boolean(onRecentActivitiesNearVisible))
      : loading;

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Seção A: Anime Stats */}
      {trackingLoading && !trackingStats && trackingItems.length === 0 ? (
        <div className="h-64 sm:h-72 rounded-3xl bg-white/[0.03] border border-white/[0.05] animate-pulse" />
      ) : (
        <ProfileAnimeStats
          stats={trackingStats}
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

      {/* Seção Independente abaixo da dobra: Atividades recentes (carregamento progressivo) */}
      <div
        ref={recentActivitiesRef}
        className="[content-visibility:auto] [contain-intrinsic-size:auto_360px]"
      >
        <ProfileRecentActivities
          activityItems={activityItems}
          comments={comments}
          loading={showRecentActivitiesLoading}
        />
      </div>
    </div>
  );
}
