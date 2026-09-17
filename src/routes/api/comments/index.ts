import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute("/api/comments/")({
  server: {
    handlers: {
      // =========================================================
      // LISTAR COMENTÁRIOS DE UM EPISÓDIO
      // =========================================================
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);

          const animeId = url.searchParams.get("animeId");
          const episodeId = url.searchParams.get("episodeId");

          if (!animeId || !episodeId) {
            return Response.json(
              {
                error: "animeId e episodeId são obrigatórios.",
              },
              { status: 400 },
            );
          }

          // Usuário logado é opcional para visualizar comentários.
          let userId: string | null = null;

          try {
            const session = await auth.api.getSession({
              headers: request.headers,
            });

            userId = session?.user?.id ?? null;
          } catch {
            userId = null;
          }

          const sql = await getSql();

          const result = await sql.query(
            `
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
                  where cl."commentId" = c."id"
                ) as "likes",

                exists (
                  select 1
                  from "comment_like" cl2
                  where cl2."commentId" = c."id"
                    and cl2."userId" = $3
                ) as "liked"

              from "comment" c

              left join "user" u
                on u."id" = c."userId"

              where c."animeId" = $1
                and c."episodeId" = $2

              order by c."createdAt" desc
            `,
            [animeId, episodeId, userId],
          );

          return Response.json({
            comments: result.rows,
          });
        } catch (error) {
          console.error(
            "Erro ao buscar comentários:",
            error,
          );

          return Response.json(
            {
              error:
                "Não foi possível carregar os comentários.",
            },
            { status: 500 },
          );
        }
      },

      // =========================================================
      // CRIAR COMENTÁRIO
      // =========================================================
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({
            headers: request.headers,
          });

          if (!session?.user?.id) {
            return Response.json(
              {
                error:
                  "Você precisa estar logado para comentar.",
              },
              { status: 401 },
            );
          }

          const body = await request.json();

          const animeId =
            typeof body.animeId === "string"
              ? body.animeId.trim()
              : "";

          const episodeId =
            typeof body.episodeId === "string"
              ? body.episodeId.trim()
              : "";

          const content =
            typeof body.content === "string"
              ? body.content.trim()
              : "";

          const parentId =
            typeof body.parentId === "string" &&
            body.parentId.trim()
              ? body.parentId.trim()
              : null;

          const isSpoiler =
            typeof body.isSpoiler === "boolean"
              ? body.isSpoiler
              : false;

          if (!animeId || !episodeId || !content) {
            return Response.json(
              {
                error:
                  "animeId, episodeId e content são obrigatórios.",
              },
              { status: 400 },
            );
          }

          if (content.length > 2000) {
            return Response.json(
              {
                error:
                  "O comentário pode ter no máximo 2000 caracteres.",
              },
              { status: 400 },
            );
          }

          const sql = await getSql();

          // =====================================================
          // VERIFICAR COMENTÁRIO PAI
          // =====================================================
          if (parentId) {
            const parent = await sql.query(
              `
                select "id"
                from "comment"
                where "id" = $1
                  and "animeId" = $2
                  and "episodeId" = $3
                limit 1
              `,
              [
                parentId,
                animeId,
                episodeId,
              ],
            );

            if (
              !parent.rows ||
              parent.rows.length === 0
            ) {
              return Response.json(
                {
                  error:
                    "Comentário original não encontrado.",
                },
                { status: 400 },
              );
            }
          }

          // =====================================================
          // CRIAR COMENTÁRIO
          // =====================================================
          const id = crypto.randomUUID();

          const result = await sql.query(
            `
              insert into "comment" (
                "id",
                "userId",
                "animeId",
                "episodeId",
                "content",
                "parentId",
                "isSpoiler"
              )
              values ($1, $2, $3, $4, $5, $6, $7)

              returning
                "id",
                "animeId",
                "episodeId",
                "content",
                "parentId",
                "isSpoiler",
                "createdAt",
                "updatedAt",
                "userId"
            `,
            [
              id,
              session.user.id,
              animeId,
              episodeId,
              content,
              parentId,
              isSpoiler,
            ],
          );

          return Response.json(
            {
              comment: {
                ...result.rows[0],
                userName:
                  session.user.name || "Usuário",
                userImage:
                  session.user.image || null,
                likes: 0,
                liked: false,
              },
            },
            { status: 201 },
          );
        } catch (error) {
          console.error(
            "ERRO REAL AO CRIAR COMENTÁRIO:",
            error,
          );

          return Response.json(
            {
              error:
                "Não foi possível criar o comentário.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
