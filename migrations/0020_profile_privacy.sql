-- HIKARI Perfil e Privacidade
-- Expansão da tabela profile e criação de bloqueios e solicitações de seguidores.

-- 1. Expansão da tabela profile (Identidade visual e preferências de privacidade)
alter table "profile"
  add column if not exists "displayName" text,
  add column if not exists "avatarUrl" text,
  add column if not exists "bannerUrl" text,
  add column if not exists "accountType" text not null default 'public' check ("accountType" in ('public', 'private')),
  add column if not exists "allowFollowers" boolean not null default true,
  add column if not exists "privacyLists" text not null default 'public' check ("privacyLists" in ('public', 'followers', 'private')),
  add column if not exists "privacyFavorites" text not null default 'public' check ("privacyFavorites" in ('public', 'followers', 'private')),
  add column if not exists "privacyHistory" text not null default 'public' check ("privacyHistory" in ('public', 'followers', 'private')),
  add column if not exists "privacyComments" text not null default 'public' check ("privacyComments" in ('public', 'followers', 'private')),
  add column if not exists "privacyFollowers" text not null default 'public' check ("privacyFollowers" in ('public', 'followers', 'private'));

-- 2. Tabela de Bloqueios entre Usuários (user_block)
create table if not exists "user_block" (
  "blockerId" text not null
    references "user" ("id")
    on delete cascade,
  "blockedId" text not null
    references "user" ("id")
    on delete cascade,
  "createdAt" timestamptz not null default current_timestamp,
  primary key ("blockerId", "blockedId"),
  check ("blockerId" <> "blockedId")
);

create index if not exists "user_block_blocked_idx"
  on "user_block" ("blockedId");

-- 3. Tabela de Solicitações de Seguidor para Perfis Privados (user_follow_request)
create table if not exists "user_follow_request" (
  "requesterId" text not null
    references "user" ("id")
    on delete cascade,
  "targetId" text not null
    references "user" ("id")
    on delete cascade,
  "status" text not null default 'pending'
    check ("status" in ('pending', 'rejected')),
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp,
  primary key ("requesterId", "targetId"),
  check ("requesterId" <> "targetId")
);

create index if not exists "user_follow_request_target_idx"
  on "user_follow_request" ("targetId", "status");
