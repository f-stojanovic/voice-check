import { describe, expect, it } from 'vitest';
import { positions, runOnPadded, scored } from './rules.test-kit.js';
import { verbalAdverbClose } from './verbal-adverb-close.js';

describe('verbal-adverb-close', () => {
  it('scores prose that does not trail off 1.0', () => {
    expect(scored(runOnPadded(verbalAdverbClose, 'Pokrenuo sam analizu nad tabelom.', 'sr')).score).toBe(1);
  });

  it('counts exactly the sentence-closing verbal adverbs', () => {
    const text = 'Ćutali smo, slušajući. Radili smo dalje, ne odustajući.';
    expect(runOnPadded(verbalAdverbClose, text, 'sr').findings.length).toBe(2);
  });

  it('reports the position of the closing adverb', () => {
    expect(positions(runOnPadded(verbalAdverbClose, 'Ćutali smo, slušajući.', 'sr'))).toEqual(['1:13']);
  });

  it('ignores a verbal adverb in the middle of a sentence', () => {
    // The complaint is the cadence of a clause bolted to the end, not the
    // construction itself.
    const text = 'Slušajući pažljivo, shvatio sam gde je problem.';
    expect(runOnPadded(verbalAdverbClose, text, 'sr').findings).toEqual([]);
  });

  it('no longer fires on a sentence-final infinitive in -ći', () => {
    // `-ći` is the infinitive ending as well as a verbal-adverb ending, and
    // day one reported this as the survey's second false positive. It had
    // nowhere to be fixed: the rule is a regex with no lexicon entry to hang
    // an exception on. The `exceptions:` block in the lexicon is that seam.
    const result = runOnPadded(verbalAdverbClose, 'Ovo je teško reći.', 'sr');
    expect(result.findings.map((f) => f.text)).toEqual([]);
  });

  it('still fires on a real verbal adverb, so the exceptions are narrow', () => {
    const result = runOnPadded(verbalAdverbClose, 'Ćutali smo, slušajući.', 'sr');
    expect(result.findings.map((f) => f.text)).toEqual(['slušajući']);
  });
});
