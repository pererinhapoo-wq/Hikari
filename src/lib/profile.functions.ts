import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { executeCreateNotification } from "@/lib/notifications.functions";
import { FALLBACK_ANIMES } from "@/lib/fallback-catalog";
import { ensureUserProfile } from "@/lib/profile-provision";

export type SectionPrivacyLevel = "public" | "followers" | "private";
export type AccountType = "public" | "private";

export interface EvaluatedPrivacy {
  isOwner: boolean;
  isFollower: boolean;
  accountType: AccountType;
  allowFollowers: boolean;
  privacyLists: SectionPrivacyLevel;
  privacyFavorites: SectionPrivacyLevel;
  privacyHistory: SectionPrivacyLevel;
  privacyComments: SectionPrivacyLevel;
  privacyFollowers: SectionPrivacyLevel;
  canViewAccount: boolean;
  canViewLists: boolean;
  canViewFavorites: boolean;
  canViewHistory: boolean;
  canViewComments: boolean;
  canViewFollowers: boolean;
}

export type UserProfile = {
  userId?: string;
  name?: string;
  email?: string;
  image?: string | null;
  bannerUrl?: string | null;
  nick: string;
  bio: string;
  favorites: string[];
  commentCount: number;
  followersCount: number;
  followingCount: number;
  // Campos de privacidade (Migration 0020)
  accountType: AccountType;
  allowFollowers: boolean;
  privacyLists: SectionPrivacyLevel;
  privacyFavorites: SectionPrivacyLevel;
  privacyHistory: SectionPrivacyLevel;
  privacyComments: SectionPrivacyLevel;
  privacyFollowers: SectionPrivacyLevel;
  isVerified?: boolean;
};

export type FollowRelationshipStatus =
  | "self"
  | "following"
  | "requested"
  | "none";

export interface UserRelationship {
  targetUserId: string;
  isSelf: boolean;
  isFollowing: boolean;
  isFollowedBy: boolean;
  hasPendingRequestFromViewer: boolean;
  hasPendingRequestToViewer: boolean;
  isBlocked: boolean;
  isBlockedByMe: boolean;
  isBlockedByTarget: boolean;
  targetAccountType: AccountType;
  targetAllowFollowers: boolean;
  relationStatus: FollowRelationshipStatus;
}

export type BlockedUserItem = {
  id: string;
  userId: string;
  nick: string;
  username: string;
  name: string;
  image: string | null;
  blockedAt: string;
};

export interface UserBlockStatus {
  targetUserId: string;
  isBlockedByMe: boolean;
  isBlockedByTarget: boolean;
  hasBlock: boolean;
  isBlocked: boolean;
}

export type FollowRequestItem = {
  requesterId: string;
  targetId: string;
  status: "pending" | "rejected";
  createdAt: string;
  updatedAt: string;
  nick: string;
  name: string;
  image: string | null;
};

export type PublicUserProfile = {
  userId: string;
  name?: string;
  nick: string;
  bio: string;
  image: string | null;
  bannerUrl?: string | null;
  commentCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  hasPendingRequest: boolean;
  relationStatus: FollowRelationshipStatus;
  isBlocked?: boolean;
  isBlockedByMe?: boolean;
  isBlockedByTarget?: boolean;
  // Permissões e privacidade avaliadas no servidor
  accountType: AccountType;
  allowFollowers: boolean;
  privacyLists: SectionPrivacyLevel;
  privacyFavorites: SectionPrivacyLevel;
  privacyHistory: SectionPrivacyLevel;
  privacyComments: SectionPrivacyLevel;
  privacyFollowers: SectionPrivacyLevel;
  isOwner: boolean;
  canViewContent: boolean;
  canViewLists: boolean;
  canViewFavorites: boolean;
  canViewHistory: boolean;
  canViewComments: boolean;
  canViewFollowers: boolean;
  isVerified: boolean;
  canManageVerification?: boolean;
};

export type ProfileUser = {
  userId: string;
  nick: string;
  name: string;
  image: string | null;
  isFollowing: boolean;
  isVerified?: boolean;
  followsViewer?: boolean;
  followsOpenProfile?: boolean;
};

export type MyProfileComment = {
  id: string;
  animeId: string;
  episodeId: string;
  content: string;
  parentId: string | null;
  isSpoiler: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
  userName: string;
  userImage: string | null;
  likes: number;
  liked: boolean;
  animeTitle?: string;
  animeCover?: string | null;
  imageUrl?: string | null;
};

export type PublicProfileComment = MyProfileComment;

