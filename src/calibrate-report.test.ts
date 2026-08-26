import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatReport,
  observe,
  percentile,
  readCorpus,
  stripFrontmatter,
  verdictFor,
} from './calibrate-report.js';
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

  it('descends one level, so a corpus grouped by language reads as one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'voice-check-corpus-'));
    mkdirSync(join(dir, 'sr'));
    mkdirSync(join(dir, 'en'));
    writeFileSync(join(dir, 'sr', 'a.md'), cleanSerbian());
    writeFileSync(join(dir, 'en', 'b.md'), 'The query ran slowly and nobody noticed. '.repeat(40));
    expect(readCorpus(dir).map((d) => d.name)).toEqual(['en/b.md', 'sr/a.md']);
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

describe('two-corpus separation', () => {
  const band = (accepted: number[], generated: number[]) => ({
    rule: 'r',
    accepted: [...accepted].sort((a, b) => a - b),
    generated: [...generated].sort((a, b) => a - b),
    acceptedExcluded: 0,
    generatedExcluded: 0,
    minWords: 0,
  });

  it('separates when generated densities sit above accepted ones', () => {
    const v = verdictFor(
      band(Array.from({ length: 10 }, (_, i) => i * 0.1), Array.from({ length: 10 }, (_, i) => 5 + i)),
      10,
    );
    expect(v.status).toBe('separates');
    expect(v.margin ?? 0).toBeGreaterThan(0);
  });

  it('reports OVERLAP when no threshold puts nine in ten of each on the right side', () => {
    // A finding about the rule, not a failed run — the same shape as
    // agent-evals discovering its semantic threshold could not classify its
    // own labelled pairs.
    const same = Array.from({ length: 12 }, (_, i) => i);
    const v = verdictFor(band(same, same), 10);
    expect(v.status).toBe('overlaps');
    expect(v.margin ?? 1).toBeLessThanOrEqual(0);
  });

  it('reports the extremes overlapping separately from the percentile band', () => {
    // Two strengths of the same question. The band can separate while the
    // extremes still touch, and a reader should see both.
    const v = verdictFor(
      band([0, 0, 0, 0, 0, 0, 0, 0, 0, 9], [1, 10, 11, 12, 13, 14, 15, 16, 17, 18]),
      10,
    );
    expect(v.status).toBe('separates');
    expect(v.extremesOverlap).toBe(true);
  });

  it('refuses a verdict when either corpus is too small', () => {
    const v = verdictFor(band([1, 2], [8, 9]), 10);
    expect(v.status).toBe('insufficient');
  });

  it('refuses a verdict when a corpus produced no densities at all', () => {
    const v = verdictFor(band([], [8, 9]), 10);
    expect(v.status).toBe('insufficient');
    expect(v.floor).toBeNull();
  });
});

describe('frontmatter', () => {
  it('strips it and reads the provenance out on the way past', () => {
    const raw = '---\nprovenance: generated\nmodel: claude-opus-5\n---\n\nBody text.\n';
    expect(stripFrontmatter(raw)).toEqual({ text: '\nBody text.\n', provenance: 'generated' });
  });

  it('treats a file with no frontmatter as accepted writing', () => {
    expect(stripFrontmatter('Just prose.')).toEqual({ text: 'Just prose.', provenance: 'accepted' });
  });

  it('keeps generated frontmatter out of the prose it labels', () => {
    // It contains a prompt sentence, a model id and a date. Left in, it would
    // add words to every denominator and enter the sentence-length
    // distribution — the corpus measuring its own labels.
    const dir = corpusDir({
      'g.md': '---\nprovenance: generated\nprompt: Write a blog post about bread.\n---\n\n' + cleanSerbian(),
    });
    const doc = readCorpus(dir)[0];
    expect(doc?.provenance).toBe('generated');
    expect(doc?.text).not.toContain('Write a blog post');
  });
});

describe('the report', () => {
  const emptyObs = { sr: [], en: [] } as Readonly<Record<Language, never[]>>;

  it('says plainly when the corpus is too small', () => {
    const docs = readCorpus(corpusDir({ 'a.md': cleanSerbian() }));
    const report = formatReport(docs, { sr: observe(docs, 'sr', LEXICONS), en: [] }, 'corpus');
    expect(report).toContain('Below the 10-document minimum');
    expect(report).toContain('the accepted corpus has 1 document');
  });

  it('states the sample size beside every figure', () => {
    // The reason a percentile from four documents is dangerous: the number
    // looks the same whatever produced it.
    const docs = readCorpus(corpusDir({ 'a.md': cleanSerbian() }));
    const report = formatReport(docs, { sr: observe(docs, 'sr', LEXICONS), en: [] }, 'corpus');
    expect(report).toContain('n=1');
  });

  it('offers no ceiling at all when there is no generated corpus', () => {
    const docs = readCorpus(corpusDir({ 'a.md': cleanSerbian() }));
    const report = formatReport(docs, { sr: observe(docs, 'sr', LEXICONS), en: [] }, 'corpus');
    expect(report).toContain('no generated corpus');
  });

  it('reports both corpora side by side when given both', () => {
    const accepted = readCorpus(corpusDir({ 'a.md': cleanSerbian() }));
    const generated = readCorpus(
      corpusDir({ 'g.md': `---\nprovenance: generated\n---\n\n${cleanSerbian()}` }),
    );
    const report = formatReport(
      accepted,
      { sr: observe(accepted, 'sr', LEXICONS), en: [] },
      'accepted',
      {
        docs: generated,
        dir: 'generated',
        observations: { sr: observe(generated, 'sr', LEXICONS), en: [] },
      },
    );
    expect(report).toContain('implied floor (accepted p90)');
    expect(report).toContain('implied ceiling (generated p10)');
    expect(report).toContain('Generated — machine-written by construction');
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
