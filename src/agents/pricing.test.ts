import { describe, expect, it } from 'vitest';
import { addUsage, costUsd, formatCost, PRICING_AS_OF, ZERO_USAGE } from './pricing.js';

describe('cost accounting', () => {
  it('prices a plain call at the published rates', () => {
    const usd = costUsd('claude-opus-5', {
      ...ZERO_USAGE,
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(usd).toBeCloseTo(30, 10); // $5 in + $25 out
  });

  it('bills cache writes above input and cache reads far below it', () => {
    const write = costUsd('claude-opus-5', { ...ZERO_USAGE, cacheCreationInputTokens: 1_000_000 });
    const read = costUsd('claude-opus-5', { ...ZERO_USAGE, cacheReadInputTokens: 1_000_000 });
    expect(write).toBeCloseTo(6.25, 10);
    expect(read).toBeCloseTo(0.5, 10);
  });

  it('returns null for a model it has no rates for', () => {
    // Not zero. A zero reports a free call and sums into a total that reads as
    // authoritative.
    expect(costUsd('claude-from-the-future', { ...ZERO_USAGE, inputTokens: 10 })).toBeNull();
    expect(formatCost(null)).toBe('unpriced');
  });

  it('sums usage across calls', () => {
    const a = { ...ZERO_USAGE, inputTokens: 10, outputTokens: 2 };
    const b = { ...ZERO_USAGE, inputTokens: 5, cacheReadInputTokens: 100 };
    expect(addUsage(a, b)).toEqual({
      inputTokens: 15,
      outputTokens: 2,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 100,
    });
  });

  it('records the date the rates were read', () => {
    // The rates are a snapshot of a webpage, not a measurement. A stale cost
    // should be diagnosable rather than merely wrong.
    expect(PRICING_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
