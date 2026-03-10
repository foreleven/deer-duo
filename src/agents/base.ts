import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { StructuredTool } from "@langchain/core/tools";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { CompiledStateGraph } from "@langchain/langgraph";
import { createModel, type CreateModelOptions } from "./models";

// ── Types ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCompiledGraph = CompiledStateGraph<any, any, any, any, any, any>;

// ── Abstract Agent ────────────────────────────────────────────────────────────

/**
 * Base class for all LangGraph agents in this project.
 *
 * Subclasses must implement three abstract methods:
 * - `buildGraph()` — construct and compile the StateGraph with all nodes/edges.
 *   Node implementations should be defined as class methods and wired in here.
 * - `buildInitialState(input)` — convert the typed input to the graph's initial state.
 * - `extractOutput(state)` — extract the typed result from the final graph state.
 *
 * The base class provides a default `invoke()` that wires all three together.
 *
 * @template TInput  The type passed to `invoke()`.
 * @template TOutput The type returned by `invoke()`.
 *
 * @example
 * ```ts
 * class MyAgent extends Agent<string, { summary: string }> {
 *   protected agentNode(state) { ... }          // node method
 *   protected buildGraph() {
 *     return new StateGraph(MyState)
 *       .addNode("agent", (s) => this.agentNode(s))
 *       .addEdge("__start__", "agent")
 *       .addEdge("agent", "__end__")
 *       .compile();
 *   }
 *   protected buildInitialState(query) { return { messages: [new HumanMessage(query)] }; }
 *   protected extractOutput(state) { return { summary: state.messages.at(-1)?.content }; }
 * }
 * const result = await new MyAgent("qwen3.5-plus", env).invoke("some query");
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
   * Created fresh on each call so callers can bind different tool sets.
   */
  protected createModel(opts?: CreateModelOptions): BaseChatModel {
    return createModel(this.modelName, this.env, opts);
  }

  /**
   * Instantiate the configured model with tools from `getTools()` pre-bound.
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

  // ── Abstract methods ────────────────────────────────────────────────────────

  /**
   * Build and compile the LangGraph StateGraph.
   *
   * Define all nodes (as class methods), edges, and conditional routing here,
   * then return the compiled graph.
   */
  protected abstract buildGraph(): AnyCompiledGraph;

  /**
   * Convert the typed input into the graph's initial state object.
   */
  protected abstract buildInitialState(input: TInput): Record<string, unknown>;

  /**
   * Extract the typed result from the final graph state.
   */
  protected abstract extractOutput(state: Record<string, unknown>): TOutput;

  // ── Default invoke ──────────────────────────────────────────────────────────

  /**
   * Execute the agent:
   *  1. `buildGraph()` — compile the StateGraph
   *  2. invoke it with `buildInitialState(input)`
   *  3. return `extractOutput(finalState)`
   */
  async invoke(input: TInput): Promise<TOutput> {
    const graph = this.buildGraph();
    const initialState = this.buildInitialState(input);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const finalState = await graph.invoke(initialState);
    return this.extractOutput(finalState as Record<string, unknown>);
  }
}
