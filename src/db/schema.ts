export const schema = `
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  target_url TEXT NOT NULL,
  api_key_id TEXT REFERENCES api_keys(id),
  password_hash TEXT,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS link_tags (
  link_id TEXT REFERENCES links(id) ON DELETE CASCADE,
  tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (link_id, tag_id)
);

CREATE TABLE IF NOT EXISTS clicks (
  id TEXT PRIMARY KEY,
  link_id TEXT REFERENCES links(id) ON DELETE CASCADE,
  timestamp INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT,
  referrer TEXT,
  country TEXT,
  city TEXT
);
`;
