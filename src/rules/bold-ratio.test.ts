import { describe, expect, it } from 'vitest';
import { boldRatio } from './bold-ratio.js';
import { positions, runRule } from './rules.test-kit.js';

describe('bold-ratio', () => {
  it('scores unbolded prose 1.0', () => {
    expect(runRule(boldRatio, 'Običan pasus bez ijednog podebljanja u njemu.', 'sr').score).toBe(1);
  });

  it('reports the bolded run without its markers', () => {
    const result = runRule(boldRatio, '**bold** ostatak teksta ovde.', 'sr');
    expect(result.findings.map((f) => f.text)).toEqual(['bold']);
  });

  it('reports the position of the bolded text, not of the asterisks', () => {
    expect(positions(runRule(boldRatio, 'Ovo je **bold** tekst.', 'sr'))).toEqual(['1:10']);
  });

  it('counts both Markdown bold forms', () => {
    const result = runRule(boldRatio, '**prvi** i __drugi__ podebljani deo.', 'sr');
    expect(result.findings.map((f) => f.text)).toEqual(['prvi', 'drugi']);
  });

  it('measures characters, not words', () => {
    // Documented divergence: this rule's perThousand is bolded characters per
    // 1000 characters, because bolding is a property of the rendered page.
    const result = runRule(boldRatio, '**abcd**', 'sr');
    expect(result.perThousand).toBe((4 * 1000) / 8);
    expect(result.reason).toContain('per 1000 characters');
  });
});