export interface ProfileCommentsResponse {
  items: MyProfileComment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export type ActivityType =
  | "watched_episode"
  | "tracking_added"
  | "tracking_updated"
  | "favorite_added"
  | "list_created"
  | "list_item_added";

export interface UserActivityItem {
  id: string;
  type: ActivityType;
  createdAt: string;
  description: string;
  resourceId: string;
  resourceTitle: string;
  resourceCover: string | null;
  resourceType: "anime" | "list" | "character" | "studio" | "company" | "person";
  metadata?: {
    episodeId?: string;
    episodeNumber?: number;
    origin?: string;
    status?: string;
    score?: number | null;
    listId?: string;
    listTitle?: string;
    targetType?: string;
  };
}

export interface UserActivitiesResponse {
  items: UserActivityItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

function parseFavorites(
  value: unknown,
): string[] {
  if (
    typeof value !== "string" ||
    !value
  ) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter(
          (
            item,
          ): item is string =>
            typeof item === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function normalizeNick(
  value: unknown,
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .slice(0, 100);
}

function isValidNick(
  nick: string,
): boolean {
  return /^[a-z0-9_]{3,30}$/.test(
    nick,
  );
}

/**
 * Avaliador central de privacidade e visibilidade de seções do perfil (Migration 0020).
 * Executado estritamente no servidor.
 */
export async function evaluateUserPrivacy(
  sql: Sql,
  ownerUserId: string,
  viewerUserId: string | null,
): Promise<EvaluatedPrivacy> {
  const isOwner = Boolean(viewerUserId && viewerUserId === ownerUserId);

  const rows = await sql<{
    accountType: string | null;
    allowFollowers: boolean | null;
    privacyLists: string | null;
    privacyFavorites: string | null;
    privacyHistory: string | null;
    privacyComments: string | null;
    privacyFollowers: string | null;
  }>`
    select
      "accountType",
      "allowFollowers",
      "privacyLists",
      "privacyFavorites",
      "privacyHistory",
      "privacyComments",
      "privacyFollowers"
    from "profile"
    where "userId" = ${ownerUserId}
    limit 1
  `;

  const profile = rows[0];
  const accountType: AccountType =
    profile?.accountType === "private" ? "private" : "public";
  const allowFollowers = profile?.allowFollowers ?? true;
  const privacyLists: SectionPrivacyLevel =
    (profile?.privacyLists as SectionPrivacyLevel) || "public";
  const privacyFavorites: SectionPrivacyLevel =
    (profile?.privacyFavorites as SectionPrivacyLevel) || "public";
  const privacyHistory: SectionPrivacyLevel =
    (profile?.privacyHistory as SectionPrivacyLevel) || "public";
  const privacyComments: SectionPrivacyLevel =
    (profile?.privacyComments as SectionPrivacyLevel) || "public";
  const privacyFollowers: SectionPrivacyLevel =
    (profile?.privacyFollowers as SectionPrivacyLevel) || "public";

  if (isOwner) {
    return {
      isOwner: true,
      isFollower: false,
      accountType,
      allowFollowers,
      privacyLists,
      privacyFavorites,
      privacyHistory,
      privacyComments,
      privacyFollowers,
      canViewAccount: true,
      canViewLists: true,
      canViewFavorites: true,
      canViewHistory: true,
      canViewComments: true,
      canViewFollowers: true,
    };
  }

  let isFollower = false;
  let isBlocked = false;

  if (viewerUserId) {
    const blockRows = await sql<{
      isBlockedByOwner: boolean;
      isBlockedByViewer: boolean;
    }>`
      select
        exists (
          select 1 from "user_block"
          where "blockerId" = ${ownerUserId} and "blockedId" = ${viewerUserId}
        ) as "isBlockedByOwner",
        exists (
          select 1 from "user_block"
          where "blockerId" = ${viewerUserId} and "blockedId" = ${ownerUserId}
        ) as "isBlockedByViewer"
    `;

    const b = blockRows[0];
    isBlocked = Boolean(b?.isBlockedByOwner || b?.isBlockedByViewer);

    if (!isBlocked) {
      const followRows = await sql<{ count: string }>`
        select count(*)::text as count
        from "user_follow"
        where "followerId" = ${viewerUserId}
          and "followingId" = ${ownerUserId}
        limit 1
      `;
      isFollower = Number(followRows[0]?.count ?? "0") > 0;
    }
  }

  // Se houver bloqueio mútuo ativo:
  if (isBlocked) {
    return {
      isOwner: false,
      isFollower: false,
      accountType,
      allowFollowers,
      privacyLists,
      privacyFavorites,
      privacyHistory,
      privacyComments,
      privacyFollowers,
      canViewAccount: accountType === "public",
      canViewLists: false,
      canViewFavorites: false,
      canViewHistory: false,
      canViewComments: false,
      canViewFollowers: false,
    };
  }

  // Se a conta for privada e o visitante não for seguidor aprovado:
  if (accountType === "private" && !isFollower) {
    return {
      isOwner: false,
      isFollower: false,
      accountType,
      allowFollowers,
      privacyLists,
      privacyFavorites,
      privacyHistory,
      privacyComments,
      privacyFollowers,
      canViewAccount: false,
      canViewLists: false,
      canViewFavorites: false,
      canViewHistory: false,
      canViewComments: false,
      canViewFollowers: false,
    };
  }

  function canViewSection(level: SectionPrivacyLevel): boolean {
    if (level === "public") return true;
    if (level === "followers") return isFollower;
    return false; // se "private", apenas o proprietário
  }

  return {
    isOwner: false,
    isFollower,
    accountType,
    allowFollowers,
    privacyLists,
    privacyFavorites,
    privacyHistory,
    privacyComments,
    privacyFollowers,
    canViewAccount: true,
    canViewLists: canViewSection(privacyLists),
    canViewFavorites: canViewSection(privacyFavorites),
    canViewHistory: canViewSection(privacyHistory),
    canViewComments: canViewSection(privacyComments),
    canViewFollowers: canViewSection(privacyFollowers),
  };
}

/* ============================================================ */
/* MEU PERFIL                                                     */
/* ============================================================ */

export const getProfile =
  createServerFn({
    method: "GET",
  })
    .middleware([authMiddleware])
    .handler(async ({ context }) => {
      const sql = await getSql();

      const [rows, commentRows, followerRows, followingRows, userRows] = await Promise.all([
        sql<{
          nick: string | null;
          bio: string | null;
          favorites: string | null;
          displayName: string | null;
          avatarUrl: string | null;
          bannerUrl: string | null;
          accountType: string | null;
          allowFollowers: boolean | null;
          privacyLists: string | null;
          privacyFavorites: string | null;
          privacyHistory: string | null;
          privacyComments: string | null;
          privacyFollowers: string | null;
          isVerified: boolean | null;
        }>`
          select
            "nick",
            "bio",
            "favorites",
            "displayName",
            "avatarUrl",
            "bannerUrl",
            "accountType",
            "allowFollowers",
            "privacyLists",
            "privacyFavorites",
            "privacyHistory",
            "privacyComments",
            "privacyFollowers",
            coalesce("isVerified", false) as "isVerified"
          from "profile"
          where "userId" = ${context.userId}
          limit 1
        `,
        sql<{ count: string }>`
          select count(*)::text as count
          from "comment"
          where "userId" = ${context.userId}
        `,
        sql<{ count: string }>`
          select count(*)::text as count
          from "user_follow"
          where "followingId" = ${context.userId}
        `,
        sql<{ count: string }>`
          select count(*)::text as count
          from "user_follow"
          where "followerId" = ${context.userId}
        `,
        sql<{
          name: string | null;
          email: string | null;
          image: string | null;
        }>`
          select "name", "email", "image"
          from "user"
          where "id" = ${context.userId}
          limit 1
        `,
      ]);

      const userRow = userRows[0];
      let row = rows[0];

      // Auto-provisionamento seguro e idempotente para contas existentes sem perfil ou sem nick
      if (!row || !row.nick) {
        const { ensureUserProfile } = await import("./profile-provision");
        await ensureUserProfile(sql, {
          id: context.userId,
          name: userRow?.name,
          image: userRow?.image,
        });

        const refreshedRows = await sql<{
          nick: string | null;
          bio: string | null;
          favorites: string | null;
          displayName: string | null;
          avatarUrl: string | null;
          bannerUrl: string | null;
          accountType: string | null;
          allowFollowers: boolean | null;
          privacyLists: string | null;
          privacyFavorites: string | null;
          privacyHistory: string | null;
          privacyComments: string | null;
          privacyFollowers: string | null;
          isVerified: boolean | null;
        }>`
          select
            "nick",
            "bio",
            "favorites",
            "displayName",
            "avatarUrl",
            "bannerUrl",
            "accountType",
            "allowFollowers",
            "privacyLists",
            "privacyFavorites",
            "privacyHistory",
            "privacyComments",
            "privacyFollowers",
            coalesce("isVerified", false) as "isVerified"
          from "profile"
          where "userId" = ${context.userId}
          limit 1
        `;
        row = refreshedRows[0];
      }

      return {
        userId: context.userId,
        name: row?.displayName || userRow?.name || "",
        email: userRow?.email ?? "",
        image: row?.avatarUrl || userRow?.image || null,
        bannerUrl: row?.bannerUrl ?? null,
        nick: row?.nick ?? "",
        bio: row?.bio ?? "",
        favorites: parseFavorites(
          row?.favorites,
        ),
        commentCount: Number(
          commentRows[0]?.count ?? "0",
        ),
        followersCount: Number(
          followerRows[0]?.count ?? "0",
        ),
        followingCount: Number(
          followingRows[0]?.count ?? "0",
        ),
        accountType: (row?.accountType === "private" ? "private" : "public") as AccountType,
        allowFollowers: row?.allowFollowers ?? true,
        privacyLists: (row?.privacyLists as SectionPrivacyLevel) || "public",
        privacyFavorites: (row?.privacyFavorites as SectionPrivacyLevel) || "public",
        privacyHistory: (row?.privacyHistory as SectionPrivacyLevel) || "public",
        privacyComments: (row?.privacyComments as SectionPrivacyLevel) || "public",
        privacyFollowers: (row?.privacyFollowers as SectionPrivacyLevel) || "public",
        isVerified: Boolean(row?.isVerified),
      } satisfies UserProfile;
    });

/* ============================================================ */
/* PERFIL PÚBLICO                                                  */
/* ============================================================ */

export async function executeGetPublicProfile(
  sql: Sql,
  rawNick: unknown,
  viewerUserId: string | null,
): Promise<PublicUserProfile> {
  const nick = normalizeNick(rawNick);
  if (!nick) {
    throw new Error("Nick não informado.");
  }

  const rows = await sql<{
    userId: string;
    userName: string | null;
    userImage: string | null;
    name: string | null;
    nick: string | null;
    bio: string | null;
    image: string | null;
    bannerUrl: string | null;
    isVerified: boolean | null;
  }>`
    select
      u."id" as "userId",
      u."name" as "userName",
      u."image" as "userImage",
      coalesce(p."displayName", u."name") as "name",
      p."nick",
      p."bio",
      coalesce(p."avatarUrl", u."image") as "image",
      p."bannerUrl",
      coalesce(p."isVerified", false) as "isVerified"
    from "user" u
    left join "profile" p on p."userId" = u."id"
    where (p."nick" is not null and lower(trim(p."nick")) = lower(${nick}))
       or lower(u."id") = lower(${nick})
    limit 1
  `;

  let row = rows[0];
  if (!row) {
    throw new Error("Esse perfil não existe.");
  }

  if (!row.nick || row.nick === "usuario") {
    const provisioned = await ensureUserProfile(sql, {
      id: row.userId,
      name: row.userName || row.name,
      image: row.userImage || row.image,
    });
    row = {
      ...row,
      nick: provisioned.nick,
    };
  }

  // Avaliação estrita de privacidade no servidor
  const privacy = await evaluateUserPrivacy(sql, row.userId, viewerUserId);

  const [commentRows, followerRows, followingRows, blockRows, reqRows] = await Promise.all([
    privacy.canViewComments
      ? sql<{ count: string }>`select count(*)::text as count from "comment" where "userId" = ${row.userId}`
      : Promise.resolve([]),
    privacy.canViewFollowers
      ? sql<{ count: string }>`select count(*)::text as count from "user_follow" where "followingId" = ${row.userId}`
      : Promise.resolve([]),
    privacy.canViewFollowers
      ? sql<{ count: string }>`select count(*)::text as count from "user_follow" where "followerId" = ${row.userId}`
      : Promise.resolve([]),
    viewerUserId && viewerUserId !== row.userId
      ? sql<{ isBlockedByMe: boolean; isBlockedByTarget: boolean }>`
          select
            exists (
              select 1 from "user_block"
              where "blockerId" = ${viewerUserId} and "blockedId" = ${row.userId}
            ) as "isBlockedByMe",
            exists (
              select 1 from "user_block"
              where "blockerId" = ${row.userId} and "blockedId" = ${viewerUserId}
            ) as "isBlockedByTarget"
        `
      : Promise.resolve([]),
    viewerUserId && !privacy.isOwner && !privacy.isFollower
      ? sql<{ count: string }>`
          select count(*)::text as count
          from "user_follow_request"
          where "requesterId" = ${viewerUserId}
            and "targetId" = ${row.userId}
            and "status" = 'pending'
          limit 1
        `
      : Promise.resolve([]),
  ]);

  const commentCount = Number(commentRows[0]?.count ?? "0");
  const followersCount = Number(followerRows[0]?.count ?? "0");
  const followingCount = Number(followingRows[0]?.count ?? "0");

  const b = blockRows[0];
  const isBlockedByMe = Boolean(b?.isBlockedByMe);
  const isBlockedByTarget = Boolean(b?.isBlockedByTarget);
  const isBlocked = isBlockedByMe || isBlockedByTarget;

  const hasPendingRequest = !isBlocked && Number(reqRows[0]?.count ?? "0") > 0;

  let relationStatus: FollowRelationshipStatus = "none";
  if (privacy.isOwner) {
    relationStatus = "self";
  } else if (isBlocked) {
    relationStatus = "none";
  } else if (privacy.isFollower) {
    relationStatus = "following";
  } else if (hasPendingRequest) {
    relationStatus = "requested";
  }

  let canManageVerification = false;
  if (viewerUserId) {
    const vRows = await sql<{ nick: string | null }>`
      select p."nick"
      from "profile" p
      where p."userId" = ${viewerUserId}
      limit 1
    `;
    const vNick = (vRows[0]?.nick || "").trim().toLowerCase();
    canManageVerification = vNick === "pererinha";
  }

  return {
    userId: row.userId,
    name: row.name || row.nick || "Usuário",
    nick: row.nick || row.userId,
    bio: privacy.canViewAccount ? (row.bio ?? "") : "",
    image: row.image,
    bannerUrl: privacy.canViewAccount ? (row.bannerUrl ?? null) : null,
    commentCount,
    followersCount,
    followingCount,
    isFollowing: isBlocked ? false : privacy.isFollower,
    hasPendingRequest,
    relationStatus,
    isBlocked,
    isBlockedByMe,
    isBlockedByTarget,
    accountType: privacy.accountType,
    allowFollowers: privacy.allowFollowers,
    privacyLists: privacy.privacyLists,
    privacyFavorites: privacy.privacyFavorites,
    privacyHistory: privacy.privacyHistory,
    privacyComments: privacy.privacyComments,
    privacyFollowers: privacy.privacyFollowers,
    isOwner: privacy.isOwner,
    canViewContent: privacy.canViewAccount,
    canViewLists: privacy.canViewLists,
    canViewFavorites: privacy.canViewFavorites,
    canViewHistory: privacy.canViewHistory,
    canViewComments: privacy.canViewComments,
    canViewFollowers: privacy.canViewFollowers,
    isVerified: Boolean(row.isVerified),
    canManageVerification,
  };
}

export const getPublicProfile =
  createServerFn({
    method: "GET",
  })
    .middleware([optionalAuthMiddleware])
    .validator((d: { nick: string }) => d)
    .handler(async ({ context, data }) => {
      const viewerUserId = context?.userId ?? null;
      const sql = await getSql();
      return executeGetPublicProfile(sql, data?.nick, viewerUserId);
    });

/* ============================================================ */
/* SEGUIDORES                                                      */
/* ============================================================ */

export const getProfileFollowers =
  createServerFn({
    method: "GET",
  })
    .middleware([authMiddleware])
    .handler(async ({
      context,
    }) => {
      const sql = await getSql();
      const currentUserId = context?.userId ?? null;

      if (!currentUserId) {
        return [];
      }

      const rows =
        await sql<{
          userId: string;
          nick: string | null;
          name: string | null;
          image: string | null;
          isFollowing: boolean;
          isVerified: boolean;
        }>`
          select
            u."id" as "userId",
            coalesce(p."nick", u."id") as "nick",
            coalesce(p."displayName", u."name", 'Usuário') as "name",
            coalesce(p."avatarUrl", u."image") as "image",
            coalesce(p."isVerified", false) as "isVerified",
            exists (
              select 1
              from "user_follow" f
              where f."followerId" = ${currentUserId}
                and f."followingId" = u."id"
            ) as "isFollowing"
          from "user_follow" uf

          inner join "user" u
            on u."id" =
              uf."followerId"

          left join "profile" p
            on p."userId" =
              u."id"

          where uf."followingId" =
            ${currentUserId}

          order by
            uf."createdAt" desc
        `;

      const result: ProfileUser[] = [];

      for (const row of rows) {
        result.push({
          userId: row.userId,
          nick: row.nick || row.userId,
          name:
            row.name ||
            "Usuário",
          image: row.image,
          isFollowing: Boolean(row.isFollowing),
          isVerified: Boolean(row.isVerified),
          followsOpenProfile: true,
          followsViewer: true,
        });
      }

      return result;
    });

/* ============================================================ */
/* SEGUINDO                                                        */
/* ============================================================ */

export const getProfileFollowing =
  createServerFn({
    method: "GET",
  })
    .middleware([authMiddleware])
    .handler(async ({
      context,
    }) => {
      const sql = await getSql();
      const currentUserId = context?.userId ?? null;

      if (!currentUserId) {
        return [];
      }

      const rows =
        await sql<{
          userId: string;
          nick: string | null;
          name: string | null;
          image: string | null;
          isFollowing: boolean;
          isVerified: boolean;
          followsViewer: boolean;
        }>`
          select
            u."id" as "userId",
            coalesce(p."nick", u."id") as "nick",
            coalesce(p."displayName", u."name", 'Usuário') as "name",
            coalesce(p."avatarUrl", u."image") as "image",
            coalesce(p."isVerified", false) as "isVerified",
            true as "isFollowing",
            exists (
              select 1
              from "user_follow" f
              where f."followerId" = u."id"
                and f."followingId" = ${currentUserId}
            ) as "followsViewer"
          from "user_follow" uf

          inner join "user" u
            on u."id" =
              uf."followingId"

          left join "profile" p
            on p."userId" =
              u."id"

          where uf."followerId" =
            ${currentUserId}

          order by
            uf."createdAt" desc
        `;

      const result: ProfileUser[] = [];

      for (const row of rows) {
        result.push({
          userId: row.userId,
          nick: row.nick || row.userId,
          name:
            row.name ||
            "Usuário",
          image: row.image,
          isFollowing: true,
          isVerified: Boolean(row.isVerified),
          followsOpenProfile: Boolean(row.followsViewer),
          followsViewer: Boolean(row.followsViewer),
        });
      }

      return result;
    });

/* ============================================================ */
/* MEUS COMENTÁRIOS                                               */
/* ============================================================ */

export async function executeGetComments(
  sql: Sql,
  targetUserId: string,
  viewerUserId: string | null,
  isOwner: boolean,
  page = 1,
  limit = 15,
): Promise<ProfileCommentsResponse> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(50, limit));
  const offset = (safePage - 1) * safeLimit;

  const selectQuery = `
    SELECT
      c."id",
      c."animeId",
      c."episodeId",
      c."content",
      c."imageUrl",
      c."parentId",
      c."isSpoiler",
      c."createdAt",
      c."updatedAt",
      c."userId",
      COALESCE(u."name", 'Usuário') AS "userName",
      u."image" AS "userImage",
      COALESCE(ca."title", (uat."animeSnapshot"->>'title'), 'Anime indisponível') AS "animeTitle",
      COALESCE(ca."cover", (uat."animeSnapshot"->>'cover'), NULL) AS "animeCover",
      (
        SELECT count(*)::int
        FROM "comment_like" cl
        WHERE cl."commentId" = c."id"
      ) AS "likes",
      CASE
        WHEN $2::text IS NOT NULL THEN
          EXISTS (
            SELECT 1
            FROM "comment_like" cl2
            WHERE cl2."commentId" = c."id"
              AND cl2."userId" = $2
          )
        ELSE false
      END AS "liked"
    FROM "comment" c
    LEFT JOIN "user" u ON u."id" = c."userId"
    LEFT JOIN "catalog_anime" ca ON ca."id" = c."animeId"
    LEFT JOIN "user_anime_tracking" uat ON uat."userId" = c."userId" AND uat."animeId" = c."animeId"
    WHERE c."userId" = $1
    ORDER BY c."createdAt" DESC, c."id" DESC
    LIMIT $3 OFFSET $4
  `;

  const [countRows, rows] = await Promise.all([
    sql.query<{ total: number }>(
      `SELECT count(*)::int as total FROM "comment" WHERE "userId" = $1`,
      [targetUserId],
    ),
    sql.query<{
      id: string;
      animeId: string;
      episodeId: string;
      content: string;
      imageUrl: string | null;
      parentId: string | null;
      isSpoiler: boolean;
      createdAt: Date | string;
      updatedAt: Date | string;
      userId: string;
      userName: string;
      userImage: string | null;
      animeTitle: string;
      animeCover: string | null;
      likes: number;
      liked: boolean;
    }>(selectQuery, [targetUserId, viewerUserId, safeLimit, offset]),
  ]);

  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.ceil(total / safeLimit) || 1;

  const items: MyProfileComment[] = rows.map((comment) => {
    let animeTitle = comment.animeTitle || "Anime indisponível";
    let animeCover = comment.animeCover || null;

    if (animeTitle === "Anime indisponível" || !animeTitle) {
      const fallback = FALLBACK_ANIMES.find((a) => a.id === comment.animeId);
      if (fallback) {
        animeTitle =
          fallback.titles?.romaji ||
          fallback.titles?.english ||
          fallback.titles?.native ||
          animeTitle;
        animeCover = fallback.cover || animeCover;
      }
    }

    return {
      ...comment,
      createdAt:
        comment.createdAt instanceof Date
          ? comment.createdAt.toISOString()
          : String(comment.createdAt),
      updatedAt:
        comment.updatedAt instanceof Date
          ? comment.updatedAt.toISOString()
          : String(comment.updatedAt),
      likes: Number(comment.likes ?? 0) || 0,
      liked: Boolean(comment.liked),
      animeTitle,
      animeCover,
      imageUrl: comment.imageUrl || null,
    };
  });

  return {
    items,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
    hasMore: safePage < totalPages,
  };
}

export const getMyComments = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .validator((d?: { page?: number; limit?: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return executeGetComments(
      sql,
      context.userId,
      context.userId,
      true,
      data?.page ?? 1,
      data?.limit ?? 15,
    );
  });

/* ============================================================ */
/* COMENTÁRIOS DO PERFIL PÚBLICO                                  */
/* ============================================================ */

export const getPublicComments = createServerFn({
  method: "GET",
})
  .middleware([optionalAuthMiddleware])
  .validator((d: { userId: string; page?: number; limit?: number }) => d)
  .handler(async ({ context, data }) => {
    const viewerUserId = context?.userId ?? null;
    const userId = (data?.userId || "").trim();
    if (!userId) {
      throw new Error("Usuário não informado.");
    }

    const sql = await getSql();
    const privacy = await evaluateUserPrivacy(sql, userId, viewerUserId);
    if (!privacy.canViewComments) {
      throw new Error("Os comentários deste perfil são privados.");
    }

    return executeGetComments(
      sql,
      userId,
      viewerUserId,
      privacy.isOwner,
      data?.page ?? 1,
      data?.limit ?? 15,
    );
  });

/* ============================================================ */
/* FEED DE ATIVIDADES REAIS DO PERFIL (ETAPA 11)                */
/* ============================================================ */

export async function executeGetUserActivities(
  sql: Sql,
  targetUserId: string,
  permissionsOrIsOwner:
    | boolean
    | {
        isOwner: boolean;
        canViewLists?: boolean;
        canViewFavorites?: boolean;
      },
  page = 1,
  limit = 15,
): Promise<UserActivitiesResponse> {
  const isOwner =
    typeof permissionsOrIsOwner === "boolean"
      ? permissionsOrIsOwner
      : Boolean(permissionsOrIsOwner.isOwner);
  const canViewLists =
    typeof permissionsOrIsOwner === "boolean"
      ? permissionsOrIsOwner
      : Boolean(permissionsOrIsOwner.canViewLists ?? isOwner);
  const canViewFavorites =
    typeof permissionsOrIsOwner === "boolean"
      ? permissionsOrIsOwner
      : Boolean(permissionsOrIsOwner.canViewFavorites ?? isOwner);

  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(50, limit));
  const offset = (safePage - 1) * safeLimit;

  const countQuery = `
    WITH user_activities AS (
      -- 1. Episódios assistidos
      SELECT
        uwe."watchedAt" AS "createdAt"
      FROM "user_watched_episode" uwe
      WHERE uwe."userId" = $1

      UNION ALL

      -- 2. Anime adicionado ao acompanhamento
      SELECT
        uat."createdAt" AS "createdAt"
      FROM "user_anime_tracking" uat
      WHERE uat."userId" = $1

      UNION ALL

      -- 3. Favoritos adicionados
      SELECT
        uf."createdAt" AS "createdAt"
      FROM "user_favorite" uf
      WHERE uf."userId" = $1
        AND ($4::boolean = true)

      UNION ALL

      -- 4. Criação de lista personalizada
      SELECT
        ucl."createdAt" AS "createdAt"
      FROM "user_custom_list" ucl
      WHERE ucl."userId" = $1
        AND ($3::boolean = true)
        AND ($2::boolean = true OR ucl."isPublic" = true)

      UNION ALL

      -- 5. Adição de anime a uma lista personalizada
      SELECT
        ucli."addedAt" AS "createdAt"
      FROM "user_custom_list_item" ucli
      INNER JOIN "user_custom_list" ucl ON ucl."id" = ucli."listId"
      WHERE ucl."userId" = $1
        AND ($3::boolean = true)
        AND ($2::boolean = true OR ucl."isPublic" = true)
    )
    SELECT count(*)::int AS total FROM user_activities;
  `;

  const selectQuery = `
    WITH user_activities AS (
      -- 1. Episódios assistidos
      SELECT
        'watched:' || uwe."animeId" || ':' || uwe."episodeId" || ':' || to_char(uwe."watchedAt" at time zone 'UTC', 'YYYYMMDDHH24MISSMS') AS "id",
        'watched_episode' AS "type",
        uwe."watchedAt" AS "createdAt",
        'Assistiu ao episódio ' || uwe."episodeNumber" AS "description",
        uwe."animeId" AS "resourceId",
        COALESCE(ca."title", (uat."animeSnapshot"->>'title'), 'Anime') AS "resourceTitle",
        COALESCE(ca."cover", (uat."animeSnapshot"->>'cover'), NULL) AS "resourceCover",
        'anime' AS "resourceType",
        json_build_object(
          'episodeId', uwe."episodeId",
          'episodeNumber', uwe."episodeNumber",
          'origin', uwe."origin"
        )::text AS "metadata"
      FROM "user_watched_episode" uwe
      LEFT JOIN "catalog_anime" ca ON ca."id" = uwe."animeId"
      LEFT JOIN "user_anime_tracking" uat ON uat."userId" = uwe."userId" AND uat."animeId" = uwe."animeId"
      WHERE uwe."userId" = $1

      UNION ALL

      -- 2. Anime adicionado ao acompanhamento
      SELECT
        'tracking_add:' || uat."animeId" || ':' || to_char(uat."createdAt" at time zone 'UTC', 'YYYYMMDDHH24MISSMS') AS "id",
        'tracking_added' AS "type",
        uat."createdAt" AS "createdAt",
        CASE uat."status"
          WHEN 'watching' THEN 'Começou a assistir o anime'
          WHEN 'completed' THEN 'Marcou como concluído'
          WHEN 'planning' THEN 'Adicionou à lista de interesse'
          WHEN 'on_hold' THEN 'Colocou em espera'
          WHEN 'dropped' THEN 'Marcou como abandonado'
          ELSE 'Adicionou à lista de animes'
        END AS "description",
        uat."animeId" AS "resourceId",
        COALESCE(ca."title", (uat."animeSnapshot"->>'title'), 'Anime') AS "resourceTitle",
        COALESCE(ca."cover", (uat."animeSnapshot"->>'cover'), NULL) AS "resourceCover",
        'anime' AS "resourceType",
        json_build_object(
          'status', uat."status",
          'score', uat."score",
          'episodesWatched', uat."episodesWatched"
        )::text AS "metadata"
      FROM "user_anime_tracking" uat
      LEFT JOIN "catalog_anime" ca ON ca."id" = uat."animeId"
      WHERE uat."userId" = $1

      UNION ALL

      -- 3. Favoritos adicionados
      SELECT
        'fav:' || uf."id" AS "id",
        'favorite_added' AS "type",
        uf."createdAt" AS "createdAt",
        CASE uf."targetType"
          WHEN 'anime' THEN 'Adicionou anime aos favoritos'
          WHEN 'character' THEN 'Adicionou personagem aos favoritos'
          WHEN 'studio' THEN 'Adicionou estúdio aos favoritos'
          WHEN 'company' THEN 'Adicionou produtora aos favoritos'
          WHEN 'person' THEN 'Adicionou pessoa aos favoritos'
          ELSE 'Adicionou aos favoritos'
        END AS "description",
        COALESCE(uf."animeId", uf."characterId", uf."studioId", uf."companyId", uf."personId") AS "resourceId",
        COALESCE(ca."title", cc."name", cs."name", cco."name", cp."name", 'Favorito') AS "resourceTitle",
        COALESCE(ca."cover", cc."imageUrl", cs."logoUrl", cco."logoUrl", cp."imageUrl", NULL) AS "resourceCover",
        uf."targetType" AS "resourceType",
        json_build_object(
          'targetType', uf."targetType"
        )::text AS "metadata"
      FROM "user_favorite" uf
      LEFT JOIN "catalog_anime" ca ON ca."id" = uf."animeId"
      LEFT JOIN "catalog_character" cc ON cc."id" = uf."characterId"
      LEFT JOIN "catalog_studio" cs ON cs."id" = uf."studioId"
      LEFT JOIN "catalog_company" cco ON cco."id" = uf."companyId"
      LEFT JOIN "catalog_person" cp ON cp."id" = uf."personId"
      WHERE uf."userId" = $1
        AND ($4::boolean = true)

      UNION ALL

      -- 5. Criação de lista personalizada
      SELECT
        'list_create:' || ucl."id" AS "id",
        'list_created' AS "type",
        ucl."createdAt" AS "createdAt",
        'Criou a lista "' || ucl."title" || '"' AS "description",
        ucl."id" AS "resourceId",
        ucl."title" AS "resourceTitle",
        NULL AS "resourceCover",
        'list' AS "resourceType",
        json_build_object(
          'listId', ucl."id",
          'isPublic', ucl."isPublic"
        )::text AS "metadata"
      FROM "user_custom_list" ucl
      WHERE ucl."userId" = $1
        AND ($3::boolean = true)
        AND ($2::boolean = true OR ucl."isPublic" = true)

      UNION ALL

      -- 6. Adição de anime a uma lista personalizada
      SELECT
        'list_item:' || ucli."listId" || ':' || ucli."animeId" AS "id",
        'list_item_added' AS "type",
        ucli."addedAt" AS "createdAt",
        'Adicionou à lista "' || ucl."title" || '"' AS "description",
        ucli."animeId" AS "resourceId",
        COALESCE(ca."title", (ucli."animeSnapshot"->>'title'), 'Anime') AS "resourceTitle",
        COALESCE(ca."cover", (ucli."animeSnapshot"->>'cover'), NULL) AS "resourceCover",
        'anime' AS "resourceType",
        json_build_object(
          'listId', ucl."id",
          'listTitle', ucl."title"
        )::text AS "metadata"
      FROM "user_custom_list_item" ucli
      INNER JOIN "user_custom_list" ucl ON ucl."id" = ucli."listId"
      LEFT JOIN "catalog_anime" ca ON ca."id" = ucli."animeId"
      WHERE ucl."userId" = $1
        AND ($3::boolean = true)
        AND ($2::boolean = true OR ucl."isPublic" = true)
    )
    SELECT
      "id",
      "type",
      "createdAt",
      "description",
      "resourceId",
      "resourceTitle",
      "resourceCover",
      "resourceType",
      "metadata"
    FROM user_activities
    ORDER BY "createdAt" DESC, "id" DESC
    LIMIT $5 OFFSET $6;
  `;

  const [countRes, rows] = await Promise.all([
    sql.query<{ total: number }>(countQuery, [
      targetUserId,
      isOwner,
      canViewLists,
      canViewFavorites,
    ]),
    sql.query<{
      id: string;
      type: ActivityType;
      createdAt: Date | string;
      description: string;
      resourceId: string;
      resourceTitle: string;
      resourceCover: string | null;
      resourceType: "anime" | "list" | "character" | "studio" | "company" | "person";
      metadata: string | null;
    }>(selectQuery, [
      targetUserId,
      isOwner,
      canViewLists,
      canViewFavorites,
      safeLimit,
      offset,
    ]),
  ]);

  const total = Number(countRes[0]?.total || 0);
  const totalPages = Math.ceil(total / safeLimit) || 1;

  const items: UserActivityItem[] = rows.map((r) => {
    let parsedMetadata = undefined;
    if (r.metadata) {
      try {
        parsedMetadata =
          typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata;
      } catch {
        parsedMetadata = undefined;
      }
    }

    let resourceTitle = r.resourceTitle || "Item";
    let resourceCover = r.resourceCover || null;

    if (r.resourceType === "anime" && (!resourceTitle || resourceTitle === "Anime")) {
      const fallback = FALLBACK_ANIMES.find((a) => a.id === r.resourceId);
      if (fallback) {
        resourceTitle =
          fallback.titles?.romaji ||
          fallback.titles?.english ||
          fallback.titles?.native ||
          resourceTitle;
        resourceCover = fallback.cover || resourceCover;
      }
    }

    return {
      id: r.id,
      type: r.type,
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt),
      description: r.description,
      resourceId: r.resourceId,
      resourceTitle,
      resourceCover,
      resourceType: r.resourceType,
      metadata: parsedMetadata,
    };
  });

