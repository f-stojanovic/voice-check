import { describe, expect, it } from 'vitest';
import { analyse, AnalysisSchema, ANALYST_TOOL_SCHEMA, EmptySourceError, verifyQuotes } from './analyst.js';
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

describe('quote verification', () => {
  it('confirms quotes that are actually in the source', () => {
    const checks = verifyQuotes(AnalysisSchema.parse(GOOD_ANALYSIS), SOURCE);
    expect(checks.every((c) => c.found)).toBe(true);
    expect(checks.length).toBeGreaterThan(0);
  });

  it('flags a quote the model paraphrased', () => {
    // Not an error — models paraphrase. But a statement traced to a quote that
    // is not in the text is traced to nothing, and the reader is told which.
    const drifted = AnalysisSchema.parse({
      ...GOOD_ANALYSIS,
      claim: { statement: 'x', quote: 'Nothing in the code had changed at all.' },
    });
    const claim = verifyQuotes(drifted, SOURCE).find((c) => c.field === 'claim');
    expect(claim?.found).toBe(false);
  });

  it('matches a quote that spans a line break in wrapped source', () => {
    const wrapped = 'Ništa se nije\npromenilo u kodu.';
    const analysis = AnalysisSchema.parse({
      ...GOOD_ANALYSIS,
      claim: { statement: 'x', quote: 'Ništa se nije promenilo u kodu.' },
      evidence: [],
      novelty: { genuinelyNew: [], restated: [] },
    });
    expect(verifyQuotes(analysis, wrapped)[0]?.found).toBe(true);
  });

  it('does not count an absence as an unfound quote', () => {
    // "the source offers no evidence" has no quote, and scoring it as a miss
    // would make the traceability figure punish the honest answer.
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
