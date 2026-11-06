import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  createProfileListSchema,
  updateProfileListSchema,
  deleteProfileListSchema,
  getMyProfileListsSchema,
  getProfileListDetailsSchema,
  addAnimeToProfileListSchema,
  removeAnimeFromProfileListSchema,
  reorderProfileListItemsSchema,
  type ProfileListRecord,
  type ProfileListSummary,
  type ProfileListItem,
  type ProfileListDetails,
  type AnimeSnapshot,
} from "@/types/profile-list";

/**
 * Middleware para operações que podem ser acessadas publicamente ou pelo proprietário.
 * Se o visitante estiver autenticado, disponibiliza context.userId para validação
 * de propriedade em listas privadas ("isPublic = false").
 */
export const optionalAuthMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({
      sendContext: { bearerToken: getBearerToken() ?? undefined },
    });
  })
  .server(async ({ next, context }) => {
    let userId: string | null = null;
    try {
      const { getSessionUser, authConfigured, DEV_USER_ID } = await import(
        "@/lib/auth/verify.server"
      );
      const user = await getSessionUser(context.bearerToken);
      if (user) {
        userId = user.id;
      } else if (
        !authConfigured &&
        process.env.VITE_AUTH_ENABLED === "false" &&
        !process.env.DATABASE_URL?.trim()
      ) {
        userId = DEV_USER_ID;
      }
    } catch {
      userId = null;
    }
    return next({ context: { userId } });
  });

/**
 * Normaliza e constrói o snapshot de exibição do anime.
 * Se o anime existir no catálogo canônico ("catalog_anime"), mescla com os metadados oficiais.
 * Se for anime local ("local-*") ou externo, preserva o snapshot recebido do cliente.
 */
function buildAnimeSnapshot(
  catalogRow: {
    title: string;
    titleRomaji: string | null;
    titleEnglish: string | null;
    titleNative: string | null;
    cover: string | null;
    banner: string | null;
    format: string | null;
    year: number | null;
    episodesCount: number | null;
    status: string | null;
  } | null,
  inputSnapshot?: AnimeSnapshot | null,
): AnimeSnapshot {
  return {
    title: catalogRow?.title ?? inputSnapshot?.title?.trim() ?? "Sem título",
    titleRomaji:
      catalogRow?.titleRomaji ?? inputSnapshot?.titleRomaji?.trim() ?? null,
    titleEnglish:
      catalogRow?.titleEnglish ?? inputSnapshot?.titleEnglish?.trim() ?? null,
    titleNative:
      catalogRow?.titleNative ?? inputSnapshot?.titleNative?.trim() ?? null,
    cover: catalogRow?.cover ?? inputSnapshot?.cover?.trim() ?? null,
    banner: catalogRow?.banner ?? inputSnapshot?.banner?.trim() ?? null,
    format: catalogRow?.format ?? inputSnapshot?.format?.trim() ?? null,
    year:
      catalogRow?.year !== undefined && catalogRow?.year !== null
        ? Number(catalogRow.year)
        : inputSnapshot?.year !== undefined && inputSnapshot?.year !== null
          ? Number(inputSnapshot.year)
          : null,
    episodesCount:
      catalogRow?.episodesCount !== undefined &&
      catalogRow?.episodesCount !== null
        ? Number(catalogRow.episodesCount)
        : inputSnapshot?.episodesCount !== undefined &&
            inputSnapshot?.episodesCount !== null
          ? Number(inputSnapshot.episodesCount)
          : null,
    status: catalogRow?.status ?? inputSnapshot?.status?.trim() ?? null,
    score:
      inputSnapshot?.score !== undefined && inputSnapshot?.score !== null
        ? Number(inputSnapshot.score)
        : null,
  };
}

/**
 * 1. createProfileList — Criar nova lista personalizada.
 * Operação privada vinculada exclusivamente ao usuário autenticado (context.userId).
 */
