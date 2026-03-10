import type { Context } from "hono";
import type { Bindings } from "../lib/bindings";
import { requireLogin } from "../lib/auth";

export async function getChapters(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const { results } = await c.env.DB.prepare(
    "SELECT id, course_id, title, content, sort_order, created_at FROM chapters WHERE course_id = ? ORDER BY sort_order ASC, id ASC",
  )
    .bind(c.req.param("courseId"))
    .all();
  return c.json({ chapters: results });
}

export async function getChapter(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const chapter = await c.env.DB.prepare(
    "SELECT id, course_id, title, content, sort_order, created_at FROM chapters WHERE id = ?",
  )
    .bind(c.req.param("id"))
    .first();
  if (!chapter) return c.json({ error: "章节不存在" }, 404);
  return c.json({ chapter });
}

export async function createChapter(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "权限不足" }, 403);

  let body: { title: string; content?: string; sort_order?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "无效的请求体" }, 400);
  }

  const { title, content = null, sort_order = 0 } = body;
  if (!title?.trim()) return c.json({ error: "章节名称不能为空" }, 400);

  const result = await c.env.DB.prepare(
    "INSERT INTO chapters (course_id, title, content, sort_order) VALUES (?, ?, ?, ?)",
  )
    .bind(c.req.param("courseId"), title.trim(), content, sort_order)
    .run();

  return c.json({ chapter: { id: result.meta.last_row_id, title: title.trim(), content, sort_order } }, 201);
}

export async function updateChapter(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "权限不足" }, 403);

  let body: { title?: string; content?: string | null; sort_order?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "无效的请求体" }, 400);
  }

  const { title, sort_order } = body;
  if (title !== undefined && !title.trim()) return c.json({ error: "章节名称不能为空" }, 400);

  const fields: string[] = [];
  const params: (string | number | null)[] = [];

  if (title !== undefined) {
    fields.push("title = ?");
    params.push(title.trim());
  }
  if ("content" in body) {
    fields.push("content = ?");
    params.push(body.content ?? null);
  }
  if (sort_order !== undefined) {
    fields.push("sort_order = ?");
    params.push(sort_order);
  }

  if (fields.length === 0) return c.json({ ok: true });

  params.push(c.req.param("id"));
  await c.env.DB.prepare(
    `UPDATE chapters SET ${fields.join(", ")} WHERE id = ?`,
  )
    .bind(...params)
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

// ── Upload file → AI.toMarkdown → Qwen extract chapters ────────────────────────

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;
const MAX_MARKDOWN_LENGTH = 8000;

export async function uploadChaptersFromFile(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "权限不足" }, 403);

  const courseId = parseInt(c.req.param("courseId"), 10);
  if (isNaN(courseId)) return c.json({ error: "无效的课程 ID" }, 400);

  // Verify course exists
  const course = await c.env.DB.prepare("SELECT id FROM courses WHERE id = ?")
    .bind(courseId)
    .first<{ id: number }>();
  if (!course) return c.json({ error: "课程不存在" }, 404);

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: "无效的表单数据" }, 400);
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return c.json({ error: "请上传文件" }, 400);
  }

  const fileName = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
    return c.json({ error: "仅支持 PDF、Word（.doc/.docx）格式文件" }, 400);
  }

  if (!c.env.AI) {
    return c.json({ error: "AI 服务暂不可用" }, 503);
  }

  // Step 1: Convert file to Markdown via AI.toMarkdown
  let markdown: string;
  try {
    const results = await c.env.AI.toMarkdown([{ name: file.name, blob: file }]);
    const result = results[0];
    if (!result || result.format === "error") {
      const errMsg = result?.format === "error" ? result.error ?? "" : "";
      return c.json({ error: `文件解析失败${errMsg ? "：" + errMsg : ""}` }, 400);
    }
    markdown = result.data;
    if (!markdown.trim()) {
      return c.json({ error: "文件内容为空，无法提取章节" }, 400);
    }
  } catch {
    return c.json({ error: "文件转换失败，请检查文件格式" }, 400);
  }

  // Step 2: Use Qwen3-30B to extract chapter list from Markdown
  const systemPrompt =
    "你是一个文档解析助手。请从文档内容中提取章节/目录结构，以 JSON 数组格式返回，每项仅包含 title 字段。只输出 JSON 数组，不要包含 Markdown 代码块标记或任何其他说明文字。";
  const userPrompt = `文档内容：\n${markdown.slice(0, MAX_MARKDOWN_LENGTH)}\n\n请提取章节标题列表，格式：[{"title":"第一章 ..."},{"title":"第二章 ..."}]`;

  let chapters: { title: string }[];
  let responseText = "";
  try {
    const aiResponse = await c.env.AI.run("@cf/qwen/qwen3-30b-a3b-fp8", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    // Extract text from response (handle both chat-completion and plain-text formats)
    if (typeof aiResponse === "string") {
      responseText = aiResponse;
    } else if (typeof aiResponse === "object" && aiResponse !== null) {
      const r = aiResponse as { choices?: { message?: { content?: string } }[]; response?: string };
      responseText = r.choices?.[0]?.message?.content ?? r.response ?? "";
    }

    if (!responseText.trim()) {
      return c.json({ error: "AI 未返回有效内容" }, 502);
    }
  } catch {
    return c.json({ error: "AI 请求失败，请稍后重试" }, 503);
  }

  // Extract first JSON array from the response (strip prose / code fences if any)
  const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) {
    return c.json({ error: "AI 无法识别文档章节结构" }, 422);
  }

  try {
    chapters = JSON.parse(jsonMatch[0]) as { title: string }[];
  } catch {
    return c.json({ error: "AI 返回格式无效，无法解析章节信息" }, 422);
  }

  if (!Array.isArray(chapters) || chapters.length === 0) {
    return c.json({ error: "未能从文档中提取到章节信息" }, 422);
  }

  // Step 3: Insert extracted chapters into database
  const maxOrderRow = await c.env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM chapters WHERE course_id = ?",
  )
    .bind(courseId)
    .first<{ max_order: number }>();

  let sortOrder = (maxOrderRow?.max_order ?? -1) + 1;
  const created: { id: number; title: string; sort_order: number }[] = [];

  for (const ch of chapters) {
    if (typeof ch.title !== "string" || !ch.title.trim()) continue;
    const result = await c.env.DB.prepare(
      "INSERT INTO chapters (course_id, title, sort_order) VALUES (?, ?, ?)",
    )
      .bind(courseId, ch.title.trim(), sortOrder)
      .run();
    created.push({ id: result.meta.last_row_id as number, title: ch.title.trim(), sort_order: sortOrder });
    sortOrder++;
  }

  if (created.length === 0) {
    return c.json({ error: "未能从文档中提取到有效章节标题" }, 422);
  }

  return c.json({ ok: true, chapters: created }, 201);
}
