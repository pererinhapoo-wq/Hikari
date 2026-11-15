import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { resolveApiUser } from "@/lib/auth/api-session";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
};

export const Route = createFileRoute("/api/comments/updates")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const animeId = url.searchParams.get("animeId")?.trim() ?? "";
          const rawEpisodeId = url.searchParams.get("episodeId")?.trim() ?? "";
          const episodeId = rawEpisodeId || "anime";
          const rawSince = url.searchParams.get("since")?.trim() ?? "";
          const includeComments = url.searchParams.get("includeComments") === "1";

          if (!animeId || animeId.length > 100 || episodeId.length > 100) {
            return Response.json(
              { error: "Parâmetros 'animeId' e 'episodeId' inválidos." },
              { status: 400, headers: NO_STORE_HEADERS },
            );
          }

          if (!rawSince) {
            return Response.json(
              { error: "O parâmetro 'since' é obrigatório." },
              { status: 400, headers: NO_STORE_HEADERS },
            );
          }

          const sinceDate = new Date(rawSince);
          if (Number.isNaN(sinceDate.getTime())) {
            return Response.json(
              { error: "Timestamp 'since' inválido." },
              { status: 400, headers: NO_STORE_HEADERS },
            );
          }

          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);
          const currentUserId = apiUser?.id ?? null;

          const rawPollRows = await sql.query(
            `
              with server_now as (
                select to_char(CURRENT_TIMESTAMP at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "serverTime"
              )
              select
                sn."serverTime",
                c."id",
                c."parentId",
                c."userId",
                to_char(c."createdAt" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAtIso"
              from server_now sn
              left join "comment" c
                on c."animeId" = $1
               and c."episodeId" = $2
               and c."createdAt" >= $3::timestamptz
               and ($4::text is null or c."userId" <> $4)
              order by c."createdAt" asc nulls last, c."id" asc nulls last
              limit 200
            `,
            [animeId, episodeId, rawSince, currentUserId],
          );

          const pollRows: any[] = Array.isArray(rawPollRows)
            ? rawPollRows
            : (rawPollRows as any)?.rows ?? [];

          const serverTime = pollRows[0]?.serverTime
            ? String(pollRows[0].serverTime)
            : new Date().toISOString();

          const items = pollRows
            .filter((row) => row?.id)
            .map((row) => ({
              id: String(row.id),
              parentId: row.parentId ? String(row.parentId) : null,
              userId: String(row.userId),
              createdAt: row.createdAtIso ? String(row.createdAtIso) : serverTime,
            }));

          if (!includeComments) {
            return Response.json(
              { items, serverTime },
              { headers: NO_STORE_HEADERS },
            );
          }

          const rawCountRows = await sql.query(
            `
              select
                count(*)::int as "totalCount",
                count(*) filter (where c."parentId" is null)::int as "totalRoots"
              from "comment" c
              where c."animeId" = $1
                and c."episodeId" = $2
            `,
            [animeId, episodeId],
          );

          const countRows: any[] = Array.isArray(rawCountRows)
            ? rawCountRows
            : (rawCountRows as any)?.rows ?? [];
          const totalCount = Number(countRows[0]?.totalCount) || 0;
          const totalRoots = Number(countRows[0]?.totalRoots) || 0;

          if (items.length === 0) {
            return Response.json(
              {
                items: [],
                comments: [],
                totalCount,
                totalRoots,
                serverTime,
              },
              { headers: NO_STORE_HEADERS },
            );
          }

          const newIds = items.map((item) => item.id);
          const rawCommentRows = await sql.query(
            `
              with recursive needed_comments as (
                select c."id", c."parentId", 1 as "depth", array[c."id"] as "path"
                from "comment" c
                where c."id" = any($1::text[])
                  and c."animeId" = $2
                  and c."episodeId" = $3
                union all
                select p."id", p."parentId", nc."depth" + 1 as "depth", nc."path" || p."id" as "path"
                from "comment" p
                inner join needed_comments nc on nc."parentId" = p."id"
                where nc."parentId" is not null
                  and not (p."id" = any(nc."path"))
                  and nc."depth" <= 500
              ),
              unique_ids as (
                select distinct "id" from needed_comments
              ),
              like_counts as (
                select
                  cl."commentId",
                  count(*) filter (where cl."type" = 'like' or cl."type" is null)::int as "likes",
                  count(*) filter (where cl."type" = 'dislike')::int as "dislikes"
                from "comment_like" cl
                inner join unique_ids ui on ui."id" = cl."commentId"
                group by cl."commentId"
              )
              select
                c."id",
                c."animeId",
                c."episodeId",
                c."content",
                c."imageUrl",
                c."parentId",
                c."isSpoiler",
                c."createdAt",
                to_char(c."createdAt" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAtIso",
                c."updatedAt",
                to_char(c."updatedAt" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "updatedAtIso",
                c."userId",
                coalesce(p."nick", u."name", 'Usuário') as "userName",
                u."image" as "userImage",
                p."nick" as "userNick",
                coalesce(lc."likes", 0)::int as "likes",
                coalesce(lc."dislikes", 0)::int as "dislikes",
                case
                  when $4::text is not null and (my_cl."type" = 'like' or (my_cl."type" is null and my_cl."id" is not null)) then true
                  else false
                end as "liked",
                case
                  when $4::text is not null and my_cl."type" = 'dislike' then true
                  else false
                end as "disliked",
                case
                  when $4::text is null then null
                  when my_cl."type" = 'dislike' then 'dislike'
                  when my_cl."type" = 'like' or (my_cl."type" is null and my_cl."id" is not null) then 'like'
                  else null
                end as "userReaction"
              from unique_ids ui
              inner join "comment" c on c."id" = ui."id"
              left join "user" u on u."id" = c."userId"
              left join "profile" p on p."userId" = c."userId"
              left join like_counts lc on lc."commentId" = c."id"
              left join "comment_like" my_cl
                on my_cl."commentId" = c."id"
                and $4::text is not null
                and my_cl."userId" = $4
              order by c."createdAt" asc, c."id" asc
            `,
            [newIds, animeId, episodeId, currentUserId],
          );

          const commentRows: any[] = Array.isArray(rawCommentRows)
            ? rawCommentRows
            : (rawCommentRows as any)?.rows ?? [];

          const comments = commentRows.map((row) => ({
            id: String(row.id),
            animeId: String(row.animeId),
            episodeId: String(row.episodeId),
            content: String(row.content ?? ""),
            imageUrl: row.imageUrl ? String(row.imageUrl) : null,
            parentId: row.parentId ? String(row.parentId) : null,
            isSpoiler: Boolean(row.isSpoiler),
            createdAt: row.createdAtIso
              ? String(row.createdAtIso)
              : row.createdAt instanceof Date
                ? row.createdAt.toISOString()
                : new Date(row.createdAt).toISOString(),
            updatedAt: row.updatedAtIso
              ? String(row.updatedAtIso)
              : row.updatedAt instanceof Date
                ? row.updatedAt.toISOString()
                : new Date(row.updatedAt).toISOString(),
            userId: String(row.userId),
            userName: row.userName ? String(row.userName) : "Usuário",
            userImage: row.userImage ? String(row.userImage) : null,
            userNick: row.userNick ? String(row.userNick) : null,
            likes: Number(row.likes) || 0,
            dislikes: Number(row.dislikes) || 0,
            liked: Boolean(row.liked),
            disliked: Boolean(row.disliked),
            userReaction:
              row.userReaction === "like" || row.userReaction === "dislike"
                ? row.userReaction
                : null,
          }));

          return Response.json(
            {
              items,
              comments,
              totalCount,
              totalRoots,
              serverTime,
            },
            { headers: NO_STORE_HEADERS },
          );
        } catch (error) {
          console.error("[api/comments/updates] Erro no GET:", error);
          return Response.json(
            { error: "Não foi possível verificar novos comentários." },
            { status: 500, headers: NO_STORE_HEADERS },
          );
        }
      },
    },
  },
});
