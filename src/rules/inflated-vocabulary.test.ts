import { describe, expect, it } from 'vitest';
import { inflatedVocabulary } from './inflated-vocabulary.js';
import { positions, runRule } from './rules.test-kit.js';

describe('inflated-vocabulary', () => {
  it('scores plain vocabulary 1.0', () => {
    expect(runRule(inflatedVocabulary, 'Spustio sam prag i dodao merenje.', 'sr').score).toBe(1);
  });

  it('counts exactly the Serbian entries present', () => {
    const text = 'Moramo zaroniti u kompleksan pejzaž.';
    expect(runRule(inflatedVocabulary, text, 'sr').findings.length).toBe(3);
  });

  it('reports the position of a match on the second line', () => {
    const text = ['Prvi red je čist.', 'Ovde je sinergija.'].join('\n');
    expect(positions(runRule(inflatedVocabulary, text, 'sr'))).toEqual(['2:9']);
  });

  it('fires on `ključna reč`, which is the known false positive', () => {
    // Documented in the README rather than suppressed: inventing a suppression
    // syntax before seeing which suppressions are needed would be guessing.
    const result = runRule(inflatedVocabulary, 'Ključna reč u priči je „postepeno".', 'sr');
    expect(result.findings.map((f) => f.text)).toEqual(['Ključna']);
  });

  it('counts the English entries', () => {
    const text = 'We delve into the landscape to leverage a robust, seamless tapestry.';
    expect(runRule(inflatedVocabulary, text, 'en').findings.length).toBe(6);
  });
});
