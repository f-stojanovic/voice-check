/**
 * The README makes claims. This checks the checkable ones.
 *
 * agent-evals ADR 017: a documentation claim that can be checked should be
 * checked. This repository has already shipped two documentation defects that
 * nothing caught — ADR dates incremented by hand rather than read from a
 * clock, and a rule table that drifted from the registry — and both were the
 * kind a test costs five lines to prevent.
 *
 * Only mechanical claims are checked here. "The tells that survived are
 * typographic" is an argument, and arguments are what the ADRs are for.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_RULES } from './rules/index.js';
import { REPORT_CONSTANTS } from './scoring.js';

const README = readFileSync(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8');

/** Rule names the README's table names, in `| \`rule\` |` cells. */
function tabledRules(): string[] {
  return [...README.matchAll(/^\| `([a-z-]+)` \| (?:hard|density) \|/gmu)].map((m) => m[1] ?? '');
}

describe('the README', () => {
  it('lists every registered rule in its table', () => {
    expect(tabledRules().sort()).toEqual(ALL_RULES.map((r) => r.name).sort());
  });

  it('names no rule that does not exist', () => {
    const known = new Set(ALL_RULES.map((r) => r.name));
    for (const name of tabledRules()) expect(known.has(name), name).toBe(true);
  });

  it('states the uncalibrated count the code actually declares', () => {
    // The number in the README is a claim about the code, and the code is
    // where it can drift from.
    const distinct = new Set(
      [...ALL_RULES.flatMap((r) => r.uncalibrated ?? []), ...REPORT_CONSTANTS].map((c) => c.id),
    );
    // +1 for calibrate.min-docs, declared in the calibration report rather
    // than by a rule.
    const claimed = /Uncalibrated constants \| \*\*(\d+)\*\*/u.exec(README)?.[1];
    expect(claimed).toBeDefined();
    expect(Number(claimed)).toBe(distinct.size + 1);
  });

  it('does not claim to identify authorship', () => {
    // ADR 014 withdrew that claim. This is the file where it would come back.
    const lowered = README.toLowerCase();
    expect(lowered).not.toContain('detects ai writing');
    expect(lowered).not.toContain('detect machine writing');
    expect(README).toContain('does not identify authorship');
  });

  it('says how many calibrated constants there are, and it is zero', () => {
    expect(/Calibrated constants \| \*\*0\*\*/u.test(README)).toBe(true);
  });

  it('states the number of ADRs there actually are', () => {
    // Another claim about the repository from inside the repository. The last
    // documentation defect here was dates nobody read from a clock.
    const files = readdirSync(fileURLToPath(new URL('../docs/decisions/', import.meta.url)))
      .filter((f) => /^\d{3}-.*\.md$/u.test(f));
    const words: Record<number, string> = {
      12: 'Twelve',
      13: 'Thirteen',
      14: 'Fourteen',
      15: 'Fifteen',
      16: 'Sixteen',
      17: 'Seventeen',
      18: 'Eighteen',
    };
    const claimed = words[files.length];
    expect(claimed, `no word for ${files.length} ADRs`).toBeDefined();
    expect(README).toContain(`${claimed} of them`);
  });

  it('names both repositories the idea has been applied in', () => {
    expect(README).toContain('agent-evals');
    expect(README).toContain('voice-check');
  });
});
