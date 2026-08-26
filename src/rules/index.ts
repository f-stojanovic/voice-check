/**
 * The registry. Every rule the tool has, in report order.
 *
 * WHY the order is fixed here rather than sorted at render time: the report is
 * read top to bottom by a person deciding what to fix, and that order is an
 * editorial judgement — the strongest tell first, the statistic last, the
 * language-specific rules grouped so a reader can see which half of the tool
 * applies to them. Alphabetical order would be stable and meaningless.
 *
 * WHY an explicit array rather than a directory scan: a rule that is written
 * but not registered never runs, and a scan makes that failure invisible.
 * A test asserts every file in this directory appears here.
 */

import type { Language, Rule } from '../types.js';

import { negativeParallelism } from './negative-parallelism.js';
import { weaselWords } from './weasel-words.js';
import { editorializing } from './editorializing.js';
import { promotionalTone } from './promotional-tone.js';
import { inflatedVocabulary } from './inflated-vocabulary.js';
import { summaryClose } from './summary-close.js';
import { transitionDensity } from './transition-density.js';
import { ruleOfThree } from './rule-of-three.js';
import { emDashDensity } from './em-dash-density.js';
import { boldRatio } from './bold-ratio.js';
import { bulletBoldShape } from './bullet-bold-shape.js';
import { sentenceUniformity } from './sentence-uniformity.js';
import { diacritics } from './diacritics.js';
import { formalAddress } from './formal-address.js';
import { verbalAdverbClose } from './verbal-adverb-close.js';
import { participialClose } from './participial-close.js';

export const ALL_RULES: readonly Rule[] = [
  // Hard rules first: if one of these fires nothing else matters much.
  diacritics,
  formalAddress,

  // The pattern rules, strongest tell first.
  negativeParallelism,
  weaselWords,
  editorializing,
  promotionalTone,
  inflatedVocabulary,
  summaryClose,
  transitionDensity,
  ruleOfThree,
  bulletBoldShape,

  // Rhythm, then typography.
  verbalAdverbClose,
  participialClose,
  emDashDensity,
  boldRatio,

  // The statistic, last, because it describes the whole text rather than a span.
  sentenceUniformity,
];

/** The rules valid for a language. A rule that does not apply is omitted, not passed. */
export function rulesFor(language: Language): readonly Rule[] {
  return ALL_RULES.filter((rule) => rule.languages.includes(language));
}

export {
  negativeParallelism,
  weaselWords,
  editorializing,
  promotionalTone,
  inflatedVocabulary,
  summaryClose,
  transitionDensity,
  ruleOfThree,
  emDashDensity,
  boldRatio,
  bulletBoldShape,
  sentenceUniformity,
  diacritics,
  formalAddress,
  verbalAdverbClose,
  participialClose,
};
