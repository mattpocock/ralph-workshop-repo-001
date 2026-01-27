import { describe, it, expect, assert } from "vitest";
import { testClient } from "hono/testing";
import app from "./index.ts";

describe("DELETE /api/keys/:id", () => {
  const client = testClient(app);

  it("should delete an existing API key", async () => {
    // Create an API key first
    const createRes = await client.api.keys.$post({
      json: { name: "Key to delete" },
    });
    expect(createRes.status).toBe(201);

    const createBody = await createRes.json();
    assert("id" in createBody);

    // Delete the key
    const deleteRes = await client.api.keys[":id"].$delete({
      param: { id: createBody.id },
    });

    expect(deleteRes.status).toBe(204);
  });

  it("should return 404 for non-existent API key", async () => {
    const res = await client.api.keys[":id"].$delete({
      param: { id: "non-existent-id" },
    });

    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body).toEqual({
      error: "API key not found",
      code: "NOT_FOUND",
    });
  });

  it("should not be able to use deleted API key (verify deletion via API)", async () => {
    // Create an API key
    const createRes = await client.api.keys.$post({
      json: { name: "Verify deletion" },
    });
    expect(createRes.status).toBe(201);

    const createBody = await createRes.json();
    assert("id" in createBody);

    // Delete the key
    const deleteRes = await client.api.keys[":id"].$delete({
      param: { id: createBody.id },
    });
    expect(deleteRes.status).toBe(204);

    // Try to delete again - should return 404
    const deleteAgainRes = await client.api.keys[":id"].$delete({
      param: { id: createBody.id },
    });
    expect(deleteAgainRes.status).toBe(404);
  });
});
