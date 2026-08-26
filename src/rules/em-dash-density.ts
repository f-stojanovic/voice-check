/**
 * The count of `—` per 1000 words.
 *
 * The em dash is not a defect. It is the author's own punctuation and the
 * guide does not ask for it to be removed. What it asks for is that the dash
 * stay a choice: generated prose reaches for it as the default way to attach a
 * clause, because a dash never has to commit to whether the relationship it
 * marks is causal, appositive or an aside.
 *
 * THIS IS THE CHEAPEST RULE IN THE SET TO GAME — a writer who knows about it
 * substitutes commas and the number falls without the prose changing. Worth
 * stating plainly rather than pretending the check is deep. Its value is as
 * one signal among fifteen, which is the whole argument for scoring the
 * accumulation rather than any single rule.
 *
 * Only U+2014 EM DASH is counted. An en dash (U+2013) is a range, and a hyphen
 * is a hyphen.
 */

import { densityResult } from './helpers.js';
import { DENSITY_MIN_WORDS, perThousand } from '../scoring.js';
import { findMatches } from '../text.js';
import { guess } from '../uncalibrated.js';
import type { Rule, RuleContext, RuleResult } from '../types.js';

const FLOOR = guess(
  'em-dash-density.floor',
  2.0,
  'em dashes per 1000 words scored clean; the author uses them deliberately, ' +
    'so the floor should come from counting his own accepted drafts',
);

const CEILING = guess(
  'em-dash-density.ceiling',
  15.0,
  'em dashes per 1000 words scoring 0; roughly one every two sentences, which ' +
    'is where the punctuation has stopped being a choice — asserted, not measured',
);

export const emDashDensity: Rule = {
  name: 'em-dash-density',
  kind: 'density',
  languages: ['sr', 'en'],
  uncalibrated: [FLOOR, CEILING, DENSITY_MIN_WORDS],
  check(text: string, ctx: RuleContext): RuleResult {
    const findings = findMatches(text, /—/gu);
    return densityResult({
      ctx,
      rule: 'em-dash-density',
      findings,
      density: perThousand(findings.length, ctx.wordCount),
      floor: FLOOR,
      ceiling: CEILING,
      unit: 'per 1000 words',
    });
  },
};
