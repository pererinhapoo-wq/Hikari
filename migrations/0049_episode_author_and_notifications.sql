-- HIKARI: Persistência da autoria real de episódios para deduplicação correta de notificações
ALTER TABLE "catalog_episode"
  ADD COLUMN IF NOT EXISTS "authorId" TEXT;

CREATE INDEX IF NOT EXISTS "catalog_episode_author_idx"
  ON "catalog_episode" ("authorId")
  WHERE "authorId" IS NOT NULL;
