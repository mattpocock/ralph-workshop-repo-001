import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getDb } from "./index.js";
import { initDb } from "./init.js";

function tmpDbPath(): string {
  return path.join(os.tmpdir(), `test-${Date.now()}-${Math.random()}.db`);
}

describe("database initialization", () => {
  const paths: string[] = [];

  afterEach(() => {
    for (const p of paths) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    paths.length = 0;
  });

  it("should create all tables", () => {
    const dbPath = tmpDbPath();
    paths.push(dbPath);

    initDb(dbPath);

    const db = getDb(dbPath);
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all() as { name: string }[];
    db.close();

    const names = tables.map((t) => t.name);
    expect(names).toContain("api_keys");
    expect(names).toContain("links");
    expect(names).toContain("tags");
    expect(names).toContain("link_tags");
    expect(names).toContain("clicks");
  });

  it("should be idempotent", () => {
    const dbPath = tmpDbPath();
    paths.push(dbPath);

    initDb(dbPath);
    initDb(dbPath);

    const db = getDb(dbPath);
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all() as { name: string }[];
    db.close();

    expect(tables.map((t) => t.name)).toContain("links");
  });

  it("should enforce foreign keys", () => {
    const dbPath = tmpDbPath();
    paths.push(dbPath);

    initDb(dbPath);

    const db = getDb(dbPath);
    expect(() => {
      db.prepare(
        "INSERT INTO links (id, slug, target_url, api_key_id, created_at, updated_at) VALUES ('l1', 'test', 'https://example.com', 'nonexistent', 1, 1)"
      ).run();
    }).toThrow();
    db.close();
  });
});