export const createProfileList = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(createProfileListSchema)
  .handler(async ({ context, data }): Promise<ProfileListRecord> => {
    const userId = context.userId;
    const title = data.title.trim();
    const description = data.description ? data.description.trim() : null;
    const isPublic = data.isPublic ?? true;
    const listId = crypto.randomUUID();

    const sql = await getSql();

    const insertQuery = `
      INSERT INTO "user_custom_list" (
        "id", "userId", "title", "description", "isPublic", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING "id", "userId", "title", "description", "isPublic", "createdAt", "updatedAt";
    `;

    const insertedRows = await sql.query<ProfileListRecord>(insertQuery, [
      listId,
      userId,
      title,
      description,
      isPublic,
    ]);

    const created = insertedRows[0];
    if (!created) {
      throw new Error("Não foi possível criar a lista.");
    }

    return {
      id: created.id,
      userId: created.userId,
      title: created.title,
      description: created.description ?? null,
      isPublic: Boolean(created.isPublic),
      createdAt: String(created.createdAt),
      updatedAt: String(created.updatedAt),
    };
  });

/**
 * 2. updateProfileList — Editar título, descrição e visibilidade da lista.
 * Verifica a propriedade da lista de forma atômica com bloqueio de linha ("user_custom_list FOR UPDATE").
 */
export const updateProfileList = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(updateProfileListSchema)
  .handler(async ({ context, data }): Promise<ProfileListRecord> => {
    const userId = context.userId;
    const { listId, title, description, isPublic } = data;

    const sql = await getSql();

    // 1. Atualização atômica apenas se a lista pertencer ao context.userId
    const updateQuery = `
      WITH list_lock AS (
        SELECT "id" FROM "user_custom_list"
        WHERE "id" = $1 AND "userId" = $2
        FOR UPDATE
      )
      UPDATE "user_custom_list" ucl
      SET
        "title" = CASE WHEN $3::text IS NOT NULL THEN $3::text ELSE ucl."title" END,
        "description" = CASE WHEN $4::boolean = true THEN $5::text ELSE ucl."description" END,
        "isPublic" = CASE WHEN $6::boolean IS NOT NULL THEN $6::boolean ELSE ucl."isPublic" END,
        "updatedAt" = CURRENT_TIMESTAMP
      FROM list_lock ll
      WHERE ucl."id" = ll."id"
      RETURNING ucl."id", ucl."userId", ucl."title", ucl."description", ucl."isPublic", ucl."createdAt", ucl."updatedAt";
    `;

    const titleParam = title !== undefined ? title.trim() : null;
    const hasDescriptionParam = description !== undefined;
    const descriptionParam =
      description !== undefined && description !== null
        ? description.trim()
        : null;
    const isPublicParam = isPublic !== undefined ? isPublic : null;

    const updatedRows = await sql.query<ProfileListRecord>(updateQuery, [
      listId,
      userId,
      titleParam,
      hasDescriptionParam,
      descriptionParam,
      isPublicParam,
    ]);

    const updated = updatedRows[0];
    if (!updated) {
      // Diagnóstico detalhado: lista inexistente vs permissão negada
      const existing = await sql.query<{ id: string; userId: string }>(
        `SELECT "id", "userId" FROM "user_custom_list" WHERE "id" = $1 LIMIT 1`,
        [listId],
      );

      if (existing.length === 0) {
        throw new Error("Lista não encontrada.");
      }
      throw new Error("Você não tem permissão para editar esta lista.");
    }

    return {
      id: updated.id,
      userId: updated.userId,
      title: updated.title,
      description: updated.description ?? null,
      isPublic: Boolean(updated.isPublic),
      createdAt: String(updated.createdAt),
      updatedAt: String(updated.updatedAt),
    };
  });

/**
 * 3. deleteProfileList — Excluir lista personalizada.
 * Respeita a restrição ON DELETE CASCADE da Migration 0021 para limpar itens automaticamente.
 */
