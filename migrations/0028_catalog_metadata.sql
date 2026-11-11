-- HIKARI Metadados de Catálogo, Temporadas e Perfil
-- Migration 0028: role em profile, genres e trailerId em catalog_anime, e tabela catalog_season

-- 1. Perfil: papel do usuário e índice parcial para funções privilegiadas
alter table "profile"
  add column if not exists "role" text not null default 'user';

create index if not exists "profile_role_non_user_idx"
  on "profile" ("role")
  where "role" != 'user';

-- 2. Catálogo: gêneros (array de texto) e trailer do título
alter table "catalog_anime"
  add column if not exists "genres" text[] not null default '{}';

alter table "catalog_anime"
  add column if not exists "trailerId" text;

-- 3. Temporadas: catalog_season para organização e títulos oficiais de cada temporada
create table if not exists "catalog_season" (
  "animeId" text not null
    references "catalog_anime" ("id")
    on delete cascade,
  "number" integer not null,
  "title" text,
  "position" integer not null default 0,
  "createdAt" timestamptz not null default current_timestamp,
  primary key ("animeId", "number")
);

-- Índice por anime e posição para ordenação canônica das temporadas
create index if not exists "catalog_season_anime_position_idx"
  on "catalog_season" ("animeId", "position");
