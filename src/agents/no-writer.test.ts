/**
 * The test that keeps the refusal a decision.
 *
 * An absence in a codebase reads as an omission. This asserts that the set of
 * agents is exactly two, so adding a third fails the build and sends whoever
 * added it to `no-writer.ts` to disagree with the argument on purpose.
 */

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AGENTS, THE_REFUSAL } from './no-writer.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));

/** Files in `src/agents/` that are infrastructure rather than agents. */
const NOT_AGENTS = new Set(['client.ts', 'env.ts', 'pricing.ts', 'no-writer.ts', 'extract.ts']);

describe('there is no writing agent', () => {
  it('has exactly the two agents it declares', () => {
    const modules = readdirSync(HERE)
      .filter(
        (f) =>
          f.endsWith('.ts') &&
          !f.endsWith('.test.ts') &&
          !f.endsWith('.test-kit.ts') &&
          !NOT_AGENTS.has(f),
      )
      .map((f) => f.replace(/\.ts$/, ''))
      .sort();
    expect(
      modules,
      'a new agent module appeared. Read src/agents/no-writer.ts before ' +
        'adding it to AGENTS — the third agent is refused on purpose.',
    ).toEqual([...AGENTS].sort());
  });

  it('states the refusal in a form the brief prints', () => {
    // Not a README paragraph. A writer who never sees this would reasonably
    // assume the draft button is coming in a later version.
    expect(THE_REFUSAL).toContain('no drafting agent');
    expect(THE_REFUSAL.length).toBeGreaterThan(120);
  });
});
