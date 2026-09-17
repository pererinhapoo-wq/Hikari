-- HIKARI - curtidas dos comentários

create table if not exists "comment_like" (
  "id" text primary key,
  "commentId" text not null
    references "comment" ("id") on delete cascade,
  "userId" text not null
    references "user" ("id") on delete cascade,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,

  constraint "comment_like_unique"
    unique ("commentId", "userId")
);

create index if not exists "comment_like_comment_idx"
  on "comment_like" ("commentId");

create index if not exists "comment_like_user_idx"
  on "comment_like" ("userId");
