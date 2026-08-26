import { describe, expect, it } from 'vitest';
import { editorializing } from './editorializing.js';
import { positions, runRule } from './rules.test-kit.js';

describe('editorializing', () => {
  it('scores prose that does not narrate itself 1.0', () => {
    expect(runRule(editorializing, 'Indeks je prestao da se koristi.', 'sr').score).toBe(1);
  });

  it('counts exactly the Serbian occurrences', () => {
    const text = 'Važno je napomenuti da radi. Vredi pomenuti i cenu.';
    expect(runRule(editorializing, text, 'sr').findings.length).toBe(2);
  });

  it('reports column 1 for a phrase opening a line', () => {
    const text = ['Uvod.', 'Važno je napomenuti da radi.'].join('\n');
    expect(positions(runRule(editorializing, text, 'sr'))).toEqual(['2:1']);
  });

  it('matches the English phrases with either apostrophe', () => {
    const text = "It's important to note this. It’s worth mentioning that.";
    expect(runRule(editorializing, text, 'en').findings.length).toBe(2);
  });
});
