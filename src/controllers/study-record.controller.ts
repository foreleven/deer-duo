import type { Context } from "hono";
import type { Bindings } from "../lib/bindings";
import { requireLogin } from "../lib/auth";

export async function getStudyRecords(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const date = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  const { results } = await c.env.DB.prepare(
    `SELECT sr.id, sr.chapter_id, sr.study_date, sr.status, sr.created_at,
            ch.title AS chapter_title,
            co.title AS course_title,
            s.name AS subject_name, s.code AS subject_code,
            (SELECT COUNT(*) FROM tasks t WHERE t.study_record_id = sr.id) AS task_total,
            (SELECT COUNT(*) FROM tasks t WHERE t.study_record_id = sr.id AND t.status = 'done') AS task_done
     FROM study_records sr
     JOIN chapters ch ON ch.id = sr.chapter_id
     JOIN courses co ON co.id = ch.course_id
     JOIN subjects s ON s.id = co.subject_id
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

  let body: { chapter_id: number; study_date?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "无效的请求体" }, 400);
  }

  const { chapter_id, study_date = new Date().toISOString().slice(0, 10) } = body;
  if (!chapter_id) return c.json({ error: "chapter_id 不能为空" }, 400);

  const chapter = await c.env.DB.prepare(
    "SELECT id FROM chapters WHERE id = ?",
  )
    .bind(chapter_id)
    .first();
  if (!chapter) return c.json({ error: "章节不存在" }, 404);

  try {
    const result = await c.env.DB.prepare(
      "INSERT INTO study_records (user_id, chapter_id, study_date) VALUES (?, ?, ?)",
    )
      .bind(user.sub, chapter_id, study_date)
      .run();
    return c.json({ record: { id: result.meta.last_row_id, chapter_id, study_date } }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint failed") || msg.includes("SQLITE_CONSTRAINT")) {
      return c.json({ error: "该章节今日已绑定" }, 409);
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
