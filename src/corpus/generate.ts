/**
 * Generating the negative corpus.
 *
 * `npm run corpus:generate -- --lang sr|en --count 15 --out corpus/generated`
 *
 * THE POINT OF THIS FILE, and the reason it is not the same problem as
 * agent-evals ADR 021:
 *
 * That repository refuses to let a model assign a calibration label, because a
 * label is a JUDGEMENT — "is this answer correct?" — and a model grading
 * itself produces a figure that measures the grading rather than the thing.
 *
 * Here there is no judgement to make. These texts are machine-written BY
 * CONSTRUCTION: a model was asked for a blog post and this is what came back.
 * The provenance IS the label. Nobody has to decide whether a text belongs in
 * the negative corpus, so there is no annotator to disagree with, no
 * inter-rater reliability to worry about, and nothing for a second reader to
 * check. It is the inverse of the labelling problem rather than an instance of
 * it: the thing that is usually expensive and contested is here free and
 * certain, and it is the POSITIVE corpus — writing the author accepts — that
 * needs a human, because "I consider this good" is exactly the judgement a
 * model cannot make for him.
 *
 * The frontmatter records model, date and the exact prompt, so a reader can
 * re-derive the corpus rather than take a ceiling on faith.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type { ModelClient } from '../agents/client.js';
import { addUsage, costUsd, ZERO_USAGE, type Usage } from '../agents/pricing.js';
import { countWords } from '../text.js';
import type { Language } from '../types.js';
import { SUBJECTS, type Subject } from './subjects.js';

export interface GeneratedDoc {
  readonly filename: string;
  readonly contents: string;
  readonly words: number;
  readonly subject: Subject;
}

export interface GenerateResult {
  readonly docs: readonly GeneratedDoc[];
  readonly usage: Usage;
  readonly model: string;
  readonly costUsd: number | null;
}

/**
 * WHY THE FRONTMATTER IS PART OF THE FILE rather than a sidecar index: a text
 * that gets copied out of the directory without its provenance becomes a text
 * somebody might mistake for a human's. The label travels with the sample.
 */
export function frontmatter(fields: {
  subject: string;
  format: string;
  language: Language;
  model: string;
  date: string;
  prompt: string;
  words: number;
}): string {
  return `---\n${stringifyYaml({
    provenance: 'generated',
    subject: fields.subject,
    format: fields.format,
    language: fields.language,
    model: fields.model,
    generated: fields.date,
    words: fields.words,
    // The exact string sent to the model. No style instruction: see
    // `subjects.ts` for why that absence is the whole design.
    prompt: fields.prompt,
  }).trimEnd()}\n---\n`;
}

/**
 * Generates the corpus, emitting each document as it arrives.
 *
 * `onDoc` exists because the first version returned everything at the end and
 * wrote nothing until the whole run succeeded — so a failure on the fifteenth
 * call threw away fourteen paid-for generations. A long, expensive, sequential
 * job should persist as it goes.
 */
export async function generate(
  client: ModelClient,
  options: {
    language: Language;
    count: number;
    date: string;
    /**
     * Generate only these subject ids.
     *
     * Added after a run stalled on its fifteenth request and had to be killed,
     * leaving one subject missing. Without this the only way to fill a gap was
     * to regenerate the whole corpus, which costs the whole corpus again and
     * replaces fourteen good documents to obtain one.
     */
    only?: readonly string[];
    onDoc?: (doc: GeneratedDoc, index: number) => void;
  },
): Promise<GenerateResult> {
  const subjects =
    options.only === undefined
      ? SUBJECTS.slice(0, options.count)
      : SUBJECTS.filter((s) => options.only?.includes(s.id));
  const docs: GeneratedDoc[] = [];
  let usage = ZERO_USAGE;
  let model = 'unknown';

  for (const subject of subjects) {
    const prompt = subject.prompt[options.language];
    // No system prompt at all. A system prompt is a style instruction even
    // when it is trying not to be — "you are a helpful assistant" changes the
    // register, and the register is the measurement.
    const response = await client.complete({ userContent: prompt });
    usage = addUsage(usage, response.usage);
    model = response.model;

    const words = countWords(response.text);
    const body =
      frontmatter({
        subject: subject.id,
        format: subject.format,
        language: options.language,
        model: response.model,
        date: options.date,
        prompt,
        words,
      }) + `\n${response.text}\n`;

    const doc = {
      filename: `${options.language}-${subject.id}.md`,
      contents: body,
      words,
      subject,
    };
    docs.push(doc);
    options.onDoc?.(doc, docs.length - 1);
  }

  return { docs, usage, model, costUsd: costUsd(model, usage) };
}

export function writeCorpus(dir: string, docs: readonly GeneratedDoc[]): void {
  mkdirSync(dir, { recursive: true });
  for (const doc of docs) writeDoc(dir, doc);
}

export function writeDoc(dir: string, doc: GeneratedDoc): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, doc.filename), doc.contents, 'utf8');
}