export const deleteProfileList = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(deleteProfileListSchema)
  .handler(
    async ({
      context,
      data,
    }): Promise<{ success: boolean; deletedId: string }> => {
      const userId = context.userId;
      const { listId } = data;

      const sql = await getSql();

      const deleteQuery = `
      DELETE FROM "user_custom_list"
      WHERE "id" = $1 AND "userId" = $2
      RETURNING "id";
    `;

      const deletedRows = await sql.query<{ id: string }>(deleteQuery, [
        listId,
        userId,
      ]);

      if (deletedRows.length === 0) {
        const existing = await sql.query<{ id: string; userId: string }>(
          `SELECT "id", "userId" FROM "user_custom_list" WHERE "id" = $1 LIMIT 1`,
          [listId],
        );

        if (existing.length === 0) {
          throw new Error("Lista não encontrada.");
        }
        throw new Error("Você não tem permissão para excluir esta lista.");
      }

      return {
        success: true,
        deletedId: listId,
      };
    },
  );

/**
 * 4. getMyProfileLists — Consultar listas do usuário autenticado.
 * Retorna resumos com contagem de animes e miniaturas prévias para visualização.
 */
export const getMyProfileLists = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .validator(getMyProfileListsSchema)
  .handler(async ({ context }): Promise<ProfileListSummary[]> => {
    const userId = context.userId;
    const sql = await getSql();

    const query = `
      SELECT
        ucl."id",
        ucl."userId",
        ucl."title",
        ucl."description",
        ucl."isPublic",
        ucl."createdAt",
        ucl."updatedAt",
        COUNT(ucli."animeId")::int AS "itemCount",
        (
          SELECT json_agg(sub.cover)
          FROM (
            SELECT COALESCE(ca."cover", (sub_item."animeSnapshot"->>'cover')) AS cover
            FROM "user_custom_list_item" sub_item
            LEFT JOIN "catalog_anime" ca ON ca."id" = sub_item."animeId"
            WHERE sub_item."listId" = ucl."id"
              AND COALESCE(ca."cover", (sub_item."animeSnapshot"->>'cover')) IS NOT NULL
            ORDER BY sub_item."position" ASC
            LIMIT 4
          ) sub
        ) AS "sampleCovers"
      FROM "user_custom_list" ucl
      LEFT JOIN "user_custom_list_item" ucli ON ucli."listId" = ucl."id"
      WHERE ucl."userId" = $1
      GROUP BY ucl."id"
      ORDER BY ucl."updatedAt" DESC;
    `;

    const rows = await sql.query<{
      id: string;
      userId: string;
      title: string;
      description: string | null;
      isPublic: boolean;
      createdAt: string;
      updatedAt: string;
      itemCount: number;
      sampleCovers: unknown;
    }>(query, [userId]);

    return rows.map((row) => {
      let sampleCovers: string[] = [];
      if (Array.isArray(row.sampleCovers)) {
        sampleCovers = row.sampleCovers.filter(
          (c): c is string => typeof c === "string",
        );
      } else if (typeof row.sampleCovers === "string") {
        try {
          const parsed = JSON.parse(row.sampleCovers);
          if (Array.isArray(parsed)) {
            sampleCovers = parsed.filter(
              (c): c is string => typeof c === "string",
            );
          }
        } catch {
          sampleCovers = [];
        }
      }

      return {
        id: row.id,
        userId: row.userId,
        title: row.title,
        description: row.description ?? null,
        isPublic: Boolean(row.isPublic),
        itemCount: Number(row.itemCount) || 0,
        sampleCovers,
        createdAt: String(row.createdAt),
        updatedAt: String(row.updatedAt),
      };
    });
  });

/**
 * 5. getProfileListDetails — Consultar detalhes de uma lista e seus animes.
 * Respeita a visibilidade: se "isPublic = false", apenas o proprietário pode visualizar.
 */
