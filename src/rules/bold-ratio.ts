/**
 * Bolded characters as a share of all characters.
 *
 * Bold is emphasis, and emphasis works by being rare. Generated Markdown bolds
 * the first phrase of every paragraph and the lead-in of every bullet, which
 * produces a page where the eye has nowhere to land — the typographic version
 * of a text that has no idea which of its sentences matters most.
 *
 * MEASURED IN CHARACTERS, NOT WORDS, and so this rule's `perThousand` is
 * bolded characters per 1000 characters rather than a per-1000-words density.
 * That inconsistency is deliberate: bolding is a property of the rendered
 * page, and a rule that bolded three long words would look identical to one
 * that bolded three short ones under a word count. The field is documented as
 * rule-dependent on {@link import('../types.js').RuleResult.perThousand} for
 * exactly this case.
 *
 * The denominator is the raw source length including Markdown syntax, which
 * slightly understates the ratio. Counting rendered length means rendering.
 */

import { densityResult } from './helpers.js';
import { findMatches } from '../text.js';
import { guess } from '../uncalibrated.js';
import type { Rule, RuleContext, RuleResult } from '../types.js';

const FLOOR = guess(
  'bold-ratio.floor',
  20.0,
  'bolded characters per 1000 characters (2%) scored clean; a plausible amount ' +
    'of genuine emphasis, chosen by eye rather than by measuring a real page',
);

const CEILING = guess(
  'bold-ratio.ceiling',
  120.0,
  'bolded characters per 1000 characters (12%) scoring 0; the point where the ' +
    'page reads as bolded-by-default — a guess about a visual threshold',
);

export const boldRatio: Rule = {
  name: 'bold-ratio',
  kind: 'density',
  languages: ['sr', 'en'],
  uncalibrated: [FLOOR, CEILING],
  check(text: string, _ctx: RuleContext): RuleResult {
    // Two alternations because `**`/`__` cannot share one named group; the
    // underscore form is rare enough that the second pass is cheaper than a
    // cleverer pattern nobody could read.
    const stars = findMatches(text, /\*\*(?<hit>[^*\n]+)\*\*/gu);
    const unders = findMatches(text, /__(?<hit>[^_\n]+)__/gu);
    const findings = [...stars, ...unders].sort((a, b) => a.offset - b.offset);

    const boldChars = findings.reduce((acc, f) => acc + f.text.length, 0);
    const density = text.length === 0 ? 0 : (boldChars * 1000) / text.length;

    return densityResult({
      rule: 'bold-ratio',
      findings,
      density,
      floor: FLOOR,
      ceiling: CEILING,
      unit: 'bolded characters per 1000 characters',
    });
  },
};
