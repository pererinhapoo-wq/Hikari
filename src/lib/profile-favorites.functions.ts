import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  addFavoriteSchema,
  removeFavoriteSchema,
  reorderFavoritesSchema,
  getFavoritesSchema,
  type FavoriteTargetType,
  type ProfileFavoriteItem,
  type ProfileFavoritesGrouped,
  type ProfileFavoritesResponse,
} from "@/types/favorite";

/**
 * Valida se a entidade existe na tabela de catálogo correspondente da Migration 0019.
 */
async function assertCatalogEntityExists(
  targetType: FavoriteTargetType,
  targetId: string,
): Promise<void> {
  const sql = await getSql();

  let exists = false;

  switch (targetType) {
    case "anime": {
      const rows = await sql<{ id: string }>`
        SELECT "id" FROM "catalog_anime" WHERE "id" = ${targetId} LIMIT 1
      `;
      exists = rows.length > 0;
      break;
    }
    case "character": {
      const rows = await sql<{ id: string }>`
        SELECT "id" FROM "catalog_character" WHERE "id" = ${targetId} LIMIT 1
      `;
      exists = rows.length > 0;
      break;
    }
    case "studio": {
      const rows = await sql<{ id: string }>`
        SELECT "id" FROM "catalog_studio" WHERE "id" = ${targetId} LIMIT 1
      `;
      exists = rows.length > 0;
      break;
    }
    case "company": {
      const rows = await sql<{ id: string }>`
        SELECT "id" FROM "catalog_company" WHERE "id" = ${targetId} LIMIT 1
      `;
      exists = rows.length > 0;
      break;
    }
    case "person": {
      const rows = await sql<{ id: string }>`
        SELECT "id" FROM "catalog_person" WHERE "id" = ${targetId} LIMIT 1
      `;
      exists = rows.length > 0;
      break;
    }
  }

  if (!exists) {
    throw new Error(
      `O item de destino (${targetType}) não foi encontrado no catálogo oficial.`,
    );
  }
}

/**
 * 1. Adicionar favorito oficial do perfil.
 * Serializa adições com lock na linha do usuário ("user FOR UPDATE") e calcula
 * a próxima posição de forma atômica no CTE.
 */
export const addProfileFavorite = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(addFavoriteSchema)
  .handler(async ({ context, data }) => {
    const userId = context.userId;
    const { targetType, targetId } = data;

    // 1. Verifica se a entidade existe no catálogo
    await assertCatalogEntityExists(targetType, targetId);

    const sql = await getSql();

    // 2. Pré-validação de duplicata rápida
    const duplicateCheck = await sql<{ id: string }>`
      SELECT "id" FROM "user_favorite"
      WHERE "userId" = ${userId}
        AND (
          (${targetType} = 'anime' AND "animeId" = ${targetId}) OR
          (${targetType} = 'character' AND "characterId" = ${targetId}) OR
          (${targetType} = 'studio' AND "studioId" = ${targetId}) OR
          (${targetType} = 'company' AND "companyId" = ${targetId}) OR
          (${targetType} = 'person' AND "personId" = ${targetId})
        )
      LIMIT 1
    `;

    if (duplicateCheck.length > 0) {
      throw new Error("Esse item já está nos seus favoritos.");
    }

    // 3. Monta mapeamento exclusivo de colunas conforme targetType
    const animeId = targetType === "anime" ? targetId : null;
    const characterId = targetType === "character" ? targetId : null;
    const studioId = targetType === "studio" ? targetId : null;
    const companyId = targetType === "company" ? targetId : null;
    const personId = targetType === "person" ? targetId : null;

    const favoriteId = crypto.randomUUID();

    // 4. Executa inserção com bloqueio da linha do usuário e cálculo atômico da próxima posição
    const insertQuery = `
      WITH user_lock AS (
        SELECT "id" FROM "user" WHERE "id" = $1 FOR UPDATE
      ),
      next_pos AS (
        SELECT COALESCE(MAX("position"), -1) + 1 AS pos
        FROM "user_favorite"
        WHERE "userId" = $1 AND "targetType" = $2
      )
      INSERT INTO "user_favorite" (
        "id", "userId", "targetType",
        "animeId", "characterId", "studioId", "companyId", "personId",
        "position"
      )
      SELECT $3, ul."id", $2, $4, $5, $6, $7, $8, np.pos
      FROM user_lock ul
      CROSS JOIN next_pos np
      RETURNING "id", "userId", "targetType", "position", "createdAt";
    `;

    try {
      const inserted = await sql.query<{
        id: string;
        userId: string;
        targetType: FavoriteTargetType;
        position: number;
        createdAt: string;
      }>(insertQuery, [
        userId,
        targetType,
        favoriteId,
        animeId,
        characterId,
        studioId,
        companyId,
        personId,
      ]);

      const record = inserted[0];
      if (!record) {
        throw new Error("Não foi possível cadastrar o favorito.");
      }

      return {
        id: record.id,
        userId: record.userId,
        targetType: record.targetType,
        targetId,
        position: Number(record.position),
        createdAt: record.createdAt,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("user_favorite_user_") ||
        message.includes("unique constraint") ||
        message.includes("duplicate key")
      ) {
        throw new Error("Esse item já está nos seus favoritos.");
      }
      throw err;
    }
  });

