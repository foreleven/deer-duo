import { Hono } from "hono";
import { cors } from "hono/cors";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  JWT_SECRET: string | undefined;
};

function getJwtSecret(env: Bindings): string {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured. Run: npx wrangler secret put JWT_SECRET");
  }
  return secret;
}

const app = new Hono<{ Bindings: Bindings }>();

app.use("/api/*", cors());

// ── Helpers ──────────────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── API Routes ────────────────────────────────────────────────────────────────

/**
 * POST /api/login
 * Body: { username: string, password: string }
 */
app.post("/api/login", async (c) => {
  const { username, password } = await c.req.json<{
    username: string;
    password: string;
  }>();

  if (!username || !password) {
    return c.json({ error: "用户名和密码不能为空" }, 400);
  }

  const hash = await hashPassword(password);

  const user = await c.env.DB.prepare(
    "SELECT id, username, role FROM users WHERE username = ? AND password_hash = ?"
  )
    .bind(username, hash)
    .first<{ id: number; username: string; role: string }>();

  if (!user) {
    return c.json({ error: "用户名或密码错误" }, 401);
  }

  const secret = getJwtSecret(c.env);
  const payload = {
    sub: String(user.id),
    username: user.username,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  };

  const token = await sign(payload, secret);

  setCookie(c, "token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return c.json({ user: { id: user.id, username: user.username, role: user.role } });
});

/**
 * GET /api/me
 * Returns current user info from JWT cookie.
 */
app.get("/api/me", async (c) => {
  const token = getCookie(c, "token");
  if (!token) {
    return c.json({ error: "未登录" }, 401);
  }

  const secret = getJwtSecret(c.env);
  try {
    const payload = await verify(token, secret, "HS256") as {
      sub: string;
      username: string;
      role: string;
    };
    return c.json({ user: { id: payload.sub, username: payload.username, role: payload.role } });
  } catch {
    return c.json({ error: "登录已过期" }, 401);
  }
});

/**
 * POST /api/logout
 */
app.post("/api/logout", (c) => {
  deleteCookie(c, "token", { path: "/" });
  return c.json({ ok: true });
});

// ── Fallback: serve static SPA assets ────────────────────────────────────────

app.get("*", (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
