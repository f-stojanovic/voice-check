/**
 * `npm run corpus:generate -- --lang sr|en --count 15 --out corpus/generated`
 *
 * The command shell. The generation lives in `corpus/generate.ts` so a test
 * can call it without a network or a process.
 */

import { anthropicClient, ModelUnavailableError } from './agents/client.js';
import { MissingApiKeyError } from './agents/env.js';
import { formatCost } from './agents/pricing.js';
import { generate, writeDoc } from './corpus/generate.js';
import { SUBJECTS } from './corpus/subjects.js';
import type { Language } from './types.js';

const USAGE = `voice-check corpus:generate — generates the negative corpus.

  npm run corpus:generate -- --lang sr|en [--count N] [--out <dir>] [--date YYYY-MM-DD]
  npm run corpus:generate -- --lang sr --only houseplants-howto --out <dir>   # fill a gap

Texts are machine-written by construction: the provenance is the label, so
nothing here needs a human annotator. The prompts carry no style instruction —
the default register is the thing being measured.

This spends money. ${SUBJECTS.length} subjects are available.`;

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  let language: Language | undefined;
  let count = SUBJECTS.length;
  let out: string | undefined;
  let date: string | undefined;
  let only: string[] | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--lang') {
      const value = argv[++i];
      if (value !== 'sr' && value !== 'en') {
        process.stderr.write(`corpus:generate: --lang must be "sr" or "en"\n`);
        return 2;
      }
      language = value;
    } else if (arg === '--count') {
      count = Number(argv[++i]);
      if (!Number.isInteger(count) || count < 1 || count > SUBJECTS.length) {
        process.stderr.write(
          `corpus:generate: --count must be between 1 and ${SUBJECTS.length}\n`,
        );
        return 2;
      }
    } else if (arg === '--out') {
      out = argv[++i];
    } else if (arg === '--date') {
      date = argv[++i];
    } else if (arg === '--only') {
      only = (argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    }
  }

  if (language === undefined || out === undefined) {
    process.stderr.write(`corpus:generate: --lang and --out are required\n\n${USAGE}\n`);
    return 2;
  }

  // The date is passed in rather than read from the clock by default, so a
  // regenerated corpus is reproducible and its frontmatter can be compared.
  const stamp = date ?? new Date().toISOString().slice(0, 10);

  try {
    const target = out;
    const result = await generate(anthropicClient(), {
      language,
      count,
      date: stamp,
      ...(only === undefined ? {} : { only }),
      onDoc: (doc, i) => {
        writeDoc(target, doc);
        process.stderr.write(
          `  [${i + 1}/${only?.length ?? count}] ${doc.filename} — ${doc.words} words\n`,
        );
      },
    });

    const words = result.docs.reduce((a, d) => a + d.words, 0);
    process.stdout.write(
      `wrote ${result.docs.length} ${language} documents to ${out}\n` +
        `${words} words total, ${Math.round(words / result.docs.length)} mean\n` +
        `${formatCost(result.costUsd)} · ${result.usage.inputTokens} in / ` +
        `${result.usage.outputTokens} out · ${result.model}\n`,
    );
    for (const doc of result.docs) {
      process.stdout.write(`  ${doc.filename} — ${doc.words} words\n`);
    }
    return 0;
  } catch (cause) {
    if (cause instanceof MissingApiKeyError || cause instanceof ModelUnavailableError) {
      process.stderr.write(`corpus:generate: ${cause.message}\n`);
      return 3;
    }
    process.stderr.write(`corpus:generate: ${(cause as Error).message}\n`);
    return 1;
  }
}

process.exit(await main());
