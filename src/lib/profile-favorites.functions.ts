import { createServerFn } from "@tanstack/react-start";
import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { getStudioLogo } from "@/lib/studio-logos";
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
  snapshots?: {
    anime?: {
      title?: string;
      titleRomaji?: string | null;
      titleEnglish?: string | null;
      titleNative?: string | null;
      cover?: string | null;
      banner?: string | null;
      synopsis?: string | null;
      format?: string | null;
      year?: number | null;
      episodesCount?: number | null;
      status?: string | null;
    } | null;
    character?: {
      name?: string;
      nativeName?: string | null;
      imageUrl?: string | null;
      description?: string | null;
    } | null;
    studio?: {
      name?: string;
      logoUrl?: string | null;
      establishedYear?: number | null;
      description?: string | null;
    } | null;
    person?: {
      name?: string;
      nativeName?: string | null;
      imageUrl?: string | null;
      biography?: string | null;
    } | null;
  },
): Promise<{ canonicalId: string }> {
  const sql = await getSql();

  let canonicalId = targetId;
  let exists = false;

  switch (targetType) {
    case "anime": {
      let rows = await sql<{ id: string }>`
        SELECT "id" FROM "catalog_anime" WHERE "id" = ${targetId} LIMIT 1
      `;
      if (rows.length === 0) {
        const titleToUse = snapshots?.anime?.title?.trim() || targetId;
        await sql.query(
          `INSERT INTO "catalog_anime" (
            "id", "title", "titleRomaji", "titleEnglish", "titleNative",
            "cover", "banner", "synopsis", "format", "year", "episodesCount", "status",
            "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ("id") DO UPDATE SET
            "title" = COALESCE(EXCLUDED."title", "catalog_anime"."title"),
            "cover" = COALESCE(EXCLUDED."cover", "catalog_anime"."cover"),
            "banner" = COALESCE(EXCLUDED."banner", "catalog_anime"."banner"),
            "updatedAt" = CURRENT_TIMESTAMP`,
          [
            targetId,
            titleToUse,
            snapshots?.anime?.titleRomaji ?? null,
            snapshots?.anime?.titleEnglish ?? null,
            snapshots?.anime?.titleNative ?? null,
            snapshots?.anime?.cover ?? null,
            snapshots?.anime?.banner ?? null,
            snapshots?.anime?.synopsis ?? null,
            snapshots?.anime?.format ?? null,
            snapshots?.anime?.year ?? null,
            snapshots?.anime?.episodesCount ?? null,
            snapshots?.anime?.status ?? null,
          ],
        );
        rows = await sql<{ id: string }>`
          SELECT "id" FROM "catalog_anime" WHERE "id" = ${targetId} LIMIT 1
        `;
      }
      if (rows.length > 0) {
        canonicalId = rows[0].id;
        exists = true;
      }
      break;
    }
    case "character": {
      let rows = await sql<{ id: string }>`
        SELECT "id" FROM "catalog_character" WHERE "id" = ${targetId} LIMIT 1
      `;
      if (rows.length === 0) {
        const nameToUse = snapshots?.character?.name?.trim() || targetId;
        await sql.query(
          `INSERT INTO "catalog_character" (
            "id", "name", "nativeName", "imageUrl", "description",
            "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ("id") DO UPDATE SET
            "name" = COALESCE(EXCLUDED."name", "catalog_character"."name"),
            "imageUrl" = COALESCE(EXCLUDED."imageUrl", "catalog_character"."imageUrl"),
            "description" = COALESCE(EXCLUDED."description", "catalog_character"."description"),
            "updatedAt" = CURRENT_TIMESTAMP`,
          [
            targetId,
            nameToUse,
            snapshots?.character?.nativeName ?? null,
            snapshots?.character?.imageUrl ?? null,
            snapshots?.character?.description ?? null,
          ],
        );
        rows = await sql<{ id: string }>`
          SELECT "id" FROM "catalog_character" WHERE "id" = ${targetId} LIMIT 1
        `;
      }
      if (rows.length > 0) {
        canonicalId = rows[0].id;
        exists = true;
      }
      break;
    }
    case "studio": {
      const nameToUse = snapshots?.studio?.name?.trim() || targetId;
      let rows = await sql<{ id: string }>`
        SELECT "id" FROM "catalog_studio" WHERE "id" = ${targetId} OR "name" = ${nameToUse} LIMIT 1
      `;
      if (rows.length === 0) {
        const logoToUse = snapshots?.studio?.logoUrl ?? getStudioLogo(nameToUse);
        await sql.query(
          `INSERT INTO "catalog_studio" (
            "id", "name", "logoUrl", "establishedYear", "description",
            "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ("name") DO UPDATE SET
            "logoUrl" = COALESCE(EXCLUDED."logoUrl", "catalog_studio"."logoUrl"),
            "updatedAt" = CURRENT_TIMESTAMP`,
          [
            targetId,
            nameToUse,
            logoToUse,
            snapshots?.studio?.establishedYear ?? null,
            snapshots?.studio?.description ?? null,
          ],
        );
        rows = await sql<{ id: string }>`
          SELECT "id" FROM "catalog_studio" WHERE "id" = ${targetId} OR "name" = ${nameToUse} LIMIT 1
        `;
      }
      if (rows.length > 0) {
        canonicalId = rows[0].id;
        exists = true;
      }
      break;
    }
    case "company": {
      const rows = await sql<{ id: string }>`
        SELECT "id" FROM "catalog_company" WHERE "id" = ${targetId} LIMIT 1
      `;
      if (rows.length > 0) {
        canonicalId = rows[0].id;
        exists = true;
      }
      break;
    }
    case "person": {
      let rows = await sql<{ id: string }>`
        SELECT "id" FROM "catalog_person" WHERE "id" = ${targetId} LIMIT 1
      `;
      if (rows.length === 0) {
        const nameToUse = snapshots?.person?.name?.trim() || targetId;
        await sql.query(
          `INSERT INTO "catalog_person" (
            "id", "name", "nativeName", "imageUrl", "biography",
            "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ("id") DO UPDATE SET
            "name" = COALESCE(EXCLUDED."name", "catalog_person"."name"),
            "imageUrl" = COALESCE(EXCLUDED."imageUrl", "catalog_person"."imageUrl"),
            "biography" = COALESCE(EXCLUDED."biography", "catalog_person"."biography"),
            "updatedAt" = CURRENT_TIMESTAMP`,
          [
            targetId,
            nameToUse,
            snapshots?.person?.nativeName ?? null,
            snapshots?.person?.imageUrl ?? null,
            snapshots?.person?.biography ?? null,
          ],
        );
        rows = await sql<{ id: string }>`
          SELECT "id" FROM "catalog_person" WHERE "id" = ${targetId} LIMIT 1
        `;
      }
      if (rows.length > 0) {
        canonicalId = rows[0].id;
        exists = true;
      }
      break;
    }
  }

  if (!exists) {
    throw new Error(
      `O item de destino (${targetType}) não foi encontrado no catálogo oficial.`,
    );
  }

  return { canonicalId };
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
    const {
      targetType,
      targetId,
      animeSnapshot,
      characterSnapshot,
      studioSnapshot,
      personSnapshot,
    } = data;

    // 1. Verifica se a entidade existe no catálogo (com auto-provisionamento de catálogo se snapshot for enviado)
    const { canonicalId } = await assertCatalogEntityExists(targetType, targetId, {
      anime: animeSnapshot,
      character: characterSnapshot,
      studio: studioSnapshot,
      person: personSnapshot,
    });
    const finalTargetId = canonicalId || targetId;

    const sql = await getSql();

    // 2. Pré-validação de duplicata rápida
    const duplicateCheck = await sql<{ id: string }>`
      SELECT "id" FROM "user_favorite"
      WHERE "userId" = ${userId}
        AND (
          (${targetType} = 'anime' AND "animeId" = ${finalTargetId}) OR
          (${targetType} = 'character' AND "characterId" = ${finalTargetId}) OR
          (${targetType} = 'studio' AND "studioId" = ${finalTargetId}) OR
          (${targetType} = 'company' AND "companyId" = ${finalTargetId}) OR
          (${targetType} = 'person' AND "personId" = ${finalTargetId})
        )
      LIMIT 1
    `;

    if (duplicateCheck.length > 0) {
      throw new Error("Esse item já está nos seus favoritos.");
    }

    // 2b. Validação estrita de limite independente de no máximo 10 favoritos por categoria
    if (targetType === "anime") {
      const animeCount = await sql<{ count: number }>`
        SELECT count(*)::int AS count FROM "user_favorite"
        WHERE "userId" = ${userId} AND "targetType" = 'anime'
      `;
      if ((animeCount[0]?.count ?? 0) >= 10) {
        throw new Error("Você atingiu o limite de 10 animes favoritos.");
      }
    } else if (targetType === "character") {
      const charCount = await sql<{ count: number }>`
        SELECT count(*)::int AS count FROM "user_favorite"
        WHERE "userId" = ${userId} AND "targetType" = 'character'
      `;
      if ((charCount[0]?.count ?? 0) >= 10) {
        throw new Error("Você atingiu o limite de 10 personagens favoritos.");
      }
    } else if (targetType === "studio" || targetType === "company") {
      const studioCount = await sql<{ count: number }>`
        SELECT count(*)::int AS count FROM "user_favorite"
        WHERE "userId" = ${userId} AND "targetType" IN ('studio', 'company')
      `;
      if ((studioCount[0]?.count ?? 0) >= 10) {
        throw new Error("Você atingiu o limite de 10 estúdios favoritos.");
      }
    } else if (targetType === "person") {
      // Diferenciação estrita entre Dubladores e People
      const isVoiceActorCandidate =
        Boolean(personSnapshot?.biography?.toLowerCase().includes("dublador")) ||
        Boolean(personSnapshot?.biography?.toLowerCase().includes("voice actor")) ||
        Boolean(personSnapshot?.biography?.toLowerCase().includes("seiyuu")) ||
        Boolean(personSnapshot?.primaryOccupation?.toLowerCase().includes("dublador")) ||
        Boolean(personSnapshot?.primaryOccupation?.toLowerCase().includes("seiyuu"));

      const dbPersonCheck = await sql<{ is_va: boolean }>`
        SELECT (
          EXISTS(SELECT 1 FROM "character_voice_actor" cva WHERE cva."personId" = ${finalTargetId}) OR
          EXISTS(SELECT 1 FROM "catalog_person" cp WHERE cp."id" = ${finalTargetId} AND (
            LOWER(COALESCE(cp."biography", '')) LIKE '%dublador%' OR
            LOWER(COALESCE(cp."biography", '')) LIKE '%voice actor%' OR
            LOWER(COALESCE(cp."biography", '')) LIKE '%seiyuu%' OR
            LOWER(COALESCE(cp."primaryOccupation", '')) LIKE '%dublador%' OR
            LOWER(COALESCE(cp."primaryOccupation", '')) LIKE '%seiyuu%'
          ))
        ) AS is_va
      `;

      const isVoiceActor = isVoiceActorCandidate || Boolean(dbPersonCheck[0]?.is_va);

      const existingPersonRows = await sql<{
        personId: string;
        is_va: boolean;
      }>`
        SELECT uf."personId", (
          EXISTS(SELECT 1 FROM "character_voice_actor" cva WHERE cva."personId" = uf."personId") OR
          EXISTS(SELECT 1 FROM "catalog_person" cp WHERE cp."id" = uf."personId" AND (
            LOWER(COALESCE(cp."biography", '')) LIKE '%dublador%' OR
            LOWER(COALESCE(cp."biography", '')) LIKE '%voice actor%' OR
            LOWER(COALESCE(cp."biography", '')) LIKE '%seiyuu%' OR
            LOWER(COALESCE(cp."primaryOccupation", '')) LIKE '%dublador%' OR
            LOWER(COALESCE(cp."primaryOccupation", '')) LIKE '%seiyuu%'
          ))
        ) AS is_va
        FROM "user_favorite" uf
        WHERE uf."userId" = ${userId} AND uf."targetType" = 'person'
      `;

      let dubladoresCount = 0;
      let peopleCount = 0;
      for (const row of existingPersonRows) {
        if (row.is_va) {
          dubladoresCount++;
        } else {
          peopleCount++;
        }
      }

      if (isVoiceActor && dubladoresCount >= 10) {
        throw new Error("Você atingiu o limite de 10 dubladores favoritos.");
      }
      if (!isVoiceActor && peopleCount >= 10) {
        throw new Error("Você atingiu o limite de 10 pessoas favoritas.");
      }
    }

    // 3. Monta mapeamento exclusivo de colunas conforme targetType
    const animeId = targetType === "anime" ? finalTargetId : null;
    const characterId = targetType === "character" ? finalTargetId : null;
    const studioId = targetType === "studio" ? finalTargetId : null;
    const companyId = targetType === "company" ? finalTargetId : null;
    const personId = targetType === "person" ? finalTargetId : null;

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
 * Suporta remoção por favoriteId OU por targetType + targetId.
 */
export const removeProfileFavorite = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(removeFavoriteSchema)
  .handler(async ({ context, data }) => {
    const userId = context.userId;
    const { favoriteId, targetType, targetId } = data;

    const sql = await getSql();

    const deleteQuery = `
      WITH user_lock AS (
        SELECT "id" FROM "user" WHERE "id" = $1 FOR UPDATE
      )
      DELETE FROM "user_favorite" uf
      USING user_lock ul
      WHERE uf."userId" = ul."id"
        AND (
          ($2::text IS NOT NULL AND uf."id" = $2)
          OR (
            $3::text IS NOT NULL AND $4::text IS NOT NULL AND uf."targetType" = $3 AND (
              ($3 = 'anime' AND (uf."animeId" = $4 OR uf."animeId" IN (SELECT ca."id" FROM "catalog_anime" ca WHERE ca."title" = $4))) OR
              ($3 = 'character' AND (uf."characterId" = $4 OR uf."characterId" IN (SELECT cc."id" FROM "catalog_character" cc WHERE cc."name" = $4))) OR
              ($3 = 'studio' AND (uf."studioId" = $4 OR uf."studioId" IN (SELECT cs."id" FROM "catalog_studio" cs WHERE cs."name" = $4))) OR
              ($3 = 'company' AND (uf."companyId" = $4 OR uf."companyId" IN (SELECT cco."id" FROM "catalog_company" cco WHERE cco."name" = $4))) OR
              ($3 = 'person' AND (uf."personId" = $4 OR uf."personId" IN (SELECT cp."id" FROM "catalog_person" cp WHERE cp."name" = $4)))
            )
          )
        )
      RETURNING uf."id", uf."targetType", uf."position";
    `;

    const deletedRows = await sql.query<{
      id: string;
      targetType: FavoriteTargetType;
      position: number;
    }>(deleteQuery, [
      userId,
      favoriteId ?? null,
      targetType ?? null,
      targetId ?? null,
    ]);

    if (deletedRows.length === 0) {
      throw new Error("Favorito não encontrado ou não pertence ao usuário.");
    }

    return {
      success: true,
      removedId: deletedRows[0].id,
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
    const targetIdFilter = data?.targetId ? data.targetId.trim() : null;

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
          WHEN uf."targetType" = 'character' THEN
            COALESCE(
              (SELECT CASE
                WHEN ac."role" = 'main' THEN 'Protagonista'
                WHEN ac."role" = 'supporting' THEN 'Secundário'
                ELSE 'Personagem'
               END
               FROM "anime_character" ac
               WHERE ac."characterId" = cc."id"
               LIMIT 1
              ),
              'Personagem'
            )
          WHEN uf."targetType" = 'studio' THEN
            CASE
              WHEN cs."establishedYear" IS NOT NULL THEN 'Fundado em ' || cs."establishedYear"
              ELSE 'Estúdio de animação'
            END
          WHEN uf."targetType" = 'company' THEN cco."website"
          WHEN uf."targetType" = 'person' THEN
            COALESCE(
              (SELECT ans."role" FROM "anime_staff" ans WHERE ans."personId" = cp."id" LIMIT 1),
              (SELECT 'Dublador(a) (' || cva."language" || ')' FROM "character_voice_actor" cva WHERE cva."personId" = cp."id" LIMIT 1),
              NULLIF(cp."biography", ''),
              'Produção & Elenco'
            )
          ELSE NULL
        END AS "subtitle",
        uat."score" AS "userScore"
      FROM "user_favorite" uf
      LEFT JOIN "catalog_anime" ca ON ca."id" = uf."animeId"
      LEFT JOIN "catalog_character" cc ON cc."id" = uf."characterId"
      LEFT JOIN "catalog_studio" cs ON cs."id" = uf."studioId"
      LEFT JOIN "catalog_company" cco ON cco."id" = uf."companyId"
      LEFT JOIN "catalog_person" cp ON cp."id" = uf."personId"
      LEFT JOIN "user_anime_tracking" uat ON uat."userId" = uf."userId" AND uat."animeId" = uf."animeId"
      WHERE uf."userId" = $1
        AND ($2::text IS NULL OR uf."targetType" = $2)
        AND ($3::text IS NULL OR COALESCE(uf."animeId", uf."characterId", uf."studioId", uf."companyId", uf."personId") = $3)
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
      userScore: number | string | null;
    }>(query, [userId, targetTypeFilter, targetIdFilter]);

    const items: ProfileFavoriteItem[] = rawRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      targetType: row.targetType,
      targetId: row.targetId,
      position: Number(row.position),
      createdAt: row.createdAt,
      title: row.title,
      nativeTitle: row.nativeTitle ?? null,
      image: row.image || (row.targetType === "studio" ? getStudioLogo(row.title) : null),
      banner: row.banner ?? null,
      description: row.description ?? null,
      subtitle: row.subtitle ?? null,
      userScore: row.userScore !== null && row.userScore !== undefined ? Number(row.userScore) : null,
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
 * Consultar favoritos públicos de um perfil respeitando as permissões de privacidade.
 */
export const getPublicProfileFavorites = createServerFn({
  method: "GET",
})
  .middleware([optionalAuthMiddleware])
  .validator((d: { userId: string; targetType?: FavoriteTargetType }) => d)
  .handler(async ({ context, data }): Promise<ProfileFavoritesResponse> => {
    const viewerId = context?.userId ?? null;
    const targetUserId = (data?.userId || "").trim();
    if (!targetUserId) throw new Error("Usuário não informado.");

    const sql = await getSql();
    const { evaluateUserPrivacy } = await import("@/lib/profile.functions");
    const privacy = await evaluateUserPrivacy(sql, targetUserId, viewerId);
    if (!privacy.canViewFavorites) {
      throw new Error("Os favoritos deste perfil são privados.");
    }

    const targetTypeFilter = data?.targetType ?? null;

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
          WHEN uf."targetType" = 'character' THEN
            COALESCE(
              (SELECT CASE
                WHEN ac."role" = 'main' THEN 'Protagonista'
                WHEN ac."role" = 'supporting' THEN 'Secundário'
                ELSE 'Personagem'
               END
               FROM "anime_character" ac
               WHERE ac."characterId" = cc."id"
               LIMIT 1
              ),
              'Personagem'
            )
          WHEN uf."targetType" = 'studio' THEN
            CASE
              WHEN cs."establishedYear" IS NOT NULL THEN 'Fundado em ' || cs."establishedYear"
              ELSE 'Estúdio de animação'
            END
          WHEN uf."targetType" = 'company' THEN cco."website"
          WHEN uf."targetType" = 'person' THEN
            COALESCE(
              (SELECT ans."role" FROM "anime_staff" ans WHERE ans."personId" = cp."id" LIMIT 1),
              (SELECT 'Dublador(a) (' || cva."language" || ')' FROM "character_voice_actor" cva WHERE cva."personId" = cp."id" LIMIT 1),
              NULLIF(cp."biography", ''),
              'Produção & Elenco'
            )
          ELSE NULL
        END AS "subtitle",
        uat."score" AS "userScore"
      FROM "user_favorite" uf
      LEFT JOIN "catalog_anime" ca ON ca."id" = uf."animeId"
      LEFT JOIN "catalog_character" cc ON cc."id" = uf."characterId"
      LEFT JOIN "catalog_studio" cs ON cs."id" = uf."studioId"
      LEFT JOIN "catalog_company" cco ON cco."id" = uf."companyId"
      LEFT JOIN "catalog_person" cp ON cp."id" = uf."personId"
      LEFT JOIN "user_anime_tracking" uat ON uat."userId" = uf."userId" AND uat."animeId" = uf."animeId"
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
      userScore: number | string | null;
    }>(query, [targetUserId, targetTypeFilter]);

    const items: ProfileFavoriteItem[] = rawRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      targetType: row.targetType,
      targetId: row.targetId,
      position: Number(row.position),
      createdAt: row.createdAt,
      title: row.title,
      nativeTitle: row.nativeTitle ?? null,
      image: row.image || (row.targetType === "studio" ? getStudioLogo(row.title) : null),
      banner: row.banner ?? null,
      description: row.description ?? null,
      subtitle: row.subtitle ?? null,
      userScore: row.userScore !== null && row.userScore !== undefined ? Number(row.userScore) : null,
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
 * e atualiza de forma atômica utilizando CTE com bloqueio do usuário ("user FOR UPDATE").
 */
export const reorderProfileFavorites = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(reorderFavoritesSchema)
  .handler(async ({ context, data }) => {
    const userId = context.userId;
    const { targetType, orderedFavoriteIds } = data;

    // 1. Rejeita IDs duplicados na lista informada antes de ir ao banco
    const uniqueIds = new Set(orderedFavoriteIds);
    if (uniqueIds.size !== orderedFavoriteIds.length) {
      throw new Error("A lista de reordenação contém IDs duplicados.");
    }

    const sql = await getSql();

    // 2. Executa bloqueio da linha do usuário (SELECT ... FOR UPDATE), validação da lista
    // e atualização sequencial das posições (de zero em diante) em uma única instrução SQL atômica.
    const atomicReorderQuery = `
      WITH user_lock AS (
        SELECT "id" FROM "user" WHERE "id" = $1 FOR UPDATE
      ),
      incoming AS (
        SELECT elem AS id, (ord - 1)::int AS new_pos
        FROM unnest($2::text[]) WITH ORDINALITY AS t(elem, ord)
      ),
      current_favs AS (
        SELECT uf."id"
        FROM "user_favorite" uf
        JOIN user_lock ul ON uf."userId" = ul."id"
        WHERE uf."targetType" = $3
      ),
      validation AS (
        SELECT
          (SELECT count(*) FROM user_lock)::int AS user_count,
          (SELECT count(*) FROM incoming)::int AS incoming_count,
          (SELECT count(DISTINCT id) FROM incoming)::int AS unique_incoming_count,
          (SELECT count(*) FROM current_favs)::int AS current_count,
          (
            SELECT count(*)
            FROM current_favs cf
            JOIN incoming inc ON inc.id = cf."id"
          )::int AS matched_count,
          (
            SELECT inc.id
            FROM incoming inc
            LEFT JOIN current_favs cf ON cf."id" = inc.id
            WHERE cf."id" IS NULL
            LIMIT 1
          ) AS invalid_id
      ),
      updated_rows AS (
        UPDATE "user_favorite" uf
        SET "position" = inc.new_pos
        FROM incoming inc, user_lock ul, validation v
        WHERE v.user_count = 1
          AND v.incoming_count = v.unique_incoming_count
          AND v.incoming_count = v.current_count
          AND v.matched_count = v.current_count
          AND uf."id" = inc.id
          AND uf."userId" = ul."id"
          AND uf."targetType" = $3
        RETURNING uf."id", uf."position"
      )
      SELECT
        v.user_count,
        v.incoming_count,
        v.unique_incoming_count,
        v.current_count,
        v.matched_count,
        v.invalid_id,
        (SELECT count(*)::int FROM updated_rows) AS updated_count
      FROM validation v;
    `;

    const results = await sql.query<{
      user_count: number;
      incoming_count: number;
      unique_incoming_count: number;
      current_count: number;
      matched_count: number;
      invalid_id: string | null;
      updated_count: number;
    }>(atomicReorderQuery, [userId, orderedFavoriteIds, targetType]);

    const result = results[0];
    if (!result || result.user_count === 0) {
      throw new Error("Usuário não encontrado.");
    }

    if (result.incoming_count !== result.unique_incoming_count) {
      throw new Error("A lista de reordenação contém IDs duplicados.");
    }

    if (result.invalid_id) {
      throw new Error(
        `O favorito '${result.invalid_id}' é inválido ou não pertence aos seus favoritos desta categoria.`,
      );
    }

    if (
      result.incoming_count !== result.current_count ||
      result.matched_count !== result.current_count
    ) {
      throw new Error(
        `A nova ordem deve conter exatamente todos os ${result.current_count} favoritos dessa categoria.`,
      );
    }

    if (result.updated_count !== result.incoming_count) {
      throw new Error("Falha ao atualizar as posições dos favoritos.");
    }

    return {
      success: true,
      targetType,
      updatedCount: result.updated_count,
    };
  });
