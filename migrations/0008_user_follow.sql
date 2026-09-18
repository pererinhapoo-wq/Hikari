-- HIKARI user follows
-- Sistema de seguidores e seguindo.

create table if not exists "user_follow" (
  "followerId" text not null
    references "user" ("id")
    on delete cascade,

  "followingId" text not null
    references "user" ("id")
    on delete cascade,

  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,

  primary key (
    "followerId",
    "followingId"
  ),

  check (
    "followerId" <> "followingId"
  )
);

create index if not exists "user_follow_followerId_idx"
  on "user_follow" ("followerId");

create index if not exists "user_follow_followingId_idx"
  on "user_follow" ("followingId");
