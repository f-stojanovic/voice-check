/**
 * Mapping traced quotes onto labelled sentences, and the four scorers built on
 * top of that mapping.
 *
 * ONE MATCHER, REUSED
 * -------------------
 * Nothing here compares a quote to the source. `verifyQuotes` in
 * `src/agents/analyst.ts` already does that — it is the production gate — and
 * it now reports the position it finds. This module converts a position into a
 * sentence index and does no matching of its own. Two matchers that must agree
 * is two things to keep in agreement, and the one that drifts would be this
 * one, which is not the one the deployed code runs.
 *
 * WHY EVERY SCORER HERE IS DETERMINISTIC
 * --------------------------------------
 * Each one compares two sets of sentence indices: what the human marked, and
 * where the analyst's quotes landed. No model is consulted, so a score does not
 * move when a grader moves, and re-running the suite on the same fixture gives
 * the same numbers forever. That is what makes a baseline mean anything.
 *
 * WHAT THAT BUYS AND WHAT IT MISSES is in the ADR, and the miss is not small: a
 * quote can land in exactly the right sentence while the `statement` attached
 * to it says something false about that sentence. Nothing here notices. See
 * ADR 018.
 */

import type { Score, ScoreArgs, Scorer } from 'agent-evals';
import { verifyQuotes } from '../../agents/analyst.js';
import type { Analysis, QuoteMatch } from '../../agents/analyst.js';
import type { Language } from '../../types.js';
import { sentencesIn } from './sentences.js';
import type { Sentence } from './sentences.js';
import { indicesFor } from './labels.js';
import type { LabelFile, Mark } from './labels.js';

/** A source, its split, and what a human marked on it. */
export interface LabelledSource {
  readonly name: string;
  readonly text: string;
  readonly language: Language;
  readonly sentences: readonly Sentence[];
  readonly labels: LabelFile;
}

/** Where one traced quote landed. */
export interface QuoteLocation {
  /** `claim`, `evidence[0]`, `hype[2]` — the path verifyQuotes reports. */
  readonly field: string;
  readonly quote: string;
  readonly match: QuoteMatch;
  /** Sentence indices the quote touches. Empty when it has no position. */
  readonly sentences: number[];
}

/**
 * Locates every traced quote in the analysis.
 *
 * A quote may touch more than one sentence — nothing in `analyst.ts` forbids
 * quoting across a boundary — so this reports all of them and lets each scorer
 * decide. Attributing such a quote to whichever end was checked first would be
 * a silent choice made in the wrong place.
 */
export function locateQuotes(analysis: Analysis, source: LabelledSource): QuoteLocation[] {
  return verifyQuotes(analysis, source.text, source.language).map((check) => ({
    field: check.field,
    quote: check.quote,
    match: check.match,
    sentences:
      check.start === undefined || check.end === undefined
        ? []
        : sentencesIn(source.sentences, check.start, check.end).map((s) => s.index),
  }));
}

/** The QuoteMatch tally for a run. A METRIC, NOT A SCORE — see the note in
 *  `analyst.eval.ts` about why it is reported separately. */
export function matchDistribution(locations: readonly QuoteLocation[]): Record<QuoteMatch, number> {
  const tally: Record<QuoteMatch, number> = { exact: 0, normalized: 0, foreign: 0, absent: 0 };
  for (const location of locations) tally[location.match] += 1;
  return tally;
}

/* ------------------------------------------------------------------ *
 * The scorers
 * ------------------------------------------------------------------ */

/** How a scorer gets at the source it is grading against. */
export type SourceLookup = (caseId: string) => LabelledSource | undefined;

/** The analysis a subject produced, recovered from its tool call. */
function analysisOf(args: ScoreArgs): Analysis | undefined {
  const call = args.output.toolCalls?.[0];
  return call === undefined ? undefined : (call.input as Analysis);
}

function locationsFor(
  args: ScoreArgs,
  lookup: SourceLookup,
): { source: LabelledSource; locations: QuoteLocation[] } | string {
  const source = lookup(args.case.id);
  if (source === undefined) return `no labelled source registered for case "${args.case.id}"`;
  const analysis = analysisOf(args);
  if (analysis === undefined) return 'the subject produced no tool call to grade';
  return { source, locations: locateQuotes(analysis, source) };
}

const failed = (name: string, reason: string): Score => ({
  scorer: name,
  value: 0,
  passed: false,
  reason,
});

/** Sentences carrying `mark`, as a set for intersection. */
function marked(source: LabelledSource, mark: Mark): Set<number> {
  return new Set(indicesFor(source.labels, mark));
}

