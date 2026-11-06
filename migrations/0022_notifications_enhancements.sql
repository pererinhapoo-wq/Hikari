-- HIKARI — Etapa 10: Otimizações de Notificações
-- Adiciona índices para deduplicação rápida e feed paginado por estado de leitura.

create index if not exists "notification_dedup_idx"
  on "notification" ("userId", "actorId", "type");

create index if not exists "notification_user_unread_created_idx"
  on "notification" ("userId", "read", "createdAt" desc);
