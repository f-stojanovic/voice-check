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
  /** `generated` when the file declares it in frontmatter; otherwise `accepted`. */
  readonly provenance: 'accepted' | 'generated';
}

/**
 * Strips YAML frontmatter, and reads the provenance out of it on the way past.
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS: without it, the generated corpus's own
 * frontmatter — which contains the word `prompt`, a model id and a date —
 * counts as prose. It would add words to every denominator and, worse, the
 * prompt line is a sentence, so it would enter the sentence-length
 * distribution. The corpus would be measuring its own labels.
 */
export function stripFrontmatter(raw: string): {
  text: string;
  provenance: 'accepted' | 'generated';
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/u.exec(raw);
  if (match === null) return { text: raw, provenance: 'accepted' };
  const declared = /^provenance:\s*(\S+)/mu.exec(match[1] ?? '')?.[1];
  return {
    text: raw.slice(match[0].length),
    provenance: declared === 'generated' ? 'generated' : 'accepted',
  };
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

/**
 * Reads a corpus directory, descending ONE level into subdirectories.
 *
 * One level, not arbitrary depth: the generated corpus is grouped by language
 * (`corpus/generated/sr`, `.../en`) and a single calibration run should cover
 * both, but a corpus is a flat set of documents and a deep tree would mean
 * somebody has organised it into a structure this tool would then flatten and
 * ignore. Subdirectory names appear in the document name, so a report still
 * says which group a figure came from.
 */
export function readCorpus(dir: string, override?: Language): readonly Document[] {
  let names: string[];
  try {
    names = readdirSync(dir).sort();
  } catch (cause) {
    throw new Error(`cannot read ${dir} — ${(cause as Error).message}`);
  }

  const docs: Document[] = [];
  const entries: Array<{ name: string; path: string }> = [];
  for (const name of names) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      for (const inner of readdirSync(path).sort()) {
        const innerPath = join(path, inner);
        if (statSync(innerPath).isFile()) entries.push({ name: `${name}/${inner}`, path: innerPath });
      }
      continue;
    }
    entries.push({ name, path });
  }

  for (const { name, path } of entries) {
    if (!READABLE.has(extname(name).toLowerCase())) continue;
    const { text, provenance } = stripFrontmatter(readFileSync(path, 'utf8'));
    if (text.trim().length === 0) continue;
    docs.push({
      name,
      text,
      words: countWords(text),
      language: override ?? detectLanguage(text).language,
      provenance,
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

/** One rule's two distributions, and what they imply. */
export interface Band {
  readonly rule: string;
  readonly accepted: readonly number[];
  readonly generated: readonly number[];
  readonly acceptedExcluded: number;
  readonly generatedExcluded: number;
  readonly minWords: number;
}

export function bandsFor(
  accepted: readonly Observation[],
  generated: readonly Observation[],
): readonly Band[] {
  const byRule = new Map(generated.map((o) => [o.rule, o]));
  return accepted.map((a) => {
    const g = byRule.get(a.rule);
    return {
      rule: a.rule,
      accepted: a.densities,
      generated: g?.densities ?? [],
      acceptedExcluded: a.tooShort.length,
      generatedExcluded: g?.tooShort.length ?? 0,
      minWords: a.minWords || (g?.minWords ?? 0),
    };
  });
}

/**
 * The verdict on whether a rule can separate the two corpora at all.
 *
 * The floor goes at the 90th percentile of accepted writing, so nine in ten
 * accepted documents pass untouched. The ceiling goes at the 10th percentile
 * of generated writing, so nine in ten generated documents score zero. If the
 * ceiling lands at or below the floor, no pair of thresholds separates the two
 * distributions and the rule cannot tell machine from human at ANY setting.
 *
 * That is a finding about the RULE, not a failure of the run — the same shape
 * as agent-evals discovering that its semantic threshold could not classify
 * its own labelled pairs, and recording the negative result instead of
 * inventing a number to close the ticket.
 *
 * `no-signal` IS A DIFFERENT FINDING FROM `overlaps` and gets its own verdict,
 * because the first run displayed them identically and they are opposites. A
 * rule overlaps when both corpora produce densities and the ranges cross: the
 * rule fires on both kinds of text and cannot tell them apart. A rule has no
 * signal when the generated distribution is DEGENERATE — min, median and max
 * all zero, meaning it never fired on any machine-written document at all.
 *
 * Both come out as a margin of 0.00. One says "this rule cannot separate";
 * the other says "there is nothing here to separate from", and only the second
 * means the tell being looked for is absent from what the model writes.
 */
export interface Verdict {
  readonly floor: number | null;
  readonly ceiling: number | null;
  /**
   * ceiling − floor. Positive means a usable band exists.
   *
   * Null for `no-signal`, because there is no band to describe: an arithmetic
   * margin computed against a distribution that is entirely zero reads as a
   * measurement of separation and is a measurement of nothing.
   */
  readonly margin: number | null;
  /** The strictest test: does any generated value fall at or below every accepted one? */
  readonly extremesOverlap: boolean | null;
  readonly status: 'separates' | 'overlaps' | 'no-signal' | 'insufficient';
}

/** True when a rule never fired on any document of the corpus. */
export function isDegenerate(values: readonly number[]): boolean {
  return values.length > 0 && values.every((v) => v === 0);
}

export function verdictFor(band: Band, minDocs: number): Verdict {
  // Checked first, and deliberately before anything that needs the accepted
  // corpus. "This rule never fired on fifteen machine-written documents" is a
  // finding on its own, and it has to survive the accepted corpus being empty
  // — which is the situation this project is actually in.
  if (band.generated.length >= minDocs && isDegenerate(band.generated)) {
    return {
      floor: band.accepted.length > 0 ? percentile(band.accepted, 0.9) : null,
      ceiling: 0,
      margin: null,
      extremesOverlap: null,
      status: 'no-signal',
    };
  }

  if (band.accepted.length === 0 || band.generated.length === 0) {
    return { floor: null, ceiling: null, margin: null, extremesOverlap: null, status: 'insufficient' };
  }

  const floor = percentile(band.accepted, 0.9);
  const ceiling = percentile(band.generated, 0.1);
  const margin = ceiling - floor;
  const maxAccepted = band.accepted[band.accepted.length - 1] ?? 0;
  const minGenerated = band.generated[0] ?? 0;

  const extremesOverlap = minGenerated <= maxAccepted;

  if (band.accepted.length < minDocs || band.generated.length < minDocs) {
    return { floor, ceiling, margin, extremesOverlap, status: 'insufficient' };
  }

  return {
    floor,
    ceiling,
    margin,
    extremesOverlap,
    status: margin > 0 ? 'separates' : 'overlaps',
  };
}

function fmt(x: number | null): string {
  return x === null ? '—' : x.toFixed(2);
}

function stats(values: readonly number[], minDocs: number): string {
  if (values.length === 0) return 'n=0 | — | — | —';
  const n = values.length;
  const enough = n >= minDocs;
  const median = enough ? fmt(percentile(values, 0.5)) : 'n too small';
  return `n=${n} | ${fmt(values[0] ?? 0)} | ${median} | ${fmt(values[n - 1] ?? 0)}`;
}

export function formatReport(
  docs: readonly Document[],
  observations: Readonly<Record<Language, readonly Observation[]>>,
  dir: string,
  generated?: {
    readonly docs: readonly Document[];
    readonly observations: Readonly<Record<Language, readonly Observation[]>>;
    readonly dir: string;
  },
): string {
  const out: string[] = [];
  out.push(`# calibration report`);
  out.push('');
  out.push(`Accepted corpus: \`${dir}\``);
  if (generated !== undefined) out.push(`Generated corpus: \`${generated.dir}\``);
  out.push('');

  if (docs.length === 0 && (generated?.docs.length ?? 0) === 0) {
    out.push('No readable documents found (`.md`, `.markdown`, `.txt`).');
    return out.join('\n');
  }

  out.push(corpusTable('Accepted — writing you consider good', docs));
  if (generated !== undefined) {
    out.push(corpusTable('Generated — machine-written by construction', generated.docs));
  }

  const thin: string[] = [];
  if (docs.length < MIN_DOCS.value) {
    thin.push(`the accepted corpus has ${docs.length} document${docs.length === 1 ? '' : 's'}`);
  }
  if (generated !== undefined && generated.docs.length < MIN_DOCS.value) {
    thin.push(`the generated corpus has ${generated.docs.length}`);
  }
  if (thin.length > 0) {
    out.push(
      `> **Below the ${MIN_DOCS.value}-document minimum:** ${thin.join(', and ')}. ` +
        `No percentile is reported from a sample that small, and no constant should ` +
        `move on the strength of this run. Every figure below carries its own n.`,
    );
    out.push('');
  }

  for (const language of ['sr', 'en'] as const) {
    const acceptedHere = docs.filter((d) => d.language === language);
    const generatedHere = generated?.docs.filter((d) => d.language === language) ?? [];
    if (acceptedHere.length === 0 && generatedHere.length === 0) continue;

    out.push(
      `## ${language} — ${acceptedHere.length} accepted, ${generatedHere.length} generated`,
    );
    out.push('');

    if (generated === undefined) {
      out.push('| rule | n | min | median | max | implied floor | implied ceiling |');
      out.push('| --- | --- | --- | --- | --- | --- | --- |');
      for (const row of observations[language]) {
        const n = row.densities.length;
        const floor = n >= MIN_DOCS.value ? fmt(percentile(row.densities, 0.9)) : `n=${n}, too few`;
        out.push(
          `| ${row.rule} | ${stats(row.densities, MIN_DOCS.value)} | ${floor} | ` +
            `no generated corpus |`,
        );
      }
      out.push('');
      continue;
    }

    const bands = bandsFor(observations[language], generated.observations[language]);

    out.push('| rule | accepted n / min / median / max | generated n / min / median / max |');
    out.push('| --- | --- | --- |');
    for (const band of bands) {
      out.push(
        `| ${band.rule} | ${stats(band.accepted, MIN_DOCS.value)} | ` +
          `${stats(band.generated, MIN_DOCS.value)} |`,
      );
    }
    out.push('');

    out.push('| rule | implied floor (accepted p90) | implied ceiling (generated p10) | margin | verdict |');
    out.push('| --- | --- | --- | --- | --- |');
    for (const band of bands) {
      const v = verdictFor(band, MIN_DOCS.value);
      const verdict =
        v.status === 'no-signal'
          ? `**NO SIGNAL** (0/${band.generated.length} generated)`
          : v.status === 'insufficient'
            ? `too few (${band.accepted.length}/${band.generated.length})`
            : v.status === 'separates'
              ? 'separates'
              : '**OVERLAPS**';
      out.push(
        `| ${band.rule} | ${fmt(v.floor)} | ${fmt(v.ceiling)} | ${fmt(v.margin)} | ${verdict} |`,
      );
    }
    out.push('');

    const noSignal = bands.filter((b) => verdictFor(b, MIN_DOCS.value).status === 'no-signal');
    if (noSignal.length > 0) {
      out.push('### Rules that never fired on machine-written text');
      out.push('');
      out.push(
        'These rules found nothing in any generated document — the distribution ' +
          'is min 0, median 0, max 0. They cannot be calibrated against this ' +
          'corpus, and no threshold makes them detect machine writing, because ' +
          'the thing they look for is not in it.',
      );
      out.push('');
      out.push(
        'That is not the same as overlapping. An overlapping rule fires on both ' +
          'kinds of text and cannot tell them apart; these did not fire at all.',
      );
      out.push('');
      for (const band of noSignal) {
        out.push(
          `- \`${band.rule}\` — 0 of ${band.generated.length} generated documents ` +
            `(accepted: n=${band.accepted.length})`,
        );
      }
      out.push('');
    }

    const overlapping = bands.filter((b) => verdictFor(b, MIN_DOCS.value).status === 'overlaps');
    if (overlapping.length > 0) {
      out.push('### Rules that cannot separate the two corpora');
      out.push('');
      out.push(
        'For these, the 10th percentile of generated writing sits at or below the ' +
          '90th percentile of accepted writing. No pair of thresholds puts nine in ' +
          'ten of each corpus on the right side, so the rule cannot tell machine ' +
          'from human at any setting. That is a finding about the rule.',
      );
      out.push('');
      for (const band of overlapping) {
        const v = verdictFor(band, MIN_DOCS.value);
        out.push(
          `- \`${band.rule}\` — floor would be ${fmt(v.floor)}, ceiling ${fmt(v.ceiling)}, ` +
            `margin ${fmt(v.margin)} (n=${band.accepted.length} accepted, ` +
            `n=${band.generated.length} generated)`,
        );
      }
      out.push('');
    }

    const excluded = bands.filter((b) => b.acceptedExcluded + b.generatedExcluded > 0);
    if (excluded.length > 0) {
      out.push('### Abstentions, excluded from both distributions');
      out.push('');
      out.push(
        'A rule abstains below a gate derived from its own ceiling ' +
          '(`1000 / ceiling` words). Those documents contribute no density — not a ' +
          'zero, which would be a measurement the text does not support.',
      );
      out.push('');
      for (const band of excluded) {
        out.push(
          `- \`${band.rule}\`${band.minWords > 0 ? ` needs ${band.minWords} words` : ''} — ` +
            `${band.acceptedExcluded} of ${acceptedHere.length} accepted, ` +
            `${band.generatedExcluded} of ${generatedHere.length} generated`,
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
    '**The floor comes from your writing, the ceiling from the machine\'s.** The ' +
      'floor sits at the 90th percentile of the accepted corpus, so nine documents ' +
      'in ten of the writing you already accept pass that rule untouched. The ' +
      'ceiling sits at the 10th percentile of the generated corpus, so nine in ten ' +
      'generated documents score zero.',
  );
  out.push('');
  out.push(
    '**A margin at or below zero means the rule cannot separate the two corpora ' +
      'at any threshold.** Not that the calibration failed — that the rule does not ' +
      'carry the signal it was assumed to carry. Report it, do not tune around it.',
  );
  out.push('');
  out.push(
    '**`NO SIGNAL` is a different finding from `OVERLAPS`.** Overlapping means ' +
      'the rule fires on both corpora and cannot tell them apart. No signal means ' +
      'it never fired on the generated corpus at all: min, median and max are ' +
      'zero. Both show a margin of 0.00, which is why they are labelled ' +
      'separately — the second says the tell is absent from what the model writes.',
  );
  out.push('');
  out.push(
    '**Nothing here has been written to any file.** These are recommendations. ' +
      'Moving a constant is a commit somebody signs — a tool that tunes its own ' +
      'thresholds against a corpus it also scores converges on "this writing is ' +
      'perfect", which is true by construction.',
  );
  out.push('');
  out.push(
    `This run used 1 uncalibrated constant:\n  ${MIN_DOCS.id} = ${MIN_DOCS.value} — ${MIN_DOCS.note}`,
  );
  out.push('');

  return out.join('\n');
}

function corpusTable(title: string, docs: readonly Document[]): string {
  const lines: string[] = [];
  const words = docs.reduce((a, d) => a + d.words, 0);
  lines.push(`**${title}** — ${docs.length} document${docs.length === 1 ? '' : 's'}, ${words} words`);
  lines.push('');
  if (docs.length === 0) {
    lines.push('_(none)_');
    lines.push('');
    return lines.join('\n');
  }
  lines.push('| document | words | language |');
  lines.push('| --- | --- | --- |');
  for (const doc of docs) lines.push(`| ${doc.name} | ${doc.words} | \`${doc.language}\` |`);
  lines.push('');
  return lines.join('\n');
}
