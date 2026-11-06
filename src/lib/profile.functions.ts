import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

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
};

export type ProfileUser = {
  userId: string;
  nick: string;
  name: string;
  image: string | null;
  isFollowing: boolean;
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
};

export type PublicProfileComment =
  MyProfileComment;

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
    .slice(0, 30);
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
  sql: any,
  ownerUserId: string,
  viewerUserId: string | null,
): Promise<EvaluatedPrivacy> {
  const isOwner = Boolean(viewerUserId && viewerUserId === ownerUserId);

  if (isOwner) {
    return {
      isOwner: true,
      isFollower: false,
      accountType: "public",
      allowFollowers: true,
      privacyLists: "public",
      privacyFavorites: "public",
      privacyHistory: "public",
      privacyComments: "public",
      privacyFollowers: "public",
      canViewAccount: true,
      canViewLists: true,
      canViewFavorites: true,
      canViewHistory: true,
      canViewComments: true,
      canViewFollowers: true,
    };
  }

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

  let isFollower = false;
  if (viewerUserId) {
    const followRows = await sql<{ count: string }>`
      select count(*)::text as count
      from "user_follow"
      where "followerId" = ${viewerUserId}
        and "followingId" = ${ownerUserId}
      limit 1
    `;
    isFollower = Number(followRows[0]?.count ?? "0") > 0;
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

      const rows = await sql<{
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
        where "userId" =
          ${context.userId}
        limit 1
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

      const userRow = userRows[0];
      const row = rows[0];

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
      } satisfies UserProfile;
    });

/* ============================================================ */
/* PERFIL PÚBLICO                                                  */
/* ============================================================ */

