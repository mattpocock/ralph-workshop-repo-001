import { describe, it, expect, assert } from "vitest";
import { testClient } from "hono/testing";
import { customAlphabet } from "nanoid";
import app from "./index.ts";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 7);

describe("GET /api/links/:id/stats", () => {
  const client = testClient(app);

  it("should return 404 for non-existent link", async () => {
    const res = await client.api.links[":id"].stats.$get({
      param: { id: "nonexistent" },
    });
    expect(res.status).toBe(404);

    const body = await res.json();
    assert("error" in body);
    expect(body.error).toBe("Link not found");
  });

  it("should return empty stats for link with no clicks", async () => {
    const slug = `stats-empty-${nanoid()}`;
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/no-clicks",
        slug,
      },
    });
    expect(createRes.status).toBe(201);
    const link = await createRes.json();

    const statsRes = await client.api.links[":id"].stats.$get({
      param: { id: link.id },
    });
    expect(statsRes.status).toBe(200);

    const stats = await statsRes.json();
    assert("totalClicks" in stats);
    expect(stats.totalClicks).toBe(0);
    expect(stats.clicksByDay).toEqual([]);
    expect(stats.clicksByCountry).toEqual([]);
    expect(stats.topReferrers).toEqual([]);
    expect(stats.recentClicks).toEqual([]);
  });

  it("should return stats after clicks are recorded", async () => {
    const slug = `stats-clicks-${nanoid()}`;
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/with-clicks",
        slug,
      },
    });
    expect(createRes.status).toBe(201);
    const link = await createRes.json();

    // Generate some clicks with different referrers
    await client[":slug"].$get(
      { param: { slug } },
      { headers: { Referer: "https://twitter.com/post1" } }
    );
    await client[":slug"].$get(
      { param: { slug } },
      { headers: { Referer: "https://twitter.com/post2" } }
    );
    await client[":slug"].$get(
      { param: { slug } },
      { headers: { Referer: "https://facebook.com/post1" } }
    );

    const statsRes = await client.api.links[":id"].stats.$get({
      param: { id: link.id },
    });
    expect(statsRes.status).toBe(200);

    const stats = await statsRes.json();
    assert("totalClicks" in stats);
    expect(stats.totalClicks).toBe(3);
    expect(stats.clicksByDay).toHaveLength(1);
    expect(stats.clicksByDay[0]).toMatchObject({
      date: expect.any(String),
      count: 3,
    });
    expect(stats.recentClicks).toHaveLength(3);
  });

  it("should aggregate referrers by domain", async () => {
    const slug = `stats-ref-${nanoid()}`;
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/referrer-test",
        slug,
      },
    });
    expect(createRes.status).toBe(201);
    const link = await createRes.json();

    // Multiple clicks from same referrer domain
    await client[":slug"].$get(
      { param: { slug } },
      { headers: { Referer: "https://twitter.com/post1" } }
    );
    await client[":slug"].$get(
      { param: { slug } },
      { headers: { Referer: "https://twitter.com/post2" } }
    );
    await client[":slug"].$get({ param: { slug } }); // Direct (no referrer)

    const statsRes = await client.api.links[":id"].stats.$get({
      param: { id: link.id },
    });
    expect(statsRes.status).toBe(200);

    const stats = await statsRes.json();
    assert("topReferrers" in stats);

    // Should aggregate twitter.com referrers together
    const twitterReferrer = stats.topReferrers.find(
      (r: { referrer: string }) => r.referrer === "twitter.com"
    );
    expect(twitterReferrer).toBeDefined();
    expect(twitterReferrer?.count).toBe(2);

    // Direct traffic should show as "direct"
    const directReferrer = stats.topReferrers.find(
      (r: { referrer: string }) => r.referrer === "direct"
    );
    expect(directReferrer).toBeDefined();
    expect(directReferrer?.count).toBe(1);
  });
});
