import { describe, expect, it } from 'vitest';
import {
  densityScore,
  derivePassed,
  minWordsFor,
  PASS_THRESHOLD,
  perThousand,
} from './scoring.js';

describe('the density scoring shape', () => {
  it('is 1.0 at and below the floor', () => {
    expect(densityScore(0, 1, 6)).toBe(1);
    expect(densityScore(1, 1, 6)).toBe(1);
  });

  it('is 0 at and above the ceiling', () => {
    expect(densityScore(6, 1, 6)).toBe(0);
    expect(densityScore(60, 1, 6)).toBe(0);
  });

  it('falls linearly between them', () => {
    expect(densityScore(3.5, 1, 6)).toBeCloseTo(0.5, 10);
  });

  it('never returns NaN', () => {
    // A NaN passes every naive range guard and poisons every mean it reaches.
    expect(densityScore(Number.NaN, 1, 6)).toBe(0);
    expect(perThousand(3, 0)).toBe(0);
  });
});

describe('the derived abstention gate', () => {
  it('is the word count at which one occurrence falls below the ceiling', () => {
    // A rule cannot say anything until one occurrence is distinguishable from
    // its own ceiling. One occurrence in w words is 1000/w per thousand.
    expect(minWordsFor(3)).toBe(334);
    expect(minWordsFor(6)).toBe(167);
    expect(minWordsFor(20)).toBe(51);
  });

  it('produces a gate at which one occurrence really does score above zero', () => {
    // The property, rather than the arithmetic: at the gate, a single ordinary
    // use must not be a total failure.
    for (const ceiling of [3, 6, 8, 12, 15, 20]) {
      const words = minWordsFor(ceiling);
      expect(densityScore(perThousand(1, words), 0, ceiling), `ceiling ${ceiling}`).toBeGreaterThan(0);
      expect(densityScore(perThousand(1, words - 1), 0, ceiling), `ceiling ${ceiling}`).toBe(0);
    }
  });

  it('is 0 for a nonsensical ceiling rather than Infinity', () => {
    expect(minWordsFor(0)).toBe(0);
    expect(minWordsFor(Number.NaN)).toBe(0);
  });
});

describe('the derived boolean', () => {
  it('comes from the threshold and nothing else', () => {
    expect(derivePassed(PASS_THRESHOLD.value)).toBe(true);
    expect(derivePassed(PASS_THRESHOLD.value - 0.0001)).toBe(false);
  });
});
