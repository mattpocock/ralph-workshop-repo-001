import { describe, it, expect, assert } from "vitest";
import { testClient } from "hono/testing";
import app from "./index.ts";

describe("DELETE /api/links/:id", () => {
  const client = testClient(app);

  it("should delete a link and return 204", async () => {
    // First create a link
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/delete-test",
      },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    // Delete the link
    const deleteRes = await client.api.links[":id"].$delete({
      param: { id: created.id },
    });
    expect(deleteRes.status).toBe(204);

    // Verify it's gone
    const getRes = await client.api.links[":id"].$get({
      param: { id: created.id },
    });
    expect(getRes.status).toBe(404);
  });

  it("should return 404 for non-existent link", async () => {
    const res = await client.api.links[":id"].$delete({
      param: { id: "non-existent-id" },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({
      error: "Link not found",
      code: "NOT_FOUND",
    });
  });

  it("should cascade delete associated clicks", async () => {
    // Create a link
    const createRes = await client.api.links.$post({
      json: {
        url: "https://example.com/delete-cascade-test",
      },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    // Visit the link to create a click
    await client[":slug"].$get({
      param: { slug: created.slug },
    });

    // Verify click was recorded
    const clicksRes = await client.api.links[":id"].clicks.$get({
      param: { id: created.id },
      query: {},
    });
    expect(clicksRes.status).toBe(200);
    const clicksBody = await clicksRes.json();
    assert("clicks" in clicksBody);
    expect(clicksBody.clicks.length).toBe(1);

    // Delete the link
    const deleteRes = await client.api.links[":id"].$delete({
      param: { id: created.id },
    });
    expect(deleteRes.status).toBe(204);

    // Verify clicks endpoint returns 404 (link gone)
    const clicksAfterRes = await client.api.links[":id"].clicks.$get({
      param: { id: created.id },
      query: {},
    });
    expect(clicksAfterRes.status).toBe(404);
  });
});