/**
 * 2. Remover favorito oficial do perfil.
 * Remove somente o favorito pertencente ao usuário autenticado de maneira atômica.
 */
export const removeProfileFavorite = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(removeFavoriteSchema)
  .handler(async ({ context, data }) => {
    const userId = context.userId;
    const { favoriteId } = data;

    const sql = await getSql();

    const deleteQuery = `
      WITH user_lock AS (
        SELECT "id" FROM "user" WHERE "id" = $1 FOR UPDATE
      )
      DELETE FROM "user_favorite" uf
      USING user_lock ul
      WHERE uf."userId" = ul."id"
        AND uf."id" = $2
      RETURNING uf."id", uf."targetType", uf."position";
    `;

    const deletedRows = await sql.query<{
      id: string;
      targetType: FavoriteTargetType;
      position: number;
    }>(deleteQuery, [userId, favoriteId]);

    if (deletedRows.length === 0) {
      throw new Error("Favorito não encontrado ou não pertence ao usuário.");
    }

    return {
      success: true,
      removedId: favoriteId,
      targetType: deletedRows[0].targetType,
    };
  });

/**
 * 3. Consultar favoritos do usuário autenticado.
 * Retorna itens enriquecidos com os dados canônicos do catálogo via LEFT JOIN.
 */
export const getMyProfileFavorites = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .validator(getFavoritesSchema)
  .handler(async ({ context, data }): Promise<ProfileFavoritesResponse> => {
    const userId = context.userId;
    const targetTypeFilter = data?.targetType ?? null;

    const sql = await getSql();

    const query = `
      SELECT
        uf."id",
        uf."userId",
        uf."targetType",
        uf."position",
        uf."createdAt",
        COALESCE(uf."animeId", uf."characterId", uf."studioId", uf."companyId", uf."personId") AS "targetId",
        COALESCE(ca."title", cc."name", cs."name", cco."name", cp."name", 'Sem título') AS "title",
        COALESCE(ca."titleNative", cc."nativeName", cp."nativeName") AS "nativeTitle",
        COALESCE(ca."cover", cc."imageUrl", cs."logoUrl", cco."logoUrl", cp."imageUrl") AS "image",
        ca."banner" AS "banner",
        COALESCE(ca."synopsis", cc."description", cs."description", cp."biography") AS "description",
        CASE
          WHEN uf."targetType" = 'anime' THEN
            CASE
              WHEN ca."year" IS NOT NULL AND ca."format" IS NOT NULL THEN ca."format" || ' • ' || ca."year"
              WHEN ca."year" IS NOT NULL THEN ca."year"::text
              ELSE ca."format"
            END
          WHEN uf."targetType" = 'studio' THEN
            CASE WHEN cs."establishedYear" IS NOT NULL THEN 'Fundado em ' || cs."establishedYear" ELSE NULL END
          WHEN uf."targetType" = 'company' THEN cco."website"
          ELSE NULL
        END AS "subtitle"
      FROM "user_favorite" uf
      LEFT JOIN "catalog_anime" ca ON ca."id" = uf."animeId"
      LEFT JOIN "catalog_character" cc ON cc."id" = uf."characterId"
      LEFT JOIN "catalog_studio" cs ON cs."id" = uf."studioId"
      LEFT JOIN "catalog_company" cco ON cco."id" = uf."companyId"
      LEFT JOIN "catalog_person" cp ON cp."id" = uf."personId"
      WHERE uf."userId" = $1
        AND ($2::text IS NULL OR uf."targetType" = $2)
      ORDER BY uf."targetType" ASC, uf."position" ASC, uf."createdAt" ASC;
    `;

    const rawRows = await sql.query<{
      id: string;
      userId: string;
      targetType: FavoriteTargetType;
      position: number;
      createdAt: string;
      targetId: string;
      title: string;
      nativeTitle: string | null;
      image: string | null;
      banner: string | null;
      description: string | null;
      subtitle: string | null;
    }>(query, [userId, targetTypeFilter]);

    const items: ProfileFavoriteItem[] = rawRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      targetType: row.targetType,
      targetId: row.targetId,
      position: Number(row.position),
      createdAt: row.createdAt,
      title: row.title,
      nativeTitle: row.nativeTitle ?? null,
      image: row.image ?? null,
      banner: row.banner ?? null,
      description: row.description ?? null,
      subtitle: row.subtitle ?? null,
    }));

    const grouped: ProfileFavoritesGrouped = {
      anime: [],
      character: [],
      studio: [],
      company: [],
      person: [],
    };

    for (const item of items) {
      if (grouped[item.targetType]) {
        grouped[item.targetType].push(item);
      }
    }

    return {
      items,
      grouped,
    };
  });

