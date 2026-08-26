/**
 * The shared machinery behind the rules, so each rule file is the argument for
 * that rule and not a copy of the same twelve lines of arithmetic.
 */

import { compileEntry, matchEntry, overlapsWholly } from '../matcher.js';
import {
  densityScore,
  derivePassed,
  minWordsFor,
  perThousand,
  PHRASE_CEILING,
  PHRASE_FLOOR,
} from '../scoring.js';
import { findMatches, lineStarts, phraseSource } from '../text.js';
import type {
  Finding,
  Language,
  Rule,
  RuleContext,
  RuleResult,
  UncalibratedConstant,
} from '../types.js';

/** Rounds for display only. The stored score keeps its full precision. */
function show(n: number): string {
  return n.toFixed(2);
}

/**
 * A rule declining to SCORE — while still reporting what it saw.
 *
 * Not a pass. A pass records that the rule looked and approved; this records
 * that it looked and cannot put a number on it.
 *
 * WHY AN ABSTENTION STILL CARRIES FINDINGS. Day two returned an empty array
 * here, and the result was that a 139-word post produced thirteen abstentions
 * and nothing else — no score and no observations, which is the format most of
 * the author's writing is in. "Here is what I noticed, I cannot give you a
 * rate for it" is honest and useful. Silence is neither, and it is not more
 * honest: the rule did look, and throwing away what it found reports less than
 * was known.
 */
export function abstained(args: {
  rule: string;
  kind: RuleResult['kind'];
  reason: string;
  findings?: readonly Finding[];
  minWords?: number;
}): RuleResult {
  return {
    rule: args.rule,
    kind: args.kind,
    outcome: 'abstained',
    findings: args.findings ?? [],
    reason: args.reason,
    ...(args.minWords === undefined ? {} : { minWords: args.minWords }),
  };
}

/**
 * Findings suppressed by a structural rule's exception list.
 *
 * `doesNotMatch` and `except` reach the eight lexicon-driven rules, because
 * those have entries to hang an exception on. The other eight are regular
 * expressions in TypeScript, and the sharpest false positive in the day-one
 * survey — `verbal-adverb-close` firing on the infinitive `reći` — was in that
 * half. This is the seam that closes it: the rule stays a regex, the
 * exceptions become data.
 *
 * Suppression is by containment, the same rule the lexicon `except` uses: a
 * finding is dropped when its span lies inside an occurrence of an exception
 * phrase. For a single-word exception like `reći` that is exact-word matching.
 */
export function withoutExceptions(
  findings: readonly Finding[],
  text: string,
  ctx: RuleContext,
  rule: string,
  starts?: readonly number[],
): Finding[] {
  const exceptions = ctx.lexicon.exceptions[rule] ?? [];
  if (exceptions.length === 0 || findings.length === 0) return [...findings];

  const spans = exceptions.flatMap((exception) =>
    findMatches(text, new RegExp(phraseSource(exception.phrase), 'giu'), starts).map(
      (f) => [f.offset, f.offset + f.text.length] as const,
    ),
  );

  return findings.filter((hit) => !spans.some((span) => overlapsWholly(hit, span)));
}

/**
 * Builds the RuleResult for a density rule from a count and a band.
 *
 * Abstains below the gate DERIVED from this rule's own ceiling — see
 * {@link minWordsFor}. A rule with a tight ceiling needs a longer text before
 * it can say anything, which is a property of the rule rather than a fact
 * about texts, and one number for all of them was hiding that.
 *
 * THE GATE ALSO LOOKS AT THE COUNT, not only the length, and that is a day-five
 * correction. The gate exists because one occurrence in a short text can land
 * above a ceiling on its own, so a single ordinary use would score 0. That
 * argument covers exactly one occurrence. It does not cover two, and it
 * certainly does not cover three: `samples/machine-sr.md` has three
 * `nije … već` constructions in 274 words and the length-only gate declined to
 * score it, which is the rule refusing to report the pattern it exists for.
 *
 * From two upward the rate is not dominated by a single accident, so it is
 * scored whatever the length.
 *
 * `gateOnWordCount: false` lets a rule opt out entirely. `bold-ratio` does,
 * because its denominator is characters rather than words and a character
 * ratio is measurable at almost any length.
 */
