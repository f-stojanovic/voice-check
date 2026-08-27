/**
 * Splitting a source into sentences, with offsets.
 *
 * WHY OFFSETS AND NOT JUST TEXT
 * -----------------------------
 * The scorers work by asking "which sentence does this quote land in". That is
 * a question about POSITIONS, and a position is only exact if the split records
 * where each sentence started in the original string. Matching a quote against
 * sentence text instead would be a second matcher with its own normalisation
 * rules, and two matchers that must agree is two things to keep in agreement.
 *
 * WHY THIS SPLITTER IS DELIBERATELY DUMB
 * --------------------------------------
 * It is a regex over terminators plus an abbreviation blacklist. It will get
 * things wrong. That is accepted, and the reason is that its mistakes are
 * VISIBLE: every sentence it produces is printed in the worksheet the human
 * fills in, numbered, in order. A wrong split shows up as a numbered line that
 * reads oddly, and the human can see it before spending any effort on it.
 *
 * A cleverer splitter — an ML segmenter, a full Unicode UAX-29 implementation —
 * would be right more often and wrong invisibly, and it would make the split
 * non-deterministic across versions of its model. This one is a pure function
 * of the string and of the list below.
 *
 * SERBIAN AND ENGLISH IN ONE FUNCTION
 * -----------------------------------
 * The hard cases are shared: an abbreviation ending in a period, and an ordinal
 * written as a digit followed by a period. Serbian uses ordinals-with-period far
 * more than English does — dates ("27. avgusta"), enumerations, ranks — so the
 * ordinal rule matters more there, and it is the rule most likely to be wrong.
 * Both are handled by refusing to split rather than by trying to be sure, which
 * fails toward FEWER, LONGER sentences. That direction is chosen on purpose: an
 * over-long sentence is one label the human applies to slightly too much text,
 * while an over-split sentence silently divides a claim across two rows and
 * invites two different marks for one idea.
 */

/** One sentence, and where it came from. `end` is exclusive. */
export interface Sentence {
  /** 1-based, and the number the worksheet shows. */
  readonly index: number;
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

/**
 * Tokens that end in a period and do not end a sentence.
 *
 * Lower-cased for comparison. Serbian first, then English, then the shared
 * scientific ones. This list is the splitter's entire domain knowledge and it
 * is meant to be edited when the worksheet shows it getting something wrong —
 * that is the workflow, not a failure of it.
 */
const ABBREVIATIONS: readonly string[] = [
  // Serbian
  'br', 'itd', 'tj', 'npr', 'god', 'str', 'dr', 'mr', 'prof', 'inž', 'ul',
  'sl', 'tzv', 'odn', 'uporedi', 'v', 'vidi', 'st', 'os', 'rč',
  // English
  'mr', 'mrs', 'ms', 'jr', 'sr', 'vs', 'etc', 'ie', 'eg', 'al', 'fig', 'no',
  'approx', 'dept', 'est', 'inc', 'ltd', 'co',
  // Shared / scientific
  'cf', 'ca', 'pp', 'ed', 'eds', 'vol', 'ch',
];

const ABBREV = new Set(ABBREVIATIONS);

/** `.`, `!`, `?`, and the Unicode ellipsis, plus any run of them. */
const TERMINATOR = /[.!?…]+/gu;

/**
 * Splits `source` into sentences.
 *
 * Pure, deterministic, and dependent on nothing but the string and the
 * abbreviation list. Blank lines and headings are sentences too: a markdown
 * heading is a line the analyst can quote, so it has to be labellable.
 */
export function splitSentences(source: string): Sentence[] {
  const sentences: Sentence[] = [];
  let cursor = 0;

  const push = (start: number, end: number): void => {
    const raw = source.slice(start, end);
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length === 0) return;
    sentences.push({
      index: sentences.length + 1,
      text: trimmed,
      start: start + leading,
      end: start + leading + trimmed.length,
    });
  };