  return {
    items,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
    hasMore: safePage < totalPages,
  };
}

export const getMyActivities = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .validator((d?: { page?: number; limit?: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return executeGetUserActivities(
      sql,
      context.userId,
      {
        isOwner: true,
        canViewLists: true,
        canViewFavorites: true,
      },
      data?.page ?? 1,
      data?.limit ?? 15,
    );
  });

export const getPublicActivities = createServerFn({
  method: "GET",
})
  .middleware([optionalAuthMiddleware])
  .validator((d: { userId: string; page?: number; limit?: number }) => d)
  .handler(async ({ context, data }) => {
    const viewerUserId = context?.userId ?? null;
    const userId = (data?.userId || "").trim();
    if (!userId) {
      throw new Error("Usuário não informado.");
    }

    const sql = await getSql();
    const privacy = await evaluateUserPrivacy(sql, userId, viewerUserId);
    if (!privacy.canViewHistory) {
      throw new Error("A atividade deste perfil é privada.");
    }

    return executeGetUserActivities(
      sql,
      userId,
      {
        isOwner: privacy.isOwner,
        canViewLists: privacy.canViewLists,
        canViewFavorites: privacy.canViewFavorites,
      },
      data?.page ?? 1,
      data?.limit ?? 15,
    );
  });

/* ============================================================ */
/* SEGUIDORES E SEGUINDO PÚBLICOS COM CONTROLE DE PRIVACIDADE    */
/* ============================================================ */

export async function executeGetPublicProfileFollowers(
  sql: Sql,
  targetUserId: string,
  viewerUserId: string | null,
) {
  const privacy = await evaluateUserPrivacy(sql, targetUserId, viewerUserId);
  if (!privacy.canViewFollowers) {
    throw new Error("A lista de seguidores deste perfil é privada.");
  }

  const rows = await sql<{
    userId: string;
    nick: string | null;
    name: string | null;
    image: string | null;
    isFollowing: boolean;
    isVerified: boolean;
    followsViewer: boolean;
  }>`
    select
      u."id" as "userId",
      coalesce(p."nick", u."id") as "nick",
      coalesce(p."displayName", u."name", 'Usuário') as "name",
      coalesce(p."avatarUrl", u."image") as "image",
      coalesce(p."isVerified", false) as "isVerified",
      exists (
        select 1
        from "user_follow" f
        where f."followerId" = ${viewerUserId}
          and f."followingId" = u."id"
      ) as "isFollowing",
      exists (
        select 1
        from "user_follow" f
        where f."followerId" = u."id"
          and f."followingId" = ${viewerUserId}
      ) as "followsViewer"
    from "user_follow" uf
    inner join "user" u on u."id" = uf."followerId"
    left join "profile" p on p."userId" = u."id"
    where uf."followingId" = ${targetUserId}
    order by uf."createdAt" desc
  `;

  return rows.map((r) => ({
    userId: r.userId,
    nick: r.nick || r.userId,
    name: r.name ?? "Usuário",
    image: r.image,
    isFollowing: Boolean(r.isFollowing),
    isVerified: Boolean(r.isVerified),
    followsOpenProfile: true,
    followsViewer: Boolean(r.followsViewer),
  }));
}

export const getPublicProfileFollowers =
  createServerFn({
    method: "GET",
  })
    .middleware([optionalAuthMiddleware])
    .validator((d: { userId: string }) => d)
    .handler(async ({ context, data }) => {
      const viewerUserId = context?.userId ?? null;
      const targetUserId = (data?.userId || "").trim();
      if (!targetUserId) throw new Error("Usuário não informado.");

      const sql = await getSql();
      return executeGetPublicProfileFollowers(sql, targetUserId, viewerUserId);
    });

export async function executeGetPublicProfileFollowing(
  sql: Sql,
  targetUserId: string,
  viewerUserId: string | null,
) {
  const privacy = await evaluateUserPrivacy(sql, targetUserId, viewerUserId);
  if (!privacy.canViewFollowers) {
    throw new Error("A lista de seguidos deste perfil é privada.");
  }

  const rows = await sql<{
    userId: string;
    nick: string | null;
    name: string | null;
    image: string | null;
    isFollowing: boolean;
    isVerified: boolean;
    followsOpenProfile: boolean;
    followsViewer: boolean;
  }>`
    select
      u."id" as "userId",
      coalesce(p."nick", u."id") as "nick",
      coalesce(p."displayName", u."name", 'Usuário') as "name",
      coalesce(p."avatarUrl", u."image") as "image",
      coalesce(p."isVerified", false) as "isVerified",
      exists (
        select 1
        from "user_follow" f
        where f."followerId" = ${viewerUserId}
          and f."followingId" = u."id"
      ) as "isFollowing",
      exists (
        select 1
        from "user_follow" f
        where f."followerId" = u."id"
          and f."followingId" = ${targetUserId}
      ) as "followsOpenProfile",
      exists (
        select 1
        from "user_follow" f
        where f."followerId" = u."id"
          and f."followingId" = ${viewerUserId}
      ) as "followsViewer"
    from "user_follow" uf
    inner join "user" u on u."id" = uf."followingId"
    left join "profile" p on p."userId" = u."id"
    where uf."followerId" = ${targetUserId}
    order by uf."createdAt" desc
  `;

  return rows.map((r) => ({
    userId: r.userId,
    nick: r.nick || r.userId,
    name: r.name ?? "Usuário",
    image: r.image,
    isFollowing: Boolean(r.isFollowing),
    isVerified: Boolean(r.isVerified),
    followsOpenProfile: Boolean(r.followsOpenProfile),
    followsViewer: Boolean(r.followsViewer),
  }));
}

export const getPublicProfileFollowing =
  createServerFn({
    method: "GET",
  })
    .middleware([optionalAuthMiddleware])
    .validator((d: { userId: string }) => d)
    .handler(async ({ context, data }) => {
      const viewerUserId = context?.userId ?? null;
      const targetUserId = (data?.userId || "").trim();
      if (!targetUserId) throw new Error("Usuário não informado.");

      const sql = await getSql();
      return executeGetPublicProfileFollowing(sql, targetUserId, viewerUserId);
    });

/* ============================================================ */
/* ATUALIZAR PERFIL                                                */
/* ============================================================ */

export const updateProfileInputSchema = z.object({
  name: z
    .string()
    .trim()
    .max(50, "O Nome de exibição pode ter no máximo 50 caracteres.")
    .optional(),
  nick: z.string().trim().optional(),
  bio: z
    .string()
    .max(500, "A Biografia pode ter no máximo 500 caracteres.")
    .optional(),
  image: z.string().nullable().optional(),
  bannerUrl: z.string().nullable().optional(),
  favorites: z.array(z.string().trim()).max(20).optional(),
  accountType: z.enum(["public", "private"]).optional(),
  allowFollowers: z.boolean().optional(),
  privacyLists: z.enum(["public", "followers", "private"]).optional(),
  privacyFavorites: z.enum(["public", "followers", "private"]).optional(),
  privacyHistory: z.enum(["public", "followers", "private"]).optional(),
  privacyComments: z.enum(["public", "followers", "private"]).optional(),
  privacyFollowers: z.enum(["public", "followers", "private"]).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

export const updateProfile =
  createServerFn({
    method: "POST",
  })
    .middleware([authMiddleware])
    .validator((d: unknown) => updateProfileInputSchema.parse(d))
    .handler(async ({ context, data }) => {
      const sql = await getSql();

      // 1. Obter perfil e usuário existentes para preservar campos não modificados
      const profileRows = await sql<{
        nick: string | null;
        bio: string | null;
        favorites: string | null;
        displayName: string | null;
        avatarUrl: string | null;
        bannerUrl: string | null;
        accountType: string | null;
        allowFollowers: boolean | null;
        privacyLists: string | null;
        privacyFavorites: string | null;
        privacyHistory: string | null;
        privacyComments: string | null;
        privacyFollowers: string | null;
      }>`
        select
          "nick",
          "bio",
          "favorites",
          "displayName",
          "avatarUrl",
          "bannerUrl",
          "accountType",
          "allowFollowers",
          "privacyLists",
          "privacyFavorites",
          "privacyHistory",
          "privacyComments",
          "privacyFollowers"
        from "profile"
        where "userId" = ${context.userId}
        limit 1
      `;

      const userRows = await sql<{
        name: string | null;
        email: string | null;
        image: string | null;
      }>`
        select "name", "email", "image"
        from "user"
        where "id" = ${context.userId}
        limit 1
      `;

      const existingProfile = profileRows[0];
      const existingUser = userRows[0];

      // 2. Resolver Name (Nome de exibição):
      // Preserva se não informado ou se for string vazia; atualiza se válido
      let finalName = existingProfile?.displayName || existingUser?.name || "";
      if (typeof data.name === "string") {
        const trimmed = data.name.trim();
        if (trimmed.length > 0) {
          finalName = trimmed.slice(0, 50);
        }
      }

      // 3. Resolver Nick / Username:
      let finalNick = existingProfile?.nick || "";
      if (typeof data.nick === "string") {
        const normalized = normalizeNick(data.nick);
        if (normalized.length > 0) {
          if (!isValidNick(normalized)) {
            throw new Error(
              "O Username deve ter entre 3 e 30 caracteres e usar apenas letras, números ou _.",
            );
          }

          // Verificar se outro usuário já utiliza esse nick
          const conflict = await sql<{ userId: string }>`
            select "userId"
            from "profile"
            where lower("nick") = lower(${normalized})
              and "userId" <> ${context.userId}
            limit 1
          `;

          if (conflict.length > 0) {
            throw new Error(
              "Esse Username (@handle) já está em uso por outro usuário.",
            );
          }

          finalNick = normalized;
        }
      }

      if (!finalNick) {
        throw new Error("O Username é obrigatório.");
      }

      // 4. Resolver Bio:
      let finalBio = existingProfile?.bio || "";
      if (data.bio !== undefined) {
        finalBio =
          typeof data.bio === "string" ? data.bio.trim().slice(0, 500) : "";
      }

      // 5. Resolver Favorites / Tags:
      let finalFavorites = parseFavorites(existingProfile?.favorites);
      if (data.favorites !== undefined && Array.isArray(data.favorites)) {
        finalFavorites = data.favorites
          .map((item) => String(item).trim().slice(0, 100))
          .filter(Boolean)
          .slice(0, 20);
      }

      // 6. Resolver Avatar (image):
      let finalAvatar: string | null =
        existingProfile?.avatarUrl ?? existingUser?.image ?? null;
      if (data.image !== undefined) {
        if (
          data.image === null ||
          (typeof data.image === "string" && data.image.trim() === "")
        ) {
          finalAvatar = null;
        } else if (typeof data.image === "string") {
          finalAvatar = data.image.trim();
        }
      }

      // 7. Resolver Banner (bannerUrl):
      let finalBanner: string | null = existingProfile?.bannerUrl ?? null;
      if (data.bannerUrl !== undefined) {
        if (
          data.bannerUrl === null ||
          (typeof data.bannerUrl === "string" && data.bannerUrl.trim() === "")
        ) {
          finalBanner = null;
        } else if (typeof data.bannerUrl === "string") {
          finalBanner = data.bannerUrl.trim();
        }
      }

      // 8. Resolver Configurações de Privacidade da Migration 0020
      let finalAccountType: AccountType =
        existingProfile?.accountType === "private" ? "private" : "public";
      if (data.accountType !== undefined) {
        finalAccountType = data.accountType;
      }

      let finalAllowFollowers: boolean = existingProfile?.allowFollowers ?? true;
      if (data.allowFollowers !== undefined) {
        finalAllowFollowers = Boolean(data.allowFollowers);
      }

      let finalPrivacyLists: SectionPrivacyLevel =
        (existingProfile?.privacyLists as SectionPrivacyLevel) || "public";
      if (data.privacyLists !== undefined) {
        finalPrivacyLists = data.privacyLists;
      }

      let finalPrivacyFavorites: SectionPrivacyLevel =
        (existingProfile?.privacyFavorites as SectionPrivacyLevel) || "public";
      if (data.privacyFavorites !== undefined) {
        finalPrivacyFavorites = data.privacyFavorites;
      }

      let finalPrivacyHistory: SectionPrivacyLevel =
        (existingProfile?.privacyHistory as SectionPrivacyLevel) || "public";
      if (data.privacyHistory !== undefined) {
        finalPrivacyHistory = data.privacyHistory;
      }

      let finalPrivacyComments: SectionPrivacyLevel =
        (existingProfile?.privacyComments as SectionPrivacyLevel) || "public";
      if (data.privacyComments !== undefined) {
        finalPrivacyComments = data.privacyComments;
      }

      let finalPrivacyFollowers: SectionPrivacyLevel =
        (existingProfile?.privacyFollowers as SectionPrivacyLevel) || "public";
      if (data.privacyFollowers !== undefined) {
        finalPrivacyFollowers = data.privacyFollowers;
      }

      // 9. Sincronizar na tabela "user" (Better Auth) para consistência no sistema
      await sql`
        update "user"
        set
          "name" = ${finalName || "Membro"},
          "image" = ${finalAvatar},
          "updatedAt" = CURRENT_TIMESTAMP
        where "id" = ${context.userId}
      `;

      // 10. Salvar na tabela "profile" com upsert no userId autenticado
      await sql`
        insert into "profile" (
          "userId",
          "nick",
          "bio",
          "favorites",
          "displayName",
          "avatarUrl",
          "bannerUrl",
          "accountType",
          "allowFollowers",
          "privacyLists",
          "privacyFavorites",
          "privacyHistory",
          "privacyComments",
          "privacyFollowers"
        )
        values (
          ${context.userId},
          ${finalNick},
          ${finalBio},
          ${JSON.stringify(finalFavorites)},
          ${finalName},
          ${finalAvatar},
          ${finalBanner},
          ${finalAccountType},
          ${finalAllowFollowers},
          ${finalPrivacyLists},
          ${finalPrivacyFavorites},
          ${finalPrivacyHistory},
          ${finalPrivacyComments},
          ${finalPrivacyFollowers}
        )
        on conflict ("userId")
        do update set
          "nick" = excluded."nick",
          "bio" = excluded."bio",
          "favorites" = excluded."favorites",
          "displayName" = excluded."displayName",
          "avatarUrl" = excluded."avatarUrl",
          "bannerUrl" = excluded."bannerUrl",
          "accountType" = excluded."accountType",
          "allowFollowers" = excluded."allowFollowers",
          "privacyLists" = excluded."privacyLists",
          "privacyFavorites" = excluded."privacyFavorites",
          "privacyHistory" = excluded."privacyHistory",
          "privacyComments" = excluded."privacyComments",
          "privacyFollowers" = excluded."privacyFollowers",
          "updatedAt" = CURRENT_TIMESTAMP
      `;

      const commentRows = await sql<{
        count: string;
      }>`
        select count(*)::text as count
        from "comment"
        where "userId" =
          ${context.userId}
      `;

      const followerRows = await sql<{
        count: string;
      }>`
        select count(*)::text as count
        from "user_follow"
        where "followingId" =
          ${context.userId}
      `;

      const followingRows = await sql<{
        count: string;
      }>`
        select count(*)::text as count
        from "user_follow"
        where "followerId" =
          ${context.userId}
      `;

      return {
        userId: context.userId,
        name: finalName,
        email: existingUser?.email ?? "",
        image: finalAvatar,
        bannerUrl: finalBanner,
        nick: finalNick,
        bio: finalBio,
        favorites: finalFavorites,
        commentCount: Number(
          commentRows[0]?.count ?? "0",
        ),
        followersCount: Number(
          followerRows[0]?.count ?? "0",
        ),
        followingCount: Number(
          followingRows[0]?.count ?? "0",
        ),
        accountType: finalAccountType,
        allowFollowers: finalAllowFollowers,
        privacyLists: finalPrivacyLists,
        privacyFavorites: finalPrivacyFavorites,
        privacyHistory: finalPrivacyHistory,
        privacyComments: finalPrivacyComments,
        privacyFollowers: finalPrivacyFollowers,
      } satisfies UserProfile;
    });

/* ============================================================ */
/* ETAPA 8 — SISTEMA DE SEGUIDORES E SOLICITAÇÕES              */
/* ============================================================ */

export const followTargetSchema = z.object({
  targetUserId: z.string().trim().min(1, "ID do usuário alvo é obrigatório"),
});

export const followRequestActionSchema = z.object({
  requesterId: z.string().trim().min(1, "ID do solicitante é obrigatório"),
});

/**
 * Lógica pura de seguir/solicitar (reutilizável em testes e em Server Functions).
 */
export async function executeFollowUser(sql: Sql, viewerId: string, targetId: string) {
  if (viewerId === targetId) {
    throw new Error("Você não pode seguir a si próprio.");
  }

  // 1. Verificar se o alvo existe e obter preferências de privacidade
  const targetRows = await sql<{
    id: string;
    name: string | null;
    image: string | null;
    accountType: string | null;
    allowFollowers: boolean | null;
  }>`
    select
      u."id",
      u."name",
      u."image",
      p."accountType",
      p."allowFollowers"
    from "user" u
    left join "profile" p on p."userId" = u."id"
    where u."id" = ${targetId}
    limit 1
  `;

  const targetUser = targetRows[0];
  if (!targetUser) {
    throw new Error("Usuário alvo não encontrado.");
  }

  // Garantir que tanto o alvo quanto o seguidor tenham perfil provisionado
  await Promise.all([
    ensureUserProfile(sql, { id: targetId, name: targetUser.name, image: targetUser.image }),
    ensureUserProfile(sql, { id: viewerId }),
  ]);

  // 2. Verificar bloqueio mútuo
  const blockRows = await sql<{ count: string }>`
    select count(*)::text as count
    from "user_block"
    where ("blockerId" = ${viewerId} and "blockedId" = ${targetId})
       or ("blockerId" = ${targetId} and "blockedId" = ${viewerId})
    limit 1
  `;
  if (Number(blockRows[0]?.count ?? "0") > 0) {
    throw new Error("Não é possível interagir com este perfil devido a um bloqueio.");
  }

  // 3. Verificar allowFollowers
  const allowFollowers = targetUser.allowFollowers ?? true;
  if (!allowFollowers) {
    throw new Error("Este usuário não está aceitando novos seguidores.");
  }

  // 4. Verificar se já segue
  const alreadyFollowingRows = await sql<{ count: string }>`
    select count(*)::text as count
    from "user_follow"
    where "followerId" = ${viewerId}
      and "followingId" = ${targetId}
    limit 1
  `;
  const isAlreadyFollowing = Number(alreadyFollowingRows[0]?.count ?? "0") > 0;
  if (isAlreadyFollowing) {
    return {
      status: "following" as const,
      message: "Você já está seguindo este usuário.",
    };
  }

  const isPrivate = targetUser.accountType === "private";

  if (isPrivate) {
    // Perfil privado: criar ou reabrir solicitação pendente
    await sql`
      insert into "user_follow_request" ("requesterId", "targetId", "status", "createdAt", "updatedAt")
      values (${viewerId}, ${targetId}, 'pending', current_timestamp, current_timestamp)
      on conflict ("requesterId", "targetId")
      do update set
        "status" = 'pending',
        "updatedAt" = current_timestamp
    `;

    try {
      const actorRow = await sql<{ name: string | null }>`
        select coalesce(p."displayName", p."nick", u."name", 'Usuário') as name
        from "user" u
        left join "profile" p on p."userId" = u."id"
        where u."id" = ${viewerId} limit 1
      `;
      const actorName = actorRow[0]?.name || "Usuário";
      await executeCreateNotification(sql, {
        userId: targetId,
        actorId: viewerId,
        type: "follow_request",
        message: `${actorName} solicitou para seguir você.`,
      });
    } catch {
      // Falha não impeditiva no disparo da notificação
    }

    return {
      status: "requested" as const,
      message: "Solicitação para seguir enviada com sucesso.",
    };
  } else {
    // Perfil público: criar vínculo imediato
    await sql`
      insert into "user_follow" ("followerId", "followingId", "createdAt")
      values (${viewerId}, ${targetId}, current_timestamp)
      on conflict ("followerId", "followingId") do nothing
    `;

    // Limpar qualquer solicitação antiga residual
    await sql`
      delete from "user_follow_request"
      where "requesterId" = ${viewerId}
        and "targetId" = ${targetId}
    `;

    try {
      const actorRow = await sql<{ name: string | null }>`
        select coalesce(p."displayName", p."nick", u."name", 'Usuário') as name
        from "user" u
        left join "profile" p on p."userId" = u."id"
        where u."id" = ${viewerId} limit 1
      `;
      const actorName = actorRow[0]?.name || "Usuário";
      await executeCreateNotification(sql, {
        userId: targetId,
        actorId: viewerId,
        type: "new_follower",
        message: `${actorName} começou a seguir você.`,
      });
    } catch {
      // Falha não impeditiva no disparo da notificação
    }

    return {
      status: "following" as const,
      message: "Agora você está seguindo este usuário.",
    };
  }
}

export async function executeUnfollowUser(sql: Sql, viewerId: string, targetId: string) {
  if (viewerId === targetId) {
    throw new Error("Operação inválida.");
  }

  await sql`
    delete from "user_follow"
    where "followerId" = ${viewerId}
      and "followingId" = ${targetId}
  `;

  await sql`
    delete from "user_follow_request"
    where "requesterId" = ${viewerId}
      and "targetId" = ${targetId}
  `;

  await sql`
    delete from "notification"
    where "userId" = ${targetId}
      and "actorId" = ${viewerId}
      and "type" = 'new_follower'
  `;

  return {
    status: "none" as const,
    message: "Você deixou de seguir este usuário.",
  };
}

export async function executeCancelFollowRequest(sql: Sql, viewerId: string, targetId: string) {
  const deleteResult = await sql<{ requesterId: string }>`
    delete from "user_follow_request"
    where "requesterId" = ${viewerId}
      and "targetId" = ${targetId}
      and "status" = 'pending'
    returning "requesterId"
  `;

  if (deleteResult.length === 0) {
    throw new Error("Nenhuma solicitação pendente encontrada para cancelar.");
  }

  // Limpar notificação pendente enviada
  await sql`
    delete from "notification"
    where "userId" = ${targetId}
      and "actorId" = ${viewerId}
      and "type" = 'follow_request'
  `;

  return {
    status: "none" as const,
    message: "Solicitação cancelada com sucesso.",
  };
}

export async function executeAcceptFollowRequest(sql: Sql, ownerId: string, requesterId: string) {
  if (ownerId === requesterId) {
    throw new Error("Operação inválida.");
  }

  // 1. Verificar bloqueio
  const blockRows = await sql<{ count: string }>`
    select count(*)::text as count
    from "user_block"
    where ("blockerId" = ${ownerId} and "blockedId" = ${requesterId})
       or ("blockerId" = ${requesterId} and "blockedId" = ${ownerId})
    limit 1
  `;
  if (Number(blockRows[0]?.count ?? "0") > 0) {
    throw new Error("Não é possível aceitar solicitação de um usuário bloqueado.");
  }

  // 2. Verificar solicitação pendente
  const reqRows = await sql<{ requesterId: string }>`
    select "requesterId"
    from "user_follow_request"
    where "requesterId" = ${requesterId}
      and "targetId" = ${ownerId}
      and "status" = 'pending'
    limit 1
  `;

  if (reqRows.length === 0) {
    throw new Error("Solicitação pendente não encontrada.");
  }

  // 3. Efetivar vínculo de seguidor
  await sql`
    insert into "user_follow" ("followerId", "followingId", "createdAt")
    values (${requesterId}, ${ownerId}, current_timestamp)
    on conflict ("followerId", "followingId") do nothing
  `;

  // 4. Remover solicitação concluída e notificação pendente
  await sql`
    delete from "user_follow_request"
    where "requesterId" = ${requesterId}
      and "targetId" = ${ownerId}
  `;

  await sql`
    delete from "notification"
    where "userId" = ${ownerId}
      and "actorId" = ${requesterId}
      and "type" = 'follow_request'
  `;

  // 5. Disparar notificação de solicitação aceita para o solicitante
  try {
    const ownerRow = await sql<{ name: string | null }>`
      select coalesce(p."displayName", p."nick", u."name", 'Usuário') as name
      from "user" u
      left join "profile" p on p."userId" = u."id"
      where u."id" = ${ownerId} limit 1
    `;
    const ownerName = ownerRow[0]?.name || "Usuário";
    await executeCreateNotification(sql, {
      userId: requesterId,
      actorId: ownerId,
      type: "follow_accept",
      message: `${ownerName} aceitou sua solicitação para seguir.`,
    });
  } catch {
    // Falha não impeditiva no disparo da notificação
  }

  return {
    success: true,
    message: "Solicitação aceita com sucesso.",
  };
}

export async function executeRejectFollowRequest(sql: Sql, ownerId: string, requesterId: string) {
  const reqRows = await sql<{ requesterId: string }>`
    select "requesterId"
    from "user_follow_request"
    where "requesterId" = ${requesterId}
      and "targetId" = ${ownerId}
      and "status" = 'pending'
    limit 1
  `;

  if (reqRows.length === 0) {
    throw new Error("Solicitação pendente não encontrada.");
  }

  await sql`
    delete from "user_follow_request"
    where "requesterId" = ${requesterId}
      and "targetId" = ${ownerId}
  `;

  // Limpar notificação pendente recebida
  await sql`
    delete from "notification"
    where "userId" = ${ownerId}
      and "actorId" = ${requesterId}
      and "type" = 'follow_request'
  `;

  return {
    success: true,
    message: "Solicitação recusada.",
  };
}

export async function executeGetUserRelationship(
  sql: Sql,
  viewerId: string | null,
  targetId: string,
): Promise<UserRelationship> {
  const isSelf = Boolean(viewerId && viewerId === targetId);

  const targetRows = await sql<{
    id: string;
    accountType: string | null;
    allowFollowers: boolean | null;
  }>`
    select
      u."id",
      p."accountType",
      p."allowFollowers"
    from "user" u
    left join "profile" p on p."userId" = u."id"
    where u."id" = ${targetId}
    limit 1
  `;

  const targetUser = targetRows[0];
  if (!targetUser) {
    throw new Error("Usuário alvo não encontrado.");
  }

  const targetAccountType: AccountType =
    targetUser.accountType === "private" ? "private" : "public";
  const targetAllowFollowers = targetUser.allowFollowers ?? true;

  if (isSelf || !viewerId) {
    return {
      targetUserId: targetId,
      isSelf,
      isFollowing: false,
      isFollowedBy: false,
      hasPendingRequestFromViewer: false,
      hasPendingRequestToViewer: false,
      isBlocked: false,
      isBlockedByMe: false,
      isBlockedByTarget: false,
      targetAccountType,
      targetAllowFollowers,
      relationStatus: isSelf ? "self" : "none",
    };
  }

  // Bloqueio mútuo e direcional
  const blockRows = await sql<{
    isBlockedByMe: boolean;
    isBlockedByTarget: boolean;
  }>`
    select
      exists (
        select 1 from "user_block"
        where "blockerId" = ${viewerId} and "blockedId" = ${targetId}
      ) as "isBlockedByMe",
      exists (
        select 1 from "user_block"
        where "blockerId" = ${targetId} and "blockedId" = ${viewerId}
      ) as "isBlockedByTarget"
  `;
  const isBlockedByMe = Boolean(blockRows[0]?.isBlockedByMe);
  const isBlockedByTarget = Boolean(blockRows[0]?.isBlockedByTarget);
  const isBlocked = isBlockedByMe || isBlockedByTarget;

  // Se houver bloqueio mútuo, nenhum vínculo ou solicitação pode estar ativo
  if (isBlocked) {
    return {
      targetUserId: targetId,
      isSelf: false,
      isFollowing: false,
      isFollowedBy: false,
      hasPendingRequestFromViewer: false,
      hasPendingRequestToViewer: false,
      isBlocked,
      isBlockedByMe,
      isBlockedByTarget,
      targetAccountType,
      targetAllowFollowers,
      relationStatus: "none",
    };
  }

  // isFollowing
  const followingRows = await sql<{ count: string }>`
    select count(*)::text as count
    from "user_follow"
    where "followerId" = ${viewerId}
      and "followingId" = ${targetId}
    limit 1
  `;
  const isFollowing = Number(followingRows[0]?.count ?? "0") > 0;

  // isFollowedBy
  const followedByRows = await sql<{ count: string }>`
    select count(*)::text as count
    from "user_follow"
    where "followerId" = ${targetId}
      and "followingId" = ${viewerId}
    limit 1
  `;
  const isFollowedBy = Number(followedByRows[0]?.count ?? "0") > 0;

  // Solicitação enviada pelo visitante
  const sentReqRows = await sql<{ count: string }>`
    select count(*)::text as count
    from "user_follow_request"
    where "requesterId" = ${viewerId}
      and "targetId" = ${targetId}
      and "status" = 'pending'
    limit 1
  `;
  const hasPendingRequestFromViewer = Number(sentReqRows[0]?.count ?? "0") > 0;

  // Solicitação recebida pelo visitante
  const recvReqRows = await sql<{ count: string }>`
    select count(*)::text as count
    from "user_follow_request"
    where "requesterId" = ${targetId}
      and "targetId" = ${viewerId}
      and "status" = 'pending'
    limit 1
  `;
  const hasPendingRequestToViewer = Number(recvReqRows[0]?.count ?? "0") > 0;

  let relationStatus: FollowRelationshipStatus = "none";
  if (isFollowing) {
    relationStatus = "following";
  } else if (hasPendingRequestFromViewer) {
    relationStatus = "requested";
  }

  return {
    targetUserId: targetId,
    isSelf: false,
    isFollowing,
    isFollowedBy,
    hasPendingRequestFromViewer,
    hasPendingRequestToViewer,
    isBlocked: false,
    isBlockedByMe: false,
    isBlockedByTarget: false,
    targetAccountType,
    targetAllowFollowers,
    relationStatus,
  };
}

/**
 * Seguir um usuário ou solicitar acompanhamento caso o perfil seja privado.
 * Executado com authMiddleware (identidade do context.userId).
 */
export const followUser = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator((d: { targetUserId: string }) => followTargetSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return executeFollowUser(sql, context.userId, data.targetUserId);
  });

/**
 * Deixar de seguir um usuário.
 */
export const unfollowUser = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator((d: { targetUserId: string }) => followTargetSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return executeUnfollowUser(sql, context.userId, data.targetUserId);
  });

/**
 * Cancelar solicitação de acompanhamento enviada para um perfil privado.
 */
export const cancelFollowRequest = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator((d: { targetUserId: string }) => followTargetSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return executeCancelFollowRequest(sql, context.userId, data.targetUserId);
  });

/**
 * Aceitar solicitação de acompanhamento recebida.
 * Apenas o proprietário (targetId = context.userId) pode aceitar.
 */
export const acceptFollowRequest = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator((d: { requesterId: string }) => followRequestActionSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return executeAcceptFollowRequest(sql, context.userId, data.requesterId);
  });

