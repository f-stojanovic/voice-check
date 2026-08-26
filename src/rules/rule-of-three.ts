/**
 * `X, Y i Z` / `X, Y, and Z`.
 *
 * The tricolon is a real rhetorical figure and it is genuinely satisfying,
 * which is exactly why it gets overused: it is the safe shape for a list whose
 * real length is two or five. A text where every enumeration arrives in threes
 * has had its content rounded to fit a rhythm.
 *
 * MEASURED, 2026-08-26: this fires on machine-written text (median 1.47 per
 * 1000 words, max 5.05) and on the author's own writing at a comparable rate.
 * It does not separate the two — see ADR 014 — and the day-three attempt to
 * fix that with a per-instance exception was reverted, because suppressing one
 * literal list inside a rule that measures a RATE is a category error.
 *
 * Matched as a pattern rather than a phrase list because the tell is the
 * shape, and the words filling it are arbitrary. The pattern requires three
 * words of at least three letters, which drops `a, b and c` style
 * enumerations of short tokens and, more importantly, most code fragments.
 */

import { lexiconRule } from './helpers.js';
import { guess } from '../uncalibrated.js';

const FLOOR = guess(
  'rule-of-three.floor',
  2.0,
  'tricolons per 1000 words scored clean; lists are normal in technical prose ' +
    'so the floor is above the phrase default, on judgement not measurement',
);

const CEILING = guess(
  'rule-of-three.ceiling',
  12.0,
  'tricolons per 1000 words scoring 0; would be justified by the figure in ' +
    'text the author considers overwritten, whoever wrote it',
);

export const ruleOfThree = lexiconRule({
  name: 'rule-of-three',
  languages: ['sr', 'en'],
  floor: FLOOR,
  ceiling: CEILING,
});
