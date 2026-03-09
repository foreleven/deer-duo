import { Hono } from "hono";
import { cors } from "hono/cors";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import type { Context } from "hono";

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  JWT_SECRET: string | undefined;
  AI: Ai;
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

// ── Auth Helper ───────────────────────────────────────────────────────────────

type JWTPayload = { sub: string; username: string; role: string; exp: number };

async function requireLogin(
  c: Context<{ Bindings: Bindings }>,
): Promise<JWTPayload | null> {
  const token = getCookie(c, "token");
  if (!token) return null;
  try {
    return (await verify(token, getJwtSecret(c.env), "HS256")) as JWTPayload;
  } catch {
    return null;
  }
}

const TASK_TYPE_LABELS: Record<string, string> = {
  homework: "作业",
  recitation: "背诵",
  preview: "预习",
  review: "复习",
};

// ── Subjects ──────────────────────────────────────────────────────────────────

/**
 * GET /api/subjects
 */
app.get("/api/subjects", async (c) => {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const { results } = await c.env.DB.prepare(
    "SELECT id, code, name, sort_order FROM subjects ORDER BY sort_order ASC",
  ).all();
  return c.json({ subjects: results });
});

// ── Chapters ──────────────────────────────────────────────────────────────────

/**
 * GET /api/subjects/:subjectId/chapters
 */
app.get("/api/subjects/:subjectId/chapters", async (c) => {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const { results } = await c.env.DB.prepare(
    "SELECT id, subject_id, title, sort_order, created_at FROM chapters WHERE subject_id = ? ORDER BY sort_order ASC, id ASC",
  )
    .bind(c.req.param("subjectId"))
    .all();
  return c.json({ chapters: results });
});

/**
 * POST /api/subjects/:subjectId/chapters
 */
app.post("/api/subjects/:subjectId/chapters", async (c) => {
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
});

/**
 * PUT /api/chapters/:id
 */
app.put("/api/chapters/:id", async (c) => {
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
});

/**
 * DELETE /api/chapters/:id
 */
app.delete("/api/chapters/:id", async (c) => {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "权限不足" }, 403);

  await c.env.DB.prepare("DELETE FROM chapters WHERE id = ?")
    .bind(c.req.param("id"))
    .run();
  return c.json({ ok: true });
});

// ── Lessons ───────────────────────────────────────────────────────────────────

/**
 * GET /api/chapters/:chapterId/lessons
 */
app.get("/api/chapters/:chapterId/lessons", async (c) => {
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
});

/**
 * GET /api/lessons/:id
 */
app.get("/api/lessons/:id", async (c) => {
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
});

/**
 * POST /api/chapters/:chapterId/lessons
 */
app.post("/api/chapters/:chapterId/lessons", async (c) => {
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
});

/**
 * PUT /api/lessons/:id
 */
app.put("/api/lessons/:id", async (c) => {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "权限不足" }, 403);

  // Use Record<string, unknown> so we can distinguish "key absent" from "key present with null value"
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

  // Build SET clauses dynamically so NULL can explicitly clear a field
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
});

/**
 * DELETE /api/lessons/:id
 */
app.delete("/api/lessons/:id", async (c) => {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "权限不足" }, 403);

  await c.env.DB.prepare("DELETE FROM lessons WHERE id = ?")
    .bind(c.req.param("id"))
    .run();
  return c.json({ ok: true });
});

// ── Study Records ─────────────────────────────────────────────────────────────

/**
 * GET /api/study-records?date=YYYY-MM-DD
 */
app.get("/api/study-records", async (c) => {
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
});

/**
 * POST /api/study-records
 * Body: { lesson_id: number, study_date?: string }
 */
app.post("/api/study-records", async (c) => {
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

  // Validate lesson exists and is active
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
});

/**
 * DELETE /api/study-records/:id
 */
app.delete("/api/study-records/:id", async (c) => {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  await c.env.DB.prepare("DELETE FROM study_records WHERE id = ? AND user_id = ?")
    .bind(c.req.param("id"), user.sub)
    .run();
  return c.json({ ok: true });
});

// ── Tasks ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/study-records/:recordId/tasks
 */
app.get("/api/study-records/:recordId/tasks", async (c) => {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  // Ensure the study record belongs to the user
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
});

/**
 * POST /api/study-records/:recordId/tasks
 * Body: { task_type: string, note?: string }
 */
app.post("/api/study-records/:recordId/tasks", async (c) => {
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
});

/**
 * PATCH /api/tasks/:id
 * Body: { status?: string, note?: string }
 */
