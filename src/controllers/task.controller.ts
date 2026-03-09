import type { Context } from "hono";
import type { Bindings } from "../lib/bindings";
import { requireLogin } from "../lib/auth";

export async function getTasks(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const record = await c.env.DB.prepare(
    "SELECT id FROM study_records WHERE id = ? AND user_id = ?",
  )
    .bind(c.req.param("recordId"), user.sub)
    .first();
  if (!record) return c.json({ error: "记录不存在" }, 404);

  const { results } = await c.env.DB.prepare(
    "SELECT id, study_record_id, task_type, note, status, completed_at, created_at FROM tasks WHERE study_record_id = ? ORDER BY created_at ASC",
  )
    .bind(c.req.param("recordId"))
    .all();

  return c.json({ tasks: results });
}

export async function createTask(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const record = await c.env.DB.prepare(
    "SELECT id FROM study_records WHERE id = ? AND user_id = ?",
  )
    .bind(c.req.param("recordId"), user.sub)
    .first();
  if (!record) return c.json({ error: "记录不存在" }, 404);

  let body: { task_type: string; note?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "无效的请求体" }, 400);
  }

  const { task_type, note = null } = body;
  const validTypes = ["homework", "recitation", "preview", "review"];
  if (!validTypes.includes(task_type)) return c.json({ error: "无效的任务类型" }, 400);

  const result = await c.env.DB.prepare(
    "INSERT INTO tasks (study_record_id, task_type, note) VALUES (?, ?, ?)",
  )
    .bind(c.req.param("recordId"), task_type, note)
    .run();

  return c.json({ task: { id: result.meta.last_row_id, task_type, note, status: "pending" } }, 201);
}

export async function updateTask(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const task = await c.env.DB.prepare(
    `SELECT t.id, t.status FROM tasks t
     JOIN study_records sr ON sr.id = t.study_record_id
     WHERE t.id = ? AND sr.user_id = ?`,
  )
    .bind(c.req.param("id"), user.sub)
    .first<{ id: number; status: string }>();
  if (!task) return c.json({ error: "任务不存在" }, 404);

  let body: { status?: string; note?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "无效的请求体" }, 400);
  }

  const { status, note } = body;

  const statusProvided = "status" in body;
  const markDone = status === "done";
  const markPending = statusProvided && status !== "done";

  if (statusProvided && markDone) {
    await c.env.DB.prepare(
      `UPDATE tasks SET
        status = ?,
        note = CASE WHEN ? IS NOT NULL THEN ? ELSE note END,
        completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
      .bind(status, note ?? null, note ?? null, c.req.param("id"))
      .run();
  } else if (markPending) {
    await c.env.DB.prepare(
      `UPDATE tasks SET
        status = ?,
        note = CASE WHEN ? IS NOT NULL THEN ? ELSE note END,
        completed_at = NULL
       WHERE id = ?`,
    )
      .bind(status, note ?? null, note ?? null, c.req.param("id"))
      .run();
  } else {
    await c.env.DB.prepare(
      `UPDATE tasks SET
        note = CASE WHEN ? IS NOT NULL THEN ? ELSE note END
       WHERE id = ?`,
    )
      .bind(note ?? null, note ?? null, c.req.param("id"))
      .run();
  }

  await c.env.DB.prepare(
    `UPDATE study_records SET status =
      CASE
        WHEN (SELECT COUNT(*) FROM tasks WHERE study_record_id = study_records.id) = 0 THEN 'pending'
        WHEN (SELECT COUNT(*) FROM tasks WHERE study_record_id = study_records.id AND status = 'pending') = 0 THEN 'done'
        ELSE 'in_progress'
      END
     WHERE id = (SELECT study_record_id FROM tasks WHERE id = ?)`,
  )
    .bind(c.req.param("id"))
    .run();

  return c.json({ ok: true });
}

export async function deleteTask(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const task = await c.env.DB.prepare(
    `SELECT t.id, t.study_record_id FROM tasks t
     JOIN study_records sr ON sr.id = t.study_record_id
     WHERE t.id = ? AND sr.user_id = ?`,
  )
    .bind(c.req.param("id"), user.sub)
    .first<{ id: number; study_record_id: number }>();
  if (!task) return c.json({ error: "任务不存在" }, 404);

  await c.env.DB.prepare("DELETE FROM tasks WHERE id = ?")
    .bind(c.req.param("id"))
    .run();

  await c.env.DB.prepare(
    `UPDATE study_records SET status =
      CASE
        WHEN (SELECT COUNT(*) FROM tasks WHERE study_record_id = ?) = 0 THEN 'pending'
        WHEN (SELECT COUNT(*) FROM tasks WHERE study_record_id = ? AND status = 'pending') = 0 THEN 'done'
        ELSE 'in_progress'
      END
     WHERE id = ?`,
  )
    .bind(task.study_record_id, task.study_record_id, task.study_record_id)
    .run();

  return c.json({ ok: true });
}
