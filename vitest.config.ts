import { defineConfig } from "vitest/config";

/**
 * Plain vitest config — tests run in Node.js and make real HTTP requests to a
 * `wrangler dev --local` server started before the test run.
 *
 * Set TEST_BASE_URL=http://localhost:8787 (default) or point at any live URL.
 */
export default defineConfig({
  test: {
    globals: true,
    // Allow time for wrangler dev cold-start on the first request
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});

