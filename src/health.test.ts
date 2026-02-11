import { testClient } from "hono/testing";
import { describe, it, expect, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createApp } from "./app.js";

describe("GET /api/health", () => {
  const db = new Database(":memory:");
  const app = createApp(db);
  const client = testClient(app);

  afterEach(() => {
    db.close();
  });

  it("should return status ok", async () => {
    const res = await client.api.health.$get();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
