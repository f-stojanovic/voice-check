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
 * the one number here that can be a control.
 *
 * WHAT THE GATE CLAIMS, AND WHAT IT DOES NOT. It claims a CONSEQUENCE, and the
 * consequence is certain: this analysis cannot be relied on. Every statement in
 * it rests on a quote, one of those quotes is not in the document, and there is
 * no way to tell from here which of the other statements are sound.
 *
 * It does NOT claim a cause. An earlier version said a missing quote meant the
 * analyst invented it. That is one possibility among at least four:
 *
 *   1. The model fabricated the quote.
 *   2. The extractor damaged the source — a smart quote, an entity, a
 *      character set — so the text is there and no longer matches.
 *   3. The source changed between being fetched and being checked.
 *   4. The model translated the quote. On a Serbian source this is the
 *      likeliest failure of the four, and it has never been observed, because
 *      no Serbian source has been run.
 *
 * The failure message names all four rather than asserting the first.
 *
 * THE OUTCOMES. `exact` is byte-for-byte. `normalized` differs only in
 * whitespace or case — a quote spanning a line break in a wrapped file — and
 * passes, because the text is there. `foreign` is absent AND written in a
 * different script or language from the source, which is the one cause the
 * gate can actually diagnose. `absent` is everything else. The last two fail.
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

  const traceability = verifyQuotes(parsed.data, input.text, input.language);
  if (traceability.some((c) => FAILING_MATCHES.includes(c.match))) {
    // The gate. Not a warning printed under the result — the run fails, and
    // the caller decides. Everything else the analyst produces is judgement
    // and needs a judge or a human; this is the one claim that can be checked
    // mechanically, so it is checked.
    throw new UntraceableQuoteError(
      traceability,
      input.origin ?? 'the source',
      input.language,
    );
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
 * `foreign` — not in the source, AND in a different script or language from
 *   it. The one cause the gate can diagnose rather than list: a Cyrillic
 *   source quoted in Latin, or a Serbian source quoted in English, is a
 *   translation. This fails the run, with a message that says so.
 * `absent` — not in the source under any comparison, cause unknown. This fails
 *   the run, with a message that lists what the cause might be.
 */
export type QuoteMatch = 'exact' | 'normalized' | 'foreign' | 'absent';

/** One traceability verdict. */
export interface QuoteCheck {
  readonly field: string;
  /** The statement the quote was supposed to support, for an actionable failure. */
  readonly statement: string;
  readonly quote: string;
  readonly match: QuoteMatch;
}

/** Outcomes that fail the gate. */
export const FAILING_MATCHES: readonly QuoteMatch[] = ['absent', 'foreign'];

/**
 * The gate failed: at least one quote is not in the source.
 *
 * The message states the consequence, which is certain, and lists the possible
 * causes, which are not. Naming a cause the gate cannot establish would be the
 * tool asserting something it has not checked, in a report whose whole purpose
 * is that its claims are checked.
 */
export class UntraceableQuoteError extends Error {
  readonly checks: readonly QuoteCheck[];
  constructor(checks: readonly QuoteCheck[], origin: string, language: Language) {
    const failed = checks.filter((c) => FAILING_MATCHES.includes(c.match));
    const foreign = failed.filter((c) => c.match === 'foreign');
    const plural = failed.length === 1 ? '' : 's';

    const causes =
      foreign.length === failed.length
        ? `Every one of them is written in a different script or language from the ` +
          `source, which is diagnostic: the model translated the quote instead of ` +
          `copying it. The statements may still be sound; the trace is not.`
        : `Why is not established, and this message will not guess. It may be that ` +
          `the model fabricated the quote; that the extractor damaged the source ` +
          `(a smart quote, an entity, a character set); that the source changed ` +
          `between being fetched and being checked; or that the model translated ` +
          `the quote rather than copying it.` +
          (foreign.length > 0
            ? ` ${foreign.length} of them differ in script or language from the ` +
              `source, which points at translation for those.`
            : '');

    super(
      `this analysis cannot be relied on: ${failed.length} quote${plural} ` +
        `attributed to ${origin} (${language}) ${failed.length === 1 ? 'is' : 'are'} ` +
        `not in it.\n\n${causes}\n\n` +
        failed
          .map(
            (c) =>
              `  ${c.field} [${c.match}]\n    statement: ${c.statement}\n` +
              `    quote:     ${JSON.stringify(c.quote)}`,
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
export function verifyQuotes(
  analysis: Analysis,
  source: string,
  language: Language = 'en',
): QuoteCheck[] {
  const normalised = normalise(source);
  const checks: QuoteCheck[] = [];

  const add = (field: string, statement: string, quote: string): void => {
    if (quote.trim().length === 0) return; // an absence has no quote to check
    const match: QuoteMatch = source.includes(quote)
      ? 'exact'
      : normalised.includes(normalise(quote))
        ? 'normalized'
        : looksForeign(quote, source, language)
          ? 'foreign'
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

const CYRILLIC = /\p{Script=Cyrillic}/u;
const SERBIAN_DIACRITIC = /[šđčćžŠĐČĆŽ]/u;

/**
 * Whether a missing quote looks like a translation rather than a fabrication.
 *
 * Two signals, both conservative, because a wrong `foreign` verdict changes
 * the diagnosis in a failure message and never changes pass/fail:
 *
 * 1. SCRIPT. The source is Cyrillic and the quote is not, or the reverse.
 *    Unambiguous when it fires and silent otherwise.
 * 2. LANGUAGE, for Serbian sources only. A Serbian source contains diacritics;
 *    a quote of five or more words carrying none of them, while carrying two
 *    or more English function words, was not copied out of it.
 *
 * The second is a heuristic and will miss a Serbian source quoted in Serbian
 * but reworded, which is not a translation anyway. It exists because the
 * script test cannot see Serbian Latin, and Serbian Latin is what the author
 * writes.
 */
function looksForeign(quote: string, source: string, language: Language): boolean {
  if (CYRILLIC.test(source) !== CYRILLIC.test(quote)) return true;

  if (language !== 'sr') return false;
  if (!SERBIAN_DIACRITIC.test(source)) return false; // cannot tell
  if (SERBIAN_DIACRITIC.test(quote)) return false; // still Serbian

  const words = quote.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (words.length < 5) return false; // too short to vote on
  const english = new Set(['the', 'of', 'and', 'to', 'is', 'in', 'that', 'it', 'for', 'with', 'was', 'as']);
  return words.filter((w) => english.has(w)).length >= 2;
}
