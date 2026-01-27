import { describe, it, expect, assert, beforeEach } from "vitest";
import { testClient } from "hono/testing";
import app from "./index.ts";
import { seedTestApiKey, authHeaders, TEST_API_KEY } from "./test/helpers.ts";

describe("Authentication Middleware", () => {
  const client = testClient(app);

  beforeEach(() => {
    seedTestApiKey();
  });

  describe("protected endpoints", () => {
    it("should return 401 for POST /api/links without auth", async () => {
      const res = await client.api.links.$post({
        json: { url: "https://example.com" },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      assert("error" in body && "code" in body);
      expect(body.error).toBe("Unauthorized");
      expect(body.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for GET /api/links without auth", async () => {
      const res = await client.api.links.$get({});

      expect(res.status).toBe(401);
      const body = await res.json();
      assert("error" in body && "code" in body);
      expect(body.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for POST /api/tags without auth", async () => {
      const res = await client.api.tags.$post({
        json: { name: `test-tag-${Date.now()}` },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      assert("error" in body && "code" in body);
      expect(body.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for POST /api/keys without auth", async () => {
      const res = await client.api.keys.$post({
        json: { name: "My App" },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      assert("error" in body && "code" in body);
      expect(body.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for invalid API key", async () => {
      const res = await client.api.links.$post(
        {
          json: { url: "https://example.com" },
        },
        {
          headers: {
            Authorization: "Bearer sk_live_invalid_key_12345",
          },
        }
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      assert("error" in body && "code" in body);
      expect(body.error).toBe("Invalid API key");
      expect(body.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for malformed Authorization header", async () => {
      const res = await client.api.links.$post(
        {
          json: { url: "https://example.com" },
        },
        {
          headers: {
            Authorization: "NotBearer sk_live_test_key",
          },
        }
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      assert("error" in body && "code" in body);
      expect(body.code).toBe("UNAUTHORIZED");
    });

    it("should allow access with valid API key", async () => {
      const res = await client.api.links.$post(
        {
          json: { url: "https://example.com" },
        },
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      assert("id" in body);
      expect(body.targetUrl).toBe("https://example.com");
    });

    it("should allow GET /api/tags with valid API key", async () => {
      const res = await client.api.tags.$get({}, { headers: authHeaders });

      expect(res.status).toBe(200);
      const body = await res.json();
      assert("tags" in body);
    });
  });

  describe("unprotected endpoints", () => {
    it("should allow GET /api/health without auth", async () => {
      const res = await client.api.health.$get();

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: "ok" });
    });

    it("should allow redirect without auth", async () => {
      const uniqueSlug = `test-redirect-${Date.now()}`;
      // Create a link with auth
      const createLinkRes = await client.api.links.$post(
        {
          json: { url: "https://example.com", slug: uniqueSlug },
        },
        { headers: authHeaders }
      );
      assert(createLinkRes.status === 201);

      // Now test redirect without auth - use fetch directly since dynamic slugs aren't typed
      const res = await app.request(`/${uniqueSlug}`);

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("https://example.com");
    });
  });
});
