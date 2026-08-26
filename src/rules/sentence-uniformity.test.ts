import { describe, expect, it } from 'vitest';
import { runRule } from './rules.test-kit.js';
import { sentenceUniformity } from './sentence-uniformity.js';

describe('sentence-uniformity', () => {
  it('scores mixed rhythm 1.0', () => {
    const text = [
      'Ne.',
      'Upit je bio spor.',
      'Postgres je prestao da koristi indeks nad kolonom status i prešao na sekvencijalno čitanje cele tabele zato što je statistika bila stara.',
      'Ništa se nije promenilo.',
      'Podaci jesu.',
      'Pokrenuo sam analizu nad tabelom i upit se vratio na osamdeset milisekundi bez ijedne izmene u kodu.',
    ].join(' ');
    expect(runRule(sentenceUniformity, text, 'sr').score).toBe(1);
  });

  it('scores identical sentence lengths 0', () => {
    // Low deviation scores badly. This rule runs backwards from the others and
    // the assertion exists to keep anyone from "fixing" it.
    const text = Array.from({ length: 8 }, () => 'Jedan dva tri četiri pet.').join(' ');
    const result = runRule(sentenceUniformity, text, 'sr');
    expect(result.perThousand).toBe(0);
    expect(result.score).toBe(0);
  });

  it('abstains below the minimum sentence count instead of scoring', () => {
    const result = runRule(sentenceUniformity, 'Kratka beleška. Ništa više.', 'sr');
    expect(result.score).toBe(1);
    expect(result.reason).toContain('not measured');
  });

  it('reports no findings, because the defect is the distribution', () => {
    // Every other rule points at a span. This one cannot: no single sentence
    // is guilty of the text being flat, and picking one would be an accusation
    // the measurement does not support.
    const text = Array.from({ length: 8 }, () => 'Jedan dva tri četiri pet.').join(' ');
    expect(runRule(sentenceUniformity, text, 'sr').findings).toEqual([]);
  });

  it('is not fooled by hard-wrapped paragraphs', () => {
    // A lone newline is not a sentence boundary. When it was, this text
    // reported six "sentences" of four words each and a deviation near zero —
    // a measurement of the text editor rather than of the prose.
    const wrapped =
      'Prošle nedelje mi je jedan upit\npočeo da traje četiri sekunde umesto\n' +
      'osamdeset milisekundi. Ništa se nije\npromenilo u kodu. Promenili su se\npodaci.';
    const result = runRule(sentenceUniformity, wrapped, 'sr');
    expect(result.reason).toContain('3 sentences');
  });
});
