/**
 * Scripted fakes for the agent tests.
 *
 * No test in this repository makes a network call or needs an API key. That
 * is the whole return on injecting the client (ADR 009): the failure modes
 * that matter — a malformed tool call, an API error, an empty source — are
 * the ones a live call reproduces least reliably and a fake reproduces exactly.
 */

import type {
  CompletionRequest,
  CompletionResponse,
  ModelClient,
  ToolCallRequest,
  ToolCallResponse,
} from './client.js';
import type { Usage } from './pricing.js';

export const FAKE_USAGE: Usage = {
  inputTokens: 1200,
  outputTokens: 400,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};

/** Records what it was asked, so a test can assert on the prompt it received. */
export interface RecordingClient extends ModelClient {
  readonly requests: readonly ToolCallRequest[];
  readonly completions: readonly CompletionRequest[];
}

/** Returns the given tool inputs in order, one per call. */
export function scriptedClient(
  inputs: readonly unknown[],
  options: { model?: string; usage?: Usage; texts?: readonly string[] } = {},
): RecordingClient {
  const requests: ToolCallRequest[] = [];
  const completions: CompletionRequest[] = [];
  let i = 0;
  let j = 0;
  return {
    requests,
    completions,
    async callTool(request: ToolCallRequest): Promise<ToolCallResponse> {
      requests.push(request);
      if (i >= inputs.length) throw new Error(`scripted client ran out after ${i} calls`);
      return {
        input: inputs[i++],
        model: options.model ?? 'claude-opus-5',
        usage: options.usage ?? FAKE_USAGE,
      };
    },
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
      completions.push(request);
      const texts = options.texts ?? [];
      if (j >= texts.length) throw new Error(`scripted client ran out after ${j} completions`);
      return {
        text: texts[j++] ?? '',
        model: options.model ?? 'claude-opus-5',
        usage: options.usage ?? FAKE_USAGE,
      };
    },
  };
}

/** Fails every call with the given error, the way an outage would. */
export function failingClient(error: Error): RecordingClient {
  const requests: ToolCallRequest[] = [];
  const completions: CompletionRequest[] = [];
  return {
    requests,
    completions,
    async callTool(request: ToolCallRequest): Promise<ToolCallResponse> {
      requests.push(request);
      throw error;
    },
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
      completions.push(request);
      throw error;
    },
  };
}

/** A well-formed analysis, used as the happy path and as input to the angles agent. */
export const GOOD_ANALYSIS = {
  claim: {
    statement: 'Stale planner statistics, not a code change, caused the slowdown.',
    quote: 'Ništa se nije promenilo u kodu.',
  },
  evidence: [
    {
      kind: 'data' as const,
      statement: 'The query time moved from 80ms to four seconds and back after ANALYZE.',
      quote: 'Upit se vratio na osamdeset milisekundi.',
    },
  ],
  novelty: {
    genuinelyNew: [],
    restated: [
      {
        statement: 'Autovacuum thresholds scale badly with table size.',
        quote: 'Podrazumevano je dvadeset odsto.',
      },
    ],
  },
  hype: [],
  openQuestions: ['What would have caught this before a human noticed?'],
};

export const GOOD_ANGLES = {
  angles: [
    {
      hook: 'Sistem koji se kvari polako niko ne prijavljuje.',
      whyThisAudience: 'Svi su čekali da nešto pukne, a ništa nije puklo.',
      questionForWriter: 'Koji tvoj sistem je mesecima radio sve lošije, a niko nije reagovao?',
    },
    {
      hook: 'Alarm koji gleda samo greške ne vidi sporost.',
      whyThisAudience: 'Njihovi alati prijavljuju kvarove, ne degradaciju.',
      questionForWriter: 'Kada si poslednji put dodao merenje umesto alarma?',
    },
  ],
  thin: '',
};
