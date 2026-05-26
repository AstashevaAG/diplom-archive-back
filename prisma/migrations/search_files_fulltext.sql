-- Keep work full-text search professional: title/metadata + extracted PDF/DOCX text.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE works ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_work_search ON works USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_work_title_trgm ON works USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_work_description_trgm ON works USING GIN(description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_work_annotation_trgm ON works USING GIN(annotation gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_file_text_content_trgm ON files USING GIN("textContent" gin_trgm_ops);

UPDATE works w
SET "fullText" = NULLIF(aggregated.text_content, '')
FROM (
  SELECT
    f."workId",
    string_agg(f."textContent", E'\n\n' ORDER BY f.version DESC, f."createdAt" DESC) AS text_content
  FROM files f
  WHERE f."textContent" IS NOT NULL AND f."textContent" <> ''
  GROUP BY f."workId"
) aggregated
WHERE aggregated."workId" = w.id;

CREATE OR REPLACE FUNCTION update_work_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('russian', concat_ws(' ', COALESCE(NEW.title, ''), COALESCE(array_to_string(NEW.tags, ' '), ''))), 'A') ||
    setweight(to_tsvector('russian', concat_ws(' ', COALESCE(NEW.description, ''), COALESCE(NEW.annotation, ''))), 'B') ||
    setweight(to_tsvector('russian', COALESCE(NEW."fullText", '')), 'C');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_work_search_vector ON works;
CREATE TRIGGER trg_work_search_vector
  BEFORE INSERT OR UPDATE ON works
  FOR EACH ROW EXECUTE FUNCTION update_work_search_vector();

UPDATE works SET title = title;
