import { describe, it, expect } from "vitest";
import { testClient } from "hono/testing";
import { customAlphabet } from "nanoid";
import app from "./index.ts";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 7);

// Helper to wait for async operations
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Geo-IP lookup on click", () => {
  const client = testClient(app);

  it("should populate country and city from geo-IP lookup after click", async () => {
    // Create a link
    const slug = `geo-${nanoid()}`;
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/geo-test",
        slug,
      },
    });
    expect(createRes.status).toBe(201);
    const link = await createRes.json();

    // Visit the redirect endpoint with a real-looking IP
    const redirectRes = await client[":slug"].$get(
      {
        param: { slug },
      },
      {
        headers: {
          "X-Forwarded-For": "8.8.8.8", // Google DNS - should resolve to US
          "User-Agent": "GeoTestBrowser/1.0",
        },
      }
    );
    expect(redirectRes.status).toBe(302);

    // Wait for async geo lookup to complete
    await sleep(2000);

    // Verify the click has geo data populated
    const clicksRes = await client.api.links[":id"].clicks.$get({
      param: { id: link.id },
    });
    expect(clicksRes.status).toBe(200);

    const clicksBody = (await clicksRes.json()) as {
      clicks: Array<{
        id: string;
        timestamp: number;
        ip: string | null;
        country: string | null;
        city: string | null;
      }>;
    };

    expect(clicksBody.clicks).toHaveLength(1);
    const click = clicksBody.clicks[0]!;
    expect(click.ip).toBe("8.8.8.8");
    // Geo data should be populated after async lookup
    expect(click.country).toBe("US");
    expect(click.city).toBeTruthy();
  });
});
