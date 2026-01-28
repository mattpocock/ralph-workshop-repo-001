---
name: writing-tests
description: Use whenever you're writing tests for the API.
---

The best tests are integration tests. They should seek to test the API directly, not underlying implementation details.

You should use Vitest to run the tests.

Do NOT make direct queries to the database to verify that data has been written correctly. Instead, verify the data is there through API calls and the public interface only. This will make the tests less coupled to implementation details.

You should test with a local database: `./data/test-links.db`.

You should use Hono's test helpers to test the API: [hono-testing.md](./hono-testing.md)