/**
 * Recusar solicitação de acompanhamento recebida.
 * Apenas o proprietário (targetId = context.userId) pode recusar.
 */
export const rejectFollowRequest = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator((d: { requesterId: string }) => followRequestActionSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return executeRejectFollowRequest(sql, context.userId, data.requesterId);
  });

/**
 * Listar solicitações de acompanhamento recebidas pelo usuário logado.
 */
export const getReceivedFollowRequests = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ownerId = context.userId;
    const sql = await getSql();

    const rows = await sql<{
      requesterId: string;
      targetId: string;
      status: "pending" | "rejected";
      createdAt: string;
      updatedAt: string;
      nick: string | null;
      name: string | null;
      image: string | null;
    }>`
      select
        r."requesterId",
        r."targetId",
        r."status",
        r."createdAt",
        r."updatedAt",
        coalesce(p."nick", u."name", 'usuario') as "nick",
        coalesce(p."displayName", u."name", 'Usuário') as "name",
        coalesce(p."avatarUrl", u."image") as "image"
      from "user_follow_request" r
      inner join "user" u on u."id" = r."requesterId"
      left join "profile" p on p."userId" = u."id"
      where r."targetId" = ${ownerId}
        and r."status" = 'pending'
      order by r."createdAt" desc
    `;

    const result: FollowRequestItem[] = rows.map((r) => ({
      requesterId: r.requesterId,
      targetId: r.targetId,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      nick: r.nick ?? "usuario",
      name: r.name ?? "Usuário",
      image: r.image,
    }));

    return result;
  });

