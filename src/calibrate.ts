/**
 * `npm run calibrate -- <dir>` — the command shell.
 *
 * The measurement lives in `calibrate-report.ts` so a test can call it without
 * running a process. This file is argument parsing and exit codes.
 */

import { loadLexicon } from './lexicon.js';
import { formatReport, observe, readCorpus } from './calibrate-report.js';
import type { Language } from './types.js';

const USAGE = `voice-check calibrate — reports the density distribution of a corpus you consider good.

  npm run calibrate -- <dir> [--lang sr|en]

It recommends. It never writes a constant.`;

function main(): number {
  const argv = process.argv.slice(2);
  let dir: string | undefined;
  let override: Language | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--lang') {
      const value = argv[++i];
      if (value !== 'sr' && value !== 'en') {
        process.stderr.write(`calibrate: --lang must be "sr" or "en"\n`);
        return 2;
      }
      override = value;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    } else if (arg !== undefined && !arg.startsWith('-')) {
      dir = arg;
    }
  }

  if (dir === undefined) {
    process.stderr.write(`calibrate: no directory given\n\n${USAGE}\n`);
    return 2;
  }

  try {
    const docs = readCorpus(dir, override);
    const lexicons = { sr: loadLexicon('sr'), en: loadLexicon('en') } as const;
    const observations = {
      sr: observe(docs, 'sr', lexicons),
      en: observe(docs, 'en', lexicons),
    } as const;
    process.stdout.write(`${formatReport(docs, observations, dir)}\n`);
    return 0;
  } catch (cause) {
    process.stderr.write(`calibrate: ${(cause as Error).message}\n`);
    return 2;
  }
}

process.exit(main());
