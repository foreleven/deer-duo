/**
 * Test helpers: login utilities for API tests running against a real
 * `wrangler dev --local` HTTP server.
 *
 * Database setup (migrations + seed users) is performed by the CI workflow
 * (or by the local dev-setup script) before the test run starts.
 */

/** Base URL of the server under test.  Override via TEST_BASE_URL env var. */
export const BASE_URL = (
  process.env.TEST_BASE_URL ?? "http://localhost:8787"
).replace(/\/$/, "");

/**
 * POST /api/login and return the `Cookie: token=<jwt>` header string.
 * Throws if login fails or the server doesn't set a token cookie.
 */
export async function loginAs(
  username: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(
      `Login failed for ${username}: ${res.status} ${await res.text()}`,
    );
  }
  // Node's fetch normalises header names to lowercase
  const cookie = res.headers.get("set-cookie") ?? "";
  const match = cookie.match(/token=([^;]+)/);
  if (!match) throw new Error(`No token cookie returned for ${username}`);
  return `token=${match[1]}`;
}

