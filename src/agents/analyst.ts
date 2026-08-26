/**
 * The analyst: what does this source actually say, and what does it prove?
 *
 * IT RETURNS STRUCTURE, NOT PROSE, and the return path is a FORCED tool call
 * rather than JSON asked for politely in a system prompt. See ADR 007. The
 * short version: a model asked for prose returns prose, and then somebody
 * writes a parser, and the parser works until the day the model opens with
 * "Here's my analysis:". The forced tool call moves that from a thing you hope
 * for to a thing the API guarantees, and `strict: true` moves the shape of the
 * object from a thing you validate to a thing that cannot arrive wrong.
 *
 * WHY THESE FIVE FIELDS. They are the questions a writer has to answer before
 * writing about somebody else's article, and they are the questions that are
 * easiest to skip: what is actually being claimed, what is offered in support,
 * what here is new rather than restated, what is asserted without support, and
 * what is left unanswered.
 *
 * EVERY FIELD IS TRACEABLE, AND TRACEABILITY IS A GATE. Each statement carries
 * a `quote`, `verifyQuotes` checks each one against the source, and a quote
 * that is not there FAILS THE RUN. Day two printed the ratio as a statistic;
 * a statistic nobody compares against anything is an observation, and this is
 * the one number here that can be a control. A quote absent from the source is
 * not a judgement call the reader can weigh — it is a fact about the model:
 * it produced text and attributed it to a document that does not contain it.
 *
 * The gate distinguishes three outcomes, because conflating them would make it
 * fire on formatting. An EXACT match is byte-for-byte. A NORMALISED match
 * differs only in whitespace or case — a quote spanning a line break in a
 * wrapped file, or one whose capitalisation was tidied — and passes, because
 * the text is there. Only ABSENT fails.
 *
 * EMPTY IS AN ANSWER. The system prompt says so explicitly and the schema
 * allows it: `novelty` may be empty, `hype` may be empty, evidence may be
 * `none`. An analyst that always finds novelty is not an analyst, it is a
 * flattery machine with a JSON schema.
 */

import { z } from 'zod';
import type { Language } from '../types.js';
import { runOf, type AgentRun, type ModelClient, MalformedToolCallError } from './client.js';

/** A statement plus the span of source it is traced to. */
const TracedSchema = z.object({
  statement: z.string().min(1),
  /**
   * Verbatim from the source. Empty only where the field is reporting an
   * absence — there is no quote for "the source offers no evidence".
   */
  quote: z.string(),
});

const EvidenceSchema = TracedSchema.extend({
  kind: z.enum(['data', 'demonstration', 'anecdote', 'citation', 'none']),
});

export const AnalysisSchema = z.object({
  claim: TracedSchema,
  evidence: z.array(EvidenceSchema),
  novelty: z.object({
    genuinelyNew: z.array(TracedSchema),
    restated: z.array(TracedSchema),
  }),
  hype: z.array(TracedSchema),
  openQuestions: z.array(z.string().min(1)),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

/**
 * The JSON Schema, hand-written rather than generated from the Zod schema.
 *
 * `strict: true` needs `additionalProperties: false` and a complete `required`
 * on every object, and a generator that omits either silently downgrades the
 * guarantee to a hope. Writing it out means the two can disagree, so
 * `analyst.test.ts` asserts they carry the same field names — the check this
 * repository would demand of anybody else.
 */
const traced = {
  type: 'object',
  additionalProperties: false,
  required: ['statement', 'quote'],
  properties: {
    statement: { type: 'string', description: 'One sentence, in your own words.' },
    quote: {
      type: 'string',
      description:
        'A short verbatim span from the source that this statement rests on. ' +
        'Copy it exactly, character for character. Empty string ONLY when the ' +
        'statement is about something the source does not contain.',
    },
  },
} as const;

export const ANALYST_TOOL_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['claim', 'evidence', 'novelty', 'hype', 'openQuestions'],
  properties: {
    claim: {
      ...traced,
      description: 'The single thing this source actually asserts.',
    },
    evidence: {
      type: 'array',
      description:
        'What the source offers in support. Use exactly one item with kind ' +
        '"none" if it offers nothing — that is a real and common answer.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'statement', 'quote'],
        properties: {
          kind: {
            type: 'string',
            enum: ['data', 'demonstration', 'anecdote', 'citation', 'none'],
          },
          statement: traced.properties.statement,
          quote: traced.properties.quote,
        },
      },
    },
    novelty: {
      type: 'object',
      additionalProperties: false,
      required: ['genuinelyNew', 'restated'],
      properties: {
        genuinelyNew: {
          type: 'array',
          description:
            'Points that are new. An empty array is the correct answer for a ' +
            'source that restates common knowledge, and most sources do.',
          items: traced,
        },
        restated: {
          type: 'array',
          description: 'Points presented as insight that are widely known already.',
          items: traced,
        },
      },
    },
    hype: {
      type: 'array',
      description: 'Claims the source makes without offering support for them.',
      items: traced,
    },
    openQuestions: {
      type: 'array',
      description: 'What the source leaves unanswered.',
      items: { type: 'string' },
    },
  },
};

const SYSTEM = `You are reading a source text on behalf of a writer who will decide whether it is worth writing about. You are not summarising it and you are not recommending it.

Answer only from the source in front of you. You have no other knowledge of this topic that belongs in the output.

Every statement you make carries a quote. Copy the quote verbatim from the source, character for character — do not tidy it, translate it, or paraphrase it. A quote that is not in the source is worse than no quote.

Where the source supports nothing, say so. Specifically:
- If it offers no evidence, return exactly one evidence item with kind "none".
- If nothing in it is genuinely new, return an empty genuinelyNew array. Most sources restate. An analyst that always finds novelty is useless to the writer, because the writer cannot tell the real finds from the padding.
- If it makes no unsupported claims, return an empty hype array.

Empty arrays are correct answers, not failures to try harder.`;

