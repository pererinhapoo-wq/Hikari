-- HIKARI: Tabela de progresso desvinculada de transação direta por heartbeat
-- Usada pelo dreno assíncrono em lote (batch upsert) do Redis.

create table if not exists "progress" (
  "user_key" text not null,
  "episode_id" text not null,
  "position" integer not null default 0,
  "duration" integer not null default 0,
  "updated_at" timestamptz not null default current_timestamp,
  primary key ("user_key", "episode_id")
);

create unique index if not exists "progress_user_key_episode_id_uidx"
  on "progress" ("user_key", "episode_id");

create index if not exists "progress_updated_at_idx"
  on "progress" ("updated_at" desc);
