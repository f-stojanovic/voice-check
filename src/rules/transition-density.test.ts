import { describe, expect, it } from 'vitest';
import { positions, runRule } from './rules.test-kit.js';
import { transitionDensity } from './transition-density.js';

describe('transition-density', () => {
  it('scores prose with no connectives 1.0', () => {
    expect(runRule(transitionDensity, 'Prvo sam pogledao plan izvršavanja.', 'sr').score).toBe(1);
  });

  it('counts exactly the Serbian transitions present', () => {
    const text = 'Međutim, radi. Štaviše, radi dobro. Pored toga, brzo je. Dodatno, jeftino je.';
    expect(runRule(transitionDensity, text, 'sr').findings.length).toBe(4);
  });

  it('reports the position of a transition opening the second line', () => {
    const text = ['Prvi red.', 'Međutim, drugi red je drugačiji.'].join('\n');
    expect(positions(runRule(transitionDensity, text, 'sr'))).toEqual(['2:1']);
  });

  it('counts the English transitions', () => {
    const text = 'Moreover, it works. Furthermore, it is fast. On the other hand, it costs.';
    expect(runRule(transitionDensity, text, 'en').findings.length).toBe(3);
  });

  it('does not fail one transition in three hundred words', () => {
    // The floor exists so that a working connective in a real paragraph is not
    // a finding — the rule's whole argument. The text is padded to a realistic
    // length on purpose: at 4 per 1000 words, one transition only becomes free
    // once the text is long enough for the rate to mean anything, and a
    // 40-word note with one "međutim" really does score 0. That is a genuine
    // property of scoring short texts by density, and it is asserted below
    // rather than hidden.
    const clean = 'Pokrenuo sam analizu nad tabelom i upit se vratio na prethodnu brzinu. ';
    const long = `Međutim, planer to nije mogao da zna. ${clean.repeat(25)}`;
    const result = runRule(transitionDensity, long, 'sr');
    expect(result.findings.length).toBe(1);
    expect(result.score).toBe(1);

    const short = 'Međutim, planer to nije mogao da zna.';
    expect(runRule(transitionDensity, short, 'sr').score).toBe(0);
  });
});
