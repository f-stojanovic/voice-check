import { describe, expect, it } from 'vitest';
import {
  analyse,
  AnalysisSchema,
  ANALYST_TOOL_SCHEMA,
  EmptySourceError,
  UntraceableQuoteError,
  verifyQuotes,
} from './analyst.js';
import type { Analysis } from './analyst.js';
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

  it('claims a consequence, not a cause', async () => {
    // An earlier version said a missing quote meant the model invented it.
    // That is one possibility among four, and the gate cannot tell them apart.
    const invented = {
      ...GOOD_ANALYSIS,
      claim: { statement: 'x', quote: 'A sentence that appears nowhere at all.' },
    };
    let error: UntraceableQuoteError | undefined;
    try {
      await analyse(scriptedClient([invented]), { text: SOURCE, language: 'sr' });
    } catch (cause) {
      error = cause as UntraceableQuoteError;
    }
    expect(error?.message).toContain('this analysis cannot be relied on');
    expect(error?.message).toContain('Why is not established');
    expect(error?.message).toContain('the extractor damaged the source');
    expect(error?.message).not.toContain('the analyst invented');
  });

  it('diagnoses a translated quote as foreign, which it CAN establish', async () => {
    // The one cause the gate can actually name. A Serbian source quoted in
    // English was not copied out of it.
    const translated = {
      ...GOOD_ANALYSIS,
      claim: {
        statement: 'x',
        quote: 'Nothing in the code had changed and the data was the problem.',
      },
      evidence: [],
      novelty: { genuinelyNew: [], restated: [] },
    };
    let error: UntraceableQuoteError | undefined;
    try {
      await analyse(scriptedClient([translated]), { text: SOURCE, language: 'sr' });
    } catch (cause) {
      error = cause as UntraceableQuoteError;
    }
    expect(error?.checks.find((c) => c.field === 'claim')?.match).toBe('foreign');
    expect(error?.message).toContain('the model translated the quote');
  });

  it('detects a script change without needing a language guess', async () => {
    const cyrillic = 'Упит је радио споро и нико то није приметио недељама.';
    const latinQuote = {
      ...GOOD_ANALYSIS,
      claim: { statement: 'x', quote: 'The query ran slowly for weeks.' },
      evidence: [],
      novelty: { genuinelyNew: [], restated: [] },
    };
    let error: UntraceableQuoteError | undefined;
    try {
      await analyse(scriptedClient([latinQuote]), { text: cyrillic, language: 'sr' });
    } catch (cause) {
      error = cause as UntraceableQuoteError;
    }
    expect(error?.checks[0]?.match).toBe('foreign');
  });

  it('does not call a short Serbian-Latin quote foreign on a hunch', async () => {
    // The language test needs five words and two English function words before
    // it will vote. A wrong `foreign` only changes the diagnosis, but a gate
    // that guesses in its error messages teaches people to ignore them.
    const analysis = AnalysisSchema.parse({
      ...GOOD_ANALYSIS,
      claim: { statement: 'x', quote: 'Nema ovoga ovde' },
      evidence: [],
      novelty: { genuinelyNew: [], restated: [] },
    });
    expect(verifyQuotes(analysis, SOURCE, 'sr')[0]?.match).toBe('absent');
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

/**
 * Positions on QuoteCheck.
 *
 * These exist because the eval scorers grade by asking which sentence a quote
 * landed in, and a position that is quietly off by the width of a collapsed
 * newline would attribute a quote to the wrong sentence without failing
 * anything. Every assertion below therefore checks the offsets against the
 * SOURCE, by slicing it — not against a number written down here.
 */
describe('verifyQuotes positions', () => {
  const analysisWith = (quote: string): Analysis => ({
    claim: { statement: 's', quote },
    evidence: [],
    novelty: { genuinelyNew: [], restated: [] },
    hype: [],
    openQuestions: [],
  });

  it('gives an exact match offsets that slice back to the quote', () => {
    const source = 'Alpha beta. Gamma delta epsilon. Zeta.';
    const [check] = verifyQuotes(analysisWith('Gamma delta'), source);

    expect(check?.match).toBe('exact');
    expect(source.slice(check?.start, check?.end)).toBe('Gamma delta');
  });

  /**
   * THE CASE THE OFFSET MAP EXISTS FOR. The quote crosses a hard line break, so
   * it matches only after whitespace collapsing — and an index into the
   * collapsed copy is not an index into the source, because `\s+ -> ' '`
   * shortened it. A naive implementation lands short by one character per
   * collapsed run, which is invisible until it attributes a quote to the
   * previous sentence.
   */
  it('maps a normalized match back through the collapsed whitespace', () => {
    const source = 'The retry converts an intermittent\n  failure into a slower green build.';
    const [check] = verifyQuotes(analysisWith('intermittent failure into'), source);

    expect(check?.match).toBe('normalized');
    /* The slice is the SOURCE text, which still contains the newline and the
       indent — so it cannot equal the quote, and that is the point. What must
       hold is that it starts and ends on the right words. */
    const sliced = source.slice(check?.start, check?.end);
    expect(sliced.startsWith('intermittent')).toBe(true);
    expect(sliced.endsWith('into')).toBe(true);
    expect(sliced.replace(/\s+/gu, ' ')).toBe('intermittent failure into');
  });

  it('maps a case-folded match back to the original casing', () => {
    const source = 'Teams Keep Adding Retries to flaky tests.';
    const [check] = verifyQuotes(analysisWith('teams keep adding retries'), source);

    expect(check?.match).toBe('normalized');
    expect(source.slice(check?.start, check?.end)).toBe('Teams Keep Adding Retries');
  });

  it('handles a leading-whitespace source without shifting every offset', () => {
    const source = '\n\n   Alpha beta gamma. Delta.';
    const [check] = verifyQuotes(analysisWith('beta gamma'), source);

    expect(source.slice(check?.start, check?.end)).toBe('beta gamma');
  });

  it('gives no position to a quote that is not there', () => {
    const source = 'Alpha beta gamma.';
    const [check] = verifyQuotes(analysisWith('nothing like this'), source);

    expect(check?.match).toBe('absent');
    expect(check?.start).toBeUndefined();
    expect(check?.end).toBeUndefined();
  });

  it('gives no position to a translated quote', () => {
    const source = 'Тимови додају понављања уместо да поправе тестове.';
    const [check] = verifyQuotes(analysisWith('Teams add retries instead of fixing tests'), source, 'sr');

    expect(check?.match).toBe('foreign');
    expect(check?.start).toBeUndefined();
  });

  /* Serbian Latin with diacritics, hard-wrapped: the combination the whole
     corpus is made of, and the one where a byte-vs-character error would show. */
  it('maps a normalized match in Serbian text with diacritics', () => {
    const source = 'Timovi dodaju ponavljanja umesto da poprave\nnepouzdane testove u projektu.';
    const [check] = verifyQuotes(analysisWith('poprave nepouzdane testove'), source, 'sr');

    expect(check?.match).toBe('normalized');
    expect(source.slice(check?.start, check?.end).replace(/\s+/gu, ' ')).toBe(
      'poprave nepouzdane testove',
    );
  });
});
