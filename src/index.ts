import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { getDb } from "./db/index.js";
import { schema } from "./db/schema.js";

const db = getDb();
db.exec(schema);

const app = createApp(db);
const port = Number(process.env["PORT"] || 3000);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on port ${port}`);
});
