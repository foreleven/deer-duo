/**
 * API integration tests for deer-duo.
 *
 * Tests run against a real `wrangler dev --local` HTTP server.
 * Before this file runs, the CI workflow:
 *   1. Runs `npm run build`
 *   2. Applies D1 migrations via `wrangler d1 migrations apply deer-duo --local`
 *   3. Seeds "testuser" (password: admin123) via `wrangler d1 execute --local`
 *   4. Starts `wrangler dev --local --port 8787`
 *   5. Runs `npm test` with TEST_BASE_URL=http://localhost:8787
 */
import { describe, it, expect, beforeAll } from "vitest";
import { BASE_URL, loginAs } from "./helpers";

// ─── Top-level shared state ───────────────────────────────────────────────────

let adminCookie = "";
let userCookie = "";
let subjectId = 0;

let testChapterId = 0;
let testLessonId = 0;
let testLessonChapterId = 0;
let testRecordId = 0;
let testRecordLessonId = 0;
let testInactiveLessonId = 0;
let testTaskId = 0;
let testTaskRecordId = 0;

// ─── Bootstrap ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  adminCookie = await loginAs("admin", "admin123");
  userCookie = await loginAs("testuser", "admin123");

  // Pick the first seeded subject (语文, sort_order=1)
  const res = await fetch(`${BASE_URL}/api/subjects`, {
    headers: { Cookie: adminCookie },
  });
  const data = (await res.json()) as { subjects: { id: number }[] };
  subjectId = Number(data.subjects[0]!.id);
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("Auth", () => {
  it("POST /api/login — success returns user + sets cookie", async () => {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { user: { username: string; role: string } };
    expect(data.user.username).toBe("admin");
    expect(data.user.role).toBe("admin");
    expect(res.headers.get("set-cookie")).toMatch(/token=/);
  });

  it("POST /api/login — wrong password returns 401", async () => {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "wrong" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/login — missing fields returns 400", async () => {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/me — returns user info when logged in", async () => {
    const res = await fetch(`${BASE_URL}/api/me`, {
      headers: { Cookie: adminCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { user: { username: string } };
    expect(data.user.username).toBe("admin");
  });

  it("GET /api/me — returns 401 when not logged in", async () => {
    const res = await fetch(`${BASE_URL}/api/me`);
    expect(res.status).toBe(401);
  });

  it("POST /api/logout — returns ok", async () => {
    const res = await fetch(`${BASE_URL}/api/logout`, {
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
    const res = await fetch(`${BASE_URL}/api/subjects`, {
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
    const res = await fetch(`${BASE_URL}/api/subjects`);
    expect(res.status).toBe(401);
  });
});

// ─── Chapters ─────────────────────────────────────────────────────────────────

describe("Chapters", () => {
  beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/api/subjects/${subjectId}/chapters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "第一章·测试章节", sort_order: 1 }),
    });
    const data = (await res.json()) as { chapter: { id: number } };
    testChapterId = Number(data.chapter.id);
  });

  it("POST /api/subjects/:subjectId/chapters — returns 201 with chapter data", async () => {
    const res = await fetch(`${BASE_URL}/api/subjects/${subjectId}/chapters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "第二章·独立测试" }),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as { chapter: { id: number; title: string } };
    expect(data.chapter.title).toBe("第二章·独立测试");
    expect(Number(data.chapter.id)).toBeGreaterThan(0);
  });

  it("POST /api/subjects/:subjectId/chapters — user gets 403", async () => {
    // Server checks role before reading body; omit body to avoid TCP contamination
    const res = await fetch(`${BASE_URL}/api/subjects/${subjectId}/chapters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
    });
    await res.text();
    expect(res.status).toBe(403);
  });

  it("POST /api/subjects/:subjectId/chapters — empty title returns 400", async () => {
    const res = await fetch(`${BASE_URL}/api/subjects/${subjectId}/chapters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "   " }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/subjects/:subjectId/chapters — returns chapter list", async () => {
    const res = await fetch(
      `${BASE_URL}/api/subjects/${subjectId}/chapters`,
      { headers: { Cookie: userCookie } },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { chapters: { id: number }[] };
    expect(data.chapters.some((ch) => Number(ch.id) === testChapterId)).toBe(true);
  });

  it("PUT /api/chapters/:id — admin can update chapter title", async () => {
    const res = await fetch(`${BASE_URL}/api/chapters/${testChapterId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "第一章·已更新" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });

  it("DELETE /api/chapters/:id — user gets 403", async () => {
    const res = await fetch(`${BASE_URL}/api/chapters/${testChapterId}`, {
      method: "DELETE",
      headers: { Cookie: userCookie },
    });
    expect(res.status).toBe(403);
  });

  it("DELETE /api/chapters/:id — admin can delete chapter", async () => {
    const cr = await fetch(`${BASE_URL}/api/subjects/${subjectId}/chapters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "待删除章节" }),
    });
    const { chapter } = (await cr.json()) as { chapter: { id: number } };
    const res = await fetch(`${BASE_URL}/api/chapters/${Number(chapter.id)}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    expect(res.status).toBe(200);
  });
});

// ─── Course Import ────────────────────────────────────────────────────────────

describe("Course Import", () => {
  it("POST /api/subjects/:subjectId/import — 401 without auth", async () => {
    const res = await fetch(`${BASE_URL}/api/subjects/${subjectId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    await res.text();
    expect(res.status).toBe(401);
  });

  it("POST /api/subjects/:subjectId/import — user gets 403", async () => {
    const res = await fetch(`${BASE_URL}/api/subjects/${subjectId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
    });
    await res.text();
    expect(res.status).toBe(403);
  });

  it("POST /api/subjects/:subjectId/import — invalid subjectId returns 400", async () => {
    const res = await fetch(`${BASE_URL}/api/subjects/abc/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify([{ title: "章节" }]),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/subjects/:subjectId/import — empty array returns 400", async () => {
    const res = await fetch(`${BASE_URL}/api/subjects/${subjectId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify([]),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/subjects/:subjectId/import — non-array body returns 400", async () => {
    const res = await fetch(`${BASE_URL}/api/subjects/${subjectId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "not an array" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/subjects/:subjectId/import — success returns 201 with created counts", async () => {
    const res = await fetch(`${BASE_URL}/api/subjects/${subjectId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify([
        {
          title: "导入章节一",
          lessons: [
            { title: "导入课时A", content: "内容A", tags: "标签1" },
            { title: "导入课时B" },
          ],
        },
        {
          title: "导入章节二",
          lessons: [{ title: "导入课时C" }],
        },
      ]),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as { ok: boolean; created: { chapters: number; lessons: number } };
    expect(data.ok).toBe(true);
    expect(data.created.chapters).toBe(2);
    expect(data.created.lessons).toBe(3);
  });

  it("POST /api/subjects/:subjectId/import — chapters and lessons actually inserted", async () => {
    const importRes = await fetch(`${BASE_URL}/api/subjects/${subjectId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify([
        { title: "验证章节", lessons: [{ title: "验证课时", tags: "验证标签" }] },
      ]),
    });
    expect(importRes.status).toBe(201);

    // Verify chapter appears in the chapter list
    const chapRes = await fetch(`${BASE_URL}/api/subjects/${subjectId}/chapters`, {
      headers: { Cookie: adminCookie },
    });
    const { chapters } = (await chapRes.json()) as { chapters: { title: string; id: number }[] };
    const importedChapter = chapters.find((c) => c.title === "验证章节");
    expect(importedChapter).toBeDefined();

    // Verify lesson appears under the chapter
    const lessonRes = await fetch(`${BASE_URL}/api/chapters/${Number(importedChapter!.id)}/lessons`, {
      headers: { Cookie: adminCookie },
    });
    const { lessons } = (await lessonRes.json()) as { lessons: { title: string; tags: string }[] };
    expect(lessons.some((l) => l.title === "验证课时")).toBe(true);
  });

  it("POST /api/subjects/:subjectId/import — skips entries with non-string or empty titles", async () => {
    const res = await fetch(`${BASE_URL}/api/subjects/${subjectId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify([
        { title: "有效章节" },
        { title: "   " },
        { title: 123 },
      ]),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as { ok: boolean; created: { chapters: number } };
    expect(data.ok).toBe(true);
    // Only the "有效章节" entry should be created
    expect(data.created.chapters).toBe(1);
  });
});

// ─── Lessons ──────────────────────────────────────────────────────────────────

describe("Lessons", () => {
  beforeAll(async () => {
    const chRes = await fetch(
      `${BASE_URL}/api/subjects/${subjectId}/chapters`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "Lessons测试章节" }),
      },
    );
    const { chapter } = (await chRes.json()) as { chapter: { id: number } };
    testLessonChapterId = Number(chapter.id);

    const lRes = await fetch(
      `${BASE_URL}/api/chapters/${testLessonChapterId}/lessons`,
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
    const res = await fetch(
      `${BASE_URL}/api/chapters/${testLessonChapterId}/lessons`,
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
    // Server checks role before reading body; omit body to avoid TCP contamination
    const res = await fetch(
      `${BASE_URL}/api/chapters/${testLessonChapterId}/lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
      },
    );
    await res.text();
    expect(res.status).toBe(403);
  });

  it("POST /api/chapters/:chapterId/lessons — empty title returns 400", async () => {
    const res = await fetch(
      `${BASE_URL}/api/chapters/${testLessonChapterId}/lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "" }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("GET /api/chapters/:chapterId/lessons — returns active lessons for users", async () => {
    const res = await fetch(
      `${BASE_URL}/api/chapters/${testLessonChapterId}/lessons`,
      { headers: { Cookie: userCookie } },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { lessons: { id: number; status: string }[] };
    expect(data.lessons.some((l) => Number(l.id) === testLessonId)).toBe(true);
    expect(data.lessons.every((l) => l.status === "active")).toBe(true);
  });

  it("GET /api/chapters/:chapterId/lessons — admin sees inactive, user does not", async () => {
    await fetch(`${BASE_URL}/api/chapters/${testLessonChapterId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ title: "已停用课时", status: "inactive" }),
    });

    const adminRes = await fetch(
      `${BASE_URL}/api/chapters/${testLessonChapterId}/lessons`,
      { headers: { Cookie: adminCookie } },
    );
    const adminData = (await adminRes.json()) as { lessons: { status: string }[] };
    expect(adminData.lessons.some((l) => l.status === "inactive")).toBe(true);

    const userRes = await fetch(
      `${BASE_URL}/api/chapters/${testLessonChapterId}/lessons`,
      { headers: { Cookie: userCookie } },
    );
    const userData = (await userRes.json()) as { lessons: { status: string }[] };
    expect(userData.lessons.every((l) => l.status === "active")).toBe(true);
  });

  it("GET /api/lessons/:id — returns lesson detail", async () => {
    const res = await fetch(`${BASE_URL}/api/lessons/${testLessonId}`, {
      headers: { Cookie: userCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { lesson: { title: string } };
    expect(data.lesson.title).toBe("第一课时·测试");
  });

  it("GET /api/lessons/:id — 404 for non-existent", async () => {
    const res = await fetch(`${BASE_URL}/api/lessons/99999`, {
      headers: { Cookie: userCookie },
    });
    expect(res.status).toBe(404);
  });

  it("PUT /api/lessons/:id — admin can update title and content", async () => {
    const res = await fetch(`${BASE_URL}/api/lessons/${testLessonId}`, {
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
    const res = await fetch(`${BASE_URL}/api/lessons/${testLessonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ content: null }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { lesson: { content: string | null } };
    expect(data.lesson.content).toBeNull();
    // Restore for subsequent tests
    await fetch(`${BASE_URL}/api/lessons/${testLessonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ content: "# 课时内容", status: "active" }),
    });
  });

  it("PUT /api/lessons/:id — user gets 403", async () => {
    // Server checks role before reading body; omit body to avoid TCP contamination
    const res = await fetch(`${BASE_URL}/api/lessons/${testLessonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
    });
    await res.text();
    expect(res.status).toBe(403);
  });

  it("DELETE /api/lessons/:id — user gets 403", async () => {
    const res = await fetch(`${BASE_URL}/api/lessons/${testLessonId}`, {
      method: "DELETE",
      headers: { Cookie: userCookie },
    });
    expect(res.status).toBe(403);
  });

  it("DELETE /api/lessons/:id — admin can delete lesson", async () => {
    const cr = await fetch(
      `${BASE_URL}/api/chapters/${testLessonChapterId}/lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "待删除课时" }),
      },
    );
    const { lesson } = (await cr.json()) as { lesson: { id: number } };
    const res = await fetch(
      `${BASE_URL}/api/lessons/${Number(lesson.id)}`,
      { method: "DELETE", headers: { Cookie: adminCookie } },
    );
    expect(res.status).toBe(200);
  });
});

// ─── Study Records ────────────────────────────────────────────────────────────

describe("Study Records", () => {
  const testDate = "2026-03-09";

  beforeAll(async () => {
    const chRes = await fetch(
      `${BASE_URL}/api/subjects/${subjectId}/chapters`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "StudyRecords测试章节" }),
      },
    );
    const { chapter } = (await chRes.json()) as { chapter: { id: number } };

    const lRes = await fetch(
      `${BASE_URL}/api/chapters/${Number(chapter.id)}/lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "学习记录测试课时", status: "active" }),
      },
    );
    const { lesson } = (await lRes.json()) as { lesson: { id: number } };
    testRecordLessonId = Number(lesson.id);

    const inRes = await fetch(
      `${BASE_URL}/api/chapters/${Number(chapter.id)}/lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "已停用课时", status: "inactive" }),
      },
    );
    const { lesson: inLesson } = (await inRes.json()) as { lesson: { id: number } };
    testInactiveLessonId = Number(inLesson.id);

    // Pre-create the study record used by duplicate / GET tests
    const srRes = await fetch(`${BASE_URL}/api/study-records`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ lesson_id: testRecordLessonId, study_date: testDate }),
    });
    const { record } = (await srRes.json()) as { record: { id: number } };
    testRecordId = Number(record.id);
  });

  it("POST /api/study-records — returns 201 and creates a record", async () => {
    const res = await fetch(`${BASE_URL}/api/study-records`, {
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
    const res = await fetch(`${BASE_URL}/api/study-records`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ lesson_id: testRecordLessonId, study_date: testDate }),
    });
    expect(res.status).toBe(409);
    const data = (await res.json()) as { error: string };
    expect(data.error).toMatch(/已绑定/);
  });

  it("POST /api/study-records — inactive lesson returns 404", async () => {
    const res = await fetch(`${BASE_URL}/api/study-records`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({
        lesson_id: testInactiveLessonId,
        study_date: testDate,
      }),
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/study-records?date= — returns records for the day", async () => {
    const res = await fetch(
      `${BASE_URL}/api/study-records?date=${testDate}`,
      { headers: { Cookie: userCookie } },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { records: { id: number }[]; date: string };
    expect(data.date).toBe(testDate);
    expect(data.records.some((r) => Number(r.id) === testRecordId)).toBe(true);
  });

  it("DELETE /api/study-records/:id — record no longer in list after delete", async () => {
    const deleteDate = "2026-03-20";
    const r2 = await fetch(`${BASE_URL}/api/study-records`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({
        lesson_id: testRecordLessonId,
        study_date: deleteDate,
      }),
    });
    const { record: rec2 } = (await r2.json()) as { record: { id: number } };
    const rec2Id = Number(rec2.id);

    const res = await fetch(`${BASE_URL}/api/study-records/${rec2Id}`, {
      method: "DELETE",
      headers: { Cookie: userCookie },
    });
    expect(res.status).toBe(200);

    // Verify it is gone from the list
    const listRes = await fetch(
      `${BASE_URL}/api/study-records?date=${deleteDate}`,
      { headers: { Cookie: userCookie } },
    );
    const listData = (await listRes.json()) as { records: { id: number }[] };
    expect(listData.records.some((r) => Number(r.id) === rec2Id)).toBe(false);
  });
});

// ─── Tasks ────────────────────────────────────────────────────────────────────

describe("Tasks", () => {
  const testDate = "2026-03-11";

  beforeAll(async () => {
    const chRes = await fetch(
      `${BASE_URL}/api/subjects/${subjectId}/chapters`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "Tasks测试章节" }),
      },
    );
    const { chapter } = (await chRes.json()) as { chapter: { id: number } };

    const lRes = await fetch(
      `${BASE_URL}/api/chapters/${Number(chapter.id)}/lessons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ title: "任务测试课时", status: "active" }),
      },
    );
    const { lesson } = (await lRes.json()) as { lesson: { id: number } };

    const srRes = await fetch(`${BASE_URL}/api/study-records`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({
        lesson_id: Number(lesson.id),
        study_date: testDate,
      }),
    });
    const { record } = (await srRes.json()) as { record: { id: number } };
    testTaskRecordId = Number(record.id);

    // Pre-create the task used by PATCH / DELETE tests
    const taskRes = await fetch(
      `${BASE_URL}/api/study-records/${testTaskRecordId}/tasks`,
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
    const res = await fetch(
      `${BASE_URL}/api/study-records/${testTaskRecordId}/tasks`,
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
    const res = await fetch(
      `${BASE_URL}/api/study-records/${testTaskRecordId}/tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
        body: JSON.stringify({ task_type: "invalid" }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("GET /api/study-records/:recordId/tasks — lists tasks", async () => {
    const res = await fetch(
      `${BASE_URL}/api/study-records/${testTaskRecordId}/tasks`,
      { headers: { Cookie: userCookie } },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tasks: { id: number }[] };
    expect(data.tasks.some((t) => Number(t.id) === testTaskId)).toBe(true);
  });

  it("GET /api/study-records/:recordId/tasks — 404 for non-owned record", async () => {
    const res = await fetch(`${BASE_URL}/api/study-records/99999/tasks`, {
      headers: { Cookie: userCookie },
    });
    expect(res.status).toBe(404);
  });

  it("PATCH /api/tasks/:id — mark done sets completed_at (verified via GET tasks)", async () => {
    const res = await fetch(`${BASE_URL}/api/tasks/${testTaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ status: "done" }),
    });
    expect(res.status).toBe(200);

    const getRes = await fetch(
      `${BASE_URL}/api/study-records/${testTaskRecordId}/tasks`,
      { headers: { Cookie: userCookie } },
    );
    const { tasks } = (await getRes.json()) as {
      tasks: { id: number; status: string; completed_at: string | null }[];
    };
    const task = tasks.find((t) => Number(t.id) === testTaskId)!;
    expect(task.status).toBe("done");
    expect(task.completed_at).not.toBeNull();
  });

  it("PATCH /api/tasks/:id — patching only note does NOT clear completed_at", async () => {
    // Create a fresh task, mark done, then patch only note
    const createRes = await fetch(
      `${BASE_URL}/api/study-records/${testTaskRecordId}/tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
        body: JSON.stringify({ task_type: "review", note: "初始备注" }),
      },
    );
    const { task: freshTask } = (await createRes.json()) as {
      task: { id: number };
    };
    const freshId = Number(freshTask.id);

    await fetch(`${BASE_URL}/api/tasks/${freshId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ status: "done" }),
    });

    // Patch only note — status and completed_at must survive
    await fetch(`${BASE_URL}/api/tasks/${freshId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ note: "新备注" }),
    });

    const getRes = await fetch(
      `${BASE_URL}/api/study-records/${testTaskRecordId}/tasks`,
      { headers: { Cookie: userCookie } },
    );
    const { tasks } = (await getRes.json()) as {
      tasks: { id: number; status: string; completed_at: string | null }[];
    };
    const task = tasks.find((t) => Number(t.id) === freshId)!;
    expect(task.status).toBe("done");
    expect(task.completed_at).not.toBeNull();
  });

  it("PATCH /api/tasks/:id — mark pending clears completed_at", async () => {
    // testTaskId is currently "done" from the earlier test
    const res = await fetch(`${BASE_URL}/api/tasks/${testTaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ status: "pending" }),
    });
    expect(res.status).toBe(200);

    const getRes = await fetch(
      `${BASE_URL}/api/study-records/${testTaskRecordId}/tasks`,
      { headers: { Cookie: userCookie } },
    );
    const { tasks } = (await getRes.json()) as {
      tasks: { id: number; status: string; completed_at: string | null }[];
    };
    const task = tasks.find((t) => Number(t.id) === testTaskId)!;
    expect(task.status).toBe("pending");
    expect(task.completed_at).toBeNull();
  });

  it("PATCH /api/tasks/:id — 404 for task not belonging to user", async () => {
    // Server checks task exists before reading body; omit body to avoid TCP contamination
    const res = await fetch(`${BASE_URL}/api/tasks/99999`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
    });
    await res.text();
    expect(res.status).toBe(404);
  });

  it("study_record status auto-recomputes to in_progress then done", async () => {
    // testTaskId is "pending"; create a second task
    const t2Res = await fetch(
      `${BASE_URL}/api/study-records/${testTaskRecordId}/tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
        body: JSON.stringify({ task_type: "preview" }),
      },
    );
    const { task: task2 } = (await t2Res.json()) as { task: { id: number } };
    const task2Id = Number(task2.id);

    // Mark testTaskId done → at least 1 done + others pending = in_progress
    await fetch(`${BASE_URL}/api/tasks/${testTaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ status: "done" }),
    });

    const srRes1 = await fetch(
      `${BASE_URL}/api/study-records?date=${testDate}`,
      { headers: { Cookie: userCookie } },
    );
    const srData1 = (await srRes1.json()) as {
      records: { id: number; status: string }[];
    };
    const record1 = srData1.records.find((r) => Number(r.id) === testTaskRecordId);
    expect(record1?.status).toBe("in_progress");

    // Mark all remaining tasks done
    const getRes = await fetch(
      `${BASE_URL}/api/study-records/${testTaskRecordId}/tasks`,
      { headers: { Cookie: userCookie } },
    );
    const { tasks: allTasks } = (await getRes.json()) as {
      tasks: { id: number; status: string }[];
    };
    for (const t of allTasks.filter((t) => t.status === "pending")) {
      await fetch(`${BASE_URL}/api/tasks/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
        body: JSON.stringify({ status: "done" }),
      });
    }
    // Ensure task2 is done too
    await fetch(`${BASE_URL}/api/tasks/${task2Id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ status: "done" }),
    });

    const srRes2 = await fetch(
      `${BASE_URL}/api/study-records?date=${testDate}`,
      { headers: { Cookie: userCookie } },
    );
    const srData2 = (await srRes2.json()) as {
      records: { id: number; status: string }[];
    };
    const record2 = srData2.records.find((r) => Number(r.id) === testTaskRecordId);
    expect(record2?.status).toBe("done");
  });

  it("DELETE /api/tasks/:id — task no longer in list after delete", async () => {
    const cr = await fetch(
      `${BASE_URL}/api/study-records/${testTaskRecordId}/tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
        body: JSON.stringify({ task_type: "preview" }),
      },
    );
    const { task: toDelete } = (await cr.json()) as { task: { id: number } };
    const deleteId = Number(toDelete.id);

    const res = await fetch(`${BASE_URL}/api/tasks/${deleteId}`, {
      method: "DELETE",
      headers: { Cookie: userCookie },
    });
    expect(res.status).toBe(200);

    const tasksRes = await fetch(
      `${BASE_URL}/api/study-records/${testTaskRecordId}/tasks`,
      { headers: { Cookie: userCookie } },
    );
    const { tasks } = (await tasksRes.json()) as { tasks: { id: number }[] };
    expect(tasks.some((t) => Number(t.id) === deleteId)).toBe(false);
  });

  it("DELETE /api/tasks/:id — 404 for non-existent task", async () => {
    const res = await fetch(`${BASE_URL}/api/tasks/99999`, {
      method: "DELETE",
      headers: { Cookie: userCookie },
    });
    await res.text(); // drain body before AI Chat tests begin
    expect(res.status).toBe(404);
  });
});

// ─── AI Chat ──────────────────────────────────────────────────────────────────

describe("AI Chat", () => {
  it("POST /api/study-records/:recordId/ai-chat — 401 without auth", async () => {
    // No cookie → server returns 401 before parsing body; send no body to avoid
    // leaving unread bytes in the keep-alive connection that could corrupt test 3.
    const res = await fetch(`${BASE_URL}/api/study-records/1/ai-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    await res.text();
    expect(res.status).toBe(401);
  });

  it("POST /api/study-records/:recordId/ai-chat — 404 for missing record", async () => {
    // Record 99999 not found → server returns 404 before parsing body.
    const res = await fetch(`${BASE_URL}/api/study-records/99999/ai-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
    });
    await res.text();
    expect(res.status).toBe(404);
  });

  it("POST /api/study-records/:recordId/ai-chat — 400 for empty message", async () => {
    const res = await fetch(
      `${BASE_URL}/api/study-records/${testTaskRecordId}/ai-chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: userCookie },
        body: JSON.stringify({ message: "" }),
      },
    );
    expect(res.status).toBe(400);
  });
});
