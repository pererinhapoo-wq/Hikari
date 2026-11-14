-- Migration 0030: Otimização de busca por animes com normalização, search_blob e anime_alias

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "catalog_anime" ADD COLUMN IF NOT EXISTS "title_norm" TEXT;
ALTER TABLE "catalog_anime" ADD COLUMN IF NOT EXISTS "search_blob" TEXT;

CREATE TABLE IF NOT EXISTS "anime_alias" (
  "anime_id" TEXT NOT NULL REFERENCES "catalog_anime" ("id") ON DELETE CASCADE,
  "alias" TEXT NOT NULL,
  "alias_norm" TEXT NOT NULL,
  PRIMARY KEY ("anime_id", "alias_norm")
);

CREATE INDEX IF NOT EXISTS "catalog_anime_title_norm_idx" ON "catalog_anime" ("title_norm");
CREATE INDEX IF NOT EXISTS "catalog_anime_search_blob_trgm_idx" ON "catalog_anime" USING gin ("search_blob" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "anime_alias_norm_idx" ON "anime_alias" ("alias_norm");

-- Backfill / atualização inicial de title_norm e search_blob em catalog_anime
UPDATE "catalog_anime"
SET 
  "title_norm" = LOWER(TRIM(COALESCE("title", ''))),
  "search_blob" = LOWER(TRIM(
    COALESCE("title", '') || ' ' ||
    COALESCE("titleRomaji", '') || ' ' ||
    COALESCE("titleEnglish", '') || ' ' ||
    COALESCE("titleNative", '')
  ));
