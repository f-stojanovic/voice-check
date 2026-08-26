/**
 * The test A2 exists for.
 *
 * Two entries shipped on day one matching nothing: `neverovatn*` and
 * `spektakularn*`, both broken on the Serbian fleeting `a`. The lists looked
 * full. Every report they appeared in was clean for the wrong reason, and
 * nothing in the tool could tell the difference between an entry that found
 * nothing and an entry that looked and approved — which is the same failure
 * this whole project exists to catch, reproduced inside its own data.
 *
 * So every entry now carries an example it must fire on, and this test runs
 * them. A dead entry fails the build with its own text in the message.
 */

import { describe, expect, it } from 'vitest';
import { loadLexicon } from './lexicon.js';
import { entryFires } from './matcher.js';
import type { Language } from './types.js';

const LANGUAGES: readonly Language[] = ['sr', 'en'];

describe('every lexicon entry proves itself', () => {
  for (const language of LANGUAGES) {
    const lexicon = loadLexicon(language);

    for (const [rule, entries] of Object.entries(lexicon.entries)) {
      entries.forEach((entry, i) => {
        it(`${language}/${rule}[${i}] "${entry.source}" fires on its own example`, () => {
          expect(
            entryFires(entry.matches, entry),
            `entry "${entry.source}" matched nothing in "${entry.matches}" — ` +
              `it is dead and every report it appears in is clean for the wrong reason`,
          ).toBe(true);
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
      });
    }

    it(`${language}: every phrase example is a sentence, not the phrase again`, () => {
      // A `matches` equal to the phrase itself would satisfy the test above
      // while proving only that a string contains itself. The guard applies to
      // phrase entries; a pattern's source is a regex and its length says
      // nothing about the example.
      for (const entries of Object.values(lexicon.entries)) {
        for (const entry of entries) {
          if (entry.kind !== 'phrase') continue;
          expect(
            entry.matches.trim().length,
            `${entry.source}: the example must be longer than the phrase itself`,
          ).toBeGreaterThan(entry.source.length);
        }
      }
    });
  }

  it('covers every entry in both shipped lexicons', () => {
    // agent-evals ADR 018: a check must prove it inspected something. Without
    // this, an empty lexicon would make every assertion above vacuously pass.
    const total = LANGUAGES.map((l) => loadLexicon(l))
      .flatMap((lex) => Object.values(lex.entries))
      .reduce((acc, entries) => acc + entries.length, 0);
    expect(total).toBeGreaterThan(40);
  });
});
