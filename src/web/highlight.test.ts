import { describe, expect, it } from 'vitest';
import { escapeHtml, highlight, spansFor } from './highlight.js';
import { check } from '../report.js';

const LONG_SR = Array.from(
  { length: 60 },
  (_, i) => `Upit ${i} je radio sporo pa smo merili trajanje češće u toku dana.`,
).join(' ');

describe('highlighting', () => {
  it('marks a finding at the offset the rule recorded', () => {
    const text = `Stručnjaci kažu da je tako. ${LONG_SR}`;
    const { report } = check(text, { language: 'sr' });
    const html = highlight(text, spansFor(report));
    expect(html.startsWith('<mark class="finding"')).toBe(true);
    expect(html).toContain('>Stručnjaci kažu</mark>');
  });

  it('escapes per fragment, because escaping changes lengths', () => {
    // `&` becomes `&amp;`. Escape the whole string first and every offset
    // after the first ampersand lands somewhere else.
    const text = `A & B. Stručnjaci kažu da je tako. ${LONG_SR}`;
    const { report } = check(text, { language: 'sr' });
    const html = highlight(text, spansFor(report));
    expect(html).toContain('A &amp; B.');
    expect(html).toContain('>Stručnjaci kažu</mark>');
  });

  it('merges overlapping findings into one mark carrying both rules', () => {
    const spans = spansFor({
      language: 'en',
      wordCount: 10,
      score: 1,
      hardFailures: [],
      abstentions: [],
      lexiconVersion: 'x',
      rules: [
        {
          rule: 'a',
          kind: 'density',
          outcome: 'scored',
          score: 1,
          passed: true,
          reason: '',
          findings: [{ text: 'abcdef', offset: 0, line: 1, column: 1 }],
        },
        {
          rule: 'b',
          kind: 'density',
          outcome: 'scored',
          score: 1,
          passed: true,
          reason: '',
          findings: [{ text: 'cd', offset: 2, line: 1, column: 3 }],
        },
      ],
    });
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ start: 0, end: 6, rules: ['a', 'b'] });
  });

  it('marks an abstained rule differently from a scored one', () => {
    // A finding a rule declined to grade is a note, not an accusation, and the
    // page has to be able to say which is which.
    const { report } = check('This is not just a tool but a philosophy.', { language: 'en' });
    const spans = spansFor(report);
    expect(spans.length).toBeGreaterThan(0);
    expect(spans.every((s) => s.observedOnly)).toBe(true);
  });

  it('returns the text untouched when nothing was found', () => {
    expect(highlight('plain text', [])).toBe('plain text');
  });

  it('escapes every HTML metacharacter', () => {
    expect(escapeHtml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#39;');
  });
});
