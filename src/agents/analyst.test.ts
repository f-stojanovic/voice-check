import { describe, expect, it } from 'vitest';
import {
  analyse,
  AnalysisSchema,
  ANALYST_TOOL_SCHEMA,
  EmptySourceError,
  UntraceableQuoteError,
  verifyQuotes,
} from './analyst.js';
import { MalformedToolCallError, ModelUnavailableError } from './client.js';
import { failingClient, GOOD_ANALYSIS, scriptedClient } from './agents.test-kit.js';

const SOURCE = [
  'Prošle nedelje mi je jedan upit počeo da traje četiri sekunde.',
  'Ništa se nije promenilo u kodu. Promenili su se podaci.',
  'Pokrenuo sam ANALYZE. Upit se vratio na osamdeset milisekundi.',
  'Autovacuum ima prag. Podrazumevano je dvadeset odsto.',
].join('\n');

describe('the analyst', () => {
  it('returns a validated structure from a well-formed tool call', async () => {
    const client = scriptedClient([GOOD_ANALYSIS]);
    const run = await analyse(client, { text: SOURCE, language: 'sr' });
    expect(run.value.claim.statement).toContain('Stale planner statistics');
    expect(run.value.novelty.genuinelyNew).toEqual([]);
  });

  it('forces the tool call rather than asking for JSON in prose', async () => {
    // The guarantee the whole design rests on. If this ever became a prose
    // request with a parser behind it, nothing else in the file would notice.
    const client = scriptedClient([GOOD_ANALYSIS]);
    await analyse(client, { text: SOURCE, language: 'sr' });
    expect(client.requests[0]?.tool.name).toBe('record_analysis');
    expect(client.requests[0]?.tool.description).toContain('no prose channel');
  });

  it('rejects a malformed tool call with the offending path named', async () => {
    // `strict: true` makes this near-impossible against the real API, which is
    // exactly why it has to be tested against a fake: the failure mode that
    // never happens in development is the one with no handler.
    const malformed = { claim: { statement: 'x' }, evidence: [] };
    await expect(
      analyse(scriptedClient([malformed]), { text: SOURCE, language: 'sr' }),
    ).rejects.toThrow(MalformedToolCallError);
    await expect(
      analyse(scriptedClient([malformed]), { text: SOURCE, language: 'sr' }),
    ).rejects.toThrow(/at claim\.quote/);
  });

  it('propagates an API error as itself, not as a bad answer', async () => {
    // An outage and a model that produced nonsense need different responses:
    // one is worth retrying immediately, the other is not.
    const client = failingClient(new ModelUnavailableError('API error 529 — overloaded', 529));
    await expect(analyse(client, { text: SOURCE, language: 'sr' })).rejects.toThrow(
      ModelUnavailableError,
    );
  });

  it('refuses an empty source before spending a request', async () => {
    const client = scriptedClient([GOOD_ANALYSIS]);
    await expect(analyse(client, { text: '   \n\n  ', language: 'sr' })).rejects.toThrow(
      EmptySourceError,
    );
    expect(client.requests).toHaveLength(0);
  });

  it('tells the model that empty is a correct answer', async () => {
    // Without this the agent finds novelty in everything, and an analyst that
    // always finds novelty is a flattery machine with a JSON schema.
    const client = scriptedClient([GOOD_ANALYSIS]);
    await analyse(client, { text: SOURCE, language: 'sr' });
    expect(client.requests[0]?.system).toContain('Empty arrays are correct answers');
  });

  it('records usage and a cost for the call', async () => {
    const run = await analyse(scriptedClient([GOOD_ANALYSIS]), { text: SOURCE, language: 'sr' });
    expect(run.usage.inputTokens).toBe(1200);
    // 1200 in at $5/MTok + 400 out at $25/MTok.
    expect(run.costUsd).toBeCloseTo((1200 * 5 + 400 * 25) / 1_000_000, 12);
  });

  it('reports no cost rather than a zero for an unpriced model', async () => {
    const client = scriptedClient([GOOD_ANALYSIS], { model: 'claude-from-the-future' });
    const run = await analyse(client, { text: SOURCE, language: 'sr' });
    expect(run.costUsd).toBeNull();
  });
});

