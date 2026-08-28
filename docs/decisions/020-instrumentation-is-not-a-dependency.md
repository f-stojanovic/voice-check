# 020. Instrumentation is not a dependency of the thing it instruments

Date: 2026-08-28
Status: Accepted. `@opentelemetry/api` in `dependencies`; the SDK, the OTLP
exporter and everything Jaeger-shaped in `devDependencies`. Tracing is off by
default.
Evidence: THE SPLIT HOLDS, checked against the build rather than assumed:
          `dist/web/` contains **zero** references to `opentelemetry`;
          `dist/` contains **zero** references to `sdk-trace-node` or
          `exporter-trace-otlp`; `dist/evals` does not exist; and
          `dist/web/server.js` still does not reach `agents/`. Exactly three
          files under `dist/` name `@opentelemetry/api` — `tracing.js`,
          `agents/client.js`, `agents/analyst.js` — which is the runtime half
          doing its job.
          THE "API IS FREE WITHOUT AN SDK" CLAIM IS TESTED, not asserted twice
          and believed: with no provider registered, `trace.getTracer(...)
          .startSpan(...)` returns a span whose `isRecording()` is `false` and
          whose `traceId` is `00000000000000000000000000000000`, and
          `startActiveSpan` still runs its callback and returns its value.
          ONE LIVE TRACED RUN, 2026-08-28, $0.1001, 8,280 in / 2,347 out, 0
          transient-400 retries. Jaeger's API reports **3 spans**, nested:
          `eval case analyst-agentstep-korisnicka-podrska` (43,587ms) ->
          `analyse` (43,587ms) -> `chat claude-opus-5` (43,581ms).
          THE `chat` SPAN CARRIES, verbatim from Jaeger:
            gen_ai.operation.name = "chat"
            gen_ai.provider.name = "anthropic"
            gen_ai.request.model = "claude-opus-5"
            gen_ai.request.max_tokens = 4000
            gen_ai.response.model = "claude-opus-5"
            gen_ai.response.finish_reasons = ["tool_use"]
            gen_ai.response.id = "msg_011CeUrWNw8SJs1JJAyRrF5q"
            gen_ai.usage.input_tokens = 8280
            gen_ai.usage.output_tokens = 2347
            voice_check.cost.usd = 0.100075
            voice_check.request.attempts = 1
            voice_check.request.transient_retries = 0
            voice_check.tool.name = "record_analysis"
          THE `analyse` SPAN CARRIES the same cost, the QuoteMatch distribution
          (`exact 17`, the rest 0) and the source language.
          THE UNPRICED PATH IS TESTED, not demonstrated live: four unit tests
          assert an unpriced model sets NO `voice_check.cost.usd` and does set
          `voice_check.cost.unknown_reason`, that `NaN` is refused the same way,
          and that a REAL zero is recorded because free is a measurement.
          NOT MEASURED LIVE: a model with no price-table entry, in Jaeger. Every
          model this repository calls is priced, so producing one would have
          meant calling a model that does not exist or editing the price table
          for a screenshot. The behaviour is unit-tested at the function that
          sets the attribute; the end-to-end path is not.
          THE SCREENSHOT DOES NOT SHOW COST. See "What the picture does not
          show".

## Context

The portfolio's third gap was that a run's cost was reported as one number for
the whole suite. Where it went — which agent, which call — was not recorded
anywhere a person could look.

## Decision

**`@opentelemetry/api` is a runtime dependency; the SDK is not.** The api
package is a no-op until an SDK registers a provider, so the agents can be
instrumented unconditionally and a consumer who never enables tracing pays for
an import and nothing else. The SDK, the OTLP exporter and the Jaeger setup live
in `devDependencies` and are reachable only from `src/evals/tracing-setup.eval.ts`,
which `tsconfig.build.json` keeps out of `dist/` with the rest of `src/evals/`.

**The general rule: instrumentation must not become a dependency of the thing it
instruments.** Same shape as `@huggingface/transformers` being an optional peer
of `agent-evals` (its ADR 025), one layer up — the code that needs the heavy
half is not the code being measured. The deployed service runs `check`, which
calls no model; it has no business carrying a span exporter.

**Three spans, because the interesting question is nested.** Eval case, agent
run, model call. The model-call span lives in `client.ts` because that is where
the SDK call happens and where `usage` is read — a span anywhere else would be
re-deriving numbers it did not observe.

**Attribute names come from the spec.** The GenAI semantic conventions moved out
of the main semconv repository to `open-telemetry/semantic-conventions-genai`;
`docs/gen-ai/gen-ai-spans.md` was read on 2026-08-28 and quoted in `tracing.ts`.
Span name `{gen_ai.operation.name} {gen_ai.request.model}`, kind `CLIENT`,
`gen_ai.operation.name` and `gen_ai.provider.name` required, `anthropic` a
listed provider value.

**Where we left the conventions, said rather than hidden.** Cost is not in them,
so it is `voice_check.cost.usd` and namespaced so nobody mistakes it for a
standard. `gen_ai.tool.name` is *not* among the attributes that document lists
for inference spans, so the forced tool's name is `voice_check.tool.name` rather
than a `gen_ai.` prefix we would be inventing. The retry count and the
QuoteMatch distribution are ours; nothing in the conventions covers either.

**An unknown cost is an absent attribute plus a reason. Never zero.** A span
carrying `voice_check.cost.usd = 0` for an unpriced model is ADR 026's defect in
the one artifact whose purpose is attribution, and a waterfall makes it worse: a
zero renders as a legitimate-looking bar beside real numbers.

**Off by default.** `--trace` exports; `--trace-console` prints. A default-on
exporter that silently fails to connect looks instrumented and delivers nothing,
which is a worse state than no tracing.

## What the picture does not show

`docs/images/jaeger-analyst-waterfall.png` shows the nesting and the timing. **It
does not show the cost**, because Jaeger collapses span tags until a span is
clicked and the capture was headless, so nothing clicked.

The attributes are printed in the README next to the image instead. That is the
honest form: the alternative was arranging a screenshot to imply the cost is
visible at a glance when it takes a click, and this repository has spent four
ADRs on numbers that were true in one frame and printed in another.

## Consequences

**The case span wraps whichever subject runs.** It was inside `analystSubject`
first, which meant a replay emitted no spans and the tracing could only be
demonstrated by spending money — the opposite of what the rest of the suite is
built for. A replay now yields a case span with no children, which is an honest
picture of a replay: nothing was called.

**`tracing.ts` is at `src/`, not `src/agents/`.** `no-writer.ts` asserts that
directory holds exactly the two agents it declares and rejected this file on the
first run. The guard was right; the file moved.

**Three spans is a choice, not a discovery.** With one model call per analysis,
`analyse` and `chat` currently have near-identical durations — 43,587ms against
43,581ms — so the middle span carries almost no timing information today. It
earns its place only if an agent ever makes more than one call, and if that
never happens it should be removed rather than defended.

**Nothing here is wired into the deployed service, and it should not be.** The
`check` surface calls no model, so it has no cost to attribute.

## Alternatives rejected

**Put the SDK in `dependencies` and register a provider at startup.** Simpler to
run, and it ships an exporter into a service that has nothing to export.

**A vendor-specific tracing SDK.** Faster to a picture, and it makes the
instrumentation unportable and needs an account. The eval suite's rule applies:
a demonstration that requires a third party to be reachable is not a
demonstration.

**Invent `gen_ai.cost.usd`.** It reads like a standard attribute and is not one.
A reviewer who looks it up finds nothing, and by then they distrust the rest.
