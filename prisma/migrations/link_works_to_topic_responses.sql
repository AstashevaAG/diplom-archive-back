ALTER TABLE "works"
  ADD COLUMN IF NOT EXISTS "topicResponseId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "works_topicResponseId_key"
  ON "works"("topicResponseId");

WITH candidates AS (
  SELECT
    w."id" AS "workId",
    tr."id" AS "responseId",
    ROW_NUMBER() OVER (
      PARTITION BY tr."id"
      ORDER BY w."createdAt" DESC, w."id"
    ) AS "responseRank",
    ROW_NUMBER() OVER (
      PARTITION BY w."id"
      ORDER BY tr."createdAt" DESC, tr."id"
    ) AS "workRank"
  FROM "works" w
  JOIN "topic_responses" tr ON tr."studentId" = w."authorId"
  JOIN "supervisor_topics" st ON st."id" = tr."topicId"
  WHERE w."topicResponseId" IS NULL
    AND tr."status" = 'ACCEPTED'
    AND st."supervisorId" = w."supervisorId"
    AND st."title" = w."title"
    AND NOT EXISTS (
      SELECT 1
      FROM "works" other_work
      WHERE other_work."topicResponseId" = tr."id"
    )
),
matched AS (
  SELECT "workId", "responseId"
  FROM candidates
  WHERE "responseRank" = 1 AND "workRank" = 1
)
UPDATE "works" w
SET "topicResponseId" = matched."responseId"
FROM matched
WHERE w."id" = matched."workId"
  AND w."topicResponseId" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'works_topicResponseId_fkey'
  ) THEN
    ALTER TABLE "works"
      ADD CONSTRAINT "works_topicResponseId_fkey"
      FOREIGN KEY ("topicResponseId") REFERENCES "topic_responses"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