export function densityResult(args: {
  rule: string;
  ctx: RuleContext;
  findings: readonly Finding[];
  density: number;
  floor: UncalibratedConstant;
  ceiling: UncalibratedConstant;
  /** What the density is a density OF, e.g. "matches per 1000 words". */
  unit: string;
  /** False for a rule whose denominator is not words. Default true. */
  gateOnWordCount?: boolean;
}): RuleResult {
  const minWords = minWordsFor(args.ceiling.value);
  const tooShort = args.gateOnWordCount !== false && args.ctx.wordCount < minWords;
  if (tooShort && args.findings.length <= 1) {
    return abstained({
      rule: args.rule,
      kind: 'density',
      findings: args.findings,
      minWords,
      reason:
        `not scored: ${args.findings.length} found in ${args.ctx.wordCount} words. ` +
        `One occurrence here is ${perThousand(1, args.ctx.wordCount).toFixed(2)} per 1000, ` +
        `at or above this rule's ceiling of ${args.ceiling.value}, so a single ordinary ` +
        `use would score 0. Needs ${minWords} words (1000 / ${args.ceiling.value}), ` +
        `or two occurrences`,
    });
  }

  const score = densityScore(args.density, args.floor.value, args.ceiling.value);
  return {
    rule: args.rule,
    kind: 'density',
    outcome: 'scored',
    findings: args.findings,
    perThousand: args.density,
    score,
    passed: derivePassed(score),
    reason:
      `${args.findings.length} found, ${show(args.density)} ${args.unit} ` +
      `(clean at or below ${args.floor.value}, zero at ${args.ceiling.value})`,
  };
}

/** Builds the RuleResult for a hard rule. No band, no rate: one is too many. */
export function hardResult(args: {
  rule: string;
  findings: readonly Finding[];
  /** True when the text is clean. Some hard rules fail on ABSENCE, not presence. */
  clean: boolean;
  reason: string;
}): RuleResult {
  return {
    rule: args.rule,
    kind: 'hard',
    outcome: 'scored',
    findings: args.findings,
    score: args.clean ? 1 : 0,
    passed: args.clean,
    reason: args.reason,
  };
}

/**
 * A rule whose entire definition is "these entries are tells; count them".
 *
 * WHY a factory rather than eight near-identical files: the eight rules differ
 * only in which lexicon key they read and what band they score against.
 * Writing that out eight times means eight places for the per-thousand
 * arithmetic to drift, and the whole point of the report is that the figures
 * are comparable to each other.
 *
 * Each rule still gets its own file, because the WHY is not shared — the
 * argument for `negative-parallelism` and the argument for `em-dash-density`
 * are different arguments, and a comment block is where a style guide survives.
 */
export function lexiconRule(spec: {
  name: string;
  languages: readonly Language[];
  floor?: UncalibratedConstant;
  ceiling?: UncalibratedConstant;
}): Rule {
  const floor = spec.floor ?? PHRASE_FLOOR;
  const ceiling = spec.ceiling ?? PHRASE_CEILING;

  return {
    name: spec.name,
    kind: 'density',
    languages: spec.languages,
    uncalibrated: [floor, ceiling],
    check(text: string, ctx: RuleContext): RuleResult {
      const entries = ctx.lexicon.entries[spec.name] ?? [];

      // A rule with no data would score every text a clean 1.0, which is the
      // failure mode where the tool reports that everything is fine because it
      // stopped looking. agent-evals ADR 005 calls this "a suite that measures
      // nothing"; the answer there and here is to refuse to run.
      if (entries.length === 0) {
        throw new Error(
          `rule "${spec.name}" has no entries in the ${ctx.lexicon.language} lexicon ` +
            `(version ${ctx.lexicon.version}); it would score every text 1.0`,
        );
      }

      const starts = lineStarts(text);
      const findings: Finding[] = withoutExceptions(
        entries.flatMap((entry) => matchEntry(text, compileEntry(entry), starts)),
        text,
        ctx,
        spec.name,
        starts,
      );
      findings.sort((a, b) => a.offset - b.offset);

      return densityResult({
        rule: spec.name,
        ctx,
        findings,
        density: perThousand(findings.length, ctx.wordCount),
        floor,
        ceiling,
        unit: 'per 1000 words',
      });
    },
  };
}
