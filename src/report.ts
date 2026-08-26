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
import type {
  Language,
  Lexicon,
  Report,
  Rule,
  RuleResult,
  ScoredRuleResult,
  UncalibratedConstant,
} from './types.js';

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

  const density = results.filter(
    (r): r is ScoredRuleResult => r.kind === 'density' && r.outcome === 'scored',
  );
  const totalWeight = density.reduce((acc, r) => acc + (weightOf.get(r.rule) ?? 1), 0);

  // Null rather than 1 or 0 when nothing could be scored. Both of those are
  // claims about the prose; this is the absence of one. Returning 1 would also
  // mean a two-sentence note scored better than anything ever written.
  const score =
    totalWeight === 0
      ? null
      : density.reduce((acc, r) => acc + r.score * (weightOf.get(r.rule) ?? 1), 0) / totalWeight;

  return {
    language,
    wordCount,
    rules: results,
    score,
    hardFailures: results
      .filter((r) => r.kind === 'hard' && r.outcome === 'scored' && !r.passed)
      .map((r) => r.rule),
    abstentions: results
      .filter((r) => r.outcome === 'abstained')
      .map((r) => ({ rule: r.rule, reason: r.reason })),
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

  const scoredDensity = report.rules.filter(
    (r) => r.kind === 'density' && r.outcome === 'scored',
  );

  out.push(`# voice-check: ${source}`);
  out.push('');
  out.push(
    `**${report.score === null ? 'not scored' : report.score.toFixed(3)}** over ` +
      `${scoredDensity.length} density rule${scoredDensity.length === 1 ? '' : 's'} · ` +
      `${report.wordCount} words · \`${report.language}\` · ` +
      `lexicon \`${report.lexiconVersion}\``,
  );
  out.push('');
  if (detectedBasis !== undefined) {
    out.push(`Language was detected, not declared: ${detectedBasis}`);
    out.push('');
  }

  const hard = report.rules.filter((r) => r.kind === 'hard');
  const failed = hard.filter((r) => r.outcome === 'scored' && !r.passed);

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
    const passedHard = hard.filter((r) => r.outcome === 'scored').length;
    out.push(`Hard rules: ${passedHard === 0 ? 'none measured' : `${passedHard} passed`}.`);
    out.push('');
  }

  // Abstentions come BEFORE the score table, because on a short text they are
  // the most important fact in the report: they say the tool declined rather
  // than approved, and a reader who skips them will read a partial mean as a
  // verdict on the whole text.
  if (report.abstentions.length > 0) {
    out.push(`## Not measured (${report.abstentions.length})`);
    out.push('');
    out.push(
      report.score === null
        ? 'No density rule could measure this text. The score above is absent, ' +
          'not zero — the text is too short for a rate to carry information.'
        : 'These rules declined to measure. They are excluded from the score — ' +
          'an abstention is not a pass.',
    );
    out.push('');
    for (const abstention of report.abstentions) {
      out.push(`- \`${abstention.rule}\` — ${abstention.reason}`);
    }
    out.push('');

    // An abstaining rule still reports what it saw. Day two returned silence
    // here, and a 139-word post produced thirteen abstentions and nothing
    // else — no score and no observations, which is the format most of the
    // author's writing is in. "Here is what I noticed, I cannot give you a
    // rate for it" is honest and useful; silence is neither, and it is not
    // more honest, because the rule did look.
    const observed = report.rules.filter(
      (r) => r.outcome === 'abstained' && r.findings.length > 0,
    );
    if (observed.length > 0) {
      out.push('### Observed, not scored');
      out.push('');
      out.push(
        'These rules found something and declined to put a rate on it. Read them ' +
          'as notes, not as a grade.',
      );
      out.push('');
      for (const result of observed) {
        out.push(`**${result.rule}** — ${result.findings.length} found`);
        out.push('');
        out.push(...quote(result));
      }
    }
  }

  if (scoredDensity.length > 0) {
    out.push('## Density rules');
    out.push('');
    out.push('| rule | score | measured | findings |');
    out.push('| --- | --- | --- | --- |');
    for (const result of scoredDensity) {
      const measured =
        result.outcome === 'scored' && result.perThousand !== undefined
          ? result.perThousand.toFixed(2)
          : '—';
      const score = result.outcome === 'scored' ? result.score.toFixed(2) : '—';
      out.push(`| ${result.rule} | ${score} | ${measured} | ${result.findings.length} |`);
    }
    out.push('');

    for (const result of scoredDensity) {
      if (result.outcome !== 'scored') continue;
      if (result.findings.length === 0 && result.score === 1) continue;
      out.push(`### ${result.rule} — ${result.score.toFixed(2)}`);
      out.push('');
      out.push(result.reason);
      out.push('');
      out.push(...quote(result));
    }
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
