/**
 * The padding used by every other rule test must itself be innocent.
 *
 * If the filler tripped a rule, every padded fixture would carry findings that
 * belong to the test harness rather than to the text under test, and the
 * counts asserted everywhere else would be quietly wrong.
 */

import { describe, expect, it } from 'vitest';
import { rulesFor } from './index.js';
import { pad, runRule } from './rules.test-kit.js';
import type { Language } from '../types.js';

describe('the test padding', () => {
  for (const language of ['sr', 'en'] as const satisfies readonly Language[]) {
    it(`trips no ${language} rule`, () => {
      const filler = pad('', language);
      for (const rule of rulesFor(language)) {
        const result = runRule(rule, filler, language);
        expect(result.findings, `${rule.name} fired on the padding`).toEqual([]);
        if (result.outcome === 'scored' && rule.kind === 'hard') {
          expect(result.passed, `${rule.name} failed the padding`).toBe(true);
        }
      }
    });

    it(`is long enough to make every density rule measurable in ${language}`, () => {
      for (const rule of rulesFor(language).filter((r) => r.kind === 'density')) {
        // sentence-uniformity is the exception: the filler is one sentence
        // repeated, so it measures fine but measures flatness. Tests for that
        // rule build their own fixtures and say so.
        expect(runRule(rule, pad('', language), language).outcome, rule.name).toBe('scored');
      }
    });
  }
});
