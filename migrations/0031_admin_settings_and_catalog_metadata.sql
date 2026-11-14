CREATE TABLE IF NOT EXISTS "admin_settings" (
  "key" varchar(128) PRIMARY KEY,
  "value" text NOT NULL,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE "catalog_anime" ADD COLUMN IF NOT EXISTS "hidden" boolean NOT NULL DEFAULT false;
ALTER TABLE "catalog_anime" ADD COLUMN IF NOT EXISTS "score" integer;

CREATE INDEX IF NOT EXISTS "idx_catalog_anime_hidden" ON "catalog_anime" ("hidden");
