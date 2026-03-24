-- CreateExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create search vector column (will be managed via trigger)
-- Note: Prisma doesn't natively support tsvector, so we manage it via raw SQL

-- After running prisma migrate, execute this migration manually or via a seed script:

-- Add tsvector column
ALTER TABLE works ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_work_search ON works USING GIN(search_vector);

-- GIN index for fuzzy title search
CREATE INDEX IF NOT EXISTS idx_work_title_trgm ON works USING GIN(title gin_trgm_ops);

-- GIN index for fuzzy annotation search
CREATE INDEX IF NOT EXISTS idx_work_annotation_trgm ON works USING GIN(annotation gin_trgm_ops);

-- Trigger function to auto-update search_vector
CREATE OR REPLACE FUNCTION update_work_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('russian', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('russian', COALESCE(NEW.annotation, '')), 'B') ||
    setweight(to_tsvector('russian', COALESCE(NEW.full_text, '')), 'C') ||
    setweight(to_tsvector('russian', COALESCE(array_to_string(NEW.tags, ' '), '')), 'A');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_work_search_vector ON works;
CREATE TRIGGER trg_work_search_vector
  BEFORE INSERT OR UPDATE ON works
  FOR EACH ROW EXECUTE FUNCTION update_work_search_vector();
