import { parse } from "yaml";
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
// @ts-expect-error — Vite resolves ?raw imports to a string at bundle time
import configYaml from "../../../config.yaml?raw";

// ── Config schema ─────────────────────────────────────────────────────────────

export interface ModelConfig {
  name: string;
  display_name: string;
  /** Python-style import path, e.g. "langchain_anthropic:ChatAnthropic" */
  use: string;
  model: string;
  /** API key value or environment variable reference like "$ANTHROPIC_API_KEY" */
  api_key?: string;
  /** Provider base URL or gateway endpoint */
  base_url?: string;
  max_tokens?: number;
  temperature?: number;
  supports_vision?: boolean;
  supports_thinking?: boolean;
  /** Extra constructor params merged in when thinking is enabled */
  when_thinking_enabled?: Record<string, unknown>;
}

interface Config {
  models: ModelConfig[];
}

// ── Model registry ────────────────────────────────────────────────────────────
// Maps "langchain_<pkg>:<ClassName>" identifiers to their constructors and
// provider-specific parameter builders.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyConstructor = new (params: Record<string, unknown>) => BaseChatModel;

/** Translates the generic config fields to provider-specific constructor params. */
type ParamBuilder = (cfg: ModelConfig, apiKey: string | undefined) => Record<string, unknown>;

interface ProviderRegistration {
  Constructor: AnyConstructor;
  buildParams: ParamBuilder;
}

const MODEL_REGISTRY: Record<string, ProviderRegistration> = {
  "langchain_anthropic:ChatAnthropic": {
    Constructor: ChatAnthropic as unknown as AnyConstructor,
    buildParams: (cfg, apiKey) => ({
      model: cfg.model,
      ...(apiKey !== undefined ? { apiKey } : {}),
      // ChatAnthropic uses `anthropicApiUrl` for the base URL / gateway endpoint
      ...(cfg.base_url ? { anthropicApiUrl: cfg.base_url } : {}),
      ...(cfg.max_tokens !== undefined ? { maxTokens: cfg.max_tokens } : {}),
      ...(cfg.temperature !== undefined ? { temperature: cfg.temperature } : {}),
    }),
  },
};

// ── Config (parsed once at module init) ───────────────────────────────────────

const _config: Config = parse(configYaml as string) as Config;

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveEnvVar(
  value: string | undefined,
  env: Record<string, string | undefined>,
): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("$")) {
    return env[value.slice(1)];
  }
  return value;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface CreateModelOptions {
  /** Merge the model's when_thinking_enabled params into the constructor */
  enableThinking?: boolean;
}

/**
 * Instantiate a LangChain chat model by its `name` from config.yaml.
 * The `name` must exactly match the `name` field of one of the entries
 * in the `models` list (e.g. "qwen3.5-plus").
 *
 * @param name   Model name as declared in config.yaml
 * @param env    Environment variables used to resolve "$VAR" references in api_key
 * @param opts   Additional options (e.g. { enableThinking: true })
 */
export function createModel(
  name: string,
  env: Record<string, string | undefined>,
  opts?: CreateModelOptions,
): BaseChatModel {
  const modelConfig = _config.models?.find((m) => m.name === name);

  if (!modelConfig) {
    throw new Error(`Model '${name}' not found in config.yaml`);
  }

  const registration = MODEL_REGISTRY[modelConfig.use];
  if (!registration) {
    throw new Error(
      `Model provider '${modelConfig.use}' is not registered. ` +
        `Supported providers: ${Object.keys(MODEL_REGISTRY).join(", ")}`,
    );
  }

  const apiKey = resolveEnvVar(modelConfig.api_key, env);
  const params = registration.buildParams(modelConfig, apiKey);

  if (
    opts?.enableThinking &&
    modelConfig.supports_thinking &&
    modelConfig.when_thinking_enabled
  ) {
    Object.assign(params, modelConfig.when_thinking_enabled);
  }

  return new registration.Constructor(params);
}

/**
 * Return the list of all model configs declared in config.yaml.
 */
export function listModels(): ModelConfig[] {
  return _config.models ?? [];
}
