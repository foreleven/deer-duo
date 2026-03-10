import type { Context } from "hono";
import type { Bindings } from "../lib/bindings";
import { requireLogin } from "../lib/auth";

export async function getCourse(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const course = await c.env.DB.prepare(
    "SELECT id, subject_id, title, sort_order, created_at FROM courses WHERE id = ?",
  )
    .bind(c.req.param("id"))
    .first();

  if (!course) return c.json({ error: "课程不存在" }, 404);
  return c.json({ course });
}

export async function getCourses(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const { results } = await c.env.DB.prepare(
    "SELECT id, subject_id, title, sort_order, created_at FROM courses WHERE subject_id = ? ORDER BY sort_order ASC, id ASC",
  )
    .bind(c.req.param("subjectId"))
    .all();
  return c.json({ courses: results });
}

export async function createCourse(c: Context<{ Bindings: Bindings }>) {
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
  if (!title?.trim()) return c.json({ error: "课程名称不能为空" }, 400);

  const result = await c.env.DB.prepare(
    "INSERT INTO courses (subject_id, title, sort_order) VALUES (?, ?, ?)",
  )
    .bind(c.req.param("subjectId"), title.trim(), sort_order)
    .run();

  return c.json({ course: { id: result.meta.last_row_id, title: title.trim(), sort_order } }, 201);
}

export async function updateCourse(c: Context<{ Bindings: Bindings }>) {
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
  if (title !== undefined && !title.trim()) return c.json({ error: "课程名称不能为空" }, 400);

  await c.env.DB.prepare(
    "UPDATE courses SET title = COALESCE(?, title), sort_order = COALESCE(?, sort_order) WHERE id = ?",
  )
    .bind(title?.trim() ?? null, sort_order ?? null, c.req.param("id"))
    .run();

  return c.json({ ok: true });
}

export async function deleteCourse(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "权限不足" }, 403);

  await c.env.DB.prepare("DELETE FROM courses WHERE id = ?")
    .bind(c.req.param("id"))
    .run();
  return c.json({ ok: true });
}

type ImportChapter = { title: string; sort_order?: number };
type ImportCourse = { title: string; sort_order?: number; chapters?: ImportChapter[] };

export async function importCourses(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "权限不足" }, 403);

  let body: ImportCourse[];
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "无效的请求体" }, 400);
  }

  if (!Array.isArray(body) || body.length === 0) {
    return c.json({ error: "导入内容不能为空，需提供课程数组" }, 400);
  }

  const subjectId = parseInt(c.req.param("subjectId"), 10);
  if (isNaN(subjectId)) return c.json({ error: "无效的学科 ID" }, 400);

  const created: { courses: number; chapters: number } = { courses: 0, chapters: 0 };

  for (let ci = 0; ci < body.length; ci++) {
    const co = body[ci];
    if (typeof co.title !== "string" || !co.title.trim()) continue;

    const coResult = await c.env.DB.prepare(
      "INSERT INTO courses (subject_id, title, sort_order) VALUES (?, ?, ?)",
    )
      .bind(subjectId, co.title.trim(), co.sort_order ?? ci)
      .run();

    created.courses++;
    const courseId = coResult.meta.last_row_id;
    if (!courseId) continue;

    if (Array.isArray(co.chapters)) {
      for (let li = 0; li < co.chapters.length; li++) {
        const ch = co.chapters[li];
        if (typeof ch.title !== "string" || !ch.title.trim()) continue;
        await c.env.DB.prepare(
          "INSERT INTO chapters (course_id, title, sort_order) VALUES (?, ?, ?)",
        )
          .bind(courseId, ch.title.trim(), ch.sort_order ?? li)
          .run();
        created.chapters++;
      }
    }
  }

  return c.json({ ok: true, created }, 201);
}
