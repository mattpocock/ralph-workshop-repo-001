import { describe, it, expect, assert, beforeEach } from "vitest";
import { testClient } from "hono/testing";
import app from "./index.ts";
import { seedTestApiKey, authHeaders } from "./test/helpers.ts";

describe("POST /api/keys", () => {
  const client = testClient(app);

  beforeEach(() => {
    seedTestApiKey();
  });

  it("should create an API key with a name", async () => {
    const res = await client.api.keys.$post(
      {
        json: { name: "My App" },
      },
      { headers: authHeaders }
    );

    expect(res.status).toBe(201);

    const body = await res.json();
    assert("id" in body);
    expect(body).toMatchObject({
      id: expect.any(String),
      key: expect.stringMatching(/^sk_live_[a-zA-Z0-9_-]+$/),
      name: "My App",
      createdAt: expect.any(Number),
    });
  });

  it("should create an API key without a name", async () => {
    const res = await client.api.keys.$post(
      {
        json: {},
      },
      { headers: authHeaders }
    );

    expect(res.status).toBe(201);

    const body = await res.json();
    assert("id" in body);
    expect(body).toMatchObject({
      id: expect.any(String),
      key: expect.stringMatching(/^sk_live_[a-zA-Z0-9_-]+$/),
      createdAt: expect.any(Number),
    });
    expect(body.name).toBeNull();
  });

  it("should return a unique key each time", async () => {
    const res1 = await client.api.keys.$post(
      {
        json: { name: "App 1" },
      },
      { headers: authHeaders }
    );
    const res2 = await client.api.keys.$post(
      {
        json: { name: "App 2" },
      },
      { headers: authHeaders }
    );

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    const body1 = await res1.json();
    const body2 = await res2.json();

    assert("key" in body1);
    assert("key" in body2);
    expect(body1.key).not.toBe(body2.key);
  });
});
