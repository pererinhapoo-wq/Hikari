import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { resolveApiUser } from "@/lib/auth/api-session";

export const Route = createFileRoute("/api/comments/like")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);

          if (!apiUser?.id) {
            return Response.json(
              { error: "É necessário estar autenticado para reagir a um comentário." },
              { status: 401 },
            );
          }

          let body: any;
          try {
            body = await request.json();
          } catch {
            return Response.json(
              { error: "Formato de dados inválido (esperado JSON)." },
              { status: 400 },
            );
          }

          const commentId =
            typeof body?.commentId === "string" ? body.commentId.trim() : "";
          const reaction =
            body?.reaction === undefined
              ? "like"
              : typeof body?.reaction === "string"
                ? body.reaction.trim().toLowerCase()
                : "";

          if (!commentId) {
            return Response.json(
              { error: "O campo 'commentId' é obrigatório." },
              { status: 400 },
            );
          }

          if (reaction !== "like" && reaction !== "dislike") {
            return Response.json(
              { error: "A reação deve ser 'like' ou 'dislike'." },
              { status: 400 },
            );
          }

          // Verifica se o comentário existe e obtém autor e contexto de destino
          const commentCheck = await sql.query(
            `
              select "id", "userId", "animeId", "episodeId"
              from "comment"
              where "id" = $1
              limit 1
            `,
            [commentId],
          );

          const commentRows: any[] = Array.isArray(commentCheck)
            ? commentCheck
            : (commentCheck as any)?.rows ?? [];

          if (commentRows.length === 0) {
            return Response.json(
              { error: "Comentário não encontrado." },
              { status: 404 },
            );
          }

          const targetComment = commentRows[0];
          const commentAuthorId = targetComment?.userId
            ? String(targetComment.userId)
            : "";
          const targetAnimeId = targetComment?.animeId
            ? String(targetComment.animeId)
            : null;
          const targetEpisodeId = targetComment?.episodeId
            ? String(targetComment.episodeId)
            : null;

          // Busca reação existente do usuário
          const existingReactionCheck = await sql.query(
            `
              select "id", "type"
              from "comment_like"
              where "commentId" = $1 and "userId" = $2
              limit 1
            `,
            [commentId, apiUser.id],
          );

          const existingRows: any[] = Array.isArray(existingReactionCheck)
            ? existingReactionCheck
            : (existingReactionCheck as any)?.rows ?? [];

          const existing = existingRows[0];
          const wasLikedBefore = Boolean(
            existing && (existing.type === "like" || !existing.type),
          );

          if (existing) {
            const currentType = existing.type || "like";
            if (currentType === reaction) {
              // Mesma reação clicada novamente -> remove (toggle off)
              await sql.query(
                `
                  delete from "comment_like"
                  where "id" = $1
                `,
                [existing.id],
              );
            } else {
              // Reação oposta -> atualiza para a nova
              await sql.query(
                `
                  update "comment_like"
                  set "type" = $1
                  where "id" = $2
                `,
                [reaction, existing.id],
              );
            }
          } else {
            // Nenhuma reação prévia -> insere nova
            const reactionId = `cl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            await sql.query(
              `
                insert into "comment_like" ("id", "commentId", "userId", "type", "createdAt")
                values ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                on conflict ("commentId", "userId")
                do update set "type" = $4
              `,
              [reactionId, commentId, apiUser.id, reaction],
            );
          }

          // Recalcula contagens exatas consolidadas no banco
          const countsResult = await sql.query(
            `
              select
                (
                  select count(*)::int
                  from "comment_like"
                  where "commentId" = $1 and ("type" = 'like' or "type" is null)
                ) as "likes",
                (
                  select count(*)::int
                  from "comment_like"
                  where "commentId" = $1 and "type" = 'dislike'
                ) as "dislikes",
                (
                  select "type"
                  from "comment_like"
                  where "commentId" = $1 and "userId" = $2
                  limit 1
                ) as "userReaction"
            `,
            [commentId, apiUser.id],
          );

          const countsRows: any[] = Array.isArray(countsResult)
            ? countsResult
            : (countsResult as any)?.rows ?? [];

          const counts = countsRows[0] ?? {
            likes: 0,
            dislikes: 0,
            userReaction: null,
          };

          const userReaction =
            counts.userReaction === "like" || counts.userReaction === "dislike"
              ? counts.userReaction
              : null;

          // Sincroniza notificação de curtida para o autor do comentário (nunca auto-notificação)
          if (commentAuthorId && commentAuthorId !== apiUser.id) {
            try {
              if (userReaction === "like") {
                const actorResult = await sql.query(
                  `
                    select coalesce(
                      nullif(trim(p."nick"), ''),
                      nullif(trim(u."name"), ''),
                      $2
                    ) as "actorName"
                    from "user" u
                    left join "profile" p
                      on p."userId" = u."id"
                    where u."id" = $1
                    limit 1
                  `,
                  [apiUser.id, apiUser.name || "Usuário"],
                );
                const actorRows: any[] = Array.isArray(actorResult)
                  ? actorResult
                  : (actorResult as any)?.rows ?? [];
                const actorName = String(
                  actorRows[0]?.actorName || apiUser.name || "Usuário",
                );
                const likeMessage = `${actorName} curtiu seu comentário.`;

                const existingNotifResult = await sql.query(
                  `
                    select "id", "actorId"
                    from "notification"
                    where "userId" = $1
                      and "type" = 'comment_like'
                      and "commentId" = $2
                    order by "createdAt" desc
                    limit 1
                  `,
                  [commentAuthorId, commentId],
                );
                const existingNotifRows: any[] = Array.isArray(existingNotifResult)
                  ? existingNotifResult
                  : (existingNotifResult as any)?.rows ?? [];
                const existingNotif = existingNotifRows[0];

                if (existingNotif?.id) {
                  const keepId = String(existingNotif.id);
                  await sql.query(
                    `
                      delete from "notification"
                      where "userId" = $1
                        and "type" = 'comment_like'
                        and "commentId" = $2
                        and "id" <> $3
                    `,
                    [commentAuthorId, commentId, keepId],
                  );

                  if (String(existingNotif.actorId ?? "") !== apiUser.id) {
                    await sql.query(
                      `
                        update "notification"
                        set
                          "actorId" = $1,
                          "message" = $2,
                          "read" = false,
                          "createdAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
                          "animeId" = $3,
                          "episodeId" = $4
                        where "id" = $5
                      `,
                      [
                        apiUser.id,
                        likeMessage,
                        targetAnimeId,
                        targetEpisodeId,
                        keepId,
                      ],
                    );
                  } else {
                    await sql.query(
                      `
                        update "notification"
                        set
                          "message" = $1,
                          "animeId" = $2,
                          "episodeId" = $3
                        where "id" = $4
                      `,
                      [likeMessage, targetAnimeId, targetEpisodeId, keepId],
                    );
                  }
                } else {
                  const notificationId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                  await sql.query(
                    `
                      insert into "notification" (
                        "id",
                        "userId",
                        "actorId",
                        "type",
                        "message",
                        "read",
                        "createdAt",
                        "commentId",
                        "animeId",
                        "episodeId"
                      )
                      values (
                        $1,
                        $2,
                        $3,
                        'comment_like',
                        $4,
                        false,
                        (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
                        $5,
                        $6,
                        $7
                      )
                    `,
                    [
                      notificationId,
                      commentAuthorId,
                      apiUser.id,
                      likeMessage,
                      commentId,
                      targetAnimeId,
                      targetEpisodeId,
                    ],
                  );
                }
              } else if (wasLikedBefore) {
                // O usuário removeu sua curtida (ou trocou para dislike): atualiza ou remove se não restar nenhuma curtida externa
                const remainingLikerResult = await sql.query(
                  `
                    select
                      cl."userId",
                      coalesce(
                        nullif(trim(p."nick"), ''),
                        nullif(trim(u."name"), ''),
                        'Usuário'
                      ) as "actorName"
                    from "comment_like" cl
                    inner join "user" u
                      on u."id" = cl."userId"
                    left join "profile" p
                      on p."userId" = u."id"
                    where cl."commentId" = $1
                      and (cl."type" = 'like' or cl."type" is null)
                      and cl."userId" <> $2
                    order by cl."createdAt" desc
                    limit 1
                  `,
                  [commentId, commentAuthorId],
                );
                const remainingRows: any[] = Array.isArray(remainingLikerResult)
                  ? remainingLikerResult
                  : (remainingLikerResult as any)?.rows ?? [];
                const remainingLiker = remainingRows[0];

                if (remainingLiker?.userId) {
                  const remainingMessage = `${String(remainingLiker.actorName || "Usuário")} curtiu seu comentário.`;
                  await sql.query(
                    `
                      update "notification"
                      set
                        "actorId" = $1,
                        "message" = $2
                      where "userId" = $3
                        and "type" = 'comment_like'
                        and "commentId" = $4
                    `,
                    [
                      String(remainingLiker.userId),
                      remainingMessage,
                      commentAuthorId,
                      commentId,
                    ],
                  );
                } else {
                  await sql.query(
                    `
                      delete from "notification"
                      where "userId" = $1
                        and "type" = 'comment_like'
                        and "commentId" = $2
                    `,
                    [commentAuthorId, commentId],
                  );
                }
              }
            } catch (notifError) {
              console.error(
                "[api/comments/like] Erro ao sincronizar notificação de curtida:",
                notifError,
              );
            }
          }

          return Response.json({
            likes: Number(counts.likes) || 0,
            dislikes: Number(counts.dislikes) || 0,
            liked: userReaction === "like",
            disliked: userReaction === "dislike",
            userReaction,
          });
        } catch (error) {
          console.error("[api/comments/like] Erro ao registrar reação:", error);
          return Response.json(
            { error: "Não foi possível registrar a reação." },
            { status: 500 },
          );
        }
      },
    },
  },
});
