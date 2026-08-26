import { describe, expect, it } from 'vitest';
import { positions, runRule } from './rules.test-kit.js';
import { verbalAdverbClose } from './verbal-adverb-close.js';

describe('verbal-adverb-close', () => {
  it('scores prose that does not trail off 1.0', () => {
    expect(runRule(verbalAdverbClose, 'Pokrenuo sam analizu nad tabelom.', 'sr').score).toBe(1);
  });

  it('counts exactly the sentence-closing verbal adverbs', () => {
    const text = 'Ćutali smo, slušajući. Radili smo dalje, ne odustajući.';
    expect(runRule(verbalAdverbClose, text, 'sr').findings.length).toBe(2);
  });

  it('reports the position of the closing adverb', () => {
    expect(positions(runRule(verbalAdverbClose, 'Ćutali smo, slušajući.', 'sr'))).toEqual(['1:13']);
  });

  it('ignores a verbal adverb in the middle of a sentence', () => {
    // The complaint is the cadence of a clause bolted to the end, not the
    // construction itself.
    const text = 'Slušajući pažljivo, shvatio sam gde je problem.';
    expect(runRule(verbalAdverbClose, text, 'sr').findings).toEqual([]);
  });

  it('also fires on a sentence-final infinitive in -ći, which is known noise', () => {
    // `-ći` is the infinitive ending as well as a verbal-adverb ending. The
    // guide names `-ći` explicitly, so it stays in and the noise is reported
    // rather than silently narrowed away.
    const result = runRule(verbalAdverbClose, 'Ovo je teško reći.', 'sr');
    expect(result.findings.map((f) => f.text)).toEqual(['reći']);
  });
});
