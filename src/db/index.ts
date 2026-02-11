import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DEFAULT_DB_PATH = "./data/links.db";

export function getDb(
  dbPath: string = process.env["DATABASE_PATH"] || DEFAULT_DB_PATH
): Database.Database {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
