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
 * The word count below which a density rule abstains — DERIVED, not guessed.
 *
 * A rule cannot say anything about a text until one occurrence is
 * distinguishable from its own ceiling. One occurrence in `w` words is
 * `1000 / w` per thousand; that has to come out strictly below the ceiling, so
 * `w > 1000 / ceiling`.
 *
 * WHY THIS REPLACED A CONSTANT. Day two used a single `density.min-words = 200`
 * for every rule, declared as a guess, with a comment saying the principled
 * version was per-rule and had not been implemented. It cost a real
 * measurement: `negative-parallelism` (ceiling 3) scored 0.00 on a single
 * occurrence in a 258-word text, because 1/258 is 3.88 per thousand. The style
 * guide asks for that construction "extremely rarely". One in 258 words IS
 * rare. The rule was right to notice and wrong to score it zero.
 *
 * At ceiling 3 the derived gate is 334 words, so that text now abstains and
 * reports the finding as observed rather than grading it. The number is no
 * longer an independent assumption: it inherits whatever error is in the
 * ceiling and adds none of its own, which is why `density.min-words` is gone
 * from the uncalibrated registry rather than moved within it.
 */
export function minWordsFor(ceiling: number): number {
  if (!Number.isFinite(ceiling) || ceiling <= 0) return 0;
  return Math.floor(1000 / ceiling) + 1;
}

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
