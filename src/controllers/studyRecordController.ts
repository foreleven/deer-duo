import type { Context } from "hono";
import type { Bindings } from "../lib/bindings";
import { requireLogin } from "../lib/auth";

export async function getStudyRecords(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const date = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  const { results } = await c.env.DB.prepare(
    `SELECT sr.id, sr.lesson_id, sr.study_date, sr.status, sr.created_at,
            l.title AS lesson_title, l.content AS lesson_content,
            s.name AS subject_name, s.code AS subject_code,
            ch.title AS chapter_title,
            (SELECT COUNT(*) FROM tasks t WHERE t.study_record_id = sr.id) AS task_total,
            (SELECT COUNT(*) FROM tasks t WHERE t.study_record_id = sr.id AND t.status = 'done') AS task_done
     FROM study_records sr
     JOIN lessons l ON l.id = sr.lesson_id
     JOIN chapters ch ON ch.id = l.chapter_id
     JOIN subjects s ON s.id = ch.subject_id
     WHERE sr.user_id = ? AND sr.study_date = ?
     ORDER BY sr.created_at ASC`,
  )
    .bind(user.sub, date)
    .all();

  return c.json({ records: results, date });
}

export async function createStudyRecord(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  let body: { lesson_id: number; study_date?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "无效的请求体" }, 400);
  }

  const { lesson_id, study_date = new Date().toISOString().slice(0, 10) } = body;
  if (!lesson_id) return c.json({ error: "lesson_id 不能为空" }, 400);

  const lesson = await c.env.DB.prepare(
    "SELECT id FROM lessons WHERE id = ? AND status = 'active'",
  )
    .bind(lesson_id)
    .first();
  if (!lesson) return c.json({ error: "课时不存在或已停用" }, 404);

  try {
    const result = await c.env.DB.prepare(
      "INSERT INTO study_records (user_id, lesson_id, study_date) VALUES (?, ?, ?)",
    )
      .bind(user.sub, lesson_id, study_date)
      .run();
    return c.json({ record: { id: result.meta.last_row_id, lesson_id, study_date } }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint failed") || msg.includes("SQLITE_CONSTRAINT")) {
      return c.json({ error: "该课时今日已绑定" }, 409);
    }
    console.error("Failed to insert study record:", err);
    return c.json({ error: "数据库错误" }, 500);
  }
}

export async function deleteStudyRecord(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  await c.env.DB.prepare("DELETE FROM study_records WHERE id = ? AND user_id = ?")
    .bind(c.req.param("id"), user.sub)
    .run();
  return c.json({ ok: true });
}
