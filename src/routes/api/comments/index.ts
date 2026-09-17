import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute("/api/comments/")({
  server: {
    handlers: {
      // =========================================================
      // LISTAR COMENTÁRIOS
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
                coalesce(u."name", 'Usuário') as "userName",
                u."image" as "userImage"
              from "comment" c
              left join "user" u
                on u."id" = c."userId"
              where c."animeId" = $1
                and c."episodeId" = $2
              order by c."createdAt" desc
            `,
            [animeId, episodeId],
          );

          return Response.json({
            comments: result?.rows ?? [],
          });
        } catch (error) {
          console.error("ERRO AO BUSCAR COMENTÁRIOS:", error);

          return Response.json(
            {
              error: "Não foi possível carregar os comentários.",
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
          // -----------------------------------------------------
          // 1. Verificar sessão
          // -----------------------------------------------------
          const session = await auth.api.getSession({
            headers: request.headers,
          });

          console.log(
            "SESSÃO DO COMENTÁRIO:",
            session
              ? {
                  userId: session.user?.id,
                  userName: session.user?.name,
                }
              : null,
          );

          if (!session?.user?.id) {
            return Response.json(
              {
                error: "Você precisa estar logado para comentar.",
                code: "NOT_AUTHENTICATED",
              },
              { status: 401 },
            );
          }

          // -----------------------------------------------------
          // 2. Ler JSON
          // -----------------------------------------------------
          let body: Record<string, unknown>;

          try {
            body = await request.json();
          } catch {
            return Response.json(
              {
                error: "O corpo da requisição não é um JSON válido.",
                code: "INVALID_JSON",
              },
              { status: 400 },
            );
          }

          // -----------------------------------------------------
          // 3. Dados
          // -----------------------------------------------------
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

          // -----------------------------------------------------
          // 4. Validação
          // -----------------------------------------------------
          if (!animeId || !episodeId || !content) {
            return Response.json(
              {
                error:
                  "animeId, episodeId e content são obrigatórios.",
                code: "INVALID_DATA",
              },
              { status: 400 },
            );
          }

          if (content.length > 2000) {
            return Response.json(
              {
                error:
                  "O comentário pode ter no máximo 2000 caracteres.",
                code: "CONTENT_TOO_LONG",
              },
              { status: 400 },
            );
          }

          // -----------------------------------------------------
          // 5. Banco
          // -----------------------------------------------------
          const sql = await getSql();

          // -----------------------------------------------------
          // 6. Verificar comentário pai
          // -----------------------------------------------------
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
              [parentId, animeId, episodeId],
            );

            if (!parent?.rows || parent.rows.length === 0) {
              return Response.json(
                {
                  error: "Comentário original não encontrado.",
                  code: "PARENT_NOT_FOUND",
                },
                { status: 400 },
              );
            }
          }

          // -----------------------------------------------------
          // 7. Criar ID e data
          // -----------------------------------------------------
          const id = crypto.randomUUID();
          const createdAt = new Date().toISOString();

          // -----------------------------------------------------
          // 8. SALVAR COMENTÁRIO
          // -----------------------------------------------------
          await sql.query(
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

          console.log(
            "COMENTÁRIO SALVO COM SUCESSO:",
            {
              id,
              userId: session.user.id,
              animeId,
              episodeId,
            },
          );

          // -----------------------------------------------------
          // 9. Montar resposta
          // -----------------------------------------------------
          const comment = {
            id,
            animeId,
            episodeId,
            content,
            parentId,
            isSpoiler,
            createdAt,
            updatedAt: createdAt,
            userId: session.user.id,
            userName: session.user.name || "Usuário",
            userImage: session.user.image || null,
          };

          // -----------------------------------------------------
          // 10. Retornar comentário criado
          // -----------------------------------------------------
          return Response.json(
            {
              comment,
            },
            { status: 201 },
          );
        } catch (error) {
          console.error(
            "ERRO REAL AO CRIAR COMENTÁRIO:",
            error,
          );

          const message =
            error instanceof Error
              ? error.message
              : String(error);

          return Response.json(
            {
              error: "Não foi possível criar o comentário.",
              code: "COMMENT_CREATE_ERROR",
              details: message,
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
