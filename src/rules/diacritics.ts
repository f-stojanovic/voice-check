/**
 * Serbian text must contain Serbian letters. HARD.
 *
 * WHY THIS IS HARD AND NOT SCORED. Every other rule in this set is a matter of
 * degree, and this one is not. `ceo` and `ćeo`, `cas` and `čas`, `moze` and
 * `može` are different words; writing Serbian without š đ č ć ž hands the
 * reader a disambiguation problem on every line. It is not prose that could be
 * better. It is prose that is wrong, and averaging it into a mean would let a
 * text arrive at "0.7 good" while being unreadable.
 *
 * The usual cause is not carelessness — it is a keyboard layout, a form field,
 * or a paste through a system that ate the codepoints. Which means it is
 * usually a whole-document condition, and a whole-document condition is
 * exactly what a hard rule is for.
 *
 * FAILS ON ABSENCE, which makes it the one rule here with no findings to
 * point at. There is no span to underline: the defect is everywhere and
 * nowhere. Guessing which words *should* have carried a diacritic would need a
 * dictionary and would be the rule inventing evidence it does not have.
 *
 * THE SHORT-TEXT GUARD is the real design decision. A twelve-word note may
 * honestly contain none of these letters — "Danas nema sastanka" is correct
 * Serbian with no diacritic in it. Below the threshold the rule abstains
 * rather than passing, and the reason says which it did.
 */

import { abstained, hardResult } from './helpers.js';
import { guess } from '../uncalibrated.js';
import type { Rule, RuleContext, RuleResult } from '../types.js';

/**
 * THIS NUMBER IS A GUESS and it is the load-bearing one in this file: too low
 * and the rule fails honest short notes, too high and a stripped paragraph
 * sails through. What would settle it: take a corpus of real Serbian text,
 * compute the distribution of "longest run of words containing no diacritic",
 * and put the threshold above its 99th percentile. That is a couple of hours
 * with any Serbian corpus and has not been done.
 */
const MIN_WORDS = guess(
  'diacritics.min-words',
  40,
  'words below which the rule abstains, because a short note may honestly ' +
    'contain no diacritic; should be set above the 99th percentile of the ' +
    'longest diacritic-free run in real Serbian text, which has not been measured',
);

/** Serbian Latin diacritics, both cases. `dž`, `lj`, `nj` carry none and are absent. */
const DIACRITIC = /[šđčćžŠĐČĆŽ]/u;

export const diacritics: Rule = {
  name: 'diacritics',
  kind: 'hard',
  languages: ['sr'],
  uncalibrated: [MIN_WORDS],
  check(text: string, ctx: RuleContext): RuleResult {
    if (ctx.wordCount < MIN_WORDS.value) {
      // An abstention, not a pass. Day one reported this as `clean: true`,
      // which recorded that the rule had looked at a short note and approved
      // it. It had not looked; it could not.
      return abstained({
        rule: 'diacritics',
        kind: 'hard',
        reason:
          `not measured: ${ctx.wordCount} words, below the ${MIN_WORDS.value} at ` +
          `which a diacritic-free text stops being plausible`,
      });
    }

    const present = DIACRITIC.test(text);
    return hardResult({
      rule: 'diacritics',
      findings: [],
      clean: present,
      reason: present
        ? 'Serbian diacritics present'
        : `no š đ č ć ž in ${ctx.wordCount} words of Serbian — the text has been ` +
          `stripped or was typed on a layout without them`,
    });
  },
};
