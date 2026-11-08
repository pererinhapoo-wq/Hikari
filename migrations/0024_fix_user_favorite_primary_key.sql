-- HIKARI Perfil: Correção da chave primária da tabela user_favorite
-- Migration 0024: Adiciona coluna "id" (caso ausente), preenche registros legados com UUIDs únicos,
-- define NOT NULL e assegura a chave primária ("id") com qualificação explícita do schema public.

DO $$
DECLARE
  pk_record RECORD;
BEGIN
  -- 1. Adicionar a coluna "id" caso ainda não exista
  ALTER TABLE public."user_favorite" ADD COLUMN IF NOT EXISTS "id" text;

  -- 2. Gerar identificadores únicos para todos os registros legados sem "id"
  UPDATE public."user_favorite"
  SET "id" = gen_random_uuid()::text
  WHERE "id" IS NULL;

  -- 3. Assegurar ausência de valores nulos após o preenchimento
  IF EXISTS (SELECT 1 FROM public."user_favorite" WHERE "id" IS NULL) THEN
    RAISE EXCEPTION 'user_favorite: Existem registros com id nulo após a geração de identificadores.';
  END IF;

  -- 4. Garantir ausência de identificadores duplicados na coluna "id"
  IF EXISTS (
    SELECT 1
    FROM public."user_favorite"
    GROUP BY "id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'user_favorite: Identificadores duplicados encontrados na coluna id.';
  END IF;

  -- 5. Definir a coluna "id" como NOT NULL
  ALTER TABLE public."user_favorite" ALTER COLUMN "id" SET NOT NULL;

  -- 6. Inspecionar chave primária existente para idempotência e proteção contra conflitos
  SELECT
    c.conname,
    array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum)) AS cols
  INTO pk_record
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  WHERE c.conrelid = 'public.user_favorite'::regclass
    AND c.contype = 'p'
  GROUP BY c.conname;

  IF pk_record.conname IS NOT NULL THEN
    IF pk_record.cols = ARRAY['id']::text[] THEN
      RAISE NOTICE 'Chave primária em public.user_favorite(id) já existe e está correta.';
    ELSE
      -- Interrompe a execução caso exista uma PK incompatível sem removê-la automaticamente
      RAISE EXCEPTION 'user_favorite possui uma chave primária incompatível (%) nas colunas %, diferente de ("id").',
        pk_record.conname, pk_record.cols;
    END IF;
  ELSE
    -- Cria a chave primária exclusivamente na coluna "id"
    ALTER TABLE public."user_favorite" ADD CONSTRAINT "user_favorite_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
