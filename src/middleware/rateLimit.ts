import { createMiddleware } from "hono/factory";
import { getDatabase } from "../db/index.ts";

// In-memory rate limit tracking
// Map of identifier (API key or IP) to array of timestamps
const rateLimitStore = new Map<string, number[]>();

const AUTHENTICATED_LIMIT = 100; // requests per minute
const UNAUTHENTICATED_LIMIT = 20; // requests per minute per IP
const WINDOW_MS = 60 * 1000; // 1 minute window

function cleanupOldEntries(timestamps: number[], now: number): number[] {
  return timestamps.filter((ts) => now - ts < WINDOW_MS);
}

function getRetryAfterSeconds(timestamps: number[], now: number): number {
  // Find the oldest timestamp in the window
  const oldestInWindow = Math.min(...timestamps);
  const msUntilOldestExpires = WINDOW_MS - (now - oldestInWindow);
  return Math.ceil(msUntilOldestExpires / 1000);
}

export function resetRateLimits() {
  rateLimitStore.clear();
}

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const path = c.req.path;

  // Skip rate limiting for health check endpoint
  if (path === "/api/health") {
    return next();
  }

  const now = Date.now();
  let identifier: string;
  let limit: number;

  const clientIp = c.req.header("x-forwarded-for") || "127.0.0.1";
  const authHeader = c.req.header("Authorization");

  // Check if this is an authenticated request with valid API key
  if (authHeader?.startsWith("Bearer ")) {
    const apiKey = authHeader.slice(7);
    const db = getDatabase();
    const keyRecord = db
      .prepare("SELECT id FROM api_keys WHERE key = ?")
      .get(apiKey) as { id: string } | undefined;

    if (keyRecord) {
      identifier = `apikey:${apiKey}`;
      limit = AUTHENTICATED_LIMIT;
    } else {
      identifier = `ip:${clientIp}`;
      limit = UNAUTHENTICATED_LIMIT;
    }
  } else {
    identifier = `ip:${clientIp}`;
    limit = UNAUTHENTICATED_LIMIT;
  }

  // Get and clean up timestamps for this identifier
  let timestamps = rateLimitStore.get(identifier) || [];
  timestamps = cleanupOldEntries(timestamps, now);

  // Check if rate limit exceeded
  if (timestamps.length >= limit) {
    const retryAfter = getRetryAfterSeconds(timestamps, now);
    return c.json({ error: "Rate limit exceeded", code: "RATE_LIMITED" }, 429, {
      "Retry-After": String(retryAfter),
    });
  }

  // Add current timestamp and store
  timestamps.push(now);
  rateLimitStore.set(identifier, timestamps);

  return next();
});
