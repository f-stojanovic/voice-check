/**
 * "međutim", "štaviše", "moreover", "on the other hand".
 *
 * MEASURED, 2026-08-26, AND IT DID NOT HOLD. Across 15 machine-written English
 * blog posts (18,612 words, `claude-opus-5`, no style instruction) this rule
 * fired not once — not one `however` in 18,612 words. The claim that it
 * identifies generated prose is withdrawn
 * for this model — see ADR 014. It stays because the style guide's FIRST half
 * still objects to the construction whoever wrote it: this rule checks a
 * voice, not an author.
 *
 * DENSITY IN ITS PUREST FORM, and the clearest case for why this tool scores
 * continuously. Every word on this list is a good word. A transition marks a
 * turn in an argument, and prose without any reads as a list of assertions.
 * The guide's objection is quantity: a paragraph where every sentence opens
 * with a connective is a text that has been assembled rather than thought
 * through, because real arguments do not turn that often.
 *
 * A boolean check on this rule would be actively harmful — it would flag good
 * writing and teach the writer to delete words that are working. The band is
 * correspondingly loose at the floor.
 */

import { lexiconRule } from './helpers.js';
import { guess } from '../uncalibrated.js';

const FLOOR = guess(
  'transition-density.floor',
  4.0,
  'transitions per 1000 words scored clean; deliberately loose because every ' +
    'word on this list is a good word — justified by counting transitions in ' +
    'the author’s own accepted drafts, which has not been done',
);

const CEILING = guess(
  'transition-density.ceiling',
  20.0,
  'transitions per 1000 words scoring 0; roughly one every other sentence at ' +
    'typical sentence length, which is a guess dressed as arithmetic',
);

export const transitionDensity = lexiconRule({
  name: 'transition-density',
  languages: ['sr', 'en'],
  floor: FLOOR,
  ceiling: CEILING,
});
