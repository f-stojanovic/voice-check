import { describe, expect, it } from 'vitest';
import { diacritics } from './diacritics.js';
import { runRule } from './rules.test-kit.js';

/** 45 words, no diacritic anywhere: above the abstention threshold. */
const STRIPPED = Array.from({ length: 45 }, () => 'rec').join(' ');

describe('diacritics', () => {
  it('passes Serbian text that has them', () => {
    const result = runRule(diacritics, `${STRIPPED} češće`, 'sr');
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it('fails long Serbian text that has none', () => {
    const result = runRule(diacritics, STRIPPED, 'sr');
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.kind).toBe('hard');
  });

  it('abstains on a short note rather than failing it', () => {
    // "Danas nema sastanka" is correct Serbian containing no diacritic. The
    // guard is the whole design decision in this rule.
    const result = runRule(diacritics, 'Danas nema sastanka.', 'sr');
    expect(result.passed).toBe(true);
    expect(result.reason).toContain('not measured');
  });

  it('reports no findings, because the defect is an absence', () => {
    // There is no span to underline. Guessing which words should have carried
    // a diacritic would need a dictionary and would be inventing evidence.
    expect(runRule(diacritics, STRIPPED, 'sr').findings).toEqual([]);
  });
});
