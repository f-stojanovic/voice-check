/**
 * The seam between the agents and the network.
 *
 * Every agent takes a {@link ModelClient} rather than constructing one. That
 * is the whole of ADR 009 and it buys two things: tests that never make a
 * network call and never need a key, and a boundary where usage and cost are
 * recorded once instead of at every call site.
 *
 * The interface is deliberately narrow — ONE forced tool call, one response.
 * It is not a general Messages wrapper. A narrow seam is a seam a fake can
 * implement completely, and a fake that implements the whole interface cannot
 * drift from the real thing by quietly not supporting something.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readApiKey } from './env.js';
import { costUsd, ZERO_USAGE, type Usage } from './pricing.js';

/** The model every agent in this repository runs on. */
export const MODEL = 'claude-opus-5';

/**
 * Non-streaming, so this stays under the SDK's default HTTP timeout. Both
 * agents produce a single small structured object; the ceiling exists to stop
 * a truncated tool call, not because the output is expected to approach it.
 */
const MAX_TOKENS = 16_000;

export interface ToolSpec {
  readonly name: string;
  readonly description: string;
  /** JSON Schema. Hand-written so `strict` has something exact to enforce. */
  readonly inputSchema: Record<string, unknown>;
}

export interface ToolCallRequest {
  readonly system: string;
  readonly userContent: string;
  readonly tool: ToolSpec;
}

export interface ToolCallResponse {
  /** The raw tool input, still unvalidated. The agent's Zod schema is next. */
  readonly input: unknown;
  readonly usage: Usage;
  readonly model: string;
}

/**
 * A plain-prose request.
 *
 * WHY THIS EXISTS ALONGSIDE `callTool`, when the rest of the repository argues
 * for forced tool calls: the corpus generator needs the model's DEFAULT
 * REGISTER — what it writes when nobody constrains it — because that register
 * is the thing being measured. A forced tool call is a different mode of
 * generation, and text produced to fill a schema field is not the text a
 * model writes when asked for a blog post. Using the structured path here
 * would quietly change the measurement.
 *
 * Nothing else in the repository uses this, and nothing should: an agent whose
 * output is read by code returns structure (ADR 007).
 */
export interface CompletionRequest {
  readonly system?: string;
  readonly userContent: string;
  readonly maxTokens?: number;
}

export interface CompletionResponse {
  readonly text: string;
  readonly usage: Usage;
  readonly model: string;
}

export interface ModelClient {
  callTool(request: ToolCallRequest): Promise<ToolCallResponse>;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

/** The model produced no usable tool call. Distinct from the API failing. */
export class MalformedToolCallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedToolCallError';
  }
}

/** The API failed: rate limit, auth, network, 500. Not the model's fault. */
export class ModelUnavailableError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ModelUnavailableError';
    this.status = status;
  }
}

/**
 * The real client.
 *
 * The key is passed explicitly. A zero-argument `new Anthropic()` would fall
 * back through `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and an on-disk
 * OAuth profile, any of which could authenticate a run nothing in this
 * repository chose — see `env.ts`.
 */
export function anthropicClient(options: { apiKey?: string; model?: string } = {}): ModelClient {
  const model = options.model ?? MODEL;
  const client = new Anthropic({ apiKey: options.apiKey ?? readApiKey() });

  return {
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
      let response: Anthropic.Message;
      try {
        response = await client.messages.create({
          model,
          max_tokens: request.maxTokens ?? MAX_TOKENS,
          ...(request.system === undefined ? {} : { system: request.system }),
          messages: [{ role: 'user', content: request.userContent }],
        });
      } catch (cause) {
        if (cause instanceof Anthropic.APIError) {
          throw new ModelUnavailableError(
            `completion: API error ${cause.status ?? '?'} — ${cause.message}`,
            cause.status,
          );
        }
        throw new ModelUnavailableError(`completion: ${(cause as Error).message}`);
      }

      if (response.stop_reason === 'refusal') {
        throw new ModelUnavailableError(
          `completion: the model declined the request ` +
            `(${response.stop_details?.category ?? 'no category'})`,
        );
      }

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      return {
        text,
        model: response.model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
          cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
        },
      };
    },

    async callTool(request: ToolCallRequest): Promise<ToolCallResponse> {
      let response: Anthropic.Message;
      try {
        response = await client.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          system: request.system,
          messages: [{ role: 'user', content: request.userContent }],
          tools: [
            {
              name: request.tool.name,
              description: request.tool.description,
              input_schema: request.tool
                .inputSchema as unknown as Anthropic.Tool['input_schema'],
              // Guarantees the input validates against the schema exactly,
              // which turns "the model returned a field we did not ask for"
              // from a runtime surprise into an API-level impossibility.
              strict: true,
            },
          ],
          // A FORCED tool call. Not a request for JSON in prose, and not
          // `tool_choice: auto` with a fallback parser — see ADR 007. There is
          // no path here where the agent returns text to be parsed.
          tool_choice: { type: 'tool', name: request.tool.name, disable_parallel_tool_use: true },
        });
      } catch (cause) {
        if (cause instanceof Anthropic.APIError) {
          throw new ModelUnavailableError(
            `${request.tool.name}: API error ${cause.status ?? '?'} — ${cause.message}`,
            cause.status,
          );
        }
        throw new ModelUnavailableError(
          `${request.tool.name}: ${(cause as Error).message}`,
        );
      }

      // A refusal is a 200 with `stop_reason: "refusal"` and no tool call, so
      // it has to be checked before reading content or it reads as malformed.
      if (response.stop_reason === 'refusal') {
        throw new MalformedToolCallError(
          `${request.tool.name}: the model declined the request ` +
            `(${response.stop_details?.category ?? 'no category'})`,
        );
      }

      const block = response.content.find((b) => b.type === 'tool_use');
      if (block === undefined) {
        throw new MalformedToolCallError(
          `${request.tool.name}: no tool call in the response ` +
            `(stop_reason ${response.stop_reason ?? 'unknown'})`,
        );
      }

      return {
        input: block.input,
        model: response.model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
          cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
        },
      };
    },
  };
}

/** What an agent returns: the value, and what it cost to get it. */
export interface AgentRun<T> {
  readonly value: T;
  readonly model: string;
  readonly usage: Usage;
  /** Null when the model is not in the pricing table. Never silently zero. */
  readonly costUsd: number | null;
}

export function runOf<T>(value: T, response: ToolCallResponse): AgentRun<T> {
  return {
    value,
    model: response.model,
    usage: response.usage,
    costUsd: costUsd(response.model, response.usage),
  };
}

export { ZERO_USAGE };
