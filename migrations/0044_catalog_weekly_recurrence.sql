-- HIKARI Catálogo Próprio: Programação Semanal Recorrente
-- Migration 0044: Tabela dedicada para recorrências semanais de animes sem exigir data/horário específico

CREATE TABLE IF NOT EXISTS "catalog_weekly_recurrence" (
  "id" text NOT NULL PRIMARY KEY,
  "animeId" text NOT NULL REFERENCES "catalog_anime" ("id") ON DELETE CASCADE,
  "dayOfWeek" smallint NOT NULL CHECK ("dayOfWeek" >= 0 AND "dayOfWeek" <= 6),
  "timezone" text NOT NULL DEFAULT 'America/Sao_Paulo',
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_weekly_recurrence_anime_day_key" UNIQUE ("animeId", "dayOfWeek")
);

CREATE INDEX IF NOT EXISTS "idx_catalog_weekly_recurrence_active_day"
  ON "catalog_weekly_recurrence" ("active", "dayOfWeek");

CREATE INDEX IF NOT EXISTS "idx_catalog_weekly_recurrence_animeId"
  ON "catalog_weekly_recurrence" ("animeId");
