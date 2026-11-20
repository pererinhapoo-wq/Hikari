-- HIKARI: Adiciona colunas para tempos de início e fim da opening nos episódios do catálogo
ALTER TABLE "catalog_episode" ADD COLUMN IF NOT EXISTS "opening_start_seconds" INTEGER;
ALTER TABLE "catalog_episode" ADD COLUMN IF NOT EXISTS "opening_end_seconds" INTEGER;
