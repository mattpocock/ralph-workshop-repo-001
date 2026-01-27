import { describe, it, expect, assert } from "vitest";
import { testClient } from "hono/testing";
import app from "./index.ts";

describe("Link-Tag Association", () => {
  const client = testClient(app);

  it("should associate tags with a link when creating", async () => {
    const tagName = `link-tag-${Date.now()}`;

    // Create a tag first
    const createTagRes = await client.api.tags.$post({
      json: { name: tagName },
    });
    expect(createTagRes.status).toBe(201);

    // Create a link with the tag
    const createLinkRes = await client.api.links.$post({
      json: {
        url: "https://example.com/tagged-link",
        tags: [tagName],
      },
    });
    expect(createLinkRes.status).toBe(201);

    const createdLink = await createLinkRes.json();
    expect(createdLink.tags).toContain(tagName);

    // Verify the link returns tags when fetched
    const getLinkRes = await client.api.links[":id"].$get({
      param: { id: createdLink.id },
    });
    expect(getLinkRes.status).toBe(200);

    const fetchedLink = await getLinkRes.json();
    assert("tags" in fetchedLink);
    expect(fetchedLink.tags).toContain(tagName);
  });

  it("should increment tag linkCount when link is associated", async () => {
    const tagName = `count-tag-${Date.now()}`;

    // Create a tag
    const createTagRes = await client.api.tags.$post({
      json: { name: tagName },
    });
    expect(createTagRes.status).toBe(201);

    // Verify linkCount is 0
    let tagsRes = await client.api.tags.$get();
    let tagsBody = await tagsRes.json();
    let tag = tagsBody.tags.find((t: { name: string }) => t.name === tagName);
    expect(tag?.linkCount).toBe(0);

    // Create a link with the tag
    await client.api.links.$post({
      json: {
        url: "https://example.com/counted-link",
        tags: [tagName],
      },
    });

    // Verify linkCount is now 1
    tagsRes = await client.api.tags.$get();
    tagsBody = await tagsRes.json();
    tag = tagsBody.tags.find((t: { name: string }) => t.name === tagName);
    expect(tag?.linkCount).toBe(1);
  });

  it("should handle multiple tags on a single link", async () => {
    const tagName1 = `multi-tag-1-${Date.now()}`;
    const tagName2 = `multi-tag-2-${Date.now()}`;

    // Create tags
    await client.api.tags.$post({ json: { name: tagName1 } });
    await client.api.tags.$post({ json: { name: tagName2 } });

    // Create a link with multiple tags
    const createLinkRes = await client.api.links.$post({
      json: {
        url: "https://example.com/multi-tagged-link",
        tags: [tagName1, tagName2],
      },
    });
    expect(createLinkRes.status).toBe(201);

    const createdLink = await createLinkRes.json();
    expect(createdLink.tags).toContain(tagName1);
    expect(createdLink.tags).toContain(tagName2);

    // Verify via GET
    const getLinkRes = await client.api.links[":id"].$get({
      param: { id: createdLink.id },
    });
    const fetchedLink = await getLinkRes.json();
    assert("tags" in fetchedLink);
    expect(fetchedLink.tags).toContain(tagName1);
    expect(fetchedLink.tags).toContain(tagName2);
  });
});
