-- HIKARI - suporte a dislikes em comentários
-- Adiciona a coluna "type" com valor padrão 'like' para preservar 100% dos dados existentes.

alter table "comment_like"
  add column if not exists "type" text not null default 'like';

create index if not exists "comment_like_type_idx"
  on "comment_like" ("commentId", "type");
