/**
 * The shared machinery behind the rules, so each rule file is the argument for
 * that rule and not a copy of the same twelve lines of arithmetic.
 */

import { compileEntry, matchEntry } from '../matcher.js';
import {
  densityScore,
  derivePassed,
  DENSITY_MIN_WORDS,
  perThousand,
  PHRASE_CEILING,
  PHRASE_FLOOR,
} from '../scoring.js';
import { lineStarts } from '../text.js';
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
 * A rule declining to measure.
 *
 * Not a pass. A pass records that the rule looked and approved; this records
 * that it could not look. The distinction is invisible in a boolean and is the
 * entire point of the third outcome.
 */
export function abstained(args: {
  rule: string;
  kind: RuleResult['kind'];
  reason: string;
}): RuleResult {
  return { rule: args.rule, kind: args.kind, outcome: 'abstained', findings: [], reason: args.reason };
}

/**
 * Builds the RuleResult for a density rule from a count and a band.
 *
 * Abstains below {@link DENSITY_MIN_WORDS}. The gate is on WORD count even for
 * `bold-ratio`, whose own denominator is characters: a thirty-word note with
 * one bolded word has no meaningful emphasis ratio either, and gating every
 * density rule on one number keeps "this text was too short to grade" a single
 * fact about the report rather than a per-rule footnote.
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
}): RuleResult {
  if (args.ctx.wordCount < DENSITY_MIN_WORDS.value) {
    return abstained({
      rule: args.rule,
      kind: 'density',
      reason:
        `not measured: ${args.ctx.wordCount} words, below the ${DENSITY_MIN_WORDS.value} ` +
        `at which a rate carries information`,
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
    uncalibrated: [floor, ceiling, DENSITY_MIN_WORDS],
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
      const findings: Finding[] = entries.flatMap((entry) =>
        matchEntry(text, compileEntry(entry), starts),
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
