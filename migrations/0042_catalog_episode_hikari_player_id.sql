-- HIKARI Catálogo Próprio: Associação opcional com episódio do Hikari Player
-- Migration 0042: Adiciona coluna anulável hikari_player_episode_id em catalog_episode

ALTER TABLE "catalog_episode"
  ADD COLUMN IF NOT EXISTS "hikari_player_episode_id" text;
