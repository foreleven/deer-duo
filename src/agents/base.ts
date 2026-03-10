import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { StructuredTool } from "@langchain/core/tools";
import { createModel, type CreateModelOptions } from "./models";

// ── Abstract Agent ────────────────────────────────────────────────────────────

/**
 * Base class for all LangGraph agents in this project.
 *
 * Subclasses must implement `run(input)` and may override `getTools()` to
 * supply the tool list used for the ReAct loop.
 *
 * @template TInput  The type of the single input value passed to `run()`.
 * @template TOutput The type of the structured result returned by `run()`.
 *
 * @example
 * ```ts
 * class MyAgent extends Agent<string, { summary: string }> {
 *   protected getTools() { return [createWebSearchTool(this.tavilyApiKey)]; }
 *   async run(query: string) { ... }
 * }
 * const agent = new MyAgent("qwen3.5-plus", env);
 * const result = await agent.run("some query");
 * ```
 */
export abstract class Agent<TInput, TOutput> {
  /** Name of the model as declared in config.yaml (e.g. "qwen3.5-plus") */
  protected readonly modelName: string;

  /** Runtime environment bindings used to resolve "$VAR" references in config.yaml */
  protected readonly env: Record<string, string | undefined>;

  constructor(
    modelName: string,
    env: Record<string, string | undefined>,
  ) {
    this.modelName = modelName;
    this.env = env;
  }

  // ── Model helpers ───────────────────────────────────────────────────────────

  /**
   * Instantiate the configured model, optionally with thinking enabled.
   * The model is created fresh on each call (not cached) so that callers can
   * bind different tool sets to separate instances.
   */
  protected createModel(opts?: CreateModelOptions): BaseChatModel {
    return createModel(this.modelName, this.env, opts);
  }

  /**
   * Instantiate the configured model and bind the tools returned by
   * `getTools()` to it.
   */
  protected createModelWithTools(opts?: CreateModelOptions): ReturnType<BaseChatModel["bindTools"]> {
    return this.createModel(opts).bindTools(this.getTools());
  }

  // ── Tool helpers ────────────────────────────────────────────────────────────

  /**
   * Return the list of tools available to the ReAct loop.
   * Override in subclasses to provide agent-specific tools.
   */
  protected getTools(): StructuredTool[] {
    return [];
  }

  // ── Entry point ─────────────────────────────────────────────────────────────

  /**
   * Execute the agent and return a structured result.
   *
   * @param input  Agent-specific input (e.g. a search title, a question, …)
   */
  abstract run(input: TInput): Promise<TOutput>;
}
