/**
 * `nije X, već Y` / `not just X but Y` / `it's not X, it's Y`.
 *
 * MEASURED, 2026-08-26, AND IT DID NOT HOLD. Across 15 machine-written English
 * blog posts (18,612 words, `claude-opus-5`, no style instruction) this rule
 * fired on 15 of 15 documents at a median of 0.00 per 1000 words, with a
 * maximum of 0.86. The claim that it identifies generated prose is
 * withdrawn
 * for this model — see ADR 014. It stays because the style guide's FIRST half
 * still objects to the construction whoever wrote it: this rule checks a
 * voice, not an author.
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
