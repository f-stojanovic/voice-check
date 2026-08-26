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
 * Suppression is containment IN EITHER DIRECTION: a match is dropped when its
 * span lies inside an exception's, or an exception's lies inside the match's.
 *
 * Both directions are needed and each has a real case. `ključ*` fires on the
 * single word `Ključna`, which sits inside the exception `ključna reč` — the
 * narrow-match case. `rule-of-three` matches a whole clause, `care about
 * architecture, code quality, and shipping`, and the exception names the list
 * inside it — the wide-match case. A one-directional check handles one and
 * silently fails the other, which is how the second one was found.
 *
 * The cost of the second direction is that a broad exception suppresses any
 * match containing it, which is the intent here and is worth watching.
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

  return hits.filter((hit) => !suppressed.some((span) => overlapsWholly(hit, span)));
}

/** True when either span wholly contains the other. */
export function overlapsWholly(
  hit: { offset: number; text: string },
  [from, to]: readonly [number, number],
): boolean {
  const start = hit.offset;
  const end = hit.offset + hit.text.length;
  return (start >= from && end <= to) || (from >= start && to <= end);
}

/** True when this entry fires anywhere in the given text. Used by the entry tests. */
export function entryFires(text: string, entry: LexiconEntry): boolean {
  return matchEntry(text, compileEntry(entry)).length > 0;
}
