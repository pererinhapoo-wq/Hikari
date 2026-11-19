-- Migration 0040: Add name_path, url_path, img_url for anitube22 sources and mark legacy incomplete sources
ALTER TABLE "episode_sources"
  ADD COLUMN IF NOT EXISTS "name_path" text,
  ADD COLUMN IF NOT EXISTS "url_path" text,
  ADD COLUMN IF NOT EXISTS "img_url" text;

UPDATE "episode_sources"
SET "status" = 'incomplete'
WHERE "provider" = 'anitube22'
  AND ("name_path" IS NULL OR "url_path" IS NULL OR "name_path" = '' OR "url_path" = '');
