/**
 * Running the rules and rendering the verdict.
 *
 * The one structural decision here is in {@link buildReport}: hard failures
 * are collected into their own list and CONTRIBUTE NOTHING to the mean. A text
 * with no Serbian diacritics is not "0.7 good". Letting a hard failure into an
 * average converts "this is wrong" into "this is mostly fine", which is the
 * exact laundering the two-kinds-of-rule split exists to prevent.
 */

import { loadLexicon, lexiconIdentity } from './lexicon.js';
import { rulesFor } from './rules/index.js';
import { REPORT_CONSTANTS } from './scoring.js';
import { countWords } from './text.js';
import { collectUncalibrated, formatUncalibratedReport } from './uncalibrated.js';
import type { Language, Lexicon, Report, Rule, RuleResult, UncalibratedConstant } from './types.js';

export interface CheckOptions {
  readonly language: Language;
  /** Injectable so a test can score against a lexicon it wrote. */
  readonly lexicon?: Lexicon;
  readonly rules?: readonly Rule[];
}

export interface CheckOutcome {
  readonly report: Report;
  /**
   * The guesses that took part in this run.
   *
   * WHY this rides alongside the Report rather than inside it: `Report` is the
   * contract for a score, and a score is a claim about a text. How many
   * constants were invented is a claim about the TOOL, and the two should not
   * be persisted as one object — a baseline of scores should not change shape
   * because somebody added a constant.
   */
  readonly uncalibrated: readonly UncalibratedConstant[];
}

export function check(text: string, options: CheckOptions): CheckOutcome {
  const lexicon = options.lexicon ?? loadLexicon(options.language);
  const rules = options.rules ?? rulesFor(options.language);
  const wordCount = countWords(text);

  const ctx = { language: options.language, wordCount, lexicon };
  const results = rules.map((rule) => rule.check(text, ctx));

  return {
    report: buildReport(options.language, wordCount, results, rules, lexicon),
    uncalibrated: collectUncalibrated(rules, REPORT_CONSTANTS),
  };
}

function buildReport(
  language: Language,
  wordCount: number,
  results: readonly RuleResult[],
  rules: readonly Rule[],
  lexicon: Lexicon,
): Report {
  const weightOf = new Map(rules.map((r) => [r.name, r.weight ?? 1]));

  const density = results.filter((r) => r.kind === 'density');
  const totalWeight = density.reduce((acc, r) => acc + (weightOf.get(r.rule) ?? 1), 0);

  // A run with no density rules would divide by zero. It scores 1 rather than
  // NaN: a NaN passes every naive range guard and poisons every mean it
  // reaches (agent-evals ADR 001 pays for this lesson at length).
  const score =
    totalWeight === 0
      ? 1
      : density.reduce((acc, r) => acc + r.score * (weightOf.get(r.rule) ?? 1), 0) / totalWeight;

  return {
    language,
    wordCount,
    rules: results,
    score,
    hardFailures: results.filter((r) => r.kind === 'hard' && !r.passed).map((r) => r.rule),
    lexiconVersion: lexiconIdentity(lexicon),
  };
}

/** Findings quoted per rule. More than this is a list, not a report. */
const QUOTED_PER_RULE = 3;

export function formatMarkdown(
  outcome: CheckOutcome,
  source: string,
  detectedBasis?: string,
): string {
  const { report } = outcome;
  const out: string[] = [];

  out.push(`# voice-check: ${source}`);
  out.push('');
  out.push(
    `**${report.score.toFixed(3)}** over ${report.rules.filter((r) => r.kind === 'density').length} ` +
      `density rules · ${report.wordCount} words · \`${report.language}\` · ` +
      `lexicon \`${report.lexiconVersion}\``,
  );
  out.push('');
  if (detectedBasis !== undefined) {
    out.push(`Language was detected, not declared: ${detectedBasis}`);
    out.push('');
  }

  const hard = report.rules.filter((r) => r.kind === 'hard');
  const failed = hard.filter((r) => !r.passed);

  if (failed.length > 0) {
    out.push('## Hard failures');
    out.push('');
    out.push('These are not scored. One is enough for the text to fail.');
    out.push('');
    for (const result of failed) {
      out.push(`### ${result.rule}`);
      out.push('');
      out.push(result.reason);
      out.push('');
      out.push(...quote(result));
    }
  } else {
    out.push(`Hard rules: ${hard.length === 0 ? 'none apply' : `${hard.length} passed`}.`);
    out.push('');
  }

  out.push('## Density rules');
  out.push('');
  out.push('| rule | score | measured | findings |');
  out.push('| --- | --- | --- | --- |');
  for (const result of report.rules.filter((r) => r.kind === 'density')) {
    const measured = result.perThousand === undefined ? '—' : result.perThousand.toFixed(2);
    out.push(
      `| ${result.rule} | ${result.score.toFixed(2)} | ${measured} | ${result.findings.length} |`,
    );
  }
  out.push('');

  for (const result of report.rules.filter((r) => r.kind === 'density')) {
    if (result.findings.length === 0 && result.score === 1) continue;
    out.push(`### ${result.rule} — ${result.score.toFixed(2)}`);
    out.push('');
    out.push(result.reason);
    out.push('');
    out.push(...quote(result));
  }

  out.push('---');
  out.push('');
  out.push(formatUncalibratedReport(outcome.uncalibrated));
  out.push('');

  return out.join('\n');
}

/**
 * Quotes the first few findings with their line numbers.
 *
 * "First", not "worst": within a density rule every finding is one occurrence
 * of the same thing, and nothing here measures which instance is more damaging.
 * Ranking them would be the report inventing a judgement it does not have.
 */
function quote(result: RuleResult): string[] {
  if (result.findings.length === 0) return [];
  const shown = result.findings.slice(0, QUOTED_PER_RULE);
  const lines = shown.map(
    (f) => `- \`${f.line}:${f.column}\` — ${JSON.stringify(collapse(f.text))}`,
  );
  if (result.findings.length > shown.length) {
    lines.push(`- …and ${result.findings.length - shown.length} more`);
  }
  lines.push('');
  return lines;
}

/** A finding may span a line break; a report table must not. */
function collapse(text: string): string {
  const flat = text.replace(/\s+/gu, ' ').trim();
  return flat.length > 90 ? `${flat.slice(0, 87)}…` : flat;
}