describe('the traceability gate', () => {
  it('passes an analysis whose quotes are all in the source', async () => {
    const run = await analyse(scriptedClient([GOOD_ANALYSIS]), {
      text: SOURCE,
      language: 'sr',
    });
    expect(run.traceability.every((c) => c.match !== 'absent')).toBe(true);
    expect(run.traceability.length).toBeGreaterThan(0);
  });

  it('FAILS THE RUN when a quote is not in the source', async () => {
    // Day two printed this as a statistic. A statistic nobody compares against
    // anything is an observation; this is the one number here that can be a
    // control, so it is one.
    const invented = {
      ...GOOD_ANALYSIS,
      claim: { statement: 'x', quote: 'A sentence that appears nowhere in the source.' },
    };
    await expect(
      analyse(scriptedClient([invented]), { text: SOURCE, language: 'sr' }),
    ).rejects.toThrow(UntraceableQuoteError);
  });

  it('names the failing statement and its quote, so the failure is actionable', async () => {
    const invented = {
      ...GOOD_ANALYSIS,
      hype: [{ statement: 'The author overclaims about latency.', quote: 'Ovo nije u tekstu.' }],
    };
    let error: UntraceableQuoteError | undefined;
    try {
      await analyse(scriptedClient([invented]), {
        text: SOURCE,
        language: 'sr',
        origin: 'post.md',
      });
    } catch (cause) {
      error = cause as UntraceableQuoteError;
    }
    expect(error).toBeInstanceOf(UntraceableQuoteError);
    expect(error?.message).toContain('post.md');
    expect(error?.message).toContain('hype[0]');
    expect(error?.message).toContain('The author overclaims about latency.');
    expect(error?.message).toContain('Ovo nije u tekstu.');
    expect(error?.checks.filter((c) => c.match === 'absent')).toHaveLength(1);
  });

  it('does NOT fail on a quote that only differs in whitespace', async () => {
    // Conflating "absent" with "present but reformatted" would make the gate
    // fire on hard-wrapped source files, which is most of them.
    const wrapped = 'Ništa se nije\npromenilo u kodu. Upit se vratio na osamdeset milisekundi.';
    const run = await analyse(
      scriptedClient([
        {
          ...GOOD_ANALYSIS,
          claim: { statement: 'x', quote: 'Ništa se nije promenilo u kodu.' },
          evidence: [],
          novelty: { genuinelyNew: [], restated: [] },
        },
      ]),
      { text: wrapped, language: 'sr' },
    );
    expect(run.traceability[0]?.match).toBe('normalized');
  });

  it('does NOT fail on a quote that only differs in case', async () => {
    const run = await analyse(
      scriptedClient([
        {
          ...GOOD_ANALYSIS,
          claim: { statement: 'x', quote: 'ništa se nije promenilo u kodu.' },
          evidence: [],
          novelty: { genuinelyNew: [], restated: [] },
        },
      ]),
      { text: SOURCE, language: 'sr' },
    );
    expect(run.traceability[0]?.match).toBe('normalized');
  });

  it('marks a byte-for-byte quote as exact, not merely normalised', async () => {
    const run = await analyse(scriptedClient([GOOD_ANALYSIS]), { text: SOURCE, language: 'sr' });
    expect(run.traceability.filter((c) => c.match === 'exact').length).toBeGreaterThan(0);
  });

  it('does not count an absence as an unfound quote', () => {
    // "the source offers no evidence" has no quote, and treating that as a
    // miss would make the gate fire on the honest answer.
    const analysis = AnalysisSchema.parse({
      ...GOOD_ANALYSIS,
      evidence: [{ kind: 'none', statement: 'It offers nothing.', quote: '' }],
    });
    expect(verifyQuotes(analysis, SOURCE).some((c) => c.field.startsWith('evidence'))).toBe(false);
  });
});

describe('the analyst tool schema', () => {
  it('names the same fields as the Zod schema it is written beside', () => {
    // Hand-written so `strict: true` has something exact to enforce, which
    // means the two can disagree. This is the check this repository would
    // demand of anybody else.
    const json = Object.keys(
      (ANALYST_TOOL_SCHEMA as { properties: Record<string, unknown> }).properties,
    ).sort();
    expect(json).toEqual(Object.keys(AnalysisSchema.shape).sort());
  });

  it('is strict-compatible: every object closed and fully required', () => {
    // `strict: true` silently degrades without these, and a degraded guarantee
    // reads exactly like a working one.
    const closed = (node: unknown, path: string): void => {
      if (typeof node !== 'object' || node === null) return;
      const obj = node as Record<string, unknown>;
      if (obj['type'] === 'object') {
        expect(obj['additionalProperties'], `${path}.additionalProperties`).toBe(false);
        const props = Object.keys((obj['properties'] ?? {}) as object).sort();
        expect((obj['required'] as string[] | undefined)?.slice().sort(), `${path}.required`).toEqual(props);
      }
      for (const [key, value] of Object.entries(obj)) closed(value, `${path}.${key}`);
    };
    closed(ANALYST_TOOL_SCHEMA, 'schema');
  });
});
