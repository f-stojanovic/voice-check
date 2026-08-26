import { describe, expect, it } from 'vitest';
import { check, formatMarkdown } from './report.js';
import { rulesFor } from './rules/index.js';

/** 45 words with no diacritic: enough to trip the hard rule. */
const STRIPPED = Array.from({ length: 45 }, () => 'rec').join(' ');

describe('the report', () => {
  it('keeps hard failures out of the mean', () => {
    // A text without diacritics is not "0.7 good". The hard failure is listed
    // and contributes nothing to the number beside it.
    const { report } = check(STRIPPED, { language: 'sr' });
    expect(report.hardFailures).toEqual(['diacritics']);
    const density = report.rules.filter((r) => r.kind === 'density');
    const mean = density.reduce((acc, r) => acc + r.score, 0) / density.length;
    expect(report.score).toBeCloseTo(mean, 10);
  });

  it('averages density rules only', () => {
    const { report } = check('Molim Vas da pošaljete izveštaj o svemu što ste uradili.', {
      language: 'sr',
    });
    expect(report.hardFailures).toContain('formal-address');
    expect(report.score).toBeGreaterThan(0.5);
  });

  it('records the lexicon identity that produced the score', () => {
    const { report } = check('Kratak tekst na srpskom.', { language: 'sr' });
    expect(report.lexiconVersion).toMatch(/^\d+\.\d+\.\d+\+[0-9a-f]{12}$/);
  });

  it('runs only the rules valid for the language', () => {
    const { report } = check('A short English note.', { language: 'en' });
    const names = report.rules.map((r) => r.rule);
    expect(names).toContain('participial-close');
    expect(names).not.toContain('diacritics');
    expect(names).not.toContain('verbal-adverb-close');
  });

  it('counts each shared uncalibrated constant once', () => {
    // Five phrase rules share one floor. Counting it five times would report
    // the number of call sites rather than the number of assumptions.
    const { uncalibrated } = check('Kratak tekst.', { language: 'sr' });
    const ids = uncalibrated.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('density.phrase-floor');
  });

  it('declares an uncalibrated constant for every rule that guesses one', () => {
    for (const rule of rulesFor('sr')) {
      if (rule.name === 'formal-address') continue; // no numbers to guess
      expect(rule.uncalibrated?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('prints hard failures before the density table', () => {
    const outcome = check(STRIPPED, { language: 'sr' });
    const markdown = formatMarkdown(outcome, 'test.md');
    expect(markdown.indexOf('## Hard failures')).toBeLessThan(markdown.indexOf('## Density rules'));
  });

  it('quotes findings with their line numbers', () => {
    const outcome = check(['Prvi red.', 'Stručnjaci kažu da je tako.'].join('\n'), {
      language: 'sr',
    });
    expect(formatMarkdown(outcome, 'test.md')).toContain('`2:1`');
  });

  it('ends with the count of uncalibrated constants', () => {
    const outcome = check('Kratak tekst.', { language: 'sr' });
    expect(formatMarkdown(outcome, 'test.md')).toMatch(/This run used \d+ uncalibrated constants:/);
  });
});
