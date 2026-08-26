/**
 * The count of `—` per 1000 words.
 *
 * The em dash is not a defect. It is the author's own punctuation and the
 * guide does not ask for it to be removed. What it asks for is that the dash
 * stay a choice: it is an easy default for attaching a clause, because a dash
 * never has to commit to whether the relationship it marks is causal,
 * appositive or an aside.
 *
 * MEASURED, 2026-08-26, AND THIS ONE HELD. Across 15 machine-written English
 * documents the density was 5.44 / 10.72 / 16.01 per 1000 words (min / median
 * / max) — every document above the floor, with a clear band against ordinary
 * prose. It is one of three rules with measured separation (ADR 014), which is
 * a better result than the phrase catalogue managed.
 *
 * THIS IS THE CHEAPEST RULE IN THE SET TO GAME — a writer who knows about it
 * substitutes commas and the number falls without the prose changing. Worth
 * stating plainly rather than pretending the check is deep. That it separates
 * the corpora says the model does not currently avoid em dashes; it says
 * nothing about a writer who has read this file.
 *
 * Only U+2014 EM DASH is counted. An en dash (U+2013) is a range, and a hyphen
 * is a hyphen.
 */

import { densityResult } from './helpers.js';
import { perThousand } from '../scoring.js';
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
  uncalibrated: [FLOOR, CEILING],
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
