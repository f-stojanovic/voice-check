/**
 * The shared machinery behind the rules, so each rule file is the argument for
 * that rule and not a copy of the same twelve lines of arithmetic.
 */

import { densityScore, derivePassed, perThousand, PHRASE_CEILING, PHRASE_FLOOR } from '../scoring.js';
import { findMatches, phrasesRegex } from '../text.js';
import type { Finding, Language, Rule, RuleContext, RuleResult, UncalibratedConstant } from '../types.js';

/** Rounds for display only. The stored score keeps its full precision. */
function show(n: number): string {
  return n.toFixed(2);
}

/** Builds the RuleResult for a density rule from a count and a band. */
export function densityResult(args: {
  rule: string;
  findings: readonly Finding[];
  density: number;
  floor: UncalibratedConstant;
  ceiling: UncalibratedConstant;
  /** What the density is a density OF, e.g. "matches per 1000 words". */
  unit: string;
}): RuleResult {
  const score = densityScore(args.density, args.floor.value, args.ceiling.value);
  return {
    rule: args.rule,
    kind: 'density',
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
    findings: args.findings,
    score: args.clean ? 1 : 0,
    passed: args.clean,
    reason: args.reason,
  };
}

/**
 * A rule whose entire definition is "these phrases, and these patterns, are
 * tells; count them".
 *
 * WHY a factory rather than eleven near-identical files: the eleven rules
 * differ only in which lexicon key they read and what band they score against.
 * Writing that out eleven times means eleven places for the per-thousand
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
      const phrases = ctx.lexicon.phrases[spec.name] ?? [];
      const patterns = ctx.lexicon.patterns[spec.name] ?? [];

      // A rule with no data would score every text a clean 1.0, which is the
      // failure mode where the tool reports that everything is fine because it
      // stopped looking. agent-evals ADR 005 calls this "a suite that measures
      // nothing"; the answer there and here is to refuse to run.
      if (phrases.length === 0 && patterns.length === 0) {
        throw new Error(
          `rule "${spec.name}" has no phrases and no patterns in the ${ctx.lexicon.language} ` +
            `lexicon (version ${ctx.lexicon.version}); it would score every text 1.0`,
        );
      }

      const findings: Finding[] = [];
      const phraseRe = phrasesRegex(phrases);
      if (phraseRe) findings.push(...findMatches(text, phraseRe));
      for (const source of patterns) {
        findings.push(...findMatches(text, new RegExp(source, 'giu')));
      }
      findings.sort((a, b) => a.offset - b.offset);

      return densityResult({
        rule: spec.name,
        findings,
        density: perThousand(findings.length, ctx.wordCount),
        floor,
        ceiling,
        unit: 'per 1000 words',
      });
    },
  };
}
