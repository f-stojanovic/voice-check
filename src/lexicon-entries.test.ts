/**
 * The tests that keep the lexicon honest.
 *
 * Two entries shipped on day one matching nothing: `neverovatn*` and
 * `spektakularn*`, both broken on the Serbian fleeting `a`. The lists looked
 * full. Every report they appeared in was clean for the wrong reason, and
 * nothing in the tool distinguished an entry that found nothing from an entry
 * that looked and approved — the same failure this project exists to catch,
 * reproduced inside its own data.
 *
 * Day two gave every entry an example it must fire on. Day three found that
 * insufficient: an example in the wrong grammatical form passes against a
 * broken stem. `spektakular*` with only `spektakularne` as its example is
 * satisfied just as happily by `spektakularn*` — the very entry the examples
 * exist to catch. So a stemmed entry must now carry examples that PIN THE
 * STEM, and that is mechanically checkable: if the matched forms share a
 * prefix longer than the declared stem, a longer stem would also pass and the
 * examples prove nothing.
 */

import { describe, expect, it } from 'vitest';
import { loadLexicon } from './lexicon.js';
import { compileEntry, entryFires, matchEntry } from './matcher.js';
import { rulesFor } from './rules/index.js';
import { countWords } from './text.js';
import type { Language, LexiconEntry } from './types.js';

const LANGUAGES: readonly Language[] = ['sr', 'en'];

/** The surface forms an entry's own examples make it match. */
function matchedForms(entry: LexiconEntry): string[] {
  const compiled = compileEntry(entry);
  return entry.matches.flatMap((example) =>
    matchEntry(example, compiled).map((f) => f.text.toLowerCase()),
  );
}

function commonPrefix(values: readonly string[]): string {
  if (values.length === 0) return '';
  let prefix = values[0] ?? '';
  for (const value of values.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < value.length && prefix[i] === value[i]) i++;
    prefix = prefix.slice(0, i);
  }
  return prefix;
}

describe('every lexicon entry proves itself', () => {
  for (const language of LANGUAGES) {
    const lexicon = loadLexicon(language);

    for (const [rule, entries] of Object.entries(lexicon.entries)) {
      entries.forEach((entry, i) => {
        entry.matches.forEach((example, j) => {
          it(`${language}/${rule}[${i}] "${entry.source}" fires on example ${j}`, () => {
            expect(
              entryFires(example, entry),
              `entry "${entry.source}" matched nothing in "${example}" — ` +
                `it is dead and every report it appears in is clean for the wrong reason`,
            ).toBe(true);
          });
        });

        if (entry.doesNotMatch !== undefined) {
          it(`${language}/${rule}[${i}] "${entry.source}" stays off its counter-example`, () => {
            expect(
              entryFires(entry.doesNotMatch as string, entry),
              `entry "${entry.source}" fired on "${entry.doesNotMatch}", which it is ` +
                `declared not to match — this is a known false positive coming back`,
            ).toBe(false);
          });
        }

        if (entry.source.endsWith('*')) {
          it(`${language}/${rule}[${i}] "${entry.source}" examples pin the stem`, () => {
            const stem = entry.source.slice(0, -1).toLowerCase();
            const forms = [...new Set(matchedForms(entry))];
            expect(
              forms.length,
              `stemmed entry "${entry.source}" has ${forms.length} distinct matched ` +
                `form(s). One form cannot distinguish this stem from a longer one.`,
            ).toBeGreaterThan(1);

            const shared = commonPrefix(forms);
            expect(
              shared,
              `the examples for "${entry.source}" all share the prefix "${shared}", ` +
                `which is longer than the declared stem "${stem}". A stem of ` +
                `"${shared}*" would pass these same examples, so they do not prove ` +
                `"${stem}*" is the right one — this is exactly how spektakularn* ` +
                `survived. Add an example in another grammatical form.`,
            ).toBe(stem);
          });
        }
      });
    }

    it(`${language}: every phrase example is a sentence, not the phrase again`, () => {
      for (const entries of Object.values(lexicon.entries)) {
        for (const entry of entries) {
          if (entry.kind !== 'phrase') continue;
          for (const example of entry.matches) {
            expect(
              example.trim().length,
              `${entry.source}: the example must be longer than the phrase itself`,
            ).toBeGreaterThan(entry.source.length);
          }
        }
      }
    });

    for (const [rule, exceptions] of Object.entries(lexicon.exceptions)) {
      const target = rulesFor(language).find((r) => r.name === rule);

      exceptions.forEach((exception, i) => {
        it(`${language}/${rule} exception[${i}] "${exception.phrase}" is load-bearing`, () => {
          expect(target, `no rule named ${rule} in ${language}`).toBeDefined();
          if (target === undefined) return;

          const ctx = {
            language,
            wordCount: countWords(exception.suppresses),
            lexicon,
          };
          // With the exception applied: silence.
          expect(
            target.check(exception.suppresses, ctx).findings,
            `exception "${exception.phrase}" did not suppress anything in ` +
              `"${exception.suppresses}"`,
          ).toEqual([]);

          // Without it: the rule must actually have fired. An exception that
          // suppresses nothing is as dead as a phrase that matches nothing,
          // and would pass the assertion above for free.
          const stripped = { ...ctx, lexicon: { ...lexicon, exceptions: {} } };
          expect(
            target.check(exception.suppresses, stripped).findings.length,
            `exception "${exception.phrase}" is dead: ${rule} does not fire on ` +
              `"${exception.suppresses}" even without it`,
          ).toBeGreaterThan(0);
        });
      });
    }
  }

  it('covers every entry in both shipped lexicons', () => {
    // agent-evals ADR 018: a check must prove it inspected something. Without
    // this, an empty lexicon would make every assertion above vacuously pass.
    const lexicons = LANGUAGES.map((l) => loadLexicon(l));
    const entries = lexicons
      .flatMap((lex) => Object.values(lex.entries))
      .reduce((acc, list) => acc + list.length, 0);
    const exceptions = lexicons
      .flatMap((lex) => Object.values(lex.exceptions))
      .reduce((acc, list) => acc + list.length, 0);
    expect(entries).toBeGreaterThan(40);
    expect(exceptions).toBeGreaterThan(20);
  });
});
