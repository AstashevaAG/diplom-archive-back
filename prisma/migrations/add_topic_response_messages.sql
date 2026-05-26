CREATE TABLE IF NOT EXISTS "topic_response_messages" (
  "id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorId" TEXT NOT NULL,
  "responseId" TEXT NOT NULL,

  CONSTRAINT "topic_response_messages_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "topic_response_messages"
  ADD CONSTRAINT "topic_response_messages_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "topic_response_messages"
  ADD CONSTRAINT "topic_response_messages_responseId_fkey"
  FOREIGN KEY ("responseId") REFERENCES "topic_responses"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

