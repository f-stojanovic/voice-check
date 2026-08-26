/**
 * Shared setup for rule tests.
 *
 * Tests run rules against the REAL lexicons rather than fixtures, on purpose:
 * a rule test that passes against a hand-written phrase list proves the regex
 * machinery works and proves nothing about whether the shipped lexicon
 * contains the phrase. The lexicon is the rule.
 */

import { expect } from 'vitest';
import { loadLexicon } from '../lexicon.js';
import { DENSITY_MIN_WORDS } from '../scoring.js';
import { countWords } from '../text.js';
import type { Language, Lexicon, Rule, RuleResult, ScoredRuleResult } from '../types.js';

const cache = new Map<Language, Lexicon>();

export function lexiconFor(language: Language): Lexicon {
  const hit = cache.get(language);
  if (hit) return hit;
  const loaded = loadLexicon(language);
  cache.set(language, loaded);
  return loaded;
}

export function runRule(rule: Rule, text: string, language: Language): RuleResult {
  return rule.check(text, {
    language,
    wordCount: countWords(text),
    lexicon: lexiconFor(language),
  });
}

/**
 * Filler that trips no rule, appended to bring a test fixture over
 * {@link DENSITY_MIN_WORDS}.
 *
 * WHY tests need this at all: a density rule abstains on a short text, which
 * is correct behaviour and makes a two-sentence fixture unusable for asserting
 * a score. Padding is the honest fix — it makes the fixture the length real
 * prose is — rather than lowering the threshold for the benefit of the tests.
 *
 * Each line is checked by `padding.test.ts` to fire no rule in either
 * language, so a finding in a padded test is always a finding in the fixture.
 * The padding is APPENDED, so line and column of every fixture finding are
 * unchanged and position assertions stay meaningful.
 */
const PAD_SENTENCE: Record<Language, string> = {
  sr: 'Upit je radio sporo pa smo merili trajanje češće.',
  en: 'The query ran slowly so we started to measure its duration.',
};

export function pad(text: string, language: Language): string {
  const filler = PAD_SENTENCE[language];
  const parts = [text];
  let words = countWords(text);
  while (words < DENSITY_MIN_WORDS.value) {
    parts.push(filler);
    words += countWords(filler);
  }
  return parts.join('\n\n');
}

/** Runs a rule against the fixture padded to a measurable length. */
export function runOnPadded(rule: Rule, text: string, language: Language): RuleResult {
  return runRule(rule, pad(text, language), language);
}

/**
 * Narrows a result to a scored one, failing loudly if the rule abstained.
 *
 * Without this, `(result as ScoredRuleResult).score` would read `undefined`
 * from an abstention and every `toBe(1)` would fail with a confusing message
 * instead of "this rule declined to measure".
 */
export function scored(result: RuleResult): ScoredRuleResult {
  expect(result.outcome, `${result.rule} abstained: ${result.reason}`).toBe('scored');
  return result as ScoredRuleResult;
}

/** The `line:column` pairs of every finding, which is what a position test reads. */
export function positions(result: RuleResult): string[] {
  return result.findings.map((f) => `${f.line}:${f.column}`);
}
