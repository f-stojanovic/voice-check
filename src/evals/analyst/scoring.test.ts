import { describe, expect, it } from 'vitest';
import type { Score, ScoreArgs } from 'agent-evals';
import { splitSentences } from './sentences.js';
import {
  claimLocates,
  evidencePrecision,
  evidenceRecall,
  hypeRecall,
  locateQuotes,
  matchDistribution,
} from './scoring.js';
import type { LabelledSource } from './scoring.js';
import type { Analysis } from '../../agents/analyst.js';

/**
 * A tiny English source with one sentence of each kind, so a reader can check
 * the arithmetic by eye.
 *
 * 1  Retrying a flaky test hides the failure rather than removing it.   -> C
 * 2  We looked at four repositories and found the median retried test
 *    had been failing one run in nine.                                  -> E
 * 3  The fix took an afternoon.                                          -> E
 * 4  This is the most important problem in software today.               -> H
 * 5  Nothing else here matters much.                                     -> (blank)
 */
const TEXT = [
  'Retrying a flaky test hides the failure rather than removing it.',
  'We looked at four repositories and found the median retried test had been failing one run in nine.',
  'The fix took an afternoon.',
  'This is the most important problem in software today.',
  'Nothing else here matters much.',
].join(' ');

const SENTENCES = splitSentences(TEXT);

/* Marks are test scaffolding, not a label file: this is a fabricated source
   that exists only in this file. No committed label file is written by code —
   that is ADR 021 and worksheet.test.ts is where it is asserted. */
const SOURCE: LabelledSource = {
  name: 'fixture.md',
  text: TEXT,
  language: 'en',
  sentences: SENTENCES,
  labels: {
    source: 'fixture.md',
    labelledBy: 'test scaffolding',
    labelledAt: '2026-08-27',
    language: 'en',
    entries: [
      { index: 1, text: SENTENCES[0]?.text ?? '', marks: ['C'] },
      { index: 2, text: SENTENCES[1]?.text ?? '', marks: ['E'] },
      { index: 3, text: SENTENCES[2]?.text ?? '', marks: ['E'] },
      { index: 4, text: SENTENCES[3]?.text ?? '', marks: ['H'] },
    ],
  },
};

const lookup = (): LabelledSource => SOURCE;

const PERFECT: Analysis = {
  claim: {
    statement: 'Retries hide flakiness.',
    quote: 'Retrying a flaky test hides the failure',
  },
  evidence: [
    { kind: 'data', statement: 'Four repositories were counted.', quote: 'We looked at four repositories' },
    { kind: 'anecdote', statement: 'The fix was quick.', quote: 'The fix took an afternoon' },
  ],
  novelty: { genuinelyNew: [], restated: [] },
  hype: [{ statement: 'Unsupported superlative.', quote: 'the most important problem in software today' }],
  openQuestions: [],
};

function args(analysis: Analysis): ScoreArgs {
  return {
    case: { id: 'c', input: {}, expect: {} },
    output: {
      raw: null,
      model: 'test',
      usage: { inputTokens: 0, outputTokens: 0 },
      latencyMs: 0,
      toolCalls: [{ name: 'record_analysis', input: analysis }],
    },
    extraction: { via: 'tool-call', data: analysis },
  };
}

const run = (scorer: { score(a: ScoreArgs): Promise<Score> }, analysis: Analysis): Promise<Score> =>
  scorer.score(args(analysis));

describe('locateQuotes', () => {
  it('maps each quote to the sentence it lands in', () => {
    const located = locateQuotes(PERFECT, SOURCE);
    expect(located.find((l) => l.field === 'claim')?.sentences).toEqual([1]);
    expect(located.find((l) => l.field === 'evidence[0]')?.sentences).toEqual([2]);
    expect(located.find((l) => l.field === 'hype[0]')?.sentences).toEqual([4]);
  });

  it('tallies match kinds without scoring them', () => {
    expect(matchDistribution(locateQuotes(PERFECT, SOURCE))).toEqual({
      exact: 4,
      normalized: 0,
      foreign: 0,
      absent: 0,
    });
  });
});

/**
 * BOTH DIRECTIONS FOR EVERY SCORER.
 *
 * A scorer that cannot fail is not a scorer — the same guard `agent-evals` has
 * against a suite that measures nothing. Each block below shows the maximum and
 * then a mutation that moves it, and the mutations are the ones that actually
 * happen: a quote moved to an unmarked sentence, a dropped evidence item, a
 * translated quote.
 */
