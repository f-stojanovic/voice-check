/**
 * `npm run eval:analyst` — the analyst suite.
 *
 *   npm run eval:analyst              replay recorded fixtures, free, no key
 *   npm run eval:analyst -- --live    call the model, then record what it said
 *
 * WHY THE DEFAULT IS THE FREE ONE. `analyse()` calls a model, so a live run
 * costs money every time it happens. A suite whose default mode bills is a
 * suite that gets run once. The live mode exists to produce the recording; the
 * recording is what anyone else replays. Same split as `agent-evals` ADR 013.
 *
 * NO BASELINE IS WRITTEN, and that is deliberate rather than unfinished. One
 * case is not a baseline. Freezing it would hand the gate a number it cannot
 * defend, and a baseline is only worth having when the thing it records is
 * stable enough that a change in it means something. See ADR 018.
 *
 * THE QUOTE-MATCH LINE IS A METRIC, NOT A SCORE. It counts how the analyst's
 * quotes related to the source — exact, normalized, foreign, absent — and it
 * grades nothing. `foreign` is the Serbian failure mode `analyst.ts` documents:
 * the model restates the source faithfully in the other language, so the quote
 * is real and is not in the text. Folding that into a low recall score would
 * lose the difference between "did not find it" and "found it and translated
 * it", which have different fixes. Same shape as `agent-evals` keeping
 * `unpriced` apart from `uncomputable`.
 */

import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  CACHE_OFF,
  compareToBaseline,
  exitCode,
  fixtureSubject,
  formatReport,
  loadFixtures,
  runSuite,
  summariseProvenance,
  validateExpectations,
} from 'agent-evals';
import type {
  EvalCase,
  ProvenanceSummary,
  RunSummary,
  Scorer,
  Subject,
  SubjectContext,
  SubjectOutput,
} from 'agent-evals';
import { analyse } from '../agents/analyst.js';
import { anthropicClient } from '../agents/client.js';
import { costUsd, formatCost } from '../agents/pricing.js';
import { startTracing } from './tracing-setup.eval.js';
import { VOICE_CHECK, failSpan, tracer } from '../tracing.js';
import { splitSentences } from './analyst/sentences.js';
import { checkLabels, indicesFor, loadLabels } from './analyst/labels.js';
import {
  claimLocates,
  evidencePrecision,
  evidenceRecall,
  hypeRecall,
  locateQuotes,
  matchDistribution,
} from './analyst/scoring.js';
import type { LabelledSource, QuoteLocation } from './analyst/scoring.js';
import type { QuoteMatch } from '../agents/analyst.js';

const SOURCES_DIR = 'evals/analyst/sources';
const LABELS_DIR = 'evals/analyst/labels';
const FIXTURES_DIR = 'evals/analyst/fixtures';

/**
 * Loads every labelled source.
 *
 * A source with no label file is SKIPPED WITH A WARNING rather than run: an
 * unlabelled source has nothing to be scored against, and running it would
 * produce a case that costs money and measures nothing — the failure
 * `agent-evals` ADR 005 exists to prevent.
 */
async function loadSources(): Promise<LabelledSource[]> {
  let labelFiles: string[];
  try {
    labelFiles = (await readdir(LABELS_DIR)).filter((f) => f.endsWith('.labels.yaml')).sort();
  } catch {
    return [];
  }

  const sources: LabelledSource[] = [];
  for (const file of labelFiles) {
    const labels = await loadLabels(join(LABELS_DIR, file));
    const text = await readFile(join(SOURCES_DIR, labels.source), 'utf8');
    const sentences = splitSentences(text);
    /* Throws unless every mark still points at the sentence its labeller saw. */
    checkLabels(labels, sentences);
    sources.push({
      name: labels.source,
      text,
      language: labels.language,
      sentences,
      labels,
    });
  }
  return sources;
}

/** The case id for a source. Stable, human-authored via the filename, and the
 *  baseline key when there eventually is one. */
const caseIdFor = (source: LabelledSource): string =>
  `analyst-${basename(source.name).replace(/\.[^.]+$/u, '')}`;