export const ANALYST_TOOL = {
  name: 'record_analysis',
  description:
    'Record the structured analysis of the source. This is the only way to ' +
    'return your answer; there is no prose channel.',
  inputSchema: ANALYST_TOOL_SCHEMA,
};

/** The source was empty or whitespace. Checked before spending a request. */
export class EmptySourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmptySourceError';
  }
}

export interface AnalystInput {
  readonly text: string;
  readonly language: Language;
  /** Where the text came from, so the model can be told. Not required. */
  readonly origin?: string;
}

/** An analyst run, plus the traceability verdicts that let it through the gate. */
export type AnalysisRun = AgentRun<Analysis> & { readonly traceability: readonly QuoteCheck[] };

export async function analyse(
  client: ModelClient,
  input: AnalystInput,
): Promise<AnalysisRun> {
  // Guarded here rather than in the CLI so the check holds for every caller,
  // and guarded BEFORE the call so an empty file costs nothing. An empty
  // source is not a source the model should be asked to be creative about.
  if (input.text.trim().length === 0) {
    throw new EmptySourceError(
      `${input.origin ?? 'the source'} is empty — there is nothing to analyse, ` +
        `and asking the model to analyse nothing produces a confident answer about nothing`,
    );
  }

  const response = await client.callTool({
    system: SYSTEM,
    tool: ANALYST_TOOL,
    userContent:
      `The source is written in ${input.language === 'sr' ? 'Serbian' : 'English'}.` +
      `${input.origin === undefined ? '' : ` It came from: ${input.origin}.`}\n\n` +
      `Answer in the same language as the source.\n\n--- SOURCE BEGINS ---\n${input.text}\n--- SOURCE ENDS ---`,
  });

  const parsed = AnalysisSchema.safeParse(response.input);
  if (!parsed.success) {
    throw new MalformedToolCallError(
      `record_analysis returned a shape that does not validate:\n` +
        parsed.error.issues
          .map((i) => `  at ${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('\n'),
    );
  }

  const traceability = verifyQuotes(parsed.data, input.text);
  if (traceability.some((c) => c.match === 'absent')) {
    // The gate. Not a warning printed under the result — the run fails, and
    // the caller decides. Everything else the analyst produces is judgement
    // and needs a judge or a human; this is the one claim that can be checked
    // mechanically, so it is checked.
    throw new UntraceableQuoteError(traceability, input.origin ?? 'the source');
  }

  return { ...runOf(parsed.data, response), traceability };
}

/**
 * How a quote relates to the source.
 *
 * `exact` — present byte for byte.
 * `normalized` — present once whitespace is collapsed and case is folded. A
 *   quote that crossed a line break in a hard-wrapped file lands here, and so
 *   does one whose capitalisation was tidied. The text IS in the source; only
 *   its formatting moved. This passes.
 * `absent` — not in the source under either comparison. The model attributed
 *   text to a document that does not contain it. This fails the run.
 */
export type QuoteMatch = 'exact' | 'normalized' | 'absent';

/** One traceability verdict. */
export interface QuoteCheck {
  readonly field: string;
  /** The statement the quote was supposed to support, for an actionable failure. */
  readonly statement: string;
  readonly quote: string;
  readonly match: QuoteMatch;
}

/** The gate failed: at least one quote is not in the source. */
export class UntraceableQuoteError extends Error {
  readonly checks: readonly QuoteCheck[];
  constructor(checks: readonly QuoteCheck[], origin: string) {
    const absent = checks.filter((c) => c.match === 'absent');
    super(
      `the analyst attributed ${absent.length} quote${absent.length === 1 ? '' : 's'} ` +
        `to ${origin} that ${absent.length === 1 ? 'is' : 'are'} not in it:\n` +
        absent
          .map(
            (c) =>
              `  ${c.field}\n    statement: ${c.statement}\n    quote:     ${JSON.stringify(c.quote)}`,
          )
          .join('\n'),
    );
    this.name = 'UntraceableQuoteError';
    this.checks = checks;
  }
}

/**
 * Checks every quote against the source instead of trusting it.
 *
 * Two comparisons, and the distinction between them is what keeps the gate
 * from firing on formatting: the raw string first, then whitespace-collapsed
 * and case-folded. A quote that only survives the second is still a quote that
 * is in the source.
 */
export function verifyQuotes(analysis: Analysis, source: string): QuoteCheck[] {
  const normalised = normalise(source);
  const checks: QuoteCheck[] = [];

  const add = (field: string, statement: string, quote: string): void => {
    if (quote.trim().length === 0) return; // an absence has no quote to check
    const match: QuoteMatch = source.includes(quote)
      ? 'exact'
      : normalised.includes(normalise(quote))
        ? 'normalized'
        : 'absent';
    checks.push({ field, statement, quote, match });
  };

  add('claim', analysis.claim.statement, analysis.claim.quote);
  analysis.evidence.forEach((e, i) => add(`evidence[${i}]`, e.statement, e.quote));
  analysis.novelty.genuinelyNew.forEach((n, i) =>
    add(`novelty.genuinelyNew[${i}]`, n.statement, n.quote),
  );
  analysis.novelty.restated.forEach((n, i) =>
    add(`novelty.restated[${i}]`, n.statement, n.quote),
  );
  analysis.hype.forEach((h, i) => add(`hype[${i}]`, h.statement, h.quote));

  return checks;
}

function normalise(text: string): string {
  return text.replace(/\s+/gu, ' ').trim().toLowerCase();
}
