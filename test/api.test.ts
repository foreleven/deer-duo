/**
 * API integration tests for deer-duo.
 *
 * Tests run inside the Miniflare (wrangler-dev compatible) Workers runtime
 * via @cloudflare/vitest-pool-workers.  SELF.fetch() sends real HTTP requests
 * to the Worker and env.DB gives direct D1 access for setup / assertions.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, loginAs, createUserAndLogin } from "./helpers";

// ─── Top-level shared state (set in beforeAll, never inside it()) ─────────────

let adminCookie = "";
let userCookie = "";
let subjectId = 0;

// Created in the Chapters beforeAll
let testChapterId = 0;

// Created in the Lessons beforeAll
let testLessonId = 0;
let testLessonChapterId = 0;

// Created in Study Records beforeAll
let testRecordId = 0;
let testRecordLessonId = 0;
let testInactiveLessonId = 0;

// Created in Tasks beforeAll
let testTaskId = 0;
let testTaskRecordId = 0;

// ─── Bootstrap ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  await applyMigrations();
  adminCookie = await loginAs("admin", "admin123");
  ({ cookie: userCookie } = await createUserAndLogin("testuser"));

  // Grab the first seeded subject (语文)
  const { results } = await (env as { DB: D1Database }).DB.prepare(
    "SELECT id FROM subjects ORDER BY sort_order ASC LIMIT 1",
  ).all<{ id: number }>();
  subjectId = results[0]!.id;
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("Auth", () => {
  it("POST /api/login — success returns user + sets cookie", async () => {
    const res = await SELF.fetch("http://localhost/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { user: { username: string; role: string } };
    expect(data.user.username).toBe("admin");
    expect(data.user.role).toBe("admin");
    expect(res.headers.get("Set-Cookie")).toMatch(/token=/);
  });

  it("POST /api/login — wrong password returns 401", async () => {
    const res = await SELF.fetch("http://localhost/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "wrong" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/login — missing fields returns 400", async () => {
    const res = await SELF.fetch("http://localhost/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/me — returns user info when logged in", async () => {
    const res = await SELF.fetch("http://localhost/api/me", {
      headers: { Cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { user: { username: string } };
    expect(data.user.username).toBe("admin");
  });

  it("GET /api/me — returns 401 when not logged in", async () => {
    const res = await SELF.fetch("http://localhost/api/me");
    expect(res.status).toBe(401);
  });

  it("POST /api/logout — clears cookie", async () => {
    const res = await SELF.fetch("http://localhost/api/logout", {
      method: "POST",
      headers: { Cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });
});

// ─── Subjects ─────────────────────────────────────────────────────────────────

describe("Subjects", () => {
  it("GET /api/subjects — returns seeded subjects", async () => {
    const res = await SELF.fetch("http://localhost/api/subjects", {
      headers: { Cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { subjects: { code: string }[] };
    const codes = data.subjects.map((s) => s.code);
    expect(codes).toContain("chinese");
    expect(codes).toContain("math");
    expect(codes).toContain("english");
  });

  it("GET /api/subjects — requires auth", async () => {
    const res = await SELF.fetch("http://localhost/api/subjects");
    expect(res.status).toBe(401);
  });
});

// ─── Chapters ─────────────────────────────────────────────────────────────────

describe("Chapters", () => {
  beforeAll(async () => {
    const res = await SELF.fetch(
      `http://localhost/api/subjects/${subjectId}/chapters`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "第一章·测试章节", sort_order: 1 }),
      },
    );
    const data = (await res.json()) as { chapter: { id: number } };
    testChapterId = Number(data.chapter.id);
  });

  it("POST /api/subjects/:subjectId/chapters — returns 201 with chapter data", async () => {
    const res = await SELF.fetch(
      `http://localhost/api/subjects/${subjectId}/chapters`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "第二章·独立测试" }),
      },
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as { chapter: { id: number; title: string } };
    expect(data.chapter.title).toBe("第二章·独立测试");
    expect(Number(data.chapter.id)).toBeGreaterThan(0);
  });

  it("POST /api/subjects/:subjectId/chapters — user gets 403", async () => {
    const res = await SELF.fetch(
      `http://localhost/api/subjects/${subjectId}/chapters`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
        body: JSON.stringify({ title: "should fail" }),
      },
    );
    expect(res.status).toBe(403);
  });

  it("POST /api/subjects/:subjectId/chapters — empty title returns 400", async () => {
    const res = await SELF.fetch(
      `http://localhost/api/subjects/${subjectId}/chapters`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "   " }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("GET /api/subjects/:subjectId/chapters — returns chapter list containing test chapter", async () => {
    const res = await SELF.fetch(
      `http://localhost/api/subjects/${subjectId}/chapters`,
      { headers: { Cookie: userCookie } },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { chapters: { id: number }[] };
    expect(data.chapters.some((ch) => Number(ch.id) === testChapterId)).toBe(true);
  });

  it("PUT /api/chapters/:id — admin can update chapter title", async () => {
    const res = await SELF.fetch(`http://localhost/api/chapters/${testChapterId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "第一章·已更新" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });

  it("DELETE /api/chapters/:id — user gets 403", async () => {
    const res = await SELF.fetch(`http://localhost/api/chapters/${testChapterId}`, {
      method: "DELETE",
      headers: { Cookie: userCookie },
    });
    expect(res.status).toBe(403);
  });

  it("DELETE /api/chapters/:id — admin can delete chapter", async () => {
    // Create a fresh chapter to delete
    const cr = await SELF.fetch(
      `http://localhost/api/subjects/${subjectId}/chapters`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "待删除章节" }),
      },
    );
    const { chapter } = (await cr.json()) as { chapter: { id: number } };
    const res = await SELF.fetch(`http://localhost/api/chapters/${Number(chapter.id)}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    expect(res.status).toBe(200);
  });
});

// ─── Lessons ──────────────────────────────────────────────────────────────────

describe("Lessons", () => {
  beforeAll(async () => {
    const chRes = await SELF.fetch(
      `http://localhost/api/subjects/${subjectId}/chapters`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "Lessons测试章节" }),
      },
    );
    const { chapter } = (await chRes.json()) as { chapter: { id: number } };
    testLessonChapterId = Number(chapter.id);

    const lRes = await SELF.fetch(
      `http://localhost/api/chapters/${testLessonChapterId}/lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({
          title: "第一课时·测试",
          content: "# 测试内容\n这是正文。",
          tags: "测试,入门",
          sort_order: 0,
          status: "active",
        }),
      },
    );
    const { lesson } = (await lRes.json()) as { lesson: { id: number } };
    testLessonId = Number(lesson.id);
  });

  it("POST /api/chapters/:chapterId/lessons — returns 201 with full lesson row", async () => {
    const res = await SELF.fetch(
      `http://localhost/api/chapters/${testLessonChapterId}/lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({
          title: "独立测试课时",
          content: "独立内容",
          status: "active",
        }),
      },
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      lesson: { id: number; chapter_id: number; title: string; content: string };
    };
    expect(Number(data.lesson.chapter_id)).toBe(testLessonChapterId);
    expect(data.lesson.title).toBe("独立测试课时");
    expect(data.lesson.content).toBe("独立内容");
  });

  it("POST /api/chapters/:chapterId/lessons — user gets 403", async () => {
    const res = await SELF.fetch(
      `http://localhost/api/chapters/${testLessonChapterId}/lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
        body: JSON.stringify({ title: "should fail" }),
      },
    );
    expect(res.status).toBe(403);
  });

  it("POST /api/chapters/:chapterId/lessons — empty title returns 400", async () => {
    const res = await SELF.fetch(
      `http://localhost/api/chapters/${testLessonChapterId}/lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "" }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("GET /api/chapters/:chapterId/lessons — returns active lessons for users", async () => {
    const res = await SELF.fetch(
      `http://localhost/api/chapters/${testLessonChapterId}/lessons`,
      { headers: { Cookie: userCookie } },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { lessons: { id: number; status: string }[] };
    expect(data.lessons.some((l) => Number(l.id) === testLessonId)).toBe(true);
    expect(data.lessons.every((l) => l.status === "active")).toBe(true);
  });

  it("GET /api/chapters/:chapterId/lessons — admin sees inactive lessons, user does not", async () => {
    await SELF.fetch(`http://localhost/api/chapters/${testLessonChapterId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "已停用课时", status: "inactive" }),
    });

    const adminRes = await SELF.fetch(
      `http://localhost/api/chapters/${testLessonChapterId}/lessons`,
      { headers: { Cookie: adminCookie } },
    );
    const adminData = (await adminRes.json()) as { lessons: { status: string }[] };
    expect(adminData.lessons.some((l) => l.status === "inactive")).toBe(true);

    const userRes = await SELF.fetch(
      `http://localhost/api/chapters/${testLessonChapterId}/lessons`,
      { headers: { Cookie: userCookie } },
    );
    const userData = (await userRes.json()) as { lessons: { status: string }[] };
    expect(userData.lessons.every((l) => l.status === "active")).toBe(true);
  });

  it("GET /api/lessons/:id — returns lesson detail", async () => {
    const res = await SELF.fetch(`http://localhost/api/lessons/${testLessonId}`, {
      headers: { Cookie: userCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { lesson: { title: string } };
    expect(data.lesson.title).toBe("第一课时·测试");
  });

  it("GET /api/lessons/:id — 404 for non-existent", async () => {
    const res = await SELF.fetch("http://localhost/api/lessons/99999", {
      headers: { Cookie: userCookie },
    });
    expect(res.status).toBe(404);
  });

  it("PUT /api/lessons/:id — admin can update title and content", async () => {
    const res = await SELF.fetch(`http://localhost/api/lessons/${testLessonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "第一课时·已更新", content: "更新后内容" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { lesson: { title: string; content: string } };
    expect(data.lesson.title).toBe("第一课时·已更新");
    expect(data.lesson.content).toBe("更新后内容");
  });

  it("PUT /api/lessons/:id — can explicitly clear content to null", async () => {
    const res = await SELF.fetch(`http://localhost/api/lessons/${testLessonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ content: null }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { lesson: { content: string | null } };
    expect(data.lesson.content).toBeNull();
    // Restore
    await SELF.fetch(`http://localhost/api/lessons/${testLessonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ content: "# 课时内容", status: "active" }),
    });
  });

  it("PUT /api/lessons/:id — user gets 403", async () => {
    const res = await SELF.fetch(`http://localhost/api/lessons/${testLessonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ title: "fail" }),
    });
    expect(res.status).toBe(403);
  });

  it("DELETE /api/lessons/:id — user gets 403", async () => {
    const res = await SELF.fetch(`http://localhost/api/lessons/${testLessonId}`, {
      method: "DELETE",
      headers: { Cookie: userCookie },
    });
    expect(res.status).toBe(403);
  });

  it("DELETE /api/lessons/:id — admin can delete lesson", async () => {
    const cr = await SELF.fetch(
      `http://localhost/api/chapters/${testLessonChapterId}/lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "待删除课时" }),
      },
    );
    const { lesson } = (await cr.json()) as { lesson: { id: number } };
    const res = await SELF.fetch(`http://localhost/api/lessons/${Number(lesson.id)}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    expect(res.status).toBe(200);
  });
});

// ─── Study Records ────────────────────────────────────────────────────────────

describe("Study Records", () => {
  const testDate = "2026-03-09";

  beforeAll(async () => {
    const chRes = await SELF.fetch(
      `http://localhost/api/subjects/${subjectId}/chapters`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "StudyRecords测试章节" }),
      },
    );
    const { chapter } = (await chRes.json()) as { chapter: { id: number } };

    const lRes = await SELF.fetch(
      `http://localhost/api/chapters/${Number(chapter.id)}/lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "学习记录测试课时", status: "active" }),
      },
    );
    const { lesson } = (await lRes.json()) as { lesson: { id: number } };
    testRecordLessonId = Number(lesson.id);

    const inRes = await SELF.fetch(
      `http://localhost/api/chapters/${Number(chapter.id)}/lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "已停用课时", status: "inactive" }),
      },
    );
    const { lesson: inLesson } = (await inRes.json()) as { lesson: { id: number } };
    testInactiveLessonId = Number(inLesson.id);

    // Pre-create the study record so duplicate/GET tests can use it
    const srRes = await SELF.fetch("http://localhost/api/study-records", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ lesson_id: testRecordLessonId, study_date: testDate }),
    });
    const { record } = (await srRes.json()) as { record: { id: number } };
    testRecordId = Number(record.id);
  });

  it("POST /api/study-records — returns 201 and creates a record", async () => {
    // Use a fresh date to avoid conflict with testDate
    const res = await SELF.fetch("http://localhost/api/study-records", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({
        lesson_id: testRecordLessonId,
        study_date: "2026-04-01",
      }),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      record: { id: number; lesson_id: number; study_date: string };
    };
    expect(Number(data.record.lesson_id)).toBe(testRecordLessonId);
    expect(data.record.study_date).toBe("2026-04-01");
  });

  it("POST /api/study-records — duplicate (same lesson+date) returns 409", async () => {
    // testDate+testRecordLessonId already bound in beforeAll
    const res = await SELF.fetch("http://localhost/api/study-records", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ lesson_id: testRecordLessonId, study_date: testDate }),
    });
    expect(res.status).toBe(409);
    const data = (await res.json()) as { error: string };
    expect(data.error).toMatch(/已绑定/);
  });

  it("POST /api/study-records — inactive lesson returns 404", async () => {
    const res = await SELF.fetch("http://localhost/api/study-records", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ lesson_id: testInactiveLessonId, study_date: testDate }),
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/study-records?date= — returns records for the day", async () => {
    const res = await SELF.fetch(
      `http://localhost/api/study-records?date=${testDate}`,
      { headers: { Cookie: userCookie } },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { records: { id: number }[]; date: string };
    expect(data.date).toBe(testDate);
    expect(data.records.some((r) => Number(r.id) === testRecordId)).toBe(true);
  });

  it("DELETE /api/study-records/:id — deletes record", async () => {
    const r2 = await SELF.fetch("http://localhost/api/study-records", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({
        lesson_id: testRecordLessonId,
        study_date: "2026-03-20",
      }),
    });
    const { record: rec2 } = (await r2.json()) as { record: { id: number } };

    const res = await SELF.fetch(
      `http://localhost/api/study-records/${Number(rec2.id)}`,
      { method: "DELETE", headers: { Cookie: userCookie } },
    );
    expect(res.status).toBe(200);
    const row = await (env as { DB: D1Database }).DB.prepare(
      "SELECT id FROM study_records WHERE id = ?",
    )
      .bind(rec2.id)
      .first();
    expect(row).toBeNull();
  });
});

// ─── Tasks ────────────────────────────────────────────────────────────────────

describe("Tasks", () => {
  const testDate = "2026-03-11";

  beforeAll(async () => {
    const chRes = await SELF.fetch(
      `http://localhost/api/subjects/${subjectId}/chapters`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "Tasks测试章节" }),
      },
    );
    const { chapter } = (await chRes.json()) as { chapter: { id: number } };

    const lRes = await SELF.fetch(
      `http://localhost/api/chapters/${Number(chapter.id)}/lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "任务测试课时", status: "active" }),
      },
    );
    const { lesson } = (await lRes.json()) as { lesson: { id: number } };

    const srRes = await SELF.fetch("http://localhost/api/study-records", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ lesson_id: Number(lesson.id), study_date: testDate }),
    });
    const { record } = (await srRes.json()) as { record: { id: number } };
    testTaskRecordId = Number(record.id);

    // Pre-create the task used by PATCH/DELETE tests
    const taskRes = await SELF.fetch(
      `http://localhost/api/study-records/${testTaskRecordId}/tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
        body: JSON.stringify({ task_type: "homework", note: "第1-5题" }),
      },
    );
    const { task } = (await taskRes.json()) as { task: { id: number } };
    testTaskId = Number(task.id);
  });

  it("POST /api/study-records/:recordId/tasks — creates a recitation task", async () => {
    const res = await SELF.fetch(
      `http://localhost/api/study-records/${testTaskRecordId}/tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
        body: JSON.stringify({ task_type: "recitation", note: "背诵第一段" }),
      },
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      task: { id: number; task_type: string; status: string };
    };
    expect(data.task.task_type).toBe("recitation");
    expect(data.task.status).toBe("pending");
    expect(Number(data.task.id)).toBeGreaterThan(0);
  });

  it("POST /api/study-records/:recordId/tasks — invalid task_type returns 400", async () => {
    const res = await SELF.fetch(
      `http://localhost/api/study-records/${testTaskRecordId}/tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
        body: JSON.stringify({ task_type: "invalid" }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("GET /api/study-records/:recordId/tasks — lists tasks", async () => {
    const res = await SELF.fetch(
      `http://localhost/api/study-records/${testTaskRecordId}/tasks`,
      { headers: { Cookie: userCookie } },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tasks: { id: number }[] };
    expect(data.tasks.some((t) => Number(t.id) === testTaskId)).toBe(true);
  });

  it("GET /api/study-records/:recordId/tasks — 404 for non-owned record", async () => {
    const res = await SELF.fetch(
      `http://localhost/api/study-records/99999/tasks`,
      { headers: { Cookie: userCookie } },
    );
    expect(res.status).toBe(404);
  });

  it("PATCH /api/tasks/:id — mark done sets completed_at", async () => {
    const res = await SELF.fetch(`http://localhost/api/tasks/${testTaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ status: "done" }),
    });
    expect(res.status).toBe(200);
    const row = await (env as { DB: D1Database }).DB.prepare(
      "SELECT status, completed_at FROM tasks WHERE id = ?",
    )
      .bind(testTaskId)
      .first<{ status: string; completed_at: string | null }>();
    expect(row?.status).toBe("done");
    expect(row?.completed_at).not.toBeNull();
  });

  it("PATCH /api/tasks/:id — patching only note does NOT clear completed_at", async () => {
    // Create a fresh task, mark it done, then patch only its note
    const createRes = await SELF.fetch(
      `http://localhost/api/study-records/${testTaskRecordId}/tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
        body: JSON.stringify({ task_type: "review", note: "初始备注" }),
      },
    );
    const { task: freshTask } = (await createRes.json()) as { task: { id: number } };
    const freshId = Number(freshTask.id);

    // Mark done first
    await SELF.fetch(`http://localhost/api/tasks/${freshId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ status: "done" }),
    });

    // Patch only note — status and completed_at must be preserved
    const patchRes = await SELF.fetch(`http://localhost/api/tasks/${freshId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ note: "新备注" }),
    });
    expect(patchRes.status).toBe(200);

    const row = await (env as { DB: D1Database }).DB.prepare(
      "SELECT status, completed_at FROM tasks WHERE id = ?",
    )
      .bind(freshId)
      .first<{ status: string; completed_at: string | null }>();
    expect(row?.status).toBe("done");
    expect(row?.completed_at).not.toBeNull();
  });

  it("PATCH /api/tasks/:id — mark pending clears completed_at", async () => {
    const res = await SELF.fetch(`http://localhost/api/tasks/${testTaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ status: "pending" }),
    });
    expect(res.status).toBe(200);
    const row = await (env as { DB: D1Database }).DB.prepare(
      "SELECT status, completed_at FROM tasks WHERE id = ?",
    )
      .bind(testTaskId)
      .first<{ status: string; completed_at: string | null }>();
    expect(row?.status).toBe("pending");
    expect(row?.completed_at).toBeNull();
  });

  it("PATCH /api/tasks/:id — 404 for task not belonging to user", async () => {
    const res = await SELF.fetch(`http://localhost/api/tasks/99999`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ status: "done" }),
    });
    expect(res.status).toBe(404);
  });

  it("study_record status auto-recomputes to in_progress then done", async () => {
    // testTaskId is pending (from previous test); create a second task
    const t2Res = await SELF.fetch(
      `http://localhost/api/study-records/${testTaskRecordId}/tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
        body: JSON.stringify({ task_type: "preview" }),
      },
    );
    const { task: task2 } = (await t2Res.json()) as { task: { id: number } };
    const task2Id = Number(task2.id);

    // Mark task1 done → 1 done + 1 pending = in_progress
    await SELF.fetch(`http://localhost/api/tasks/${testTaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ status: "done" }),
    });

    const inProgress = await (env as { DB: D1Database }).DB.prepare(
      "SELECT status FROM study_records WHERE id = ?",
    )
      .bind(testTaskRecordId)
      .first<{ status: string }>();
    expect(inProgress?.status).toBe("in_progress");

    // Mark task2 done → 2 done + 0 pending = done
    await SELF.fetch(`http://localhost/api/tasks/${task2Id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ status: "done" }),
    });

    const done = await (env as { DB: D1Database }).DB.prepare(
      "SELECT status FROM study_records WHERE id = ?",
    )
      .bind(testTaskRecordId)
      .first<{ status: string }>();
    expect(done?.status).toBe("done");
  });

  it("DELETE /api/tasks/:id — deletes task and row is gone from DB", async () => {
    // Create a fresh task to delete
    const cr = await SELF.fetch(
      `http://localhost/api/study-records/${testTaskRecordId}/tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
        body: JSON.stringify({ task_type: "review" }),
      },
    );
    const { task: toDelete } = (await cr.json()) as { task: { id: number } };
    const deleteId = Number(toDelete.id);

    const res = await SELF.fetch(`http://localhost/api/tasks/${deleteId}`, {
      method: "DELETE",
      headers: { Cookie: userCookie },
    });
    expect(res.status).toBe(200);
    const row = await (env as { DB: D1Database }).DB.prepare(
      "SELECT id FROM tasks WHERE id = ?",
    )
      .bind(deleteId)
      .first();
    expect(row).toBeNull();
  });

  it("DELETE /api/tasks/:id — 404 for non-existent task", async () => {
    const res = await SELF.fetch(`http://localhost/api/tasks/99999`, {
      method: "DELETE",
      headers: { Cookie: userCookie },
    });
    expect(res.status).toBe(404);
  });
});

// ─── AI Chat (no AI binding in test → 503) ───────────────────────────────────

describe("AI Chat", () => {
  it("POST /api/study-records/:recordId/ai-chat — 401 without auth", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/study-records/1/ai-chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      },
    );
    expect(res.status).toBe(401);
  });

  it("POST /api/study-records/:recordId/ai-chat — 404 for missing record", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/study-records/99999/ai-chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
        body: JSON.stringify({ message: "帮我解释一下" }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("POST /api/study-records/:recordId/ai-chat — 400 for empty message", async () => {
    // Build fresh chain for AI test
    const chRes = await SELF.fetch(
      `http://localhost/api/subjects/${subjectId}/chapters`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "AI测试章节" }),
      },
    );
    const { chapter } = (await chRes.json()) as { chapter: { id: number } };

    const lRes = await SELF.fetch(
      `http://localhost/api/chapters/${Number(chapter.id)}/lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "AI测试课时", status: "active" }),
      },
    );
    const { lesson } = (await lRes.json()) as { lesson: { id: number } };

    const srRes = await SELF.fetch("http://localhost/api/study-records", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({
        lesson_id: Number(lesson.id),
        study_date: "2026-03-12",
      }),
    });
    const { record } = (await srRes.json()) as { record: { id: number } };

    const res = await SELF.fetch(
      `http://localhost/api/study-records/${Number(record.id)}/ai-chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
        body: JSON.stringify({ message: "   " }),
      },
    );
    expect(res.status).toBe(400);
  });
});
