/**
 * `npm run brief -- <file|url> [--lang sr|en] [--json]`
 *
 * Two agent calls, in sequence, and then it stops. What comes out is material
 * for a writer: what the source claims, what it proves, what is new, what is
 * hype, what it leaves open — and two or three angles, each ending in a
 * question back to the writer. There is no third call that turns that into a
 * post, and `src/agents/no-writer.ts` is the argument for why not.
 *
 * The cost of the run is printed. A pipeline whose price nobody has measured
 * is a pipeline nobody can decide to run twice.
 */

import { analyse, verifyQuotes, EmptySourceError } from './agents/analyst.js';
import { findAngles, DEFAULT_AUDIENCE } from './agents/angles.js';
import {
  anthropicClient,
  MalformedToolCallError,
  ModelUnavailableError,
  type AgentRun,
} from './agents/client.js';
import { ExtractionError, loadSource } from './agents/extract.js';
import { MissingApiKeyError } from './agents/env.js';
import { THE_REFUSAL } from './agents/no-writer.js';
import { addUsage, costUsd, formatCost, PRICING_AS_OF, ZERO_USAGE } from './agents/pricing.js';
import { detectLanguage } from './detect.js';
import type { Language } from './types.js';

const USAGE = `voice-check brief — prepares material from a source. It does not write the post.

  npm run brief -- <file|url> [--lang sr|en] [--json]

  --lang sr|en   skip language detection
  --json         emit the brief as JSON instead of markdown

Reads the API key from .env at the project root, never from the environment.`;

interface Args {
  readonly target: string;
  readonly language?: Language;
  readonly json: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  let target: string | undefined;
  let language: Language | undefined;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') json = true;
    else if (arg === '--lang') {
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
      if (target !== undefined) throw new Error(`expected one source, got "${target}" and "${arg}"`);
      target = arg;
    }
  }

  if (target === undefined) throw new Error('no file or URL given');
  return language === undefined ? { target, json } : { target, language, json };
}

