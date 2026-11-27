-- Non-destructive addition of AniList country_of_origin and explicit duplicate link
-- on catalog_anime to support deterministic public Donghua ("CN") and blocklist hiding
-- without deleting records or mutating published / archived_at / hidden flags.

ALTER TABLE "catalog_anime"
  ADD COLUMN IF NOT EXISTS "country_of_origin" text NULL;

ALTER TABLE "catalog_anime"
  ADD COLUMN IF NOT EXISTS "duplicate_of_id" text NULL;

CREATE INDEX IF NOT EXISTS "catalog_anime_country_of_origin_idx"
  ON "catalog_anime" ("country_of_origin")
  WHERE "country_of_origin" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "catalog_anime_duplicate_of_id_idx"
  ON "catalog_anime" ("duplicate_of_id")
  WHERE "duplicate_of_id" IS NOT NULL;