/**
 * Builds a case from a labelled source.
 *
 * `expect` carries COUNTS DERIVED FROM THE HUMAN'S MARKS, not expectations
 * anybody authored. They exist because `applicableScorers` decides which
 * scorers run from which keys a case declares: a source whose labels contain no
 * `H` sentence simply has no `hypeSentences` key, and the hype scorer skips it
 * rather than scoring 0 for finding nothing that was there to find.
 */
function caseFor(source: LabelledSource): EvalCase {
  const claim = indicesFor(source.labels, 'C').length;
  const evidence = indicesFor(source.labels, 'E').length;
  const hype = indicesFor(source.labels, 'H').length;

  return {
    id: caseIdFor(source),
    description: `${source.name} — ${source.sentences.length} sentences, labelled by ${source.labels.labelledBy}`,
    input: { text: source.text, language: source.language, origin: source.name },
    expect: {
      ...(claim > 0 && { claimSentences: claim }),
      ...(evidence > 0 && { evidenceSentences: evidence }),
      ...(hype > 0 && { hypeSentences: hype }),
    },
    meta: { labelledBy: source.labels.labelledBy, labelledAt: source.labels.labelledAt },
  };
}

/**
 * The live subject: the real analyst, on the real client.
 *
 * A KNOWN LIMITATION, RECORDED RATHER THAN WORKED AROUND. `analyse()` throws
 * `UntraceableQuoteError` when any quote is absent or translated — that is the
 * production gate and it is right to have. It also means a run that trips the
 * gate yields no analysis to score, so such a case ERRORS rather than being
 * graded with a low number. The error's `checks` carry the match kinds, so the
 * quote-match line still reports what happened; the four scores are simply
 * absent for that case. Making the analysis available on the error would let
 * the suite grade content and traceability separately, which is the right
 * design and is not this pass's change.
 */
function analystSubject(): Subject {
  const client = anthropicClient();
  return async (input: unknown, _ctx: SubjectContext): Promise<SubjectOutput> => {
    const { text, language, origin } = input as {
      text: string;
      language: 'sr' | 'en';
      origin: string;
    };
    const started = Date.now();
    const run = await analyse(client, { text, language, origin });
    return {
      raw: run,
      model: run.model,
      usage: {
        inputTokens: run.usage.inputTokens,
        outputTokens: run.usage.outputTokens,
        cacheReadTokens: run.usage.cacheReadInputTokens,
        cacheWriteTokens: run.usage.cacheCreationInputTokens,
      },
      latencyMs: Date.now() - started,
      toolCalls: [{ name: 'record_analysis', input: run.value }],
    };
  };
}

/**
 * The outermost of the three spans: one per eval case.
 *
 * WRAPS WHATEVER SUBJECT IS RUNNING, live or fixture, rather than living inside
 * the live one. It was inside `analystSubject` first, which meant a replay
 * produced no spans at all — so the tracing could only ever be demonstrated by
 * spending money, which is the opposite of what the rest of this suite is
 * built for. A replay now yields a case span with no children, which is an
 * honest picture of a replay: nothing was called.
 */
function tracedSubject(inner: Subject): Subject {
  return (input, ctx) =>
    tracer.startActiveSpan(`eval case ${ctx.caseId}`, async (span) => {
      span.setAttribute(VOICE_CHECK.caseId, ctx.caseId);
      try {
        return await inner(input, ctx);
      } catch (cause) {
        failSpan(span, cause);
        throw cause;
      } finally {
        span.end();
      }
    });
}

/** Writes what the model said, so the next run is free. */
async function recordFixture(
  source: LabelledSource,
  output: SubjectOutput,
  capturedAt: string,
): Promise<string> {
  await mkdir(FIXTURES_DIR, { recursive: true });
  const path = join(FIXTURES_DIR, `${caseIdFor(source)}.yaml`);
  const body = {
    caseId: caseIdFor(source),
    provenance: { kind: 'recorded', model: output.model, capturedAt },
    output: {
      model: output.model,
      inputTokens: output.usage.inputTokens,
      outputTokens: output.usage.outputTokens,
      latencyMs: output.latencyMs,
      toolCalls: output.toolCalls,
    },
  };
  /* JSON is valid YAML, and emitting it this way means no quoting rules to get
     wrong on a Serbian source full of diacritics and punctuation. */
  await writeFile(path, `# Recorded by \`npm run eval:analyst -- --live\`. Do not hand-edit.\n${JSON.stringify([body], null, 2)}\n`, 'utf8');
  return path;
}

