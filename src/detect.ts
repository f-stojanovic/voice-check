/**
 * Guessing which language a file is in, when nobody said.
 *
 * THIS IS A HEURISTIC AND IT WILL BE WRONG in one specific, predictable case:
 * Serbian written without diacritics. The first test below looks for š đ č ć ž,
 * so a stripped Serbian text loses that signal and falls through to a
 * stopword vote, which is weaker.
 *
 * The saving grace is that the failure is loud rather than quiet. If the
 * stopword vote gets it right, the text is scored as Serbian and
 * `diacritics` — a HARD rule — fails it immediately. If the vote gets it
 * wrong and the text is scored as English, the report is nonsense in a way
 * nobody could mistake for a passing grade. There is no version of this
 * mistake that ends with a stripped Serbian text quietly scoring well, which
 * is the only failure mode that would actually matter.
 *
 * `--lang` overrides all of this and is the right answer whenever it is known.
 */

import type { Language } from './types.js';

const DIACRITIC = /[šđčćžŠĐČĆŽ]/u;

/**
 * Function words, not content words. Chosen to be frequent, short, and unlikely
 * to appear in the other language: `je` and `to` are Serbian, `the` and `of`
 * are English, and none of them tells you anything about the subject matter.
 */
const SR_STOPWORDS = [
  'je', 'da', 'se', 'na', 'za', 'su', 'sa', 'ali', 'ili', 'kao',
  'koji', 'koje', 'ovo', 'to', 'nije', 'bi', 'ga', 'im', 'od', 'pa',
];

const EN_STOPWORDS = [
  'the', 'of', 'and', 'to', 'is', 'in', 'that', 'it', 'for', 'with',
  'as', 'this', 'are', 'was', 'but', 'not', 'you', 'be', 'have', 'from',
];

export interface Detection {
  readonly language: Language;
  /** What the decision was based on, so a wrong answer is diagnosable. */
  readonly basis: string;
}

export function detectLanguage(text: string): Detection {
  if (DIACRITIC.test(text)) {
    return { language: 'sr', basis: 'Serbian diacritics present' };
  }

  const words = (text.toLowerCase().match(/\p{L}+/gu) ?? []);
  const counts = new Set(words);
  const sr = SR_STOPWORDS.filter((w) => counts.has(w)).length;
  const en = EN_STOPWORDS.filter((w) => counts.has(w)).length;

  // `to` is on both lists and cancels out; ties go to English because a
  // Serbian text with no diacritics has already failed, and calling it English
  // produces an obviously-wrong report rather than a plausible-looking one.
  const language: Language = sr > en ? 'sr' : 'en';
  return {
    language,
    basis:
      `no Serbian diacritics; stopword vote sr=${sr} en=${en} ` +
      `(a heuristic — pass --lang when it matters)`,
  };
}
