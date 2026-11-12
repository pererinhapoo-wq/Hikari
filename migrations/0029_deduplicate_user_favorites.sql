-- HIKARI Perfil: Limpeza e garantia de integridade contra duplicatas de favoritos
-- Migration 0029: Remove duplicatas nas cinco categorias e renumera posições.

-- 1. Deduplicar user_favorite por mesma chave de entidade direta
WITH ranked_direct AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "targetType", COALESCE("animeId", "characterId", "studioId", "companyId", "personId")
      ORDER BY "position" ASC, "createdAt" ASC, "id" ASC
    ) AS rn
  FROM "user_favorite"
)
DELETE FROM "user_favorite"
WHERE "id" IN (
  SELECT "id" FROM ranked_direct WHERE rn > 1
);

-- 2. Deduplicar animes duplicados em user_favorite pelo título canônico do catálogo
WITH ranked_anime_by_title AS (
  SELECT
    uf."id",
    ROW_NUMBER() OVER (
      PARTITION BY uf."userId", LOWER(TRIM(ca."title"))
      ORDER BY uf."position" ASC, uf."createdAt" ASC, uf."id" ASC
    ) AS rn
  FROM "user_favorite" uf
  JOIN "catalog_anime" ca ON ca."id" = uf."animeId"
  WHERE uf."targetType" = 'anime'
)
DELETE FROM "user_favorite"
WHERE "id" IN (
  SELECT "id" FROM ranked_anime_by_title WHERE rn > 1
);

-- 3. Deduplicar personagens duplicados pelo nome canônico
WITH ranked_char_by_name AS (
  SELECT
    uf."id",
    ROW_NUMBER() OVER (
      PARTITION BY uf."userId", LOWER(TRIM(cc."name"))
      ORDER BY uf."position" ASC, uf."createdAt" ASC, uf."id" ASC
    ) AS rn
  FROM "user_favorite" uf
  JOIN "catalog_character" cc ON cc."id" = uf."characterId"
  WHERE uf."targetType" = 'character'
)
DELETE FROM "user_favorite"
WHERE "id" IN (
  SELECT "id" FROM ranked_char_by_name WHERE rn > 1
);

-- 4. Deduplicar estúdios e empresas pelo nome canônico
WITH ranked_studio_by_name AS (
  SELECT
    uf."id",
    ROW_NUMBER() OVER (
      PARTITION BY uf."userId", LOWER(TRIM(cs."name"))
      ORDER BY uf."position" ASC, uf."createdAt" ASC, uf."id" ASC
    ) AS rn
  FROM "user_favorite" uf
  JOIN "catalog_studio" cs ON cs."id" = uf."studioId"
  WHERE uf."targetType" = 'studio'
)
DELETE FROM "user_favorite"
WHERE "id" IN (
  SELECT "id" FROM ranked_studio_by_name WHERE rn > 1
);

WITH ranked_company_by_name AS (
  SELECT
    uf."id",
    ROW_NUMBER() OVER (
      PARTITION BY uf."userId", LOWER(TRIM(cco."name"))
      ORDER BY uf."position" ASC, uf."createdAt" ASC, uf."id" ASC
    ) AS rn
  FROM "user_favorite" uf
  JOIN "catalog_company" cco ON cco."id" = uf."companyId"
  WHERE uf."targetType" = 'company'
)
DELETE FROM "user_favorite"
WHERE "id" IN (
  SELECT "id" FROM ranked_company_by_name WHERE rn > 1
);

-- 5. Deduplicar pessoas pelo nome canônico
WITH ranked_person_by_name AS (
  SELECT
    uf."id",
    ROW_NUMBER() OVER (
      PARTITION BY uf."userId", LOWER(TRIM(cp."name"))
      ORDER BY uf."position" ASC, uf."createdAt" ASC, uf."id" ASC
    ) AS rn
  FROM "user_favorite" uf
  JOIN "catalog_person" cp ON cp."id" = uf."personId"
  WHERE uf."targetType" = 'person'
)
DELETE FROM "user_favorite"
WHERE "id" IN (
  SELECT "id" FROM ranked_person_by_name WHERE rn > 1
);

-- 6. Renumerar posições consecutivas (0, 1, 2...)
WITH numbered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "targetType"
      ORDER BY "position" ASC, "createdAt" ASC, "id" ASC
    ) - 1 AS new_pos
  FROM "user_favorite"
)
UPDATE "user_favorite" uf
SET "position" = n.new_pos
FROM numbered n
WHERE uf."id" = n."id" AND uf."position" != n.new_pos;
