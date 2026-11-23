-- Controle manual individual dos selos LANÇAMENTO, NOVO e FINAL por episódio.
-- Nenhum backfill de selos globais antigos é executado: episódios existentes iniciam com FALSE.

ALTER TABLE "catalog_episode"
  ADD COLUMN IF NOT EXISTS "badge_lancamento" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "badge_novo" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "badge_final" BOOLEAN NOT NULL DEFAULT FALSE;
