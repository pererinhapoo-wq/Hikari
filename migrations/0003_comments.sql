-- HIKARI comments
-- Comments are linked to the authenticated user and the watched episode.

create table if not exists "comment" (
  "id" text primary key,
  "userId" text not null
    references "user" ("id") on delete cascade,
  "animeId" text not null,
  "episodeId" text not null,
  "content" text not null,
  "parentId" text
    references "comment" ("id") on delete cascade,
  "isSpoiler" boolean not null default false,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz default CURRENT_TIMESTAMP not null
);

create index if not exists "comment_episode_idx"
  on "comment" ("animeId", "episodeId", "createdAt");

create index if not exists "comment_user_idx"
  on "comment" ("userId");

create index if not exists "comment_parent_idx"
  on "comment" ("parentId");
