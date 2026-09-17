-- HIKARI user profile
-- Extra profile data kept separately from Better Auth.

create table if not exists "profile" (
  "userId" text not null primary key
    references "user" ("id") on delete cascade,
  "bio" text,
  "favorites" text,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz default CURRENT_TIMESTAMP not null
);

create index if not exists "profile_userId_idx"
  on "profile" ("userId");
