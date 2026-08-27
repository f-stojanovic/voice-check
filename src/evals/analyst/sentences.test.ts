import { describe, expect, it } from 'vitest';
import { sentenceAt, sentencesIn, splitSentences } from './sentences.js';

/** Every sentence's offsets must slice back to its own text. If this holds,
 *  the labels can be trusted to point where they say they point. */
function offsetsAreSound(source: string): boolean {
  return splitSentences(source).every((s) => source.slice(s.start, s.end) === s.text);
}

describe('splitSentences', () => {
  it('splits on terminators and numbers from one', () => {
    const s = splitSentences('Alpha beta. Gamma delta! Epsilon?');
    expect(s.map((x) => x.text)).toEqual(['Alpha beta.', 'Gamma delta!', 'Epsilon?']);
    expect(s.map((x) => x.index)).toEqual([1, 2, 3]);
  });

  it('records offsets that slice back to the sentence', () => {
    const source = 'Alpha beta. Gamma delta! Epsilon?';
    for (const s of splitSentences(source)) {
      expect(source.slice(s.start, s.end)).toBe(s.text);
    }
  });

  it('keeps a trailing fragment with no terminator', () => {
    /* A heading, a list item, a truncated excerpt. Dropping it would make the
       last line of many sources unlabellable, silently. */
    const s = splitSentences('Alpha beta. A heading with no full stop');
    expect(s.map((x) => x.text)).toEqual(['Alpha beta.', 'A heading with no full stop']);
  });

  it('treats a blank line as a boundary even with no terminator', () => {
    const s = splitSentences('# A Heading\n\nSome body text.');
    expect(s.map((x) => x.text)).toEqual(['# A Heading', 'Some body text.']);
    expect(offsetsAreSound('# A Heading\n\nSome body text.')).toBe(true);
  });

  describe('does not split where a period is not a terminator', () => {
    it.each([
      ['an English abbreviation', 'Compare e.g. this case to that one. Next.', 2],
      ['a Serbian abbreviation', 'Koristi npr. ovaj primer u tekstu. Dalje.', 2],
      ['itd. mid-sentence', 'Ima mnogo primera itd. i to je u redu. Kraj.', 2],
      ['an initial', 'Written by J. Smith last year. Next.', 2],
      ['a decimal', 'The margin was 0.392 in that run. Next.', 2],
      ['a version string', 'Node 22.22.1 is installed here. Next.', 2],
    ])('%s', (_label, source, expected) => {
      expect(splitSentences(source)).toHaveLength(expected);
    });

    /**
     * THE SERBIAN ORDINAL, which is the rule most likely to be wrong and the
     * reason the splitter fails toward merging. `27. avgusta` is a date, not
     * two sentences. The cost of this rule is that a real sentence ending in a
     * digit runs into the next one — visible in the worksheet as one long
     * numbered line, which is the failure mode that can be seen.
     */
    it('a Serbian ordinal date', () => {
      const s = splitSentences('Objavljeno je 27. avgusta ove godine. Sledeća rečenica.');
      expect(s).toHaveLength(2);
      expect(s[0]?.text).toBe('Objavljeno je 27. avgusta ove godine.');
    });

    it('a numbered list item', () => {
      const s = splitSentences('1. Prvi korak je jednostavan. 2. Drugi je teži.');
      expect(s.every((x) => x.text.length > 3)).toBe(true);
    });
  });

  it('splits on ! and ? even after a digit', () => {
    /* Only `.` is ambiguous; the merge rules must not leak to the others. */
    expect(splitSentences('Bilo ih je 5! Zatim još.')).toHaveLength(2);
  });

  it('keeps offsets sound on hard-wrapped Serbian with diacritics', () => {
    const source =
      'Timovi dodaju ponavljanja umesto da poprave\nnepouzdane testove. To je čest\nproblem u praksi.';
    expect(offsetsAreSound(source)).toBe(true);
    expect(splitSentences(source)).toHaveLength(2);
  });

  it('produces nothing for an empty or whitespace source', () => {
    expect(splitSentences('')).toEqual([]);
    expect(splitSentences('   \n\n  ')).toEqual([]);
  });

  it('is deterministic', () => {
    const source = 'Alpha. Beta npr. gamma. 27. avgusta.\n\nDelta?';
    expect(splitSentences(source)).toEqual(splitSentences(source));
  });
});

describe('sentenceAt', () => {
  const source = 'Alpha beta. Gamma delta. Epsilon zeta.';
  const sentences = splitSentences(source);

  it('finds the sentence containing an offset', () => {
    expect(sentenceAt(sentences, source.indexOf('Gamma'))?.index).toBe(2);
    expect(sentenceAt(sentences, source.indexOf('Epsilon'))?.index).toBe(3);
  });

  it('returns undefined for an offset in the gap between sentences', () => {
    /* The space after "Alpha beta." belongs to no sentence. Reporting a
       neighbour here would attribute a quote to a sentence it does not touch. */
    expect(sentenceAt(sentences, source.indexOf('Gamma') - 1)).toBeUndefined();
  });
});

describe('sentencesIn', () => {
  const source = 'Alpha beta. Gamma delta. Epsilon zeta.';
  const sentences = splitSentences(source);

  it('returns every sentence a span touches', () => {
    /* A quote is free to cross a boundary — nothing in analyst.ts forbids it —
       so the mapping has to report both rather than pick one. */
    const start = source.indexOf('beta');
    const end = source.indexOf('delta') + 'delta'.length;
    expect(sentencesIn(sentences, start, end).map((s) => s.index)).toEqual([1, 2]);
  });

  it('returns one sentence for a span inside it', () => {
    const start = source.indexOf('Gamma');
    expect(sentencesIn(sentences, start, start + 5).map((s) => s.index)).toEqual([2]);
  });
});
