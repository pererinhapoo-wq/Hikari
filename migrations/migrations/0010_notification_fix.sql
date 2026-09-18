-- HIKARI notifications
-- Recria/garante a tabela de notificações.

create table if not exists "notification" (
  "id" text primary key,
  "userId" text not null,
  "actorId" text,
  "type" text not null,
  "message" text not null,
  "read" boolean not null default false,
  "createdAt" timestamp not null default current_timestamp,

  constraint "notification_user_fk"
    foreign key ("userId")
    references "user" ("id")
    on delete cascade,

  constraint "notification_actor_fk"
    foreign key ("actorId")
    references "user" ("id")
    on delete set null
);

create index if not exists "notification_user_idx"
  on "notification" ("userId");

create index if not exists "notification_user_read_idx"
  on "notification" ("userId", "read");

create index if not exists "notification_created_idx"
  on "notification" ("createdAt");