/**
 * Listar solicitações de acompanhamento enviadas pelo usuário logado.
 */
export const getSentFollowRequests = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const viewerId = context.userId;
    const sql = await getSql();

    const rows = await sql<{
      requesterId: string;
      targetId: string;
      status: "pending" | "rejected";
      createdAt: string;
      updatedAt: string;
      nick: string | null;
      name: string | null;
      image: string | null;
    }>`
      select
        r."requesterId",
        r."targetId",
        r."status",
        r."createdAt",
        r."updatedAt",
        coalesce(p."nick", u."name", 'usuario') as "nick",
        coalesce(p."displayName", u."name", 'Usuário') as "name",
        coalesce(p."avatarUrl", u."image") as "image"
      from "user_follow_request" r
      inner join "user" u on u."id" = r."targetId"
      left join "profile" p on p."userId" = u."id"
      where r."requesterId" = ${viewerId}
        and r."status" = 'pending'
      order by r."createdAt" desc
    `;

    const result: FollowRequestItem[] = rows.map((r) => ({
      requesterId: r.requesterId,
      targetId: r.targetId,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      nick: r.nick ?? "usuario",
      name: r.name ?? "Usuário",
      image: r.image,
    }));

    return result;
  });

/**
 * Consultar relação detalhada entre o visitante e um perfil alvo.
 */
