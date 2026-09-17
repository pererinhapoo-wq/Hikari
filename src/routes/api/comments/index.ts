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

          const animeId =
            url.searchParams.get("animeId");

          const episodeId =
            url.searchParams.get("episodeId");

          if (!animeId || !episodeId) {
            return Response.json(
              {
                error:
                  "animeId e episodeId são obrigatórios.",
              },
              { status: 400 },
            );
          }

          const sql = await getSql();

          // =====================================================
          // BUSCAR COMENTÁRIOS
          // =====================================================

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

          // =====================================================
          // O BANCO PODE RETORNAR:
          //
          // 1. diretamente um array
          //
          // ou
          //
          // 2. { rows: [...] }
          //
          // Aceitamos os dois formatos.
          // =====================================================

          const comments = Array.isArray(result)
            ? result
            : result?.rows ?? [];

          console.log(
            "COMENTÁRIOS ENCONTRADOS:",
            comments.length,
          );

          return Response.json({
            comments,
          });
        } catch (error) {
          console.error(
            "ERRO REAL AO BUSCAR COMENTÁRIOS:",
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
          // =====================================================
          // 1. VERIFICAR USUÁRIO
          // =====================================================

          const session =
            await auth.api.getSession({
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

          console.log(
            "SESSÃO DO COMENTÁRIO:",
            {
              userId:
                session.user.id,
              userName:
                session.user.name,
            },
          );

          // =====================================================
          // 2. LER JSON
          // =====================================================

          const body =
            await request.json();

          const animeId =
            typeof body.animeId ===
            "string"
              ? body.animeId.trim()
              : "";

          const episodeId =
            typeof body.episodeId ===
            "string"
              ? body.episodeId.trim()
              : "";

          const content =
            typeof body.content ===
            "string"
              ? body.content.trim()
              : "";

          const parentId =
            typeof body.parentId ===
              "string" &&
            body.parentId.trim()
              ? body.parentId.trim()
              : null;

          const isSpoiler =
            typeof body.isSpoiler ===
            "boolean"
              ? body.isSpoiler
              : false;

          // =====================================================
          // 3. VALIDAR
          // =====================================================

          if (
            !animeId ||
            !episodeId ||
            !content
          ) {
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

          const sql =
            await getSql();

          // =====================================================
          // 4. VERIFICAR COMENTÁRIO PAI
          // =====================================================

          if (parentId) {
            const parentResult =
              await sql.query(
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

            const parentRows =
              Array.isArray(
                parentResult,
              )
                ? parentResult
                : parentResult?.rows ??
                  [];

            if (
              parentRows.length ===
              0
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
          // 5. GERAR ID
          // =====================================================

          const id =
            crypto.randomUUID();

          // =====================================================
          // 6. SALVAR COMENTÁRIO
          // =====================================================

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
              values (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7
              )
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

          // =====================================================
          // 7. RETORNAR COMENTÁRIO
          // =====================================================

          const now =
            new Date().toISOString();

          const comment = {
            id,
            animeId,
            episodeId,
            content,
            parentId,
            isSpoiler,
            createdAt: now,
            updatedAt: now,
            userId:
              session.user.id,
            userName:
              session.user.name ||
              "Usuário",
            userImage:
              session.user.image ||
              null,
            likes: 0,
            liked: false,
          };

          console.log(
            "COMENTÁRIO CRIADO COM SUCESSO:",
            comment.id,
          );

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
