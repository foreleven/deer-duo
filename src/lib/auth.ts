import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import type { Context } from "hono";
import type { Bindings, JWTPayload } from "./bindings";

export function getJwtSecret(env: Bindings): string {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured. Run: npx wrangler secret put JWT_SECRET");
  }
  return secret;
}

export async function requireLogin(
  c: Context<{ Bindings: Bindings }>,
): Promise<JWTPayload | null> {
  const token = getCookie(c, "token");
  if (!token) return null;
  try {
    return (await verify(token, getJwtSecret(c.env), "HS256")) as JWTPayload;
  } catch {
    return null;
  }
}
