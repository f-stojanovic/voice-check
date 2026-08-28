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
  /**
   * Output ceiling for THIS call, defaulting to {@link MAX_TOKENS}.
   *
   * Per-request rather than a lower shared constant, because the two paths do
   * different jobs: the corpus generator runs through `complete` and its
   * ceiling was chosen for writing a blog post, while an agent filling a fixed
   * schema has a bounded answer. Lowering the shared number to suit the second
   * would silently truncate the first.
   */
  readonly maxTokens?: number;
}

export interface ToolCallResponse {
  /** The raw tool input, still unvalidated. The agent's Zod schema is next. */
  readonly input: unknown;
  readonly usage: Usage;
  readonly model: string;
  /**
   * How many requests it took, including the one that worked. 1 means no
   * retry.
   *
   * Carried on the response rather than counted in a module-level variable so
   * the number travels with the call that needed it, and so a fake implementing
   * {@link ModelClient} reports 1 without having to know this exists.
   * See {@link TRANSIENT_400_MESSAGE}.
   */
  readonly attempts: number;
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
 * The exact message of the transient 400, and the reason this file argues with
 * a response header.
 *
 * MEASURED, 2026-08-28: the same request body, replayed byte-for-byte, returned
 * 200 eight times and `400 invalid_request_error / "Invalid request data"`
 * eight times in sixteen attempts. Not the schema, not `strict` — the body was
 * identical across both outcomes, and the failure also occurs with `strict`
 * removed entirely.
 *
 * THE API SETS `x-should-retry: false` ON IT, AND WE RETRY ANYWAY. That header
 * is the API telling clients this class of error will not succeed on a repeat,
 * and it is right about `invalid_request_error` in general: a malformed body is
 * malformed every time. It is wrong about this instance, and we have the
 * measurement rather than a hunch.
 *
 * So the match is deliberately exact — status, error type, AND the literal
 * message — and nothing broader. A genuinely malformed request produces a
 * DIFFERENT message ("If you use an unsupported feature, you'll receive a 400
 * error with details" — the structured-outputs docs), so it still fails on the
 * first attempt, loudly, which is the behaviour that must not be lost.
 *
 * The retry count is reported on every run. If it reads 0 for long enough, the
 * API has been fixed and this should come out; a workaround nobody can see the
 * cost of is a workaround that becomes permanent.
 */
export const TRANSIENT_400_MESSAGE = 'Invalid request data';

/** Attempts, not retries: 5 means four retries after the first try. */
const MAX_ATTEMPTS = 5;

/** Short, because a failed attempt bills nothing and costs only wall clock. */
const BACKOFF_MS = [250, 500, 1000, 2000] as const;

/**
 * Whether this is the one error class above, and nothing else.
 *
 * Reads the parsed body rather than string-matching the SDK's rendered message,
 * so a change in how the SDK formats errors cannot silently widen what gets
 * retried.
 */
export function isTransientRequestError(cause: unknown): boolean {
  if (!(cause instanceof Anthropic.APIError)) return false;
  if (cause.status !== 400) return false;
  const body = cause.error as { error?: { type?: unknown; message?: unknown } } | undefined;
  return (
    body?.error?.type === 'invalid_request_error' &&
    body?.error?.message === TRANSIENT_400_MESSAGE
  );
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `send` until it succeeds or the attempts run out, retrying ONLY the
 * transient 400.
 *
 * Returns the attempt count with the response so the caller can report it. Any
 * other error propagates on the first attempt, unchanged.
 */
async function withTransientRetry(
  label: string,
  send: () => Promise<Anthropic.Message>,
): Promise<{ response: Anthropic.Message; attempts: number }> {
  let lastCause: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return { response: await send(), attempts: attempt };
    } catch (cause) {
      if (!isTransientRequestError(cause)) throw cause;
      lastCause = cause;
      const wait = BACKOFF_MS[attempt - 1];
      if (wait !== undefined) await sleep(wait);
    }
  }
  throw new ModelUnavailableError(
    `${label}: gave up after ${MAX_ATTEMPTS} attempts, every one refused with ` +
      `400 "${TRANSIENT_400_MESSAGE}". That error is transient and undocumented; ` +
      `five consecutive failures is either bad luck or the API has changed. ` +
      `(${(lastCause as Error | undefined)?.message ?? 'no detail'})`,
    400,
  );
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
      let attempts: number;
      try {
        ({ response, attempts } = await withTransientRetry(request.tool.name, () =>
          client.messages.create({
          model,
          max_tokens: request.maxTokens ?? MAX_TOKENS,
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
          }),
        ));
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

      /**
       * A TRUNCATED TOOL CALL IS A FAILURE THE API RETURNS AS 200.
       *
       * Checked before the block is read, and before Zod sees it. Without this
       * the half-object flows into `AnalysisSchema.safeParse`, which usually
       * rejects it — and then reports "returned a shape that does not
       * validate", pointing the reader at the model's judgement when the actual
       * cause was the output ceiling. Different diagnosis, different fix.
       *
       * "Usually" is the other half: nothing guarantees a truncation fails
       * validation. A cut that happens to land after every required field
       * produces a valid, quietly incomplete analysis.
       */
      if (response.stop_reason === 'max_tokens') {
        throw new MalformedToolCallError(
          `${request.tool.name}: the response hit the ${request.maxTokens ?? MAX_TOKENS}-token ` +
            `output ceiling, so the tool call is truncated. This is not a model error — ` +
            `raise maxTokens for this call, or shorten the input.`,
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
        attempts,
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
  /** Requests spent, including the successful one. See
   *  {@link ToolCallResponse.attempts}. */
  readonly attempts: number;
}

export function runOf<T>(value: T, response: ToolCallResponse): AgentRun<T> {
  return {
    value,
    model: response.model,
    usage: response.usage,
    costUsd: costUsd(response.model, response.usage),
    attempts: response.attempts,
  };
}

export { ZERO_USAGE };