async function main(): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (cause) {
    process.stderr.write(`brief: ${(cause as Error).message}\n\n${USAGE}\n`);
    return 2;
  }

  try {
    const source = await loadSource(args.target);
    const detected = args.language === undefined ? detectLanguage(source.text) : undefined;
    const language = args.language ?? detected?.language ?? 'en';

    const client = anthropicClient();

    const analysis = await analyse(client, {
      text: source.text,
      language,
      origin: source.origin,
    });

    // The audience is a property of the WRITER, not of the source. A Serbian
    // writer reading an English article still writes for Serbian readers, so
    // the audience profile does not follow the source's language — an earlier
    // version swapped it and produced a profile that described Serbian
    // beginners while instructing the model to answer in English.
    const angles = await findAngles(client, analysis.value, DEFAULT_AUDIENCE);
    const quotes = verifyQuotes(analysis.value, source.text);

    if (args.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            source: { origin: source.origin, via: source.via, language },
            analysis: analysis.value,
            angles: angles.value,
            traceability: quotes,
            cost: summariseCost([analysis, angles]),
          },
          null,
          2,
        )}\n`,
      );
    } else {
      process.stdout.write(
        `${renderBrief({
          origin: source.origin,
          via: source.via,
          language,
          detectedBasis: detected?.basis,
          analysis,
          angles,
          quotes,
        })}\n`,
      );
    }
    return 0;
  } catch (cause) {
    return reportFailure(cause);
  }
}

/**
 * One exit code per kind of failure, because they need different responses.
 * A malformed tool call is worth retrying; a missing key never is.
 */
function reportFailure(cause: unknown): number {
  if (cause instanceof MissingApiKeyError) {
    process.stderr.write(`brief: ${cause.message}\n`);
    return 3;
  }
  if (cause instanceof ExtractionError) {
    process.stderr.write(`brief: ${cause.message}\n`);
    return 4;
  }
  if (cause instanceof EmptySourceError) {
    process.stderr.write(`brief: ${cause.message}\n`);
    return 4;
  }
  if (cause instanceof ModelUnavailableError) {
    process.stderr.write(`brief: ${cause.message}\n`);
    return 5;
  }
  if (cause instanceof MalformedToolCallError) {
    process.stderr.write(
      `brief: ${cause.message}\n\nThis is the model, not the API. Retrying is reasonable.\n`,
    );
    return 6;
  }
  process.stderr.write(`brief: unexpected — ${(cause as Error).message}\n`);
  return 1;
}

function summariseCost(runs: readonly AgentRun<unknown>[]): {
  usd: number | null;
  usage: ReturnType<typeof addUsage>;
  model: string;
  asOf: string;
} {
  const usage = runs.reduce((acc, r) => addUsage(acc, r.usage), ZERO_USAGE);
  const model = runs[0]?.model ?? 'unknown';
  // Recomputed from the summed usage rather than added up from the per-run
  // figures, so rounding cannot make the total disagree with the parts.
  return { usd: costUsd(model, usage), usage, model, asOf: PRICING_AS_OF };
}

function renderBrief(input: {
  origin: string;
  via: string;
  language: Language;
  detectedBasis?: string | undefined;
  analysis: AgentRun<import('./agents/analyst.js').Analysis>;
  angles: AgentRun<import('./agents/angles.js').Angles>;
  quotes: readonly import('./agents/analyst.js').QuoteCheck[];
}): string {
  const { analysis, angles } = input;
  const a = analysis.value;
  const out: string[] = [];

  out.push(`# brief: ${input.origin}`);
  out.push('');
  out.push(`Read via ${input.via} · \`${input.language}\`${input.detectedBasis === undefined ? '' : ` (detected: ${input.detectedBasis})`}`);
  out.push('');

  out.push('## The claim');
  out.push('');
  out.push(a.claim.statement);
  if (a.claim.quote.trim().length > 0) out.push('', `> ${a.claim.quote}`);
  out.push('');

  out.push('## Evidence');
  out.push('');
  if (a.evidence.length === 1 && a.evidence[0]?.kind === 'none') {
    out.push(`**None offered.** ${a.evidence[0].statement}`);
  } else {
    for (const e of a.evidence) {
      out.push(`- **${e.kind}** — ${e.statement}`);
      if (e.quote.trim().length > 0) out.push(`  > ${e.quote}`);
    }
  }
  out.push('');

  out.push('## Novelty');
  out.push('');
  out.push(
    a.novelty.genuinelyNew.length === 0
      ? '**Nothing genuinely new.** The analyst found no point here that is not already common currency.'
      : `Genuinely new (${a.novelty.genuinelyNew.length}):`,
  );
  for (const n of a.novelty.genuinelyNew) out.push(`- ${n.statement}`);
  if (a.novelty.restated.length > 0) {
    out.push('', `Restated as insight (${a.novelty.restated.length}):`);
    for (const n of a.novelty.restated) out.push(`- ${n.statement}`);
  }
  out.push('');

  out.push('## Hype');
  out.push('');
  if (a.hype.length === 0) out.push('None found — the source supports what it asserts.');
  for (const h of a.hype) {
    out.push(`- ${h.statement}`);
    if (h.quote.trim().length > 0) out.push(`  > ${h.quote}`);
  }
  out.push('');

  out.push('## Left open');
  out.push('');
  if (a.openQuestions.length === 0) out.push('Nothing recorded.');
  for (const q of a.openQuestions) out.push(`- ${q}`);
  out.push('');

  out.push('## Angles');
  out.push('');
  angles.value.angles.forEach((angle, i) => {
    // The hook is a sentence or two of prose, not a title. Rendering it as the
    // heading made a paragraph-length hook look like a section name — the kind
    // of formatting that quietly encourages the model to write longer.
    out.push(`### Angle ${i + 1}`);
    out.push('');
    out.push(angle.hook);
    out.push('');
    out.push(`**Why this audience:** ${angle.whyThisAudience}`);
    out.push('');
    out.push(`**Your turn:** ${angle.questionForWriter}`);
    out.push('');
  });
  if (angles.value.thin.trim().length > 0) {
    out.push(`*Thin:* ${angles.value.thin}`);
    out.push('');
  }

  // Traceability is a measured figure, printed whether it is good or bad. A
  // quote the model paraphrased is a statement traced to nothing, and the
  // reader is entitled to know which statements those are.
  const found = input.quotes.filter((q) => q.found).length;
  out.push('---');
  out.push('');
  out.push(
    `**Traceability:** ${found} of ${input.quotes.length} quotes found verbatim in the source.`,
  );
  const missing = input.quotes.filter((q) => !q.found);
  if (missing.length > 0) {
    out.push('');
    out.push('Not found — these statements are traced to text that is not in the source:');
    for (const q of missing) out.push(`- \`${q.field}\` — ${JSON.stringify(q.quote.slice(0, 80))}`);
  }
  out.push('');

  const cost = summariseCost([analysis, angles]);
  out.push(
    `**Cost:** ${formatCost(cost.usd)} · ${cost.usage.inputTokens} in / ` +
      `${cost.usage.outputTokens} out · \`${cost.model}\` · rates as of ${cost.asOf}`,
  );
  out.push('');
  out.push('---');
  out.push('');
  out.push(THE_REFUSAL);

  return out.join('\n');
}

process.exit(await main());
