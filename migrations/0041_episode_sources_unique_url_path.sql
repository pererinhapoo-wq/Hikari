-- Migration 0041: Update unique index on episode_sources to (episode_id, provider, lang, url_path)
DROP INDEX IF EXISTS "episode_sources_ep_prov_ext_lang_uidx";

CREATE UNIQUE INDEX IF NOT EXISTS "episode_sources_ep_prov_lang_url_uidx"
  ON "episode_sources" ("episode_id", "provider", "lang", "url_path")
  WHERE "url_path" IS NOT NULL AND "url_path" <> '';
