import { tool } from "@langchain/core/tools";
import { tavily } from "@tavily/core";
import { z } from "zod";

/**
 * Create a web search tool backed by Tavily Search API.
 */
export function createWebSearchTool(tavilyApiKey: string) {
  const client = tavily({ apiKey: tavilyApiKey });

  return tool(
    async ({ query }: { query: string }) => {
      const response = await client.search(query, {
        maxResults: 5,
        includeAnswer: true,
      });

      if (!response.results || response.results.length === 0) {
        return "没有找到相关搜索结果。";
      }

      const lines: string[] = [];
      if (response.answer) {
        lines.push(`【摘要】${response.answer}\n`);
      }
      for (const r of response.results) {
        lines.push(`【来源】${r.url}`);
        lines.push(`【标题】${r.title}`);
        lines.push(`【摘要】${r.content}`);
        lines.push("");
      }
      return lines.join("\n");
    },
    {
      name: "web_search",
      description:
        "通过 Tavily 搜索引擎在互联网上搜索信息。适合查找课文原文、知识点等内容。",
      schema: z.object({
        query: z.string().describe("搜索查询词"),
      }),
    },
  );
}
