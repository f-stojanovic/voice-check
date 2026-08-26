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
 * EVERY FIELD IS TRACEABLE. Each statement carries a `quote` the model says it
 * came from, and `verifyQuotes` checks each one against the source rather than
 * trusting it. The result is a measured figure — "9 of 11 quotes found
 * verbatim" — printed in the brief. A model that paraphrases a quote is not
 * lying, but a claim traced to a quote that is not in the text is a claim
 * traced to nothing, and the reader should be told which they are holding.
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

export async function analyse(
  client: ModelClient,
  input: AnalystInput,
): Promise<AgentRun<Analysis>> {
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

  return runOf(parsed.data, response);
}

/** One traceability verdict: the quote, and whether it is actually in the source. */
export interface QuoteCheck {
  readonly field: string;
  readonly quote: string;
  readonly found: boolean;
}

/**
 * Checks every quote against the source instead of trusting it.
 *
 * Whitespace is normalised before comparison — a quote spanning a line break
 * in a wrapped file is the same quote — and nothing else is. A quote the model
 * paraphrased will not be found, which is the intended outcome: the reader is
 * told which statements are traced to text and which are traced to a
 * plausible-looking string.
 */
export function verifyQuotes(analysis: Analysis, source: string): QuoteCheck[] {
  const haystack = normalise(source);
  const checks: QuoteCheck[] = [];

  const add = (field: string, quote: string): void => {
    if (quote.trim().length === 0) return; // an absence has no quote to check
    checks.push({ field, quote, found: haystack.includes(normalise(quote)) });
  };

  add('claim', analysis.claim.quote);
  analysis.evidence.forEach((e, i) => add(`evidence[${i}]`, e.quote));
  analysis.novelty.genuinelyNew.forEach((n, i) => add(`novelty.genuinelyNew[${i}]`, n.quote));
  analysis.novelty.restated.forEach((n, i) => add(`novelty.restated[${i}]`, n.quote));
  analysis.hype.forEach((h, i) => add(`hype[${i}]`, h.quote));

  return checks;
}

function normalise(text: string): string {
  return text.replace(/\s+/gu, ' ').trim().toLowerCase();
}