export const getProfileListDetails = createServerFn({
  method: "GET",
})
  .middleware([optionalAuthMiddleware])
  .validator(getProfileListDetailsSchema)
  .handler(async ({ context, data }): Promise<ProfileListDetails> => {
    const viewerId = context?.userId ?? null;
    const { listId } = data;

    const sql = await getSql();

    // 1. Consulta metadados da lista e dados do criador
    const listQuery = `
      SELECT
        ucl."id",
        ucl."userId",
        ucl."title",
        ucl."description",
        ucl."isPublic",
        ucl."createdAt",
        ucl."updatedAt",
        u."name" AS "ownerName",
        u."image" AS "ownerImage",
        p."nick" AS "ownerNick",
        (
          SELECT count(*)::int
          FROM "user_custom_list_item"
          WHERE "listId" = ucl."id"
        ) AS "itemCount"
      FROM "user_custom_list" ucl
      LEFT JOIN "user" u ON u."id" = ucl."userId"
      LEFT JOIN "profile" p ON p."userId" = ucl."userId"
      WHERE ucl."id" = $1
      LIMIT 1;
    `;

    const listRows = await sql.query<{
      id: string;
      userId: string;
      title: string;
      description: string | null;
      isPublic: boolean;
      createdAt: string;
      updatedAt: string;
      ownerName: string | null;
      ownerImage: string | null;
      ownerNick: string | null;
      itemCount: number;
    }>(listQuery, [listId]);

    const listRow = listRows[0];
    if (!listRow) {
      throw new Error("Lista não encontrada.");
    }

    const isOwner = Boolean(viewerId && viewerId === listRow.userId);

    // Validação estrita de privacidade: lista privada só é acessível pelo proprietário
    if (!listRow.isPublic && !isOwner) {
      throw new Error("Esta lista é privada.");
    }

    // 2. Consulta itens ordenados com dados canônicos do catálogo
    const itemsQuery = `
      SELECT
        ucli."listId",
        ucli."animeId",
        ucli."position",
        ucli."animeSnapshot",
        ucli."addedAt",
        ca."title" AS "catalogTitle",
        ca."titleRomaji" AS "catalogTitleRomaji",
        ca."titleEnglish" AS "catalogTitleEnglish",
        ca."titleNative" AS "catalogTitleNative",
        ca."cover" AS "catalogCover",
        ca."banner" AS "catalogBanner",
        ca."format" AS "catalogFormat",
        ca."year" AS "catalogYear",
        ca."episodesCount" AS "catalogEpisodesCount",
        ca."status" AS "catalogStatus"
      FROM "user_custom_list_item" ucli
      LEFT JOIN "catalog_anime" ca ON ca."id" = ucli."animeId"
      WHERE ucli."listId" = $1
      ORDER BY ucli."position" ASC, ucli."addedAt" ASC;
    `;

    const itemRows = await sql.query<{
      listId: string;
      animeId: string;
      position: number;
      animeSnapshot: unknown;
      addedAt: string;
      catalogTitle: string | null;
      catalogTitleRomaji: string | null;
      catalogTitleEnglish: string | null;
      catalogTitleNative: string | null;
      catalogCover: string | null;
      catalogBanner: string | null;
      catalogFormat: string | null;
      catalogYear: number | null;
      catalogEpisodesCount: number | null;
      catalogStatus: string | null;
    }>(itemsQuery, [listId]);

    const items: ProfileListItem[] = itemRows.map((row) => {
      let snapshotObj: AnimeSnapshot | null = null;
      if (
        row.animeSnapshot &&
        typeof row.animeSnapshot === "object" &&
        !Array.isArray(row.animeSnapshot)
      ) {
        snapshotObj = row.animeSnapshot as AnimeSnapshot;
      } else if (typeof row.animeSnapshot === "string") {
        try {
          snapshotObj = JSON.parse(row.animeSnapshot) as AnimeSnapshot;
        } catch {
          snapshotObj = null;
        }
      }

      const title =
        row.catalogTitle ||
        (typeof snapshotObj?.title === "string" ? snapshotObj.title : null) ||
        "Sem título";

      const cover =
        row.catalogCover ||
        (typeof snapshotObj?.cover === "string" ? snapshotObj.cover : null);

      const banner =
        row.catalogBanner ||
        (typeof snapshotObj?.banner === "string" ? snapshotObj.banner : null);

      const format =
        row.catalogFormat ||
        (typeof snapshotObj?.format === "string" ? snapshotObj.format : null);

      const year =
        row.catalogYear !== null && row.catalogYear !== undefined
          ? Number(row.catalogYear)
          : typeof snapshotObj?.year === "number"
            ? snapshotObj.year
            : null;

      const episodesCount =
        row.catalogEpisodesCount !== null &&
        row.catalogEpisodesCount !== undefined
          ? Number(row.catalogEpisodesCount)
          : typeof snapshotObj?.episodesCount === "number"
            ? snapshotObj.episodesCount
            : null;

      const status =
        row.catalogStatus ||
        (typeof snapshotObj?.status === "string" ? snapshotObj.status : null);

      const score =
        typeof snapshotObj?.score === "number"
          ? snapshotObj.score
          : typeof snapshotObj?.score === "string"
            ? Number(snapshotObj.score) || null
            : null;

      return {
        listId: row.listId,
        animeId: row.animeId,
        position: Number(row.position),
        addedAt: String(row.addedAt),
        title,
        titleRomaji:
          row.catalogTitleRomaji ||
          (typeof snapshotObj?.titleRomaji === "string"
            ? snapshotObj.titleRomaji
            : null),
        titleEnglish:
          row.catalogTitleEnglish ||
          (typeof snapshotObj?.titleEnglish === "string"
            ? snapshotObj.titleEnglish
            : null),
        titleNative:
          row.catalogTitleNative ||
          (typeof snapshotObj?.titleNative === "string"
            ? snapshotObj.titleNative
            : null),
        cover,
        banner,
        format,
        year,
        episodesCount,
        status,
        score,
        animeSnapshot: snapshotObj,
      };
    });

    return {
      list: {
        id: listRow.id,
        userId: listRow.userId,
        title: listRow.title,
        description: listRow.description ?? null,
        isPublic: Boolean(listRow.isPublic),
        createdAt: String(listRow.createdAt),
        updatedAt: String(listRow.updatedAt),
        itemCount: Number(listRow.itemCount) || 0,
        isOwner,
        ownerNick: listRow.ownerNick ?? null,
        ownerName: listRow.ownerName ?? "Usuário",
        ownerImage: listRow.ownerImage ?? null,
      },
      items,
    };
  });

