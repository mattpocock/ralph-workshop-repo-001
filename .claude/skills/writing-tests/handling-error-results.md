# Using `asserts` On Error Results

When dealing with responses that may return errors, Hono returns a discriminated union where one branch contains the result, and the other contains `{ error: string; code: string }`. To disambiguate between the two, use `assert` from `vitest`:

```ts
import { assert, expect } from "vitest";

// Grab the .json() from a result from the test client
const body = await exampleResult.json();

// Type assertion to ensure body has the expected structure
assert("someProperty" in body);

// Now, .someProperty is known to exist on body
expect(body.someProperty).toHaveLength(1);
```
