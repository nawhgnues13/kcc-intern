CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE articles
  DROP CONSTRAINT IF EXISTS chk_articles_category;

ALTER TABLE articles
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS body_text,
  DROP COLUMN IF EXISTS generation_instruction,
  ADD COLUMN IF NOT EXISTS template_style varchar(100),
  ADD COLUMN IF NOT EXISTS body_content jsonb,
  ADD COLUMN IF NOT EXISTS generation_meta jsonb;

UPDATE articles
SET
  template_style = COALESCE(template_style, 'default'),
  body_content = COALESCE(
    body_content,
    jsonb_build_object('type', 'doc', 'content', jsonb_build_array())
  )
WHERE template_style IS NULL
   OR body_content IS NULL;

ALTER TABLE articles
  ALTER COLUMN template_style SET NOT NULL,
  ALTER COLUMN body_content SET NOT NULL;

CREATE TABLE IF NOT EXISTS article_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  source_type varchar(30) NOT NULL,
  original_name varchar(255),
  source_url text,
  storage_url text,
  mime_type varchar(100),
  extracted_text text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_article_sources_type
    CHECK (source_type IN ('url', 'pdf', 'image'))
);

CREATE TABLE IF NOT EXISTS article_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL,
  message_text text NOT NULL,
  message_kind varchar(30),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_article_ai_messages_role
    CHECK (role IN ('user', 'assistant', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_articles_topic
  ON articles (topic);

CREATE INDEX IF NOT EXISTS idx_articles_template_style
  ON articles (template_style);

CREATE INDEX IF NOT EXISTS idx_article_sources_article_id
  ON article_sources (article_id);

CREATE INDEX IF NOT EXISTS idx_article_sources_source_type
  ON article_sources (source_type);

CREATE INDEX IF NOT EXISTS idx_article_ai_messages_article_id
  ON article_ai_messages (article_id);

CREATE INDEX IF NOT EXISTS idx_article_ai_messages_created_at
  ON article_ai_messages (article_id, created_at);
