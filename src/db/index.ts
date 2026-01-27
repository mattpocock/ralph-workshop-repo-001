import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DEFAULT_DB_PATH = "./data/links.db";
const TEST_DB_PATH = "./data/test-links.db";

function getDatabasePath(): string {
  if (process.env["DATABASE_PATH"]) {
    return process.env["DATABASE_PATH"];
  }
  return process.env["NODE_ENV"] === "test" ? TEST_DB_PATH : DEFAULT_DB_PATH;
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    -- API Keys for authentication
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at INTEGER NOT NULL
    );

    -- Shortened links
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

    -- Tags for organizing links
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    -- Many-to-many relationship between links and tags
    CREATE TABLE IF NOT EXISTS link_tags (
      link_id TEXT REFERENCES links(id) ON DELETE CASCADE,
      tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (link_id, tag_id)
    );

    -- Click tracking
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
  `);
}

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = getDatabasePath();
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    initializeSchema(db);
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
