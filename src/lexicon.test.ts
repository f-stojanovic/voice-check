import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LexiconError, lexiconIdentity, loadLexicon, parseLexicon } from './lexicon.js';

const GOOD = `
version: "0.1.0"
language: sr
phrases:
  weasel-words:
    - stručnjaci kažu
patterns:
  negative-parallelism:
    - nije[^.]{0,20}već
`;

describe('lexicon loading', () => {
  it('loads the shipped Serbian and English lexicons', () => {
    for (const language of ['sr', 'en'] as const) {
      const lexicon = loadLexicon(language);
      expect(lexicon.language).toBe(language);
      expect(Object.keys(lexicon.phrases).length).toBeGreaterThan(0);
    }
  });

  it('rejects malformed YAML with the file name in the message', () => {
    expect(() => parseLexicon('version: "1"\n  language: sr\n bad', 'lexicons/sr.yaml')).toThrow(
      LexiconError,
    );
    expect(() => parseLexicon('version: "1"\n  language: sr\n bad', 'lexicons/sr.yaml')).toThrow(
      /lexicons\/sr\.yaml/,
    );
  });

  it('names the exact path of a schema violation', () => {
    // A misspelt key silently becomes an empty phrase list, and an empty phrase
    // list scores every text a clean 1.0 — the failure where the tool reports
    // that everything is fine because it stopped looking.
    const bad = 'version: "0.1.0"\nlanguage: klingon\nphrases: {}\n';
    expect(() => parseLexicon(bad, 'x.yaml')).toThrow(/at language:/);
  });

  it('rejects a phrase list that is empty rather than accepting a rule that measures nothing', () => {
    const bad = 'version: "0.1.0"\nlanguage: sr\nphrases:\n  weasel-words: []\n';
    expect(() => parseLexicon(bad, 'x.yaml')).toThrow(/at phrases.weasel-words/);
  });

  it('rejects an uncompilable pattern and quotes it back', () => {
    const bad = 'version: "0.1.0"\nlanguage: sr\npatterns:\n  rule-of-three:\n    - "a(b"\n';
    expect(() => parseLexicon(bad, 'x.yaml')).toThrow(/patterns\.rule-of-three\[0\]/);
    expect(() => parseLexicon(bad, 'x.yaml')).toThrow(/source: a\(b/);
  });

  it('changes the content hash when a phrase is added', () => {
    const before = parseLexicon(GOOD, 'a.yaml');
    const after = parseLexicon(GOOD.replace('    - stručnjaci kažu', '    - stručnjaci kažu\n    - mnogi smatraju'), 'a.yaml');
    expect(after.contentHash).not.toBe(before.contentHash);
  });

  it('does not change the content hash when keys are merely reordered', () => {
    // Reordering the YAML for readability is not a content change. Reordering a
    // phrase list is, and that is why arrays keep their order in the hash.
    const reordered = `
language: sr
version: "0.1.0"
patterns:
  negative-parallelism:
    - nije[^.]{0,20}već
phrases:
  weasel-words:
    - stručnjaci kažu
`;
    expect(parseLexicon(reordered, 'a.yaml').contentHash).toBe(
      parseLexicon(GOOD, 'a.yaml').contentHash,
    );
  });

  it('changes the content hash when only the declared version moves', () => {
    const bumped = parseLexicon(GOOD.replace('0.1.0', '0.2.0'), 'a.yaml');
    expect(bumped.contentHash).not.toBe(parseLexicon(GOOD, 'a.yaml').contentHash);
  });

  it('renders an identity that carries both the declared version and the hash', () => {
    const lexicon = parseLexicon(GOOD, 'a.yaml');
    expect(lexiconIdentity(lexicon)).toBe(`0.1.0+${lexicon.contentHash.slice(0, 12)}`);
  });

  it('refuses a file whose declared language contradicts how it was loaded', () => {
    // Otherwise `sr.yaml` could hold English phrases and every Serbian text
    // would score a clean 1.0 with nothing to show for it.
    const dir = mkdtempSync(join(tmpdir(), 'voice-check-'));
    writeFileSync(join(dir, 'sr.yaml'), 'version: "0.1.0"\nlanguage: en\nphrases:\n  weasel-words:\n    - experts say\n');
    expect(() => loadLexicon('sr', `${dir}/`)).toThrow(/declares language "en"/);
  });

  it('says which file it could not read', () => {
    expect(() => loadLexicon('sr', '/nonexistent-dir/')).toThrow(/cannot read lexicon for "sr"/);
  });
});
