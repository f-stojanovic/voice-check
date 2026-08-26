import { describe, expect, it } from 'vitest';
import { densityScore, derivePassed, PASS_THRESHOLD, perThousand } from './scoring.js';

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

describe('the derived boolean', () => {
  it('comes from the threshold and nothing else', () => {
    expect(derivePassed(PASS_THRESHOLD.value)).toBe(true);
    expect(derivePassed(PASS_THRESHOLD.value - 0.0001)).toBe(false);
  });
});