export const getPublicProfile =
  createServerFn({
    method: "GET",
  })
    .middleware([optionalAuthMiddleware])
    .validator((d: { nick: string }) => d)
    .handler(async ({
      context,
      data,
    }) => {
      const viewerUserId = context?.userId ?? null;
      const input = data as {
        nick?: unknown;
      };

      const nick = normalizeNick(
        input.nick,
      );

      if (!nick) {
        throw new Error(
          "Nick não informado.",
        );
      }

      const sql = await getSql();

      const rows = await sql<{
        userId: string;
        name: string | null;
        nick: string | null;
        bio: string | null;
        image: string | null;
        bannerUrl: string | null;
      }>`
        select
          u."id" as "userId",
          coalesce(p."displayName", u."name") as "name",
          coalesce(p."nick", u."name", 'usuario') as "nick",
          p."bio",
          coalesce(p."avatarUrl", u."image") as "image",
          p."bannerUrl"
        from "user" u

        left join "profile" p
          on p."userId" = u."id"

        where (p."nick" is not null and lower(p."nick") = lower(${nick}))
           or lower(u."id") = lower(${nick})
        limit 1
      `;

      const row = rows[0];

      if (!row) {
        throw new Error(
          "Esse perfil não existe.",
        );
      }

      // Avaliação estrita de privacidade no servidor
      const privacy = await evaluateUserPrivacy(sql, row.userId, viewerUserId);

      let commentCount = 0;
      if (privacy.canViewComments) {
        const commentRows = await sql<{
          count: string;
        }>`
          select count(*)::text as count
          from "comment"
          where "userId" =
            ${row.userId}
        `;
        commentCount = Number(commentRows[0]?.count ?? "0");
      }

      let followersCount = 0;
      if (privacy.canViewFollowers) {
        const followerRows = await sql<{
          count: string;
        }>`
          select count(*)::text as count
          from "user_follow"
          where "followingId" =
            ${row.userId}
        `;
        followersCount = Number(followerRows[0]?.count ?? "0");
      }

      let followingCount = 0;
      if (privacy.canViewFollowers) {
        const followingRows = await sql<{
          count: string;
        }>`
          select count(*)::text as count
          from "user_follow"
          where "followerId" =
            ${row.userId}
        `;
        followingCount = Number(followingRows[0]?.count ?? "0");
      }

      const profileResult: PublicUserProfile = {
        userId: row.userId,
        name: row.name || row.nick || "Usuário",
        nick: row.nick ?? "",
        bio: row.bio ?? "",
        image: row.image,
        bannerUrl: row.bannerUrl ?? null,
        commentCount,
        followersCount,
        followingCount,
        isFollowing: privacy.isFollower,
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
      };

      return profileResult;
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
        }>`
          select
            u."id" as "userId",
            p."nick",
            u."name",
            u."image",
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

          inner join "profile" p
            on p."userId" =
              u."id"

          where uf."followingId" =
            ${currentUserId}

          order by
            uf."createdAt" desc
        `;

      const result: ProfileUser[] = [];

      for (const row of rows) {
        if (!row.nick) {
          continue;
        }

        result.push({
          userId: row.userId,
          nick: row.nick,
          name:
            row.name ??
            "Usuário",
          image: row.image,
          isFollowing: Boolean(row.isFollowing),
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
        }>`
          select
            u."id" as "userId",
            p."nick",
            u."name",
            u."image",
            exists (
              select 1
              from "user_follow" f
              where f."followerId" = ${currentUserId}
                and f."followingId" = u."id"
            ) as "isFollowing"
          from "user_follow" uf

          inner join "user" u
            on u."id" =
              uf."followingId"

          inner join "profile" p
            on p."userId" =
              u."id"

          where uf."followerId" =
            ${currentUserId}

          order by
            uf."createdAt" desc
        `;

      const result: ProfileUser[] = [];

      for (const row of rows) {
        if (!row.nick) {
          continue;
        }

        result.push({
          userId: row.userId,
          nick: row.nick,
          name:
            row.name ??
            "Usuário",
          image: row.image,
          isFollowing: Boolean(row.isFollowing),
        });
      }

      return result;
    });

/* ============================================================ */
/* MEUS COMENTÁRIOS                                               */
/* ============================================================ */

export const getMyComments =
  createServerFn({
    method: "GET",
  })
    .middleware([authMiddleware])
    .handler(async ({ context }) => {
      const sql = await getSql();

      const rows =
        await sql<MyProfileComment>`
          select
            c."id",
            c."animeId",
            c."episodeId",
            c."content",
            c."parentId",
            c."isSpoiler",
            c."createdAt",
            c."updatedAt",
            c."userId",

            coalesce(
              u."name",
              'Usuário'
            ) as "userName",

            u."image" as "userImage",

            (
              select count(*)::int
              from "comment_like" cl
              where
                cl."commentId" =
                  c."id"
            ) as "likes",

            exists (
              select 1
              from "comment_like" cl2
              where
                cl2."commentId" =
                  c."id"
                and cl2."userId" =
                  ${context.userId}
            ) as "liked"

          from "comment" c

          left join "user" u
            on u."id" =
              c."userId"

          where c."userId" =
            ${context.userId}

          order by
            c."createdAt" desc
        `;

      return rows.map((comment) => ({
        ...comment,
        likes:
          Number(
            comment.likes ?? 0,
          ) || 0,
        liked:
          Boolean(comment.liked),
      }));
    });

/* ============================================================ */
/* COMENTÁRIOS DO PERFIL PÚBLICO                                  */
/* ============================================================ */

export const getPublicComments =
  createServerFn({
    method: "GET",
  })
    .middleware([optionalAuthMiddleware])
    .validator((d: { userId: string }) => d)
    .handler(async ({
      context,
      data,
    }) => {
      const viewerUserId = context?.userId ?? null;
      const input = data as {
        userId?: unknown;
      };

      const userId =
        typeof input.userId ===
        "string"
          ? input.userId.trim()
          : "";

      if (!userId) {
        throw new Error(
          "Usuário não informado.",
        );
      }

      const sql = await getSql();

      // Avaliação estrita de privacidade no servidor
      const privacy = await evaluateUserPrivacy(sql, userId, viewerUserId);
      if (!privacy.canViewComments) {
        throw new Error("Os comentários deste perfil são privados.");
      }

      const rows =
        await sql<PublicProfileComment>`
          select
            c."id",
            c."animeId",
            c."episodeId",
            c."content",
            c."parentId",
            c."isSpoiler",
            c."createdAt",
            c."updatedAt",
            c."userId",

            coalesce(
              u."name",
              'Usuário'
            ) as "userName",

            u."image" as "userImage",

            (
              select count(*)::int
              from "comment_like" cl
              where
                cl."commentId" =
                  c."id"
            ) as "likes"

          from "comment" c

          left join "user" u
            on u."id" =
              c."userId"

          where c."userId" =
            ${userId}

          order by
            c."createdAt" desc
        `;

      return rows.map((comment) => ({
        ...comment,
        likes:
          Number(
            comment.likes ?? 0,
          ) || 0,
        liked: false,
      }));
    });

/* ============================================================ */
/* SEGUIDORES E SEGUINDO PÚBLICOS COM CONTROLE DE PRIVACIDADE    */
/* ============================================================ */

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
      }>`
        select
          u."id" as "userId",
          p."nick",
          u."name",
          u."image",
          exists (
            select 1
            from "user_follow" f
            where f."followerId" = ${viewerUserId}
              and f."followingId" = u."id"
          ) as "isFollowing"
        from "user_follow" uf
        inner join "user" u on u."id" = uf."followerId"
        inner join "profile" p on p."userId" = u."id"
        where uf."followingId" = ${targetUserId}
        order by uf."createdAt" desc
      `;

      return rows
        .filter((r) => Boolean(r.nick))
        .map((r) => ({
          userId: r.userId,
          nick: r.nick!,
          name: r.name ?? "Usuário",
          image: r.image,
          isFollowing: Boolean(r.isFollowing),
        }));
    });

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
      }>`
        select
          u."id" as "userId",
          p."nick",
          u."name",
          u."image",
          exists (
            select 1
            from "user_follow" f
            where f."followerId" = ${viewerUserId}
              and f."followingId" = u."id"
          ) as "isFollowing"
        from "user_follow" uf
        inner join "user" u on u."id" = uf."followingId"
        inner join "profile" p on p."userId" = u."id"
        where uf."followerId" = ${targetUserId}
        order by uf."createdAt" desc
      `;

      return rows
        .filter((r) => Boolean(r.nick))
        .map((r) => ({
          userId: r.userId,
          nick: r.nick!,
          name: r.name ?? "Usuário",
          image: r.image,
          isFollowing: Boolean(r.isFollowing),
        }));
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
