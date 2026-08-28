import { describe, expect, it } from 'vitest';
import { trace } from '@opentelemetry/api';
import { VOICE_CHECK, setCost } from './tracing.js';

/** Records what was set on it, without needing an SDK. */
function fakeSpan(): { attrs: Record<string, unknown>; setAttribute: (k: string, v: unknown) => void } {
  const attrs: Record<string, unknown> = {};
  return { attrs, setAttribute: (k, v) => { attrs[k] = v; } };
}

describe('setCost', () => {
  it('sets the cost when it is known', () => {
    const span = fakeSpan();
    setCost(span as never, 0.1018, 'claude-opus-5');
    expect(span.attrs[VOICE_CHECK.costUsd]).toBe(0.1018);
    expect(span.attrs).not.toHaveProperty(VOICE_CHECK.costUnknownReason);
  });

  /**
   * THE ASSERTION THIS WHOLE ATTRIBUTE EXISTS FOR.
   *
   * A span carrying `voice_check.cost.usd = 0` for a model with no price-table
   * entry is ADR 026's defect in the one artifact whose purpose is attribution
   * — and a waterfall makes it worse, because a zero renders as a
   * legitimate-looking bar beside real numbers. An unknown cost is an ABSENT
   * attribute plus a stated reason, so a consumer summing costs across spans
   * gets the total of what is known and the rest is visibly missing.
   */
  it('sets NO cost attribute for an unpriced model, and says why', () => {
    const span = fakeSpan();
    setCost(span as never, null, 'some-model-not-in-the-table');

    expect(span.attrs).not.toHaveProperty(VOICE_CHECK.costUsd);
    expect(span.attrs[VOICE_CHECK.costUnknownReason]).toBe(
      'no price table entry for "some-model-not-in-the-table"',
    );
  });

  it('refuses NaN rather than recording it as a number', () => {
    const span = fakeSpan();
    setCost(span as never, Number.NaN, 'claude-opus-5');
    expect(span.attrs).not.toHaveProperty(VOICE_CHECK.costUsd);
    expect(String(span.attrs[VOICE_CHECK.costUnknownReason])).toContain('not a number');
  });

  it('records a real zero, because free is a measurement', () => {
    /* A locally-run model priced at zero HAS a cost, and it is 0. That is a
       different claim from "we could not price this", and the two must not
       collapse. */
    const span = fakeSpan();
    setCost(span as never, 0, 'Xenova/all-MiniLM-L6-v2');
    expect(span.attrs[VOICE_CHECK.costUsd]).toBe(0);
    expect(span.attrs).not.toHaveProperty(VOICE_CHECK.costUnknownReason);
  });
});

/**
 * THE CLAIM THAT `@opentelemetry/api` IS FREE WITHOUT AN SDK.
 *
 * It is asserted in tracing.ts and in the ADR, so it is checked here rather
 * than trusted: with no provider registered, the tracer must hand back a
 * non-recording span. If this ever fails, putting the package in
 * `dependencies` stops being free and the split has to be re-argued.
 */
describe('the API is inert without a provider', () => {
  it('returns a non-recording span when no SDK has registered', () => {
    const span = trace.getTracer('probe').startSpan('probe');
    expect(span.isRecording()).toBe(false);
    expect(span.spanContext().traceId).toBe('00000000000000000000000000000000');
    span.end();
  });

  it('still runs the callback, so instrumented code behaves identically', () => {
    let ran = false;
    const out = trace.getTracer('probe').startActiveSpan('probe', (span) => {
      ran = true;
      span.end();
      return 42;
    });
    expect(ran).toBe(true);
    expect(out).toBe(42);
  });
});
