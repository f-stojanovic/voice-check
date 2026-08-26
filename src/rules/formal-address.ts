/**
 * Capitalised `Vi` / `Vas` / `Vam` / `Vaš` mid-sentence. HARD.
 *
 * The guide is absolute on this one: always `ti`, never `Vi`. It is not a
 * preference about register, it is the voice. The author writes to one person
 * who is already in the room; the capitalised formal address is the register of
 * a bank letter, and a single one of them relocates the whole text into a
 * different relationship with the reader. There is no dose at which it is
 * fine, so there is nothing to average.
 *
 * MID-SENTENCE is what makes this checkable. `Vi` at the start of a sentence
 * is just a capital letter doing its job, and cannot be told apart from the
 * formal pronoun without parsing. Mid-sentence capitalisation of these
 * specific words is unambiguous in a way that needs no dictionary.
 *
 * KNOWN FALSE POSITIVE: `Vas` is also a surname, and a headline in title case
 * would trip every word in it. Both are rare in the author's prose and neither
 * is suppressed today.
 */

import { hardResult } from './helpers.js';
import { findMatches, lineStarts } from '../text.js';
import type { Finding, Rule, RuleContext, RuleResult } from '../types.js';

/**
 * The formal-address paradigm. `Vaš` takes up to four further letters
 * (`Vašeg`, `Vašima`), which is what the `\p{L}{0,4}` allows.
 */
const FORMAL = /(?<![\p{L}])(?<hit>V(?:i|as|am|ama|aš\p{L}{0,4}|aše\p{L}{0,3}))(?![\p{L}])/gu;

/** Characters after which a capital is simply how a sentence starts. */
const SENTENCE_END = /[.!?…:]/u;

export const formalAddress: Rule = {
  name: 'formal-address',
  kind: 'hard',
  languages: ['sr'],
  check(text: string, _ctx: RuleContext): RuleResult {
    const starts = lineStarts(text);
    const findings: Finding[] = findMatches(text, FORMAL, starts).filter((finding) =>
      isMidSentence(text, finding.offset),
    );

    return hardResult({
      rule: 'formal-address',
      findings,
      clean: findings.length === 0,
      reason:
        findings.length === 0
          ? 'no capitalised formal address mid-sentence'
          : `${findings.length} capitalised formal address${findings.length === 1 ? '' : 'es'} ` +
            `mid-sentence; the voice is always "ti"`,
    });
  },
};

/** True when the preceding non-space character is neither absent nor terminal. */
function isMidSentence(text: string, offset: number): boolean {
  for (let i = offset - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === undefined) return false;
    if (ch === '\n') return false; // start of a line: same case as start of text
    if (/\s/u.test(ch)) continue;
    // An opening quote or bracket does not end a sentence but does introduce
    // one, so a capital after it is unremarkable.
    if (/["'“„«(\[]/u.test(ch)) return false;
    return !SENTENCE_END.test(ch);
  }
  return false;
}
