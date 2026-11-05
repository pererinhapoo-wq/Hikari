-- HIKARI — Etapa 5E / Notificações — Fase 5C.3: Remoção de índice redundante
--
-- O índice "notification_user_idx" em ("userId") é redundante com os índices compostos:
-- 1. "notification_user_created_idx" em ("userId", "createdAt" DESC)
-- 2. "notification_user_read_idx" em ("userId", "read")
-- Ambos possuem "userId" como coluna líder (prefixo do índice B-Tree).
--
-- Índices preservados intactos:
-- - "notification_pkey"
-- - "notification_user_read_idx"
-- - "notification_user_created_idx"
-- - "notification_created_idx"
-- - "notification_comment_idx"
-- - "notification_episode_idx"

DROP INDEX IF EXISTS "notification_user_idx";
