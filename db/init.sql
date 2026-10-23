CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS images (
  id text PRIMARY KEY,
  title text NOT NULL,
  image_url text NOT NULL,
  thumb_url text NOT NULL,
  category text NOT NULL,
  orientation text NOT NULL CHECK (orientation IN ('portrait', 'landscape', 'square')),
  width integer NOT NULL,
  height integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  tags text[] NOT NULL DEFAULT '{}',
  embedding vector(512)
);

CREATE INDEX IF NOT EXISTS images_feed_cursor_idx
  ON images (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS images_category_feed_idx
  ON images (category, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS images_tags_idx ON images USING gin (tags);
CREATE INDEX IF NOT EXISTS images_embedding_hnsw_idx
  ON images USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
