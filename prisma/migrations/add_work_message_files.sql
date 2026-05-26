ALTER TABLE "work_messages"
  ADD COLUMN IF NOT EXISTS "fileId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'work_messages_fileId_fkey'
  ) THEN
    ALTER TABLE "work_messages"
      ADD CONSTRAINT "work_messages_fileId_fkey"
      FOREIGN KEY ("fileId") REFERENCES "files"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
