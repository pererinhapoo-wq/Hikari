import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { resolveApiUser } from "@/lib/auth/api-session";
import { isHikariAdmin } from "@/lib/auth/admin";

export const Route = createFileRoute("/api/comments")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const animeId = url.searchParams.get("animeId")?.trim();
          const rawEpisodeId = url.searchParams.get("episodeId")?.trim();

          if (!animeId) {
            return Response.json(
              { error: "O parâmetro 'animeId' é obrigatório." },
              { status: 400 },
            );
          }

          const episodeId = rawEpisodeId || undefined;

          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);
          const currentUserId = apiUser?.id ?? null;
          const isAdmin = Boolean(apiUser?.email && isHikariAdmin(apiUser.email));

          const queryText = `
            select
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
              coalesce(p."nick", u."name", 'Usuário') as "userName",
              u."image" as "userImage",
              p."nick" as "userNick",
              (
                select count(*)::int
                from "comment_like" cl
                where cl."commentId" = c."id"
                  and (cl."type" = 'like' or cl."type" is null)
              ) as "likes",
              (
                select count(*)::int
                from "comment_like" cl
                where cl."commentId" = c."id"
                  and cl."type" = 'dislike'
              ) as "dislikes",
              case
                when $2::text is not null then
                  exists (
                    select 1
                    from "comment_like" cl
                    where cl."commentId" = c."id"
                      and cl."userId" = $2
                      and (cl."type" = 'like' or cl."type" is null)
                  )
                else false
              end as "liked",
              case
                when $2::text is not null then
                  exists (
                    select 1
                    from "comment_like" cl
                    where cl."commentId" = c."id"
                      and cl."userId" = $2
                      and cl."type" = 'dislike'
                  )
                else false
              end as "disliked",
              case
                when $2::text is not null then
                  (
                    select cl."type"
                    from "comment_like" cl
                    where cl."commentId" = c."id"
                      and cl."userId" = $2
                    limit 1
                  )
                else null
              end as "userReaction"
            from "comment" c
            left join "user" u on u."id" = c."userId"
            left join "profile" p on p."userId" = c."userId"
            where c."animeId" = $1
              ${episodeId ? 'and c."episodeId" = $3' : ""}
            order by c."createdAt" asc
          `;

          const params: unknown[] = [animeId, currentUserId];
          if (episodeId) {
            params.push(episodeId);
          }

          const rawRows = await sql.query(queryText, params);
          const rows: any[] = Array.isArray(rawRows)
            ? rawRows
            : (rawRows as any)?.rows ?? [];

          const comments = rows.map((row) => ({
            id: String(row.id),
            animeId: String(row.animeId),
            episodeId: String(row.episodeId),
            content: String(row.content ?? ""),
            imageUrl: row.imageUrl ? String(row.imageUrl) : null,
            parentId: row.parentId ? String(row.parentId) : null,
            isSpoiler: Boolean(row.isSpoiler),
            createdAt:
              row.createdAt instanceof Date
                ? row.createdAt.toISOString()
                : new Date(row.createdAt).toISOString(),
            updatedAt:
              row.updatedAt instanceof Date
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

          return Response.json({
            comments,
            currentUserId,
            isAdmin,
          });
        } catch (error) {
          console.error("[api/comments] Erro no GET:", error);
          return Response.json(
            { error: "Não foi possível carregar os comentários." },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);

          if (!apiUser?.id) {
            return Response.json(
              { error: "É necessário estar autenticado para comentar." },
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

          const animeId =
            typeof body?.animeId === "string" ? body.animeId.trim() : "";
          const rawEpisodeId =
            typeof body?.episodeId === "string" ? body.episodeId.trim() : "";
          const episodeId = rawEpisodeId || "anime";
          const rawContent =
            typeof body?.content === "string" ? body.content.trim() : "";
          const rawImageUrl =
            typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
          const imageUrl = rawImageUrl ? rawImageUrl.slice(0, 2000) : null;
          const isSpoiler = Boolean(body?.isSpoiler);
          const rawParentId =
            typeof body?.parentId === "string" ? body.parentId.trim() : null;
          const parentId = rawParentId || null;

          if (!animeId) {
            return Response.json(
              { error: "O campo 'animeId' é obrigatório." },
              { status: 400 },
            );
          }

          if (animeId.length > 100) {
            return Response.json(
              { error: "'animeId' excede o limite permitido." },
              { status: 400 },
            );
          }

          if (episodeId.length > 100) {
            return Response.json(
              { error: "'episodeId' excede o limite permitido." },
              { status: 400 },
            );
          }

          if (!rawContent && !imageUrl) {
            return Response.json(
              { error: "O comentário deve conter texto ou uma imagem." },
              { status: 400 },
            );
          }

          if (rawContent.length > 5000) {
            return Response.json(
              { error: "O comentário excede o limite de 5.000 caracteres." },
              { status: 400 },
            );
          }

          // Validação do comentário pai se for uma resposta
          if (parentId) {
            const parentCheck = await sql.query(
              `
                select "id", "animeId", "episodeId"
                from "comment"
                where "id" = $1
                limit 1
              `,
              [parentId],
            );

            const parentRows: any[] = Array.isArray(parentCheck)
              ? parentCheck
              : (parentCheck as any)?.rows ?? [];

            if (parentRows.length === 0) {
              return Response.json(
                { error: "O comentário original não foi encontrado." },
                { status: 404 },
              );
            }

            const parent = parentRows[0];
            if (
              String(parent.animeId) !== animeId ||
              String(parent.episodeId) !== episodeId
            ) {
              return Response.json(
                {
                  error:
                    "A resposta deve pertencer ao mesmo anime e episódio do comentário original.",
                },
                { status: 400 },
              );
            }
          }

          const commentId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

          await sql.query(
            `
              insert into "comment" (
                "id",
                "userId",
                "animeId",
                "episodeId",
                "content",
                "imageUrl",
                "parentId",
                "isSpoiler",
                "createdAt",
                "updatedAt"
              ) values ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `,
            [
              commentId,
              apiUser.id,
              animeId,
              episodeId,
              rawContent,
              imageUrl,
              parentId,
              isSpoiler,
            ],
          );

          // Busca perfil para obter o nick
          const profileCheck = await sql.query(
            `
              select p."nick"
              from "profile" p
              where p."userId" = $1
              limit 1
            `,
            [apiUser.id],
          );
          const profileRows: any[] = Array.isArray(profileCheck)
            ? profileCheck
            : (profileCheck as any)?.rows ?? [];
          const userNick = profileRows[0]?.nick
            ? String(profileRows[0].nick)
            : null;

          const nowIso = new Date().toISOString();

          const createdComment = {
            id: commentId,
            animeId,
            episodeId,
            content: rawContent,
            imageUrl,
            parentId,
            isSpoiler,
            createdAt: nowIso,
            updatedAt: nowIso,
            userId: apiUser.id,
            userName: userNick || apiUser.name || "Usuário",
            userImage: apiUser.image ?? null,
            userNick,
            likes: 0,
            dislikes: 0,
            liked: false,
            disliked: false,
            userReaction: null,
          };

          return Response.json(
            { comment: createdComment },
            { status: 201 },
          );
        } catch (error) {
          console.error("[api/comments] Erro no POST:", error);
          return Response.json(
            { error: "Não foi possível publicar o comentário." },
            { status: 500 },
          );
        }
      },
    },
  },
});
