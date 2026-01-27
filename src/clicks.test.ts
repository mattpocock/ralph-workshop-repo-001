import { describe, it, expect, assert } from "vitest";
import { testClient } from "hono/testing";
import { customAlphabet } from "nanoid";
import app from "./index.ts";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 7);

describe("GET /api/links/:id/clicks pagination", () => {
  const client = testClient(app);

  it("should return 404 for non-existent link", async () => {
    const res = await client.api.links[":id"].clicks.$get({
      param: { id: "nonexistent" },
      query: {},
    });
    expect(res.status).toBe(404);

    const body = await res.json();
    assert("error" in body);
    expect(body.error).toBe("Link not found");
  });

  it("should return pagination info with default values", async () => {
    const slug = `clicks-page-${nanoid()}`;
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/pagination-test",
        slug,
      },
    });
    expect(createRes.status).toBe(201);
    const link = await createRes.json();

    const clicksRes = await client.api.links[":id"].clicks.$get({
      param: { id: link.id },
      query: {},
    });
    expect(clicksRes.status).toBe(200);

    const body = await clicksRes.json();
    assert("pagination" in body);
    expect(body.pagination).toMatchObject({
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0,
    });
  });

  it("should paginate clicks correctly", async () => {
    const slug = `clicks-multi-${nanoid()}`;
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/multi-page",
        slug,
      },
    });
    expect(createRes.status).toBe(201);
    const link = await createRes.json();

    // Generate 5 clicks
    for (let i = 0; i < 5; i++) {
      await client[":slug"].$get({ param: { slug } });
    }

    // Request with limit of 2
    const page1Res = await client.api.links[":id"].clicks.$get({
      param: { id: link.id },
      query: { page: "1", limit: "2" },
    });
    expect(page1Res.status).toBe(200);

    const page1Body = await page1Res.json();
    assert("clicks" in page1Body);
    expect(page1Body.clicks).toHaveLength(2);
    expect(page1Body.pagination).toMatchObject({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3,
    });

    // Request page 2
    const page2Res = await client.api.links[":id"].clicks.$get({
      param: { id: link.id },
      query: { page: "2", limit: "2" },
    });
    expect(page2Res.status).toBe(200);

    const page2Body = await page2Res.json();
    assert("clicks" in page2Body);
    expect(page2Body.clicks).toHaveLength(2);
    expect(page2Body.pagination.page).toBe(2);

    // Request page 3 (should have 1 click)
    const page3Res = await client.api.links[":id"].clicks.$get({
      param: { id: link.id },
      query: { page: "3", limit: "2" },
    });
    expect(page3Res.status).toBe(200);

    const page3Body = await page3Res.json();
    assert("clicks" in page3Body);
    expect(page3Body.clicks).toHaveLength(1);
  });
});

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
      query: {},
    });
    expect(clicksRes.status).toBe(200);

    const clicksBody = await clicksRes.json();
    assert("clicks" in clicksBody);
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
      query: {},
    });
    expect(clicksRes.status).toBe(200);

    const clicksBody = await clicksRes.json();
    assert("clicks" in clicksBody);
    expect(clicksBody.clicks).toHaveLength(3);
  });
});
