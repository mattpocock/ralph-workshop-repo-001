import { getDatabase } from "../db/index.ts";

// Test API key for authenticated requests
export const TEST_API_KEY = "sk_live_test_key_abcdefghijklmn";
export const TEST_API_KEY_ID = "test-api-key-id";

export function seedTestApiKey() {
  const db = getDatabase();
  // Clear and re-seed the test key (use INSERT OR REPLACE to handle existing keys)
  db.prepare(
    "INSERT OR REPLACE INTO api_keys (id, key, name, created_at) VALUES (?, ?, ?, ?)"
  ).run(TEST_API_KEY_ID, TEST_API_KEY, "Test API Key", Date.now());
}

export const authHeaders = {
  Authorization: `Bearer ${TEST_API_KEY}`,
};