  TERMINATOR.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TERMINATOR.exec(source)) !== null) {
    const stop = match.index + match[0].length;
    if (!endsSentence(source, match.index, stop)) continue;
    push(cursor, stop);
    cursor = stop;
  }
  /* Whatever trails the last terminator. A source that does not end in one — a
     heading, a list item, a truncated excerpt — still has a final sentence, and
     dropping it would silently make the last line of every such source
     unlabellable. */
  push(cursor, source.length);

  /* A blank line is a stronger boundary than any punctuation, and plenty of
     sources (headings, list items, tables) contain no terminator at all. Split
     on it after the fact so a paragraph break never sits inside a sentence. */
  return sentences.flatMap(splitOnBlankLines).map((s, i) => ({ ...s, index: i + 1 }));
}

/** Whether a terminator at [from, to) actually ends a sentence. */
function endsSentence(source: string, from: number, to: number): boolean {
  /* Only `.` is ambiguous. `!` and `?` end sentences wherever they appear. */
  if (source.slice(from, to) !== '.') return true;

  const before = source.slice(0, from);
  const token = /(\S+)$/u.exec(before)?.[1] ?? '';

  /* A digit immediately before the period: an ordinal or a numbered list item.
     Serbian writes dates and enumerations this way constantly. Refusing to
     split here is the rule most likely to be wrong, and it is wrong in the
     direction that merges rather than divides. */
  if (/\d$/u.test(token)) return false;

  /* A known abbreviation. Compared case-folded and without the trailing dot. */
  if (ABBREV.has(token.toLowerCase())) return false;

  /* A single letter — an initial, `J. Smith`, or an enumerated `a.` */
  if (/^\p{L}$/u.test(token)) return false;

  /* What follows has to look like a new sentence: whitespace, then something
     that is not a lower-case letter. `foo. bar` inside a filename or a version
     string does not start one. End-of-string counts. */
  const after = source.slice(to);
  if (after.length === 0) return true;
  if (!/^\s/u.test(after)) return false;
  const next = after.trimStart();
  if (next.length === 0) return true;
  return !/^\p{Ll}/u.test(next);
}

/** Splits a span on blank lines, preserving offsets. */
function splitOnBlankLines(sentence: Sentence): Sentence[] {
  const parts: Sentence[] = [];
  const re = /\n[ \t]*\n/gu;
  let cursor = 0;
  let match: RegExpExecArray | null;
  const body = sentence.text;

  const push = (from: number, to: number): void => {
    const raw = body.slice(from, to);
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length === 0) return;
    parts.push({
      index: 0,
      text: trimmed,
      start: sentence.start + from + leading,
      end: sentence.start + from + leading + trimmed.length,
    });
  };

  re.lastIndex = 0;
  while ((match = re.exec(body)) !== null) {
    push(cursor, match.index);
    cursor = match.index + match[0].length;
  }
  push(cursor, body.length);
  return parts.length === 0 ? [] : parts;
}

/**
 * The sentence containing `offset`, or `undefined` if it falls in the gap
 * between two (whitespace the split discarded).
 *
 * Linear rather than binary: a source is a few hundred sentences and this runs
 * a few times per case. A binary search here would be a correctness risk taken
 * to save microseconds nobody will measure.
 */
export function sentenceAt(sentences: readonly Sentence[], offset: number): Sentence | undefined {
  return sentences.find((s) => offset >= s.start && offset < s.end);
}

/**
 * Every sentence a span [start, end) touches.
 *
 * A quote can cross a sentence boundary — the model is free to quote two
 * sentences at once, and `analyst.ts` never told it not to. Returning all of
 * them lets the scorers decide what that means rather than silently attributing
 * the quote to whichever end happened to be checked first.
 */
export function sentencesIn(
  sentences: readonly Sentence[],
  start: number,
  end: number,
): Sentence[] {
  return sentences.filter((s) => start < s.end && end > s.start);
}
