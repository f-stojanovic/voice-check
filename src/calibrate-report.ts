/**
 * `npm run calibrate -- <dir>`
 *
 * Reads a directory of texts the author considers good and reports, per rule,
 * the density distribution he actually writes at — and what floor that
 * distribution would imply.
 *
 * IT RECOMMENDS. IT DOES NOT WRITE. Nothing here edits a constant, and that is
 * the point rather than an unfinished feature. A tool that tunes its own
 * thresholds against a corpus it also scores is measuring nothing: it would
 * converge on "the author's writing is perfect", which is true by construction
 * and useless. The same reasoning is why agent-evals refuses to let a model
 * assign its own calibration labels (its ADR 021). The numbers are a proposal;
 * moving a constant is a commit somebody signs.
 *
 * WHAT IT CANNOT DERIVE. A floor is "how much of this appears in good
 * writing", and a corpus of good writing answers that. A CEILING is "how much
 * appears in writing that has gone wrong", and no corpus of good writing
 * contains that information at all. This report says so per rule rather than
 * extrapolating a ceiling from a maximum and letting it look derived.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { detectLanguage } from './detect.js';
import { rulesFor } from './rules/index.js';
import { countWords } from './text.js';
import { guess } from './uncalibrated.js';
import type { Language, Lexicon } from './types.js';

/**
 * Documents below which no percentile is reported for a rule.
 *
 * A 90th percentile of four numbers is the largest of the four wearing a
 * statistical hat. This is a guess about when a distribution starts to exist,
 * declared like every other guess, and it is deliberately not the same kind of
 * number as a floor: being wrong here means reporting noise as a finding.
 */
const MIN_DOCS = guess(
  'calibrate.min-docs',
  10,
  'documents below which no percentile is reported for a rule; a guess about ' +
    'when a distribution starts to exist, which would be settled by resampling ' +
    'a real corpus and seeing where the percentile stabilises',
);

const READABLE = new Set(['.md', '.markdown', '.txt']);

export interface Document {
  readonly name: string;
  readonly text: string;
  readonly words: number;
  readonly language: Language;
}

/** One rule's observations across the corpus. */
export interface Observation {
  readonly rule: string;
  readonly language: Language;
  /** Densities, one per document long enough for this rule to measure. */
  readonly densities: readonly number[];
  /** Documents where the rule abstained, so contributed no density. */
  readonly tooShort: readonly string[];
  /** The gate that excluded them, as reported by the rule itself. 0 if none. */
  readonly minWords: number;
}

export function readCorpus(dir: string, override?: Language): readonly Document[] {
  let names: string[];
  try {
    names = readdirSync(dir).sort();
  } catch (cause) {
    throw new Error(`cannot read ${dir} — ${(cause as Error).message}`);
  }

  const docs: Document[] = [];
  for (const name of names) {
    const path = join(dir, name);
    if (!statSync(path).isFile()) continue;
    if (!READABLE.has(extname(name).toLowerCase())) continue;
    const text = readFileSync(path, 'utf8');
    if (text.trim().length === 0) continue;
    docs.push({
      name,
      text,
      words: countWords(text),
      language: override ?? detectLanguage(text).language,
    });
  }
  return docs;
}

/**
 * Densities per rule, measured directly rather than read off a RuleResult.
 *
 * A rule that abstains returns no number, and for calibration the raw density
 * is exactly what is wanted from every document long enough to produce a
 * meaningful one. So the gate is applied here, by the same derived rule, and
 * excluded documents are counted rather than silently dropped.
 */
export function observe(
  docs: readonly Document[],
  language: Language,
  lexicons: Readonly<Record<Language, Lexicon>>,
): readonly Observation[] {
  const inLanguage = docs.filter((d) => d.language === language);
  const lexicon = lexicons[language];

  return rulesFor(language)
    .filter((rule) => rule.kind === 'density')
    .map((rule) => {
      const densities: number[] = [];
      const tooShort: string[] = [];
      let minWords = 0;

      for (const doc of inLanguage) {
        // The rule's own verdict decides. An earlier version recomputed the
        // gate here by string-matching a constant id, missed
        // `density.phrase-ceiling` because it ends in `-ceiling` rather than
        // `.ceiling`, and silently used a gate of 0 — so six rules reported
        // "no data" with no exclusion to explain it. Two implementations of
        // one gate is one too many.
        const result = rule.check(doc.text, { language, wordCount: doc.words, lexicon });
        if (result.outcome === 'abstained') {
          tooShort.push(doc.name);
          if (result.minWords !== undefined) minWords = result.minWords;
          continue;
        }
        if (result.perThousand !== undefined) densities.push(result.perThousand);
      }

      return {
        rule: rule.name,
        language,
        densities: densities.sort((a, b) => a - b),
        tooShort,
        minWords,
      };
    });
}

