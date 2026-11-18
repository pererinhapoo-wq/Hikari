-- HIKARI Catálogo Próprio: Rankings (popularidade e em alta) e índices de consulta por temporada/ano
-- Migration 0037: Colunas popularity e trending em catalog_anime + índices de ordenação e temporada

ALTER TABLE "catalog_anime" ADD COLUMN IF NOT EXISTS "popularity" integer;
ALTER TABLE "catalog_anime" ADD COLUMN IF NOT EXISTS "trending" integer;

CREATE INDEX IF NOT EXISTS "idx_catalog_anime_popularity"
  ON "catalog_anime" ("popularity" DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS "idx_catalog_anime_trending"
  ON "catalog_anime" ("trending" DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS "idx_catalog_anime_score"
  ON "catalog_anime" ("score" DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS "idx_catalog_anime_season_year"
  ON "catalog_anime" ("season", "year");
