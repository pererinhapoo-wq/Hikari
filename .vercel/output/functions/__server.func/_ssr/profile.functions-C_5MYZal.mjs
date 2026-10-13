import { i as createServerFn } from "./ssr.mjs";
import { i as getSql } from "./db-Dxw4oGVx.mjs";
import { t as authMiddleware } from "./middleware-NjrpD292.mjs";
import { t as createServerRpc } from "./createServerRpc--phiu8Av.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/profile.functions-C_5MYZal.js
function parseFavorites(value) {
	if (typeof value !== "string" || !value) return [];
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
	} catch {
		return [];
	}
}
function normalizeNick(value) {
	if (typeof value !== "string") return "";
	return value.trim().replace(/^@+/, "").toLowerCase().slice(0, 30);
}
function isValidNick(nick) {
	return /^[a-z0-9_]{3,30}$/.test(nick);
}
var getProfile_createServerFn_handler = createServerRpc({
	id: "9df9652da79c7ccc337ce62c64dcd11f1800a8eb6e0bd13747650358f67fe4e8",
	name: "getProfile",
	filename: "src/lib/profile.functions.ts"
}, (opts) => getProfile.__executeServer(opts));
var getProfile = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getProfile_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	const rows = await sql`
        select
          "nick",
          "bio",
          "favorites"
        from "profile"
        where "userId" =
          ${context.userId}
        limit 1
      `;
	const commentRows = await sql`
        select count(*)::text as count
        from "comment"
        where "userId" =
          ${context.userId}
      `;
	const followerRows = await sql`
        select count(*)::text as count
        from "user_follow"
        where "followingId" =
          ${context.userId}
      `;
	const followingRows = await sql`
        select count(*)::text as count
        from "user_follow"
        where "followerId" =
          ${context.userId}
      `;
	const row = rows[0];
	return {
		nick: row?.nick ?? "",
		bio: row?.bio ?? "",
		favorites: parseFavorites(row?.favorites),
		commentCount: Number(commentRows[0]?.count ?? "0"),
		followersCount: Number(followerRows[0]?.count ?? "0"),
		followingCount: Number(followingRows[0]?.count ?? "0")
	};
});
var getPublicProfile_createServerFn_handler = createServerRpc({
	id: "4bf0d871c1b1448bf83ecae994053dfefc9592abecd0f940b98c0f46242944f0",
	name: "getPublicProfile",
	filename: "src/lib/profile.functions.ts"
}, (opts) => getPublicProfile.__executeServer(opts));
var getPublicProfile = createServerFn({ method: "GET" }).handler(getPublicProfile_createServerFn_handler, async ({ data }) => {
	const nick = normalizeNick(data.nick);
	if (!nick) throw new Error("Nick não informado.");
	const sql = await getSql();
	const row = (await sql`
        select
          p."userId",
          p."nick",
          p."bio",
          u."image"
        from "profile" p

        inner join "user" u
          on u."id" =
            p."userId"

        where lower(p."nick") =
          lower(${nick})
        limit 1
      `)[0];
	if (!row) throw new Error("Esse perfil não existe.");
	const commentRows = await sql`
        select count(*)::text as count
        from "comment"
        where "userId" =
          ${row.userId}
      `;
	const followerRows = await sql`
        select count(*)::text as count
        from "user_follow"
        where "followingId" =
          ${row.userId}
      `;
	const followingRows = await sql`
        select count(*)::text as count
        from "user_follow"
        where "followerId" =
          ${row.userId}
      `;
	return {
		userId: row.userId,
		nick: row.nick ?? "",
		bio: row.bio ?? "",
		image: row.image,
		commentCount: Number(commentRows[0]?.count ?? "0"),
		followersCount: Number(followerRows[0]?.count ?? "0"),
		followingCount: Number(followingRows[0]?.count ?? "0"),
		isFollowing: false
	};
});
var getProfileFollowers_createServerFn_handler = createServerRpc({
	id: "d31ac4ed180510097a068f8bdad6828f14dd43907f9ab8529afdd6f26398fcb2",
	name: "getProfileFollowers",
	filename: "src/lib/profile.functions.ts"
}, (opts) => getProfileFollowers.__executeServer(opts));
var getProfileFollowers = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getProfileFollowers_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	const rows = await sql`
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
	const result = [];
	for (const row of rows) {
		if (!row.nick) continue;
		const followRows = await sql`
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
			name: row.name ?? "Usuário",
			image: row.image,
			isFollowing: Number(followRows[0]?.count ?? "0") > 0
		});
	}
	return result;
});
var getProfileFollowing_createServerFn_handler = createServerRpc({
	id: "1838c85b00341136a400e035ef711c06064be946f9f419844d4f17d663d9eba1",
	name: "getProfileFollowing",
	filename: "src/lib/profile.functions.ts"
}, (opts) => getProfileFollowing.__executeServer(opts));
var getProfileFollowing = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getProfileFollowing_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	const rows = await sql`
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
	const result = [];
	for (const row of rows) {
		if (!row.nick) continue;
		const followRows = await sql`
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
			name: row.name ?? "Usuário",
			image: row.image,
			isFollowing: Number(followRows[0]?.count ?? "0") > 0
		});
	}
	return result;
});
var getMyComments_createServerFn_handler = createServerRpc({
	id: "25a8912d9088beaa474d5eaf8c6f3a83922dbac5c467671790718d707cde70cf",
	name: "getMyComments",
	filename: "src/lib/profile.functions.ts"
}, (opts) => getMyComments.__executeServer(opts));
var getMyComments = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getMyComments_createServerFn_handler, async ({ context }) => {
	return (await (await getSql())`
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
        `).map((comment) => ({
		...comment,
		likes: Number(comment.likes ?? 0) || 0,
		liked: Boolean(comment.liked)
	}));
});
var getPublicComments_createServerFn_handler = createServerRpc({
	id: "1d2e2b7f1167bca92ce8181084df23c866939c314c5d94e0cf2d16d3e467fed0",
	name: "getPublicComments",
	filename: "src/lib/profile.functions.ts"
}, (opts) => getPublicComments.__executeServer(opts));
var getPublicComments = createServerFn({ method: "GET" }).handler(getPublicComments_createServerFn_handler, async ({ data }) => {
	const input = data;
	const userId = typeof input.userId === "string" ? input.userId.trim() : "";
	if (!userId) throw new Error("Usuário não informado.");
	return (await (await getSql())`
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
        `).map((comment) => ({
		...comment,
		likes: Number(comment.likes ?? 0) || 0,
		liked: false
	}));
});
var updateProfile_createServerFn_handler = createServerRpc({
	id: "d94d0b5402d88327ffc5615e3b5d2a6f5e7a519b2121a922cbe6da824cc59c6d",
	name: "updateProfile",
	filename: "src/lib/profile.functions.ts"
}, (opts) => updateProfile.__executeServer(opts));
var updateProfile = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(updateProfile_createServerFn_handler, async ({ context, data }) => {
	const input = data;
	const nick = normalizeNick(input.nick);
	if (!nick) throw new Error("O Nick é obrigatório.");
	if (!isValidNick(nick)) throw new Error("O Nick deve ter entre 3 e 30 caracteres e usar apenas letras, números ou _.");
	const bio = typeof input.bio === "string" ? input.bio.trim().slice(0, 500) : "";
	const favorites = Array.isArray(input.favorites) ? input.favorites.filter((item) => typeof item === "string") : [];
	const sql = await getSql();
	if ((await sql`
        select "userId"
        from "profile"
        where
          lower("nick") =
            lower(${nick})
          and "userId" <>
            ${context.userId}
        limit 1
      `).length > 0) throw new Error("Esse Nick já está em uso.");
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
          ${JSON.stringify(favorites)}
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
	const commentRows = await sql`
        select count(*)::text as count
        from "comment"
        where "userId" =
          ${context.userId}
      `;
	const followerRows = await sql`
        select count(*)::text as count
        from "user_follow"
        where "followingId" =
          ${context.userId}
      `;
	const followingRows = await sql`
        select count(*)::text as count
        from "user_follow"
        where "followerId" =
          ${context.userId}
      `;
	return {
		nick,
		bio,
		favorites,
		commentCount: Number(commentRows[0]?.count ?? "0"),
		followersCount: Number(followerRows[0]?.count ?? "0"),
		followingCount: Number(followingRows[0]?.count ?? "0")
	};
});
//#endregion
export { getMyComments_createServerFn_handler, getProfileFollowers_createServerFn_handler, getProfileFollowing_createServerFn_handler, getProfile_createServerFn_handler, getPublicComments_createServerFn_handler, getPublicProfile_createServerFn_handler, updateProfile_createServerFn_handler };
