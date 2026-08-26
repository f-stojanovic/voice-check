/**
 * What a call costs, so a brief can say so.
 *
 * WHY THIS IS IN THE REPORT AT ALL: knowing what a brief costs is the
 * difference between a tool and a demo. A pipeline whose price nobody has
 * measured is a pipeline nobody can decide to run twice.
 *
 * THESE RATES ARE A SNAPSHOT, NOT A MEASUREMENT, and the difference matters
 * differently from the uncalibrated constants elsewhere in this repository.
 * A floor is a guess nobody has data for. These are published figures that
 * were correct on the date below and will change without this file noticing.
 * They are recorded with that date so a stale cost is diagnosable rather than
 * merely wrong, and `costUsd` is always reported beside the raw token counts —
 * the tokens are measured, the dollars are the tokens times a number from a
 * webpage.
 */

/** The date these rates were read from Anthropic's published pricing. */
export const PRICING_AS_OF = '2026-06-24';

export interface Rates {
  /** USD per million input tokens. */
  readonly inputPerMTok: number;
  /** USD per million output tokens. */
  readonly outputPerMTok: number;
}

const RATES: Readonly<Record<string, Rates>> = {
  'claude-opus-5': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-sonnet-5': { inputPerMTok: 2, outputPerMTok: 10 },
  'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
};

/** Cache writes bill above the input rate, cache reads far below it. */
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

/** What one call actually consumed. Measured; not a guess. */
export interface Usage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly cacheReadInputTokens: number;
}

export const ZERO_USAGE: Usage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheCreationInputTokens: a.cacheCreationInputTokens + b.cacheCreationInputTokens,
    cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
  };
}

/**
 * Cost in USD, or `null` for a model whose rates are not in the table.
 *
 * Null rather than zero. A zero would quietly report a free call and would be
 * summed into a total that reads as authoritative; a null forces the report to
 * say it does not know.
 */
export function costUsd(model: string, usage: Usage): number | null {
  const rates = RATES[model];
  if (rates === undefined) return null;
  const input =
    usage.inputTokens +
    usage.cacheCreationInputTokens * CACHE_WRITE_MULTIPLIER +
    usage.cacheReadInputTokens * CACHE_READ_MULTIPLIER;
  return (input * rates.inputPerMTok + usage.outputTokens * rates.outputPerMTok) / 1_000_000;
}

/** `$0.0134`, or `unpriced` when the model is not in the table. */
export function formatCost(usd: number | null): string {
  return usd === null ? 'unpriced' : `$${usd.toFixed(4)}`;
}
