import { tool } from "@langchain/core/tools";
import { tavily } from "@tavily/core";
import { z } from "zod";

/**
 * Create a web fetch tool that extracts the full text content of a URL
 * using the Tavily Extract API.
 */
export function createWebFetchTool(tavilyApiKey: string) {
  const client = tavily({ apiKey: tavilyApiKey });

  return tool(
    async ({ url }: { url: string }) => {
      const response = await client.extract([url]);

      if (!response.results || response.results.length === 0) {
        return `无法提取页面内容：${url}`;
      }

      const result = response.results[0];
      const lines: string[] = [];
      lines.push(`【来源】${result.url}`);
      lines.push(`【正文】`);
      lines.push(result.rawContent ?? "（无内容）");
      return lines.join("\n");
    },
    {
      name: "web_fetch",
      description:
        "通过 Tavily Extract API 获取指定 URL 页面的完整文本内容。适合抓取课文原文或知识点详情页。",
      schema: z.object({
        url: z.string().url().describe("要抓取内容的网页 URL"),
      }),
    },
  );
}
