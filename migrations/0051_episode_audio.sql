-- Persistência explícita do idioma/áudio do episódio em catalog_episode ("sub" | "dub" | NULL)
-- Migration incremental e não destrutiva: preserva todos os episódios existentes como NULL (sem classificação explícita).

ALTER TABLE "catalog_episode"
  ADD COLUMN IF NOT EXISTS "audio" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'catalog_episode_audio_check'
  ) THEN
    ALTER TABLE "catalog_episode"
      ADD CONSTRAINT "catalog_episode_audio_check"
      CHECK ("audio" IS NULL OR "audio" IN ('sub', 'dub'));
  END IF;
END $$;