/**
 * 6. addAnimeToProfileList — Adicionar anime à lista personalizada.
 * Serializa adições com lock na linha da lista ("user_custom_list FOR UPDATE"),
 * calcula a próxima posição de forma atômica e rejeita duplicatas.
 */
export const addAnimeToProfileList = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(addAnimeToProfileListSchema)
  .handler(async ({ context, data }): Promise<ProfileListItem> => {
    const userId = context.userId;
    const { listId, animeId, animeSnapshot } = data;

    const sql = await getSql();

    // 1. Validação de propriedade e existência da lista
    const listCheck = await sql.query<{ id: string; userId: string }>(
      `SELECT "id", "userId" FROM "user_custom_list" WHERE "id" = $1 LIMIT 1`,
      [listId],
    );

    if (listCheck.length === 0) {
      throw new Error("Lista não encontrada.");
    }
    if (listCheck[0].userId !== userId) {
      throw new Error("Você não tem permissão para modificar esta lista.");
    }

    // 2. Validação rápida de duplicata
    const duplicateCheck = await sql.query<{ animeId: string }>(
      `SELECT "animeId" FROM "user_custom_list_item" WHERE "listId" = $1 AND "animeId" = $2 LIMIT 1`,
      [listId, animeId],
    );

    if (duplicateCheck.length > 0) {
      throw new Error("Este anime já está nesta lista.");
    }

    // 3. Consulta catálogo oficial (se existir) para complementar snapshot
    const catalogRows = await sql.query<{
      title: string;
      titleRomaji: string | null;
      titleEnglish: string | null;
      titleNative: string | null;
      cover: string | null;
      banner: string | null;
      format: string | null;
      year: number | null;
      episodesCount: number | null;
      status: string | null;
    }>(
      `SELECT "title", "titleRomaji", "titleEnglish", "titleNative", "cover", "banner", "format", "year", "episodesCount", "status"
       FROM "catalog_anime" WHERE "id" = $1 LIMIT 1`,
      [animeId],
    );

    const catalogRow = catalogRows[0] ?? null;
    const cleanSnapshot = buildAnimeSnapshot(catalogRow, animeSnapshot);

    // 4. Inserção atômica com bloqueio da lista e cálculo da próxima posição
    const insertQuery = `
      WITH list_lock AS (
        SELECT "id" FROM "user_custom_list"
        WHERE "id" = $1 AND "userId" = $2
        FOR UPDATE
      ),
      next_pos AS (
        SELECT COALESCE(MAX("position"), -1) + 1 AS pos
        FROM "user_custom_list_item"
        WHERE "listId" = $1
      )
      INSERT INTO "user_custom_list_item" (
        "listId", "animeId", "position", "animeSnapshot", "addedAt"
      )
      SELECT ll."id", $3, np.pos, $4::jsonb, CURRENT_TIMESTAMP
      FROM list_lock ll
      CROSS JOIN next_pos np
      RETURNING "listId", "animeId", "position", "animeSnapshot", "addedAt";
    `;

    try {
      const insertedRows = await sql.query<{
        listId: string;
        animeId: string;
        position: number;
        animeSnapshot: unknown;
        addedAt: string;
      }>(insertQuery, [
        listId,
        userId,
        animeId,
        JSON.stringify(cleanSnapshot),
      ]);

      const inserted = insertedRows[0];
      if (!inserted) {
        throw new Error(
          "Não foi possível adicionar o anime à lista. Verifique as permissões.",
        );
      }

      // Atualiza o updatedAt da lista mãe
      await sql.query(
        `UPDATE "user_custom_list" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
        [listId],
      );

      return {
        listId: inserted.listId,
        animeId: inserted.animeId,
        position: Number(inserted.position),
        addedAt: String(inserted.addedAt),
        title: String(cleanSnapshot.title ?? "Sem título"),
        titleRomaji: cleanSnapshot.titleRomaji
          ? String(cleanSnapshot.titleRomaji)
          : null,
        titleEnglish: cleanSnapshot.titleEnglish
          ? String(cleanSnapshot.titleEnglish)
          : null,
        titleNative: cleanSnapshot.titleNative
          ? String(cleanSnapshot.titleNative)
          : null,
        cover: cleanSnapshot.cover ? String(cleanSnapshot.cover) : null,
        banner: cleanSnapshot.banner ? String(cleanSnapshot.banner) : null,
        format: cleanSnapshot.format ? String(cleanSnapshot.format) : null,
        year:
          cleanSnapshot.year !== null && cleanSnapshot.year !== undefined
            ? Number(cleanSnapshot.year)
            : null,
        episodesCount:
          cleanSnapshot.episodesCount !== null &&
          cleanSnapshot.episodesCount !== undefined
            ? Number(cleanSnapshot.episodesCount)
            : null,
        status: cleanSnapshot.status ? String(cleanSnapshot.status) : null,
        score:
          cleanSnapshot.score !== null && cleanSnapshot.score !== undefined
            ? Number(cleanSnapshot.score)
            : null,
        animeSnapshot: cleanSnapshot,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("user_custom_list_item_pkey") ||
        message.includes("unique constraint") ||
        message.includes("duplicate key")
      ) {
        throw new Error("Este anime já está nesta lista.");
      }
      throw err;
    }
  });

/**
 * 7. removeAnimeFromProfileList — Remover anime de uma lista personalizada.
 * Operação atômica que garante que apenas o proprietário da lista pode remover itens.
 */
export const removeAnimeFromProfileList = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(removeAnimeFromProfileListSchema)
  .handler(
    async ({
      context,
      data,
    }): Promise<{
      success: boolean;
      listId: string;
      removedAnimeId: string;
    }> => {
      const userId = context.userId;
      const { listId, animeId } = data;

      const sql = await getSql();

      const deleteQuery = `
      WITH list_lock AS (
        SELECT "id" FROM "user_custom_list"
        WHERE "id" = $1 AND "userId" = $2
        FOR UPDATE
      )
      DELETE FROM "user_custom_list_item" ucli
      USING list_lock ll
      WHERE ucli."listId" = ll."id"
        AND ucli."animeId" = $3
      RETURNING ucli."animeId", ucli."position";
    `;

      const deletedRows = await sql.query<{
        animeId: string;
        position: number;
      }>(deleteQuery, [listId, userId, animeId]);

      if (deletedRows.length === 0) {
        const listCheck = await sql.query<{ id: string; userId: string }>(
          `SELECT "id", "userId" FROM "user_custom_list" WHERE "id" = $1 LIMIT 1`,
          [listId],
        );

        if (listCheck.length === 0) {
          throw new Error("Lista não encontrada.");
        }
        if (listCheck[0].userId !== userId) {
          throw new Error("Você não tem permissão para modificar esta lista.");
        }
        throw new Error("Anime não encontrado nesta lista.");
      }

      // Atualiza o updatedAt da lista mãe
      await sql.query(
        `UPDATE "user_custom_list" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
        [listId],
      );

      return {
        success: true,
        listId,
        removedAnimeId: animeId,
      };
    },
  );

/**
 * 8. reorderProfileListItems — Reordenar animes de uma lista personalizada.
 * Validação rigorosa de todos os IDs informados (sem duplicatas, sem omissões e sem itens
 * de outras listas) e atualização atômica de posições sob bloqueio da linha da lista.
 */
export const reorderProfileListItems = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(reorderProfileListItemsSchema)
  .handler(
    async ({
      context,
      data,
    }): Promise<{
      success: boolean;
      listId: string;
      updatedCount: number;
    }> => {
      const userId = context.userId;
      const { listId, orderedAnimeIds } = data;

      // 1. Pré-validação em memória para rejeitar IDs duplicados
      const uniqueIds = new Set(orderedAnimeIds);
      if (uniqueIds.size !== orderedAnimeIds.length) {
        throw new Error("A lista de reordenação contém IDs duplicados.");
      }

      const sql = await getSql();

      // Caso especial: lista vazia
      if (orderedAnimeIds.length === 0) {
        const listCheck = await sql.query<{ id: string; userId: string }>(
          `SELECT "id", "userId" FROM "user_custom_list" WHERE "id" = $1 LIMIT 1`,
          [listId],
        );

        if (listCheck.length === 0) {
          throw new Error("Lista não encontrada.");
        }
        if (listCheck[0].userId !== userId) {
          throw new Error("Você não tem permissão para modificar esta lista.");
        }

        const countRows = await sql.query<{ count: number }>(
          `SELECT count(*)::int as count FROM "user_custom_list_item" WHERE "listId" = $1`,
          [listId],
        );

        const currentCount = Number(countRows[0]?.count) || 0;
        if (currentCount > 0) {
          throw new Error(
            `A nova ordem deve conter exatamente todos os ${currentCount} animes desta lista.`,
          );
        }

        return {
          success: true,
          listId,
          updatedCount: 0,
        };
      }

      // 2. CTE atômica com bloqueio exclusivo da lista e validação completa do conjunto de IDs
      const atomicReorderQuery = `
      WITH list_lock AS (
        SELECT "id" FROM "user_custom_list"
        WHERE "id" = $2 AND "userId" = $1
        FOR UPDATE
      ),
      incoming AS (
        SELECT elem AS anime_id, (ord - 1)::int AS new_pos
        FROM unnest($3::text[]) WITH ORDINALITY AS t(elem, ord)
      ),
      current_items AS (
        SELECT ucli."animeId"
        FROM "user_custom_list_item" ucli
        JOIN list_lock ll ON ucli."listId" = ll."id"
      ),
      validation AS (
        SELECT
          (SELECT count(*) FROM list_lock)::int AS list_count,
          (SELECT count(*) FROM incoming)::int AS incoming_count,
          (SELECT count(DISTINCT anime_id) FROM incoming)::int AS unique_incoming_count,
          (SELECT count(*) FROM current_items)::int AS current_count,
          (
            SELECT count(*)
            FROM current_items ci
            JOIN incoming inc ON inc.anime_id = ci."animeId"
          )::int AS matched_count,
          (
            SELECT inc.anime_id
            FROM incoming inc
            LEFT JOIN current_items ci ON ci."animeId" = inc.anime_id
            WHERE ci."animeId" IS NULL
            LIMIT 1
          ) AS invalid_id
      ),
      updated_rows AS (
        UPDATE "user_custom_list_item" ucli
        SET "position" = inc.new_pos
        FROM incoming inc, list_lock ll, validation v
        WHERE v.list_count = 1
          AND v.incoming_count = v.unique_incoming_count
          AND v.incoming_count = v.current_count
          AND v.matched_count = v.current_count
          AND ucli."listId" = ll."id"
          AND ucli."animeId" = inc.anime_id
        RETURNING ucli."animeId", ucli."position"
      )
      SELECT
        v.list_count,
        v.incoming_count,
        v.unique_incoming_count,
        v.current_count,
        v.matched_count,
        v.invalid_id,
        (SELECT count(*)::int FROM updated_rows) AS updated_count
      FROM validation v;
    `;

      const results = await sql.query<{
        list_count: number;
        incoming_count: number;
        unique_incoming_count: number;
        current_count: number;
        matched_count: number;
        invalid_id: string | null;
        updated_count: number;
      }>(atomicReorderQuery, [userId, listId, orderedAnimeIds]);

      const result = results[0];

      if (!result || result.list_count === 0) {
        const listCheck = await sql.query<{ id: string; userId: string }>(
          `SELECT "id", "userId" FROM "user_custom_list" WHERE "id" = $1 LIMIT 1`,
          [listId],
        );

        if (listCheck.length === 0) {
          throw new Error("Lista não encontrada.");
        }
        throw new Error("Você não tem permissão para modificar esta lista.");
      }

      if (result.incoming_count !== result.unique_incoming_count) {
        throw new Error("A lista de reordenação contém IDs duplicados.");
      }

      if (result.invalid_id) {
        throw new Error(
          `O anime '${result.invalid_id}' não pertence a esta lista.`,
        );
      }

      if (
        result.incoming_count !== result.current_count ||
        result.matched_count !== result.current_count
      ) {
        throw new Error(
          `A nova ordem deve conter exatamente todos os ${result.current_count} animes desta lista.`,
        );
      }

      if (result.updated_count !== result.incoming_count) {
        throw new Error(
          "Falha ao atualizar a ordenação dos animes na lista.",
        );
      }

      // Atualiza o updatedAt da lista mãe
      await sql.query(
        `UPDATE "user_custom_list" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
        [listId],
      );

      return {
        success: true,
        listId,
        updatedCount: result.updated_count,
      };
    },
  );
