import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono().get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

const port = parseInt(process.env["PORT"] || "3000", 10);

if (process.env["NODE_ENV"] !== "test") {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server running on http://localhost:${info.port}`);
  });
}

export default app;
