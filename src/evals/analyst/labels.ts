/**
 * The label file: what a human marked, and the guard that keeps it meaningful.
 *
 * WHY MARKS RATHER THAN SCORES
 * ----------------------------
 * A human is asked which sentences carry the central claim, which carry
 * load-bearing evidence, and which are hype. Not "how good was the analysis" —
 * that is a judgement about the model's output, and it would have to be redone
 * every time the model changed. A mark is a judgement about the SOURCE, which
 * does not change. Label a source once; grade every future model against it.
 *
 * THE DERIVED-INDEX TRAP
 * ----------------------
 * A sentence number is derived from the splitter. ADR 004 in `agent-evals` says
 * a derived id erases history, and the same applies here with a nastier failure:
 * change the splitter and every mark silently points at a different sentence.
 * Nothing errors. The suite keeps reporting numbers, against labels that no
 * longer mean what the labeller meant.
 *
 * So a mark stores BOTH the index and the sentence text, and `checkLabels`
 * asserts the text still matches the text at that index. A splitter change then
 * breaks the build instead of quietly relabelling somebody's afternoon.
 *
 * The text is stored rather than a hash of it. A hash is smaller and would
 * detect the same drift, and it would make the failure unreadable: "sentence 12
 * hash mismatch" tells a human nothing about what moved, while the two strings
 * side by side show it immediately. This file is read by people more often than
 * by machines.
 */

import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { Sentence } from './sentences.js';

/**
 * The mark vocabulary.
 *
 *   C — carries the source's central claim
 *   E — load-bearing evidence; an analyst that misses this has failed
 *   H — hype: an assertion the source does not support
 *
 * Blank is the fourth and by far the commonest value, and it is represented by
 * the absence of a mark rather than by a `-` code. A vocabulary in which most
 * sentences take an explicit value is a vocabulary that makes the labeller
 * type for no information.
 */
export const MARKS = ['C', 'E', 'H'] as const;
export type Mark = (typeof MARKS)[number];

const markSchema = z.enum(MARKS);

const entrySchema = z.strictObject({
  index: z.number().int().positive(),
  /** Verbatim, and checked. See the header. */
  text: z.string().min(1),
  /** One or more. A sentence may be both the claim and hype. */
  marks: z.array(markSchema).min(1),
  /** Free text from the labeller. Never read by any scorer. */
  note: z.string().optional(),
});

export const labelFileSchema = z.strictObject({
  source: z.string().min(1),
  /** Who marked it. Required, and the point of ADR 021: a label with no human
   *  behind it is the thing this suite exists not to have. */
  labelledBy: z.string().min(1),
  labelledAt: z.string().min(1),
  language: z.enum(['sr', 'en']),
  /** Only marked sentences appear. An unmarked sentence is absent, not listed
   *  with an empty array. */
  entries: z.array(entrySchema),
});

export type LabelEntry = z.infer<typeof entrySchema>;
export type LabelFile = z.infer<typeof labelFileSchema>;

export class LabelError extends Error {
  override readonly name = 'LabelError';
  constructor(problems: readonly string[]) {
    super(`the label file cannot be used:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  }
}

export async function loadLabels(path: string): Promise<LabelFile> {
  const parsed = labelFileSchema.safeParse(parseYaml(await readFile(path, 'utf8')));
  if (!parsed.success) {
    throw new LabelError(
      parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }
  return parsed.data;
}

/**
 * The integrity check. Throws unless every mark still points at the sentence
 * its labeller was looking at.
 *
 * THIS IS THE ONLY THING STANDING BETWEEN A SPLITTER EDIT AND SILENTLY WRONG
 * LABELS, so it fails loudly and prints both strings.
 *
 * A worksheet still holding blank marks is also refused here, rather than
 * treated as "nothing is marked". An unlabelled source and a source whose every
 * sentence is genuinely unremarkable would otherwise produce identical scores,
 * and only one of them is a measurement.
 */
export function checkLabels(labels: LabelFile, sentences: readonly Sentence[]): void {
  const problems: string[] = [];

  if (labels.entries.length === 0) {
    problems.push(
      `no marks. If this worksheet has not been filled in yet, it is not a label ` +
        `file and must not be scored against — an unlabelled source and a source ` +
        `with nothing worth marking would score identically.`,
    );
  }

  const seen = new Set<number>();
  for (const entry of labels.entries) {
    if (seen.has(entry.index)) {
      problems.push(`sentence ${entry.index} appears twice; merge its marks into one entry`);
    }
    seen.add(entry.index);

    const sentence = sentences[entry.index - 1];
    if (sentence === undefined) {
      problems.push(
        `sentence ${entry.index} does not exist — the source now splits into ` +
          `${sentences.length} sentences`,
      );
      continue;
    }
    if (sentence.text !== entry.text) {
      problems.push(
        `sentence ${entry.index} has moved.\n` +
          `      labelled: ${JSON.stringify(entry.text)}\n` +
          `      now at ${entry.index}: ${JSON.stringify(sentence.text)}\n` +
          `      The splitter or the source changed after this was labelled. Re-run ` +
          `the worksheet and re-mark it; do not renumber by hand.`,
      );
    }
  }

  if (problems.length > 0) throw new LabelError(problems);
}

/** Every sentence index carrying `mark`. */
export function indicesFor(labels: LabelFile, mark: Mark): number[] {
  return labels.entries.filter((e) => e.marks.includes(mark)).map((e) => e.index).sort((a, b) => a - b);
}
