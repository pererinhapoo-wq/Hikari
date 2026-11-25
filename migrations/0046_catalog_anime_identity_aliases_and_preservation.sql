-- HIKARI Identidade Estrutural de Animes, Aliases Históricos e Preservação de Referências
-- Migration 0046:
-- 1. Soft-archive em catalog_anime ("archived_at") e histórico de episódios ("episode_history").
-- 2. Tabela "catalog_anime_id_alias" mapeando IDs antigos/excluídos -> ID atual ou tombstone.
-- 3. Remoção da FK "user_favorite"."animeId" -> "catalog_anime"."id" (evita ON DELETE CASCADE destrutivo)
--    e adição de "animeSnapshot" jsonb com backfill a partir do catálogo existente.

ALTER TABLE "catalog_anime"
  ADD COLUMN IF NOT EXISTS "archived_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "episode_history" jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS "catalog_anime_active_idx"
  ON "catalog_anime" ("archived_at")
  WHERE "archived_at" IS NULL;

CREATE TABLE IF NOT EXISTS "catalog_anime_id_alias" (
  "old_id" text NOT NULL PRIMARY KEY,
  "current_id" text,
  "anilist_id" integer,
  "mal_id" integer,
  "kitsu_id" integer,
  "title_norm" text,
  "format" text,
  "year" integer,
  "is_dubbed" boolean NOT NULL DEFAULT false,
  "episode_history" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "archived_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT current_timestamp,
  CHECK ("current_id" IS NULL OR "current_id" <> "old_id")
);

CREATE INDEX IF NOT EXISTS "idx_catalog_anime_id_alias_current_id"
  ON "catalog_anime_id_alias" ("current_id")
  WHERE "current_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_catalog_anime_id_alias_anilist_id"
  ON "catalog_anime_id_alias" ("anilist_id")
  WHERE "anilist_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_catalog_anime_id_alias_mal_id"
  ON "catalog_anime_id_alias" ("mal_id")
  WHERE "mal_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_catalog_anime_id_alias_kitsu_id"
  ON "catalog_anime_id_alias" ("kitsu_id")
  WHERE "kitsu_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_catalog_anime_id_alias_title_norm"
  ON "catalog_anime_id_alias" ("title_norm")
  WHERE "title_norm" IS NOT NULL;

-- Remover a constraint FK entre user_favorite.animeId e catalog_anime.id
-- para que exclusões ou arquivamentos jamais destruam favoritos via ON DELETE CASCADE.
DO $$
DECLARE
  fk_record RECORD;
BEGIN
  FOR fk_record IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'user_favorite'::regclass
      AND c.confrelid = 'catalog_anime'::regclass
      AND c.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE "user_favorite" DROP CONSTRAINT IF EXISTS %I', fk_record.conname);
  END LOOP;
END $$;

ALTER TABLE "user_favorite"
  ADD COLUMN IF NOT EXISTS "animeSnapshot" jsonb;

-- Backfill seguro de animeSnapshot nos favoritos existentes vinculados a catalog_anime
UPDATE "user_favorite" uf
SET "animeSnapshot" = jsonb_strip_nulls(
  jsonb_build_object(
    'title', ca."title",
    'titleRomaji', ca."titleRomaji",
    'titleEnglish', ca."titleEnglish",
    'titleNative', ca."titleNative",
    'cover', ca."cover",
    'banner', ca."banner",
    'synopsis', ca."synopsis",
    'format', ca."format",
    'year', ca."year",
    'episodesCount', ca."episodesCount",
    'status', ca."status",
    'anilistId', ca."anilistId",
    'malId', ca."malId",
    'kitsuId', ca."kitsuId",
    'serverCatalogId', ca."id"
  )
)
FROM "catalog_anime" ca
WHERE uf."targetType" = 'anime'
  AND uf."animeSnapshot" IS NULL
  AND uf."animeId" = ca."id";
