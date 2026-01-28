# Flaky Geo Tests

**Slack message from @mike.torres in #engineering**

---

**mike.torres** 11:23 AM

hey just noticed - `geo.test.ts` is calling the live ip-api.com service with no mocking

we're literally hitting a real external API in our test suite. no wonder CI has been flaky

someone needs to mock that fetch call so we're not depending on external service availability/rate limits