/**
 * How far from a `C` sentence a claim quote may land and still count.
 *
 * ±1 SENTENCE. A thesis in prose is not confined to one sentence: it is
 * commonly stated in one and completed in the next, and which of the two a
 * labeller marks is close to arbitrary. Requiring an exact hit measures that
 * arbitrariness as much as it measures the analyst.
 *
 * THE ORDER THIS WAS ADOPTED IN MATTERS, AND IT IS THE WORST THING ABOUT IT.
 * The rule was written AFTER watching this scorer return 0.00 on the pilot
 * case, where the model quoted sentence 2 and the label marks sentence 3.
 * Loosening a scorer once you have seen it fail is exactly how a suite gets
 * tuned until it cannot fail, and nothing about the sequence here is
 * distinguishable from that.
 *
 * What makes it defensible is that the justification does not mention the
 * number it produces. It is a claim about how prose works, it was applied to
 * every future case rather than to this one, and it predicts specific things
 * that could turn out false — a window of 1 should not rescue a quote from the
 * far side of a document, and if a later case passes only because of the
 * window, that is worth looking at rather than banking.
 *
 * What would make it indefensible: widening it again the next time a case
 * scores 0. One adjustment with a stated rationale is a design decision; two is
 * a fitting procedure.
 */
export const CLAIM_WINDOW = 1;

/**
 * Did `claim.quote` land on, or next to, a sentence the human marked `C`?
 *
 * BINARY, AND THAT IS A DEPARTURE from `agent-evals` ADR 001, which argues
 * scores should be continuous because a boolean throws away direction. It is a
 * departure with a reason: there is no meaningful half of "found the central
 * claim". A quote either reaches a C sentence or it does not, and inventing
 * partial credit — proportion of touched sentences that are C, say — would
 * punish an analyst for quoting one sentence of context around the right one,
 * which is not a defect.
 *
 * Direction survives at the suite level: eight cases give a mean in eighths,
 * which moves when the model gets better or worse at this.
 */
export function claimLocates(lookup: SourceLookup): Scorer {
  const name = 'analyst-claim-locates';
  return {
    name,
    claims: [{ key: 'claimSentences', required: true }],
    consumesExtraction: false,
    score(args: ScoreArgs): Promise<Score> {
      const found = locationsFor(args, lookup);
      if (typeof found === 'string') return Promise.resolve(failed(name, found));

      const wanted = marked(found.source, 'C');
      const claim = found.locations.find((l) => l.field === 'claim');

      if (claim === undefined) {
        return Promise.resolve(failed(name, 'the analysis carried no claim quote'));
      }
      if (claim.sentences.length === 0) {
        return Promise.resolve(
          failed(name, `the claim quote is ${claim.match}, so it has no position in the source`),
        );
      }

      /* Within CLAIM_WINDOW of any marked sentence, not on it. */
      const near = (index: number): number | undefined =>
        [...wanted].find((c) => Math.abs(c - index) <= CLAIM_WINDOW);
      const exactHit = claim.sentences.filter((i) => wanted.has(i));
      const nearHit = claim.sentences
        .map((i) => ({ landed: i, marked: near(i) }))
        .filter((h): h is { landed: number; marked: number } => h.marked !== undefined);

      const value = nearHit.length > 0 ? 1 : 0;
      const reason =
        exactHit.length > 0
          ? `claim quote lands in sentence ${exactHit.join(', ')}, marked C`
          : nearHit.length > 0
            ? `claim quote lands in sentence ${nearHit.map((h) => h.landed).join(', ')}, ` +
              `within ${CLAIM_WINDOW} of C at ${nearHit.map((h) => h.marked).join(', ')}`
            : `claim quote lands in sentence ${claim.sentences.join(', ')}; ` +
              `C is ${[...wanted].join(', ')}`;

      return Promise.resolve({
        scorer: name,
        value,
        passed: value === 1,
        reason,
        meta: {
          landedIn: claim.sentences,
          marked: [...wanted],
          match: claim.match,
          window: CLAIM_WINDOW,
          /* Recorded so a pass that depended on the window is visible in the
             artifact rather than inferred from the score. */
          exact: exactHit.length > 0,
          /* Marked C over total sentences: how wide the target was. A case
             where this is high makes a hit cheap, and the number should be
             read next to the score rather than after somebody wonders. */
          cDensity: Number((wanted.size / found.source.sentences.length).toFixed(4)),
        },
      });
    },
  };
}

/**
 * What fraction of the human's `E` sentences did some evidence quote cover?
 *
 * This is the number that says "did the analyst find what mattered". It is also
 * the one that is trivially gamed by quoting every sentence in the source,
 * which is why `evidencePrecision` ships in the same commit and not later.
 */
export function evidenceRecall(lookup: SourceLookup): Scorer {
  const name = 'analyst-evidence-recall';
  return {
    name,
    claims: [{ key: 'evidenceSentences', required: true }],
    consumesExtraction: false,
    score(args: ScoreArgs): Promise<Score> {
      const found = locationsFor(args, lookup);
      if (typeof found === 'string') return Promise.resolve(failed(name, found));

      const wanted = marked(found.source, 'E');
      /* The scorer only applies to cases whose labels contain E, so an empty
         set here means the case was mis-registered rather than legitimately
         empty — and a division by zero would report 100% recall of nothing. */
      if (wanted.size === 0) {
        return Promise.resolve(failed(name, 'no E sentences; this case should not have applied'));
      }

      const covered = new Set<number>();
      for (const location of found.locations) {
        if (!location.field.startsWith('evidence')) continue;
        for (const index of location.sentences) if (wanted.has(index)) covered.add(index);
      }

      const value = covered.size / wanted.size;
      const missed = [...wanted].filter((i) => !covered.has(i));
      return Promise.resolve({
        scorer: name,
        value,
        passed: value === 1,
        reason:
          missed.length === 0
            ? `every E sentence is covered (${wanted.size})`
            : `covered ${covered.size}/${wanted.size}; missed sentence ${missed.join(', ')}`,
        meta: { covered: [...covered], missed, wanted: [...wanted] },
      });
    },
  };
}

