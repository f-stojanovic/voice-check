import { describe, expect, it } from 'vitest';
import { positions, runRule } from './rules.test-kit.js';
import { weaselWords } from './weasel-words.js';

describe('weasel-words', () => {
  it('scores prose with named sources 1.0', () => {
    const text = 'Postgres dokumentacija kaže da planer koristi statistiku.';
    expect(runRule(weaselWords, text, 'sr').score).toBe(1);
  });

  it('counts exactly the Serbian weasels present', () => {
    const text = 'Stručnjaci kažu da je tako. Mnogi smatraju isto. Izveštaji pokazuju rast.';
    expect(runRule(weaselWords, text, 'sr').findings.length).toBe(3);
  });

  it('reports the line and column of a finding on a later line', () => {
    const text = ['Prvi red.', 'Ovde mnogi smatraju drugačije.'].join('\n');
    expect(positions(runRule(weaselWords, text, 'sr'))).toEqual(['2:6']);
  });

  it('counts the English weasels and is case-insensitive', () => {
    const text = 'Experts say otherwise. Reports suggest a rise. Critics argue the point.';
    expect(runRule(weaselWords, text, 'en').findings.length).toBe(3);
  });
});
