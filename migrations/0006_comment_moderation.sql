create table if not exists "comment_report" (
  "id" text primary key,
  "commentId" text not null references "comment" ("id") on delete cascade,
  "userId" text not null references "user" ("id") on delete cascade,
  "reason" text not null,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  constraint "comment_report_unique" unique ("commentId", "userId")
);

alter table "comment_report"
  add column if not exists "status" text not null default 'pending';

alter table "comment_report"
  add column if not exists "resolvedAt" timestamptz;

alter table "comment_report"
  add column if not exists "resolvedBy" text references "user" ("id") on delete set null;

create index if not exists "comment_report_status_idx"
  on "comment_report" ("status");

create index if not exists "comment_report_comment_idx"
  on "comment_report" ("commentId");
