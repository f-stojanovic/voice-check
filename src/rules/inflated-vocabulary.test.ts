import { describe, expect, it } from 'vitest';
import { inflatedVocabulary } from './inflated-vocabulary.js';
import { positions, runOnPadded, scored } from './rules.test-kit.js';

describe('inflated-vocabulary', () => {
  it('scores plain vocabulary 1.0', () => {
    expect(scored(runOnPadded(inflatedVocabulary, 'Spustio sam prag i dodao merenje.', 'sr')).score).toBe(1);
  });

  it('counts exactly the Serbian entries present', () => {
    const text = 'Moramo zaroniti u kompleksan pejzaž.';
    expect(runOnPadded(inflatedVocabulary, text, 'sr').findings.length).toBe(3);
  });

  it('reports the position of a match on the second line', () => {
    const text = ['Prvi red je čist.', 'Ovde je sinergija.'].join('\n');
    expect(positions(runOnPadded(inflatedVocabulary, text, 'sr'))).toEqual(['2:9']);
  });

  it('no longer fires on `ključna reč`, the false positive day one measured', () => {
    // Day one reported this in the README. Day two encodes it in the lexicon:
    // the `ključ*` entry carries `doesNotMatch: "Ključna reč …"` and an
    // `except` list, so widening the stem breaks the build instead of quietly
    // accusing an ordinary sentence.
    const result = runOnPadded(inflatedVocabulary, 'Ključna reč u priči je postepeno.', 'sr');
    expect(result.findings.map((f) => f.text)).toEqual([]);
  });

  it('still fires on the usage the guide objects to', () => {
    // The suppression is a containing phrase, not a blanket exemption for the
    // word. `ključan trenutak` is the inflated usage and stays a finding.
    const result = runOnPadded(inflatedVocabulary, 'Ovo je ključan trenutak za nas.', 'sr');
    expect(result.findings.map((f) => f.text)).toEqual(['ključan']);
  });

  it('counts the English entries', () => {
    const text = 'We delve into the landscape to leverage a robust, seamless tapestry.';
    expect(runOnPadded(inflatedVocabulary, text, 'en').findings.length).toBe(6);
  });
});
