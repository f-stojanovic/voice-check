/**
 * `npm run check -- <file> [--lang sr|en] [--json]`
 *
 * Exit 1 on any hard failure and 0 otherwise, INCLUDING on a bad density
 * score. That is deliberate: a density score is a number for a writer to read
 * and argue with, not a gate. Failing a build because a text scored 0.71 would
 * make the number a threshold in disguise, and the whole design rests on the
 * threshold being a display choice that can move without invalidating anything
 * already recorded. Hard rules are different in kind, and only they exit 1.
 */

import { readFileSync } from 'node:fs';
import { detectLanguage } from './detect.js';
import { LexiconError } from './lexicon.js';
import { check, formatMarkdown } from './report.js';
import type { Language } from './types.js';

interface Args {
  readonly file: string;
  readonly language?: Language;
  readonly json: boolean;
}

const USAGE = `voice-check — grades prose against the style guide it was compiled from.

  npm run check -- <file> [--lang sr|en] [--json]

  --lang sr|en   skip language detection
  --json         emit the Report as JSON instead of a markdown report

Exits 1 on a hard failure. A low density score is a finding, not a gate.`;

function parseArgs(argv: readonly string[]): Args {
  let file: string | undefined;
  let language: Language | undefined;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--lang') {
      const value = argv[++i];
      if (value !== 'sr' && value !== 'en') {
        throw new Error(`--lang must be "sr" or "en", got ${JSON.stringify(value ?? '')}`);
      }
      language = value;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(`${USAGE}\n`);
      process.exit(0);
    } else if (arg !== undefined && arg.startsWith('-')) {
      throw new Error(`unknown option ${arg}`);
    } else if (arg !== undefined) {
      if (file !== undefined) throw new Error(`expected one file, got "${file}" and "${arg}"`);
      file = arg;
    }
  }

  if (file === undefined) throw new Error('no file given');
  return language === undefined ? { file, json } : { file, language, json };
}

function main(): number {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (cause) {
    process.stderr.write(`voice-check: ${(cause as Error).message}\n\n${USAGE}\n`);
    return 2;
  }

  let text: string;
  try {
    text = readFileSync(args.file, 'utf8');
  } catch (cause) {
    process.stderr.write(`voice-check: cannot read ${args.file} — ${(cause as Error).message}\n`);
    return 2;
  }

  const detected = args.language === undefined ? detectLanguage(text) : undefined;
  const language = args.language ?? detected?.language ?? 'en';

  let outcome;
  try {
    outcome = check(text, { language });
  } catch (cause) {
    // A LexiconError is a defect in the tool's own data, not in the text, and
    // must not be reported as a style finding.
    const prefix = cause instanceof LexiconError ? 'lexicon' : 'internal';
    process.stderr.write(`voice-check: ${prefix} error — ${(cause as Error).message}\n`);
    return 2;
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(outcome.report, null, 2)}\n`);
  } else {
    const markdown = formatMarkdown(outcome, args.file, detected?.basis);
    process.stdout.write(`${markdown}\n`);
  }

  return outcome.report.hardFailures.length > 0 ? 1 : 0;
}

process.exit(main());
