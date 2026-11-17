-- Migration 0034: episode_sources for HLS custom player proxy integration
create table if not exists episode_sources (
  id uuid primary key default gen_random_uuid(),
  episode_id text not null,
  provider text not null,            -- ex.: "maximaimg"
  page_url text not null,            -- página de origem, para re-resolver
  direct_url text,                   -- URL m3u8 resolvida, pode expirar
  resolved_at timestamptz,
  priority int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists episode_sources_ep on episode_sources (episode_id, priority);