function quoteMatchLines(
  sources: readonly LabelledSource[],
  outputs: Map<string, SubjectOutput>,
): string[] {
  const total: Record<QuoteMatch, number> = { exact: 0, normalized: 0, foreign: 0, absent: 0 };
  const perCase: string[] = [];

  for (const source of sources) {
    const output = outputs.get(caseIdFor(source));
    const analysis = output?.toolCalls?.[0]?.input;
    if (analysis === undefined) continue;
    const located: QuoteLocation[] = locateQuotes(analysis as never, source);
    const tally = matchDistribution(located);
    for (const kind of Object.keys(total) as QuoteMatch[]) total[kind] += tally[kind];
    perCase.push(
      `  - ${caseIdFor(source)} (${source.language}): ` +
        `exact ${tally.exact}, normalized ${tally.normalized}, foreign ${tally.foreign}, absent ${tally.absent}`,
    );
  }

  return [
    '',
    '### Quote traceability',
    '',
    'A METRIC, NOT A SCORE. `foreign` means the quote was faithful and in the',
    'wrong language — a different failure from missing the sentence, with a',
    'different fix, so it is counted rather than folded into a low recall.',
    '',
    `- totals: exact ${total.exact}, normalized ${total.normalized}, ` +
      `foreign ${total.foreign}, absent ${total.absent}`,
    ...perCase,
  ];
}

/**
 * Transient-400 retries spent on this run.
 *
 * REPORTED BECAUSE IT IS A WORKAROUND. `client.ts` retries a 400 the API marks
 * `x-should-retry: false`, on the strength of a measurement rather than a
 * documented contract. A workaround whose cost nobody can see is a workaround
 * that becomes permanent, so the number goes in the report on every live run.
 *
 * If it reads 0 for long enough, the API has been fixed and the retry should
 * come out. Nothing here decides that; it just makes the evidence visible.
 *
 * Absent on a fixture replay, because a replay makes no requests.
 */
function retryLines(outputs: Map<string, SubjectOutput>, live: boolean): string[] {
  if (!live) return [];
  let attempts = 0;
  let calls = 0;
  for (const output of outputs.values()) {
    const run = output.raw as { attempts?: unknown } | null;
    if (typeof run?.attempts !== 'number') continue;
    attempts += run.attempts;
    calls += 1;
  }
  if (calls === 0) return [];
  const retries = attempts - calls;
  return [
    '',
    '### Transient 400 retries',
    '',
    `- ${retries} retr${retries === 1 ? 'y' : 'ies'} across ${calls} call${calls === 1 ? '' : 's'} ` +
      `(${attempts} request${attempts === 1 ? '' : 's'} sent)`,
    retries === 0
      ? '  - none needed on this run. If that holds, the retry in client.ts can come out.'
      : '  - the API marks this error `x-should-retry: false`; we retry it anyway on measured evidence (ADR 019).',
  ];
}

/**
 * What this run spent, kept apart from what the recording cost.
 *
 * THE HARNESS'S OWN `cost:` LINE IS THE RECORDING'S. `agent-evals` prices the
 * token counts on the result, and on a replay those counts came out of the
 * fixture — so a run that made no request reports `cost: $0.1018`. That figure
 * is true of the recorded run and false of this one, and a reader has no way to
 * tell which they are looking at.
 *
 * Same defect family as the `?? 0` that made an absent judge cost read as free
 * (ADR 026), one layer up: a number that is real in one frame printed in
 * another, with nothing marking the change of frame.
 *
 * Not fixable inside `formatReport` — that lives in the pinned dependency — so
 * this section states both figures and says which is which.
 */
function spendLines(run: RunSummary, outputs: Map<string, SubjectOutput>, live: boolean): string[] {
  const model = [...outputs.values()][0]?.model ?? '';
  const usd = costUsd(model, {
    inputTokens: run.usage.inputTokens,
    outputTokens: run.usage.outputTokens,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  });
  const tokens = `${run.usage.inputTokens} in / ${run.usage.outputTokens} out`;

  if (live) {
    return ['', '### Spend', '', `- this run: ${formatCost(usd)} — ${tokens}, live against \`${model}\``];
  }
  return [
    '',
    '### Spend',
    '',
    '- this run: **$0.0000** — every response was replayed from a recording; no request was made',
    `- the recording it replays: ${formatCost(usd)} — ${tokens}, \`${model}\``,
    "  - the `cost:` line above is that recording's, re-priced. It is not what this run cost.",
  ];
}

