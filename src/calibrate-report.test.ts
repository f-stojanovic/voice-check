import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatReport, observe, percentile, readCorpus } from './calibrate-report.js';
import { loadLexicon } from './lexicon.js';
import type { Language } from './types.js';

const LEXICONS = { sr: loadLexicon('sr'), en: loadLexicon('en') } as const;

/** A long, clean Serbian document — long enough for every rule's gate. */
function cleanSerbian(sentences = 60): string {
  return Array.from(
    { length: sentences },
    (_, i) => `Upit ${i} je radio sporo pa smo merili trajanje češće u toku dana.`,
  ).join(' ');
}

function corpusDir(files: Readonly<Record<string, string>>): string {
  const dir = mkdtempSync(join(tmpdir(), 'voice-check-corpus-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

describe('reading a corpus', () => {
  it('reads markdown and text, and skips everything else', () => {
    const dir = corpusDir({
      'a.md': cleanSerbian(),
      'b.txt': cleanSerbian(),
      'c.json': '{"not": "prose"}',
      'd.md': '   ',
    });
    expect(readCorpus(dir).map((d) => d.name)).toEqual(['a.md', 'b.txt']);
  });

  it('detects the language of each document independently', () => {
    const dir = corpusDir({
      'sr.md': cleanSerbian(),
      'en.md': 'The query ran slowly and nobody noticed it for a week. '.repeat(30),
    });
    const byName = new Map(readCorpus(dir).map((d) => [d.name, d.language]));
    expect(byName.get('sr.md')).toBe('sr');
    expect(byName.get('en.md')).toBe('en');
  });

  it('says which directory it could not read', () => {
    expect(() => readCorpus('/nonexistent-corpus/')).toThrow(/cannot read/);
  });
});

describe('observing densities', () => {
  it('records one density per document a rule could measure', () => {
    const docs = readCorpus(corpusDir({ 'a.md': cleanSerbian(), 'b.md': cleanSerbian() }));
    const rows = observe(docs, 'sr', LEXICONS);
    const weasel = rows.find((r) => r.rule === 'weasel-words');
    expect(weasel?.densities).toEqual([0, 0]);
    expect(weasel?.tooShort).toEqual([]);
  });

  it('counts an abstention as an exclusion rather than as a zero', () => {
    // A zero would be a measurement: "this text contains no weasel words".
    // A short text supports no such claim, and averaging its absent density in
    // as 0 would drag every floor down.
    const docs = readCorpus(corpusDir({ 'short.md': 'Kratka beleška o upitu. Ništa više.' }));
    const weasel = observe(docs, 'sr', LEXICONS).find((r) => r.rule === 'weasel-words');
    expect(weasel?.densities).toEqual([]);
    expect(weasel?.tooShort).toEqual(['short.md']);
  });

  it('reports the gate the rule itself applied', () => {
    // Not recomputed here. An earlier version recovered it by string-matching
    // a constant id, missed `density.phrase-ceiling`, and silently used 0.
    const docs = readCorpus(corpusDir({ 'short.md': 'Kratka beleška.' }));
    const rows = observe(docs, 'sr', LEXICONS);
    expect(rows.find((r) => r.rule === 'weasel-words')?.minWords).toBe(167);
    expect(rows.find((r) => r.rule === 'negative-parallelism')?.minWords).toBe(334);
  });

  it('ignores documents in the other language', () => {
    const docs = readCorpus(
      corpusDir({ 'en.md': 'The query ran slowly and nobody noticed. '.repeat(40) }),
    );
    for (const row of observe(docs, 'sr', LEXICONS)) {
      expect(row.densities).toEqual([]);
      expect(row.tooShort).toEqual([]);
    }
  });
});

describe('percentiles', () => {
  it('interpolates between neighbours', () => {
    expect(percentile([0, 10], 0.5)).toBe(5);
    expect(percentile([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 0.9)).toBeCloseTo(8.1, 10);
  });

  it('returns the single value for a one-element sample', () => {
    expect(percentile([3], 0.9)).toBe(3);
  });
});

describe('the report', () => {
  const emptyObs = { sr: [], en: [] } as Readonly<Record<Language, never[]>>;

  it('says plainly when the corpus is too small', () => {
    const docs = readCorpus(corpusDir({ 'a.md': cleanSerbian() }));
    const report = formatReport(docs, { sr: observe(docs, 'sr', LEXICONS), en: [] }, 'corpus');
    expect(report).toContain('too small to calibrate anything');
    expect(report).toContain('1 document against a minimum of 10');
  });

  it('states the sample size beside every figure', () => {
    // C4's requirement, and the reason a percentile from four documents is
    // dangerous: the number looks the same whatever produced it.
    const docs = readCorpus(corpusDir({ 'a.md': cleanSerbian() }));
    const report = formatReport(docs, { sr: observe(docs, 'sr', LEXICONS), en: [] }, 'corpus');
    expect(report).toContain('n=1, too few');
    expect(report).not.toMatch(/\| p90 \| max \| implied floor \| implied ceiling \|\n.*\| 0\.90 \|/);
  });

  it('never derives a ceiling, and says why', () => {
    const docs = readCorpus(corpusDir({ 'a.md': cleanSerbian() }));
    const report = formatReport(docs, { sr: observe(docs, 'sr', LEXICONS), en: [] }, 'corpus');
    expect(report).toContain('not derivable');
    expect(report).toContain('needs a second corpus');
  });

  it('states that it wrote nothing', () => {
    // A tool that tunes its own thresholds against a corpus it also scores
    // converges on "this writing is perfect", which is true by construction.
    const docs = readCorpus(corpusDir({ 'a.md': cleanSerbian() }));
    const report = formatReport(docs, { sr: observe(docs, 'sr', LEXICONS), en: [] }, 'corpus');
    expect(report).toContain('Nothing here has been written to any file');
  });

  it('handles an empty corpus without pretending to have measured one', () => {
    expect(formatReport([], emptyObs, 'corpus')).toContain('No readable documents found');
  });
});
