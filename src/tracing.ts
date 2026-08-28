/**
 * Tracing, and the rule that keeps it from becoming a dependency of the thing
 * it traces.
 *
 * NOT IN `src/agents/`, and that is not filing preference. `no-writer.ts`
 * asserts that directory holds exactly the agents it declares, and a tracing
 * module is not an agent — the guard caught this file on the first run, which
 * is the guard doing its job.
 *
 * WHY `@opentelemetry/api` IS THE ONLY RUNTIME DEPENDENCY
 * ------------------------------------------------------
 * `@opentelemetry/api` is a no-op until an SDK registers a provider. With no
 * provider, `trace.getTracer(...).startActiveSpan(...)` runs a non-recording
 * span implementation: it takes the callback, does not allocate a span context,
 * and exports nothing.
 *
 * So the agents can be instrumented unconditionally while a consumer who never
 * turns tracing on pays for an import and nothing else. The SDK, the exporter
 * and everything Jaeger-shaped are `devDependencies`, needed only by the entry
 * point that actually exports spans (`src/evals/tracing-setup.eval.ts`).
 *
 * THE GENERAL RULE: INSTRUMENTATION MUST NOT BECOME A DEPENDENCY OF THE THING
 * IT INSTRUMENTS. Same shape as `@huggingface/transformers` being an optional
 * peer of `agent-evals` (its ADR 025), one layer up — the code that needs the
 * heavy half is not the code being measured.
 *
 * ATTRIBUTE NAMES COME FROM THE SPEC, NOT FROM MEMORY
 * ---------------------------------------------------
 * Read 2026-08-28 from the OpenTelemetry GenAI semantic conventions, which
 * moved out of the main semconv repository to
 * `open-telemetry/semantic-conventions-genai`. Quoted from
 * `docs/gen-ai/gen-ai-spans.md`:
 *
 *   Span name:  `{gen_ai.operation.name} {gen_ai.request.model}`
 *   Span kind:  `CLIENT` (primary recommendation)
 *   Required:   `gen_ai.operation.name`, `gen_ai.provider.name`
 *   Recommended: `gen_ai.request.model`, `gen_ai.response.model`,
 *                `gen_ai.response.finish_reasons` (string array),
 *                `gen_ai.response.id`, `gen_ai.request.max_tokens`,
 *                `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`
 *
 * `anthropic` is one of the listed well-known values for
 * `gen_ai.provider.name`.
 *
 * WHERE THIS LEAVES THE CONVENTIONS, said rather than hidden:
 *
 *   - Cost is not in the GenAI conventions at all. It is ours, and it is
 *     namespaced `voice_check.*` so nobody mistakes it for a standard.
 *   - `gen_ai.tool.name` is NOT among the attributes that document lists for
 *     inference spans, so the forced tool's name is carried as
 *     `voice_check.tool.name` rather than under a `gen_ai.` prefix we would be
 *     inventing.
 *   - The retry count and the QuoteMatch distribution are ours; nothing in the
 *     conventions covers either.
 */

import { SpanStatusCode, trace, type Span } from '@opentelemetry/api';

/** One tracer for the whole repository. Named for the package. */
export const tracer = trace.getTracer('voice-check');

/* ------------------------------------------------------------------ *
 * Attribute names
 * ------------------------------------------------------------------ */

/** Straight from the spec quoted above. Do not edit without re-reading it. */
export const GEN_AI = {
  operationName: 'gen_ai.operation.name',
  providerName: 'gen_ai.provider.name',
  requestModel: 'gen_ai.request.model',
  requestMaxTokens: 'gen_ai.request.max_tokens',
  responseModel: 'gen_ai.response.model',
  responseFinishReasons: 'gen_ai.response.finish_reasons',
  responseId: 'gen_ai.response.id',
  usageInputTokens: 'gen_ai.usage.input_tokens',
  usageOutputTokens: 'gen_ai.usage.output_tokens',
} as const;

/**
 * Ours. Namespaced so a reader can tell at a glance which half of a span is
 * standard and which half this repository invented.
 */
export const VOICE_CHECK = {
  costUsd: 'voice_check.cost.usd',
  /** Present ONLY when `costUsd` is absent. See {@link setCost}. */
  costUnknownReason: 'voice_check.cost.unknown_reason',
  toolName: 'voice_check.tool.name',
  /** Requests spent including the successful one; 1 means no retry. */
  requestAttempts: 'voice_check.request.attempts',
  transientRetries: 'voice_check.request.transient_retries',
  caseId: 'voice_check.eval.case_id',
  sourceLanguage: 'voice_check.source.language',
  sourceSentences: 'voice_check.source.sentences',
  quoteExact: 'voice_check.quotes.exact',
  quoteNormalized: 'voice_check.quotes.normalized',
  quoteForeign: 'voice_check.quotes.foreign',
  quoteAbsent: 'voice_check.quotes.absent',
} as const;

/**
 * Sets the cost, or says why there isn't one. NEVER ZERO.
 *
 * THIS IS THE WHOLE POINT OF PUTTING COST ON A SPAN AT ALL. A span carrying
 * `voice_check.cost.usd = 0` for a model with no price-table entry is ADR 026's
 * defect wearing a new hat, in the one artifact whose entire purpose is
 * attribution — and a waterfall makes it worse, because a zero renders as a
 * legitimate-looking bar next to real numbers.
 *
 * So an unknown cost is an ABSENT attribute plus a stated reason. A consumer
 * summing `voice_check.cost.usd` across spans gets the total of what is known,
 * and the spans that could not be priced are visibly missing from it rather
 * than silently contributing nothing.
 *
 * A cost of exactly zero IS set when it is real — a locally-run model priced at
 * zero is a measurement, not an absence.
 */
export function setCost(span: Span, usd: number | null, model: string): void {
  if (usd === null) {
    span.setAttribute(
      VOICE_CHECK.costUnknownReason,
      `no price table entry for "${model}"`,
    );
    return;
  }
  if (!Number.isFinite(usd)) {
    span.setAttribute(
      VOICE_CHECK.costUnknownReason,
      `cost for "${model}" computed as ${String(usd)}, which is not a number`,
    );
    return;
  }
  span.setAttribute(VOICE_CHECK.costUsd, usd);
}

/** Marks a span failed and records the error, without swallowing it. */
export function failSpan(span: Span, cause: unknown): void {
  const error = cause instanceof Error ? cause : new Error(String(cause));
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
}
