-- HIKARI — Etapa 10.1: Deduplicação Persistente de Notificações
-- Adiciona a coluna dedupKey com constraint UNIQUE e índice para idempotência e concorrência atômica.

alter table "notification"
  add column if not exists "dedupKey" text;

-- Popula dedupKey para registros pré-existentes
update "notification"
set "dedupKey" = case
  when "type" = 'new_follower' then 'new_follower:' || "userId" || ':' || coalesce("actorId", '')
  when "type" = 'follow_request' then 'follow_request:' || "userId" || ':' || coalesce("actorId", '')
  when "type" = 'follow_accept' then 'follow_accept:' || "userId" || ':' || coalesce("actorId", '')
  when "type" = 'comment_like' and "commentId" is not null then 'comment_like:' || "userId" || ':' || "commentId"
  when "type" = 'comment_reply' and "commentId" is not null then 'comment_reply:' || "userId" || ':' || coalesce("actorId", '') || ':' || "commentId"
  else "type" || ':' || "userId" || ':' || coalesce("actorId", '') || ':' || coalesce("commentId", "id")
end
where "dedupKey" is null;

-- Se houverem duplicatas históricas para a mesma dedupKey, mantém apenas a mais recente antes de criar o índice UNIQUE
delete from "notification" n
where n."id" not in (
  select distinct on ("dedupKey") "id"
  from "notification"
  where "dedupKey" is not null
  order by "dedupKey", "createdAt" desc, "id" desc
)
and n."dedupKey" is not null;

-- Cria índice UNIQUE garantindo atomicidade no banco
create unique index if not exists "notification_dedup_key_uidx"
  on "notification" ("dedupKey");
