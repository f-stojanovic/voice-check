/**
 * `npm run calibrate -- <dir>` — the command shell.
 *
 * The measurement lives in `calibrate-report.ts` so a test can call it without
 * running a process. This file is argument parsing and exit codes.
 */

import { loadLexicon } from './lexicon.js';
import { formatReport, observe, readCorpus } from './calibrate-report.js';
import type { Language } from './types.js';

const USAGE = `voice-check calibrate — compares the density distributions of two corpora.

  npm run calibrate -- <accepted-dir> [--generated <dir>] [--lang sr|en]

  <accepted-dir>      texts you consider good. Gives the FLOOR.
  --generated <dir>   machine-written texts. Gives the CEILING.
  --lang sr|en        treat EVERY document as this language, overriding
                      detection. On a mixed corpus that mislabels half of it;
                      leave it off unless detection is getting one wrong.

Without --generated only floors are reported: a corpus of good writing carries
no information about where bad writing sits.

It recommends. It never writes a constant.`;

function main(): number {
  const argv = process.argv.slice(2);
  let dir: string | undefined;
  let generatedDir: string | undefined;
  let override: Language | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--generated') {
      generatedDir = argv[++i];
    } else if (arg === '--lang') {
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
    const lexicons = { sr: loadLexicon('sr'), en: loadLexicon('en') } as const;
    const docs = readCorpus(dir, override);
    const observations = {
      sr: observe(docs, 'sr', lexicons),
      en: observe(docs, 'en', lexicons),
    } as const;

    if (generatedDir === undefined) {
      process.stdout.write(`${formatReport(docs, observations, dir)}\n`);
      return 0;
    }

    const generatedDocs = readCorpus(generatedDir, override);
    const notGenerated = generatedDocs.filter((d) => d.provenance !== 'generated');
    if (notGenerated.length > 0) {
      // The provenance IS the label. A file in the generated directory without
      // it is unlabelled, and quietly counting it as machine-written would
      // reintroduce exactly the human judgement this corpus avoids needing.
      process.stderr.write(
        `calibrate: ${notGenerated.length} file(s) in ${generatedDir} carry no ` +
          `\`provenance: generated\` frontmatter: ${notGenerated.map((d) => d.name).join(', ')}\n`,
      );
      return 2;
    }

    process.stdout.write(
      `${formatReport(docs, observations, dir, {
        docs: generatedDocs,
        dir: generatedDir,
        observations: {
          sr: observe(generatedDocs, 'sr', lexicons),
          en: observe(generatedDocs, 'en', lexicons),
        },
      })}\n`,
    );
    return 0;
  } catch (cause) {
    process.stderr.write(`calibrate: ${(cause as Error).message}\n`);
    return 2;
  }
}

process.exit(main());
