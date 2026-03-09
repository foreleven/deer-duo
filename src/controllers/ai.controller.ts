import type { Context } from "hono";
import type { Bindings } from "../lib/bindings";
import { requireLogin } from "../lib/auth";

const TASK_TYPE_LABELS: Record<string, string> = {
  homework: "作业",
  recitation: "背诵",
  preview: "预习",
  review: "复习",
};

export async function aiChat(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);

  const record = await c.env.DB.prepare(
    `SELECT sr.id, ch.title AS chapter_title,
            co.title AS course_title,
            s.name AS subject_name
     FROM study_records sr
     JOIN chapters ch ON ch.id = sr.chapter_id
     JOIN courses co ON co.id = ch.course_id
     JOIN subjects s ON s.id = co.subject_id
     WHERE sr.id = ? AND sr.user_id = ?`,
  )
    .bind(c.req.param("recordId"), user.sub)
    .first<{ id: number; chapter_title: string; course_title: string; subject_name: string }>();

  if (!record) return c.json({ error: "记录不存在" }, 404);

  let body: { message: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "无效的请求体" }, 400);
  }

  const { message } = body;
  if (!message?.trim()) return c.json({ error: "消息不能为空" }, 400);

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

  const safeTitle = (record.chapter_title ?? "").replace(/[[\]]/g, "");

  const systemPrompt = `你是一名专业的中小学辅导老师，当前辅导的科目是【${record.subject_name}】，课程是【${record.course_title}】。
今天学习的章节是：【${safeTitle}】
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
}
