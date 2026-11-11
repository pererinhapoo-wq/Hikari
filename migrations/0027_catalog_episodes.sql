-- HIKARI Catálogo Próprio: Episódios
-- Migration 0027: Estrutura canônica de episódios vinculada a catalog_anime

create table if not exists "catalog_episode" (
  "id" text not null primary key,
  "animeId" text not null
    references "catalog_anime" ("id")
    on delete cascade,
  "seasonNumber" integer not null default 1,
  "number" integer not null,
  "title" text,
  "thumbnail" text,
  "duration" text,
  "synopsis" text,
  "videoUrl" text,
  "videoUrl2" text,
  "videoUrl3" text,
  "videoUrl4" text,
  "videoUrl5" text,
  "published" boolean not null default true,
  "publishedAt" timestamptz default current_timestamp,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp,
  constraint "catalog_episode_anime_season_number_key"
    unique ("animeId", "seasonNumber", "number")
);

-- Índice por anime para recuperação ágil das temporadas do título
create index if not exists "catalog_episode_animeId_idx"
  on "catalog_episode" ("animeId");

-- Índice para episódios publicados recentes
create index if not exists "catalog_episode_published_recent_idx"
  on "catalog_episode" ("published", "publishedAt" desc, "createdAt" desc);
