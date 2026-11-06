-- HIKARI Perfil: favoritos, acompanhamento, listas e histórico de reprodução.
-- Migration 0021: seis tabelas relacionais; não importa dados antigos do localStorage.

-- 1. Favoritos oficiais do Perfil (anime, personagem, estúdio, empresa e pessoa).
create table if not exists "user_favorite" (
  "userId" text not null
    references "user" ("id") on delete cascade,
  "targetType" text not null
    check ("targetType" in ('anime', 'character', 'studio', 'company', 'person')),
  "animeId" text
    references "catalog_anime" ("id") on delete cascade,
  "characterId" text
    references "catalog_character" ("id") on delete cascade,
  "studioId" text
    references "catalog_studio" ("id") on delete cascade,
  "companyId" text
    references "catalog_company" ("id") on delete cascade,
  "personId" text
    references "catalog_person" ("id") on delete cascade,
  "position" integer not null default 0 check ("position" >= 0),
  "createdAt" timestamptz not null default current_timestamp,
  check (
    ("targetType" = 'anime'
      and "animeId" is not null
      and "characterId" is null and "studioId" is null
      and "companyId" is null and "personId" is null)
    or
    ("targetType" = 'character'
      and "characterId" is not null
      and "animeId" is null and "studioId" is null
      and "companyId" is null and "personId" is null)
    or
    ("targetType" = 'studio'
      and "studioId" is not null
      and "animeId" is null and "characterId" is null
      and "companyId" is null and "personId" is null)
    or
    ("targetType" = 'company'
      and "companyId" is not null
      and "animeId" is null and "characterId" is null
      and "studioId" is null and "personId" is null)
    or
    ("targetType" = 'person'
      and "personId" is not null
      and "animeId" is null and "characterId" is null
      and "studioId" is null and "companyId" is null)
  )
);

create unique index if not exists "user_favorite_user_anime_uidx"
  on "user_favorite" ("userId", "animeId")
  where "animeId" is not null;
create unique index if not exists "user_favorite_user_character_uidx"
  on "user_favorite" ("userId", "characterId")
  where "characterId" is not null;
create unique index if not exists "user_favorite_user_studio_uidx"
  on "user_favorite" ("userId", "studioId")
  where "studioId" is not null;
create unique index if not exists "user_favorite_user_company_uidx"
  on "user_favorite" ("userId", "companyId")
  where "companyId" is not null;
create unique index if not exists "user_favorite_user_person_uidx"
  on "user_favorite" ("userId", "personId")
  where "personId" is not null;

-- 2. Estado do usuário em cada anime. animeId não possui FK intencionalmente:
-- IDs locais (local-*) também precisam ser aceitos nesta etapa.
create table if not exists "user_anime_tracking" (
  "userId" text not null
    references "user" ("id") on delete cascade,
  "animeId" text not null,
  "status" text not null default 'planning'
    check ("status" in ('watching', 'completed', 'planning', 'on_hold', 'dropped')),
  "score" numeric(3,1)
    check ("score" is null or ("score" >= 0 and "score" <= 10)),
  "episodesWatched" integer not null default 0 check ("episodesWatched" >= 0),
  "animeSnapshot" jsonb,
  "startedAt" timestamptz,
  "completedAt" timestamptz,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp,
  primary key ("userId", "animeId")
);

create index if not exists "user_anime_tracking_user_status_idx"
  on "user_anime_tracking" ("userId", "status", "updatedAt" desc);

-- 3. Listas personalizadas criadas pelo usuário.
create table if not exists "user_custom_list" (
  "id" text not null primary key,
  "userId" text not null
    references "user" ("id") on delete cascade,
  "title" text not null check (length(trim("title")) > 0),
  "description" text,
  "isPublic" boolean not null default true,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);

create index if not exists "user_custom_list_user_updated_idx"
  on "user_custom_list" ("userId", "updatedAt" desc);

-- 4. Animes pertencentes a uma lista. A propriedade do usuário é herdada
-- da lista; operações no servidor devem validar o dono da lista.
create table if not exists "user_custom_list_item" (
  "listId" text not null
    references "user_custom_list" ("id") on delete cascade,
  "animeId" text not null,
  "position" integer not null default 0 check ("position" >= 0),
  "animeSnapshot" jsonb,
  "addedAt" timestamptz not null default current_timestamp,
  primary key ("listId", "animeId")
);

create index if not exists "user_custom_list_item_order_idx"
  on "user_custom_list_item" ("listId", "position", "addedAt");

-- 5. Progresso técnico de reprodução por episódio. Esta tabela não representa
-- por si só um episódio assistido. A sessão deve ser criada explicitamente.
create table if not exists "user_episode_progress" (
  "userId" text not null
    references "user" ("id") on delete cascade,
  "animeId" text not null,
  "episodeId" text not null,
  "episodeNumber" integer not null check ("episodeNumber" > 0),
  "currentTime" integer not null default 0 check ("currentTime" >= 0),
  "duration" integer,
  "accumulatedTime" integer not null default 0 check ("accumulatedTime" >= 0),
  "accumulatedRemainderMs" integer not null default 0
    check ("accumulatedRemainderMs" between 0 and 999),
  "autoCompleteSuppressed" boolean not null default false,
  "playbackSessionId" text,
  "updatedAt" timestamptz not null default current_timestamp,
  primary key ("userId", "animeId", "episodeId"),
  check ("duration" is null or "duration" > 0),
  check ("duration" is null or "currentTime" <= "duration"),
  check ("duration" is null or "accumulatedTime" <= "duration")
);

create index if not exists "user_episode_progress_user_updated_idx"
  on "user_episode_progress" ("userId", "updatedAt" desc);
create index if not exists "user_episode_progress_user_anime_idx"
  on "user_episode_progress" ("userId", "animeId");

-- 6. Histórico autoritativo de episódios marcados como assistidos.
create table if not exists "user_watched_episode" (
  "userId" text not null
    references "user" ("id") on delete cascade,
  "animeId" text not null,
  "episodeId" text not null,
  "episodeNumber" integer not null check ("episodeNumber" > 0),
  "origin" text not null
    check ("origin" in ('playback', 'manual')),
  "watchedAt" timestamptz not null default current_timestamp,
  primary key ("userId", "animeId", "episodeId")
);

create index if not exists "user_watched_episode_user_anime_recent_idx"
  on "user_watched_episode" ("userId", "animeId", "watchedAt" desc);
create index if not exists "user_watched_episode_user_recent_idx"
  on "user_watched_episode" ("userId", "watchedAt" desc);
