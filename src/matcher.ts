/**
 * Turning one lexicon entry into matches with positions.
 *
 * Split out of the rules so that a test can exercise a single entry against
 * its own declared example. That test is the reason this file exists: two
 * entries shipped dead on day one, and nothing noticed, because a phrase list
 * that matches nothing produces the same clean report as a text with nothing
 * wrong in it.
 */

import { findMatches, phraseSource } from './text.js';
import type { Finding, LexiconEntry } from './types.js';

/** An entry with its regular expressions built, so they are compiled once. */
export interface CompiledEntry {
  readonly entry: LexiconEntry;
  readonly regex: RegExp;
  readonly except: readonly RegExp[];
}

export function compileEntry(entry: LexiconEntry): CompiledEntry {
  const source = entry.kind === 'phrase' ? phraseSource(entry.source) : entry.source;
  return {
    entry,
    regex: new RegExp(source, 'giu'),
    // Exceptions are always literal phrases, never regular expressions, even
    // for a pattern entry. A suppression written as a regex would be a second
    // rule language hiding inside the first one, and impossible to reason
    // about from the YAML.
    except: entry.except.map((phrase) => new RegExp(phraseSource(phrase), 'giu')),
  };
}

/**
 * Every match of one entry, with the suppressed ones removed.
 *
 * Suppression is containment: a match is dropped when its span lies inside an
 * occurrence of one of the entry's `except` phrases. `ključ*` fires on
 * `Ključna` and the exception `ključna reč` covers it, so the finding
 * disappears; the same entry still fires on `ključan trenutak`, which no
 * exception covers.
 */
export function matchEntry(
  text: string,
  compiled: CompiledEntry,
  starts?: readonly number[],
): Finding[] {
  const hits = findMatches(text, compiled.regex, starts);
  if (compiled.except.length === 0 || hits.length === 0) return hits;

  const suppressed = compiled.except.flatMap((re) =>
    findMatches(text, re, starts).map((f) => [f.offset, f.offset + f.text.length] as const),
  );

  return hits.filter(
    (hit) =>
      !suppressed.some(
        ([from, to]) => hit.offset >= from && hit.offset + hit.text.length <= to,
      ),
  );
}

/** True when this entry fires anywhere in the given text. Used by the entry tests. */
export function entryFires(text: string, entry: LexiconEntry): boolean {
  return matchEntry(text, compileEntry(entry)).length > 0;
}
