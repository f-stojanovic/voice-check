import { describe, expect, it } from 'vitest';
import { emDashDensity } from './em-dash-density.js';
import { positions, runOnPadded, scored } from './rules.test-kit.js';

describe('em-dash-density', () => {
  it('scores prose with no em dashes 1.0', () => {
    expect(scored(runOnPadded(emDashDensity, 'Kod je bio isti mesec dana.', 'sr')).score).toBe(1);
  });

  it('counts exactly the em dashes present', () => {
    expect(runOnPadded(emDashDensity, 'Prvi — drugi — treći — kraj.', 'sr').findings.length).toBe(3);
  });

  it('reports the position of the first em dash', () => {
    expect(positions(runOnPadded(emDashDensity, 'Prvi — drugi.', 'sr'))).toEqual(['1:6']);
  });

  it('ignores en dashes and hyphens', () => {
    // An en dash is a range and a hyphen is a hyphen. Only U+2014 is counted.
    expect(runOnPadded(emDashDensity, 'Strane 10–20 su dobro-poznate.', 'sr').findings.length).toBe(0);
  });
});
