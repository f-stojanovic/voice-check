import { describe, expect, it } from 'vitest';
import { countWords, findMatches, positionAt, lineStarts, sentences, standardDeviation } from './text.js';

describe('word counting', () => {
  it('treats Serbian diacritics as letters', () => {
    // `\w` is [A-Za-z0-9_] and would split `ključan` into two words, making
    // every Serbian density wrong in a way that still looks plausible.
    expect(countWords('ključan čas šešir')).toBe(3);
  });

  it('does not count Markdown syntax as words', () => {
    expect(countWords('- **bold** text')).toBe(2);
  });
});

describe('positions', () => {
  const text = 'prvi red\ndrugi red\ntreći red';
  const starts = lineStarts(text);

  it('reports 1-based line and column', () => {
    expect(positionAt(0, starts)).toEqual({ line: 1, column: 1 });
    expect(positionAt(9, starts)).toEqual({ line: 2, column: 1 });
    expect(positionAt(13, starts)).toEqual({ line: 2, column: 5 });
  });

  it('keeps the offset a 0-based index into the original string', () => {
    const [finding] = findMatches(text, /treći/gu);
    expect(finding).toBeDefined();
    expect(text.slice(finding?.offset ?? 0, (finding?.offset ?? 0) + 5)).toBe('treći');
    expect(finding?.line).toBe(3);
    expect(finding?.column).toBe(1);
  });

  it('points at the named `hit` group when the pattern has one', () => {
    const [finding] = findMatches('xx **bold** yy', /\*\*(?<hit>[^*]+)\*\*/gu);
    expect(finding?.text).toBe('bold');
    expect(finding?.column).toBe(6);
  });
});

describe('sentence splitting', () => {
  it('does not treat a soft line break as a sentence end', () => {
    const wrapped = 'Prošle nedelje mi je jedan upit\npočeo da traje četiri sekunde.';
    expect(sentences(wrapped).length).toBe(1);
  });

  it('treats a blank line as a boundary', () => {
    expect(sentences('prvi pasus\n\ndrugi pasus').length).toBe(2);
  });

  it('treats a list item as its own unit of rhythm', () => {
    expect(sentences('- prvi\n- drugi\n- treći').length).toBe(3);
  });
});

describe('standardDeviation', () => {
  it('is 0 for identical values and for a single value', () => {
    expect(standardDeviation([5, 5, 5, 5])).toBe(0);
    expect(standardDeviation([5])).toBe(0);
  });

  it('is the population standard deviation', () => {
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });
});
