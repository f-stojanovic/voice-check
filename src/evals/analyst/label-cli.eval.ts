/**
 * `npm run label:analyst -- <source-file>` — emit a blank worksheet.
 *
 * Writes `evals/analyst/labels/<name>.labels.yaml` and refuses to overwrite one
 * that already exists. Overwriting is the one destructive thing this command
 * could do, and what it would destroy is the only artifact in this repository
 * that cannot be regenerated: somebody's afternoon of reading.
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { splitSentences } from './sentences.js';
import { emitWorksheet } from './worksheet.js';

const SOURCES_DIR = 'evals/analyst/sources';
const LABELS_DIR = 'evals/analyst/labels';

function detectLanguage(text: string): 'sr' | 'en' {
  /* The same two signals analyst.ts uses, and the same conservatism: Cyrillic
     is unambiguous, Serbian Latin is detected by diacritics. A wrong guess here
     costs nothing that cannot be fixed by editing one line of the worksheet,
     which is why this is a default rather than a decision. */
  if (/\p{Script=Cyrillic}/u.test(text)) return 'sr';
  return /[šđčćžŠĐČĆŽ]/u.test(text) ? 'sr' : 'en';
}

export async function main(argv: readonly string[]): Promise<number> {
  const arg = argv[0];
  if (arg === undefined) {
    console.error(
      `usage: npm run label:analyst -- <source>\n\n` +
        `  <source> is a file in ${SOURCES_DIR}/, or a path to one.\n`,
    );
    return 1;
  }

  const path = arg.includes('/') ? arg : join(SOURCES_DIR, arg);
  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch {
    console.error(`cannot read ${path}`);
    return 1;
  }

  if (source.trim().length === 0) {
    console.error(`${path} is empty — there is nothing to label`);
    return 1;
  }

  const sentences = splitSentences(source);
  const name = basename(path).replace(/\.[^.]+$/u, '');
  const out = join(LABELS_DIR, `${name}.labels.yaml`);

  if (await exists(out)) {
    console.error(
      `${out} already exists, and this command will not overwrite it.\n\n` +
        `That file is hand-marked and cannot be regenerated. If you mean to start\n` +
        `over, move it aside yourself.`,
    );
    return 1;
  }

  await mkdir(LABELS_DIR, { recursive: true });
  await writeFile(
    out,
    emitWorksheet({ sourceName: basename(path), language: detectLanguage(source), sentences }),
    'utf8',
  );

  console.log(
    `${out}\n` +
      `  ${sentences.length} sentences, every mark blank.\n` +
      `  Fill in labelledBy and labelledAt, mark what needs marking, delete the rest.`,
  );
  return 0;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

process.exitCode = await main(process.argv.slice(2));