export const getUserRelationship = createServerFn({
  method: "GET",
})
  .middleware([optionalAuthMiddleware])
  .validator((d: { targetUserId: string }) => followTargetSchema.parse(d))
  .handler(async ({ context, data }): Promise<UserRelationship> => {
    const viewerId = context?.userId ?? null;
    const sql = await getSql();
    return executeGetUserRelationship(sql, viewerId, data.targetUserId);
  });

/* ============================================================ */
/* ETAPA 9 — BLOQUEIO E GERENCIAMENTO DE USUÁRIOS              */
/* ============================================================ */

export const blockTargetSchema = z.object({
  targetUserId: z.string().trim().min(1, "ID do usuário alvo é obrigatório"),
});

export async function executeBlockUser(sql: Sql, blockerId: string, targetId: string) {
  if (blockerId === targetId) {
    throw new Error("Você não pode bloquear a si próprio.");
  }

  // 1. Validar a existência do usuário de destino
  const userCheck = await sql<{ id: string }>`
    select "id" from "user" where "id" = ${targetId} limit 1
  `;
  if (!userCheck[0]) {
    throw new Error("Usuário alvo não encontrado.");
  }

  // 2. Inserir bloqueio de forma atômica
  await sql`
    insert into "user_block" ("blockerId", "blockedId", "createdAt")
    values (${blockerId}, ${targetId}, current_timestamp)
    on conflict ("blockerId", "blockedId") do nothing
  `;

  // 3. Remover os vínculos existentes em "user_follow" nas duas direções
  await sql`
    delete from "user_follow"
    where ("followerId" = ${blockerId} and "followingId" = ${targetId})
       or ("followerId" = ${targetId} and "followingId" = ${blockerId})
  `;

  // 4. Remover solicitações pendentes nas duas direções
  await sql`
    delete from "user_follow_request"
    where ("requesterId" = ${blockerId} and "targetId" = ${targetId})
       or ("requesterId" = ${targetId} and "targetId" = ${blockerId})
  `;

  // 5. Remover notificações mútuas para evitar resíduos visuais
  await sql`
    delete from "notification"
    where ("userId" = ${blockerId} and "actorId" = ${targetId})
       or ("userId" = ${targetId} and "actorId" = ${blockerId})
  `;

  return {
    success: true,
    message: "Usuário bloqueado com sucesso.",
  };
}

