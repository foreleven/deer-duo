import type { Context } from "hono";
import type { Bindings } from "../lib/bindings";
import { requireLogin } from "../lib/auth";

export async function getChapters(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const { results } = await c.env.DB.prepare(
    "SELECT id, subject_id, title, sort_order, created_at FROM chapters WHERE subject_id = ? ORDER BY sort_order ASC, id ASC",
  )
    .bind(c.req.param("subjectId"))
    .all();
  return c.json({ chapters: results });
}

export async function createChapter(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "权限不足" }, 403);

  let body: { title: string; sort_order?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "无效的请求体" }, 400);
  }

  const { title, sort_order = 0 } = body;
  if (!title?.trim()) return c.json({ error: "章节名称不能为空" }, 400);

  const result = await c.env.DB.prepare(
    "INSERT INTO chapters (subject_id, title, sort_order) VALUES (?, ?, ?)",
  )
    .bind(c.req.param("subjectId"), title.trim(), sort_order)
    .run();

  return c.json({ chapter: { id: result.meta.last_row_id, title, sort_order } }, 201);
}

export async function updateChapter(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "权限不足" }, 403);

  let body: { title?: string; sort_order?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "无效的请求体" }, 400);
  }

  const { title, sort_order } = body;
  if (title !== undefined && !title.trim()) return c.json({ error: "章节名称不能为空" }, 400);

  await c.env.DB.prepare(
    "UPDATE chapters SET title = COALESCE(?, title), sort_order = COALESCE(?, sort_order) WHERE id = ?",
  )
    .bind(title?.trim() ?? null, sort_order ?? null, c.req.param("id"))
    .run();

  return c.json({ ok: true });
}

export async function deleteChapter(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "权限不足" }, 403);

  await c.env.DB.prepare("DELETE FROM chapters WHERE id = ?")
    .bind(c.req.param("id"))
    .run();
  return c.json({ ok: true });
}

type ImportLesson = { title: string; content?: string; tags?: string; sort_order?: number };
type ImportChapter = { title: string; sort_order?: number; lessons?: ImportLesson[] };

export async function importCourses(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "权限不足" }, 403);

  let body: ImportChapter[];
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "无效的请求体" }, 400);
  }

  if (!Array.isArray(body) || body.length === 0) {
    return c.json({ error: "导入内容不能为空，需提供章节数组" }, 400);
  }

  const subjectId = parseInt(c.req.param("subjectId"), 10);
  if (isNaN(subjectId)) return c.json({ error: "无效的学科 ID" }, 400);

  const created: { chapters: number; lessons: number } = { chapters: 0, lessons: 0 };

  for (let ci = 0; ci < body.length; ci++) {
    const ch = body[ci];
    if (typeof ch.title !== "string" || !ch.title.trim()) continue;

    const chResult = await c.env.DB.prepare(
      "INSERT INTO chapters (subject_id, title, sort_order) VALUES (?, ?, ?)",
    )
      .bind(subjectId, ch.title.trim(), ch.sort_order ?? ci)
      .run();

    created.chapters++;
    const chapterId = chResult.meta.last_row_id;
    if (!chapterId) continue;

    if (Array.isArray(ch.lessons)) {
      for (let li = 0; li < ch.lessons.length; li++) {
        const ls = ch.lessons[li];
        if (typeof ls.title !== "string" || !ls.title.trim()) continue;
        await c.env.DB.prepare(
          "INSERT INTO lessons (chapter_id, title, content, tags, sort_order, status, created_by) VALUES (?, ?, ?, ?, ?, 'active', ?)",
        )
          .bind(chapterId, ls.title.trim(), ls.content ?? null, ls.tags ?? null, ls.sort_order ?? li, user.sub)
          .run();
        created.lessons++;
      }
    }
  }

  return c.json({ ok: true, created }, 201);
}
