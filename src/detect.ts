/**
 * Guessing which language a file is in, when nobody said.
 *
 * STOPWORDS DECIDE; DIACRITICS ONLY BREAK A TIE. Day one had this backwards —
 * it looked for š đ č ć ž first and only fell through to a stopword vote when
 * it found none. That put detection and the `diacritics` hard rule on the same
 * signal, reading it in opposite directions: a Serbian text with its
 * diacritics stripped is exactly the text the hard rule exists to catch, and
 * exactly the text the detector would have handed to the English rules. The
 * rule could only fire on texts detection had already half-refused.
 *
 * Function words do not have that problem. `je`, `da`, `se` survive a stripped
 * keyboard layout intact, so the detector still says "Serbian" and
 * `diacritics` gets to do its job.
 *
 * The diacritic test remains as a tiebreak, for the short text where too few
 * stopwords appear to separate the two. It is a strong signal; it is just not
 * one that can be relied on to be present.
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
  const present = new Set(text.toLowerCase().match(/\p{L}+/gu) ?? []);
  const sr = SR_STOPWORDS.filter((w) => present.has(w)).length;
  const en = EN_STOPWORDS.filter((w) => present.has(w)).length;
  const diacritics = DIACRITIC.test(text);

  if (sr !== en) {
    return {
      language: sr > en ? 'sr' : 'en',
      basis:
        `stopword vote sr=${sr} en=${en}` +
        `${diacritics ? ', Serbian diacritics also present' : ''} ` +
        `(a heuristic — pass --lang when it matters)`,
    };
  }

  // Tied. `to` is on both lists and cancels out, and a short text may show too
  // few function words to separate at all. Diacritics break it; with neither
  // signal, English, because calling a stripped Serbian text English produces
  // an obviously-wrong report rather than a plausible-looking one.
  return {
    language: diacritics ? 'sr' : 'en',
    basis:
      `stopword vote tied at ${sr}; broken by ` +
      `${diacritics ? 'Serbian diacritics' : 'defaulting to English'} ` +
      `(a heuristic — pass --lang when it matters)`,
  };
}
