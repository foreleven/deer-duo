import type { Context } from "hono";
import type { Bindings } from "../lib/bindings";
import { requireLogin } from "../lib/auth";
import { fetchChapterFromWeb } from "../agents/graph";

export async function fetchChapterContent(c: Context<{ Bindings: Bindings }>) {
  const user = await requireLogin(c);
  if (!user) return c.json({ error: "未登录" }, 401);
  if (user.role !== "admin") return c.json({ error: "权限不足" }, 403);

  let body: { title?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "无效的请求体" }, 400);
  }

  const { title } = body;
  if (!title?.trim()) return c.json({ error: "章节标题不能为空" }, 400);

  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: "AI 服务暂未配置（缺少 ANTHROPIC_API_KEY）" }, 503);
  }
  if (!c.env.TAVILY_API_KEY) {
    return c.json({ error: "搜索服务暂未配置（缺少 TAVILY_API_KEY）" }, 503);
  }

  try {
    const result = await fetchChapterFromWeb(title.trim(), {
      env: {
        ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY,
        ANTHROPIC_BASE_URL: c.env.ANTHROPIC_BASE_URL,
      },
      tavilyApiKey: c.env.TAVILY_API_KEY,
    });
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return c.json({ error: `内容获取失败：${message}` }, 502);
  }
}
