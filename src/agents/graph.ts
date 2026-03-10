import { Annotation, StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { StructuredTool } from "@langchain/core/tools";
import { createWebSearchTool } from "./tools/web_search_tool";
import { createWebFetchTool } from "./tools/web_fetch_tool";
import { Agent } from "./base";

// ── State definition ──────────────────────────────────────────────────────────

const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  chapterContent: Annotation<string>({ default: () => "", reducer: (_, v) => v }),
  knowledgePoints: Annotation<string>({ default: () => "", reducer: (_, v) => v }),
});

type ChapterFetchAgentState = typeof AgentState.State;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChapterFetchResult {
  chapterContent: string;
  knowledgePoints: string;
}

// ── ChapterFetchAgent ─────────────────────────────────────────────────────────

/**
 * LangGraph ReAct agent that searches the web for a chapter/lesson title and
 * returns structured lesson content and knowledge points.
 *
 * Flow: agentNode (ReAct loop with tools) → extractNode (structured extraction)
 *
 * @example
 * ```ts
 * const agent = new ChapterFetchAgent("qwen3.5-plus", env, tavilyApiKey);
 * const result = await agent.invoke("观潮");
 * // → { chapterContent: "...", knowledgePoints: "..." }
 * ```
 */
export class ChapterFetchAgent extends Agent<string, ChapterFetchResult> {
  private readonly tavilyApiKey: string;

  constructor(
    modelName: string,
    env: Record<string, string | undefined>,
    tavilyApiKey: string,
  ) {
    super(modelName, env);
    this.tavilyApiKey = tavilyApiKey;
  }

  protected override getTools(): StructuredTool[] {
    return [
      createWebSearchTool(this.tavilyApiKey),
      createWebFetchTool(this.tavilyApiKey),
    ];
  }

  // ── Node methods ────────────────────────────────────────────────────────────

  protected async agentNode(
    state: ChapterFetchAgentState,
  ): Promise<Partial<ChapterFetchAgentState>> {
    const model = this.createModelWithTools();
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  }

  protected shouldContinue(state: ChapterFetchAgentState): "tools" | "extract" {
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
      return "tools";
    }
    return "extract";
  }

  protected async extractNode(
    state: ChapterFetchAgentState,
  ): Promise<Partial<ChapterFetchAgentState>> {
    const lastMessage = state.messages[state.messages.length - 1];
    const rawText =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const extractModel = this.createModel();

    const extractPrompt = `你是一个内容整理助手。根据以下搜索和整理的内容，请输出两个部分：

原始内容：
${rawText}

请严格按照以下 JSON 格式输出，不要添加其他内容：
{
  "chapterContent": "课文/章节正文内容（完整原文，Markdown 格式）",
  "knowledgePoints": "知识点整理（包括生字词、主题思想、写作特色、修辞手法等，Markdown 格式）"
}`;

    const response = await extractModel.invoke(extractPrompt);
    const text =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      return { chapterContent: rawText, knowledgePoints: "" };
    }
    const jsonMatch = text.slice(jsonStart, jsonEnd + 1);

    try {
      const parsed = JSON.parse(jsonMatch) as {
        chapterContent?: string;
        knowledgePoints?: string;
      };
      return {
        chapterContent: parsed.chapterContent ?? rawText,
        knowledgePoints: parsed.knowledgePoints ?? "",
      };
    } catch {
      return { chapterContent: rawText, knowledgePoints: "" };
    }
  }

  // ── buildGraph ──────────────────────────────────────────────────────────────

  protected override buildGraph() {
    const toolNode = new ToolNode(this.getTools());

    return new StateGraph(AgentState)
      .addNode("agent", (state) => this.agentNode(state))
      .addNode("tools", toolNode)
      .addNode("extract", (state) => this.extractNode(state))
      .addEdge("__start__", "agent")
      .addConditionalEdges("agent", (state) => this.shouldContinue(state))
      .addEdge("tools", "agent")
      .addEdge("extract", "__end__")
      .compile();
  }

  // ── buildInitialState ───────────────────────────────────────────────────────

  protected override buildInitialState(title: string): Record<string, unknown> {
    const systemPrompt = `你是一个教育内容整理助手，专门帮助整理中小学课文和知识点。
你的任务是根据给定的课文/章节标题，从互联网上搜索并获取：
1. 课文正文内容（完整原文）
2. 相关知识点（生字词、主题思想、写作特色、修辞手法等）

请使用搜索工具搜索相关内容，如有需要可进一步获取具体网页内容。
获取足够信息后，请整理并输出课文正文和知识点。`;

    const userPrompt = `请帮我搜索课文《${title}》的内容。
1. 先搜索该课文的正文和基本信息
2. 如需要，抓取相关页面获取完整内容
3. 整理输出：课文正文 + 知识点（生字词、主题思想、写作手法等）`;

    return {
      messages: [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ],
    };
  }

  // ── extractOutput ───────────────────────────────────────────────────────────

  protected override extractOutput(state: Record<string, unknown>): ChapterFetchResult {
    return {
      chapterContent: (state.chapterContent as string) ?? "",
      knowledgePoints: (state.knowledgePoints as string) ?? "",
    };
  }
}

// ── Convenience function (backward-compatible) ────────────────────────────────

export interface ChapterFetchOptions {
  /** Name of the model to use as declared in config.yaml */
  modelName?: string;
  /** Fallback API key if not resolved via config.yaml env references */
  anthropicApiKey?: string;
  /** Optional custom Anthropic API gateway base URL (fallback) */
  anthropicBaseUrl?: string;
  tavilyApiKey: string;
  /** Full environment bindings for resolving "$VAR" references in config.yaml */
  env?: Record<string, string | undefined>;
}

/**
 * Convenience wrapper around `ChapterFetchAgent` that matches the original
 * function-based API, keeping existing call sites unchanged.
 */
export async function fetchChapterFromWeb(
  title: string,
  options: ChapterFetchOptions,
): Promise<ChapterFetchResult> {
  const env: Record<string, string | undefined> = options.env ?? {
    ANTHROPIC_API_KEY: options.anthropicApiKey,
    ANTHROPIC_BASE_URL: options.anthropicBaseUrl,
  };

  const agent = new ChapterFetchAgent(
    options.modelName ?? "qwen3.5-plus",
    env,
    options.tavilyApiKey,
  );
  return agent.invoke(title);
}
