/**
 * The contract.
 *
 * Every type here is documented with WHY it has the shape it has, because the
 * shape is the argument. A style guide is a document; this file is the point
 * where the document stops being advice and starts being a type somebody has
 * to satisfy.
 */

/**
 * The two languages the author writes in.
 *
 * WHY a closed union rather than a BCP-47 string: the rule set is not
 * parameterised by locale, it is *different code* per language. Serbian
 * morphology makes a verbal adverb checkable; English has no equivalent
 * marker. A rule declares which languages it is valid for, and a language the
 * rules do not know about is a compile error rather than an empty report.
 */
export type Language = 'sr' | 'en';

/**
 * One place in the text where a rule fired.
 *
 * WHY the position is recorded now, on day one, when nothing reads it yet: an
 * editor that underlines the exact span is the obvious next surface, and a
 * position cannot be reconstructed from a count. Recording "3 weasel words"
 * and adding positions later means re-running every rule against every text
 * that was ever scored. Recording the position costs nothing today and is
 * impossible to add retroactively to a number already stored.
 *
 * `line` and `column` are 1-based, because that is what an editor, a compiler
 * and a human all mean by "line 4, column 12". `offset` is 0-based into the
 * original string, because that is what `String.prototype.slice` means. Both
 * are kept: the pair is for people, the offset is for machines, and deriving
 * one from the other at every call site is where off-by-ones live.
 */
export interface Finding {
  /** The matched span, verbatim, so a report can quote it without re-slicing. */
  readonly text: string;
  /** 1-based line number. */
  readonly line: number;
  /** 1-based column, counted in UTF-16 code units from the start of the line. */
  readonly column: number;
  /** 0-based offset into the whole document. */
  readonly offset: number;
}

/**
 * What kind of claim a rule makes.
 *
 * WHY two kinds and not one severity scale: the two kinds fail differently and
 * must not be averaged together.
 *
 * HARD — one violation fails, full stop. Serbian text with no diacritics is
 * not "slightly worse prose", it is wrong: `ceo` and `ćeo` are different
 * words, and a reader who has to guess is reading a defect. Averaging a hard
 * failure into a mean produces "0.7 good", which is a sentence about a text
 * that is simply not publishable.
 *
 * DENSITY — measured per 1000 words and scored continuously. The style guide's
 * own objection is not to any single word: it is the accumulation of patterns.
 * One "moreover" is a transition. Nine per thousand words is a machine. A
 * boolean throws away exactly the signal that distinguishes those two cases,
 * which is the signal the whole tool exists to measure.
 */
export type RuleKind = 'hard' | 'density';

/**
 * A constant nobody measured, declared rather than hidden.
 *
 * WHY this exists: a checker fills up with numbers that look like findings and
 * are guesses — a density floor, a ceiling, a minimum word count. Each is
 * defensible alone. Stacked, they produce a score that reads as authoritative
 * and is not. Constants belong to the rule that guesses them (not to a global
 * registry) so that the count describes the run rather than the import graph;
 * this follows agent-evals ADR 010, including the part it learned the hard way.
 */
export interface UncalibratedConstant {
  /** Stable id, `rule-name.constant-name`, so a report sorts deterministically. */
  readonly id: string;
  readonly value: number;
  /** What the number does, and what would have to be measured to justify it. */
  readonly note: string;
}

/**
 * One rule's verdict on one text.
 *
 * WHY `score` and `passed` both exist, with `passed` explicitly derived: the
 * continuous value is the measurement and the boolean is a reporting
 * convenience. Storing only the boolean bakes today's threshold into every
 * recorded result forever, so "what would this have said at a stricter floor?"
 * becomes unanswerable about texts already scored. Storing the number keeps
 * the question open. This is agent-evals ADR 001, applied to prose.
 *
 * WHY every result carries a `reason`: one number in the range [0, 1] is
 * harder to act on than a red tick. The reason is what makes the number a
 * finding rather than a grade.
 */