/**
 * What fraction of the analyst's evidence quotes landed in an `E` sentence?
 *
 * The other half of the pair. Recall alone rewards quoting everything;
 * precision alone rewards quoting one safe sentence and stopping. A baseline
 * holding only one of them is holding a number that can be improved without the
 * analyst improving, and a gameable number in a baseline is worse than no
 * number, because it sits there looking like evidence.
 *
 * AN EMPTY ANSWER SCORES 0, NOT 1. Precision over an empty prediction set is
 * conventionally vacuous, and vacuously perfect is exactly the wrong answer
 * here: it would mean an analyst that returns no evidence at all scores 1.00 on
 * this line. That double-counts with recall, which already records the miss,
 * and the double-count is the lesser evil — the reason says the denominator was
 * empty so a reader is never left inferring it from a bare 0.
 *
 * Quotes that could not be located at all are excluded from the denominator
 * rather than counted wrong: an absent or translated quote is a traceability
 * failure and is reported as one, on its own line. Charging it here too would
 * turn one defect into two numbers and hide which one moved.
 */
export function evidencePrecision(lookup: SourceLookup): Scorer {
  const name = 'analyst-evidence-precision';
  return {
    name,
    /* Shares `evidenceSentences` with recall. agent-evals ADR 004 allows two
       scorers to claim one key, and this is the case it exists for: the pair is
       meaningless apart, so they must apply to exactly the same cases. */
    claims: [{ key: 'evidenceSentences', required: true }],
    consumesExtraction: false,
    score(args: ScoreArgs): Promise<Score> {
      const found = locationsFor(args, lookup);
      if (typeof found === 'string') return Promise.resolve(failed(name, found));

      const wanted = marked(found.source, 'E');
      const quotes = found.locations.filter((l) => l.field.startsWith('evidence'));
      const located = quotes.filter((l) => l.sentences.length > 0);

      if (located.length === 0) {
        return Promise.resolve({
          scorer: name,
          value: 0,
          passed: false,
          reason:
            quotes.length === 0
              ? 'the analyst offered no evidence quote; precision has an empty denominator and is scored 0 rather than vacuously 1'
              : `none of the ${quotes.length} evidence quotes could be located in the source; see the quote-match line`,
          meta: { quotes: quotes.length, located: 0 },
        });
      }

      const hits = located.filter((l) => l.sentences.some((i) => wanted.has(i)));
      const value = hits.length / located.length;
      return Promise.resolve({
        scorer: name,
        value,
        passed: value === 1,
        reason: `${hits.length}/${located.length} located evidence quotes land in an E sentence`,
        meta: {
          located: located.length,
          hits: hits.length,
          stray: located.filter((l) => !l.sentences.some((i) => wanted.has(i))).map((l) => l.field),
        },
      });
    },
  };
}

/**
 * What fraction of the human's `H` sentences did some hype quote cover?
 *
 * Recall only. There is no precision counterpart, and the omission is
 * deliberate rather than an oversight: `H` marks assertions the SOURCE does not
 * support, and an analyst flagging something the labeller did not mark is
 * frequently right — the labeller was reading for the central case, not
 * auditing every clause. Scoring that as a false positive would train the
 * suite against a judgement the labels do not actually make.
 */
export function hypeRecall(lookup: SourceLookup): Scorer {
  const name = 'analyst-hype-recall';
  return {
    name,
    claims: [{ key: 'hypeSentences', required: true }],
    consumesExtraction: false,
    score(args: ScoreArgs): Promise<Score> {
      const found = locationsFor(args, lookup);
      if (typeof found === 'string') return Promise.resolve(failed(name, found));

      const wanted = marked(found.source, 'H');
      if (wanted.size === 0) {
        return Promise.resolve(failed(name, 'no H sentences; this case should not have applied'));
      }

      const covered = new Set<number>();
      for (const location of found.locations) {
        if (!location.field.startsWith('hype')) continue;
        for (const index of location.sentences) if (wanted.has(index)) covered.add(index);
      }

      const value = covered.size / wanted.size;
      const missed = [...wanted].filter((i) => !covered.has(i));
      return Promise.resolve({
        scorer: name,
        value,
        passed: value === 1,
        reason:
          missed.length === 0
            ? `every H sentence is covered (${wanted.size})`
            : `covered ${covered.size}/${wanted.size}; missed sentence ${missed.join(', ')}`,
        meta: { covered: [...covered], missed, wanted: [...wanted] },
      });
    },
  };
}
