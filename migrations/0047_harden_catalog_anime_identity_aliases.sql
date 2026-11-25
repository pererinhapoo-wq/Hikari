-- HIKARI Identidade Estrutural de Animes (Endurecimento)
-- Migration 0047 (aditiva e idempotente):
-- 1. Adiciona "created_at" em "catalog_anime_id_alias" com backfill seguro.
-- 2. Adiciona CHECK constraints não vazias para "old_id" e "current_id".
-- 3. Adiciona índices compostos por versão (legendado/dublado) para lookup inequívoco.
-- 4. Adiciona trigger anti-ciclo em "catalog_anime_id_alias" (bloqueia auto-referência e ciclos multi-hop).
-- 5. Garante remoção de FKs com ON DELETE CASCADE de tabelas de usuário/comentários/notificações -> catalog_anime.

ALTER TABLE "catalog_anime_id_alias"
  ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT current_timestamp;

UPDATE "catalog_anime_id_alias"
SET "created_at" = COALESCE("archived_at", "updated_at", CURRENT_TIMESTAMP)
WHERE "created_at" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'catalog_anime_id_alias'::regclass
      AND conname = 'catalog_anime_id_alias_old_id_nonempty_chk'
  ) THEN
    ALTER TABLE "catalog_anime_id_alias"
      ADD CONSTRAINT "catalog_anime_id_alias_old_id_nonempty_chk"
      CHECK (btrim("old_id") <> '');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'catalog_anime_id_alias'::regclass
      AND conname = 'catalog_anime_id_alias_current_id_nonempty_chk'
  ) THEN
    ALTER TABLE "catalog_anime_id_alias"
      ADD CONSTRAINT "catalog_anime_id_alias_current_id_nonempty_chk"
      CHECK ("current_id" IS NULL OR btrim("current_id") <> '');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_catalog_anime_id_alias_anilist_dub"
  ON "catalog_anime_id_alias" ("anilist_id", "is_dubbed")
  WHERE "anilist_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_catalog_anime_id_alias_mal_dub"
  ON "catalog_anime_id_alias" ("mal_id", "is_dubbed")
  WHERE "mal_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_catalog_anime_id_alias_kitsu_dub"
  ON "catalog_anime_id_alias" ("kitsu_id", "is_dubbed")
  WHERE "kitsu_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_catalog_anime_id_alias_identity_attr"
  ON "catalog_anime_id_alias" ("title_norm", "format", "year", "is_dubbed")
  WHERE "title_norm" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_catalog_anime_active_titles_lookup"
  ON "catalog_anime" (lower(btrim("title")))
  WHERE "archived_at" IS NULL;

CREATE OR REPLACE FUNCTION prevent_catalog_anime_alias_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cursor text;
  v_next text;
  v_steps integer := 0;
  v_visited text[] := ARRAY[NEW."old_id"];
BEGIN
  IF NEW."current_id" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."current_id" = NEW."old_id" THEN
    RAISE EXCEPTION 'Ciclo detectado em catalog_anime_id_alias: % aponta para si mesmo', NEW."old_id";
  END IF;

  v_cursor := NEW."current_id";

  WHILE v_cursor IS NOT NULL AND v_steps < 50 LOOP
    IF v_cursor = NEW."old_id" THEN
      RAISE EXCEPTION 'Ciclo detectado em catalog_anime_id_alias envolvendo % -> %', NEW."old_id", NEW."current_id";
    END IF;

    SELECT "current_id"
      INTO v_next
      FROM "catalog_anime_id_alias"
     WHERE "old_id" = v_cursor
     LIMIT 1;

    EXIT WHEN NOT FOUND OR v_next IS NULL;

    IF v_next = NEW."old_id" OR v_next = ANY(v_visited) THEN
      RAISE EXCEPTION 'Ciclo multi-hop detectado em catalog_anime_id_alias para % -> %', NEW."old_id", NEW."current_id";
    END IF;

    v_visited := array_append(v_visited, v_next);
    v_cursor := v_next;
    v_steps := v_steps + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_prevent_catalog_anime_alias_cycle" ON "catalog_anime_id_alias";

CREATE TRIGGER "trg_prevent_catalog_anime_alias_cycle"
BEFORE INSERT OR UPDATE OF "old_id", "current_id" ON "catalog_anime_id_alias"
FOR EACH ROW
EXECUTE FUNCTION prevent_catalog_anime_alias_cycle();

-- Garantir que nenhuma tabela de dados de usuário, comentários ou notificações possua FK
-- com ON DELETE CASCADE ou ON DELETE SET NULL apontando para catalog_anime.
DO $$
DECLARE
  fk_record RECORD;
  protected_tables text[] := ARRAY[
    'user_anime_tracking',
    'user_custom_list_item',
    'user_episode_progress',
    'user_watched_episode',
    'user_favorite',
    'comment',
    'notification'
  ];
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY protected_tables LOOP
    IF to_regclass(format('%I', tbl)) IS NOT NULL THEN
      FOR fk_record IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = format('%I', tbl)::regclass
          AND c.confrelid = 'catalog_anime'::regclass
          AND c.contype = 'f'
      LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', tbl, fk_record.conname);
      END LOOP;
    END IF;
  END LOOP;
END $$;
