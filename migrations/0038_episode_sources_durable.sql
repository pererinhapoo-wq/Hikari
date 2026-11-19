-- Migration 0038: Durable episode_sources metadata (no signed URLs or time= persisted)
ALTER TABLE "episode_sources"
  ADD COLUMN IF NOT EXISTS "external_id" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "lang" text NOT NULL DEFAULT 'sub',
  ADD COLUMN IF NOT EXISTS "quality" text,
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "fail_count" int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_checked_at" timestamptz;

ALTER TABLE "episode_sources"
  ALTER COLUMN "page_url" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "episode_sources_ep_lang_prio_idx"
  ON "episode_sources" ("episode_id", "lang", "priority", "created_at");

-- Migrate legacy anitube22/R2 URLs to durable external_id and purge any persisted time= parameters
UPDATE "episode_sources"
SET
  "external_id" = COALESCE(
    NULLIF("external_id", ''),
    substring(COALESCE("page_url", '') from 'apphd/(\d+)\.mp4'),
    substring(COALESCE("page_url", '') from 'ziphonec/(\d+)\.mp4'),
    substring(COALESCE("page_url", '') from '/tmb/(\d+)/'),
    substring(COALESCE("direct_url", '') from 'ziphonec/(\d+)\.mp4'),
    ''
  ),
  "provider" = CASE
    WHEN COALESCE("page_url", '') ILIKE '%anitube22%'
      OR COALESCE("direct_url", '') ILIKE '%r2.cloudflarestorage.com/ziphonec/%'
      THEN 'anitube22'
    ELSE "provider"
  END,
  "page_url" = CASE
    WHEN COALESCE("page_url", '') ~* '([?&])time=' OR COALESCE("page_url", '') ILIKE '%anitube22%' THEN NULL
    ELSE "page_url"
  END,
  "direct_url" = CASE
    WHEN COALESCE("direct_url", '') ~* '([?&])time=' OR COALESCE("direct_url", '') ILIKE '%r2.cloudflarestorage.com/ziphonec/%' THEN NULL
    ELSE "direct_url"
  END
WHERE COALESCE("page_url", '') ~* '([?&])time='
   OR COALESCE("direct_url", '') ~* '([?&])time='
   OR COALESCE("page_url", '') ILIKE '%anitube22%'
   OR COALESCE("direct_url", '') ILIKE '%r2.cloudflarestorage.com/ziphonec/%';

-- Deduplicate (episode_id, provider, external_id, lang) rows with non-empty external_id before creating unique index
DELETE FROM "episode_sources" a
USING "episode_sources" b
WHERE a."external_id" <> ''
  AND a."episode_id" = b."episode_id"
  AND a."provider" = b."provider"
  AND a."external_id" = b."external_id"
  AND a."lang" = b."lang"
  AND (
    a."priority" > b."priority"
    OR (a."priority" = b."priority" AND a."ctid" > b."ctid")
  );

CREATE UNIQUE INDEX IF NOT EXISTS "episode_sources_ep_prov_ext_lang_uidx"
  ON "episode_sources" ("episode_id", "provider", "external_id", "lang")
  WHERE "external_id" <> '';

