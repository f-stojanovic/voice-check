import { describe, expect, it } from 'vitest';
import { formalAddress } from './formal-address.js';
import { positions, runRule, scored } from './rules.test-kit.js';

describe('formal-address', () => {
  it('passes text that addresses the reader as "ti"', () => {
    const result = runRule(formalAddress, 'Molim te da pošalješ izveštaj.', 'sr');
    expect(scored(result).passed).toBe(true);
    expect(scored(result).score).toBe(1);
  });

  it('fails on a single mid-sentence formal pronoun', () => {
    const result = runRule(formalAddress, 'Molim Vas da pošaljete izveštaj.', 'sr');
    expect(result.findings.length).toBe(1);
    expect(scored(result).passed).toBe(false);
    expect(scored(result).score).toBe(0);
  });

  it('reports the exact position of the pronoun', () => {
    expect(positions(runRule(formalAddress, 'Molim Vas da pošaljete.', 'sr'))).toEqual(['1:7']);
  });

  it('counts the whole paradigm', () => {
    const text = 'Rekao sam Vam da je Vaš izveštaj kod Vas.';
    expect(runRule(formalAddress, text, 'sr').findings.map((f) => f.text)).toEqual([
      'Vam',
      'Vaš',
      'Vas',
    ]);
  });

  it('ignores a capital that merely starts a sentence', () => {
    // `Vi` opening a sentence is a capital letter doing its job, and cannot be
    // told from the formal pronoun without parsing.
    expect(runRule(formalAddress, 'Vi ste u pravu. Vas dvoje ste stigli.', 'sr').findings).toEqual([]);
  });

  it('ignores a capital opening a line', () => {
    const text = ['Prva rečenica bez tačke', 'Vas dvoje ste stigli.'].join('\n');
    expect(runRule(formalAddress, text, 'sr').findings).toEqual([]);
  });
});
