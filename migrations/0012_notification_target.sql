-- HIKARI notifications
-- Adiciona o destino da notificação:
-- anime, episódio e comentário relacionado.

alter table "notification"
  add column if not exists "commentId" text,
  add column if not exists "animeId" text,
  add column if not exists "episodeId" text;

create index if not exists "notification_comment_idx"
  on "notification" ("commentId");

create index if not exists "notification_episode_idx"
  on "notification" ("animeId", "episodeId");
