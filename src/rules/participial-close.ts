/**
 * An `-ing` clause closing a sentence: `…, enabling users to move faster.`
 *
 * The English analogue of `verbal-adverb-close`, and the same complaint: the
 * sentence reaches its point and then bolts a consequence onto the end, so
 * every paragraph lands on the same soft cadence. It is the single most
 * recognisable rhythm in generated English prose.
 *
 * IT IS FAR NOISIER THAN THE SERBIAN RULE, and this comment exists mainly to
 * say so. `-ing` is not a marker of anything: it ends gerunds (`, improving
 * throughput` — the participle we want), plain nouns (`, a building`),
 * adjectives (`, deeply moving`), and continuous verbs inside a subordinate
 * clause (`, while the job is running`). Requiring a comma before the word and
 * a sentence end after it removes some of that and not most of it.
 *
 * So the two rules are NOT equivalent and their numbers should not be read as
 * comparable across languages. Serbian `-jući` marks a verbal adverb and
 * nothing else; English `-ing` marks whatever it likes. The honest options
 * were to ship a noisy rule with its noise documented or to ship no English
 * rhythm rule at all, and a rule whose limits are on the record is more useful
 * than a silence. A part-of-speech tagger would fix it and is not today's job.
 */

import { densityResult } from './helpers.js';
import { perThousand } from '../scoring.js';
import { findMatches } from '../text.js';
import { guess } from '../uncalibrated.js';
import type { Rule, RuleContext, RuleResult } from '../types.js';

const FLOOR = guess(
  'participial-close.floor',
  2.0,
  'sentence-closing -ing clauses per 1000 words scored clean; set higher than ' +
    'the Serbian equivalent to absorb known noise, which is a guess compensating ' +
    'for a guess',
);

const CEILING = guess(
  'participial-close.ceiling',
  12.0,
  'sentence-closing -ing clauses per 1000 words scoring 0; unmeasured, and ' +
    'wider than the Serbian band for the same reason',
);

/** A comma, an `-ing` word, then the rest of the clause up to the sentence end. */
const CLOSING = /,[ \t]+(?<hit>\p{L}{3,}ing)(?![\p{L}])[^.!?\n]{0,120}?[ \t]*(?=[.!?…]|\n|$)/gu;

export const participialClose: Rule = {
  name: 'participial-close',
  kind: 'density',
  languages: ['en'],
  uncalibrated: [FLOOR, CEILING],
  check(text: string, ctx: RuleContext): RuleResult {
    const findings = findMatches(text, CLOSING);
    return densityResult({
      rule: 'participial-close',
      findings,
      density: perThousand(findings.length, ctx.wordCount),
      floor: FLOOR,
      ceiling: CEILING,
      unit: 'per 1000 words',
    });
  },
};