app.patch("/api/tasks/:id", async (c) => {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  // Verify task belongs to the user via study_records
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

  // note uses CASE WHEN because COALESCE cannot distinguish "omitted" from "intentionally cleared"
  // completed_at is only updated when status is explicitly provided in the request body
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
    // Only note (or nothing) changed — leave status and completed_at untouched
    await c.env.DB.prepare(
      `UPDATE tasks SET
        note = CASE WHEN ? IS NOT NULL THEN ? ELSE note END
       WHERE id = ?`,
    )
      .bind(note ?? null, note ?? null, c.req.param("id"))
      .run();
  }

  // Recompute study_record status based on tasks
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
});

/**
 * DELETE /api/tasks/:id
 */
app.delete("/api/tasks/:id", async (c) => {
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

  // Recompute study_record status
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
});

// ── AI Chat ───────────────────────────────────────────────────────────────────

/**
 * POST /api/study-records/:recordId/ai-chat
 * Body: { message: string }
 */
app.post("/api/study-records/:recordId/ai-chat", async (c) => {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const record = await c.env.DB.prepare(
    `SELECT sr.id, l.title AS lesson_title, l.content AS lesson_content,
            s.name AS subject_name
     FROM study_records sr
     JOIN lessons l ON l.id = sr.lesson_id
     JOIN chapters ch ON ch.id = l.chapter_id
     JOIN subjects s ON s.id = ch.subject_id
     WHERE sr.id = ? AND sr.user_id = ?`,
  )
    .bind(c.req.param("recordId"), user.sub)
    .first<{ id: number; lesson_title: string; lesson_content: string | null; subject_name: string }>();

  if (!record) return c.json({ error: "记录不存在" }, 404);

  let body: { message: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "无效的请求体" }, 400);
  }

  const { message } = body;
  if (!message?.trim()) return c.json({ error: "消息不能为空" }, 400);

  // Get tasks for context
  const { results: taskRows } = await c.env.DB.prepare(
    "SELECT task_type, note, status FROM tasks WHERE study_record_id = ?",
  )
    .bind(record.id)
    .all<{ task_type: string; note: string | null; status: string }>();

  const taskList = taskRows.length
    ? taskRows
        .map(
          (t) =>
            `- ${TASK_TYPE_LABELS[t.task_type] ?? t.task_type}` +
            `${t.note ? `（${t.note}）` : ""}` +
            `：${t.status === "done" ? "已完成" : "未完成"}`,
        )
        .join("\n")
    : "（暂无任务）";

  // lesson_title and lesson_content originate from admin-entered DB content (not raw user input).
  // We still cap the content to 500 chars to limit token usage and mitigate prompt-injection risk.
  const safeTitle = (record.lesson_title ?? "").replace(/[[\]]/g, "");
  const contentSummary = (record.lesson_content ?? "（暂无内容）").slice(0, 500);

  const systemPrompt = `你是一名专业的中小学辅导老师，当前辅导的科目是【${record.subject_name}】。
今天的学习课时是：【${safeTitle}】
课时内容摘要：${contentSummary}
今日学习任务：
${taskList}
请根据以上内容，用简单易懂的语言回答学生的问题，或按需生成练习题。回答要简洁，适合中小学生阅读。`;

  if (!c.env.AI) {
    return c.json({ error: "AI 服务暂不可用" }, 503);
  }

  try {
    const response = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message.trim() },
      ],
      stream: true,
    });

    return new Response(response as unknown as ReadableStream, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
  } catch {
    return c.json({ error: "AI 服务请求失败，请稍后重试" }, 503);
  }
});



app.get("*", async (c) => {
  // For unknown /api/* routes, return a proper 404 instead of SPA HTML
  if (c.req.path.startsWith("/api/")) {
    return c.notFound();
  }
  const response = await c.env.ASSETS.fetch(c.req.raw);

  if (response.status === 404) {
    // Only apply SPA fallback for HTML navigation requests without a file extension.
    const accept = c.req.header("Accept") ?? "";
    const isHtmlRequest = accept.includes("text/html");

    const url = new URL(c.req.url);
    const lastSegment = url.pathname.split("/").pop() ?? "";
    const hasExtension = lastSegment.includes(".");

    if (isHtmlRequest && !hasExtension) {
      // SPA fallback: serve index.html so client-side routing can handle the path
      const indexResponse = await c.env.ASSETS.fetch(
        new Request(new URL("/index.html", c.req.url)),
      );
      if (!indexResponse.ok) {
        return c.text("Not Found", 404);
      }
      return indexResponse;
    }

    // For non-HTML or asset-like requests, return the original 404 response.
    return response;
  }
  return response;
});

export default app;
