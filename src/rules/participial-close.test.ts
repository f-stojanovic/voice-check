import { describe, expect, it } from 'vitest';
import { participialClose } from './participial-close.js';
import { positions, runOnPadded, scored } from './rules.test-kit.js';

describe('participial-close', () => {
  it('scores prose that does not trail off 1.0', () => {
    expect(scored(runOnPadded(participialClose, 'The query came back to eighty milliseconds.', 'en')).score).toBe(1);
  });

  it('counts exactly the closing participial clauses', () => {
    const text = 'The cache warms on boot, improving latency. It retries once, avoiding a stall.';
    expect(runOnPadded(participialClose, text, 'en').findings.length).toBe(2);
  });

  it('reports the position of the -ing word, not of the comma', () => {
    expect(positions(runOnPadded(participialClose, 'The cache warms on boot, improving latency.', 'en'))).toEqual([
      '1:26',
    ]);
  });

  it('requires a comma, which removes some of the noise and not most of it', () => {
    expect(runOnPadded(participialClose, 'The job is still running.', 'en').findings).toEqual([]);
  });

  it('fires on an adjective after a comma, which is the documented false positive', () => {
    // `-ing` is not a marker of anything: here it ends an adjective in a plain
    // list. This is why the Serbian rule and this one are not comparable and
    // their numbers should not be read across languages.
    const result = runOnPadded(participialClose, 'The output was long, boring and repetitive.', 'en');
    expect(result.findings.map((f) => f.text)).toEqual(['boring']);
  });
});
