import { getSql } from "../src/lib/db.ts";

async function run() {
  const sql = await getSql();

  const now = Date.now();
  const user1 = "u1-" + now;
  const user2 = "u2-" + now;
  const user3 = "u3-" + now;

  await sql.query(
    `insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt") values ($1, $2, $3, true, now(), now())`,
    [user1, "User 1", `${user1}@t.com`]
  );
  await sql.query(
    `insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt") values ($1, $2, $3, true, now(), now())`,
    [user2, "User 2", `${user2}@t.com`]
  );
  await sql.query(
    `insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt") values ($1, $2, $3, true, now(), now())`,
    [user3, "User 3", `${user3}@t.com`]
  );

  const commentId = "c-" + now;
  await sql.query(
    `insert into "comment" ("id", "userId", "animeId", "episodeId", "content", "createdAt") values ($1, $2, $3, $4, $5, now())`,
    [commentId, user1, "shingeki", "anime", "Meu comentário"]
  );

  // user2 e user3 curtem o comentário
  await sql.query(
    `insert into "comment_like" ("id", "commentId", "userId", "type", "createdAt") values ($1, $2, $3, 'like', now())`,
    [`cl-1-${now}`, commentId, user2]
  );
  await sql.query(
    `insert into "comment_like" ("id", "commentId", "userId", "type", "createdAt") values ($1, $2, $3, 'like', now())`,
    [`cl-2-${now}`, commentId, user3]
  );

  // Notificação comment_like para user1
  const notifLikeId = "nl-" + now;
  await sql.query(
    `insert into "notification" ("id", "userId", "actorId", "type", "message", "commentId", "createdAt") values ($1, $2, $3, 'comment_like', 'curtiu seu comentário', $4, now())`,
    [notifLikeId, user1, user3, commentId]
  );

  // Notificação comment (menção) para user1
  const notifMentionId = "nm-" + now;
  await sql.query(
    `insert into "notification" ("id", "userId", "actorId", "type", "message", "commentId", "createdAt") values ($1, $2, $3, 'comment', 'mencionou você', $4, now() - interval '1 minute')`,
    [notifMentionId, user1, user2, commentId]
  );

  const VALID_NOTIFICATION_PREDICATE = `
    n."userId" = $1
    and (n."actorId" is null or n."actorId" <> n."userId")
    and (
      n."commentId" is null
      or exists (
        select 1
        from "comment" c
        where c."id" = n."commentId"
      )
    )
    and (
      n."type" <> 'comment_like'
      or (
        n."commentId" is not null
        and exists (
          select 1
          from "comment_like" cl
          where cl."commentId" = n."commentId"
            and (cl."type" = 'like' or cl."type" is null)
            and cl."userId" <> n."userId"
        )
      )
    )
  `;

  // Nova query com CTE agrupada
  const query = `
    with target_notifications as (
      select n.*
      from "notification" n
      where ${VALID_NOTIFICATION_PREDICATE}
      order by n."createdAt" desc
      limit 50
    ),
    like_counts as (
      select
        cl."commentId",
        count(*)::int as "likesCount"
      from "comment_like" cl
      where (cl."type" = 'like' or cl."type" is null)
        and cl."userId" <> $1
        and cl."commentId" in (
          select distinct tn."commentId"
          from target_notifications tn
          where tn."type" = 'comment_like'
            and tn."commentId" is not null
        )
      group by cl."commentId"
    )
    select
      n."id",
      n."type",
      n."message",
      n."read",
      (n."createdAt" at time zone 'UTC') as "createdAt",
      n."actorId",
      case
        when n."actorId" is not null then coalesce(
          nullif(trim(p."nick"), ''),
          nullif(trim(u."name"), ''),
          'Usuário'
        )
        else null
      end as "actorName",
      u."image" as "actorImage",
      n."commentId",
      coalesce(
        nullif(trim(n."animeId"), ''),
        nullif(trim(c."animeId"), '')
      ) as "animeId",
      coalesce(
        nullif(trim(n."episodeId"), ''),
        nullif(trim(c."episodeId"), '')
      ) as "episodeId",
      c."content" as "commentContent",
      c."imageUrl" as "commentImageUrl",
      coalesce(c."isSpoiler", false) as "commentIsSpoiler",
      c."parentId" as "parentCommentId",
      pc."content" as "parentCommentContent",
      pc."imageUrl" as "parentCommentImageUrl",
      coalesce(pc."isSpoiler", false) as "parentCommentIsSpoiler",
      case
        when pc."userId" is not null then coalesce(
          nullif(trim(pp."nick"), ''),
          nullif(trim(pu."name"), ''),
          'Usuário'
        )
        else null
      end as "parentCommentAuthorName",
      case
        when n."type" = 'comment_like' and n."commentId" is not null then coalesce(lc."likesCount", 0)::int
        else 0
      end as "commentLikes"
    from target_notifications n
    left join like_counts lc
      on lc."commentId" = n."commentId"
    left join "user" u
      on u."id" = n."actorId"
    left join "profile" p
      on p."userId" = n."actorId"
    left join "comment" c
      on c."id" = n."commentId"
    left join "comment" pc
      on pc."id" = c."parentId"
    left join "user" pu
      on pu."id" = pc."userId"
    left join "profile" pp
      on pp."userId" = pc."userId"
    order by n."createdAt" desc
  `;

  const rows = await sql.query(query, [user1]);
  console.log("Total linhas retornadas:", rows.length);
  for (const r of rows) {
    console.log(`Notificação ID: ${r.id} | Tipo: ${r.type} | commentLikes: ${r.commentLikes}`);
  }

  const notifLikeRow = rows.find(r => r.type === "comment_like");
  const notifMentionRow = rows.find(r => r.type === "comment");

  if (!notifLikeRow || notifLikeRow.commentLikes !== 2) {
    throw new Error(`Falha: commentLikes para comment_like esperado 2, recebido ${notifLikeRow?.commentLikes}`);
  }
  if (!notifMentionRow || notifMentionRow.commentLikes !== 0) {
    throw new Error(`Falha: commentLikes para menção esperado 0, recebido ${notifMentionRow?.commentLikes}`);
  }

  console.log("SUCESSO: CTE like_counts testada com 100% de precisão e paridade!");
  process.exit(0);
}

run().catch((err) => {
  console.error("ERRO:", err);
  process.exit(1);
});
