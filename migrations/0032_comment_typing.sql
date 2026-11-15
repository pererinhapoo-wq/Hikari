-- HIKARI real-time comment typing indicators
-- Ephemeral per-room typing presence with automatic TTL expiration.

create table if not exists "comment_typing" (
  "animeId" text not null,
  "episodeId" text not null,
  "userId" text not null
    references "user" ("id") on delete cascade,
  "expiresAt" timestamptz not null,
  "updatedAt" timestamptz not null default CURRENT_TIMESTAMP,
  primary key ("animeId", "episodeId", "userId")
);

create index if not exists "comment_typing_room_expires_idx"
  on "comment_typing" ("animeId", "episodeId", "expiresAt");
