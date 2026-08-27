import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { splitSentences } from './sentences.js';
import { emitWorksheet } from './worksheet.js';
import { checkLabels, labelFileSchema, LabelError } from './labels.js';

/* Engineered to look like it has an obvious central claim, obvious evidence and
   obvious hype — so that a generator inclined to be helpful would have somewhere
   to be helpful. */
const LOADED = `Retrying a flaky test hides the failure rather than removing it.

We looked at four repositories and found the median retried test had been
failing one run in nine for over a year.

This is the single most important problem in software engineering today.`;

describe('emitWorksheet', () => {
  const sentences = splitSentences(LOADED);
  const yaml = emitWorksheet({ sourceName: 's.md', language: 'en', sentences });

  /**
   * ADR 021: the labels are what the analyst is measured against, so a label
   * written by a model makes the central measurement a model grading a model.
   * This is the test that says the generator did not help.
   */
  it('emits every mark blank, on a source that invites marking', () => {
    const parsed = parseYaml(yaml) as { entries: { marks: unknown[] }[] };
    expect(parsed.entries.length).toBeGreaterThan(0);
    for (const entry of parsed.entries) {
      expect(entry.marks).toEqual([]);
    }
  });

  it('leaves labelledBy and labelledAt empty for a human to fill', () => {
    const parsed = parseYaml(yaml) as { labelledBy: string; labelledAt: string };
    expect(parsed.labelledBy).toBe('');
    expect(parsed.labelledAt).toBe('');
  });

  it('carries one entry per sentence, in order, with the text verbatim', () => {
    const parsed = parseYaml(yaml) as { entries: { index: number; text: string }[] };
    expect(parsed.entries.map((e) => e.index)).toEqual(sentences.map((s) => s.index));
    expect(parsed.entries.map((e) => e.text)).toEqual(sentences.map((s) => s.text));
  });

  it('states the whole vocabulary in the file', () => {
    /* The labeller has this file open, not a README. */
    for (const token of ['C ', 'E ', 'H ', 'central claim', 'load-bearing', 'hype']) {
      expect(yaml).toContain(token);
    }
  });

  it('round-trips through the schema once marks and metadata are filled in', () => {
    const parsed = parseYaml(yaml) as Record<string, unknown>;
    const filled = {
      ...parsed,
      labelledBy: 'Filip',
      labelledAt: '2026-08-27',
      entries: [{ index: 1, text: sentences[0]?.text, marks: ['C'] }],
    };
    expect(labelFileSchema.safeParse(filled).success).toBe(true);
  });

  it('quotes text so a sentence full of YAML punctuation survives', () => {
    const tricky = splitSentences('A: b #c "d" - e: f.\n\nNext one here.');
    const round = parseYaml(
      emitWorksheet({ sourceName: 's.md', language: 'en', sentences: tricky }),
    ) as { entries: { text: string }[] };
    expect(round.entries.map((e) => e.text)).toEqual(tricky.map((s) => s.text));
  });
});

describe('checkLabels', () => {
  const source = 'Alpha beta gamma. Delta epsilon zeta. Eta theta iota.';
  const sentences = splitSentences(source);
  const good = {
    source: 's.md',
    labelledBy: 'Filip',
    labelledAt: '2026-08-27',
    language: 'en' as const,
    entries: [{ index: 2, text: 'Delta epsilon zeta.', marks: ['E' as const] }],
  };

  it('passes when the text still matches the index', () => {
    expect(() => checkLabels(good, sentences)).not.toThrow();
  });

  /**
   * THE DERIVED-INDEX TRAP, which is the reason the text is stored at all.
   * Simulated by labelling against one split and checking against another —
   * exactly what a splitter edit does. Without the stored text this passes
   * silently and every score afterwards is measured against the wrong sentence.
   */
  it('fails when the sentence at that index has changed', () => {
    const shifted = splitSentences('A new opening sentence. ' + source);
    expect(() => checkLabels(good, shifted)).toThrow(LabelError);
    try {
      checkLabels(good, shifted);
    } catch (error) {
      /* And the message shows both strings, because "hash mismatch" would tell
         a human nothing about what moved. */
      expect((error as Error).message).toContain('has moved');
      expect((error as Error).message).toContain('Delta epsilon zeta.');
    }
  });

  it('fails when the index no longer exists', () => {
    expect(() => checkLabels({ ...good, entries: [{ index: 99, text: 'x', marks: ['C'] }] }, sentences)).toThrow(
      LabelError,
    );
  });

  it('fails on a duplicated index rather than silently taking one', () => {
    const dup = {
      ...good,
      entries: [
        { index: 2, text: 'Delta epsilon zeta.', marks: ['E' as const] },
        { index: 2, text: 'Delta epsilon zeta.', marks: ['H' as const] },
      ],
    };
    expect(() => checkLabels(dup, sentences)).toThrow(/twice/u);
  });

  /**
   * An unfilled worksheet is not a label file. Scoring one would make an
   * unlabelled source and a source with nothing worth marking produce identical
   * numbers, and only one of those is a measurement.
   */
  it('refuses a worksheet nobody has filled in', () => {
    expect(() => checkLabels({ ...good, entries: [] }, sentences)).toThrow(/no marks/u);
  });

  it('refuses a worksheet where every entry is present but blank', () => {
    /* The shape a returned-but-untouched worksheet actually has, now that
       blank entries are kept rather than deleted. */
    const untouched = {
      ...good,
      entries: sentences.map((s) => ({ index: s.index, text: s.text, marks: [] })),
    };
    expect(() => checkLabels(untouched, sentences)).toThrow(/no marks/u);
  });

  it('accepts blank entries alongside marked ones', () => {
    const mixed = {
      ...good,
      entries: sentences.map((s) => ({
        index: s.index,
        text: s.text,
        marks: s.index === 2 ? (['E'] as const).slice() : [],
      })),
    };
    expect(() => checkLabels(mixed, sentences)).not.toThrow();
  });

  /**
   * The reason blank entries are worth keeping rather than merely tolerated:
   * they extend the integrity check to sentences nobody marked. A splitter
   * change that shifts an unmarked sentence is caught here, before it can shift
   * a marked one on the next edit.
   */
  it('checks the stored text of unmarked entries too', () => {
    const mixed = {
      ...good,
      entries: [
        { index: 1, text: 'THIS IS NOT WHAT SENTENCE 1 SAYS', marks: [] },
        { index: 2, text: 'Delta epsilon zeta.', marks: ['E' as const] },
      ],
    };
    expect(() => checkLabels(mixed, sentences)).toThrow(/has moved/u);
  });
});
