CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  x_handle TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  homepage_url TEXT,
  repo_url TEXT,
  owner_handle TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS products_handle_slug_unique ON products (x_handle, slug);

CREATE TABLE IF NOT EXISTS product_metrics (
  product_id TEXT PRIMARY KEY NOT NULL,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS launches (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL,
  x_url TEXT NOT NULL,
  x_post_id TEXT,
  author_name TEXT,
  author_url TEXT,
  raw_text TEXT NOT NULL,
  hashtags TEXT NOT NULL,
  is_maker_post INTEGER NOT NULL DEFAULT 0,
  ingested_at INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS launches_x_url_unique ON launches (x_url);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL,
  x_handle TEXT NOT NULL,
  claim_token TEXT NOT NULL,
  status TEXT NOT NULL,
  verification_launch_id TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  verified_at INTEGER,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (verification_launch_id) REFERENCES launches(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS claims_token_unique ON claims (claim_token);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  vote_date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS votes_product_fingerprint_date_unique
  ON votes (product_id, fingerprint, vote_date);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  fingerprint TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
