/**
 * `nije X, već Y` / `not just X but Y` / `it's not X, it's Y`.
 *
 * The guide calls this the single strongest tell, and the reason is that the
 * construction does no work. It sets up a negation the reader never held in
 * order to deliver a claim that would have read the same on its own: "it's not
 * a tool, it's a philosophy" says exactly what "it's a philosophy" says, with
 * an extra beat of manufactured contrast. Human writers use it; they use it
 * once. Generated prose reaches for it as a default sentence shape.
 *
 * The band is tighter than the phrase default because of that strength: two of
 * these per thousand words is already the pattern, where two "however"s is not.
 * Both numbers are still guesses.
 */

import { lexiconRule } from './helpers.js';
import { guess } from '../uncalibrated.js';

const FLOOR = guess(
  'negative-parallelism.floor',
  0.5,
  'occurrences per 1000 words scored clean; tighter than other phrase rules ' +
    'because the guide names this the strongest tell — the ranking is the ' +
    'guide’s judgement, not a measurement',
);

const CEILING = guess(
  'negative-parallelism.ceiling',
  3.0,
  'occurrences per 1000 words scoring 0; would be justified by the density of ' +
    'this construction in known machine-written text',
);

export const negativeParallelism = lexiconRule({
  name: 'negative-parallelism',
  languages: ['sr', 'en'],
  floor: FLOOR,
  ceiling: CEILING,
});
