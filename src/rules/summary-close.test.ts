import { describe, expect, it } from 'vitest';
import { positions, runRule } from './rules.test-kit.js';
import { summaryClose } from './summary-close.js';

describe('summary-close', () => {
  it('scores a text that simply stops 1.0', () => {
    expect(runRule(summaryClose, 'Kod je bio isti mesec dana. Podaci nisu.', 'sr').score).toBe(1);
  });

  it('counts exactly the Serbian closers', () => {
    const text = 'Sve u svemu, gotovi smo. U zaključku, ovo je kraj.';
    expect(runRule(summaryClose, text, 'sr').findings.length).toBe(2);
  });

  it('matches a phrase split across a line break', () => {
    // Interior whitespace in a lexicon phrase matches any whitespace, so a
    // wrapped paragraph does not hide the tell.
    const text = ['Sve u', 'svemu, gotovi smo.'].join('\n');
    expect(positions(runRule(summaryClose, text, 'sr'))).toEqual(['1:1']);
  });

  it('counts the English closers', () => {
    expect(runRule(summaryClose, 'In conclusion, all in all, we are done.', 'en').findings.length).toBe(2);
  });
});