/**
 * 4. Reordenar favoritos dentro de uma categoria.
 * Valida que todos os IDs pertencem ao usuário e à categoria sem omissões ou duplicatas,
 * e atualiza de forma atômica utilizando CTE com bloqueio do usuário.
 */
export const reorderProfileFavorites = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(reorderFavoritesSchema)
  .handler(async ({ context, data }) => {
    const userId = context.userId;
    const { targetType, orderedFavoriteIds } = data;

    // 1. Rejeita IDs duplicados na lista informada
    const uniqueIds = new Set(orderedFavoriteIds);
    if (uniqueIds.size !== orderedFavoriteIds.length) {
      throw new Error("A lista de reordenação contém IDs duplicados.");
    }

    const sql = await getSql();

    // 2. Busca todos os IDs atuais dessa categoria pertencentes ao usuário
    const currentRows = await sql<{ id: string }>`
      SELECT "id" FROM "user_favorite"
      WHERE "userId" = ${userId}
        AND "targetType" = ${targetType}
    `;

    const currentIdSet = new Set(currentRows.map((r) => r.id));

    // 3. Validação rigorosa: a lista deve ser uma permutação exata dos existentes
    if (orderedFavoriteIds.length !== currentRows.length) {
      throw new Error(
        `A nova ordem deve conter exatamente todos os ${currentRows.length} favoritos dessa categoria.`,
      );
    }

    for (const id of orderedFavoriteIds) {
      if (!currentIdSet.has(id)) {
        throw new Error(
          `O favorito '${id}' é inválido ou não pertence aos seus favoritos desta categoria.`,
        );
      }
    }

    // 4. Atualização atômica sequencial com bloqueio da linha do usuário
    const reorderQuery = `
      WITH user_lock AS (
        SELECT "id" FROM "user" WHERE "id" = $1 FOR UPDATE
      ),
      new_order AS (
        SELECT unnest($2::text[]) AS fid, generate_subscripts($2::text[], 1) - 1 AS new_pos
      )
      UPDATE "user_favorite" uf
      SET "position" = no.new_pos
      FROM new_order no, user_lock ul
      WHERE uf."id" = no.fid
        AND uf."userId" = ul."id"
        AND uf."targetType" = $3
      RETURNING uf."id", uf."position";
    `;

    const updated = await sql.query<{ id: string; position: number }>(
      reorderQuery,
      [userId, orderedFavoriteIds, targetType],
    );

    return {
      success: true,
      targetType,
      updatedCount: updated.length,
    };
  });
