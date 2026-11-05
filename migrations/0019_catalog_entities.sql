-- HIKARI Catálogo Próprio
-- Estrutura relacional para animes, personagens, estúdios, empresas, pessoas e elenco.

-- 1. Animes Canônicos
create table if not exists "catalog_anime" (
  "id" text not null primary key,
  "title" text not null,
  "anilistId" integer unique,
  "malId" integer unique,
  "kitsuId" integer unique,
  "titleRomaji" text,
  "titleEnglish" text,
  "titleNative" text,
  "cover" text,
  "banner" text,
  "synopsis" text,
  "format" text,
  "status" text,
  "episodesCount" integer,
  "year" integer,
  "season" text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);

-- 2. Personagens
create table if not exists "catalog_character" (
  "id" text not null primary key,
  "name" text not null,
  "nativeName" text,
  "imageUrl" text,
  "description" text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);

-- 3. Estúdios de Animação
create table if not exists "catalog_studio" (
  "id" text not null primary key,
  "name" text not null unique,
  "logoUrl" text,
  "establishedYear" integer,
  "description" text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);

-- 4. Empresas (Produtoras, Distribuidoras, Licenciadoras)
create table if not exists "catalog_company" (
  "id" text not null primary key,
  "name" text not null unique,
  "logoUrl" text,
  "website" text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);

-- 5. Pessoas (Dubladores, Diretores, Roteiristas, Autores)
create table if not exists "catalog_person" (
  "id" text not null primary key,
  "name" text not null,
  "nativeName" text,
  "imageUrl" text,
  "biography" text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);

-- 6. Relacionamento Anime <-> Personagem (N:N)
create table if not exists "anime_character" (
  "animeId" text not null
    references "catalog_anime" ("id")
    on delete cascade,
  "characterId" text not null
    references "catalog_character" ("id")
    on delete cascade,
  "role" text not null default 'main'
    check ("role" in ('main', 'supporting', 'background')),
  "createdAt" timestamptz not null default current_timestamp,
  primary key ("animeId", "characterId")
);

-- 7. Dubladores do Personagem no Anime
create table if not exists "character_voice_actor" (
  "animeId" text not null,
  "characterId" text not null,
  "personId" text not null
    references "catalog_person" ("id")
    on delete cascade,
  "language" text not null default 'Japanese',
  "createdAt" timestamptz not null default current_timestamp,
  primary key ("animeId", "characterId", "personId", "language"),
  foreign key ("animeId", "characterId")
    references "anime_character" ("animeId", "characterId")
    on delete cascade
);

-- 8. Relacionamento Anime <-> Estúdios (N:N)
create table if not exists "anime_studio" (
  "animeId" text not null
    references "catalog_anime" ("id")
    on delete cascade,
  "studioId" text not null
    references "catalog_studio" ("id")
    on delete cascade,
  "isMain" boolean not null default true,
  "createdAt" timestamptz not null default current_timestamp,
  primary key ("animeId", "studioId")
);

-- 9. Relacionamento Anime <-> Empresas (N:N)
create table if not exists "anime_company" (
  "animeId" text not null
    references "catalog_anime" ("id")
    on delete cascade,
  "companyId" text not null
    references "catalog_company" ("id")
    on delete cascade,
  "role" text not null default 'producer'
    check ("role" in ('producer', 'licensor', 'distributor')),
  "createdAt" timestamptz not null default current_timestamp,
  primary key ("animeId", "companyId", "role")
);

-- 10. Relacionamento Anime <-> Equipe Técnica / Staff (N:N)
create table if not exists "anime_staff" (
  "animeId" text not null
    references "catalog_anime" ("id")
    on delete cascade,
  "personId" text not null
    references "catalog_person" ("id")
    on delete cascade,
  "role" text not null,
  "createdAt" timestamptz not null default current_timestamp,
  primary key ("animeId", "personId", "role")
);

-- Índices de Performance e Chaves Estrangeiras Reversas
create index if not exists "anime_character_characterId_idx"
  on "anime_character" ("characterId");

create index if not exists "character_voice_actor_personId_idx"
  on "character_voice_actor" ("personId");

create index if not exists "character_voice_actor_lookup_idx"
  on "character_voice_actor" ("animeId", "characterId");

create index if not exists "anime_studio_studioId_idx"
  on "anime_studio" ("studioId");

create index if not exists "anime_company_companyId_idx"
  on "anime_company" ("companyId");

create index if not exists "anime_staff_personId_idx"
  on "anime_staff" ("personId");

-- Índices de consulta externa para catalog_anime
create index if not exists "catalog_anime_anilist_idx"
  on "catalog_anime" ("anilistId")
  where "anilistId" is not null;

create index if not exists "catalog_anime_mal_idx"
  on "catalog_anime" ("malId")
  where "malId" is not null;

create index if not exists "catalog_anime_kitsu_idx"
  on "catalog_anime" ("kitsuId")
  where "kitsuId" is not null;
