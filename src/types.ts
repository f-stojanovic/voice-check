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
 * What happened when a rule met a text.
 *
 * WHY A THIRD OUTCOME EXISTS. Day one had two: a rule scored, or a rule
 * failed. That was wrong, and the samples showed it. A density is a RATE, and
 * a rate needs a denominator large enough for one occurrence not to dominate
 * it. At a floor of 4 per 1000 words, a 40-word note containing a single
 * perfectly good `međutim` scores 0 — not because the prose is bad but
 * because the arithmetic has nothing to work with.
 *
 * Scoring that note is a lie. Passing it is a different lie: it records that
 * the rule looked and approved, when the rule could not look. So a rule may
 * ABSTAIN. An abstention is not scored, is not counted as passing, and is
 * excluded from the mean. The report says how many rules abstained and why.
 *
 * This is a discriminated union rather than a nullable score because
 * `score: number | null` puts the check at every call site and lets one
 * forgotten `?? 0` turn an abstention back into a failing grade.
 */
export type RuleOutcome = 'scored' | 'abstained';

interface RuleResultCommon {
  readonly rule: string;
  readonly kind: RuleKind;
  readonly findings: readonly Finding[];
  /** Why this outcome. On an abstention, what the rule could not measure. */
  readonly reason: string;
}

/**
 * A rule that measured something.
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
export interface ScoredRuleResult extends RuleResultCommon {
  readonly outcome: 'scored';
  /**
   * Density rules only. Findings per 1000 words — except where a rule says
   * otherwise in its own comment (`bold-ratio` counts characters, and
   * `sentence-uniformity` reports a standard deviation, not a density).
   * Absent on hard rules, where a rate is meaningless: one is already too many.
   */
  readonly perThousand?: number;
  /** 0..1, where 1 is clean. Never NaN: a rule with no denominator abstains. */
  readonly score: number;
  /** Derived from a threshold. Not the source of truth. */
  readonly passed: boolean;
}

/** A rule that declined to measure. Carries no score, because it has none. */
export interface AbstainedRuleResult extends RuleResultCommon {
  readonly outcome: 'abstained';
}

export type RuleResult = ScoredRuleResult | AbstainedRuleResult;

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
  /**
   * Weighted mean over density rules that were SCORED. Hard rules never enter
   * this number, and neither do abstentions.
   *
   * `null` when no density rule could be scored at all — a text short enough
   * that the tool has nothing to say about its prose. Nullable rather than
   * defaulted to 1.0 or 0, because both of those are claims and this is the
   * absence of one.
   */
  readonly score: number | null;
  /** Rule names. Non-empty means the text fails, whatever `score` says. */
  readonly hardFailures: readonly string[];
  /**
   * Rules that declined to measure, with the reason each gave.
   *
   * Carried on the Report rather than left for the reader to derive from
   * `rules`, because "eleven of sixteen rules abstained" is the single most
   * important fact about a report of a short text, and a fact nobody computes
   * is a fact nobody sees.
   */
  readonly abstentions: readonly { readonly rule: string; readonly reason: string }[];
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
 * One entry in a lexicon: a tell, plus the examples that prove it works.
 *
 * WHY EVERY ENTRY CARRIES ITS OWN EXAMPLES. Two entries shipped on day one
 * matching nothing at all — `neverovatn*` and `spektakularn*`, both broken on
 * the Serbian fleeting `a`, both sitting in a list that looked full. An entry
 * that finds nothing is indistinguishable, in a report, from an entry that
 * looked and approved. That is the same failure this whole project exists to
 * catch, reproduced inside the tool's own data.
 *
 * `matches` is mandatory: a phrase the entry MUST fire on. A test runs every
 * entry against its own example, so a dead entry fails the build with its own
 * name in the message.
 *
 * `doesNotMatch` is optional and is where a known false positive goes. It
 * turns "`ključ*` also catches `ključna reč`" from a paragraph in a README
 * into an assertion that fails if somebody widens the stem.
 *
 * `except` is the mechanism that makes a `doesNotMatch` satisfiable: literal
 * phrases inside which a match is suppressed. This is a suppression
 * mechanism, deliberately withheld on day one until the false-positive survey
 * said what shape it needed. It is narrow on purpose — a literal containing
 * phrase, not a rule language.
 */
export interface LexiconEntry {
  /** The phrase or regular expression, exactly as written in the YAML. */
  readonly source: string;
  readonly kind: 'phrase' | 'pattern';
  /** A text this entry must fire on. Asserted by a test. */
  readonly matches: string;
  /** A text this entry must NOT fire on. Asserted by a test when present. */
  readonly doesNotMatch?: string;
  /** Literal phrases inside which a match is suppressed. */
  readonly except: readonly string[];
}

/**
 * A loaded, validated lexicon.
 *
 * WHY phrases are data and not code: adding "spektakularno" to the promotional
 * list should be a one-line diff in a file a writer can read, not an edit to a
 * regular expression. The identity fields are next to the data because a
 * phrase list without its version is a number without its units.
 *
 * THIS COVERS EIGHT OF SIXTEEN RULES. The YAML separates `phrases:` (literal
 * text a writer can add) from `patterns:` (regular expressions, which a writer
 * realistically cannot), and four rules — `diacritics`, `formal-address`,
 * `sentence-uniformity`, `bold-ratio` and the rest of the structural set —
 * read no lexicon at all. See the README's rule table for which is which.
 */
export interface Lexicon {
  readonly language: Language;
  /** Declared by hand in the YAML. Catches the edit somebody recorded. */
  readonly version: string;
  /** Computed over the file's canonical content. Catches the one they did not. */
  readonly contentHash: string;
  /**
   * Rule name -> its entries, phrases and patterns merged.
   *
   * Merged here and separate in the YAML: the file is organised for the person
   * editing it, and a rule does not care which syntax a tell was written in.
   */
  readonly entries: Readonly<Record<string, readonly LexiconEntry[]>>;
}
