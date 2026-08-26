/**
 * How a count becomes a score.
 *
 * THE SHAPE, stated once so no rule has to restate it:
 *
 *     score = 1                                  when d <= floor
 *     score = (ceiling - d) / (ceiling - floor)   when floor < d < ceiling
 *     score = 0                                  when d >= ceiling
 *
 * where `d` is the rule's measured density. Linear, clamped, and boring on
 * purpose. A sigmoid would look more considered and would need two more
 * invented numbers to place its knee.
 *
 * WHY a floor above zero rather than a curve starting at the origin: the style
 * guide's objection is accumulation, not occurrence. One "međutim" in a
 * thousand words is prose. Scoring it below 1.0 would tell a writer to delete
 * a word that is doing its job, which is how a style checker teaches people to
 * write worse.
 *
 * EVERY NUMBER BELOW IS A GUESS. Nothing measured says three transitions per
 * thousand words is fine and five is not. They are declared through
 * {@link guess} so the report ends with how many of them took part, and so the
 * day somebody scores a corpus of the author's own accepted drafts, the diff
 * is a value and not an archaeology exercise.
 */

import { guess } from './uncalibrated.js';
import type { UncalibratedConstant } from './types.js';

/**
 * The default band for a phrase rule, in matches per 1000 words.
 *
 * What would justify these: run the rules over 30-50 published pieces the
 * author considers good, take the distribution of each rule's density, and put
 * the floor at something like its 75th percentile and the ceiling where the
 * examples he considers machine-written actually sit. That corpus does not
 * exist yet, so these came from reading a handful of texts.
 */
export const PHRASE_FLOOR = guess(
  'density.phrase-floor',
  1.0,
  'matches per 1000 words at or below which a phrase rule scores a clean 1.0; ' +
    'justified by the density distribution of the author’s own accepted drafts, ' +
    'a corpus that does not exist yet',
);

export const PHRASE_CEILING = guess(
  'density.phrase-ceiling',
  6.0,
  'matches per 1000 words at which a phrase rule scores 0; should be where ' +
    'known machine-written text actually sits, measured rather than assumed',
);

/**
 * The word count below which a density rule ABSTAINS rather than scoring.
 *
 * WHY THIS IS A DIFFERENT KIND OF GUESS from the floors and ceilings above,
 * and the ADR says so at length: a floor is a guess about what counts as good
 * prose, which is a judgement somebody could reasonably disagree with. This is
 * a guess about whether a measurement is POSSIBLE at all — whether the text is
 * long enough for a rate to carry information. Being wrong about a floor means
 * disagreeing with a writer. Being wrong about this means reporting a number
 * that describes arithmetic rather than prose.
 *
 * The principled version is per-rule: a rule cannot say anything until one
 * occurrence lands at or below its own ceiling, which is `1000 / ceiling`
 * words — 167 for a default phrase rule, 333 for `negative-parallelism`. A
 * single number is the day-two simplification, and 200 sits inside that range
 * rather than at either end of it.
 */
export const DENSITY_MIN_WORDS = guess(
  'density.min-words',
  200,
  'words below which a density rule abstains instead of scoring; a guess ' +
    'about whether a rate is measurable at all, not about what counts as good ' +
    'prose — the principled replacement is per-rule, at 1000/ceiling words',
);

/**
 * The threshold `RuleResult.passed` is derived from.
 *
 * It is a reporting convenience and nothing persists without the score that
 * produced it, so moving it never invalidates a recorded number — which is the
 * entire reason the score is stored and the boolean is derived.
 */
export const PASS_THRESHOLD = guess(
  'report.pass-threshold',
  0.8,
  'score at or above which a density rule is reported as passing; a display ' +
    'choice, not a measurement, and safe to move because scores are stored',
);

/** The documented shape. `floor` and `ceiling` are densities, not scores. */
export function densityScore(density: number, floor: number, ceiling: number): number {
  if (!Number.isFinite(density)) return 0;
  if (density <= floor) return 1;
  if (density >= ceiling) return 0;
  return (ceiling - density) / (ceiling - floor);
}

/** Matches per 1000 words. Returns 0 for an empty text rather than NaN. */
export function perThousand(count: number, wordCount: number): number {
  if (wordCount <= 0) return 0;
  return (count * 1000) / wordCount;
}

/** Derives the reported boolean. One call site, so the derivation stays single. */
export function derivePassed(score: number): boolean {
  return score >= PASS_THRESHOLD.value;
}

/** The constants the report itself contributes, beyond what the rules declare. */
export const REPORT_CONSTANTS: readonly UncalibratedConstant[] = [PASS_THRESHOLD];