export async function main(argv: readonly string[]): Promise<number> {
  const live = argv.includes('--live');
  /* OFF BY DEFAULT. A default-on exporter that silently fails to connect looks
     instrumented and delivers nothing, which is worse than no tracing. */
  const trace = argv.includes('--trace');
  const tracing = trace
    ? startTracing({ console: argv.includes('--trace-console') })
    : undefined;
  if (tracing !== undefined) console.error(`tracing -> ${tracing.endpoint}\n`);

  const sources = await loadSources();
  if (sources.length === 0) {
    console.error(
      `No labelled sources found.\n\n` +
        `  1. put a source in ${SOURCES_DIR}/\n` +
        `  2. npm run label:analyst -- <that file>\n` +
        `  3. fill in the worksheet in ${LABELS_DIR}/\n` +
        `  4. npm run eval:analyst -- --live\n`,
    );
    return 1;
  }

  const cases = sources.map(caseFor);
  const byId = new Map(sources.map((s) => [caseIdFor(s), s]));
  const lookup = (id: string): LabelledSource | undefined => byId.get(id);

  const scorers: Scorer[] = [
    claimLocates(lookup),
    evidenceRecall(lookup),
    evidencePrecision(lookup),
    hypeRecall(lookup),
  ];

  validateExpectations(cases, scorers);

  /* A missing fixtures directory is the normal state before the first live
     run, so it gets a sentence rather than an ENOENT stack trace. */
  let subject: Subject;
  /* Kept so the report can say where the responses came from. Without it the
     harness prints "live subject: responses came from the model" on a replay,
     which is the third number-shaped lie in this report and the same family as
     the cost line: true of the recording, false of the run printing it. */
  let provenance: ProvenanceSummary | undefined;
  if (live) {
    subject = analystSubject();
  } else {
    try {
      const fixtures = await loadFixtures(FIXTURES_DIR);
      provenance = summariseProvenance('fixtures', [...fixtures.values()]);
      subject = fixtureSubject(fixtures);
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause;
      console.error(
        `No fixtures in ${FIXTURES_DIR}/ yet.\n\n` +
          `  npm run eval:analyst -- --live    records them, once, against the model\n` +
          `  npm run eval:analyst              replays them for free thereafter\n`,
      );
      return 1;
    }
  }

  const run = await runSuite({
    cases,
    subject: trace ? tracedSubject(subject) : subject,
    subjectId: live ? 'analyst' : 'fixture',
    scorers,
    /* One sample. The subject is stochastic and this is a pilot; sampling
       belongs with the eight cases, not before them, and five live samples of
       one case would cost five times as much to learn less. */
    samples: 1,
    concurrency: 1,
    cache: CACHE_OFF,
    suiteId: live ? 'analyst-live' : 'analyst-fixture',
  });

  const outputs = new Map<string, SubjectOutput>();
  for (const result of run.results) if (result.output !== undefined) outputs.set(result.caseId, result.output);

  const comparison = compareToBaseline(run, undefined, {}, scorers.map((s) => s.name));
  console.log(
    formatReport({
      run,
      comparison,
      models: {},
      ...(provenance !== undefined && { provenance }),
    }),
  );
  console.log(quoteMatchLines(sources, outputs).join('\n'));
  const retries = retryLines(outputs, live);
  if (retries.length > 0) console.log(retries.join('\n'));
  console.log(spendLines(run, outputs, live).join('\n'));

  if (live) {
    const capturedAt = new Date().toISOString().slice(0, 10);
    for (const source of sources) {
      const output = outputs.get(caseIdFor(source));
      if (output === undefined) continue;
      console.log(`\nRecorded ${await recordFixture(source, output, capturedAt)}`);
    }
  }

  /* Awaited, because a BatchSpanProcessor holds spans until a timer fires and
     a one-case run would otherwise exit having exported nothing. */
  if (tracing !== undefined) await tracing.shutdown();

  return exitCode(comparison);
}

process.exitCode = await main(process.argv.slice(2));
