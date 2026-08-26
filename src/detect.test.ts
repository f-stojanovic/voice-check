import { describe, expect, it } from 'vitest';
import { detectLanguage } from './detect.js';
import { check } from './report.js';

describe('language auto-detection', () => {
  it('calls text with Serbian diacritics Serbian', () => {
    const detection = detectLanguage('Upit je počeo da traje četiri sekunde.');
    expect(detection.language).toBe('sr');
    expect(detection.basis).toContain('diacritics');
  });

  it('calls English text English', () => {
    expect(detectLanguage('The query got slower and nobody noticed it.').language).toBe('en');
  });

  it('falls back to a stopword vote and records the counts', () => {
    const detection = detectLanguage('Ovo je tekst koji nema nijedno slovo sa kvakicom na sebi.');
    expect(detection.language).toBe('sr');
    expect(detection.basis).toMatch(/stopword vote sr=\d+ en=\d+/);
  });

  it('breaks a tie towards English, so the wrong answer is obvious', () => {
    expect(detectLanguage('xxx yyy zzz').language).toBe('en');
  });

  it('fails loudly when it does get stripped Serbian right', () => {
    // The documented failure mode. If the vote is right, `diacritics` — a hard
    // rule — fails the text immediately. There is no path where stripped
    // Serbian quietly scores well, which is the only outcome that would matter.
    const stripped = Array.from(
      { length: 12 },
      () => 'Ovo je tekst koji nema nijedno slovo sa kvakicom.',
    ).join(' ');
    const detection = detectLanguage(stripped);
    expect(detection.language).toBe('sr');
    const { report } = check(stripped, { language: detection.language });
    expect(report.hardFailures).toContain('diacritics');
  });
});
