import type { Context } from "hono";
import type { Bindings } from "../lib/bindings";
import { requireLogin } from "../lib/auth";

export async function getLessons(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const statusFilter = user.role === "admin" ? "" : "AND status = 'active'";
  const { results } = await c.env.DB.prepare(
    `SELECT id, chapter_id, title, content, tags, sort_order, status, created_at, updated_at
     FROM lessons WHERE chapter_id = ? ${statusFilter} ORDER BY sort_order ASC, id ASC`,
  )
    .bind(c.req.param("chapterId"))
    .all();
  return c.json({ lessons: results });
}

export async function getLesson(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const lesson = await c.env.DB.prepare(
    "SELECT id, chapter_id, title, content, tags, sort_order, status, created_at, updated_at FROM lessons WHERE id = ?",
  )
    .bind(c.req.param("id"))
    .first();
  if (!lesson) return c.json({ error: "课时不存在" }, 404);
  if (user.role !== "admin" && (lesson as { status: string }).status === "inactive") {
    return c.json({ error: "课时不存在" }, 404);
  }
  return c.json({ lesson });
}

export async function createLesson(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "权限不足" }, 403);

  let body: { title: string; content?: string; tags?: string; sort_order?: number; status?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "无效的请求体" }, 400);
  }

  const { title, content = null, tags = null, sort_order = 0, status = "active" } = body;
  if (!title?.trim()) return c.json({ error: "课时标题不能为空" }, 400);

  const result = await c.env.DB.prepare(
    "INSERT INTO lessons (chapter_id, title, content, tags, sort_order, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(c.req.param("chapterId"), title.trim(), content, tags, sort_order, status, user.sub)
    .run();

  const lesson = await c.env.DB.prepare(
    "SELECT id, chapter_id, title, content, tags, sort_order, status, created_at, updated_at FROM lessons WHERE id = ?",
  )
    .bind(result.meta.last_row_id)
    .first();

  return c.json({ lesson }, 201);
}

export async function updateLesson(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "权限不足" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "无效的请求体" }, 400);
  }

  const title = "title" in body ? (body.title as string | null) : undefined;
  const content = "content" in body ? (body.content as string | null) : undefined;
  const tags = "tags" in body ? (body.tags as string | null) : undefined;
  const sort_order = "sort_order" in body ? (body.sort_order as number | null) : undefined;
  const status = "status" in body ? (body.status as string | null) : undefined;

  if (title !== undefined && !title?.trim()) return c.json({ error: "课时标题不能为空" }, 400);

  const setClauses: string[] = ["updated_at = CURRENT_TIMESTAMP"];
  const bindings: unknown[] = [];

  if (title !== undefined) { setClauses.push("title = ?"); bindings.push(title?.trim() ?? null); }
  if (content !== undefined) { setClauses.push("content = ?"); bindings.push(content); }
  if (tags !== undefined) { setClauses.push("tags = ?"); bindings.push(tags); }
  if (sort_order !== undefined) { setClauses.push("sort_order = ?"); bindings.push(sort_order); }
  if (status !== undefined) { setClauses.push("status = ?"); bindings.push(status); }
  bindings.push(c.req.param("id"));

  await c.env.DB.prepare(
    `UPDATE lessons SET ${setClauses.join(", ")} WHERE id = ?`,
  )
    .bind(...bindings)
    .run();

  const updated = await c.env.DB.prepare(
    "SELECT id, chapter_id, title, content, tags, sort_order, status, created_at, updated_at FROM lessons WHERE id = ?",
  )
    .bind(c.req.param("id"))
    .first();

  return c.json({ lesson: updated });
}

export async function deleteLesson(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "权限不足" }, 403);

  await c.env.DB.prepare("DELETE FROM lessons WHERE id = ?")
    .bind(c.req.param("id"))
    .run();
  return c.json({ ok: true });
}
