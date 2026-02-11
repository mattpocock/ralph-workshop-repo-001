import { getDb } from "./index.js";
import { schema } from "./schema.js";

export function initDb(dbPath?: string): void {
  const db = getDb(dbPath);
  db.exec(schema);
  db.close();
}

// Run directly via `npm run db:init`
if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  initDb();
  console.log("Database initialized");
}
