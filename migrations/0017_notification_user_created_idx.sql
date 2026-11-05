-- HIKARI — Etapa 5E / Notificações — Fase 5C: Índice composto para feed de notificações
--
-- Otimiza consultas filtradas por "userId" com ordenação decrescente por "createdAt" ("userId", "createdAt" DESC),
-- eliminando o nó explícito de Sort e permitindo varredura indexada direta (Index Scan) com parada antecipada no LIMIT.
--
-- Todos os índices existentes ("notification_user_idx", "notification_user_read_idx",
-- "notification_created_idx", "notification_comment_idx", "notification_episode_idx" e PK)
-- são estritamente preservados nesta migration.

CREATE INDEX IF NOT EXISTS "notification_user_created_idx"
  ON "notification" ("userId", "createdAt" DESC);
