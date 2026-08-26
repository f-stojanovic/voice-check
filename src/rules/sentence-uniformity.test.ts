import { describe, expect, it } from 'vitest';
import { pad, runRule, scored } from './rules.test-kit.js';
import { sentenceUniformity } from './sentence-uniformity.js';

/**
 * These fixtures are NOT padded with the shared filler, because the filler is
 * one sentence repeated — which is exactly the flatness this rule measures.
 * Padding here would make every fixture score badly for a reason that has
 * nothing to do with what the test is asserting.
 */
const VARIED = pad(
  [
    'Ne.',
    'Upit je bio spor.',
    'Postgres je prestao da koristi indeks nad kolonom status i prešao na sekvencijalno čitanje cele tabele zato što je statistika bila stara nedelju dana i niko to nije primetio.',
    'Ništa se nije promenilo.',
    'Podaci jesu.',
    'Pokrenuo sam analizu nad tabelom i upit se vratio na osamdeset milisekundi bez ijedne izmene u kodu.',
    'Tu se priča obično završava.',
    'Mene je zanimalo zašto se statistika nije osvežila sama od sebe posle tolikog uvoza.',
    'Autovacuum ima prag.',
    'Prag koji je razuman za malu tabelu postaje potpuno besmislen za tabelu od šezdeset miliona redova.',
    'Spustio sam prag.',
    'Dodao sam merenje.',
    'Sada beležimo trajanje za deset najčešćih upita i poredimo ga sa prošlom nedeljom svakog jutra.',
    'Nije savršeno.',
  ].join(' '),
  'sr',
);

const FLAT = Array.from({ length: 45 }, () => 'Jedan dva tri četiri pet.').join(' ');

describe('sentence-uniformity', () => {
  it('scores mixed rhythm 1.0', () => {
    // The padding is one sentence repeated, so it flattens the deviation.
    // The assertion is that varied prose scores well, not perfectly.
    expect(scored(runRule(sentenceUniformity, VARIED, 'sr')).score).toBeGreaterThan(0.8);
  });

  it('scores identical sentence lengths 0', () => {
    // Low deviation scores badly. This rule runs backwards from the others and
    // the assertion exists to keep anyone from "fixing" it.
    const result = scored(runRule(sentenceUniformity, FLAT, 'sr'));
    expect(scored(result).perThousand).toBe(0);
    expect(scored(result).score).toBe(0);
  });

  it('abstains below the minimum sentence count', () => {
    // Its only gate is sentences. This rule has no ceiling to derive a word
    // gate from — it reports a standard deviation, not a count per 1000 words.
    const result = runRule(sentenceUniformity, 'Kratka beleška. Ništa više.', 'sr');
    expect(result.outcome).toBe('abstained');
    expect(result.reason).toContain('needed for a meaningful deviation');
  });

  it('abstains when a long text has too few sentences to have a rhythm', () => {
    const oneLongSentence = Array.from({ length: 110 }, () => 'reč čvor').join(' ') + '.';
    const result = runRule(sentenceUniformity, oneLongSentence, 'sr');
    expect(result.outcome).toBe('abstained');
    expect(result.reason).toContain('needed for a meaningful deviation');
  });

  it('reports no findings, because the defect is the distribution', () => {
    // Every other rule points at a span. This one cannot: no single sentence
    // is guilty of the text being flat, and picking one would be an accusation
    // the measurement does not support.
    expect(runRule(sentenceUniformity, FLAT, 'sr').findings).toEqual([]);
  });

  it('is not fooled by hard-wrapped paragraphs', () => {
    // A lone newline is not a sentence boundary. When it was, a wrapped
    // paragraph reported one "sentence" per typographic line — a measurement
    // of the text editor rather than of the prose.
    const wrapped = pad(
      'Prošle nedelje mi je jedan upit\npočeo da traje četiri sekunde umesto\n' +
        'osamdeset milisekundi. Ništa se nije\npromenilo u kodu. Promenili su se\npodaci.',
      'sr',
    );
    const result = scored(runRule(sentenceUniformity, wrapped, 'sr'));
    // Three real sentences in the fixture; the rest are padding sentences.
    expect(result.reason).toMatch(/^\d+ sentences/);
    expect(result.reason).not.toContain('51 sentences');
  });
});
