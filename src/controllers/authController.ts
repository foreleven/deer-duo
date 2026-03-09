import { setCookie, deleteCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import type { Context } from "hono";
import type { Bindings } from "../lib/bindings";
import { getJwtSecret, requireLogin } from "../lib/auth";
import { deriveKey } from "../lib/crypto";

export async function login(c: Context<{ Bindings: Bindings }>) {
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

  const token = await sign(payload, getJwtSecret(c.env));

  setCookie(c, "token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return c.json({ user: { id: row.id, username: row.username, role: row.role } });
}

export async function getMe(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) {
    return c.json({ error: "未登录" }, 401);
  }
  return c.json({ user: { id: user.sub, username: user.username, role: user.role } });
}

export function logout(c: Context<{ Bindings: Bindings }>) {
  deleteCookie(c, "token", {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });
  return c.json({ ok: true });
}
