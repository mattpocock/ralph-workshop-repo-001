import { describe, it, expect } from "vitest";
import { testClient } from "hono/testing";
import { customAlphabet } from "nanoid";
import app from "./index.ts";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 7);

describe("Password-protected links", () => {
  const client = testClient(app);

  describe("POST /api/links with password", () => {
    it("should create a link with hasPassword: true when password provided", async () => {
      const slug = `pwd-${nanoid()}`;
      const res = await client.api.links.$post({
        json: {
          url: "https://example.com/secret",
          slug,
          password: "secret123",
        },
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.hasPassword).toBe(true);
    });
  });

  describe("GET /:slug with password protection", () => {
    it("should return 401 when accessing password-protected link without password", async () => {
      const slug = `pwd-${nanoid()}`;
      await client.api.links.$post({
        json: {
          url: "https://example.com/protected",
          slug,
          password: "mypassword",
        },
      });

      const res = await client[":slug"].$get({
        param: { slug },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Password required",
        code: "UNAUTHORIZED",
      });
    });

    it("should redirect when correct password is provided", async () => {
      const slug = `pwd-${nanoid()}`;
      await client.api.links.$post({
        json: {
          url: "https://example.com/secret-destination",
          slug,
          password: "correctpassword",
        },
      });

      const res = await app.request(`/${slug}?password=correctpassword`);

      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe(
        "https://example.com/secret-destination"
      );
    });

    it("should return 401 when wrong password is provided", async () => {
      const slug = `pwd-${nanoid()}`;
      await client.api.links.$post({
        json: {
          url: "https://example.com/protected",
          slug,
          password: "rightpassword",
        },
      });

      const res = await app.request(`/${slug}?password=wrongpassword`);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Invalid password",
        code: "UNAUTHORIZED",
      });
    });
  });
});
