-- HIKARI profile nick
-- Public nickname used to identify users.

alter table "profile"
add column if not exists "nick" text;

create unique index if not exists "profile_nick_unique_idx"
  on "profile" (lower("nick"))
  where "nick" is not null;