export async function executeUnblockUser(sql: Sql, blockerId: string, targetId: string) {
  if (blockerId === targetId) {
    throw new Error("Operação inválida.");
  }

  // Somente o proprietário do bloqueio (blockerId) pode removê-lo
  await sql`
    delete from "user_block"
    where "blockerId" = ${blockerId}
      and "blockedId" = ${targetId}
  `;

  return {
    success: true,
    message: "Usuário desbloqueado com sucesso.",
  };
}

export interface BlockedUserRow {
  userId: string;
  nick: string | null;
  name: string | null;
  image: string | null;
  blockedAt: string;
}

export async function executeGetMyBlockedUsers(
  sql: Sql,
  userId: string,
): Promise<BlockedUserItem[]> {
  const rows = await sql<BlockedUserRow>`
    select
      b."blockedId" as "userId",
      coalesce(p."nick", u."name", 'usuario') as "nick",
      coalesce(p."displayName", u."name", 'Usuário') as "name",
      coalesce(p."avatarUrl", u."image") as "image",
      to_char(b."createdAt" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "blockedAt"
    from "user_block" b
    inner join "user" u on u."id" = b."blockedId"
    left join "profile" p on p."userId" = u."id"
    where b."blockerId" = ${userId}
    order by b."createdAt" desc
  `;

  return rows.map((r: BlockedUserRow) => ({
    id: r.userId,
    userId: r.userId,
    nick: r.nick ?? "usuario",
    username: r.nick ?? "usuario",
    name: r.name ?? "Usuário",
    image: r.image,
    blockedAt: r.blockedAt,
  }));
}

