import { createMiddleware } from "hono/factory";
import { getDatabase } from "../db/index.ts";

export const authMiddleware = createMiddleware(async (c, next) => {
  const path = c.req.path;

  // Skip auth for health check and redirect endpoints
  if (path === "/api/health" || !path.startsWith("/api/")) {
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  // Validate Bearer token format
  if (!authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  const apiKey = authHeader.slice(7); // Remove "Bearer " prefix

  // Validate API key exists in database
  const db = getDatabase();
  const keyRecord = db
    .prepare("SELECT id FROM api_keys WHERE key = ?")
    .get(apiKey);

  if (!keyRecord) {
    return c.json({ error: "Invalid API key", code: "UNAUTHORIZED" }, 401);
  }

  return next();
});
