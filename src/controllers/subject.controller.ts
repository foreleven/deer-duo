import type { Context } from "hono";
import type { Bindings } from "../lib/bindings";
import { requireLogin } from "../lib/auth";

export async function getSubjects(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const { results } = await c.env.DB.prepare(
    "SELECT id, code, name, sort_order FROM subjects ORDER BY sort_order ASC",
  ).all();
  return c.json({ subjects: results });
}
