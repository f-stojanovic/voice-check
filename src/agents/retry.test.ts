import { describe, expect, it } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { TRANSIENT_400_MESSAGE, isTransientRequestError } from './client.js';

/** Builds the error the SDK actually raises, from the body the API actually
 *  sent — captured verbatim during the 2026-08-28 bisection. */
function apiError(status: number, type: string, message: string): unknown {
  return new Anthropic.APIError(
    status,
    { type: 'error', error: { type, message } },
    message,
    new Headers({ 'x-should-retry': 'false' }),
  );
}

describe('isTransientRequestError', () => {
  it('matches the measured transient 400', () => {
    expect(
      isTransientRequestError(apiError(400, 'invalid_request_error', TRANSIENT_400_MESSAGE)),
    ).toBe(true);
  });

  /**
   * THE ASSERTIONS THAT MATTER. Retrying a genuinely malformed request would
   * turn one loud failure into five slow ones and still fail. The
   * structured-outputs docs say an unsupported schema feature returns "a 400
   * error with details" — a different message — so each of these must stay
   * un-retried.
   */
  it.each([
    ['a different 400 message', apiError(400, 'invalid_request_error', 'max_tokens: must be >= 1')],
    ['a schema complaint', apiError(400, 'invalid_request_error', 'tools.0.input_schema: minLength is not supported')],
    ['a different error type', apiError(400, 'authentication_error', TRANSIENT_400_MESSAGE)],
    ['the same message at 429', apiError(429, 'rate_limit_error', TRANSIENT_400_MESSAGE)],
    ['the same message at 500', apiError(500, 'api_error', TRANSIENT_400_MESSAGE)],
  ])('does not match %s', (_label, error) => {
    expect(isTransientRequestError(error)).toBe(false);
  });

  it('does not match a non-API error', () => {
    expect(isTransientRequestError(new Error(TRANSIENT_400_MESSAGE))).toBe(false);
    expect(isTransientRequestError(undefined)).toBe(false);
  });

  /* Reads the parsed body, not the rendered message, so a change in how the SDK
     formats errors cannot silently widen what gets retried. */
  it('ignores the rendered message and reads the body', () => {
    const misleading = new Anthropic.APIError(
      400,
      { type: 'error', error: { type: 'invalid_request_error', message: 'something else' } },
      TRANSIENT_400_MESSAGE,
      new Headers(),
    );
    expect(isTransientRequestError(misleading)).toBe(false);
  });
});
