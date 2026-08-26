/**
 * Turning a string into the things rules actually measure.
 *
 * WHY this is one module rather than a helper in each rule: every density
 * figure in the report is "per 1000 words", and that phrase only means
 * something if every rule agrees on what a word is. One definition, one place,
 * one thing for a future argument to be about.
 */

import type { Finding } from './types.js';

/**
 * A word is a run of letters, possibly containing digits, apostrophes or
 * hyphens after the first character.
 *
 * WHY `\p{L}` and not `\w`: `\w` is `[A-Za-z0-9_]`, so it splits `ključan`
 * into `klju` and `an` and would have made every Serbian count wrong in a way
 * that still produced plausible-looking numbers.
 *
 * Markdown syntax (`**`, `-`, `#`) is not a word and is not counted. Words
 * inside a fenced code block currently are, which overstates the denominator
 * of a technical post and so understates its densities. Noted rather than
 * fixed: stripping code fences is a parser, and today's job is the contract.
 */
const WORD = /\p{L}[\p{L}\p{N}'’-]*/gu;

/** Characters that may not sit next to a phrase match. See {@link phraseSource}. */
const LETTERISH = '\\p{L}\\p{N}_';

/** Counts words by the one definition this tool has. */
export function countWords(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

/**
 * Offsets at which each line starts, for turning an offset into line/column.
 *
 * Built once per document rather than per finding: a rule that fires forty
 * times should not rescan the text forty times to say where.
 */
export function lineStarts(text: string): readonly number[] {
  const starts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

/** 1-based line and column for a 0-based offset. Binary search over line starts. */
export function positionAt(
  offset: number,
  starts: readonly number[],
): { line: number; column: number } {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((starts[mid] ?? 0) <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: offset - (starts[lo] ?? 0) + 1 };
}

/**
 * Every match of `re` in `text`, as positioned findings.
 *
 * If the pattern has a capture group named `hit`, that group is what gets
 * reported. This lets a rule match a wide span for context — a whole
 * `nije … već` clause — while pointing at the part a reader should look at.
 */
export function findMatches(text: string, re: RegExp, starts?: readonly number[]): Finding[] {
  const index = starts ?? lineStarts(text);
  const global = re.global ? re : new RegExp(re.source, `${re.flags}g`);
  global.lastIndex = 0;

  const findings: Finding[] = [];
  let match: RegExpExecArray | null;
  while ((match = global.exec(text)) !== null) {
    // A zero-length match would spin forever; step past it.
    if (match[0].length === 0) {
      global.lastIndex += 1;
      continue;
    }
    const hit = match.groups?.['hit'];
    const span = hit ?? match[0];
    const offset = hit === undefined ? match.index : text.indexOf(hit, match.index);
    findings.push({ text: span, offset, ...positionAt(offset, index) });
  }
  return findings;
}

/**
 * Compiles a literal phrase from a lexicon into a regex source.
 *
 * Three affordances, all of which exist because the lexicon is written by a
 * human in YAML rather than by a programmer in a regex:
 *
 * - Interior whitespace matches any whitespace, so a phrase still matches
 *   across a line break in wrapped prose.
 * - An apostrophe matches either `'` or `’`, because "it's" and "it’s"
 *   are the same tell and only one of them survives a word processor.
 * - A trailing `*` allows up to {@link INFLECTION_MAX} further letters, which
 *   is how a Serbian lexicon can say `kompleks*` and catch `kompleksan`,
 *   `kompleksna`, `kompleksnim`. It is a crude stemmer and will overreach; the
 *   lexicon opts in per entry rather than getting it applied everywhere.
 *
 * Boundaries are lookarounds over `\p{L}` rather than `\b`, for the same
 * reason {@link WORD} is: `\b` does not believe `č` is a letter.
 */
const INFLECTION_MAX = 4;

export function phraseSource(phrase: string): string {
  const inflect = phrase.endsWith('*');
  const bare = inflect ? phrase.slice(0, -1) : phrase;
  const body = bare
    .trim()
    .split(/\s+/)
    .map((word) => [...word].map(escapeChar).join(''))
    .join('\\s+');
  const tail = inflect ? `\\p{L}{0,${INFLECTION_MAX}}` : '';
  return `(?<![${LETTERISH}])${body}${tail}(?![${LETTERISH}])`;
}

function escapeChar(ch: string): string {
  if (ch === "'" || ch === '’') return "['’]";
  return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A sentence, with the offset it starts at so findings inside it stay locatable. */
export interface Sentence {
  readonly text: string;
  readonly offset: number;
  readonly words: number;
}

/**
 * Splits into sentences.
 *
 * A boundary is terminal punctuation, a blank line, or the start of a Markdown
 * block (a heading, a list item, a quote). A LONE NEWLINE IS NOT A BOUNDARY,
 * and getting that wrong is the defect this comment exists to prevent: the
 * first version treated every `\n` as a sentence end, which meant a
 * hard-wrapped paragraph reported one "sentence" per typographic line. On a
 * file wrapped at 72 columns that produced a mean sentence length of six words
 * and a standard deviation that measured the author's text editor rather than
 * the author's rhythm.
 *
 * WHY block starts count even without punctuation: a heading and a bullet are
 * each a unit of rhythm whether or not they end in a full stop, and running a
 * whole list together as one 60-word sentence would make
 * `sentence-uniformity` report variance that is really list formatting.
 *
 * The known cost is abbreviations: `npr.` and `tj.` end a sentence here and do
 * not in Serbian. That inflates the sentence count and shortens the mean,
 * which pushes `sentence-uniformity` in the FORGIVING direction, so the error
 * cannot manufacture a failure.
 */
const BOUNDARY =
  /[.!?…]+|\n[ \t]*\n|\n(?=[ \t]*(?:#{1,6}[ \t]|[-*+][ \t]|>[ \t]|\d+[.)][ \t]))/gu;

export function sentences(text: string): readonly Sentence[] {
  const out: Sentence[] = [];

  const push = (raw: string, at: number): void => {
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length === 0) return;
    const words = countWords(trimmed);
    if (words === 0) return;
    out.push({ text: trimmed, offset: at + leading, words });
  };

  BOUNDARY.lastIndex = 0;
  let start = 0;
  let match: RegExpExecArray | null;
  while ((match = BOUNDARY.exec(text)) !== null) {
    // Terminal punctuation belongs to the sentence it ends; a structural
    // boundary (blank line, block start) belongs to neither side.
    const structural = match[0].startsWith('\n');
    push(text.slice(start, structural ? match.index : match.index + match[0].length), start);
    start = match.index + match[0].length;
  }
  push(text.slice(start), start);

  return out;
}

/** Population standard deviation. Returns 0 for fewer than two values. */
export function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
