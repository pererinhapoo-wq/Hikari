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
          const rawCursor = url.searchParams.get("cursor")?.trim();
          const rawLimit = url.searchParams.get("limit")?.trim();
          const rawSortBy = url.searchParams.get("sortBy")?.trim().toLowerCase();
          const targetCommentId = url.searchParams.get("targetCommentId")?.trim();

          if (!animeId) {
            return Response.json(
              { error: "O parâmetro 'animeId' é obrigatório." },
              {
                status: 400,
                headers: {
                  "Cache-Control": "private, no-cache, no-store, must-revalidate",
                },
              },
            );
          }

          const episodeId = rawEpisodeId || undefined;

          // Validação controlada do limite (padrão 25, mínimo 1, máximo 50)
          let limit = 25;
          if (rawLimit) {
            const parsed = parseInt(rawLimit, 10);
            if (Number.isInteger(parsed) && parsed > 0) {
              limit = Math.min(Math.max(1, parsed), 50);
            }
          }

          // Modalidades de ordenação permitidas
          let sortBy: "recent" | "oldest" | "highlight" = "recent";
          if (rawSortBy === "oldest" || rawSortBy === "highlight" || rawSortBy === "recent") {
            sortBy = rawSortBy;
          }

          // Validação e decodificação segura do cursor (Base64 URL-safe com precisão de microssegundos)
          let parsedCursor: {
            v: 1;
            sortBy: "recent" | "oldest";
            createdAt: string;
            id: string;
          } | null = null;

          if (rawCursor) {
            if (sortBy === "highlight") {
              return Response.json(
                {
                  error:
                    "A ordenação por Destaque não suporta paginação por cursor sem persistência de snapshot de sessão. Utilize 'recent' ou 'oldest' para paginação determinística.",
                },
                {
                  status: 400,
                  headers: {
                    "Cache-Control": "private, no-cache, no-store, must-revalidate",
                  },
                },
              );
            }

            try {
              const jsonStr = Buffer.from(rawCursor, "base64url").toString("utf8");
              const data = JSON.parse(jsonStr);

              if (data && typeof data === "object" && data.sortBy === "highlight") {
                return Response.json(
                  {
                    error:
                      "A ordenação por Destaque não suporta paginação por cursor sem persistência de snapshot de sessão. Utilize 'recent' ou 'oldest' para paginação determinística.",
                  },
                  {
                    status: 400,
                    headers: {
                      "Cache-Control": "private, no-cache, no-store, must-revalidate",
                    },
                  },
                );
              }

              if (
                !data ||
                typeof data !== "object" ||
                data.v !== 1 ||
                (data.sortBy !== "recent" && data.sortBy !== "oldest") ||
                typeof data.createdAt !== "string" ||
                !data.createdAt.trim() ||
                typeof data.id !== "string" ||
                !data.id.trim()
              ) {
                return Response.json(
                  { error: "Cursor de paginação inválido ou corrompido." },
                  {
                    status: 400,
                    headers: {
                      "Cache-Control": "private, no-cache, no-store, must-revalidate",
                    },
                  },
                );
              }

              // Valida formato do timestamp ISO UTC
              const dateParsed = new Date(data.createdAt);
              if (Number.isNaN(dateParsed.getTime())) {
                return Response.json(
                  { error: "Timestamp do cursor inválido." },
                  {
                    status: 400,
                    headers: {
                      "Cache-Control": "private, no-cache, no-store, must-revalidate",
                    },
                  },
                );
              }

              parsedCursor = {
                v: 1,
                sortBy: data.sortBy,
                createdAt: data.createdAt.trim(),
                id: data.id.trim(),
              };

              // Se o cursor foi emitido para uma ordenação cronológica específica, o cursor prevalece para manter a consistência do lote
              sortBy = parsedCursor.sortBy;
            } catch {
              return Response.json(
                { error: "Cursor de paginação inválido ou formato Base64 corrompido." },
                {
                  status: 400,
                  headers: {
                    "Cache-Control": "private, no-cache, no-store, must-revalidate",
                  },
                },
              );
            }
          }

          const sql = await getSql();
          const apiUser = await resolveApiUser(request, sql);
          const currentUserId = apiUser?.id ?? null;
          const isAdmin = Boolean(apiUser?.email && isHikariAdmin(apiUser.email));

          // 1. Contagens totais (todos os comentários vs comentários principais)
          const countParams: unknown[] = [animeId];
          let countSql = `
            select
              count(*)::int as "totalCount",
              count(*) filter (where c."parentId" is null)::int as "totalRoots"
            from "comment" c
            where c."animeId" = $1
          `;
          if (episodeId) {
            countSql += ' and c."episodeId" = $2';
            countParams.push(episodeId);
          }
          const countRows: any[] = (await sql.query(countSql, countParams)) as any[];
          const totalCount = Number(countRows[0]?.totalCount) || 0;
          const totalRoots = Number(countRows[0]?.totalRoots) || 0;

          // 2. Localização antecipada de link direto / comentário alvo (targetCommentId)
          let targetFound = false;
          let resolvedTargetRootId: string | null = null;

          if (targetCommentId) {
            const targetChainSql = `
              with recursive target_chain as (
                select c."id", c."parentId", c."animeId", c."episodeId", 1 as "depth", array[c."id"] as "path"
                from "comment" c
                where c."id" = $1
                union all
                select p."id", p."parentId", p."animeId", p."episodeId", tc."depth" + 1 as "depth", tc."path" || p."id" as "path"
                from "comment" p
                inner join target_chain tc on tc."parentId" = p."id"
                where tc."parentId" is not null and not (p."id" = any(tc."path"))
                  and tc."depth" <= 500
              )
              select "id", "parentId", "animeId", "episodeId", "depth"
              from target_chain
              where "parentId" is null or "depth" > 500
              limit 1
            `;
            const targetCheckRows: any[] = (await sql.query(targetChainSql, [targetCommentId])) as any[];
            const rootCandidate = targetCheckRows[0];
            if (rootCandidate && (Number(rootCandidate.depth) || 0) > 500) {
              return Response.json(
                {
                  error:
                    "A cadeia de respostas do comentário alvo excedeu o limite máximo de segurança de 500 níveis. A operação foi interrompida.",
                },
                {
                  status: 500,
                  headers: {
                    "Cache-Control": "private, no-cache, no-store, must-revalidate",
                  },
                },
              );
            }
            if (
              rootCandidate &&
              String(rootCandidate.animeId) === animeId &&
              (!episodeId || String(rootCandidate.episodeId) === episodeId)
            ) {
              targetFound = true;
              resolvedTargetRootId = String(rootCandidate.id);
            } else {
              targetFound = false;
            }
          }

          // 3. Seleção dos comentários principais (parentId IS NULL) aplicando o cursor
          const rootParams: unknown[] = [animeId];
          let paramIndex = 2;
          let episodeFilterC = "";
          let episodeFilterR = "";
          if (episodeId) {
            episodeFilterC = `and c."episodeId" = $${paramIndex}`;
            episodeFilterR = `and r."episodeId" = $${paramIndex}`;
            rootParams.push(episodeId);
            paramIndex++;
          }

          let rootSelectionSql = "";
          const fetchLimit = limit + 1;

          if (sortBy === "highlight") {
            // Lote inicial por Destaque calculado globalmente no banco (hasMore e nextCursor permanecem nulos para integridade)
            rootSelectionSql = `
              with like_counts_root as (
                select
                  cl."commentId",
                  count(*) filter (where cl."type" = 'like' or cl."type" is null)::int as "likes",
                  count(*) filter (where cl."type" = 'dislike')::int as "dislikes"
                from "comment_like" cl
                inner join "comment" c on c."id" = cl."commentId"
                where c."animeId" = $1 ${episodeFilterC} and c."parentId" is null
                group by cl."commentId"
              ),
              reply_counts_root as (
                select
                  r."parentId" as "rootId",
                  count(*)::int as "repliesCount"
                from "comment" r
                where r."animeId" = $1 ${episodeFilterR} and r."parentId" is not null
                group by r."parentId"
              )
              select
                c."id",
                to_char(c."createdAt" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAtIso",
                c."createdAt",
                (coalesce(lc."likes", 0) * 2 + coalesce(rc."repliesCount", 0) - coalesce(lc."dislikes", 0)) as "highlightScore"
              from "comment" c
              left join like_counts_root lc on lc."commentId" = c."id"
              left join reply_counts_root rc on rc."rootId" = c."id"
              where c."animeId" = $1
                ${episodeFilterC}
                and c."parentId" is null
              order by "highlightScore" desc, c."createdAt" desc, c."id" desc
              limit ${limit}
            `;
          } else {
            // Modos cronológicos determinísticos (recent / oldest) com cursor por tupla composta (createdAt, id)
            const isOldest = (parsedCursor ? parsedCursor.sortBy : sortBy) === "oldest";
            const orderDirection = isOldest ? "asc" : "desc";
            const comparator = isOldest ? ">" : "<";

            let cursorClause = "";
            if (parsedCursor) {
              cursorClause = `and (c."createdAt", c."id") ${comparator} ($${paramIndex}::timestamptz, $${paramIndex + 1})`;
              rootParams.push(parsedCursor.createdAt);
              rootParams.push(parsedCursor.id);
              paramIndex += 2;
            }

            rootSelectionSql = `
              select
                c."id",
                to_char(c."createdAt" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAtIso",
                c."createdAt"
              from "comment" c
              where c."animeId" = $1
                ${episodeFilterC}
                and c."parentId" is null
                ${cursorClause}
              order by c."createdAt" ${orderDirection}, c."id" ${orderDirection}
              limit ${fetchLimit}
            `;
          }

          const rootResult: any[] = (await sql.query(rootSelectionSql, rootParams)) as any[];
          const hasMore = sortBy === "highlight" ? false : rootResult.length > limit;
          const pagedRoots =
            sortBy === "highlight"
              ? rootResult.slice(0, limit)
              : hasMore
                ? rootResult.slice(0, limit)
                : rootResult;

          let nextCursor: string | null = null;
          if (sortBy !== "highlight" && hasMore && pagedRoots.length > 0) {
            const lastRoot = pagedRoots[pagedRoots.length - 1];
            const effectiveSortBy: "recent" | "oldest" =
              (parsedCursor ? parsedCursor.sortBy : sortBy) === "oldest" ? "oldest" : "recent";
            const cursorPayload = {
              v: 1,
              sortBy: effectiveSortBy,
              createdAt: String(lastRoot.createdAtIso),
              id: String(lastRoot.id),
            };
            nextCursor = Buffer.from(JSON.stringify(cursorPayload)).toString("base64url");
          }

          // 4. Agrupamento dos IDs dos comentários-raiz a serem recuperados com suas respostas
          const rootIdSet = new Set<string>(pagedRoots.map((r) => String(r.id)));

          // Se targetCommentId foi localizado mas sua raiz não está no lote atual, adiciona a raiz para recuperar a thread completa
          if (targetFound && resolvedTargetRootId && !rootIdSet.has(resolvedTargetRootId)) {
            rootIdSet.add(resolvedTargetRootId);
          }

          const allRootIds = Array.from(rootIdSet);

          // Se não há nenhum comentário-raiz selecionado, retorna lista vazia
          if (allRootIds.length === 0) {
            return Response.json(
              {
                comments: [],
                nextCursor: null,
                hasMore: false,
                totalCount,
                totalRoots,
                targetFound,
                currentUserId,
                isAdmin,
              },
              {
                headers: {
                  "Cache-Control": "private, no-cache, no-store, must-revalidate",
                },
              },
            );
          }

          // 5. Recuperação recursiva de todas as respostas associadas aos comentários-raiz selecionados
          const threadHierarchySql = `
            with recursive root_ids as (
              select r."id", r."ord"::int as "root_order"
              from unnest($1::text[]) with ordinality as r("id", "ord")
            ),
            thread_hierarchy as (
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
                1 as "depth",
                array[c."id"] as "path",
                r."root_order" as "root_order"
              from "comment" c
              inner join root_ids r on r."id" = c."id"

              union all

              select
                child."id",
                child."animeId",
                child."episodeId",
                child."content",
                child."imageUrl",
                child."parentId",
                child."isSpoiler",
                child."createdAt",
                to_char(child."createdAt" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAtIso",
                child."updatedAt",
                to_char(child."updatedAt" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "updatedAtIso",
                child."userId",
                parent."depth" + 1 as "depth",
                parent."path" || child."id" as "path",
                parent."root_order" as "root_order"
              from "comment" child
              inner join thread_hierarchy parent on child."parentId" = parent."id"
              where not (child."id" = any(parent."path"))
                and parent."depth" <= 500
            ),
            like_counts as (
              select
                cl."commentId",
                count(*) filter (where cl."type" = 'like' or cl."type" is null)::int as "likes",
                count(*) filter (where cl."type" = 'dislike')::int as "dislikes"
              from "comment_like" cl
              inner join thread_hierarchy th on th."id" = cl."commentId"
              group by cl."commentId"
            )
            select
              th."id",
              th."animeId",
              th."episodeId",
              th."content",
              th."imageUrl",
              th."parentId",
              th."isSpoiler",
              th."createdAt",
              th."createdAtIso",
              th."updatedAt",
              th."updatedAtIso",
              th."userId",
              th."depth",
              coalesce(p."nick", u."name", 'Usuário') as "userName",
              u."image" as "userImage",
              p."nick" as "userNick",
              coalesce(lc."likes", 0)::int as "likes",
              coalesce(lc."dislikes", 0)::int as "dislikes",
              case
                when $2::text is not null and (my_cl."type" = 'like' or (my_cl."type" is null and my_cl."id" is not null)) then true
                else false
              end as "liked",
              case
                when $2::text is not null and my_cl."type" = 'dislike' then true
                else false
              end as "disliked",
              case
                when $2::text is null then null
                when my_cl."type" = 'dislike' then 'dislike'
                when my_cl."type" = 'like' or (my_cl."type" is null and my_cl."id" is not null) then 'like'
                else null
              end as "userReaction"
            from thread_hierarchy th
            left join "user" u on u."id" = th."userId"
            left join "profile" p on p."userId" = th."userId"
            left join like_counts lc on lc."commentId" = th."id"
            left join "comment_like" my_cl
              on my_cl."commentId" = th."id"
              and $2::text is not null
              and my_cl."userId" = $2
            order by th."root_order" asc, th."createdAt" asc
          `;

          const rawRows = await sql.query(threadHierarchySql, [allRootIds, currentUserId]);
          const rows: any[] = Array.isArray(rawRows)
            ? rawRows
            : (rawRows as any)?.rows ?? [];

          // Se a hierarquia ultrapassou o limite máximo de segurança (500 níveis),
          // NUNCA descarta silenciosamente as respostas além do limite apresentando uma árvore
          // incompleta como se estivesse completa. Retorna erro explícito 500 com diagnóstico.
          const depthExceeded = rows.some((row) => (Number(row.depth) || 0) > 500);
          if (depthExceeded) {
            return Response.json(
              {
                error:
                  "A hierarquia de respostas excedeu o limite máximo de segurança de 500 níveis. A operação foi interrompida para evitar consumo excessivo de recursos e nunca apresentar uma árvore incompleta como íntegra.",
              },
              {
                status: 500,
                headers: {
                  "Cache-Control": "private, no-cache, no-store, must-revalidate",
                },
              },
            );
          }

          const comments = rows.map((row) => ({
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
              comments,
              nextCursor,
              hasMore,
              totalCount,
              totalRoots,
              targetFound,
              currentUserId,
              isAdmin,
            },
            {
              headers: {
                "Cache-Control": "private, no-cache, no-store, must-revalidate",
              },
            },
          );
        } catch (error: any) {
          console.error("[api/comments] Erro no GET:", error);
          const errorMsg = String(error?.message || error || "").toLowerCase();
          const isTimeout =
            errorMsg.includes("timeout") ||
            errorMsg.includes("canceling statement") ||
            errorMsg.includes("statement_timeout") ||
            errorMsg.includes("query_canceled") ||
            error?.code === "57014";

          if (isTimeout) {
            return Response.json(
              {
                error:
                  "Tempo limite da consulta excedido ao recuperar a hierarquia de comentários. A discussão pode ser extensa demais para carregar em uma única operação.",
              },
              {
                status: 504,
                headers: {
                  "Cache-Control": "private, no-cache, no-store, must-revalidate",
                },
              },
            );
          }

          return Response.json(
            { error: "Não foi possível carregar os comentários." },
            {
              status: 500,
              headers: {
                "Cache-Control": "private, no-cache, no-store, must-revalidate",
              },
            },
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
          let parentAuthorId: string | null = null;
          if (parentId) {
            const parentCheck = await sql.query(
              `
                select "id", "userId", "animeId", "episodeId"
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

            parentAuthorId = parent.userId ? String(parent.userId) : null;
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
            ? String(profileRows[0].nick).trim() || null
            : null;

          const resolvedAuthorName = userNick || apiUser.name || "Usuário";

          // Gera notificação para o autor do comentário respondido (nunca auto-notificação)
          if (parentId && parentAuthorId && parentAuthorId !== apiUser.id) {
            try {
              const notificationId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
              const replyMessage = `${resolvedAuthorName} respondeu ao seu comentário.`;

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
                    'comment_reply',
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
                  parentAuthorId,
                  apiUser.id,
                  replyMessage,
                  commentId,
                  animeId,
                  episodeId,
                ],
              );
            } catch (notifError) {
              console.error(
                "[api/comments] Erro ao criar notificação de resposta:",
                notifError,
              );
            }
          } else if (!parentId && rawContent) {
            // Se houver menção direta (@nick) em comentário principal, notifica o usuário mencionado
            const mentionMatches = Array.from(
              String(rawContent).matchAll(/(?:^|\s)@([a-z0-9_]{3,30})\b/gi),
            );
            const mentionedNicks: string[] = Array.from(
              new Set<string>(
                mentionMatches
                  .map((m) => (m[1] ? m[1].toLowerCase() : ""))
                  .filter(Boolean),
              ),
            ).slice(0, 3);

            if (mentionedNicks.length > 0) {
              try {
                const mentionedResult = await sql.query(
                  `
                    select distinct p."userId"
                    from "profile" p
                    where lower(p."nick") = any($1::text[])
                      and p."userId" <> $2
                  `,
                  [mentionedNicks, apiUser.id],
                );
                const mentionedRows: any[] = Array.isArray(mentionedResult)
                  ? mentionedResult
                  : (mentionedResult as any)?.rows ?? [];

                for (const row of mentionedRows) {
                  const targetUserId = row?.userId ? String(row.userId) : "";
                  if (!targetUserId) continue;

                  const notificationId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                  const commentMessage = `${resolvedAuthorName} mencionou você em um comentário.`;

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
                        'comment',
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
                      targetUserId,
                      apiUser.id,
                      commentMessage,
                      commentId,
                      animeId,
                      episodeId,
                    ],
                  );
                }
              } catch (mentionError) {
                console.error(
                  "[api/comments] Erro ao criar notificação de comentário:",
                  mentionError,
                );
              }
            }
          }

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
            userName: resolvedAuthorName,
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
