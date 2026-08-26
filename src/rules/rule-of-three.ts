/**
 * `X, Y i Z` / `X, Y, and Z`.
 *
 * The tricolon is a real rhetorical figure and it is genuinely satisfying,
 * which is exactly why generated prose overuses it: it is the safe shape for a
 * list whose real length is two or five. A text where every enumeration
 * arrives in threes has had its content rounded to fit a rhythm.
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
    'text the author considers machine-written',
);

export const ruleOfThree = lexiconRule({
  name: 'rule-of-three',
  languages: ['sr', 'en'],
  floor: FLOOR,
  ceiling: CEILING,
});
