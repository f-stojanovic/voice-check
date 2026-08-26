import { describe, expect, it } from 'vitest';
import { positions, runOnPadded, scored } from './rules.test-kit.js';
import { ruleOfThree } from './rule-of-three.js';

describe('rule-of-three', () => {
  it('scores a two-item list 1.0', () => {
    expect(scored(runOnPadded(ruleOfThree, 'Dva podešavanja umesto jednog, i oba rade.', 'sr')).score).toBe(1);
  });

  it('counts one Serbian tricolon', () => {
    const result = runOnPadded(ruleOfThree, 'Treba nam znanje, alat i vreme.', 'sr');
    expect(result.findings.length).toBe(1);
  });

  it('reports the position of the tricolon it matched', () => {
    const text = ['Uvodna rečenica.', 'Treba nam znanje, alat i vreme.'].join('\n');
    expect(positions(runOnPadded(ruleOfThree, text, 'sr'))).toEqual(['2:1']);
  });

  it('counts multi-word items in an English tricolon', () => {
    const text = 'They empower their teams, leverage their data, and build a culture.';
    expect(runOnPadded(ruleOfThree, text, 'en').findings.length).toBe(1);
  });
});
