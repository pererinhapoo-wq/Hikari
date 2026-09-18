import { createServerFn } from "@tanstack/react-start";

import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export type UserProfile = {
  nick: string;
  bio: string;
  favorites: string[];
  commentCount: number;
  followersCount: number;
  followingCount: number;
};

export type PublicUserProfile = {
  userId: string;
  nick: string;
  bio: string;
  commentCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
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
      }>`
        select
          "nick",
          "bio",
          "favorites"
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

      const row = rows[0];

      return {
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
      } satisfies UserProfile;
    });

/* ============================================================ */
/* PERFIL PÚBLICO                                                  */
/* ============================================================ */

export const getPublicProfile =
  createServerFn({
    method: "GET",
  })
    .handler(async ({
      data,
    }) => {
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
        nick: string | null;
        bio: string | null;
      }>`
        select
          p."userId",
          p."nick",
          p."bio"
        from "profile" p
        where lower(p."nick") =
          lower(${nick})
        limit 1
      `;

      const row = rows[0];

      if (!row) {
        throw new Error(
          "Esse perfil não existe.",
        );
      }

      const commentRows = await sql<{
        count: string;
      }>`
        select count(*)::text as count
        from "comment"
        where "userId" =
          ${row.userId}
      `;

      const followerRows = await sql<{
        count: string;
      }>`
        select count(*)::text as count
        from "user_follow"
        where "followingId" =
          ${row.userId}
      `;

      const followingRows = await sql<{
        count: string;
      }>`
        select count(*)::text as count
        from "user_follow"
        where "followerId" =
          ${row.userId}
      `;

      return {
        userId: row.userId,
        nick: row.nick ?? "",
        bio: row.bio ?? "",
        commentCount: Number(
          commentRows[0]?.count ?? "0",
        ),
        followersCount: Number(
          followerRows[0]?.count ?? "0",
        ),
        followingCount: Number(
          followingRows[0]?.count ?? "0",
        ),
        isFollowing: false,
      } satisfies PublicUserProfile;
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

      const rows =
        await sql<{
          userId: string;
          nick: string | null;
          name: string | null;
          image: string | null;
        }>`
          select
            u."id" as "userId",
            p."nick",
            u."name",
            u."image"
          from "user_follow" uf

          inner join "user" u
            on u."id" =
              uf."followerId"

          inner join "profile" p
            on p."userId" =
              u."id"

          where uf."followingId" =
            ${context.userId}

          order by
            uf."createdAt" desc
        `;

      const result: ProfileUser[] = [];

      for (const row of rows) {
        if (!row.nick) {
          continue;
        }

        const followRows =
          await sql<{
            count: string;
          }>`
            select count(*)::text as count
            from "user_follow"
            where
              "followerId" =
                ${context.userId}
              and "followingId" =
                ${row.userId}
          `;

        result.push({
          userId: row.userId,
          nick: row.nick,
          name:
            row.name ??
            "Usuário",
          image: row.image,
          isFollowing:
            Number(
              followRows[0]?.count ??
                "0",
            ) > 0,
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

      const rows =
        await sql<{
          userId: string;
          nick: string | null;
          name: string | null;
          image: string | null;
        }>`
          select
            u."id" as "userId",
            p."nick",
            u."name",
            u."image"
          from "user_follow" uf

          inner join "user" u
            on u."id" =
              uf."followingId"

          inner join "profile" p
            on p."userId" =
              u."id"

          where uf."followerId" =
            ${context.userId}

          order by
            uf."createdAt" desc
        `;

      const result: ProfileUser[] = [];

      for (const row of rows) {
        if (!row.nick) {
          continue;
        }

        const followRows =
          await sql<{
            count: string;
          }>`
            select count(*)::text as count
            from "user_follow"
            where
              "followerId" =
                ${context.userId}
              and "followingId" =
                ${row.userId}
          `;

        result.push({
          userId: row.userId,
          nick: row.nick,
          name:
            row.name ??
            "Usuário",
          image: row.image,
          isFollowing:
            Number(
              followRows[0]?.count ??
                "0",
            ) > 0,
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
    .handler(async ({
      data,
    }) => {
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
/* ATUALIZAR PERFIL                                                */
/* ============================================================ */

export const updateProfile =
  createServerFn({
    method: "POST",
  })
    .middleware([authMiddleware])
    .handler(async ({
      context,
      data,
    }) => {
      const input = data as {
        nick?: unknown;
        bio?: unknown;
        favorites?: unknown;
      };

      const nick = normalizeNick(
        input.nick,
      );

      if (!nick) {
        throw new Error(
          "O Nick é obrigatório.",
        );
      }

      if (!isValidNick(nick)) {
        throw new Error(
          "O Nick deve ter entre 3 e 30 caracteres e usar apenas letras, números ou _.",
        );
      }

      const bio =
        typeof input.bio === "string"
          ? input.bio
              .trim()
              .slice(0, 500)
          : "";

      const favorites =
        Array.isArray(
          input.favorites,
        )
          ? input.favorites.filter(
              (
                item,
              ): item is string =>
                typeof item ===
                "string",
            )
          : [];

      const sql = await getSql();

      const existing = await sql<{
        userId: string;
      }>`
        select "userId"
        from "profile"
        where
          lower("nick") =
            lower(${nick})
          and "userId" <>
            ${context.userId}
        limit 1
      `;

      if (existing.length > 0) {
        throw new Error(
          "Esse Nick já está em uso.",
        );
      }

      await sql`
        insert into "profile" (
          "userId",
          "nick",
          "bio",
          "favorites"
        )
        values (
          ${context.userId},
          ${nick},
          ${bio},
          ${JSON.stringify(
            favorites,
          )}
        )
        on conflict ("userId")
        do update set
          "nick" =
            excluded."nick",
          "bio" =
            excluded."bio",
          "favorites" =
            excluded."favorites",
          "updatedAt" =
            CURRENT_TIMESTAMP
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
        nick,
        bio,
        favorites,
        commentCount: Number(
          commentRows[0]?.count ??
            "0",
        ),
        followersCount: Number(
          followerRows[0]?.count ??
            "0",
        ),
        followingCount: Number(
          followingRows[0]?.count ??
            "0",
        ),
      } satisfies UserProfile;
    });
