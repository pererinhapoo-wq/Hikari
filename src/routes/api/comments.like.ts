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

          // 1. Consulta unificada de contexto:
          // Obtém em uma única viagem:
          // - Validação de existência do comentário, autor e contexto de episódio/anime
          // - Reação existente do usuário logado (evitando SELECT subsequente em comment_like)
          // - Nome formatado do ator (nick do profile ou name do user), eliminando round-trip posterior
          const contextResult = await sql.query(
            `
              select
                c."id" as "commentId",
                c."userId" as "commentAuthorId",
                c."animeId",
                c."episodeId",
                cl."id" as "existingReactionId",
                cl."type" as "existingReactionType",
                coalesce(
                  nullif(trim(p."nick"), ''),
                  nullif(trim(u."name"), ''),
                  $3
                ) as "actorName"
              from "comment" c
              left join "comment_like" cl
                on cl."commentId" = c."id" and cl."userId" = $2
              left join "user" u
                on u."id" = $2
              left join "profile" p
                on p."userId" = u."id"
              where c."id" = $1
              limit 1
            `,
            [commentId, apiUser.id, apiUser.name || "Usuário"],
          );

          const contextRows: any[] = Array.isArray(contextResult)
            ? contextResult
            : (contextResult as any)?.rows ?? [];

          if (contextRows.length === 0) {
            return Response.json(
              { error: "Comentário não encontrado." },
              { status: 404 },
            );
          }

          const targetComment = contextRows[0];
          const commentAuthorId = targetComment?.commentAuthorId
            ? String(targetComment.commentAuthorId)
            : "";
          const targetAnimeId = targetComment?.animeId
            ? String(targetComment.animeId)
            : null;
          const targetEpisodeId = targetComment?.episodeId
            ? String(targetComment.episodeId)
            : null;
          const actorName = String(
            targetComment?.actorName || apiUser.name || "Usuário",
          );

          const hasExisting = Boolean(targetComment?.existingReactionId);
          const existingType = targetComment?.existingReactionType || (hasExisting ? "like" : null);
          const wasLikedBefore = Boolean(hasExisting && existingType === "like");

          let userReaction: "like" | "dislike" | null = null;

          // 2. Operação atômica de mutação:
          // Se o usuário clicou na mesma reação que já possuía -> toggle off (delete)
          // Se não possuía ou clicou na reação oposta -> UPSERT atômico (ON CONFLICT ("commentId", "userId"))
          // Isso elimina condições de corrida entre requisições simultâneas do mesmo usuário
          if (hasExisting && existingType === reaction) {
            await sql.query(
              `
                delete from "comment_like"
                where "commentId" = $1 and "userId" = $2
              `,
              [commentId, apiUser.id],
            );
            userReaction = null;
          } else {
            const reactionId = `cl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            await sql.query(
              `
                insert into "comment_like" ("id", "commentId", "userId", "type", "createdAt")
                values ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                on conflict ("commentId", "userId")
                do update set "type" = excluded."type"
              `,
              [reactionId, commentId, apiUser.id, reaction],
            );
            userReaction = reaction;
          }

          // 3. Contagem consolidada em uma única consulta agregada:
          // Elimina 2 subqueries aninhadas redundantes utilizando agregação direta com FILTER
          const countsResult = await sql.query(
            `
              select
                count(*) filter (where "type" = 'like' or "type" is null)::int as "likes",
                count(*) filter (where "type" = 'dislike')::int as "dislikes"
              from "comment_like"
              where "commentId" = $1
            `,
            [commentId],
          );

          const countsRows: any[] = Array.isArray(countsResult)
            ? countsResult
            : (countsResult as any)?.rows ?? [];

          const counts = countsRows[0] ?? {
            likes: 0,
            dislikes: 0,
          };

          // 4. Sincronização de notificação (apenas se o autor for outro usuário)
          if (commentAuthorId && commentAuthorId !== apiUser.id) {
            try {
              if (userReaction === "like") {
                const likeMessage = `${actorName} curtiu seu comentário.`;

                // Busca notificação existente
                const existingNotifResult = await sql.query(
                  `
                    select "id", "actorId"
                    from "notification"
                    where "userId" = $1
                      and "type" = 'comment_like'
                      and "commentId" = $2
                    order by "createdAt" desc
                  `,
                  [commentAuthorId, commentId],
                );
                const existingNotifRows: any[] = Array.isArray(existingNotifResult)
                  ? existingNotifResult
                  : (existingNotifResult as any)?.rows ?? [];

                if (existingNotifRows.length > 0) {
                  const keepId = String(existingNotifRows[0].id);

                  // Se houver mais de uma (devido a requisições simultâneas anteriores), remove as duplicatas
                  if (existingNotifRows.length > 1) {
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
                  }

                  // Atualiza notificação principal
                  if (String(existingNotifRows[0].actorId ?? "") !== apiUser.id) {
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
                // Usuário removeu curtida ou trocou para dislike:
                // Busca se ainda resta algum outro liker
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
