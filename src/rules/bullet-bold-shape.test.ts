import { describe, expect, it } from 'vitest';
import { bulletBoldShape } from './bullet-bold-shape.js';
import { positions, runOnPadded, scored } from './rules.test-kit.js';

describe('bullet-bold-shape', () => {
  it('scores a plain bullet list 1.0', () => {
    const text = ['- prvi razlog', '- drugi razlog'].join('\n');
    expect(scored(runOnPadded(bulletBoldShape, text, 'sr')).score).toBe(1);
  });

  it('counts exactly the shaped bullets', () => {
    const text = [
      '- **Efikasnost:** Radi brzo.',
      '- **Skalabilnost:** Radi na skali.',
      '- običan red bez podebljanja',
    ].join('\n');
    expect(runOnPadded(bulletBoldShape, text, 'sr').findings.length).toBe(2);
  });

  it('reports the position of the bolded lead-in, not the bullet marker', () => {
    const text = '- **Efikasnost:** Radi brzo.';
    expect(positions(runOnPadded(bulletBoldShape, text, 'sr'))).toEqual(['1:3']);
  });

  it('ignores a bolded term with nothing after it', () => {
    // `- **Term**` alone is a definition list entry, not the pattern the guide
    // objects to. The objection is the restating sentence that follows.
    expect(runOnPadded(bulletBoldShape, '- **Efikasnost**', 'sr').findings.length).toBe(0);
  });

  it('detects the shape only, and says so in its reason', () => {
    // Whether the sentence restates the bold word needs a judge. Until then the
    // count is an upper bound on the real defect and the report must not claim
    // otherwise.
    const result = runOnPadded(bulletBoldShape, '- **Efikasnost:** Sistem je brz.', 'sr');
    expect(result.reason).toContain('shape only');
  });
});
