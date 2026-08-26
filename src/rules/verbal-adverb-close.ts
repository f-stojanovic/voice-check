/**
 * A verbal adverb (`-jući`, `-ći`) sitting immediately before a sentence end.
 *
 * `…, omogućavajući korisnicima da rade brže.` The clause is grammatical and
 * the sentence is fine once. As a habit it is the Serbian form of the trailing
 * participle: a sentence that has finished its thought and then attaches a
 * consequence to the back of it, so that every paragraph ends on the same
 * falling cadence.
 *
 * THIS IS THE RULE SERBIAN MORPHOLOGY MAKES POSSIBLE. The English analogue
 * (`participial-close`) has to guess, because `-ing` marks four different
 * things. `-jući` marks one, which is why this check is precise where its
 * English counterpart is a heuristic — a genuine asymmetry between the two
 * halves of the tool, not an accident of effort.
 *
 * THE KNOWN IMPRECISION is `-ći` on its own: it is also the infinitive ending
 * (`reći`, `ići`, `moći`), so `Ovo je teško reći.` matches and is not a verbal
 * adverb. The guide names `-ći` explicitly, so it stays in; the noise is
 * reported rather than silently narrowed to `-jući`.
 */

import { densityResult } from './helpers.js';
import { perThousand } from '../scoring.js';
import { findMatches } from '../text.js';
import { guess } from '../uncalibrated.js';
import type { Rule, RuleContext, RuleResult } from '../types.js';

const FLOOR = guess(
  'verbal-adverb-close.floor',
  1.5,
  'sentence-closing verbal adverbs per 1000 words scored clean; the ' +
    'construction is normal Serbian, so the floor is above zero on judgement',
);

const CEILING = guess(
  'verbal-adverb-close.ceiling',
  8.0,
  'sentence-closing verbal adverbs per 1000 words scoring 0; unmeasured, and ' +
    'inflated by the -ći infinitive collision this rule knowingly accepts',
);

const CLOSING = /(?<![\p{L}])(?<hit>\p{L}{2,}(?:jući|ći))[ \t]*(?=[.!?…]|\n|$)/gu;

export const verbalAdverbClose: Rule = {
  name: 'verbal-adverb-close',
  kind: 'density',
  languages: ['sr'],
  uncalibrated: [FLOOR, CEILING],
  check(text: string, ctx: RuleContext): RuleResult {
    const findings = findMatches(text, CLOSING);
    return densityResult({
      rule: 'verbal-adverb-close',
      findings,
      density: perThousand(findings.length, ctx.wordCount),
      floor: FLOOR,
      ceiling: CEILING,
      unit: 'per 1000 words',
    });
  },
};