export async function executeGetUserBlockStatus(
  sql: Sql,
  viewerId: string,
  targetId: string,
): Promise<UserBlockStatus> {
  const rows = await sql<{
    isBlockedByMe: boolean;
    isBlockedByTarget: boolean;
  }>`
    select
      exists(
        select 1 from "user_block"
        where "blockerId" = ${viewerId} and "blockedId" = ${targetId}
      ) as "isBlockedByMe",
      exists(
        select 1 from "user_block"
        where "blockerId" = ${targetId} and "blockedId" = ${viewerId}
      ) as "isBlockedByTarget"
  `;

  const isBlockedByMe = Boolean(rows[0]?.isBlockedByMe);
  const isBlockedByTarget = Boolean(rows[0]?.isBlockedByTarget);

  return {
    targetUserId: targetId,
    isBlockedByMe,
    isBlockedByTarget,
    hasBlock: isBlockedByMe || isBlockedByTarget,
    isBlocked: isBlockedByMe || isBlockedByTarget,
  };
}

/**
 * Bloquear outro usuário.
 * Protegido por authMiddleware (identidade garantida por context.userId).
 */
export const blockUser = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator((d: { targetUserId: string }) => blockTargetSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return executeBlockUser(sql, context.userId, data.targetUserId);
  });

/**
 * Desbloquear usuário.
 * Protegido por authMiddleware (apenas o proprietário pode remover).
 */
export const unblockUser = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator((d: { targetUserId: string }) => blockTargetSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return executeUnblockUser(sql, context.userId, data.targetUserId);
  });

/**
 * Listar usuários bloqueados pelo usuário autenticado.
 * Protegido por authMiddleware.
 */
export const getMyBlockedUsers = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<BlockedUserItem[]> => {
    const sql = await getSql();
    return executeGetMyBlockedUsers(sql, context.userId);
  });

/**
 * Consultar o estado de bloqueio entre o usuário autenticado e um perfil.
 * Protegido por authMiddleware.
 */
export const getUserBlockStatus = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .validator((d: { targetUserId: string }) => blockTargetSchema.parse(d))
  .handler(async ({ context, data }): Promise<UserBlockStatus> => {
    const sql = await getSql();
    return executeGetUserBlockStatus(sql, context.userId, data.targetUserId);
  });

/* ============================================================ */
/* PESQUISA DE USUÁRIOS (ETAPA 12)                              */
/* ============================================================ */

export interface SearchUserItem {
  userId: string;
  nick: string;
  displayName: string;
  avatarUrl: string | null;
  accountType: AccountType;
  isFollowing: boolean;
  isOwner: boolean;
  isVerified?: boolean;
}

export const searchUsersSchema = z.object({
  query: z.string(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(20).optional().default(20),
});

export type SearchUsersInput = z.infer<typeof searchUsersSchema>;

export async function executeSearchUsers(
  sql: Sql,
  viewerUserId: string | null,
  params: { query: string; page?: number; limit?: number },
): Promise<SearchUserItem[]> {
  let cleanQuery = (params.query || "").trim();
  if (cleanQuery.startsWith("@")) {
    cleanQuery = cleanQuery.slice(1).trim();
  }

  // Termo mínimo de 2 caracteres após normalização
  if (cleanQuery.length < 2) {
    return [];
  }

  const limit = Math.min(Math.max(1, params.limit ?? 20), 20);
  const page = Math.max(1, params.page ?? 1);
  const offset = (page - 1) * limit;

  // Escapar %, _ e \ para pesquisa literal com ILIKE
  const escapedQuery = cleanQuery.replace(/[\\%_]/g, "\\$&");
  const searchPattern = `%${escapedQuery}%`;

  const rows = viewerUserId
    ? await sql<{
        userId: string;
        nick: string | null;
        displayName: string | null;
        avatarUrl: string | null;
        accountType: string;
        isFollowing: boolean;
        isOwner: boolean;
        isVerified: boolean;
      }>`
        select
          u."id" as "userId",
          coalesce(p."nick", u."id") as "nick",
          coalesce(p."displayName", u."name", p."nick", 'Usuário') as "displayName",
          coalesce(p."avatarUrl", u."image") as "avatarUrl",
          coalesce(p."accountType", 'public') as "accountType",
          coalesce(p."isVerified", false) as "isVerified",
          exists (
            select 1 from "user_follow" f
            where f."followerId" = ${viewerUserId}
              and f."followingId" = u."id"
          ) as "isFollowing",
          (u."id" = ${viewerUserId}) as "isOwner"
        from "user" u
        left join "profile" p on p."userId" = u."id"
        where (
            coalesce(p."nick", '') ilike ${searchPattern} escape '\\'
            or coalesce(p."displayName", '') ilike ${searchPattern} escape '\\'
            or coalesce(u."name", '') ilike ${searchPattern} escape '\\'
            or lower(u."id") = lower(${cleanQuery})
          )
          and not exists (
            select 1 from "user_block" ub
            where (ub."blockerId" = ${viewerUserId} and ub."blockedId" = u."id")
               or (ub."blockerId" = u."id" and ub."blockedId" = ${viewerUserId})
          )
        order by
          case
            when lower(trim(coalesce(p."nick", ''))) = lower(${cleanQuery}) or lower(trim(u."id")) = lower(${cleanQuery}) then 0
            else 1
          end asc,
          lower(coalesce(p."nick", u."name", u."id")) asc,
          u."id" asc
        limit ${limit}
        offset ${offset}
      `
    : await sql<{
        userId: string;
        nick: string | null;
        displayName: string | null;
        avatarUrl: string | null;
        accountType: string;
        isFollowing: boolean;
        isOwner: boolean;
        isVerified: boolean;
      }>`
        select
          u."id" as "userId",
          coalesce(p."nick", u."id") as "nick",
          coalesce(p."displayName", u."name", p."nick", 'Usuário') as "displayName",
          coalesce(p."avatarUrl", u."image") as "avatarUrl",
          coalesce(p."accountType", 'public') as "accountType",
          coalesce(p."isVerified", false) as "isVerified",
          false as "isFollowing",
          false as "isOwner"
        from "user" u
        left join "profile" p on p."userId" = u."id"
        where (
            coalesce(p."nick", '') ilike ${searchPattern} escape '\\'
            or coalesce(p."displayName", '') ilike ${searchPattern} escape '\\'
            or coalesce(u."name", '') ilike ${searchPattern} escape '\\'
            or lower(u."id") = lower(${cleanQuery})
          )
        order by
          case
            when lower(trim(coalesce(p."nick", ''))) = lower(${cleanQuery}) or lower(trim(u."id")) = lower(${cleanQuery}) then 0
            else 1
          end asc,
          lower(coalesce(p."nick", u."name", u."id")) asc,
          u."id" asc
        limit ${limit}
        offset ${offset}
      `;

  return rows.map((r) => ({
    userId: r.userId,
    nick: r.nick || r.userId,
    displayName: r.displayName || r.nick || "Usuário",
    avatarUrl: r.avatarUrl,
    accountType: (r.accountType === "private" ? "private" : "public") as AccountType,
    isFollowing: Boolean(r.isFollowing),
    isOwner: Boolean(r.isOwner),
    isVerified: Boolean(r.isVerified),
  }));
}

/**
 * Pesquisar usuários da comunidade Hikari por nick, displayName ou nome da conta.
 * Suporta paginação, bloqueio bilateral para visitantes autenticados e ordenação estável.
 */
export const searchUsers = createServerFn({
  method: "GET",
})
  .middleware([optionalAuthMiddleware])
  .validator((d: { query: string; page?: number; limit?: number }) =>
    searchUsersSchema.parse(d),
  )
  .handler(async ({ context, data }): Promise<SearchUserItem[]> => {
    const sql = await getSql();
    const viewerUserId = context?.userId ?? null;
    return executeSearchUsers(sql, viewerUserId, data);
  });

/* ============================================================ */
/* GESTÃO DE SELO DE VERIFICAÇÃO (EXCLUSIVO @pererinha)         */
/* ============================================================ */

export const setUserVerification = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator((d: { targetUserId: string; isVerified: boolean }) =>
    z
      .object({
        targetUserId: z.string().trim().min(1, "ID do usuário é obrigatório"),
        isVerified: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const viewerUserId = context.userId;
    const sql = await getSql();

    // 1. Autorização estrita no servidor: apenas @pererinha pode conceder/remover o selo
    const viewerRows = await sql<{ nick: string | null }>`
      select p."nick"
      from "profile" p
      where p."userId" = ${viewerUserId}
      limit 1
    `;
    const viewerNick = (viewerRows[0]?.nick || "").trim().toLowerCase();
    if (viewerNick !== "pererinha") {
      throw new Error(
        "Apenas o usuário @pererinha tem permissão para alterar selos de verificação.",
      );
    }

    const { targetUserId, isVerified } = data;

    // 2. Atualizar selo no perfil do usuário alvo
    await sql`
      update "profile"
      set
        "isVerified" = ${isVerified},
        "updatedAt" = current_timestamp
      where "userId" = ${targetUserId}
    `;

    return {
      success: true,
      targetUserId,
      isVerified,
    };
  });