/** Linear-interpolated percentile over a sorted array. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  if (sorted.length === 1) return sorted[0] ?? Number.NaN;
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  const lowValue = sorted[low] ?? 0;
  const highValue = sorted[high] ?? 0;
  return lowValue + (highValue - lowValue) * (index - low);
}

export function formatReport(
  docs: readonly Document[],
  observations: Readonly<Record<Language, readonly Observation[]>>,
  dir: string,
): string {
  const out: string[] = [];
  out.push(`# calibration report: ${dir}`);
  out.push('');

  if (docs.length === 0) {
    out.push('No readable documents found (`.md`, `.markdown`, `.txt`).');
    return out.join('\n');
  }

  out.push(`**${docs.length} document${docs.length === 1 ? '' : 's'}**, totalling ${docs.reduce((a, d) => a + d.words, 0)} words:`);
  out.push('');
  out.push('| document | words | language |');
  out.push('| --- | --- | --- |');
  for (const doc of docs) out.push(`| ${doc.name} | ${doc.words} | \`${doc.language}\` |`);
  out.push('');

  if (docs.length < MIN_DOCS.value) {
    out.push(
      `> **This corpus is too small to calibrate anything.** ${docs.length} document` +
        `${docs.length === 1 ? '' : 's'} against a minimum of ${MIN_DOCS.value}. ` +
        `No percentile below is reported, and no constant should move on the ` +
        `strength of this run. What follows is the raw observation — every ` +
        `figure carries its own n, and an n of 1 or 2 is a reading, not a ` +
        `distribution.`,
    );
    out.push('');
  }

  for (const language of ['sr', 'en'] as const) {
    const rows = observations[language];
    const inLanguage = docs.filter((d) => d.language === language);
    if (inLanguage.length === 0) continue;

    out.push(`## ${language} — ${inLanguage.length} document${inLanguage.length === 1 ? '' : 's'}`);
    out.push('');
    out.push('| rule | n | min | median | p90 | max | implied floor | implied ceiling |');
    out.push('| --- | --- | --- | --- | --- | --- | --- | --- |');

    for (const row of rows) {
      const n = row.densities.length;
      if (n === 0) {
        out.push(
          `| ${row.rule} | 0 | — | — | — | — | ${
            row.tooShort.length > 0 ? 'every document too short' : 'no data'
          } | not derivable |`,
        );
        continue;
      }
      const fmt = (x: number): string => x.toFixed(2);
      const enough = n >= MIN_DOCS.value;
      const p90 = enough ? fmt(percentile(row.densities, 0.9)) : `n=${n}`;
      const median = enough ? fmt(percentile(row.densities, 0.5)) : `n=${n}`;
      out.push(
        `| ${row.rule} | ${n} | ${fmt(row.densities[0] ?? 0)} | ${median} | ${p90} | ` +
          `${fmt(row.densities[n - 1] ?? 0)} | ${
            enough ? fmt(percentile(row.densities, 0.9)) : `n=${n}, too few`
          } | not derivable |`,
      );
    }
    out.push('');

    const excluded = rows.filter((r) => r.tooShort.length > 0);
    if (excluded.length > 0) {
      out.push('### Excluded as too short');
      out.push('');
      out.push(
        'Each rule abstains below a gate derived from its own ceiling ' +
          '(`1000 / ceiling` words). Documents under that gate contribute no ' +
          'density, because one occurrence in them would already sit at the ceiling.',
      );
      out.push('');
      for (const row of excluded) {
        out.push(
          `- \`${row.rule}\`${row.minWords > 0 ? ` needs ${row.minWords} words` : ''} — ` +
            `abstained on ${row.tooShort.length} of ${inLanguage.length}: ` +
            `${row.tooShort.join(', ')}`,
        );
      }
      out.push('');
    }
  }

  out.push('---');
  out.push('');
  out.push('## How to read this');
  out.push('');
  out.push(
    '**The implied floor is the 90th percentile of your own writing.** The floor ' +
      'is the density at or below which a rule scores a clean 1.0, so setting it ' +
      'at your p90 means nine documents in ten of the writing you already accept ' +
      'pass that rule untouched.',
  );
  out.push('');
  out.push(
    '**No ceiling is derivable from this corpus, and none is offered.** A ceiling ' +
      'is the density at which a rule scores 0 — "this much is machine-written" — ' +
      'and a corpus of writing you consider good contains no information about ' +
      'that. Extrapolating one from the maximum would produce a number that looks ' +
      'measured and is not. Calibrating ceilings needs a second corpus: texts you ' +
      'consider machine-written, labelled by you.',
  );
  out.push('');
  out.push(
    `**Nothing here has been written to any file.** These are recommendations. ` +
      `Moving a constant is a commit somebody signs — a tool that tunes its own ` +
      `thresholds against a corpus it also scores converges on "this writing is ` +
      `perfect", which is true by construction.`,
  );
  out.push('');
  out.push(`This run used 1 uncalibrated constant:\n  ${MIN_DOCS.id} = ${MIN_DOCS.value} — ${MIN_DOCS.note}`);
  out.push('');

  return out.join('\n');
}
