-- HIKARI Catálogo Próprio: Programação Semanal e Proteção de Dados Manuais
-- Migration 0036: Separação de airing schedules de episódios reproduzíveis e auditoria de campos manuais

-- 1. Tabela dedicada para horários de transmissão futuros (Airing Schedules)
CREATE TABLE IF NOT EXISTS "catalog_airing_schedule" (
  "id" text NOT NULL PRIMARY KEY,
  "anilistId" integer NOT NULL,
  "animeId" text NOT NULL REFERENCES "catalog_anime" ("id") ON DELETE CASCADE,
  "episode" integer NOT NULL,
  "airingAt" timestamptz NOT NULL,
  "timeUntilAiring" integer,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_airing_schedule_anilist_ep_key" UNIQUE ("anilistId", "episode")
);

-- Índices de consulta para o calendário e associação de animes
CREATE INDEX IF NOT EXISTS "idx_catalog_airing_schedule_airingAt"
  ON "catalog_airing_schedule" ("airingAt");

CREATE INDEX IF NOT EXISTS "idx_catalog_airing_schedule_animeId"
  ON "catalog_airing_schedule" ("animeId");

-- 2. Coluna para rastrear campos editados manualmente por administradores
-- Permite proteger títulos, sinopses e metadados contra sobrescrita por sincronizações automáticas
ALTER TABLE "catalog_anime" ADD COLUMN IF NOT EXISTS "manual_fields" text[] NOT NULL DEFAULT '{}';
