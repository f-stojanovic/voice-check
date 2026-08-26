import { describe, expect, it } from 'vitest';
import { editorializing } from './editorializing.js';
import { positions, runOnPadded, scored } from './rules.test-kit.js';

describe('editorializing', () => {
  it('scores prose that does not narrate itself 1.0', () => {
    expect(scored(runOnPadded(editorializing, 'Indeks je prestao da se koristi.', 'sr')).score).toBe(1);
  });

  it('counts exactly the Serbian occurrences', () => {
    const text = 'Važno je napomenuti da radi. Vredi pomenuti i cenu.';
    expect(runOnPadded(editorializing, text, 'sr').findings.length).toBe(2);
  });

  it('reports column 1 for a phrase opening a line', () => {
    const text = ['Uvod.', 'Važno je napomenuti da radi.'].join('\n');
    expect(positions(runOnPadded(editorializing, text, 'sr'))).toEqual(['2:1']);
  });

  it('matches the English phrases with either apostrophe', () => {
    const text = "It's important to note this. It’s worth mentioning that.";
    expect(runOnPadded(editorializing, text, 'en').findings.length).toBe(2);
  });
});
