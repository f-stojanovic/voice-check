/**
 * Reporting the numbers nobody measured.
 *
 * Taken wholesale from agent-evals ADR 010, including the part that repository
 * learned the hard way: there is no global registry here. A registry populated
 * at import time reports a count that depends on which modules were loaded
 * rather than on which rules ran, and it needs a reset export so tests can
 * clear it — state that must be cleared to be tested is state in the wrong
 * place. Constants belong to the rule that guessed them.
 *
 * The claim this file supports is narrow and worth stating exactly: the count
 * is a FLOOR on how many assumptions a run made, never the total. Nothing
 * stops the next constant being written as a bare `0.75`.
 */

import type { Rule, UncalibratedConstant } from './types.js';

/** Declares a guess. Returns it, so the value and its note cannot drift apart. */
export function guess(id: string, value: number, note: string): UncalibratedConstant {
  return { id, value, note };
}

/**
 * Every constant declared by the rules that ran, deduplicated by id and sorted.
 *
 * WHY deduplicated: five phrase rules share one floor. Listing it five times
 * would report "this run used 28 uncalibrated constants" when it used 24
 * distinct ones, and a count that inflates with the number of callers is a
 * count of call sites rather than of assumptions. The id is the identity —
 * two declarations sharing an id are the same guess.
 */
export function collectUncalibrated(
  rules: readonly Rule[],
  extra: readonly UncalibratedConstant[] = [],
): readonly UncalibratedConstant[] {
  const byId = new Map<string, UncalibratedConstant>();
  for (const constant of [...rules.flatMap((rule) => rule.uncalibrated ?? []), ...extra]) {
    const seen = byId.get(constant.id);
    if (seen !== undefined && seen.value !== constant.value) {
      // Same id, different value: two different guesses wearing one name, so
      // the report would attribute a number to a rule that did not use it.
      throw new Error(
        `uncalibrated constant "${constant.id}" was declared with both ` +
          `${seen.value} and ${constant.value}`,
      );
    }
    byId.set(constant.id, constant);
  }
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Renders the report footer. Kept here so the wording stays with the idea. */
export function formatUncalibratedReport(
  constants: readonly UncalibratedConstant[],
): string {
  if (constants.length === 0) return 'This run used no uncalibrated constants.';
  const lines = constants.map((c) => `  ${c.id} = ${c.value} — ${c.note}`);
  return (
    `This run used ${constants.length} uncalibrated constant` +
    `${constants.length === 1 ? '' : 's'}:\n${lines.join('\n')}`
  );
}
