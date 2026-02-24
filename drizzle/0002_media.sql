ALTER TABLE products ADD COLUMN image_key TEXT;

CREATE TABLE IF NOT EXISTS launch_media (
  id TEXT PRIMARY KEY NOT NULL,
  launch_id TEXT NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  media_key TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  preview_url TEXT,
  width INTEGER,
  height INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS launch_media_launch_id ON launch_media(launch_id);
