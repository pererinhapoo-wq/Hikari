create table if not exists "comment_report" (
  "id" text primary key,
  "commentId" text not null
    references "comment" ("id")
    on delete cascade,
  "userId" text not null
    references "user" ("id")
    on delete cascade,
  "reason" text not null,
  "createdAt" timestamptz
    default CURRENT_TIMESTAMP
    not null,

  constraint "comment_report_unique"
    unique ("commentId", "userId")
);
