import { describe, expect, it } from 'vitest';
import { boldRatio } from './bold-ratio.js';
import { pad, positions, runOnPadded, runRule, scored } from './rules.test-kit.js';

describe('bold-ratio', () => {
  it('scores unbolded prose 1.0', () => {
    expect(scored(runOnPadded(boldRatio, 'Običan pasus bez ijednog podebljanja u njemu.', 'sr')).score).toBe(1);
  });

  it('reports the bolded run without its markers', () => {
    const result = runOnPadded(boldRatio, '**bold** ostatak teksta ovde.', 'sr');
    expect(result.findings.map((f) => f.text)).toEqual(['bold']);
  });

  it('reports the position of the bolded text, not of the asterisks', () => {
    expect(positions(runOnPadded(boldRatio, 'Ovo je **bold** tekst.', 'sr'))).toEqual(['1:10']);
  });

  it('counts both Markdown bold forms', () => {
    const result = runOnPadded(boldRatio, '**prvi** i __drugi__ podebljani deo.', 'sr');
    expect(result.findings.map((f) => f.text)).toEqual(['prvi', 'drugi']);
  });

  it('measures characters, not words', () => {
    // Documented divergence: this rule's perThousand is bolded characters per
    // 1000 characters, because bolding is a property of the rendered page.
    // The fixture is padded to a measurable length, so the expected ratio is
    // computed against the padded text rather than hard-coded.
    const text = pad('**abcd**', 'sr');
    const result = scored(runRule(boldRatio, text, 'sr'));
    expect(scored(result).perThousand).toBe((4 * 1000) / text.length);
    expect(result.reason).toContain('per 1000 characters');
  });

  it('does not gate on word count, because its denominator is characters', () => {
    // The derived gate answers "how long before one OCCURRENCE stops
    // dominating the rate". A bolded run is not a unit of that kind, and a
    // ratio of characters to characters is measurable at almost any length.
    const result = runRule(boldRatio, 'Ovo je **bold** tekst.', 'sr');
    expect(result.outcome).toBe('scored');
  });
});
