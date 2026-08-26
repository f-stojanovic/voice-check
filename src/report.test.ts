import { describe, expect, it } from 'vitest';
import { check, formatMarkdown } from './report.js';
import { rulesFor } from './rules/index.js';

/** Long enough for the density rules to measure, with no diacritic anywhere. */
const STRIPPED = Array.from(
  { length: 30 },
  () => 'Upit je radio sporo pa smo merili trajanje redovno.',
).join(' ');

/** The same text with diacritics, so only the rule under test is in play. */
const CLEAN_SR = Array.from(
  { length: 30 },
  () => 'Upit je radio sporo pa smo merili trajanje češće.',
).join(' ');

describe('the report', () => {
  it('keeps hard failures out of the mean', () => {
    // A text without diacritics is not "0.7 good". The hard failure is listed
    // and contributes nothing to the number beside it.
    const { report } = check(STRIPPED, { language: 'sr' });
    expect(report.hardFailures).toEqual(['diacritics']);
    const density = report.rules.filter(
      (r) => r.kind === 'density' && r.outcome === 'scored',
    );
    const mean =
      density.reduce((acc, r) => acc + (r.outcome === 'scored' ? r.score : 0), 0) /
      density.length;
    expect(report.score).toBeCloseTo(mean, 10);
  });

  it('averages density rules only', () => {
    const { report } = check(`Molim Vas da pošaljete izveštaj. ${CLEAN_SR}`, {
      language: 'sr',
    });
    expect(report.hardFailures).toContain('formal-address');
    expect(report.score).not.toBeNull();
    expect(report.score ?? 0).toBeGreaterThan(0.5);
  });

  it('scores null when no density rule could measure', () => {
    // Not 1.0 and not 0. Both of those are claims about the prose; this is the
    // absence of one.
    const { report } = check('Kratka beleška.', { language: 'sr' });
    expect(report.score).toBeNull();
    expect(report.abstentions.length).toBeGreaterThan(0);
  });

  it('lists every abstention with the reason the rule gave', () => {
    const { report } = check('Kratka beleška.', { language: 'sr' });
    const names = report.abstentions.map((a) => a.rule);
    expect(names).toContain('transition-density');
    expect(names).toContain('diacritics');
    for (const abstention of report.abstentions) {
      expect(abstention.reason).toContain('not measured');
    }
  });

  it('does not count an abstention as a hard failure', () => {
    // `diacritics` abstains on a short note. Recording that as a failure would
    // be as wrong as recording it as a pass.
    const { report } = check('Danas nema sastanka.', { language: 'sr' });
    expect(report.hardFailures).toEqual([]);
    expect(report.abstentions.map((a) => a.rule)).toContain('diacritics');
  });

  it('records the lexicon identity that produced the score', () => {
    const { report } = check(CLEAN_SR, { language: 'sr' });
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
    // Several phrase rules share one floor. Counting it once per rule would
    // report the number of call sites rather than the number of assumptions.
    const { uncalibrated } = check(CLEAN_SR, { language: 'sr' });
    const ids = uncalibrated.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('density.phrase-floor');
    expect(ids).toContain('density.min-words');
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

  it('prints abstentions before the density table', () => {
    // On a short text the abstentions are the report. A reader who skips them
    // reads a partial mean as a verdict on the whole text.
    const outcome = check(`Sve u svemu, gotovi smo. ${CLEAN_SR}`, { language: 'sr' });
    const markdown = formatMarkdown(outcome, 'test.md');
    expect(markdown).toContain('## Density rules');
    const short = formatMarkdown(check('Kratka beleška.', { language: 'sr' }), 'test.md');
    expect(short).toContain('No density rule could measure this text');
    expect(short).toContain('**not scored**');
  });

  it('quotes findings with their line numbers', () => {
    const outcome = check(['Prvi red.', `Stručnjaci kažu da je tako. ${CLEAN_SR}`].join('\n'), {
      language: 'sr',
    });
    expect(formatMarkdown(outcome, 'test.md')).toContain('`2:1`');
  });

  it('ends with the count of uncalibrated constants', () => {
    const outcome = check(CLEAN_SR, { language: 'sr' });
    expect(formatMarkdown(outcome, 'test.md')).toMatch(
      /This run used \d+ uncalibrated constants:/,
    );
  });
});