export interface RuleResult {
  readonly rule: string;
  readonly kind: RuleKind;
  readonly findings: readonly Finding[];
  /**
   * Density rules only. Findings per 1000 words — except where a rule says
   * otherwise in its own comment (`bold-ratio` counts characters, and
   * `sentence-uniformity` reports a standard deviation, not a density).
   * Absent on hard rules, where a rate is meaningless: one is already too many.
   */
  readonly perThousand?: number;
  /** 0..1, where 1 is clean. Never NaN: a rule with no denominator scores 1. */
  readonly score: number;
  /** Derived from a threshold. Not the source of truth. */
  readonly passed: boolean;
  readonly reason: string;
}

/**
 * The whole verdict on one text.
 *
 * WHY `score` averages density rules only, and hard failures are listed
 * separately: see {@link RuleKind}. A mean that includes a hard failure
 * launders "this text is wrong" into "this text is somewhat good".
 */
export interface Report {
  readonly language: Language;
  readonly wordCount: number;
  readonly rules: readonly RuleResult[];
  /** Weighted mean over density rules. Hard rules never enter this number. */
  readonly score: number;
  /** Rule names. Non-empty means the text fails, whatever `score` says. */
  readonly hardFailures: readonly string[];
  /**
   * `<version>+<content-hash>` of the lexicon that produced this report.
   *
   * WHY this is not optional and not a footnote: changing a lexicon changes
   * every score. A text that got better and a lexicon that got softer are
   * indistinguishable in the numbers — the most expensive false positive a
   * tool like this can produce, because it looks exactly like the true
   * positive the tool exists to find. The declared `version` catches a
   * deliberate edit somebody remembered to record; the content hash catches
   * the one they did not.
   *
   * TODO(day 3+): comparing two reports across different `lexiconVersion`
   * values must be refused outright, the way agent-evals refuses a baseline
   * recorded against a different model (ADR 009). Today the value is recorded
   * and nothing reads it, so the guarantee is "the evidence exists", not "the
   * mistake is impossible".
   */
  readonly lexiconVersion: string;
}

/**
 * Everything a rule needs that it should not compute for itself.
 *
 * WHY: the word count, the sentence split and the line index are needed by
 * most rules, are non-trivial to get right for Serbian, and must be identical
 * across rules or the per-thousand figures are not comparable to each other.
 * Computing them once, in one place, makes "per 1000 words" mean one thing.
 */
export interface RuleContext {
  readonly language: Language;
  /** The single definition of a word, shared by every density figure. */
  readonly wordCount: number;
  readonly lexicon: Lexicon;
}

/**
 * A rule: a sentence from the style guide, compiled.
 *
 * WHY `languages` is on the rule rather than the registry: a rule knows what
 * it is valid for. `verbal-adverb-close` is not an English rule with an empty
 * implementation, it is a rule that does not apply, and the report should say
 * so by omission rather than by scoring a 1.0 that nothing measured.
 */
export interface Rule {
  readonly name: string;
  readonly kind: RuleKind;
  readonly languages: readonly Language[];
  /**
   * Weight in {@link Report.score}. Defaults to 1.
   *
   * WHY it is here and every rule currently leaves it at 1: nothing measured
   * says negative parallelism matters more than em dashes. Declaring the knob
   * without turning it keeps the mean honestly unweighted, and makes the day
   * we do have evidence a one-line change rather than a refactor.
   */
  readonly weight?: number;
  /** Constants this rule guessed. Collected into the report footer. */
  readonly uncalibrated?: readonly UncalibratedConstant[];
  check(text: string, ctx: RuleContext): RuleResult;
}

/**
 * A loaded, validated lexicon.
 *
 * WHY phrases are data and not code: adding "spektakularno" to the promotional
 * list should be a one-line diff in a file a writer can read, not an edit to a
 * regular expression. The identity fields are next to the data because a
 * phrase list without its version is a number without its units.
 */
export interface Lexicon {
  readonly language: Language;
  /** Declared by hand in the YAML. Catches the edit somebody recorded. */
  readonly version: string;
  /** Computed over the file's canonical content. Catches the one they did not. */
  readonly contentHash: string;
  /** Rule name -> literal phrases. A trailing `*` allows an inflected ending. */
  readonly phrases: Readonly<Record<string, readonly string[]>>;
  /** Rule name -> regular expression sources, validated at load. */
  readonly patterns: Readonly<Record<string, readonly string[]>>;
}
