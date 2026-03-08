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

app.use(
  "/api/*",
  cors({
    origin: ["https://duo.process.tech"],
    credentials: true,
  }),
);

// ── Helpers ──────────────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH_BITS = 256;

async function deriveKey(password: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const saltBytes = hexToBytes(saltHex);
  const salt = saltBytes.buffer as ArrayBuffer;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    PBKDF2_KEY_LENGTH_BITS,
  );
  return bytesToHex(new Uint8Array(derivedBits));
}

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── API Routes ────────────────────────────────────────────────────────────────

/**
 * POST /api/login
 * Body: { username: string, password: string }
 */
app.post("/api/login", async (c) => {
  // Fail fast: ensure JWT secret is configured before doing any work
  const secret = getJwtSecret(c.env);

  let body: { username: string; password: string };
  try {
    body = await c.req.json<{ username: string; password: string }>();
  } catch {
    return c.json({ error: "请求体不是有效的 JSON" }, 400);
  }

  const { username, password } = body;

  if (!username || !password) {
    return c.json({ error: "用户名和密码不能为空" }, 400);
  }

  const row = await c.env.DB.prepare(
    "SELECT id, username, password_hash, salt, role FROM users WHERE username = ?",
  )
    .bind(username)
    .first<{ id: number; username: string; password_hash: string; salt: string; role: string }>();

  if (!row) {
    return c.json({ error: "用户名或密码错误" }, 401);
  }

  const hash = await deriveKey(password, row.salt);
  if (hash !== row.password_hash) {
    return c.json({ error: "用户名或密码错误" }, 401);
  }

  const payload = {
    sub: String(row.id),
    username: row.username,
    role: row.role,
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

  return c.json({ user: { id: row.id, username: row.username, role: row.role } });
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
    const payload = (await verify(token, secret, "HS256")) as {
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
  deleteCookie(c, "token", {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });
  return c.json({ ok: true });
});

// ── Fallback: serve static SPA assets ────────────────────────────────────────

app.get("*", (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
