import { describe, expect, it } from 'vitest';
import { negativeParallelism } from './negative-parallelism.js';
import { positions, runOnPadded, scored } from './rules.test-kit.js';

describe('negative-parallelism', () => {
  it('scores clean Serbian prose 1.0', () => {
    const text = 'Upit je bio spor. Statistika je bila stara nedelju dana.';
    expect(scored(runOnPadded(negativeParallelism, text, 'sr')).score).toBe(1);
  });

  it('counts exactly the Serbian constructions present', () => {
    const text = ['Ovo nije alat, već filozofija.', 'Sistem nije samo brz, nego i pouzdan.'].join(
      '\n',
    );
    const result = runOnPadded(negativeParallelism, text, 'sr');
    expect(result.findings.length).toBe(2);
  });

  it('reports the line and column of the first Serbian finding', () => {
    const text = ['Prvi red je običan.', 'Ovo nije alat, već filozofija.'].join('\n');
    // "nije" starts at column 5 of line 2: O-v-o-space-n.
    expect(positions(runOnPadded(negativeParallelism, text, 'sr'))).toEqual(['2:5']);
  });

  it('counts both English shapes', () => {
    const text = "This is not just a tool but a philosophy. It's not a product, it's a practice.";
    expect(runOnPadded(negativeParallelism, text, 'en').findings.length).toBe(2);
  });

  it('scores clean English prose 1.0', () => {
    expect(scored(runOnPadded(negativeParallelism, 'The query got slower. The data had changed.', 'en')).score).toBe(1);
  });
});
