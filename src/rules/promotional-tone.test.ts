import { describe, expect, it } from 'vitest';
import { promotionalTone } from './promotional-tone.js';
import { positions, runOnPadded, scored } from './rules.test-kit.js';

describe('promotional-tone', () => {
  it('scores plain description 1.0', () => {
    expect(scored(runOnPadded(promotionalTone, 'Upit se vratio na osamdeset milisekundi.', 'sr')).score).toBe(1);
  });

  it('matches Serbian adjectives across their inflections', () => {
    const text = 'Rezultat je neverovatan i spektakularan. Bio je zadivljujući.';
    expect(runOnPadded(promotionalTone, text, 'sr').findings.length).toBe(3);
  });

  it('reports the column of the first inflected match', () => {
    // "Rezultat je " is 12 characters, so "neverovatan" starts at column 13.
    const text = 'Rezultat je neverovatan.';
    expect(positions(runOnPadded(promotionalTone, text, 'sr'))).toEqual(['1:13']);
  });

  it('counts the English adjectives', () => {
    const text = 'An incredible, stunning, breathtaking result.';
    expect(runOnPadded(promotionalTone, text, 'en').findings.length).toBe(3);
  });
});
