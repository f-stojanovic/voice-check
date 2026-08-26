/**
 * The standard deviation of sentence length, in words.
 *
 * THE ONLY RULE HERE THAT IS A STATISTIC RATHER THAN A PATTERN, and the
 * hardest one to fake. Every other rule can be satisfied by search-and-replace:
 * delete the em dashes, swap "delve" for "look at", and the numbers move
 * without the writing changing. This one cannot be satisfied without changing
 * how the sentences are built.
 *
 * IT SCORES BACKWARDS FROM THE OTHERS ON PURPOSE. Low deviation scores badly.
 * Generated prose converges on a comfortable middle length and stays there;
 * every sentence is eighteen words, and the effect is a flatness a reader
 * feels before they can name it. The guide asks for mixed rhythm — mostly
 * short, with the occasional longer one that earns its length. A long text
 * whose sentences are all the same size is the tell, not a text with long
 * sentences.
 *
 * The guard below matters more than the constant: a four-sentence note has a
 * meaningless standard deviation, and scoring it would manufacture a finding
 * out of arithmetic.
 */

import { abstained } from './helpers.js';
import { DENSITY_MIN_WORDS, derivePassed } from '../scoring.js';
import { sentences, standardDeviation } from '../text.js';
import { guess } from '../uncalibrated.js';
import type { Rule, RuleContext, RuleResult } from '../types.js';

const TARGET_SD = guess(
  'sentence-uniformity.target-sd',
  6.0,
  'standard deviation of sentence length in words at or above which rhythm ' +
    'scores a clean 1.0; would be justified by measuring the author’s own ' +
    'published pieces, which is the single most tractable calibration here',
);

const MIN_SENTENCES = guess(
  'sentence-uniformity.min-sentences',
  6,
  'sentences below which the deviation is not reported at all; a short note ' +
    'has no rhythm to measure and scoring one would invent a finding',
);

export const sentenceUniformity: Rule = {
  name: 'sentence-uniformity',
  kind: 'density',
  languages: ['sr', 'en'],
  uncalibrated: [TARGET_SD, MIN_SENTENCES, DENSITY_MIN_WORDS],
  check(text: string, ctx: RuleContext): RuleResult {
    const lengths = sentences(text).map((s) => s.words);

    // Two gates, because this rule can fail to be measurable in two ways: too
    // few words for any rate (the shared gate), or enough words spread over
    // too few sentences for a deviation to mean anything (its own).
    if (ctx.wordCount < DENSITY_MIN_WORDS.value) {
      return abstained({
        rule: 'sentence-uniformity',
        kind: 'density',
        reason:
          `not measured: ${ctx.wordCount} words, below the ${DENSITY_MIN_WORDS.value} ` +
          `at which a rate carries information`,
      });
    }

    if (lengths.length < MIN_SENTENCES.value) {
      return abstained({
        rule: 'sentence-uniformity',
        kind: 'density',
        reason:
          `not measured: ${lengths.length} sentence${lengths.length === 1 ? '' : 's'}, ` +
          `below the ${MIN_SENTENCES.value} needed for a meaningful deviation`,
      });
    }

    const sd = standardDeviation(lengths);
    const score = Math.min(1, sd / TARGET_SD.value);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;

    return {
      rule: 'sentence-uniformity',
      kind: 'density',
      outcome: 'scored',
      // No findings: the defect is the distribution, not any one sentence.
      // Pointing at "the most average sentence" would be an accusation the
      // measurement does not support.
      findings: [],
      perThousand: sd,
      score,
      passed: derivePassed(score),
      reason:
        `${lengths.length} sentences, mean ${mean.toFixed(1)} words, ` +
        `sd ${sd.toFixed(2)} (clean at or above ${TARGET_SD.value}; lower is flatter)`,
    };
  },
};

/** Re-exported so a test can assert the abstention path is the one that ran. */
export const SENTENCE_UNIFORMITY_MIN_SENTENCES = MIN_SENTENCES;
