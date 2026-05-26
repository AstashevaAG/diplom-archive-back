ALTER TABLE "files"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "files"
  ADD COLUMN IF NOT EXISTS "comment" TEXT;

ALTER TABLE "files"
  ADD COLUMN IF NOT EXISTS "textContent" TEXT;

WITH ranked_files AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "workId"
      ORDER BY "createdAt" ASC, id ASC
    ) AS calculated_version
  FROM "files"
)
UPDATE "files"
SET "version" = ranked_files.calculated_version
FROM ranked_files
WHERE "files".id = ranked_files.id
  AND ("files"."version" IS NULL OR "files"."version" = 1);

CREATE INDEX IF NOT EXISTS "files_work_version_idx"
  ON "files" ("workId", "version" DESC);
