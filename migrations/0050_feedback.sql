CREATE TABLE IF NOT EXISTS "feedback" (
  "id" SERIAL PRIMARY KEY,
  "user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "anime_name" TEXT,
  "episode_number" INT,
  "reference_link" TEXT,
  "page_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "feedback_category_idx" ON "feedback"("category");
CREATE INDEX IF NOT EXISTS "feedback_status_idx" ON "feedback"("status");
CREATE INDEX IF NOT EXISTS "feedback_created_at_idx" ON "feedback"("created_at" DESC);
