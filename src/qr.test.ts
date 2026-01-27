import { describe, it, expect, assert } from "vitest";
import { testClient } from "hono/testing";
import { customAlphabet } from "nanoid";
import app from "./index.ts";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 7);

describe("GET /api/links/:id/qr", () => {
  const client = testClient(app);

  it("should return 404 for non-existent link", async () => {
    const res = await client.api.links[":id"].qr.$get({
      param: { id: "nonexistent" },
      query: {},
    });
    expect(res.status).toBe(404);

    const body = (await res.json()) as { error: string; code: string };
    expect(body.error).toBe("Link not found");
  });

  it("should return PNG image for existing link", async () => {
    const slug = `qr-test-${nanoid()}`;
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/qr-test",
        slug,
      },
    });
    expect(createRes.status).toBe(201);
    const link = await createRes.json();

    const qrRes = await client.api.links[":id"].qr.$get({
      param: { id: link.id },
      query: {},
    });
    expect(qrRes.status).toBe(200);
    expect(qrRes.headers.get("content-type")).toBe("image/png");

    const buffer = await qrRes.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);

    // PNG files start with specific magic bytes
    const bytes = new Uint8Array(buffer);
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50); // P
    expect(bytes[2]).toBe(0x4e); // N
    expect(bytes[3]).toBe(0x47); // G
  });

  it("should support custom size parameter", async () => {
    const slug = `qr-size-${nanoid()}`;
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/qr-size-test",
        slug,
      },
    });
    expect(createRes.status).toBe(201);
    const link = await createRes.json();

    // Default size
    const defaultRes = await client.api.links[":id"].qr.$get({
      param: { id: link.id },
      query: {},
    });
    expect(defaultRes.status).toBe(200);
    const defaultBuffer = await defaultRes.arrayBuffer();

    // Custom size (larger)
    const largeRes = await client.api.links[":id"].qr.$get({
      param: { id: link.id },
      query: { size: "500" },
    });
    expect(largeRes.status).toBe(200);
    const largeBuffer = await largeRes.arrayBuffer();

    // Larger QR codes should have more bytes
    expect(largeBuffer.byteLength).toBeGreaterThan(defaultBuffer.byteLength);
  });
});
