CREATE TABLE IF NOT EXISTS "profile_report" (
  "id" TEXT PRIMARY KEY,
  "reporterUserId" TEXT NOT NULL,
  "reportedUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending', -- pending, reviewing, resolved, rejected
  "adminNotes" TEXT,
  "resolvedBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_profile_report_reported_user" ON "profile_report" ("reportedUserId");
CREATE INDEX IF NOT EXISTS "idx_profile_report_status" ON "profile_report" ("status");
CREATE INDEX IF NOT EXISTS "idx_profile_report_created" ON "profile_report" ("createdAt" DESC);
