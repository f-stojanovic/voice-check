# 007. The analyst returns structure, not prose

Date: 2026-08-27
Status: Accepted
Evidence: Direct, from one live run against
          `martinfowler.com/articles/2021-test-shapes.html`, 2026-08-27.
          Both agents returned validated structures on the first attempt; no
          parser was involved anywhere in the path, and the second agent
          received the first's output as an object rather than as text.
          The traceability check — which only exists because the output is
          structured — reported **12 of 12 quotes found verbatim in the
          source**. That figure is a measurement of the analyst's honesty and
          it is not obtainable from prose: you cannot check a quote you have
          to extract with a regex first.
          Cost of the run: **$0.1213**, 6840 input and 3484 output tokens on
          `claude-opus-5`.
          Unobserved: any malformed tool call from the real API. `strict: true`
          plus a forced `tool_choice` makes one very unlikely, which is exactly
          why the handler is tested against a fake — the failure that never
          happens in development is the one with no handler.

## Context

The analyst answers five questions about a source: what is claimed, what
supports it, what is new, what is asserted without support, what is left open.
Every one of those is a field, and the natural next thing to do with a field
is read it.

The default way to get that out of a model is to ask for it in prose, or to
ask for JSON in a system prompt and parse what comes back. Both work in
development. The prose one fails the day a writer wants to filter on
`evidence.kind`. The JSON-in-prose one fails the day the model opens with
"Here's my analysis:" — and it fails intermittently, at a rate low enough that
the parser looks fine for weeks and then eats a run.

## Decision

Both agents return through a **forced tool call**:
`tool_choice: { type: 'tool', name: … }` with `strict: true` on the tool
definition and `disable_parallel_tool_use`. There is no prose channel, and
both tool descriptions say so in the text the model reads.

The JSON Schema is hand-written next to the Zod schema rather than generated
from it. `strict` needs `additionalProperties: false` and a complete `required`
on every object, and a generator that omits either silently downgrades the
guarantee to a hope. Because two hand-written schemas can disagree,
`analyst.test.ts` walks the JSON Schema asserting every object is closed and
fully required, and asserts that it names the same top-level fields as the Zod
schema.

The Zod schema still runs on the way out. `strict` is enforced by the API and
the API is a remote system; a validation that only exists on the other side of
the network is a validation this repository cannot test.

**Every statement carries a quote, and the quotes are checked.**
`verifyQuotes` normalises whitespace and looks for each quote in the source,
and the brief prints the ratio. A model that paraphrases a quote is not lying,
but a statement traced to text that is not in the source is traced to nothing,
and the reader is entitled to know which of the two they are holding.

## Consequences

The seam between the two agents is an object. The angles agent receives a
validated `Analysis`, not a blob of text — asserted by a test that parses the
prompt back out and compares it to the analysis it passed in.

Traceability becomes measurable. It is the only quantitative claim this
repository makes about an LLM's output, and it exists because the output has
fields.

Empty is expressible. `novelty.genuinelyNew: []` is a value; "the source
contains nothing new" in prose is a sentence somebody has to classify. The
system prompt says empty arrays are correct answers and the brief prints
**"Nothing genuinely new"** in bold when the array is empty — an analyst that
always finds novelty is a flattery machine with a JSON schema.

The costs:

Hand-written JSON Schema is verbose and can drift from the Zod schema. Two
tests hold them together; nothing stops a third field being added to one and
not the other in a way both tests miss, because they compare top-level names
only.

The schema shapes the answer. Giving the model an `evidence[]` with a `kind`
enum means it will find things to put in it, and the enum's five values are a
taxonomy nobody validated. A prose analyst would have been free to say
something the schema has no slot for.

`strict: true` incurs a one-time schema compilation on first use, and the
schemas are cached for 24 hours. Irrelevant at this scale; worth knowing.

## Alternatives rejected

**Prose, parsed.** The failure is intermittent and silent, which is the worst
combination. It also cannot support the quote check.

**`output_config.format` (structured outputs) on a plain message.** Would work,
and constrains the response format rather than a tool's input. The forced tool
call was chosen because the tool description is a second place to tell the
model what the field is for — the `questionForWriter` description in
`angles.ts` is doing real work — and because a tool named `record_analysis`
frames the task as recording rather than composing.

**`tool_choice: 'auto'` with a prose fallback.** A fallback path that runs
rarely is a path nobody tests. Deleting it removes a failure mode rather than
handling one.

**Generate the JSON Schema from Zod with `z.toJSONSchema`.** Fewer lines, and
the strictness properties depend on a generator's defaults rather than on
something visible in the file. The generator would have to be audited to the
same depth as the schema it replaced.
