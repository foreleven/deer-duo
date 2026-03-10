import { Annotation, StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createWebSearchTool } from "./tools/web_search_tool";
import { createWebFetchTool } from "./tools/web_fetch_tool";

// ── State definition ──────────────────────────────────────────────────────────

const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  // Final structured outputs
  chapterContent: Annotation<string>({ default: () => "", reducer: (_, v) => v }),
  knowledgePoints: Annotation<string>({ default: () => "", reducer: (_, v) => v }),
});

// ── Graph options ─────────────────────────────────────────────────────────────

export interface ChapterFetchOptions {
  anthropicApiKey: string;
  /** Optional custom Anthropic API gateway base URL */
  anthropicBaseUrl?: string;
  tavilyApiKey: string;
}

export interface ChapterFetchResult {
  chapterContent: string;
  knowledgePoints: string;
}

// ── Graph factory ─────────────────────────────────────────────────────────────

/**
 * Create and invoke a LangGraph agent that:
 * 1. Searches the web for a given chapter/lesson title
 * 2. Fetches relevant page content
 * 3. Uses Claude to extract the lesson text and key knowledge points
 */
export async function fetchChapterFromWeb(
  title: string,
  options: ChapterFetchOptions,
): Promise<ChapterFetchResult> {
  const tools = [
    createWebSearchTool(options.tavilyApiKey),
    createWebFetchTool(options.tavilyApiKey),
  ];

  const model = new ChatAnthropic({
    apiKey: options.anthropicApiKey,
    ...(options.anthropicBaseUrl ? { anthropicApiUrl: options.anthropicBaseUrl } : {}),
    model: "claude-3-5-haiku-20241022",
    maxTokens: 4096,
  }).bindTools(tools);

  const toolNode = new ToolNode(tools);

  // ── Agent node: call model ──────────────────────────────────────────────────

  async function callModel(state: typeof AgentState.State) {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  }

  // ── Router: continue calling tools or finish ─────────────────────────────────

  function shouldContinue(state: typeof AgentState.State) {
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
      return "tools";
    }
    return "extract";
  }

  // ── Extract node: parse final output into structured fields ─────────────────

  async function extractOutput(state: typeof AgentState.State) {
    const lastMessage = state.messages[state.messages.length - 1];
    const rawText = typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

    // Parse structured output using a second Claude call
    const extractModel = new ChatAnthropic({
      apiKey: options.anthropicApiKey,
      ...(options.anthropicBaseUrl ? { anthropicApiUrl: options.anthropicBaseUrl } : {}),
      model: "claude-3-5-haiku-20241022",
      maxTokens: 4096,
    });

    const extractPrompt = `你是一个内容整理助手。根据以下搜索和整理的内容，请输出两个部分：

原始内容：
${rawText}

请严格按照以下 JSON 格式输出，不要添加其他内容：
{
  "chapterContent": "课文/章节正文内容（完整原文，Markdown 格式）",
  "knowledgePoints": "知识点整理（包括生字词、主题思想、写作特色、修辞手法等，Markdown 格式）"
}`;

    const response = await extractModel.invoke(extractPrompt);
    const text = typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

    // Extract JSON from response — find the outermost {...} block
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      return {
        chapterContent: rawText,
        knowledgePoints: "",
      };
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
      return {
        chapterContent: rawText,
        knowledgePoints: "",
      };
    }
  }

  // ── Build graph ─────────────────────────────────────────────────────────────

  const workflow = new StateGraph(AgentState)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addNode("extract", extractOutput)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent")
    .addEdge("extract", "__end__");

  const graph = workflow.compile();

  // ── Initial prompt ──────────────────────────────────────────────────────────

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

  const finalState = await graph.invoke({
    messages: [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ],
  });

  return {
    chapterContent: finalState.chapterContent,
    knowledgePoints: finalState.knowledgePoints,
  };
}