describe('analyst-claim-locates', () => {
  const scorer = claimLocates(lookup);

  it('scores 1 when the claim quote lands in the C sentence', async () => {
    expect((await run(scorer, PERFECT)).value).toBe(1);
  });

  it('scores 0 when the claim quote moves to an unmarked sentence', async () => {
    const moved = { ...PERFECT, claim: { ...PERFECT.claim, quote: 'Nothing else here matters much' } };
    const score = await run(scorer, moved);
    expect(score.value).toBe(0);
    expect(score.reason).toContain('lands in sentence 5');
  });

  it('scores 0, naming traceability, when the claim quote is translated', async () => {
    const translated = { ...PERFECT, claim: { ...PERFECT.claim, quote: 'Понављање скрива грешку' } };
    const score = await run(scorer, translated);
    expect(score.value).toBe(0);
    /* The reason must say the quote has no position, not that the analyst
       picked the wrong sentence. Those have different fixes. */
    expect(score.reason).toMatch(/foreign|absent/u);
  });
});

describe('analyst-evidence-recall', () => {
  const scorer = evidenceRecall(lookup);

  it('scores 1 when both E sentences are covered', async () => {
    expect((await run(scorer, PERFECT)).value).toBe(1);
  });

  it('scores 0.5 when one evidence item is dropped', async () => {
    const dropped = { ...PERFECT, evidence: [PERFECT.evidence[0]!] };
    const score = await run(scorer, dropped);
    expect(score.value).toBe(0.5);
    expect(score.reason).toContain('missed sentence 3');
  });

  it('scores 0 when the analyst offers no evidence', async () => {
    expect((await run(scorer, { ...PERFECT, evidence: [] })).value).toBe(0);
  });
});

describe('analyst-evidence-precision', () => {
  const scorer = evidencePrecision(lookup);

  it('scores 1 when every evidence quote lands in an E sentence', async () => {
    expect((await run(scorer, PERFECT)).value).toBe(1);
  });

  /* The game recall alone cannot see: quote more, cover more, get a better
     number. Precision is what makes that cost something. */
  it('falls when the analyst pads with a quote from an unmarked sentence', async () => {
    const padded = {
      ...PERFECT,
      evidence: [
        ...PERFECT.evidence,
        { kind: 'anecdote' as const, statement: 'Padding.', quote: 'Nothing else here matters much' },
      ],
    };
    const score = await run(scorer, padded);
    expect(score.value).toBeCloseTo(2 / 3);
    expect(score.meta?.['stray']).toEqual(['evidence[2]']);
  });

  it('scores 0 rather than a vacuous 1 when there is no evidence at all', async () => {
    const score = await run(scorer, { ...PERFECT, evidence: [] });
    expect(score.value).toBe(0);
    expect(score.reason).toContain('empty denominator');
  });

  it('excludes an untraceable quote from the denominator rather than counting it wrong', async () => {
    const translated = {
      ...PERFECT,
      evidence: [
        PERFECT.evidence[0]!,
        { kind: 'data' as const, statement: 'Translated.', quote: 'Погледали смо четири репозиторијума' },
      ],
    };
    /* One located quote, and it is right: 1/1. The translated one is a
       traceability failure and is reported on that line instead. */
    expect((await run(scorer, translated)).value).toBe(1);
  });
});

describe('analyst-hype-recall', () => {
  const scorer = hypeRecall(lookup);

  it('scores 1 when the H sentence is covered', async () => {
    expect((await run(scorer, PERFECT)).value).toBe(1);
  });

  it('scores 0 when the hype quote moves to an unmarked sentence', async () => {
    const moved = {
      ...PERFECT,
      hype: [{ statement: 'Wrong target.', quote: 'The fix took an afternoon' }],
    };
    expect((await run(scorer, moved)).value).toBe(0);
  });

  it('scores 0 when the analyst finds no hype', async () => {
    expect((await run(scorer, { ...PERFECT, hype: [] })).value).toBe(0);
  });
});

describe('a translated quote is a traceability finding, not a low score', () => {
  /* The Serbian failure mode analyst.ts documents: the model restates the
     source faithfully in the other language, and the quote is then absent.
     "did not find it" and "found it and translated it" have different fixes,
     so the distribution is carried separately rather than folded into recall. */
  it('shows up in the match distribution', () => {
    const translated = {
      ...PERFECT,
      evidence: [{ kind: 'data' as const, statement: 'T.', quote: 'Погледали смо четири репозиторијума' }],
    };
    const tally = matchDistribution(locateQuotes(translated, SOURCE));
    expect(tally.foreign).toBe(1);
    expect(tally.absent).toBe(0);
  });
});