-- Purge any legacy time= or signed anitube22 URLs from catalog_episode
UPDATE "catalog_episode"
SET
  "videoUrl" = CASE
    WHEN COALESCE("videoUrl", '') ~* '(anitube22|apphd/\d+\.mp4|ziphonec/\d+\.mp4|([?&])time=)' THEN
      CASE
        WHEN COALESCE(substring("videoUrl" from 'apphd/(\d+)\.mp4'), substring("videoUrl" from 'ziphonec/(\d+)\.mp4'), substring("videoUrl" from '/tmb/(\d+)/')) IS NOT NULL
          THEN 'anitube22://sub/' || COALESCE(substring("videoUrl" from 'apphd/(\d+)\.mp4'), substring("videoUrl" from 'ziphonec/(\d+)\.mp4'), substring("videoUrl" from '/tmb/(\d+)/'))
        ELSE NULLIF(rtrim(regexp_replace("videoUrl", '([?&])time=[^&]*&?', '\1', 'gi'), '?&'), '')
      END
    ELSE "videoUrl"
  END,
  "videoUrl2" = CASE
    WHEN COALESCE("videoUrl2", '') ~* '(anitube22|apphd/\d+\.mp4|ziphonec/\d+\.mp4|([?&])time=)' THEN
      CASE
        WHEN COALESCE(substring("videoUrl2" from 'apphd/(\d+)\.mp4'), substring("videoUrl2" from 'ziphonec/(\d+)\.mp4'), substring("videoUrl2" from '/tmb/(\d+)/')) IS NOT NULL
          THEN 'anitube22://sub/' || COALESCE(substring("videoUrl2" from 'apphd/(\d+)\.mp4'), substring("videoUrl2" from 'ziphonec/(\d+)\.mp4'), substring("videoUrl2" from '/tmb/(\d+)/'))
        ELSE NULLIF(rtrim(regexp_replace("videoUrl2", '([?&])time=[^&]*&?', '\1', 'gi'), '?&'), '')
      END
    ELSE "videoUrl2"
  END,
  "videoUrl3" = CASE
    WHEN COALESCE("videoUrl3", '') ~* '(anitube22|apphd/\d+\.mp4|ziphonec/\d+\.mp4|([?&])time=)' THEN
      CASE
        WHEN COALESCE(substring("videoUrl3" from 'apphd/(\d+)\.mp4'), substring("videoUrl3" from 'ziphonec/(\d+)\.mp4'), substring("videoUrl3" from '/tmb/(\d+)/')) IS NOT NULL
          THEN 'anitube22://sub/' || COALESCE(substring("videoUrl3" from 'apphd/(\d+)\.mp4'), substring("videoUrl3" from 'ziphonec/(\d+)\.mp4'), substring("videoUrl3" from '/tmb/(\d+)/'))
        ELSE NULLIF(rtrim(regexp_replace("videoUrl3", '([?&])time=[^&]*&?', '\1', 'gi'), '?&'), '')
      END
    ELSE "videoUrl3"
  END,
  "videoUrl4" = CASE
    WHEN COALESCE("videoUrl4", '') ~* '(anitube22|apphd/\d+\.mp4|ziphonec/\d+\.mp4|([?&])time=)' THEN
      CASE
        WHEN COALESCE(substring("videoUrl4" from 'apphd/(\d+)\.mp4'), substring("videoUrl4" from 'ziphonec/(\d+)\.mp4'), substring("videoUrl4" from '/tmb/(\d+)/')) IS NOT NULL
          THEN 'anitube22://sub/' || COALESCE(substring("videoUrl4" from 'apphd/(\d+)\.mp4'), substring("videoUrl4" from 'ziphonec/(\d+)\.mp4'), substring("videoUrl4" from '/tmb/(\d+)/'))
        ELSE NULLIF(rtrim(regexp_replace("videoUrl4", '([?&])time=[^&]*&?', '\1', 'gi'), '?&'), '')
      END
    ELSE "videoUrl4"
  END,
  "videoUrl5" = CASE
    WHEN COALESCE("videoUrl5", '') ~* '(anitube22|apphd/\d+\.mp4|ziphonec/\d+\.mp4|([?&])time=)' THEN
      CASE
        WHEN COALESCE(substring("videoUrl5" from 'apphd/(\d+)\.mp4'), substring("videoUrl5" from 'ziphonec/(\d+)\.mp4'), substring("videoUrl5" from '/tmb/(\d+)/')) IS NOT NULL
          THEN 'anitube22://sub/' || COALESCE(substring("videoUrl5" from 'apphd/(\d+)\.mp4'), substring("videoUrl5" from 'ziphonec/(\d+)\.mp4'), substring("videoUrl5" from '/tmb/(\d+)/'))
        ELSE NULLIF(rtrim(regexp_replace("videoUrl5", '([?&])time=[^&]*&?', '\1', 'gi'), '?&'), '')
      END
    ELSE "videoUrl5"
  END
WHERE COALESCE("videoUrl", '') ~* '([?&])time=|anitube22|apphd/\d+\.mp4|ziphonec/\d+\.mp4'
   OR COALESCE("videoUrl2", '') ~* '([?&])time=|anitube22|apphd/\d+\.mp4|ziphonec/\d+\.mp4'
   OR COALESCE("videoUrl3", '') ~* '([?&])time=|anitube22|apphd/\d+\.mp4|ziphonec/\d+\.mp4'
   OR COALESCE("videoUrl4", '') ~* '([?&])time=|anitube22|apphd/\d+\.mp4|ziphonec/\d+\.mp4'
   OR COALESCE("videoUrl5", '') ~* '([?&])time=|anitube22|apphd/\d+\.mp4|ziphonec/\d+\.mp4';
