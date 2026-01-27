import { describe, it, expect } from "vitest";
import { testClient } from "hono/testing";
import { customAlphabet } from "nanoid";
import app from "./index.ts";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 7);

describe("Click recording on redirect", () => {
  const client = testClient(app);

  it("should record a click when visiting a short link", async () => {
    // Create a link
    const slug = `click-${nanoid()}`;
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/tracked",
        slug,
      },
    });
    expect(createRes.status).toBe(201);
    const link = await createRes.json();

    // Visit the redirect endpoint with headers
    const redirectRes = await client[":slug"].$get(
      {
        param: { slug },
      },
      {
        headers: {
          "User-Agent": "TestBrowser/1.0",
          Referer: "https://twitter.com/somepost",
        },
      }
    );
    expect(redirectRes.status).toBe(302);

    // Verify the click was recorded via the API
    const clicksRes = await client.api.links[":id"].clicks.$get({
      param: { id: link.id },
    });
    expect(clicksRes.status).toBe(200);

    const clicksBody = (await clicksRes.json()) as {
      clicks: Array<{
        id: string;
        timestamp: number;
        userAgent: string | null;
        referrer: string | null;
      }>;
    };
    expect(clicksBody.clicks).toHaveLength(1);
    expect(clicksBody.clicks[0]).toMatchObject({
      id: expect.any(String),
      timestamp: expect.any(Number),
      userAgent: "TestBrowser/1.0",
      referrer: "https://twitter.com/somepost",
    });
  });

  it("should record multiple clicks", async () => {
    // Create a link
    const slug = `multi-${nanoid()}`;
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/multi-click",
        slug,
      },
    });
    expect(createRes.status).toBe(201);
    const link = await createRes.json();

    // Visit the redirect endpoint multiple times
    await client[":slug"].$get({ param: { slug } });
    await client[":slug"].$get({ param: { slug } });
    await client[":slug"].$get({ param: { slug } });

    // Verify all clicks were recorded
    const clicksRes = await client.api.links[":id"].clicks.$get({
      param: { id: link.id },
    });
    expect(clicksRes.status).toBe(200);

    const clicksBody = (await clicksRes.json()) as {
      clicks: Array<{ id: string }>;
    };
    expect(clicksBody.clicks).toHaveLength(3);
  });
});
