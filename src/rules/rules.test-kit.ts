/**
 * Shared setup for rule tests.
 *
 * Tests run rules against the REAL lexicons rather than fixtures, on purpose:
 * a rule test that passes against a hand-written phrase list proves the regex
 * machinery works and proves nothing about whether the shipped lexicon
 * contains the phrase. The lexicon is the rule.
 */

import { loadLexicon } from '../lexicon.js';
import { countWords } from '../text.js';
import type { Language, Lexicon, Rule, RuleResult } from '../types.js';

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

/** The `line:column` pairs of every finding, which is what a position test reads. */
export function positions(result: RuleResult): string[] {
  return result.findings.map((f) => `${f.line}:${f.column}`);
}
